import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime } from "../lib/format.js";

// File de traitement SAV — PDF Front Desk section 6 : "Création du ticket SAV
// depuis la fiche client -> notification Front Desk -> apparition dans
// l'onglet SAV -> ouverture et traitement -> une fois traité, archivage du
// ticket afin qu'il disparaisse de la file active sans perdre la
// traçabilité." Par défaut on n'affiche donc que OUVERT/EN_COURS (la file
// "active") ; RESOLU/FERME restent consultables via le filtre "Tout".
const ACTIVE_STATUSES = ["OUVERT", "EN_COURS"];

export default function SavQueue() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const canManage = user.role === "FRONT_DESK" || user.role === "DIRECTEUR";

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState({});
  const [noteDraft, setNoteDraft] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all" && statusFilter !== "active") params.set("status", statusFilter);
      const data = await api.get(`/sav?${params.toString()}`);
      setTickets(statusFilter === "active" ? data.filter((tk) => ACTIVE_STATUSES.includes(tk.status)) : data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, [statusFilter]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function toggleExpand(ticket) {
    if (expandedId === ticket.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(ticket.id);
    setNoteDraft("");
    if (!detail[ticket.id]) {
      try {
        const full = await api.get(`/sav/${ticket.id}`);
        setDetail((d) => ({ ...d, [ticket.id]: full }));
      } catch (err) {
        setToast(err.message);
      }
    }
  }

  async function handleStatusChange(ticket, status) {
    setBusyId(ticket.id);
    try {
      const updated = await api.patch(`/sav/${ticket.id}`, { status });
      setTickets((list) =>
        statusFilter === "active" && !ACTIVE_STATUSES.includes(status)
          ? list.filter((tk) => tk.id !== ticket.id)
          : list.map((tk) => (tk.id === ticket.id ? { ...tk, ...updated } : tk))
      );
      setDetail((d) => ({ ...d, [ticket.id]: { ...d[ticket.id], ...updated } }));
      setToast(t("sav.toastStatusUpdated"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddNote(ticket) {
    if (!noteDraft.trim()) return;
    setBusyId(ticket.id);
    try {
      const note = await api.post(`/sav/${ticket.id}/notes`, { note: noteDraft.trim() });
      setDetail((d) => ({ ...d, [ticket.id]: { ...d[ticket.id], notes: [...(d[ticket.id]?.notes || []), note] } }));
      setNoteDraft("");
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const STATUS_LABEL = {
    OUVERT: t("sav.status.OUVERT"),
    EN_COURS: t("sav.status.EN_COURS"),
    RESOLU: t("sav.status.RESOLU"),
    FERME: t("sav.status.FERME"),
  };

  return (
    <>
      <h1 className="page-title">{t("sav.title")}</h1>
      <p className="page-sub">{t("sav.subtitle")}</p>

      <div className="filter-row">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active">{t("sav.filterActive")}</option>
          <option value="OUVERT">{t("sav.status.OUVERT")}</option>
          <option value="EN_COURS">{t("sav.status.EN_COURS")}</option>
          <option value="RESOLU">{t("sav.status.RESOLU")}</option>
          <option value="FERME">{t("sav.status.FERME")}</option>
          <option value="all">{t("sav.filterAll")}</option>
        </select>
        <button className="btn outline" onClick={load}>
          {t("frontDesk.refresh")}
        </button>
      </div>

      {loading && <p className="empty-state">{t("sav.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && tickets.length === 0 && <p className="empty-state">{t("sav.empty")}</p>}

      {tickets.map((ticket) => (
        <div className="queue-card" key={ticket.id}>
          <div className="queue-card-top">
            <div style={{ cursor: "pointer" }} onClick={() => toggleExpand(ticket)}>
              <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline" }}>{ticket.subject}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>
                {ticket.accountName} · {dateTime(ticket.createdAt, locale)}
              </div>
            </div>
            <span className={`queue-status ${ticket.status}`}>{STATUS_LABEL[ticket.status]}</span>
          </div>

          <div className="order-actions">
            <button className="btn outline" onClick={() => toggleExpand(ticket)}>
              {expandedId === ticket.id ? t("frontDesk.hideDetail") : t("frontDesk.showDetail")}
            </button>
            <button className="btn outline" onClick={() => navigate(`/clients/${ticket.accountId}`)}>
              <ExternalLink size={13} /> {t("sav.openAccount")}
            </button>
            {canManage && ticket.status !== "EN_COURS" && ticket.status !== "RESOLU" && ticket.status !== "FERME" && (
              <button className="btn outline" disabled={busyId === ticket.id} onClick={() => handleStatusChange(ticket, "EN_COURS")}>
                {t("sav.actionStart")}
              </button>
            )}
            {canManage && ticket.status !== "RESOLU" && ticket.status !== "FERME" && (
              <button className="btn primary" disabled={busyId === ticket.id} onClick={() => handleStatusChange(ticket, "RESOLU")}>
                {t("sav.actionResolveArchive")}
              </button>
            )}
          </div>

          {expandedId === ticket.id && (
            <div style={{ marginTop: 10 }}>
              {!detail[ticket.id] ? (
                <p className="empty-state">{t("frontDesk.loadingDetail")}</p>
              ) : (
                <>
                  {detail[ticket.id].description && <p style={{ fontSize: 12.5, marginBottom: 10 }}>{detail[ticket.id].description}</p>}
                  {(detail[ticket.id].notes || []).map((n) => (
                    <div className="task-row" key={n.id} style={{ alignItems: "flex-start" }}>
                      <span>{n.note}</span>
                      <span style={{ whiteSpace: "nowrap", color: "var(--ink-soft)", fontSize: 11.5 }}>
                        {dateTime(n.createdAt, locale)} · {n.firstName} {n.lastName}
                      </span>
                    </div>
                  ))}
                  <div className="field" style={{ marginTop: 8 }}>
                    <textarea placeholder={t("sav.notePlaceholder")} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} />
                  </div>
                  <button className="btn outline" disabled={busyId === ticket.id} onClick={() => handleAddNote(ticket)}>
                    {t("sav.addNote")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
