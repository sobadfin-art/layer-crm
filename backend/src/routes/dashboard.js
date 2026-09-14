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
dashboardRouter.get("/bestsellers", requireAuth, requireRole(...DATA_ROLES), async (req, res) => {
  const repIds = await repScopeForDashboard(req.user);
  const params = [COUNTED_STATUSES];
  let repClause = "TRUE";
  if (repIds !== null) {
    params.push(repIds);
    repClause = `o.rep_id = ANY($${params.length}::uuid[])`;
  }

  const { rows } = await query(
    `SELECT p.ref, p.label, p.category,
            SUM(ol.qty)::int AS total_qty,
            SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS total_amount
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN products p ON p.id = ol.product_id
     WHERE o.status::text = ANY($1::text[]) AND ${repClause} AND ol.is_gift = FALSE
     GROUP BY p.ref, p.label, p.category
     ORDER BY total_qty DESC
     LIMIT 20`,
    params
  );
  res.json(toCamelList(rows));
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

dashboardRouter.get("/analytics", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const { rows: byCategory } = await query(
    `SELECT p.category,
            ${EFFECTIVE_PRECOMMANDE} AS is_precommande,
            SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS amount
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN products p ON p.id = ol.product_id
     WHERE o.status::text = ANY($1::text[])
     GROUP BY p.category, ${EFFECTIVE_PRECOMMANDE}
     ORDER BY p.category`,
    [COUNTED_STATUSES]
  );

  const { rows: byCountry } = await query(
    `SELECT c.code AS country_code, ${EFFECTIVE_PRECOMMANDE} AS is_precommande,
            SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS amount
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN accounts a ON a.id = o.account_id
     JOIN countries c ON c.id = a.country_id
     WHERE o.status::text = ANY($1::text[])
     GROUP BY c.code, ${EFFECTIVE_PRECOMMANDE}
     ORDER BY c.code`,
    [COUNTED_STATUSES]
  );

  const { rows: totals } = await query(
    `SELECT ${EFFECTIVE_PRECOMMANDE} AS is_precommande,
            SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS amount,
            COUNT(DISTINCT o.id)::int AS orders_count
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     WHERE o.status::text = ANY($1::text[])
     GROUP BY ${EFFECTIVE_PRECOMMANDE}`,
    [COUNTED_STATUSES]
  );

  res.json({
    totals: toCamelList(totals),
    byCategory: toCamelList(byCategory),
    byCountry: toCamelList(byCountry),
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

// GET /api/dashboard/extract.xlsx — "Extraction Excel" (section 3, directeur).
dashboardRouter.get("/extract.xlsx", requireAuth, requireRole(ROLES.DIRECTEUR), async (req, res) => {
  const { rows } = await query(
    `SELECT o.id AS commande_id, o.status, o.is_precommande, o.created_at, o.validated_at,
            a.name AS compte, u.first_name AS rep_prenom, u.last_name AS rep_nom,
            p.ref AS produit_ref, p.category AS categorie,
            ol.qty AS quantite, ol.unit_price_ht AS prix_unitaire_ht,
            ol.discount_pct AS remise_pct, ol.is_gift AS offert,
            (ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct,0)/100))::numeric(12,2) AS montant_ligne
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN accounts a ON a.id = o.account_id
     JOIN users u ON u.id = o.rep_id
     JOIN products p ON p.id = ol.product_id
     ORDER BY o.created_at DESC`
  );

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Commandes");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="extraction-moken-${Date.now()}.xlsx"`);
  res.send(buffer);
});
