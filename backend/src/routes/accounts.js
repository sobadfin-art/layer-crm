import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { TYPOLOGIES, sectorForTypology } from "../lib/typology.js";
import { REGIMES_FISCAUX, defaultRegimeFiscalForCountry } from "../lib/taxRegime.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { toCamel, toCamelList } from "../lib/serialize.js";
import { logAudit } from "../lib/audit.js";
import { notifyUsers, userIdsWithRoles } from "../lib/notifications.js";
import {
  geocodeAndStoreAccount,
  GEOCODING_TRIGGER_FIELDS,
  fetchUngeocodedAccounts,
  countUngeocodedAccounts,
  geocodeAccountsBatch,
} from "../lib/geocoding.js";
import {
  accountsScopeClause,
  canAccessAccount,
  canReassignAccount,
  canArchiveAccount,
} from "../lib/scope.js";

export const accountsRouter = Router();

const ACCOUNTS_MODULE_ROLES = [
  ROLES.REPRESENTANT,
  ROLES.MASTER_REP,
  ROLES.FRONT_DESK,
  ROLES.DIRECTEUR,
  ROLES.ADMINISTRATEUR,
];

// L'administrateur a un accès lecture/écriture complet à la fiche client, au
// même niveau que le front desk (cf. docs/cahier-des-charges-import-fiches-
// client.md section 2) — à l'exception explicite du pipeline commercial : la
// route dédiée ci-dessous exclut ce rôle malgré sa présence dans
// ACCOUNTS_MODULE_ROLES. Les commandes (orders.js) restent, elles, un module
// entièrement séparé jamais ouvert à ADMINISTRATEUR.
const PIPELINE_ROLES = ACCOUNTS_MODULE_ROLES.filter((r) => r !== ROLES.ADMINISTRATEUR);

const addressFields = {
  billingStreet: z.string().optional().nullable(),
  billingZip: z.string().optional().nullable(),
  billingCity: z.string().optional().nullable(),
  shippingStreet: z.string().optional().nullable(),
  shippingZip: z.string().optional().nullable(),
  shippingCity: z.string().optional().nullable(),
};

const contactFields = {
  contactName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  phoneCountryCode: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  mobileCountryCode: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
};

const financialFields = {
  taxId: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  bic: z.string().optional().nullable(),
  dolibarrCodeClient: z.string().optional().nullable(), // rapprochement Dolibarr (Lot 4)
  sepaMandateStatus: z
    .enum(["NON_RENSEIGNE", "EN_ATTENTE", "VALIDE", "REVOQUE"])
    .optional(),
  // Régime fiscal (base du calcul de TVA export Dolibarr) — indépendant de la
  // typologie commerciale, qui reste un champ marketing distinct. Défaut
  // dérivé du pays à la création (jamais RECARGO_EQUIVALENCIA), toujours
  // modifiable manuellement cas par cas — voir lib/taxRegime.js.
  regimeFiscal: z.enum(REGIMES_FISCAUX).optional(),
};

const createSchema = z.object({
  type: z.enum(["CLIENT", "PROSPECT"]),
  name: z.string().min(1),
  // "Nom alternatif" dans l'export Dolibarr — nom du magasin, distinct du nom
  // de l'enseigne (cf. docs/cahier-des-charges-import-fiches-client.md).
  storeName: z.string().optional().nullable(),
  countryCode: z.string().length(2),
  typology: z.enum(TYPOLOGIES),
  ownerRepId: z.string().uuid().optional(),
  masterRepId: z.string().uuid().optional().nullable(),
  ...addressFields,
  ...contactFields,
  ...financialFields,
  // Correctif 2026-09-18 (fiche "UPDATE CRM" évolution 5) : SIRET/identifiant
  // d'entreprise et adresse de facturation deviennent obligatoires à la
  // CRÉATION uniquement — ces trois lignes surchargent volontairement les
  // versions optionnelles héritées de addressFields/financialFields
  // ci-dessus (l'ordre des propriétés d'un objet littéral fait gagner la
  // dernière définition). Object.keys(addressFields)/(financialFields), eux,
  // ne changent pas : le mécanisme générique de PATCH (simpleFields,
  // plus bas) continue donc de fonctionner à l'identique pour ces champs.
  // `updateSchema` ci-dessous applique `.partial()` sur ce schéma complet,
  // ce qui les rend automatiquement de nouveau optionnels pour la mise à
  // jour (PATCH) — seule la création exige ces informations, comme demandé.
  billingStreet: z.string().min(1, "L'adresse de facturation (rue) est obligatoire."),
  billingZip: z.string().min(1, "L'adresse de facturation (code postal) est obligatoire."),
  billingCity: z.string().min(1, "L'adresse de facturation (ville) est obligatoire."),
  taxId: z.string().min(1, "Le SIRET / identifiant d'entreprise est obligatoire."),
  // Note / instructions de livraison — champ dédié, distinct de tout autre
  // champ existant, jamais obligatoire (cf. migration
  // 022_accounts_delivery_note.sql et fiche "UPDATE CRM" évolution 1).
  deliveryNote: z.string().optional().nullable(),
  // Nom commercial — champ dédié, distinct de `name` (raison sociale) et de
  // `storeName` (usage différent, cf. migration
  // 023_accounts_nom_commercial.sql), jamais obligatoire. Utilisé par la
  // recherche client (ClientsList.jsx, NewOrderQuickAccess.jsx).
  nomCommercial: z.string().optional().nullable(),
});

const updateSchema = createSchema.partial().extend({
  // le type et la typologie restent modifiables indépendamment de la création.
  // ownerRepId accepte explicitement `null` ici (jamais à la création,
  // ci-dessus) — un compte peut désormais arriver sans représentant assigné
  // via l'import en masse sans représentant pré-sélectionné (fiche
  // corrective V2 Administrateur section 3, cf. migration
  // 018_accounts_owner_rep_nullable.sql) ; la réaffectation front desk/
  // directeur/administrateur (lib/scope.js canReassignAccount) doit donc
  // pouvoir aussi bien assigner que revenir à "non assigné".
  ownerRepId: z.string().uuid().optional().nullable(),
});

async function resolveCountryId(countryCode) {
  const { rows } = await query("SELECT id FROM countries WHERE code = $1", [
    countryCode.toUpperCase(),
  ]);
  return rows[0]?.id || null;
}

// ---------------------------------------------------------------------------
// GET /api/accounts — liste, filtrée selon le rôle (cf. lib/scope.js)
// ---------------------------------------------------------------------------
accountsRouter.get(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const { where, params } = accountsScopeClause(req.user);
    const clauses = [where];
    // Par défaut, les comptes archivés n'encombrent pas la liste courante —
    // toujours consultables explicitement via ?status=ARCHIVE (hypothèse
    // d'ergonomie, aucune donnée n'est jamais supprimée). ?status= accepte une
    // valeur unique ou une liste séparée par virgules.
    if (req.query.status) {
      const statuses = String(req.query.status).split(",");
      params.push(statuses);
      clauses.push(`a.status::text = ANY($${params.length}::text[])`);
    } else {
      clauses.push(`a.status != 'ARCHIVE'`);
    }
    // Nom du représentant propriétaire joint pour l'affichage (utile
    // notamment au Master Rep, qui voit les comptes de plusieurs représentants
    // de son équipe en plus des siens propres — cf. accountsScopeClause —
    // et doit pouvoir distinguer qui possède quoi dans la liste).
    const { rows } = await query(
      `SELECT a.*, c.code AS country_code, c.name AS country_name, c.tax_id_label,
              owner_u.first_name AS owner_rep_first_name, owner_u.last_name AS owner_rep_last_name
       FROM accounts a
       JOIN countries c ON c.id = a.country_id
       LEFT JOIN users owner_u ON owner_u.id = a.owner_rep_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC`,
      params
    );
    res.json(toCamelList(rows));
  }
);

// ---------------------------------------------------------------------------
// GET /api/accounts/map — données pour l'écran Carte. Depuis le correctif
// 2026-09-23 ("vraie carte interactive Mapbox GL JS en remplacement du rendu
// stylisé V1"), renvoie aussi latitude/longitude (cf. migration
// 024_accounts_geocoding.sql et lib/geocoding.js) — une fiche sans
// coordonnées (géocodage jamais fait ou sans résultat exploitable) renvoie
// latitude/longitude à `null` ; c'est au frontend de l'exclure du rendu de
// la carte plutôt que de fausser le filtre ici. Doit être déclarée AVANT
// /:id pour ne pas être interceptée par ce paramètre générique.
// ---------------------------------------------------------------------------
accountsRouter.get(
  "/map",
  requireAuth,
  requireRole(ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.DIRECTEUR),
  async (req, res) => {
    const { where, params } = accountsScopeClause(req.user);
    const clauses = [where, "a.status != 'ARCHIVE'"];
    let i = params.length + 1;

    if (req.query.type) {
      clauses.push(`a.type = $${i++}`);
      params.push(req.query.type);
    }
    if (req.query.typology) {
      clauses.push(`a.typology::text = $${i++}`);
      params.push(req.query.typology);
    }
    if (req.query.repId) {
      clauses.push(`a.owner_rep_id = $${i++}`);
      params.push(req.query.repId);
    }
    if (req.query.masterRepId) {
      clauses.push(`a.master_rep_id = $${i++}`);
      params.push(req.query.masterRepId);
    }

    const { rows } = await query(
      `SELECT a.id, a.name, a.type, a.typology, a.pipeline_stage, a.latitude, a.longitude,
              a.owner_rep_id, owner_u.first_name AS owner_rep_first_name, owner_u.last_name AS owner_rep_last_name
       FROM accounts a
       LEFT JOIN users owner_u ON owner_u.id = a.owner_rep_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.name ASC
       LIMIT 500`,
      params
    );
    res.json(toCamelList(rows));
  }
);

// ---------------------------------------------------------------------------
// POST /api/accounts/geocode-retroactive — rattrapage du géocodage pour les
// fiches déjà en base au moment du correctif 2026-09-23 (cf. migration
// 024_accounts_geocoding.sql). Traite un LOT à la fois (`?limit=`, 10 par
// défaut, plafonné à 25) plutôt que toutes les fiches d'un coup : avec la
// limite d'1 requête Nominatim/seconde (lib/geocoding.js), un lot trop
// grand dépasserait le délai d'expiration d'une requête HTTP. L'écran Admin
// dédié (frontend/src/pages/GeocodeRetroactive.jsx) boucle sur cet endpoint
// jusqu'à ce que `remaining` atteigne 0. Existe spécifiquement parce que le
// plan Render du client n'inclut pas l'accès Shell, qui aurait autrement
// permis de lancer `npm run geocode-accounts` directement (toujours
// disponible pour un environnement qui, lui, a le Shell).
// Réservé à l'Administrateur, comme "Import photos en masse" (même
// registre : opération de maintenance de données, pas un usage courant).
// Déclarée AVANT /:id pour ne pas être interceptée par ce paramètre
// générique.
// ---------------------------------------------------------------------------
// Compteur seul (pas de traitement) — utilisé par l'écran Admin pour savoir
// s'il y a quelque chose à faire, sans déclencher un géocodage juste en
// arrivant sur la page (une lecture ne doit jamais avoir d'effet de bord).
accountsRouter.get(
  "/geocode-retroactive/count",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    res.json({ remaining: await countUngeocodedAccounts() });
  }
);

accountsRouter.post(
  "/geocode-retroactive",
  requireAuth,
  requireRole(ROLES.ADMINISTRATEUR),
  async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 25);
    const accounts = await fetchUngeocodedAccounts(limit);
    const { converted, failedNoAddress, failedNotFound, details } = await geocodeAccountsBatch(accounts);
    const remaining = await countUngeocodedAccounts();

    res.json({
      processed: accounts.length,
      converted,
      failedNoAddress,
      failedNotFound,
      remaining,
      details,
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/accounts/:id
// ---------------------------------------------------------------------------
accountsRouter.get(
  "/:id",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, c.code AS country_code, c.name AS country_name, c.tax_id_label,
              owner_u.first_name AS owner_rep_first_name, owner_u.last_name AS owner_rep_last_name
       FROM accounts a
       JOIN countries c ON c.id = a.country_id
       LEFT JOIN users owner_u ON owner_u.id = a.owner_rep_id
       WHERE a.id = $1`,
      [req.params.id]
    );
    const account = rows[0];
    if (!account) return res.status(404).json({ error: "Compte introuvable." });
    if (!(await canAccessAccount(req.user, account))) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }
    res.json(toCamel(account));
  }
);

// ---------------------------------------------------------------------------
// POST /api/accounts — création
// ---------------------------------------------------------------------------
accountsRouter.post(
  "/",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const countryId = await resolveCountryId(data.countryCode);
    if (!countryId) {
      return res.status(400).json({ error: `Pays inconnu : ${data.countryCode}` });
    }

    let ownerRepId;
    let masterRepId = null;

    if (req.user.role === ROLES.REPRESENTANT) {
      // Un représentant est automatiquement propriétaire de ce qu'il crée,
      // et ne peut jamais s'affecter un masterRep lui-même (cf. section 3).
      ownerRepId = req.user.id;
      // Champ informatif (affichage, filtre carte) renseigné avec son Master
      // Rep ACTUEL s'il en a un — corrige le cas le plus fréquent qui
      // laissait ce champ vide (fiche corrective Master Rep V4 : "comptes de
      // l'équipe pas correctement affichés"). Le contrôle d'accès réel, lui,
      // ne dépend plus de ce champ du tout depuis le même correctif (cf.
      // lib/scope.js) : ceci ne fait qu'améliorer la donnée affichée.
      const { rows: mrRows } = await query(
        `SELECT mr.user_id FROM sales_reps sr
         JOIN master_reps mr ON sr.master_rep_id = mr.id
         WHERE sr.user_id = $1`,
        [req.user.id]
      );
      masterRepId = mrRows[0]?.user_id ?? null;
    } else if (req.user.role === ROLES.MASTER_REP) {
      // Règle confirmée : le Master Rep choisit un représentant de son équipe
      // (champ obligatoire dans l'UI, mais côté API on accepte son absence) ;
      // s'il n'en désigne aucun, le compte lui reste directement rattaché —
      // jamais de compte orphelin sans ownerRep.
      if (data.ownerRepId) {
        const managed = await getManagedRepUserIds(req.user.id);
        if (!managed.includes(data.ownerRepId)) {
          return res.status(403).json({
            error: "Ce représentant ne vous est pas affecté.",
          });
        }
        ownerRepId = data.ownerRepId;
        masterRepId = req.user.id;
      } else {
        ownerRepId = req.user.id;
        masterRepId = null;
      }
    } else {
      // FRONT_DESK, DIRECTEUR
      if (!data.ownerRepId) {
        return res.status(400).json({ error: "ownerRepId requis." });
      }
      ownerRepId = data.ownerRepId;
      masterRepId = data.masterRepId ?? null;
    }

    const sector = sectorForTypology(data.typology);
    // Régime fiscal : dérivé du pays par défaut (jamais RECARGO_EQUIVALENCIA
    // automatiquement), mais toujours écrasable manuellement dès la création.
    const regimeFiscal = data.regimeFiscal ?? defaultRegimeFiscalForCountry(data.countryCode.toUpperCase());

    const { rows } = await query(
      `INSERT INTO accounts (
        type, name, store_name, country_id, typology, sector,
        billing_street, billing_zip, billing_city,
        shipping_street, shipping_zip, shipping_city,
        contact_name, phone, phone_country_code, mobile, mobile_country_code, email,
        tax_id, vat_number, iban, bic, sepa_mandate_status, regime_fiscal,
        delivery_note, nom_commercial,
        pipeline_stage, owner_rep_id, master_rep_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24,
        $25, $26,
        'Nouveau', $27, $28
      ) RETURNING *`,
      [
        data.type,
        data.name,
        data.storeName ?? null,
        countryId,
        data.typology,
        sector,
        data.billingStreet ?? null,
        data.billingZip ?? null,
        data.billingCity ?? null,
        data.shippingStreet ?? null,
        data.shippingZip ?? null,
        data.shippingCity ?? null,
        data.contactName ?? null,
        data.phone ?? null,
        data.phoneCountryCode ?? null,
        data.mobile ?? null,
        data.mobileCountryCode ?? null,
        data.email ?? null,
        data.taxId ?? null,
        data.vatNumber ?? null,
        data.iban ?? null,
        data.bic ?? null,
        data.sepaMandateStatus ?? "NON_RENSEIGNE",
        regimeFiscal,
        data.deliveryNote ?? null,
        data.nomCommercial ?? null,
        ownerRepId,
        masterRepId,
      ]
    );

    await logAudit({
      userId: req.user.id,
      action: "ACCOUNT_CREATED",
      entity: "accounts",
      entityId: rows[0].id,
      details: { name: rows[0].name, type: rows[0].type, regimeFiscal: rows[0].regime_fiscal },
    });

    // Notification Front desk (cf. PDF Front Desk section 2 : "Création d'un
    // nouveau client ou prospect" doit déclencher une notification exploitable
    // avec accès direct à la fiche, pour contrôle/validation des informations
    // récupérées). Le directeur la reçoit aussi (vision globale, comme pour
    // ORDER_SENT_TO_FRONT_DESK et SAV_TICKET_CREATED). On exclut le créateur
    // lui-même de la liste des destinataires : inutile de le notifier d'une
    // fiche qu'il vient de créer.
    const accountRecipients = (await userIdsWithRoles([ROLES.FRONT_DESK, ROLES.DIRECTEUR])).filter(
      (id) => id !== req.user.id
    );
    await notifyUsers(accountRecipients, {
      type: "ACCOUNT_CREATED",
      title: data.type === "PROSPECT" ? "Nouveau prospect" : "Nouveau client",
      body: rows[0].name,
      entity: "accounts",
      entityId: rows[0].id,
    });

    // Géocodage automatique (demande client 2026-09-23, invisible pour
    // l'utilisateur) — cf. lib/geocoding.js. Fait après l'INSERT/l'audit/la
    // notification pour ne jamais les retarder en cas de lenteur Nominatim ;
    // avant la réponse pour que la fiche apparaisse sur la carte dès son
    // premier affichage plutôt que d'attendre une prochaine modification.
    const coords = await geocodeAndStoreAccount(rows[0].id, data, data.countryCode);
    rows[0].latitude = coords?.latitude ?? null;
    rows[0].longitude = coords?.longitude ?? null;

    res.status(201).json(toCamel(rows[0]));
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/accounts/:id — mise à jour
// ---------------------------------------------------------------------------
accountsRouter.patch(
  "/:id",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const { rows: existingRows } = await query("SELECT * FROM accounts WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Compte introuvable." });
    if (!(await canAccessAccount(req.user, existing))) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }

    if (
      (data.ownerRepId !== undefined || data.masterRepId !== undefined) &&
      !canReassignAccount(req.user.role)
    ) {
      return res.status(403).json({
        error: "Seuls le front desk et le directeur peuvent réaffecter un compte.",
      });
    }

    const sets = [];
    const params = [];
    let i = 1;

    const simpleFields = [
      "type",
      "name",
      "storeName",
      "ownerRepId",
      "masterRepId",
      "deliveryNote",
      "nomCommercial",
      ...Object.keys(addressFields),
      ...Object.keys(contactFields),
      ...Object.keys(financialFields),
    ];
    const columnFor = (f) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

    for (const field of simpleFields) {
      if (data[field] !== undefined) {
        sets.push(`${columnFor(field)} = $${i++}`);
        params.push(data[field]);
      }
    }

    if (data.typology !== undefined) {
      sets.push(`typology = $${i++}`);
      params.push(data.typology);
      sets.push(`sector = $${i++}`);
      params.push(sectorForTypology(data.typology));
    }

    if (data.countryCode !== undefined) {
      const countryId = await resolveCountryId(data.countryCode);
      if (!countryId) {
        return res.status(400).json({ error: `Pays inconnu : ${data.countryCode}` });
      }
      sets.push(`country_id = $${i++}`);
      params.push(countryId);
      // Règle définitive confirmée : changer le pays d'un compte existant ne
      // doit JAMAIS recalculer regime_fiscal automatiquement. defaultRegimeFiscalForCountry()
      // ne sert qu'à la création (POST, plus haut). Si le régime doit changer suite à un
      // changement de pays, c'est un choix manuel via `regimeFiscal` dans le même PATCH ou un
      // PATCH séparé — volontairement pas de logique automatique ici.
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: "Aucun champ à mettre à jour." });
    }

    sets.push(`updated_at = now()`);
    params.push(req.params.id);

    const { rows } = await query(
      `UPDATE accounts SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );

    await logAudit({
      userId: req.user.id,
      action: "ACCOUNT_UPDATED",
      entity: "accounts",
      entityId: req.params.id,
      details: { fields: Object.keys(data) },
    });

    // Re-géocodage automatique (demande client 2026-09-23, invisible pour
    // l'utilisateur) — UNIQUEMENT si ce PATCH touche un champ d'adresse
    // (cf. GEOCODING_TRIGGER_FIELDS, lib/geocoding.js) : une mise à jour qui
    // ne change que le représentant, la typologie, etc. ne doit jamais
    // rappeler Nominatim (limite d'1 requête/seconde de leur politique
    // d'usage). `rows[0]` (résultat du RETURNING *, en snake_case) contient
    // déjà l'adresse à jour, qu'elle ait ou non été modifiée par CE patch —
    // pickAddressForGeocoding() choisit toujours livraison puis repli
    // facturation sur l'état actuel complet de la fiche.
    if (GEOCODING_TRIGGER_FIELDS.some((field) => data[field] !== undefined)) {
      const { rows: countryRows } = await query("SELECT code FROM countries WHERE id = $1", [
        rows[0].country_id,
      ]);
      const coords = await geocodeAndStoreAccount(rows[0].id, rows[0], countryRows[0]?.code);
      rows[0].latitude = coords?.latitude ?? null;
      rows[0].longitude = coords?.longitude ?? null;
    }

    res.json(toCamel(rows[0]));
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/accounts/:id/pipeline — changement de statut pipeline
// ---------------------------------------------------------------------------
const PIPELINE_STAGES = [
  "Nouveau",
  "Contacté",
  "RDV prévu",
  "Devis en cours",
  "Négociation",
  "Gagné",
  "Perdu",
];

accountsRouter.patch(
  "/:id/pipeline",
  requireAuth,
  requireRole(...PIPELINE_ROLES),
  async (req, res) => {
    const schema = z.object({ stage: z.enum(PIPELINE_STAGES) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Statut de pipeline invalide." });
    }

    const { rows: existingRows } = await query("SELECT * FROM accounts WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Compte introuvable." });
    if (!(await canAccessAccount(req.user, existing))) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }

    const { stage } = parsed.data;
    const wonDate = stage === "Gagné" ? new Date() : existing.won_date;
    const lostDate = stage === "Perdu" ? new Date() : existing.lost_date;

    const { rows } = await query(
      `UPDATE accounts
       SET pipeline_stage = $1, won_date = $2, lost_date = $3, updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [stage, wonDate, lostDate, req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "ACCOUNT_PIPELINE_CHANGED",
      entity: "accounts",
      entityId: req.params.id,
      details: { from: existing.pipeline_stage, to: stage },
    });

    res.json(toCamel(rows[0]));
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/accounts/:id/status — cycle de vie confirmé : ACTIF -> INACTIF ->
// ARCHIVE. Jamais de suppression de compte ni de son historique. ACTIF<->INACTIF
// est une bascule opérationnelle ouverte à tout rôle ayant accès au compte ;
// l'archivage (INACTIF -> ARCHIVE, terminal) est réservé front desk/directeur.
// ---------------------------------------------------------------------------
const STATUS_TRANSITIONS = {
  ACTIF: ["INACTIF"],
  INACTIF: ["ACTIF", "ARCHIVE"],
  ARCHIVE: [], // terminal — aucune sortie possible, jamais de suppression.
};

accountsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole(...ACCOUNTS_MODULE_ROLES),
  async (req, res) => {
    const schema = z.object({ status: z.enum(["ACTIF", "INACTIF", "ARCHIVE"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Statut invalide." });

    const { rows: existingRows } = await query("SELECT * FROM accounts WHERE id = $1", [
      req.params.id,
    ]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: "Compte introuvable." });
    if (!(await canAccessAccount(req.user, existing))) {
      return res.status(403).json({ error: "Accès refusé à ce compte." });
    }

    const target = parsed.data.status;
    if (target === "ARCHIVE" && !canArchiveAccount(req.user.role)) {
      return res.status(403).json({
        error: "Seuls le front desk et le directeur peuvent archiver un compte.",
      });
    }

    const allowed = STATUS_TRANSITIONS[existing.status] || [];
    if (existing.status !== target && !allowed.includes(target)) {
      return res.status(409).json({
        error: `Transition ${existing.status} -> ${target} non autorisée (cycle : ACTIF -> INACTIF -> ARCHIVE).`,
      });
    }

    const archivedAt = target === "ARCHIVE" ? new Date() : existing.archived_at;

    const { rows } = await query(
      `UPDATE accounts SET status = $1, archived_at = $2, updated_at = now() WHERE id = $3 RETURNING *`,
      [target, archivedAt, req.params.id]
    );

    await logAudit({
      userId: req.user.id,
      action: "ACCOUNT_STATUS_CHANGED",
      entity: "accounts",
      entityId: req.params.id,
      details: { from: existing.status, to: target },
    });

    res.json(toCamel(rows[0]));
  }
);
