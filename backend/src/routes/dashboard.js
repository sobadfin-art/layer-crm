import { Router } from "express";
import * as XLSX from "xlsx";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { repScopeForDashboard } from "../lib/dashboardScope.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { COUNTED_STATUSES, LINE_AMOUNT_SQL } from "../lib/objectiveProgress.js";
import { toCamelList } from "../lib/serialize.js";
import { fiscalYearBounds, currentFiscalYearStart } from "../lib/fiscalYear.js";

export const dashboardRouter = Router();

const DATA_ROLES = [ROLES.REPRESENTANT, ROLES.MASTER_REP, ROLES.DIRECTEUR];

// GET /api/dashboard/bestsellers — section 3 : "Data (Bestsellers...)".
//
// Filtres ajoutés (PDF Directeur commercial section 6.1 / Représentant
// section 9) : période (début/fin, sur orders.validated_at — même référence
// temporelle que computeObjectiveProgress, jamais created_at), représentant(s)
// (le Représentant reste de toute façon cantonné à lui-même par repScopeForDashboard
// ci-dessus — ce filtre ne peut donc que RESTREINDRE davantage son propre
// scope, jamais l'élargir), typologie(s) et catégorie(s) de produit. Le PDF
// demande une "liste exhaustive" : suppression du LIMIT 20 qui tronquait les
// résultats. Toujours comparé à la période N-1 équivalente (même durée,
// immédiatement avant periodStart) pour la colonne "évolution" attendue par
// la maquette (colonnes : produit, unités, CA période N, CA période N-1,
// évolution, représentant, typologie, catégorie).
// Construit clauses WHERE + params pour la requête Bestsellers (période
// principale OU période de comparaison N-1) — factorisé pour que les deux
// jeux de paramètres soient TOUJOURS renumérotés à partir de $1, plutôt que
// bricolés depuis les indices $n de l'autre période. Voir le commentaire
// détaillé juste avant l'appel "prevStart/prevEnd" ci-dessous pour le bug
// concret que cette factorisation corrige (BUG CORRIGÉ, section 2 : trou de
// numérotation de paramètres qui faisait planter la requête N-1 en HTTP 500
// dès que dateFrom+dateTo étaient fournis — donc à peu près à chaque clic
// "Générer" depuis l'UI).
function buildBestsellersFilters(req, effectiveRepIds, { validatedFrom, validatedFromOp = ">=", validatedTo, validatedToOp = "<=" } = {}) {
  const clauses = ["o.status::text = ANY($1::text[])", "ol.is_gift = FALSE"];
  const params = [COUNTED_STATUSES];

  if (effectiveRepIds !== null) {
    params.push(effectiveRepIds);
    clauses.push(`o.rep_id = ANY($${params.length}::uuid[])`);
  }
  if (validatedFrom) {
    params.push(validatedFrom);
    clauses.push(`o.validated_at ${validatedFromOp} $${params.length}`);
  }
  if (validatedTo) {
    params.push(validatedTo);
    clauses.push(`o.validated_at ${validatedToOp} $${params.length}`);
  }
  if (req.query.typologies) {
    params.push(String(req.query.typologies).split(",").filter(Boolean));
    clauses.push(`a.typology::text = ANY($${params.length}::text[])`);
  }
  if (req.query.categories) {
    params.push(String(req.query.categories).split(",").filter(Boolean));
    clauses.push(`p.category::text = ANY($${params.length}::text[])`);
  }
  if (req.query.accountId) {
    params.push(req.query.accountId);
    clauses.push(`o.account_id = $${params.length}`);
  }
  return { clauses, params };
}

dashboardRouter.get("/bestsellers", requireAuth, requireRole(...DATA_ROLES), async (req, res) => {
  const repScope = await repScopeForDashboard(req.user);

  // Le scope serveur (rep lui-même, ou équipe pour un Master Rep) prime
  // toujours : un filtre repIds explicite ne peut qu'intersecter ce scope,
  // jamais le contourner.
  let effectiveRepIds = repScope;
  if (req.query.repIds) {
    const requested = String(req.query.repIds).split(",").filter(Boolean);
    effectiveRepIds = repScope === null ? requested : repScope.filter((id) => requested.includes(id));
  }

  const periodStart = req.query.dateFrom || null;
  const periodEnd = req.query.dateTo || null;
  const { clauses, params } = buildBestsellersFilters(req, effectiveRepIds, {
    validatedFrom: periodStart,
    validatedTo: periodEnd,
  });

  // BUG CORRIGÉ (fiche corrective P0 — Profil Représentant, section 2 : "Bug
  // Data > Bestsellers", cause identifiée = "mauvais GROUP BY") : la requête
  // groupait par p.ref MAIS AUSSI par u.first_name/u.last_name (représentant)
  // et a.typology (typologie du compte). Un même produit vendu à des comptes
  // de typologies différentes (ex. OPTICIEN + SURF_SHOP), ou par des
  // représentants différents dans le scope d'un Master Rep, se retrouvait
  // fragmenté en PLUSIEURS lignes distinctes au lieu d'une seule ligne
  // consolidée — total_qty/total_amount ne reflétaient alors jamais le
  // vrai total produit, et le classement ORDER BY total_qty DESC devenait
  // trompeur (un produit réellement premier pouvait apparaître dilué en
  // plusieurs lignes plus bas). Vérifié en base : MKN-001 vendu à 3
  // typologies différentes remontait en 3 lignes (3 + 13 + 1) au lieu d'une
  // seule ligne à 17 — exactement le "GROUP BY qui casse l'agrégation"
  // pointé par la fiche corrective.
  //
  // Correctif : agrégation strictement par produit (p.ref/p.label/p.category)
  // pour que total_qty/total_amount soient les VRAIS totaux reconciliables
  // avec l'historique de commandes réel. Les dimensions typologie/représentant
  // (utilisées par la vue Data du Directeur pour un contexte informatif par
  // ligne) sont conservées mais en tant que LISTES agrégées (array_agg
  // DISTINCT) plutôt que des clés de regroupement.
  const { rows } = await query(
    `SELECT p.ref, p.label, p.category,
            array_agg(DISTINCT (u.first_name || ' ' || u.last_name)) AS rep_names,
            array_agg(DISTINCT a.typology::text) AS typologies,
            SUM(ol.qty)::int AS total_qty,
            SUM(${LINE_AMOUNT_SQL})::numeric(12,2) AS total_amount
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN products p ON p.id = ol.product_id
     JOIN accounts a ON a.id = o.account_id
     JOIN users u ON u.id = o.rep_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY p.ref, p.label, p.category
     ORDER BY total_qty DESC`,
    params
  );

  // Colonne "CA période N-1" : même durée que la période demandée,
  // immédiatement avant periodStart. Si aucune période n'est précisée
  // (comportement par défaut, toute l'historique), pas de comparatif N-1
  // pertinent — la colonne reste simplement absente (prevAmountByRef vide).
  //
  // BUG CORRIGÉ : l'ancienne implémentation reconstruisait prevClauses en
  // FILTRANT les clauses de date de la période principale (qui référençaient
  // par ex. $3/$4), tout en gardant prevParams = [...params] (donc les
  // valeurs $3/$4 d'origine restaient dans le tableau) puis ajoutait 2
  // NOUVELLES bornes de date à la fin du tableau ($5/$6, ou plus si
  // typologies/catégories/accountId étaient aussi présents). Résultat : la
  // requête ne référençait alors jamais littéralement "$3"/"$4" dans son
  // texte SQL alors que le tableau de paramètres en contenait toujours — dès
  // que dateFrom ET dateTo étaient fournis (donc quasi systématiquement
  // depuis l'écran Bestsellers, qui envoie toujours une période), PostgreSQL
  // renvoyait "could not determine data type of parameter $3" et l'endpoint
  // plantait en 500. Reproduit et confirmé en base avant correctif. Corrigé
  // en reconstruisant les paramètres de la période N-1 EN ENTIER via
  // buildBestsellersFilters (renumérotés proprement à partir de $1), au lieu
  // de bricoler les indices de la période principale.
  let prevByRef = new Map();
  if (periodStart && periodEnd) {
    const durationMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
    const prevStart = new Date(new Date(periodStart).getTime() - durationMs).toISOString();
    const { clauses: prevClauses, params: prevParams } = buildBestsellersFilters(req, effectiveRepIds, {
      validatedFrom: prevStart,
      validatedTo: periodStart,
      validatedToOp: "<",
    });
    const { rows: prevRows } = await query(
      `SELECT p.ref, SUM(${LINE_AMOUNT_SQL})::numeric(12,2) AS total_amount
       FROM order_lines ol
       JOIN orders o ON o.id = ol.order_id
       JOIN products p ON p.id = ol.product_id
       JOIN accounts a ON a.id = o.account_id
       JOIN users u ON u.id = o.rep_id
       WHERE ${prevClauses.join(" AND ")}
       GROUP BY p.ref`,
      prevParams
    );
    prevByRef = new Map(prevRows.map((r) => [r.ref, Number(r.total_amount)]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    prev_amount: prevByRef.has(r.ref) ? prevByRef.get(r.ref) : null,
  }));
  res.json(toCamelList(enriched));
});

// GET /api/dashboard/customer-performance — comparatif de portefeuille N vs N-1
// (section 4 : wonDate/lostDate "pour le comparatif de portefeuille N vs N-1").
//
// BUG CORRIGÉ (fiche corrective P0 — Profil Représentant, section 3 :
// "Customer Performance ... Période par défaut : année commerciale (1er
// novembre → 31 octobre), PAS l'année civile"). La version précédente
// utilisait ?year= comme une ANNÉE CIVILE (${year}-01-01 → ${year+1}-01-01),
// ce qui ne correspondait ni à la règle métier déjà en vigueur ailleurs dans
// l'app (cf. frontend/src/lib/fiscalYear.js, utilisée par
// Dashboard/MasterRepDashboard/DirecteurDashboard) ni à la demande explicite
// de cette fiche corrective. Corrigé : ?year= désigne maintenant l'ANNÉE DE
// DÉBUT de la période commerciale (ex. year=2025 → 01/11/2025-31/10/2026,
// cohérent avec fiscalYearLabel() = "2025–2026"), et l'absence du paramètre
// retombe sur l'année commerciale EN COURS (currentFiscalYearStart), pas
// l'année civile en cours.
//
// Le LEFT JOIN accounts -> orders -> order_lines (déjà en place avant ce
// correctif) reste inchangé : vérifié qu'il n'exclut aucun client sans
// commande (CA affiché à 0€ mais client toujours listé, jamais un
// INNER JOIN qui les aurait fait disparaître silencieusement) — voir
// vérification manuelle dans le changelog/README.
dashboardRouter.get(
  "/customer-performance",
  requireAuth,
  requireRole(...DATA_ROLES),
  async (req, res) => {
    const repIds = await repScopeForDashboard(req.user);
    const requestedYear = Number.parseInt(req.query.year, 10);
    const startYear = Number.isInteger(requestedYear) ? requestedYear : currentFiscalYearStart();
    const { start: periodStart, end: periodEnd } = fiscalYearBounds(startYear);
    const { start: prevStart, end: prevEnd } = fiscalYearBounds(startYear - 1);
    const params = [
      COUNTED_STATUSES,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      prevStart.toISOString(),
      prevEnd.toISOString(),
    ];
    let repClause = "TRUE";
    if (repIds !== null) {
      params.push(repIds);
      repClause = `o.rep_id = ANY($${params.length}::uuid[])`;
    }

    // Règle définitive (même logique que computeObjectiveProgress) : une
    // commande compte dans une période selon sa DATE DE VALIDATION
    // (validated_at), jamais created_at — pour ne pas produire une logique
    // temporelle contradictoire entre objectifs et ce comparatif N vs N-1.
    // order_count (commandes validées de l'année sélectionnée) ajouté pour le
    // critère "nombre de commandes" demandé par la fiche corrective V2.
    const { rows } = await query(
      `SELECT
         a.id AS account_id, a.name AS account_name, a.pipeline_stage,
         COALESCE(SUM(CASE WHEN o.validated_at >= $2 AND o.validated_at <= $3
                           THEN ${LINE_AMOUNT_SQL} ELSE 0 END), 0)::numeric(12,2) AS ca_annee_courante,
         COALESCE(SUM(CASE WHEN o.validated_at >= $4 AND o.validated_at <= $5
                           THEN ${LINE_AMOUNT_SQL} ELSE 0 END), 0)::numeric(12,2) AS ca_annee_precedente,
         COUNT(DISTINCT CASE WHEN o.validated_at >= $2 AND o.validated_at <= $3 THEN o.id END)::int AS order_count
       FROM accounts a
       LEFT JOIN orders o ON o.account_id = a.id AND o.status::text = ANY($1::text[])
       LEFT JOIN order_lines ol ON ol.order_id = o.id
       WHERE ${repClause.replace("o.rep_id", "a.owner_rep_id")}
       GROUP BY a.id, a.name, a.pipeline_stage
       ORDER BY ca_annee_courante DESC`,
      params
    );
    res.json(toCamelList(rows));
  }
);

// GET /api/dashboard/analytics — réservé directeur : "accès complet à Data
// (Bestsellers/Analytics/Extraction)". Distingue enfin CA ferme / précommande,
// par catégorie et par pays.
//
// "is_precommande effectif" : une commande de précommande dont la livraison a
// été confirmée (converted_to_firm = TRUE) est comptée comme CA ferme, pas
// comme précommande — cohérent avec computeObjectiveProgress (règle confirmée,
// bascule uniquement via confirmation humaine du front desk).
const EFFECTIVE_PRECOMMANDE = "(o.is_precommande AND NOT o.converted_to_firm)";

// Filtres communs aux deux périodes A/B (PDF Directeur commercial section 6.2 :
// "Comparatif Période A versus Période B ... Type de commande ... Filtres :
// représentants, Master Reps, pays, catégories produit, typologies client et
// clients précis"). Construit les clauses WHERE + params partagés par
// buildAnalyticsPeriod ci-dessous, hors bornes de date (propres à chaque
// période) — évite de dupliquer la résolution des filtres pour A et B.
async function analyticsBaseFilters(req) {
  const clauses = ["o.status::text = ANY($1::text[])"];
  const params = [COUNTED_STATUSES];

  // Représentants explicites + représentants gérés par les Master Reps
  // sélectionnés (union) — un Master Rep sélectionné sans rep explicite doit
  // ramener toute son équipe, pas rien.
  const repIds = req.query.repIds ? String(req.query.repIds).split(",").filter(Boolean) : [];
  const masterRepIds = req.query.masterRepIds ? String(req.query.masterRepIds).split(",").filter(Boolean) : [];
  if (masterRepIds.length) {
    const managedLists = await Promise.all(masterRepIds.map((id) => getManagedRepUserIds(id)));
    for (const list of managedLists) repIds.push(...list);
    repIds.push(...masterRepIds); // un Master Rep peut lui-même être rep_id d'une commande (cas historique)
  }
  if (repIds.length) {
    params.push([...new Set(repIds)]);
    clauses.push(`o.rep_id = ANY($${params.length}::uuid[])`);
  }

  if (req.query.countryCodes) {
    params.push(String(req.query.countryCodes).split(",").filter(Boolean));
    clauses.push(`c.code = ANY($${params.length}::text[])`);
  }
  if (req.query.categories) {
    params.push(String(req.query.categories).split(",").filter(Boolean));
    clauses.push(`p.category::text = ANY($${params.length}::text[])`);
  }
  if (req.query.typologies) {
    params.push(String(req.query.typologies).split(",").filter(Boolean));
    clauses.push(`a.typology::text = ANY($${params.length}::text[])`);
  }
  if (req.query.accountId) {
    params.push(req.query.accountId);
    clauses.push(`o.account_id = $${params.length}`);
  }
  // Type de commande : Fermes + Précommandes (défaut) / Fermes uniquement /
  // Précommandes uniquement — "ferme" au sens effectif (précommande déjà
  // livrée = comptée ferme, cf. EFFECTIVE_PRECOMMANDE).
  if (req.query.orderType === "FERME") {
    clauses.push(`NOT ${EFFECTIVE_PRECOMMANDE}`);
  } else if (req.query.orderType === "PRECOMMANDE") {
    clauses.push(`${EFFECTIVE_PRECOMMANDE}`);
  }

  return { clauses, params };
}

async function buildAnalyticsPeriod(req, start, end) {
  const { clauses, params } = await analyticsBaseFilters(req);
  if (start) {
    params.push(start);
    clauses.push(`o.validated_at >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    clauses.push(`o.validated_at <= $${params.length}`);
  }
  const where = clauses.join(" AND ");
  // Base commune : order_lines -> orders -> accounts -> countries -> products,
  // seules jointures nécessaires pour couvrir tous les filtres possibles
  // (pays, typologie, catégorie) en une fois.
  const fromJoins = `FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN accounts a ON a.id = o.account_id
     JOIN countries c ON c.id = a.country_id
     JOIN products p ON p.id = ol.product_id`;
  const amountExpr = `SUM(${LINE_AMOUNT_SQL})::numeric(12,2)`;

  const [{ rows: totals }, { rows: byCategory }, { rows: byCountry }, { rows: byRep }] = await Promise.all([
    query(
      `SELECT ${EFFECTIVE_PRECOMMANDE} AS is_precommande, ${amountExpr} AS amount, COUNT(DISTINCT o.id)::int AS orders_count
       ${fromJoins} WHERE ${where} GROUP BY ${EFFECTIVE_PRECOMMANDE}`,
      params
    ),
    query(
      `SELECT p.category, ${EFFECTIVE_PRECOMMANDE} AS is_precommande, ${amountExpr} AS amount
       ${fromJoins} WHERE ${where} GROUP BY p.category, ${EFFECTIVE_PRECOMMANDE} ORDER BY p.category`,
      params
    ),
    query(
      `SELECT c.code AS country_code, ${EFFECTIVE_PRECOMMANDE} AS is_precommande, ${amountExpr} AS amount
       ${fromJoins} WHERE ${where} GROUP BY c.code, ${EFFECTIVE_PRECOMMANDE} ORDER BY c.code`,
      params
    ),
    query(
      `SELECT o.rep_id, u.first_name AS rep_first_name, u.last_name AS rep_last_name,
              ${EFFECTIVE_PRECOMMANDE} AS is_precommande, ${amountExpr} AS amount
       ${fromJoins} JOIN users u ON u.id = o.rep_id
       WHERE ${where} GROUP BY o.rep_id, u.first_name, u.last_name, ${EFFECTIVE_PRECOMMANDE}
       ORDER BY u.last_name`,
      params
    ),
  ]);

  const ferme = totals.filter((t) => !t.is_precommande).reduce((s, t) => s + Number(t.amount), 0);
  const precommande = totals.filter((t) => t.is_precommande).reduce((s, t) => s + Number(t.amount), 0);
  const ordersCount = totals.reduce((s, t) => s + Number(t.orders_count), 0);

  return {
    totals: { ferme, precommande, total: ferme + precommande, ordersCount },
    byCategory: toCamelList(byCategory),
    byCountry: toCamelList(byCountry),
    byRep: toCamelList(byRep),
  };
}

// GET /api/dashboard/analytics — réservé directeur (PDF section 6.2 :
// "Analytics — Comparatif Période A versus Période B, chacune définie
// librement par date de début et de fin ... Filtres : représentants, Master
// Reps, pays, catégories produit, typologies client et clients précis").
// periodAStart/periodAEnd/periodBStart/periodBEnd optionnels : sans borne,
// une période reste "toute la période" (comportement historique conservé) ;
// periodB entier est optionnel — sans lui, la réponse ne contient que
// periodA (pas de comparatif), pour rester utilisable comme avant ce lot.
dashboardRouter.get("/analytics", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const periodA = await buildAnalyticsPeriod(req, req.query.periodAStart || null, req.query.periodAEnd || null);

  let periodB = null;
  let evolutionPct = null;
  if (req.query.periodBStart || req.query.periodBEnd) {
    periodB = await buildAnalyticsPeriod(req, req.query.periodBStart || null, req.query.periodBEnd || null);
    if (periodA.totals.total > 0) {
      evolutionPct = ((periodB.totals.total - periodA.totals.total) / periodA.totals.total) * 100;
    }
  }

  // Rétro-compatibilité : conserve totals/byCategory/byCountry à la racine
  // (ancienne forme, période A) en plus de periodA/periodB explicites — évite
  // de casser un éventuel autre consommateur de cet endpoint pendant la
  // transition frontend.
  res.json({
    totals: [
      { isPrecommande: false, amount: periodA.totals.ferme },
      { isPrecommande: true, amount: periodA.totals.precommande },
    ],
    byCategory: periodA.byCategory,
    byCountry: periodA.byCountry,
    periodA,
    periodB,
    evolutionPct,
  });
});

// GET /api/dashboard/rdv — widget "RDV" du tableau de bord.
//
// Règle définitive (périmètre d'ACCÈS du rôle — distinct du filtre d'affichage
// "aujourd'hui" du widget, voir plus bas) :
//  - REPRESENTANT : voit ses propres RDV.
//  - MASTER_REP : voit ses propres RDV + ceux des représentants rattachés à
//    son équipe.
//  - DIRECTEUR : vision globale — voit les RDV des REPRESENTANT ET des
//    MASTER_REP.
// Front desk / Administrateur : pas d'accès (hors périmètre documenté, comme
// le reste du module Data).
//
// Le filtre "aujourd'hui" (`?today=true`) est un filtre d'AFFICHAGE du widget,
// pas une restriction d'accès : sans ce paramètre, l'endpoint renvoie tous les
// RDV dans le périmètre d'accès du rôle (passés et futurs), pour permettre par
// exemple une vue "tout l'historique RDV de mon équipe" au Master Rep ou au
// Directeur. Avec `?today=true`, on filtre l'affichage sur la date du jour —
// exactement ce qu'un widget "RDV du jour" veut montrer, sans pour autant
// réduire le périmètre d'accès du rôle. Ne pas confondre les deux.
//
// Hypothèse sur "aujourd'hui" (uniquement pertinente avec `?today=true`) :
// `CURRENT_DATE` utilise le fuseau du serveur PostgreSQL (Etc/UTC dans cet
// environnement) — un RDV très tôt le matin ou très tard le soir heure locale
// pourrait tomber du mauvais côté de minuit UTC. À confirmer si ça doit être
// recalé sur le fuseau de l'équipe plutôt que celui du serveur.
dashboardRouter.get("/rdv", requireAuth, requireRole(...DATA_ROLES), async (req, res) => {
  const todayOnly = req.query.today === "true";
  const todayClause = todayOnly ? "AND t.due_date::date = CURRENT_DATE" : "";

  let sql;
  let params;

  if (req.user.role === ROLES.REPRESENTANT) {
    sql = `SELECT t.*, a.name AS account_name
           FROM tasks t
           LEFT JOIN accounts a ON a.id = t.account_id
           WHERE t.type = 'RDV' AND t.assignee_id = $1 ${todayClause}
           ORDER BY t.due_date ASC NULLS LAST`;
    params = [req.user.id];
  } else if (req.user.role === ROLES.MASTER_REP) {
    const managed = await getManagedRepUserIds(req.user.id);
    const ids = [req.user.id, ...managed]; // ses propres RDV + ceux de son équipe
    sql = `SELECT t.*, a.name AS account_name, u.first_name AS rep_first_name, u.last_name AS rep_last_name
           FROM tasks t
           LEFT JOIN accounts a ON a.id = t.account_id
           JOIN users u ON u.id = t.assignee_id
           WHERE t.type = 'RDV' AND t.assignee_id = ANY($1::uuid[]) ${todayClause}
           ORDER BY t.due_date ASC NULLS LAST`;
    params = [ids];
  } else {
    // DIRECTEUR : vision globale — REPRESENTANT ET MASTER_REP, pas seulement
    // les représentants.
    sql = `SELECT t.*, a.name AS account_name, u.first_name AS rep_first_name, u.last_name AS rep_last_name
           FROM tasks t
           LEFT JOIN accounts a ON a.id = t.account_id
           JOIN users u ON u.id = t.assignee_id
           WHERE t.type = 'RDV' AND u.role::text = ANY(ARRAY['REPRESENTANT','MASTER_REP']) ${todayClause}
           ORDER BY t.due_date ASC NULLS LAST`;
    params = [];
  }

  const { rows } = await query(sql, params);
  res.json(toCamelList(rows));
});

// GET /api/dashboard/extract.xlsx — "Extraction Excel" (section 3/6.3,
// directeur). PDF section 6.3 : "Choisir une période d'extraction avec date
// de début et date de fin ... la maquette prévoit un export Excel et indique
// au minimum trois feuilles : Commandes, Lignes, Clients." Période optionnelle
// (filtre sur orders.created_at — pas validated_at ici : une commande encore
// en brouillon ou envoyée mais pas validée doit rester extractible, l'export
// n'est pas limité aux commandes comptant pour un objectif) ; sans borne,
// l'extraction couvre tout l'historique comme avant ce lot.
dashboardRouter.get("/extract.xlsx", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const orderClauses = [];
  const orderParams = [];
  if (req.query.dateFrom) {
    orderParams.push(req.query.dateFrom);
    orderClauses.push(`o.created_at >= $${orderParams.length}`);
  }
  if (req.query.dateTo) {
    orderParams.push(req.query.dateTo);
    orderClauses.push(`o.created_at <= $${orderParams.length}`);
  }
  const orderWhere = orderClauses.length ? `WHERE ${orderClauses.join(" AND ")}` : "";

  const { rows: commandes } = await query(
    `SELECT o.id AS commande_id, o.status, o.is_precommande, o.converted_to_firm,
            o.created_at, o.validated_at, o.desired_delivery_date,
            a.name AS compte, a.typology, c.code AS pays,
            u.first_name AS rep_prenom, u.last_name AS rep_nom,
            o.shipping_fee_ht, o.shipping_offered, o.note
     FROM orders o
     JOIN accounts a ON a.id = o.account_id
     JOIN countries c ON c.id = a.country_id
     JOIN users u ON u.id = o.rep_id
     ${orderWhere}
     ORDER BY o.created_at DESC`,
    orderParams
  );

  const { rows: lignes } = await query(
    `SELECT o.id AS commande_id, a.name AS compte,
            p.ref AS produit_ref, p.category AS categorie,
            ol.qty AS quantite, ol.unit_price_ht AS prix_unitaire_ht,
            ol.discount_pct AS remise_pct, ol.is_gift AS offert, ol.is_reliquat AS reliquat,
            (ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS montant_ligne
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN accounts a ON a.id = o.account_id
     JOIN products p ON p.id = ol.product_id
     ${orderWhere}
     ORDER BY o.created_at DESC`,
    orderParams
  );

  // Feuille Clients : toujours la photo actuelle du portefeuille (pas filtrée
  // par la période commandes — un client sans commande sur la période reste
  // utile à voir dans l'extraction du référentiel client).
  const { rows: clients } = await query(
    `SELECT a.id AS compte_id, a.name AS compte, a.type, a.typology, a.pipeline_stage,
            c.code AS pays, owner_u.first_name AS rep_prenom, owner_u.last_name AS rep_nom,
            mr_u.first_name AS master_rep_prenom, mr_u.last_name AS master_rep_nom,
            a.status, a.created_at
     FROM accounts a
     JOIN countries c ON c.id = a.country_id
     LEFT JOIN users owner_u ON owner_u.id = a.owner_rep_id
     LEFT JOIN users mr_u ON mr_u.id = a.master_rep_id
     ORDER BY a.name`
  );

  // Feuilles ajoutées pour couvrir l'exhaustivité demandée (fiche corrective
  // V2 Direction commerciale, section 10 : "Périmètre à couvrir... données
  // représentants et rattachements Master Rep / représentants, territoires et
  // pays, interactions commerciales, historiques d'activité, SAV — plus
  // généralement l'intégralité des données accessibles à la Direction
  // commerciale et stockées dans la BKV"). Les 3 feuilles Commandes/Lignes/
  // Clients ci-dessus ne couvraient que les ventes et le référentiel client :
  // il manquait la hiérarchie commerciale, les territoires, les interactions
  // et le SAV — jamais filtrées par période (photo actuelle de la donnée,
  // comme la feuille Clients).

  // Représentants — hiérarchie Master Rep / représentant + territoires
  // (sales_reps.master_rep_id pointe vers master_reps.id, jamais vers un
  // users.id directement : cf. le bug corrigé dans routes/team.js, même
  // logique de jointure ici).
  const { rows: representants } = await query(
    `SELECT u.id AS utilisateur_id, u.first_name AS prenom, u.last_name AS nom, u.role AS role, u.active AS actif,
            mru.first_name AS master_rep_prenom, mru.last_name AS master_rep_nom,
            (SELECT string_agg(t.name, ', ' ORDER BY t.name)
               FROM territories t WHERE t.id = ANY(sr.territory_ids)) AS territoires
     FROM users u
     LEFT JOIN sales_reps sr ON sr.user_id = u.id
     LEFT JOIN master_reps mr ON mr.id = sr.master_rep_id
     LEFT JOIN users mru ON mru.id = mr.user_id
     WHERE u.role IN ('REPRESENTANT', 'MASTER_REP')
     ORDER BY u.role, u.last_name`
  );

  // Territoires — référentiel + pays rattachés.
  const { rows: territoires } = await query(
    `SELECT t.name AS territoire,
            (SELECT string_agg(c.code, ', ' ORDER BY c.code) FROM countries c WHERE c.territory_id = t.id) AS pays
     FROM territories t
     ORDER BY t.name`
  );

  // Interactions commerciales — toutes, tous comptes (photo actuelle, comme
  // la feuille Clients).
  const { rows: interactionsRows } = await query(
    `SELECT i.created_at, a.name AS compte, u.first_name AS auteur_prenom, u.last_name AS auteur_nom,
            i.type, i.note, i.via_voice AS via_vocal
     FROM interactions i
     JOIN accounts a ON a.id = i.account_id
     JOIN users u ON u.id = i.author_id
     ORDER BY i.created_at DESC`
  );

  // Historique d'activité (agenda) — RDV et tâches, avec compte-rendu pour
  // les RDV réalisés (cf. migration 012_rdv_compte_rendu).
  const { rows: agenda } = await query(
    `SELECT t.type, t.title AS titre, t.due_date, t.done, a.name AS compte,
            u.first_name AS titulaire_prenom, u.last_name AS titulaire_nom,
            t.compte_rendu, t.created_at
     FROM tasks t
     LEFT JOIN accounts a ON a.id = t.account_id
     JOIN users u ON u.id = t.assignee_id
     ORDER BY t.due_date DESC NULLS LAST, t.created_at DESC`
  );

  // SAV — tickets + notes de suivi, avec statut de traitement (cf. fiche
  // corrective V2 Front Desk/Direction commerciale, "SAV, interactions SAV et
  // historique des traitements").
  const { rows: sav } = await query(
    `SELECT tk.created_at, a.name AS compte, tk.subject AS sujet, tk.status AS statut,
            cu.first_name AS cree_par_prenom, cu.last_name AS cree_par_nom,
            au.first_name AS assigne_a_prenom, au.last_name AS assigne_a_nom,
            tk.resolved_at,
            (SELECT count(*)::int FROM sav_notes n WHERE n.ticket_id = tk.id) AS nb_notes
     FROM sav_tickets tk
     JOIN accounts a ON a.id = tk.account_id
     JOIN users cu ON cu.id = tk.created_by_id
     LEFT JOIN users au ON au.id = tk.assigned_to_id
     ORDER BY tk.created_at DESC`
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(commandes), "Commandes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lignes), "Lignes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(clients), "Clients");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(representants), "Représentants");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(territoires), "Territoires");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(interactionsRows), "Interactions");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(agenda), "Agenda");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sav), "SAV");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="extraction-moken-${Date.now()}.xlsx"`);
  res.send(buffer);
});
