import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

function isDeliveryOverdue(order) {
  return (
    order.isPrecommande &&
    !order.convertedToFirm &&
    order.desiredDeliveryDate &&
    new Date(order.desiredDeliveryDate).getTime() < Date.now()
  );
}

// Mode hors-ligne partiel (Lot 6) : on garde une copie de la dernière liste
// chargée avec succès dans localStorage, pour pouvoir au moins l'afficher en
// lecture seule si le prochain chargement échoue (réseau coupé). Ce n'est
// volontairement PAS un cache général de l'API — seulement la vue la plus
// consultée (la file du front desk) — cf. README pour le détail du périmètre
// "hors-ligne partiel" retenu ici.
const OFFLINE_CACHE_KEY = "moken_frontdesk_cache";

export default function FrontDesk() {
  const { t, locale } = useI18n();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ENVOYEE_FRONT_DESK");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const STATUS_LABEL = {
    ENVOYEE_FRONT_DESK: t("frontDesk.status.ENVOYEE_FRONT_DESK"),
    VALIDEE: t("frontDesk.status.VALIDEE"),
    EXPORTEE_DOLIBARR: t("frontDesk.status.EXPORTEE_DOLIBARR"),
    ANNULEE: t("frontDesk.status.ANNULEE"),
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) params.set("dateTo", new Date(`${dateTo}T23:59:59`).toISOString());
      const data = await api.get(`/orders?${params.toString()}`);
      setOrders(data);
      setIsOfflineData(false);
      try {
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({ statusFilter, data, cachedAt: Date.now() }));
      } catch {
        // Stockage plein/indisponible — le cache hors-ligne est un bonus, pas
        // une fonctionnalité critique : on continue sans bloquer l'affichage.
      }
    } catch (err) {
      // Repli hors-ligne : si on a une copie en cache pour ce même filtre, on
      // l'affiche en lecture seule plutôt qu'un écran d'erreur vide.
      try {
        const cached = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || "null");
        if (cached && cached.statusFilter === statusFilter) {
          setOrders(cached.data);
          setIsOfflineData(true);
          setError(null);
        } else {
          setError(err.message);
        }
      } catch {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => orders, [orders]);

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

  function patchOrderLocally(id, patch) {
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  async function handleValidate(order) {
    setBusyId(order.id);
    try {
      const updated = await api.patch(`/orders/${order.id}/status`, { status: "VALIDEE" });
      patchOrderLocally(order.id, updated);
      setToast(t("frontDesk.toastValidated", { name: order.accountName }));
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(order) {
    setBusyId(order.id);
    try {
      const updated = await api.patch(`/orders/${order.id}/status`, { status: "ANNULEE" });
      patchOrderLocally(order.id, updated);
      setToast(t("frontDesk.toastCancelled", { name: order.accountName }));
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelivery(order) {
    setBusyId(order.id);
    try {
      const updated = await api.patch(`/orders/${order.id}/confirm-delivery`);
      patchOrderLocally(order.id, updated);
      setToast(t("frontDesk.toastDeliveryConfirmed", { name: order.accountName }));
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(order) {
    setBusyId(order.id);
    try {
      const blob = await api.post("/dolibarr/orders/export", { orderIds: [order.id] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export-dolibarr-${order.id.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      patchOrderLocally(order.id, { status: "EXPORTEE_DOLIBARR" });
      setToast(t("frontDesk.toastExported", { name: order.accountName }));
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h1 className="page-title">{t("frontDesk.title")}</h1>
      <p className="page-sub">{t("frontDesk.subtitle")}</p>

      {isOfflineData && <div className="offline-banner">{t("offline.banner")}</div>}

      <div className="search-bar">
        <input
          placeholder={t("frontDesk.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          disabled={isOfflineData}
        />
      </div>
      <div className="filter-row">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t("frontDesk.statusAll")}</option>
          <option value="ENVOYEE_FRONT_DESK">{t("frontDesk.statusToControl")}</option>
          <option value="VALIDEE">{t("frontDesk.statusValidated")}</option>
          <option value="EXPORTEE_DOLIBARR">{t("frontDesk.statusExported")}</option>
          <option value="ANNULEE">{t("frontDesk.statusCancelled")}</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title={t("frontDesk.dateFrom")} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title={t("frontDesk.dateTo")} />
        <button className="btn outline" onClick={load}>
          {t("frontDesk.refresh")}
        </button>
      </div>

      {loading && <p className="empty-state">{t("frontDesk.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && filtered.length === 0 && <p className="empty-state">{t("frontDesk.empty")}</p>}

      {filtered.map((order) => {
        const overdue = isDeliveryOverdue(order);
        const canValidate = order.status === "ENVOYEE_FRONT_DESK";
        const canCancel = order.status === "ENVOYEE_FRONT_DESK" || order.status === "VALIDEE";
        const canExport = order.status === "VALIDEE";
        const alreadyExported = order.status === "EXPORTEE_DOLIBARR";
        const canConfirmDelivery = overdue && (order.status === "VALIDEE" || order.status === "EXPORTEE_DOLIBARR");
        const busy = busyId === order.id || isOfflineData;

        return (
          <div className="queue-card" key={order.id}>
            <div className="queue-card-top">
              <div style={{ cursor: "pointer" }} onClick={() => toggleDetail(order)}>
                <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline" }}>
                  {order.accountName}
                  {order.isPrecommande && (
                    <span className="badge" style={{ marginLeft: 6 }}>
                      {t("frontDesk.precommande")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                  {t("frontDesk.by")} {order.repFirstName} {order.repLastName} · {money(order.merchandiseTotal, locale)} ·{" "}
                  {new Date(order.createdAt).toLocaleDateString(locale)}
                </div>
              </div>
              <span className={`queue-status ${order.status}`}>{STATUS_LABEL[order.status] || order.status}</span>
            </div>

            {overdue && (
              <div className="warning-banner">
                {t("frontDesk.overdueWarning")}
                {!canConfirmDelivery && ` ${t("frontDesk.overdueValidateFirst")}`}
              </div>
            )}

            <div className="order-actions">
              <button className="btn outline" onClick={() => toggleDetail(order)}>
                {expandedId === order.id ? t("frontDesk.hideDetail") : t("frontDesk.showDetail")}
              </button>
              {canValidate && (
                <button className="btn primary" disabled={busy} onClick={() => handleValidate(order)}>
                  {t("frontDesk.validate")}
                </button>
              )}
              {canCancel && (
                <button className="btn danger-outline" disabled={busy} onClick={() => handleCancel(order)}>
                  {t("frontDesk.cancel")}
                </button>
              )}
              {canConfirmDelivery && (
                <button className="btn primary" disabled={busy} onClick={() => handleConfirmDelivery(order)}>
                  {t("frontDesk.confirmDelivery")}
                </button>
              )}
              <button
                className="btn outline"
                disabled={!canExport || busy}
                title={
                  alreadyExported
                    ? t("frontDesk.exportTitleAlready")
                    : !canExport
                    ? t("frontDesk.exportTitleNeedsValidation")
                    : t("frontDesk.exportTitleReady")
                }
                onClick={() => handleExport(order)}
              >
                {alreadyExported ? t("frontDesk.exportAlready") : t("frontDesk.exportAction")}
              </button>
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
        );
      })}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
