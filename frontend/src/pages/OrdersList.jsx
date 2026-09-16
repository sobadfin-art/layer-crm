import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, dateTime } from "../lib/format.js";
import OrderSummary from "../components/OrderSummary.jsx";
import NewOrderQuickAccess from "../components/NewOrderQuickAccess.jsx";

// CORRECTIF (fiche corrective "VISUALISATION DES COMMANDES + EXPORT
// DOLIBARR", sections 1/2/4) : le détail affiché ici au dépli d'une commande
// (jusqu'ici un simple tableau de lignes, en écart avec le récapitulatif
// panier) réutilise désormais EXACTEMENT le composant partagé
// <OrderSummary /> — le même que FrontDesk.jsx et AccountDetail.jsx.
const STATUS_KEY = {
  BROUILLON: "statusBROUILLON",
  ENVOYEE_FRONT_DESK: "statusENVOYEE_FRONT_DESK",
  VALIDEE: "statusVALIDEE",
  EXPORTEE_DOLIBARR: "statusEXPORTEE_DOLIBARR",
  ANNULEE: "statusANNULEE",
};

// Suivi du statut des commandes du représentant — GET /api/orders est déjà
// filtré côté serveur sur ses propres commandes (cf. routes/orders.js). Les
// commandes BROUILLON (création réussie mais envoi au front desk échoué
// depuis NewOrder.jsx) peuvent être renvoyées ici plutôt que perdues.
export default function OrdersList() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Correctif urgent 2026-09-16 (fiche "CORRECTIF URGENT — PROFIL
  // REPRÉSENTANT", section 3) : bouton "Nouvelle commande" manquant sur cet
  // écran — réutilise le même composant/parcours que le Dashboard (parcours
  // C), pas un second moteur de commande. Réservé au Représentant : cet écran
  // est aussi utilisé par le Master Rep (cf. App.jsx), qui reste strictement
  // en lecture seule sur les commandes (décision produit distincte, non
  // concernée par ce correctif) — jamais changé ici.
  const canCreateOrder = user.role === "REPRESENTANT";
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  // Ouverture directe depuis une notification (?orderId=...) — PDF
  // Représentant/Master Rep : même exigence "ouvrir directement l'élément
  // correspondant" que côté Front Desk (SavQueue.jsx/FrontDesk.jsx).
  const targetOrderId = searchParams.get("orderId");

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(location.state?.toast || null);

  // Filtres demandés par la fiche corrective V2 (section 5, Historique des
  // commandes) : date de début, date de fin et recherche/filtre par client.
  // Le backend (GET /api/orders) supporte déjà search/dateFrom/dateTo — cf.
  // routes/orders.js — cet écran ne faisait qu'un chargement non filtré.
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) params.set("dateTo", new Date(`${dateTo}T23:59:59`).toISOString());
      const qs = params.toString();
      const data = await api.get(`/orders${qs ? `?${qs}` : ""}`);
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
    // Nettoie le state de navigation pour que le toast ne réapparaisse pas au
    // rechargement/retour arrière.
    if (location.state?.toast) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!targetOrderId || loading) return;
    if (orders.some((o) => o.id === targetOrderId)) {
      toggleDetail({ id: targetOrderId });
    }
    setSearchParams(
      (params) => {
        params.delete("orderId");
        return params;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrderId, loading, orders]);

  async function toggleDetail(order) {
    if (expandedId === order.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(order.id);
    if (!details[order.id]) {
      try {
        const full = await api.get(`/orders/${order.id}`);
        setDetails((d) => ({ ...d, [order.id]: full }));
      } catch (err) {
        setToast(err.message);
      }
    }
  }

  async function handleSend(order) {
    setBusyId(order.id);
    try {
      await api.post(`/orders/${order.id}/send-to-front-desk`);
      setToast(t("orders.sendSuccess"));
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{t("orders.title")}</h1>
          <p className="page-sub">{t("orders.subtitle")}</p>
        </div>
        {/* Parcours C bis — même composant/parcours que le Dashboard, cf.
            commentaire sur canCreateOrder plus haut. */}
        {canCreateOrder && <NewOrderQuickAccess />}
      </div>

      <div className="search-bar">
        <input
          placeholder={t("orders.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
        />
      </div>
      <div className="filter-row">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title={t("orders.dateFrom")} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title={t("orders.dateTo")} />
        <button className="btn outline" onClick={load}>
          {t("orders.refresh")}
        </button>
      </div>

      {loading && <p className="empty-state">{t("orders.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && orders.length === 0 && <p className="empty-state">{t("orders.empty")}</p>}

      {orders.map((order) => (
        <div className="queue-card" key={order.id}>
          <div className="queue-card-top">
            <div style={{ cursor: "pointer" }} onClick={() => toggleDetail(order)}>
              <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline" }}>
                {order.accountName}
                {order.isPrecommande && (
                  <span className="badge" style={{ marginLeft: 6 }}>
                    {t("orders.precommande")}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                {money(order.merchandiseTotal, locale)} · {dateTime(order.createdAt, locale)}
              </div>
            </div>
            <span className={`queue-status ${order.status}`}>{t(`orders.${STATUS_KEY[order.status]}`)}</span>
          </div>

          <div className="order-actions">
            <button className="btn outline" onClick={() => toggleDetail(order)}>
              {expandedId === order.id ? t("frontDesk.hideDetail") : t("frontDesk.showDetail")}
            </button>
            {order.status === "BROUILLON" && (
              <button className="btn primary" disabled={busyId === order.id} onClick={() => handleSend(order)}>
                {busyId === order.id ? t("orders.sending") : t("orders.sendToFrontDesk")}
              </button>
            )}
          </div>

          {expandedId === order.id && (
            <div>
              {!details[order.id] ? (
                <p className="empty-state">{t("frontDesk.loadingDetail")}</p>
              ) : (
                <OrderSummary order={details[order.id]} />
              )}
            </div>
          )}
        </div>
      ))}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
