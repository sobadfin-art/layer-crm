import { Router } from "express";
import * as XLSX from "xlsx";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ROLES } from "../lib/roles.js";
import { repScopeForDashboard } from "../lib/dashboardScope.js";
import { getManagedRepUserIds } from "../lib/managedReps.js";
import { COUNTED_STATUSES } from "../lib/objectiveProgress.js";
import { toCamelList } from "../lib/serialize.js";

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
dashboardRouter.get("/bestsellers", requireAuth, requireRole(...DATA_ROLES), async (req, res) => {
  const repScope = await repScopeForDashboard(req.user);
  const clauses = ["o.status::text = ANY($1::text[])", "ol.is_gift = FALSE"];
  const params = [COUNTED_STATUSES];

  // Le scope serveur (rep lui-même, ou équipe pour un Master Rep) prime
  // toujours : un filtre repIds explicite ne peut qu'intersecter ce scope,
  // jamais le contourner.
  let effectiveRepIds = repScope;
  if (req.query.repIds) {
    const requested = String(req.query.repIds).split(",").filter(Boolean);
    effectiveRepIds = repScope === null ? requested : repScope.filter((id) => requested.includes(id));
  }
  if (effectiveRepIds !== null) {
    params.push(effectiveRepIds);
    clauses.push(`o.rep_id = ANY($${params.length}::uuid[])`);
  }

  let periodStart = null;
  let periodEnd = null;
  if (req.query.dateFrom) {
    periodStart = req.query.dateFrom;
    params.push(periodStart);
    clauses.push(`o.validated_at >= $${params.length}`);
  }
  if (req.query.dateTo) {
    periodEnd = req.query.dateTo;
    params.push(periodEnd);
    clauses.push(`o.validated_at <= $${params.length}`);
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

  const { rows } = await query(
    `SELECT p.ref, p.label, p.category,
            u.first_name AS rep_first_name, u.last_name AS rep_last_name, a.typology,
            SUM(ol.qty)::int AS total_qty,
            SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS total_amount
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN products p ON p.id = ol.product_id
     JOIN accounts a ON a.id = o.account_id
     JOIN users u ON u.id = o.rep_id
     WHERE ${clauses.join(" AND ")}
     GROUP BY p.ref, p.label, p.category, u.first_name, u.last_name, a.typology
     ORDER BY total_qty DESC`,
    params
  );

  // Colonne "CA période N-1" : même durée que la période demandée,
  // immédiatement avant periodStart. Si aucune période n'est précisée
  // (comportement par défaut, toute l'historique), pas de comparatif N-1
  // pertinent — la colonne reste simplement absente (prevAmountByRef vide).
  let prevByRef = new Map();
  if (periodStart && periodEnd) {
    const durationMs = new Date(periodEnd).getTime() - new Date(periodStart).getTime();
    const prevStart = new Date(new Date(periodStart).getTime() - durationMs).toISOString();
    const prevClauses = clauses.map((c) =>
      c.includes("o.validated_at >=") || c.includes("o.validated_at <=") ? null : c
    ).filter(Boolean);
    const prevParams = [...params];
    prevClauses.push(`o.validated_at >= $${prevParams.push(prevStart)}`);
    prevClauses.push(`o.validated_at < $${prevParams.push(periodStart)}`);
    const { rows: prevRows } = await query(
      `SELECT p.ref, SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS total_amount
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
dashboardRouter.get(
  "/customer-performance",
  requireAuth,
  requireRole(...DATA_ROLES),
  async (req, res) => {
    const repIds = await repScopeForDashboard(req.user);
    const currentYear = new Date().getFullYear();
    const params = [COUNTED_STATUSES, `${currentYear}-01-01`, `${currentYear + 1}-01-01`, `${currentYear - 1}-01-01`];
    let repClause = "TRUE";
    if (repIds !== null) {
      params.push(repIds);
      repClause = `o.rep_id = ANY($${params.length}::uuid[])`;
    }

    // Règle définitive (même logique que computeObjectiveProgress) : une
    // commande compte dans une période selon sa DATE DE VALIDATION
    // (validated_at), jamais created_at — pour ne pas produire une logique
    // temporelle contradictoire entre objectifs et ce comparatif N vs N-1.
    const { rows } = await query(
      `SELECT
         a.id AS account_id, a.name AS account_name, a.pipeline_stage,
         COALESCE(SUM(CASE WHEN o.validated_at >= $2 AND o.validated_at < $3
                           THEN ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100) ELSE 0 END), 0)::numeric(12,2) AS ca_annee_courante,
         COALESCE(SUM(CASE WHEN o.validated_at >= $4 AND o.validated_at < $2
                           THEN ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100) ELSE 0 END), 0)::numeric(12,2) AS ca_annee_precedente
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
  const amountExpr = `SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2)`;

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

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(commandes), "Commandes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lignes), "Lignes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(clients), "Clients");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="extraction-moken-${Date.now()}.xlsx"`);
  res.send(buffer);
});
