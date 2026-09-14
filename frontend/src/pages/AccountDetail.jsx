import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Phone, Mail, Plus, CalendarDays, History, ShoppingCart, Repeat } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime } from "../lib/format.js";

const PIPELINE_STAGES = ["Nouveau", "Contacté", "RDV prévu", "Devis en cours", "Négociation", "Gagné", "Perdu"];

function fullAddress(street, zip, city, country) {
  const parts = [street, [zip, city].filter(Boolean).join(" "), country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Fiche compte — reprend la structure de la maquette
// (docs/prototype-crm-commercial.jsx, view === "fiche", role === "rep") :
// fiche société + pipeline, ajout d'interaction, planification RDV,
// historique. Une section supplémentaire (réaffectation représentant/Master
// Rep) s'affiche uniquement pour le directeur (docs/prototype-crm-commercial.jsx,
// ~lignes 1855-1874 : selects qui déclenchent un PATCH immédiat au
// changement, pas de bouton "enregistrer" séparé — repris tel quel ici) ; les
// autres rôles ne voient jamais cette section (hors périmètre de leur
// portail). "Nouvelle commande" n'est proposé qu'aux rôles qui prennent
// effectivement commande (représentant/Master Rep) — pas dans le périmètre
// directeur tel qu'énuméré (pipeline élargi + réaffectation, jamais prise de
// commande).
export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const isDirecteur = user.role === "DIRECTEUR";
  // Administrateur : lecture/écriture complète sur la fiche, au même niveau
  // que front desk (cf. docs/cahier-des-charges-import-fiches-client.md
  // section 2), à l'exception explicite des commandes et du pipeline
  // commercial — masqués ci-dessous plutôt que simplement laissés visibles et
  // rejetés par le backend au clic. L'agenda/RDV (tasks.js) reste, lui, hors
  // périmètre Administrateur comme documenté ailleurs (routes/tasks.js) —
  // seule la section RDV de cette fiche est donc masquée pour ce rôle, pas
  // les interactions (qui font partie de la fiche elle-même).
  const isAdministrateur = user.role === "ADMINISTRATEUR";

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stageBusy, setStageBusy] = useState(false);

  const [members, setMembers] = useState([]);
  const [reassignBusy, setReassignBusy] = useState(false);

  const [interactions, setInteractions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const [planTitle, setPlanTitle] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);

  const [toast, setToast] = useState(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/accounts/${id}`);
      setAccount(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await api.get(`/accounts/${id}/interactions`);
      setInteractions(data);
    } catch {
      // L'historique n'est pas critique pour l'affichage de la fiche —
      // erreur silencieuse, la fiche elle-même reste utilisable.
    } finally {
      setLoadingHistory(false);
    }
  }, [id]);

  useEffect(() => {
    loadAccount();
    loadHistory();
  }, [loadAccount, loadHistory]);

  useEffect(() => {
    if (!isDirecteur) return;
    let cancelled = false;
    api
      .get("/team/members")
      .then((data) => {
        if (!cancelled) setMembers(data);
      })
      .catch(() => {
        // Non bloquant — si ça échoue, la section réaffectation reste juste vide.
      });
    return () => {
      cancelled = true;
    };
  }, [isDirecteur]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleStageChange(stage) {
    setStageBusy(true);
    try {
      const updated = await api.patch(`/accounts/${id}/pipeline`, { stage });
      setAccount((a) => ({ ...a, pipelineStage: updated.pipelineStage }));
    } catch (err) {
      setToast(err.message);
    } finally {
      setStageBusy(false);
    }
  }

  async function handleAddInteraction(e) {
    e.preventDefault();
    if (!note.trim()) {
      setNoteError(t("account.interactionEmpty"));
      return;
    }
    setNoteError(null);
    setSavingNote(true);
    try {
      await api.post(`/accounts/${id}/interactions`, { note: note.trim() });
      setNote("");
      await loadHistory();
      setToast(t("account.interactionSaved"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleReassign(field, value) {
    setReassignBusy(true);
    try {
      const updated = await api.patch(`/accounts/${id}`, { [field]: value || null });
      setAccount((a) => ({ ...a, [field]: updated[field] }));
      setToast(t("account.reassignSaved"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setReassignBusy(false);
    }
  }

  async function handlePlanRdv(e) {
    e.preventDefault();
    if (!planTitle.trim() || !planDate) {
      setPlanError(t("account.planMissing"));
      return;
    }
    setPlanError(null);
    setSavingPlan(true);
    try {
      const dueDate = new Date(`${planDate}T${planTime || "09:00"}:00`).toISOString();
      await api.post("/tasks", { title: planTitle.trim(), dueDate, accountId: id, type: "RDV" });
      setPlanTitle("");
      setPlanDate("");
      setPlanTime("");
      await loadHistory();
      setToast(t("account.planSaved"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setSavingPlan(false);
    }
  }

  if (loading) return <p className="empty-state">{t("account.loading")}</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!account) return <p className="error-text">{t("account.notFound")}</p>;

  const billing = fullAddress(account.billingStreet, account.billingZip, account.billingCity, account.countryName);
  const shipping = fullAddress(account.shippingStreet, account.shippingZip, account.shippingCity, account.countryName);

  return (
    <>
      <button className="btn outline" style={{ marginBottom: 14 }} onClick={() => navigate("/clients")}>
        <ArrowLeft size={14} /> {t("account.back")}
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{account.name}</h1>
          <p className="page-sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {account.type === "CLIENT" ? t("account.client") : t("account.prospect")} · {account.countryName}
            <span className="stage-badge">{t(`pipelineStage.${account.pipelineStage}`) || account.pipelineStage}</span>
            <span className="typology-badge">{t(`typology.${account.typology}`)}</span>
          </p>
        </div>
        {!isDirecteur && !isAdministrateur && (
          <button className="btn primary" onClick={() => navigate(`/clients/${id}/commande`)}>
            <ShoppingCart size={15} /> {t("account.newOrder")}
          </button>
        )}
      </div>

      {isDirecteur && (
        <div className="panel">
          <h3>
            <Repeat size={14} /> {t("account.sectionReassign")}
          </h3>
          <div className="task-row">
            <span>{t("account.reassignOwnerRep")}</span>
            <select
              value={account.ownerRepId || ""}
              disabled={reassignBusy}
              onChange={(e) => handleReassign("ownerRepId", e.target.value)}
              style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
              {members
                .filter((m) => m.role === "REPRESENTANT")
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.firstName} {r.lastName}
                  </option>
                ))}
            </select>
          </div>
          <div className="task-row">
            <span>{t("account.reassignMasterRep")}</span>
            <select
              value={account.masterRepId || ""}
              disabled={reassignBusy}
              onChange={(e) => handleReassign("masterRepId", e.target.value)}
              style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
            >
              <option value="">{t("teamManagement.noMasterRep")}</option>
              {members
                .filter((m) => m.role === "MASTER_REP")
                .map((mr) => (
                  <option key={mr.id} value={mr.id}>
                    {mr.firstName} {mr.lastName}
                  </option>
                ))}
            </select>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>
          <Building2 size={14} /> {t("account.sectionCompany")}
        </h3>
        <div className="task-row">
          <span>{t("account.billingAddress")}</span>
          <span>{billing || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>{t("account.shippingAddress")}</span>
          <span>{shipping || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>{t("account.contact")}</span>
          <span>{account.contactName || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>
            <Phone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t("account.phone")}
          </span>
          <span>{account.phone ? `${account.phoneCountryCode || ""} ${account.phone}`.trim() : t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>
            <Phone size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t("account.mobile")}
          </span>
          <span>{account.mobile ? `${account.mobileCountryCode || ""} ${account.mobile}`.trim() : t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>
            <Mail size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            {t("account.email")}
          </span>
          <span>{account.email || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>{account.taxIdLabel || "N° fiscal"}</span>
          <span>{account.taxId || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>{t("account.vat")}</span>
          <span>{account.vatNumber || t("account.noValue")}</span>
        </div>
        <div className="task-row">
          <span>{t("account.pipelineStageLabel")}</span>
          {isAdministrateur ? (
            <span>{t(`pipelineStage.${account.pipelineStage}`) || account.pipelineStage}</span>
          ) : (
            <select
              value={account.pipelineStage}
              disabled={stageBusy}
              onChange={(e) => handleStageChange(e.target.value)}
              style={{ padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {t(`pipelineStage.${s}`)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>
          <Plus size={14} /> {t("account.sectionInteraction")}
        </h3>
        <form onSubmit={handleAddInteraction}>
          <div className="field">
            <textarea
              placeholder={t("account.interactionPlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {noteError && <p className="error-text">{noteError}</p>}
          <button className="btn primary" type="submit" disabled={savingNote}>
            {savingNote ? t("account.interactionSaving") : t("account.interactionSubmit")}
          </button>
        </form>
      </div>

      {!isAdministrateur && (
        <div className="panel">
          <h3>
            <CalendarDays size={14} /> {t("account.sectionPlan")}
          </h3>
          <form onSubmit={handlePlanRdv}>
            <div className="field">
              <input
                placeholder={t("account.planTitlePlaceholder")}
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("account.planDate")}</label>
                <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("account.planTime")}</label>
                <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)} />
              </div>
            </div>
            {planError && <p className="error-text">{planError}</p>}
            <button className="btn primary" type="submit" disabled={savingPlan}>
              {savingPlan ? t("account.planSaving") : t("account.planSubmit")}
            </button>
          </form>
        </div>
      )}

      <div className="panel">
        <h3>
          <History size={14} /> {t("account.sectionHistory")}
        </h3>
        {!loadingHistory && interactions.length === 0 && <p className="empty-state">{t("account.historyEmpty")}</p>}
        {interactions.map((it) => (
          <div className="task-row" key={it.id} style={{ alignItems: "flex-start" }}>
            <span>{it.note}</span>
            <span style={{ whiteSpace: "nowrap", color: "var(--ink-soft)", fontSize: 11.5 }}>
              {dateTime(it.createdAt, locale)} · {it.firstName} {it.lastName}
            </span>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
