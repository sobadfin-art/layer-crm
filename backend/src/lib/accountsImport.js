// Logique métier de l'import fiches client — cf.
// docs/cahier-des-charges-import-fiches-client.md sections 4 à 9 et
// docs/cahier-des-charges-champs-import.md (inventaire complet des champs
// importables). Séparée des routes pour rester testable indépendamment de
// HTTP (même approche que lib/catalogImport.js).
import { pool } from "./db.js";
import { defaultRegimeFiscalForCountry, REGIMES_FISCAUX } from "./taxRegime.js";
import { resolveTypology, sectorForTypology } from "./typology.js";

// Indicatifs téléphoniques dérivés automatiquement du pays résolu (section 6
// du cahier des charges) — l'export Dolibarr ne les fournit jamais. Limité
// aux 9 pays actuellement au référentiel (countries), comme le reste de
// l'application (cf. taxRegime.js).
export const DIAL_CODES = {
  FR: "+33",
  ES: "+34",
  CH: "+41",
  DE: "+49",
  IT: "+39",
  PT: "+351",
  GB: "+44",
  BE: "+32",
  NL: "+31",
};

const SEPA_STATUSES = ["NON_RENSEIGNE", "EN_ATTENTE", "VALIDE", "REVOQUE"];
const SEPA_LABEL_TO_ENUM = {
  "non renseigne": "NON_RENSEIGNE",
  "en attente": "EN_ATTENTE",
  valide: "VALIDE",
  revoque: "REVOQUE",
};

function normalizeText(v) {
  return v
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function trimOrNull(v) {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s === "" ? null : s;
}

function resolveSepaStatus(rawValue) {
  // sepa_mandate_status est NOT NULL en base et son enum porte déjà une
  // valeur "non renseigné" dédiée -> une cellule vide (colonne mappée mais
  // valeur absente sur cette ligne) résout vers cette valeur plutôt que vers
  // SQL NULL (qui violerait la contrainte NOT NULL au moment de la mise à
  // jour, cf. INSERT qui s'en sortait par un `?? "NON_RENSEIGNE"` que le
  // chemin UPDATE n'appliquait pas).
  if (!rawValue) return "NON_RENSEIGNE";
  const upper = String(rawValue).trim().toUpperCase();
  if (SEPA_STATUSES.includes(upper)) return upper;
  return SEPA_LABEL_TO_ENUM[normalizeText(rawValue)] || "NON_RENSEIGNE";
}

function resolveRegimeFiscal(rawValue) {
  if (!rawValue) return undefined; // pas fourni -> laisser la dérivation habituelle s'appliquer
  const upper = String(rawValue).trim().toUpperCase();
  return REGIMES_FISCAUX.includes(upper) ? upper : undefined;
}

function resolveType(rawValue) {
  const norm = rawValue ? normalizeText(rawValue) : "";
  if (norm === "prospect") return "PROSPECT";
  return "CLIENT"; // toujours CLIENT par défaut, y compris valeur non reconnue (section 6)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Charge la liste des pays et retourne une map { nom normalisé -> {id, code} },
// pour résoudre "France" (nom en toutes lettres dans l'export Dolibarr) vers
// le pays en base — section 6, aucun fallback pour un pays inconnu.
export async function loadCountriesByName() {
  const { rows } = await pool.query("SELECT id, code, name FROM countries");
  const map = new Map();
  for (const c of rows) map.set(normalizeText(c.name), { id: c.id, code: c.code });
  return map;
}

// Transforme les lignes brutes du fichier en lignes classifiées, prêtes à être
// résumées (étape 8) ou appliquées (étape 9), en fonction du mapping choisi.
// Le socle (id, name, countryName, billing*, phone/mobile, email, vatNumber,
// ownerRepId) correspond à l'export Dolibarr standard ; les champs "enrichis"
// (type, typology, contactName, taxId, iban, bic, sepaMandateStatus,
// regimeFiscal, masterRepId, shipping*) ne sont pris en compte que si le
// fichier les fournit (cf. docs/cahier-des-charges-champs-import.md) — jamais
// bloquant s'ils sont absents.
export function classifyRows(rows, mapping, countriesByName) {
  if (!mapping.id) {
    throw new Error("La colonne Id doit être mappée — c'est la clé de rapprochement, obligatoire.");
  }
  if (!mapping.name) {
    throw new Error("La colonne Nom doit être mappée — obligatoire.");
  }
  if (!mapping.countryName) {
    throw new Error("La colonne Pays doit être mappée — obligatoire.");
  }

  return rows.map((row, index) => {
    const dolibarrId = trimOrNull(row[mapping.id]);
    if (!dolibarrId) {
      return { rowIndex: index, dolibarrId: null, error: "Id manquant" };
    }

    const name = trimOrNull(row[mapping.name]);
    if (!name) {
      return { rowIndex: index, dolibarrId, error: "Nom manquant" };
    }

    const countryRaw = mapping.countryName ? row[mapping.countryName] : "";
    const countryMatch = trimOrNull(countryRaw)
      ? countriesByName.get(normalizeText(countryRaw))
      : null;
    if (!countryMatch) {
      return {
        rowIndex: index,
        dolibarrId,
        error: trimOrNull(countryRaw)
          ? `Pays inconnu : ${countryRaw}`
          : "Pays manquant",
      };
    }

    if (mapping.email) {
      const emailRaw = trimOrNull(row[mapping.email]);
      if (emailRaw && !EMAIL_RE.test(emailRaw)) {
        return { rowIndex: index, dolibarrId, error: `Email invalide : ${emailRaw}` };
      }
    }

    // Statut du compte (section 6) : 1 = Actif, 0 = Inactif. Absent ou toute
    // autre valeur -> Actif (repli sûr, cohérent avec le défaut habituel de
    // création manuelle), jamais rejeté pour ce seul motif.
    const statusRaw = mapping.status ? trimOrNull(row[mapping.status]) : null;
    const status = statusRaw === "0" ? "INACTIF" : "ACTIF";

    const fields = {}; // uniquement les champs réellement mappés (jamais écraser le reste — section 9)
    if (mapping.storeName) fields.storeName = trimOrNull(row[mapping.storeName]);
    if (mapping.status) fields.status = status;

    // Adresse "socle" (toujours présente) -> facturation. Livraison : reprend
    // les colonnes dédiées si le fichier les fournit (enrichi), sinon
    // dupliquée depuis la facturation (comportement confirmé pour l'export
    // standard, section 5).
    if (mapping.billingStreet) fields.billingStreet = trimOrNull(row[mapping.billingStreet]);
    if (mapping.billingZip) fields.billingZip = trimOrNull(row[mapping.billingZip]);
    if (mapping.billingCity) fields.billingCity = trimOrNull(row[mapping.billingCity]);
    if (mapping.billingStreet || mapping.shippingStreet) {
      fields.shippingStreet = mapping.shippingStreet
        ? trimOrNull(row[mapping.shippingStreet])
        : fields.billingStreet;
    }
    if (mapping.billingZip || mapping.shippingZip) {
      fields.shippingZip = mapping.shippingZip ? trimOrNull(row[mapping.shippingZip]) : fields.billingZip;
    }
    if (mapping.billingCity || mapping.shippingCity) {
      fields.shippingCity = mapping.shippingCity
        ? trimOrNull(row[mapping.shippingCity])
        : fields.billingCity;
    }

    if (mapping.phone) {
      fields.phone = trimOrNull(String(row[mapping.phone] ?? "").replace(/\s+/g, ""));
      fields.phoneCountryCode = fields.phone ? DIAL_CODES[countryMatch.code] ?? null : null;
    }
    if (mapping.mobile) {
      fields.mobile = trimOrNull(String(row[mapping.mobile] ?? "").replace(/\s+/g, ""));
      fields.mobileCountryCode = fields.mobile ? DIAL_CODES[countryMatch.code] ?? null : null;
    }
    if (mapping.email) fields.email = trimOrNull(row[mapping.email]);
    if (mapping.vatNumber) fields.vatNumber = trimOrNull(row[mapping.vatNumber]);
    // ID du représentant/master rep (substitué par l'administrateur avant
    // import, cf. section 4) — résolu/validé plus loin (summarizeImport /
    // applyImport), pas ici, car ça demande une requête sur les utilisateurs.
    if (mapping.ownerRepId) fields.ownerRepIdRaw = trimOrNull(row[mapping.ownerRepId]);
    if (mapping.masterRepId) fields.masterRepIdRaw = trimOrNull(row[mapping.masterRepId]);

    // --- Champs enrichis (jamais dans l'export Dolibarr standard) ---
    if (mapping.type) fields.type = resolveType(row[mapping.type]);
    if (mapping.typology) {
      fields.typology = resolveTypology(row[mapping.typology]);
      fields.sector = sectorForTypology(fields.typology);
    }
    if (mapping.contactName) fields.contactName = trimOrNull(row[mapping.contactName]);
    if (mapping.taxId) fields.taxId = trimOrNull(row[mapping.taxId]);
    if (mapping.iban) fields.iban = trimOrNull(row[mapping.iban]);
    if (mapping.bic) fields.bic = trimOrNull(row[mapping.bic]);
    if (mapping.sepaMandateStatus) fields.sepaMandateStatus = resolveSepaStatus(row[mapping.sepaMandateStatus]);
    if (mapping.regimeFiscal) {
      const resolved = resolveRegimeFiscal(row[mapping.regimeFiscal]);
      if (resolved) fields.regimeFiscal = resolved;
    }

    return {
      rowIndex: index,
      dolibarrId,
      name,
      countryId: countryMatch.id,
      countryCode: countryMatch.code,
      status: mapping.status ? status : "ACTIF", // valeur par défaut à la création si État non mappé
      fields,
    };
  });
}

async function resolveValidUserIds(client, rawValues, roles) {
  const ids = rawValues.filter((v) => v != null);
  if (ids.length === 0) return new Set();
  const { rows } = await client.query(
    "SELECT id FROM users WHERE id::text = ANY($1::text[]) AND role::text = ANY($2::text[])",
    [ids, roles]
  );
  return new Set(rows.map((r) => r.id));
}

// Détail des lignes rejetées (point 14 de la fiche corrective "CORRECTIFS CRM
// — PROFIL ADMINISTRATEUR" : même exigence que l'import catalogue, section
// 13 — cf. `lib/catalogImport.js` pour le raisonnement complet). `dolibarrId`
// sert d'identifiant de ligne ici (peut être vide pour une ligne rejetée
// avant même sa lecture, ex. "Id manquant").
const MAX_ERROR_DETAILS = 50;
function extractErrorDetails(classified) {
  const errorRows = classified.filter((r) => r.error);
  return {
    errorDetails: errorRows.slice(0, MAX_ERROR_DETAILS).map((r) => ({
      row: r.rowIndex + 2,
      ref: r.dolibarrId || null,
      error: r.error,
    })),
    errorDetailsTruncated: errorRows.length > MAX_ERROR_DETAILS,
  };
}

// Étape 8 : résumé sans écriture (nouvelles / mises à jour / erreurs / lignes
// sans représentant reconnu -> repli sur le représentant par défaut).
export async function summarizeImport(classified) {
  const validRows = classified.filter((r) => !r.error);
  const errorCount = classified.length - validRows.length;

  let existingIds = new Set();
  const ids = validRows.map((r) => r.dolibarrId);
  if (ids.length > 0) {
    const { rows } = await pool.query(
      "SELECT dolibarr_code_client FROM accounts WHERE dolibarr_code_client = ANY($1::text[])",
      [ids]
    );
    existingIds = new Set(rows.map((r) => r.dolibarr_code_client));
  }

  const validRepIds = await resolveValidUserIds(
    pool,
    validRows.map((r) => r.fields.ownerRepIdRaw),
    ["REPRESENTANT", "MASTER_REP"]
  );
  const repFallbackCount = validRows.filter(
    (r) => !r.fields.ownerRepIdRaw || !validRepIds.has(r.fields.ownerRepIdRaw)
  ).length;

  const newCount = validRows.filter((r) => !existingIds.has(r.dolibarrId)).length;
  const updateCount = validRows.filter((r) => existingIds.has(r.dolibarrId)).length;

  return {
    total: classified.length,
    newCount,
    updateCount,
    errorCount,
    repFallbackCount,
    ...extractErrorDetails(classified),
  };
}

const SIMPLE_FIELD_COLUMNS = {
  storeName: "store_name",
  status: "status",
  billingStreet: "billing_street",
  billingZip: "billing_zip",
  billingCity: "billing_city",
  shippingStreet: "shipping_street",
  shippingZip: "shipping_zip",
  shippingCity: "shipping_city",
  email: "email",
  vatNumber: "vat_number",
  contactName: "contact_name",
  taxId: "tax_id",
  iban: "iban",
  bic: "bic",
  sepaMandateStatus: "sepa_mandate_status",
  regimeFiscal: "regime_fiscal",
  type: "type",
  typology: "typology",
  sector: "sector",
};

// Étape 9 : application réelle, en transaction. `mode` ∈
// create_and_update (défaut) | create_only | update_only.
// Sécurités appliquées (section 9) : aucune fiche désactivée automatiquement,
// aucun champ non mappé écrasé, type CLIENT et typologie AUTRE par défaut
// quand l'export ne les fournit pas (section 6).
// `defaultRepId` est désormais facultatif (fiche corrective V2 Administrateur
// section 3 : import possible sans représentant pré-sélectionné) — une ligne
// sans représentant reconnu dans le fichier ET sans repli par défaut est
// importée avec owner_rep_id = NULL, à affecter manuellement ensuite.
export async function applyImport({ classified, defaultRepId = null, mode, userId }) {
  const client = await pool.connect();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = classified.filter((r) => r.error).length;

  try {
    await client.query("BEGIN");

    const validRows = classified.filter((r) => !r.error);
    const ids = validRows.map((r) => r.dolibarrId);
    const { rows: existingRows } = ids.length
      ? await client.query(
          "SELECT id, dolibarr_code_client FROM accounts WHERE dolibarr_code_client = ANY($1::text[])",
          [ids]
        )
      : { rows: [] };
    const existingByDolibarrId = new Map(existingRows.map((r) => [r.dolibarr_code_client, r.id]));

    const validRepIds = await resolveValidUserIds(
      client,
      validRows.map((r) => r.fields.ownerRepIdRaw),
      ["REPRESENTANT", "MASTER_REP"]
    );
    const validMasterRepIds = await resolveValidUserIds(
      client,
      validRows.map((r) => r.fields.masterRepIdRaw),
      ["MASTER_REP"]
    );

    for (const row of validRows) {
      const existingAccountId = existingByDolibarrId.get(row.dolibarrId);
      const exists = existingAccountId !== undefined;

      if (exists && mode === "create_only") { skipped++; continue; }
      if (!exists && mode === "update_only") { skipped++; continue; }

      const ownerRepId =
        row.fields.ownerRepIdRaw && validRepIds.has(row.fields.ownerRepIdRaw)
          ? row.fields.ownerRepIdRaw
          : defaultRepId;
      const masterRepId =
        row.fields.masterRepIdRaw && validMasterRepIds.has(row.fields.masterRepIdRaw)
          ? row.fields.masterRepIdRaw
          : null;

      if (!exists) {
        const regimeFiscal = row.fields.regimeFiscal ?? defaultRegimeFiscalForCountry(row.countryCode);
        const type = row.fields.type ?? "CLIENT";
        const typology = row.fields.typology ?? "AUTRE";
        const sector = row.fields.sector ?? sectorForTypology(typology);
        await client.query(
          `INSERT INTO accounts (
            type, name, store_name, country_id, typology, sector,
            billing_street, billing_zip, billing_city,
            shipping_street, shipping_zip, shipping_city,
            contact_name, phone, phone_country_code, mobile, mobile_country_code, email,
            tax_id, vat_number, iban, bic, sepa_mandate_status, regime_fiscal,
            status, pipeline_stage, owner_rep_id, master_rep_id, dolibarr_code_client
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24,
            $25, 'Nouveau', $26, $27, $28
          )`,
          [
            type,
            row.name,
            row.fields.storeName ?? null,
            row.countryId,
            typology,
            sector,
            row.fields.billingStreet ?? null,
            row.fields.billingZip ?? null,
            row.fields.billingCity ?? null,
            row.fields.shippingStreet ?? null,
            row.fields.shippingZip ?? null,
            row.fields.shippingCity ?? null,
            row.fields.contactName ?? null,
            row.fields.phone ?? null,
            row.fields.phoneCountryCode ?? null,
            row.fields.mobile ?? null,
            row.fields.mobileCountryCode ?? null,
            row.fields.email ?? null,
            row.fields.taxId ?? null,
            row.fields.vatNumber ?? null,
            row.fields.iban ?? null,
            row.fields.bic ?? null,
            row.fields.sepaMandateStatus ?? "NON_RENSEIGNE",
            regimeFiscal,
            row.status,
            ownerRepId,
            masterRepId,
            row.dolibarrId,
          ]
        );
        created++;
      } else {
        // Ne touche qu'aux colonnes réellement mappées dans le fichier (section 9).
        const sets = ["updated_at = now()"];
        const params = [];
        let i = 1;
        const pushField = (column, value) => {
          sets.push(`${column} = $${i++}`);
          params.push(value);
        };
        for (const [field, column] of Object.entries(SIMPLE_FIELD_COLUMNS)) {
          if (field in row.fields) pushField(column, row.fields[field]);
        }
        if ("phone" in row.fields) pushField("phone_country_code", row.fields.phoneCountryCode);
        if ("mobile" in row.fields) pushField("mobile_country_code", row.fields.mobileCountryCode);
        if ("phone" in row.fields) pushField("phone", row.fields.phone);
        if ("mobile" in row.fields) pushField("mobile", row.fields.mobile);
        // Le nom et le pays sont toujours mappés (obligatoires) : mis à jour à chaque import.
        pushField("name", row.name);
        pushField("country_id", row.countryId);
        if ("ownerRepIdRaw" in row.fields) pushField("owner_rep_id", ownerRepId);
        if ("masterRepIdRaw" in row.fields) pushField("master_rep_id", masterRepId);

        params.push(existingAccountId);
        await client.query(`UPDATE accounts SET ${sets.join(", ")} WHERE id = $${i}`, params);
        updated++;
      }
    }

    await client.query(
      `INSERT INTO account_import_logs (created_count, updated_count, error_count, imported_by_id)
       VALUES ($1, $2, $3, $4)`,
      [created, updated, errors, userId]
    );

    await client.query("COMMIT");
    return { created, updated, skipped, errors, total: classified.length, ...extractErrorDetails(classified) };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
