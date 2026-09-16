import { useMemo } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, dateTime, shortDate } from "../lib/format.js";

// Composant PARTAGÉ de visualisation d'une commande enregistrée — fiche
// corrective "CORRECTIFS PRIORITAIRES — VISUALISATION DES COMMANDES + EXPORT
// DOLIBARR", sections 1 à 4 : "Il doit exister UNE SEULE représentation
// visuelle de référence d'une commande dans tout le CRM", calquée sur le
// récapitulatif panier de NewOrder.jsx (mêmes classes CSS : cat-block/panel,
// cat-head, line-item, cat-subtotal, task-row, offert-badge — même langage
// visuel, pour que le rendu soit reconnaissable comme "le même écran").
//
// Utilisé À L'IDENTIQUE par OrdersList.jsx (historique Représentant/Master
// Rep), FrontDesk.jsx (file Front Desk/Directeur) et AccountDetail.jsx (fiche
// client) — les trois points de consultation d'une commande déjà enregistrée.
// Le récapitulatif ÉDITABLE du panier (NewOrder.jsx, avant validation) reste
// un composant à part : lui seul a besoin d'état interactif (bascule remise/
// offert, saisie quantité, formulaire précommande/note) sur un panier encore
// en mémoire côté client, jamais encore persisté. Ce composant-ci, à
// l'inverse, est un pur composant d'AFFICHAGE d'une commande déjà enregistrée
// (`order` = exactement la réponse enrichie de GET /api/orders/:id, avec son
// bloc `totals` calculé côté serveur à partir des lignes historiques —
// jamais recalculé ici à partir d'un prix catalogue actuel, section 3
// "IMPORTANT"). C'est ce choix qui garantit l'exigence de la fiche : "Seuls
// les boutons d'action peuvent changer selon le rôle" — les boutons
// (Valider/Exporter/Retélécharger/Envoyer au front desk...) restent
// entièrement à la charge de l'écran appelant, passés ici via `actions`,
// jamais dupliqués ou réinterprétés par ce composant.
function groupLinesByCategory(order) {
  const groups = new Map();
  for (const line of order.lines || []) {
    const key = line.category || "NON_CLASSE";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  const totalsByCategory = new Map((order.totals?.byCategory || []).map((c) => [c.category, c]));
  return [...groups.entries()].map(([category, lines]) => ({
    category,
    lines,
    ...(totalsByCategory.get(category) || { qty: lines.reduce((s, l) => s + l.qty, 0), subtotal: 0, discountPct: 0 }),
  }));
}

export default function OrderSummary({ order, actions, emptyLabel }) {
  const { t, locale } = useI18n();
  const byCategory = useMemo(() => groupLinesByCategory(order || {}), [order]);

  if (!order) return null;

  const totals = order.totals || { totalQty: 0, merchandiseAmount: 0, shippingFeeHt: order.shippingFeeHt, shippingOffered: order.shippingOffered, orderTotal: 0 };

  return (
    <div className="order-summary">
      <div className="order-summary-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            {order.accountName}
            {order.isPrecommande && (
              <span className="badge" style={{ marginLeft: 6 }}>
                {t("orders.precommande")}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
            {t("orderSummary.orderRef", { ref: order.id.slice(0, 8) })} · {dateTime(order.createdAt, locale)}
            {order.repFirstName && (
              <>
                {" "}
                · {t("frontDesk.by")} {order.repFirstName} {order.repLastName}
              </>
            )}
          </div>
        </div>
        <span className={`queue-status ${order.status}`}>{t(`orders.status${order.status}`)}</span>
      </div>

      {actions && (
        <div className="order-actions" style={{ marginBottom: 10 }}>
          {actions}
        </div>
      )}

      {byCategory.length === 0 && <p className="empty-state">{emptyLabel || t("newOrder.cartEmpty")}</p>}

      {byCategory.map((cat) => (
        <div className="cat-block panel" key={cat.category}>
          <div className="cat-head">
            <h4>{t(`category.${cat.category}`)}</h4>
            {cat.discountPct > 0 && (
              <span className="typology-badge">{t("newOrder.discountLabel", { pct: cat.discountPct })}</span>
            )}
          </div>
          {cat.lines.map((line) => {
            const lineAmount = line.isGift ? 0 : Number(line.unitPriceHt) * line.qty * (1 - Number(line.discountPct || 0) / 100);
            return (
              <div className="line-item" key={line.id || line.productId}>
                <span>
                  {line.qty} × {line.label}{" "}
                  <span style={{ color: "var(--ink-soft)", fontSize: 11 }}>
                    ({line.ref}
                    {line.catalogNames?.length > 0 ? ` · ${line.catalogNames.join(", ")}` : ""} ·{" "}
                    {money(line.unitPriceHt, locale)} {t("orderSummary.perUnit")})
                  </span>
                  {line.isGift && <span className="offert-badge">{t("newOrder.giftLabel")}</span>}
                  {line.isReliquat && (
                    <span className="offert-badge" style={{ marginLeft: 4 }}>
                      {t("newOrder.reliquatBadge")}
                      {line.reliquatShipDate ? ` (${shortDate(line.reliquatShipDate, locale)})` : ""}
                    </span>
                  )}
                </span>
                <span>{money(lineAmount, locale)}</span>
              </div>
            );
          })}
          <div className="cat-subtotal">
            <span>{t("newOrder.totalQtyValue", { qty: cat.qty })}</span>
            <span>{money(cat.subtotal, locale)}</span>
          </div>
        </div>
      ))}

      {byCategory.length > 0 && (
        <div className="cat-block panel">
          <div className="cat-head">
            <h4>{t("newOrder.shippingSection")}</h4>
          </div>
          <div className="line-item">
            <span>
              {t("newOrder.shippingSection")}{" "}
              {order.shippingOffered && <span className="offert-badge">{t("newOrder.shippingOffered")}</span>}
            </span>
            <span>{order.shippingOffered ? t("newOrder.shippingOffered") : money(order.shippingFeeHt, locale)}</span>
          </div>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="panel">
          <h3>{t("newOrder.totalsTitle")}</h3>
          <div className="task-row">
            <span>{t("newOrder.totalQty")}</span>
            <span>{t("newOrder.totalQtyValue", { qty: totals.totalQty })}</span>
          </div>
          <div className="task-row">
            <span>{t("newOrder.totalAmount")}</span>
            <span>{money(totals.merchandiseAmount, locale)}</span>
          </div>
          <div className="task-row">
            <span>{t("newOrder.totalShipping")}</span>
            <span>{order.shippingOffered ? t("newOrder.shippingOffered") : money(order.shippingFeeHt, locale)}</span>
          </div>
          <div className="task-row" style={{ fontWeight: 800, borderTop: "1px dashed var(--line)", paddingTop: 8, marginTop: 4 }}>
            <span>{t("newOrder.totalOrder")}</span>
            <span>{money(totals.orderTotal, locale)}</span>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>{t("newOrder.extraInfoTitle")}</h3>
        <div className="task-row">
          <span>{t("orderSummary.precommandeQuestion")}</span>
          <span>{order.isPrecommande ? t("orderSummary.yes") : t("orderSummary.no")}</span>
        </div>
        {order.desiredDeliveryDate && (
          <div className="task-row">
            <span>{t("newOrder.desiredDeliveryLabel")}</span>
            <span>{shortDate(order.desiredDeliveryDate, locale)}</span>
          </div>
        )}
        {order.note && (
          <div className="task-row" style={{ alignItems: "flex-start" }}>
            <span>{t("newOrder.noteLabel")}</span>
            <span style={{ textAlign: "right", maxWidth: "60%" }}>{order.note}</span>
          </div>
        )}
        {order.exportedAt && (
          <div className="task-row">
            <span>{t("orderSummary.exportedAt")}</span>
            <span>{dateTime(order.exportedAt, locale)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
