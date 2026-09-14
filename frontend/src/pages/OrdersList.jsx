import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, dateTime } from "../lib/format.js";

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
  const navigate = useNavigate();
  const location = useLocation();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(location.state?.toast || null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get("/orders");
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <h1 className="page-title">{t("orders.title")}</h1>
      <p className="page-sub">{t("orders.subtitle")}</p>

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
                <div className="table-scroll">
                  <table className="lines-table">
                    <thead>
                      <tr>
                        <th>{t("frontDesk.colRef")}</th>
                        <th>{t("frontDesk.colCategory")}</th>
                        <th>{t("frontDesk.colQty")}</th>
                        <th>{t("frontDesk.colUnitPrice")}</th>
                        <th>{t("frontDesk.colDiscount")}</th>
                        <th>{t("frontDesk.colGift")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details[order.id].lines.map((line) => (
                        <tr key={line.id || line.productId}>
                          <td>{line.ref}</td>
                          <td>{line.category}</td>
                          <td>{line.qty}</td>
                          <td>{money(line.unitPriceHt, locale)}</td>
                          <td>{line.discountPct ? `${line.discountPct}%` : "—"}</td>
                          <td>{line.isGift ? t("frontDesk.yes") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
