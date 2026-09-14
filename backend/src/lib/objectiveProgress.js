// Calcul de la réalisation d'un objectif — cf. etat-final-prototype-handoff.md
// section 7. C'est ici, enfin, que le CA ferme et le CA précommande sont
// distingués (annoncé dès le Lot 3 comme relevant du Lot 5).
import { query } from "./db.js";

// Statuts comptés pour le calcul d'objectif — règle confirmée : une commande ne
// compte qu'une fois contrôlée par le front desk (VALIDEE ou EXPORTEE_DOLIBARR).
// ENVOYEE_FRONT_DESK ne compte PAS : l'objectif doit rester "certifié", jamais
// "optimiste" sur une commande que le front desk n'a pas encore vérifiée.
export const COUNTED_STATUSES = ["VALIDEE", "EXPORTEE_DOLIBARR"];

// Bascule précommande -> CA ferme : logique hybride, jamais automatique (règle
// confirmée). Une commande de précommande ne compte comme CA ferme qu'après
// confirmation explicite de livraison par le front desk (converted_to_firm =
// TRUE, via PATCH /api/orders/:id/confirm-delivery) — jamais par la seule
// échéance de desired_delivery_date dépassée. Tant qu'elle n'est pas confirmée,
// elle continue de compter dans les objectifs de type PRECOMMANDE.
//
// Règle définitive sur la période : c'est la DATE DE VALIDATION de la commande
// (orders.validated_at, écrite une seule fois au moment ENVOYEE_FRONT_DESK ->
// VALIDEE) qui détermine dans quelle période elle compte — jamais created_at.
// Une commande créée pendant une période mais validée pendant la suivante
// compte donc entièrement dans la période de validation, pas celle de création.
// La bascule ultérieure précommande -> CA ferme ne change ni ne réécrit
// validated_at : seul le filtre converted_to_firm ci-dessus fait basculer la
// commande d'un type d'objectif à l'autre, sa période reste celle de sa
// validation d'origine.
export async function computeObjectiveProgress(objective) {
  const isPrecommandeObjective = objective.type === "PRECOMMANDE";
  const categories = objective.categories || [];
  const sectors = objective.sectors || [];

  // Une commande "compte comme précommande" seulement si elle est marquée
  // précommande ET pas encore confirmée livrée ; sinon (vente ferme dès le
  // départ, ou précommande confirmée livrée) elle compte comme CA ferme.
  const precommandeFilter = isPrecommandeObjective
    ? "o.is_precommande = TRUE AND o.converted_to_firm = FALSE"
    : "(o.is_precommande = FALSE OR o.converted_to_firm = TRUE)";

  const { rows } = await query(
    `SELECT
       COALESCE(SUM(ol.qty * ol.unit_price_ht * (1 - COALESCE(ol.discount_pct, 0) / 100)), 0) AS achieved,
       COUNT(DISTINCT o.id)::int AS orders_count
     FROM order_lines ol
     JOIN orders o ON o.id = ol.order_id
     JOIN products p ON p.id = ol.product_id
     JOIN accounts a ON a.id = o.account_id
     WHERE o.rep_id = $1
       AND o.status::text = ANY($2::text[])
       AND ${precommandeFilter}
       AND o.validated_at BETWEEN $3 AND $4
       AND ($5::text[] = '{}' OR p.category::text = ANY($5::text[]))
       AND ($6::text[] = '{}' OR a.sector::text = ANY($6::text[]))`,
    [
      objective.rep_id,
      COUNTED_STATUSES,
      objective.period_start,
      objective.period_end,
      categories,
      sectors,
    ]
  );

  const achieved = Number(rows[0].achieved);
  const target = Number(objective.target_amount);

  return {
    targetAmount: target,
    achievedAmount: achieved,
    achievedPct: target > 0 ? Math.round((achieved / target) * 1000) / 10 : null,
    ordersCount: rows[0].orders_count,
  };
}
