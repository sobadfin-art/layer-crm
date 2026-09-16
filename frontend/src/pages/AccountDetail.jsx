import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Plus,
  CalendarDays,
  History,
  ShoppingCart,
  Repeat,
  Pencil,
  CreditCard,
  Paperclip,
  LifeBuoy,
  Trash2,
  Camera,
} from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime, shortDate, money } from "../lib/format.js";

const PIPELINE_STAGES = ["Nouveau", "Contacté", "RDV prévu", "Devis en cours", "Négociation", "Gagné", "Perdu"];

// Les 11 typologies officielles (cf. backend/src/lib/typology.js) — mêmes
// valeurs que ClientsList.jsx (création de compte), reprises ici pour rendre
// la typologie modifiable depuis la fiche client (fiche corrective V2 Front
// Desk section 5 : "Le Front Desk doit également pouvoir modifier la
// typologie du client").
const TYPOLOGIES = [
  "OPTICIEN",
  "SURF_SHOP",
  "FASHION_STORE",
  "SKATE_SHOP",
  "SKI_SHOP",
  "CONCEPT_STORE",
  "USHIP",
  "BIKE_STORE",
  "KEY_ACCOUNT",
  "DISTRIBUTOR",
  "AUTRE",
];

// Statut d'activité du compte (fiche corrective V2 Front Desk section 5,
// point primordial) — bascule ACTIF <-> INACTIF ouverte à tout rôle ayant
// accès à la fiche (cf. ACCOUNTS_MODULE_ROLES côté serveur) ; l'archivage
// (INACTIF -> ARCHIVE, terminal) reste un parcours distinct non couvert ici.
const STATUS_LABEL_KEY = { ACTIF: "account.statusActif", INACTIF: "account.statusInactif", ARCHIVE: "account.statusArchive" };

// Référentiel fusionné type interaction/RDV (cf. backend/src/lib/interactionTypes.js
// et la décision utilisateur "liste fusionnée complète" — un seul référentiel
// réutilisé aussi bien pour le sélecteur d'interaction que pour le sélecteur
// de planification, plutôt que deux listes distinctes qui ne correspondaient
// pas exactement entre les PDF Représentant et Master Rep).
const INTERACTION_TYPES = ["VISITE", "APPEL", "EMAIL", "RDV_COURTOISIE", "SAV", "AUTRE"];

const SEPA_STATUSES = ["NON_RENSEIGNE", "EN_ATTENTE", "VALIDE", "REVOQUE"];

const HISTORY_FILTERS = [
  { key: "7j", labelKey: "account.historyFilter7j" },
  { key: "30j", labelKey: "account.historyFilter30j" },
  { key: "trimestre", labelKey: "account.historyFilterTrimestre" },
  { key: "annee", labelKey: "account.historyFilterAnnee" },
  { key: "tout", labelKey: "account.historyFilterTout" },
];

function fullAddress(street, zip, city, country) {
  const parts = [street, [zip, city].filter(Boolean).join(" "), country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function historyCutoff(filter) {
  if (filter === "tout") return null;
  const now = new Date();
  if (filter === "7j") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (filter === "30j") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (filter === "trimestre") return new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
  if (filter === "annee") return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  return null;
}

// Fiche compte — reprend la structure de la maquette de référence (PDF de
// cadrage 2026-09-15, section 4 "Fiche client complète") : fiche société +
// coordonnées bancaires / SEPA, ajout d'interaction typée, planification RDV
// typée, création de ticket SAV, pièces jointes, historique filtrable et
// bloc commandes du compte. Une section supplémentaire (réaffectation
// représentant/Master Rep) s'affiche uniquement pour le directeur ; les
// autres rôles ne voient jamais cette section (hors périmètre de leur
// portail). "Nouvelle commande" n'est proposé qu'au Représentant (règle non
// négociable — le Master Rep ne crée jamais de commande).
export default function AccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const isDirecteur = user.role === "DIRECTEUR";
  // Administrateur : lecture/écriture complète sur la fiche, au même niveau
  // que front desk, à l'exception explicite des commandes et du pipeline
  // commercial — masqués ci-dessous. L'agenda/RDV et le SAV restent, eux,
  // hors périmètre Administrateur (cf. routes/tasks.js, routes/sav.js).
  const isAdministrateur = user.role === "ADMINISTRATEUR";
  // La création de commande est réservée au Représentant (règle non
  // négociable des PDF de cadrage 2026-09-15).
  // Fiche corrective Direction Commerciale V3 : le Directeur peut désormais
  // créer une commande comme un représentant (override explicite documenté
  // dans routes/orders.js, ORDER_CREATE_ROLES) — le Master Rep, lui, reste
  // strictement en lecture seule (décision client distincte, non concernée).
  const canCreateOrder = user.role === "REPRESENTANT" || user.role === "DIRECTEUR";
  // Le clic sur une ligne de commande doit renvoyer vers l'écran commandes du
  // rôle courant — deux écrans distincts existent selon le rôle
  // (OrdersList.jsx sous /commandes pour représentant/Master Rep, FrontDesk.jsx
  // sous /orders pour front desk/directeur, cf. App.jsx), jamais un chemin en
  // dur qui n'existe pas pour tous les rôles.
  const ordersListPath = user.role === "FRONT_DESK" || isDirecteur ? "/orders" : "/commandes";

  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stageBusy, setStageBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const [members, setMembers] = useState([]);
  const [reassignBusy, setReassignBusy] = useState(false);

  const [interactions, setInteractions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  const [savTickets, setSavTickets] = useState([]);
  const [loadingSav, setLoadingSav] = useState(true);

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [historyFilter, setHistoryFilter] = useState("tout");

  // Fiche société + banque/SEPA — édition groupée (un seul bouton "Modifier
  // la fiche", un seul formulaire, pour ne pas multiplier les allers-retours
  // API — cf. PATCH /api/accounts/:id qui accepte déjà tous ces champs en
  // une seule requête).
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);

  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState(null);

  const [planTitle, setPlanTitle] = useState("");
  const [planType, setPlanType] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState(null);

  const [savSubject, setSavSubject] = useState("");
  const [savDescription, setSavDescription] = useState("");
  const [savingSav, setSavingSav] = useState(false);
  const [savError, setSavError] = useState(null);

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

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = new URLSearchParams({ accountId: id });
      if (orderDateFrom) params.set("dateFrom", `${orderDateFrom}T00:00:00.000Z`);
      if (orderDateTo) params.set("dateTo", `${orderDateTo}T23:59:59.999Z`);
      const data = await api.get(`/orders?${params.toString()}`);
      setOrders(data);
    } catch {
      // Non bloquant — le représentant/directeur garde le reste de la fiche.
    } finally {
      setLoadingOrders(false);
    }
  }, [id, orderDateFrom, orderDateTo]);

  const loadSav = useCallback(async () => {
    setLoadingSav(true);
    try {
      const data = await api.get(`/sav?accountId=${id}`);
      setSavTickets(data);
    } catch {
      // Non bloquant.
    } finally {
      setLoadingSav(false);
    }
  }, [id]);

  const loadAttachments = useCallback(async () => {
    setLoadingAttachments(true);
    try {
      const data = await api.get(`/accounts/${id}/attachments`);
      setAttachments(data);
    } catch {
      // Non bloquant.
    } finally {
      setLoadingAttachments(false);
    }
  }, [id]);

  useEffect(() => {
    loadAccount();
    loadHistory();
    loadAttachments();
  }, [loadAccount, loadHistory, loadAttachments]);

  useEffect(() => {
    // Les commandes restent hors périmètre Administrateur (cf. en-tête) — le
    // module orders.js ne lui est de toute façon pas ouvert côté serveur.
    if (isAdministrateur) {
      setLoadingOrders(false);
      return;
    }
    loadOrders();
  }, [loadOrders, isAdministrateur]);

  useEffect(() => {
    // SAV et commandes restent hors périmètre Administrateur (cf. en-tête).
    if (isAdministrateur) {
      setLoadingSav(false);
      return;
    }
    loadSav();
  }, [loadSav, isAdministrateur]);

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

  function startEdit() {
    setEditError(null);
    setEditForm({
      name: account.name || "",
      storeName: account.storeName || "",
      typology: account.typology || "AUTRE",
      billingStreet: account.billingStreet || "",
      billingZip: account.billingZip || "",
      billingCity: account.billingCity || "",
      shippingStreet: account.shippingStreet || "",
      shippingZip: account.shippingZip || "",
      shippingCity: account.shippingCity || "",
      contactName: account.contactName || "",
      phone: account.phone || "",
      phoneCountryCode: account.phoneCountryCode || "",
      mobile: account.mobile || "",
      mobileCountryCode: account.mobileCountryCode || "",
      email: account.email || "",
      taxId: account.taxId || "",
      vatNumber: account.vatNumber || "",
      iban: account.iban || "",
      bic: account.bic || "",
      sepaMandateStatus: account.sepaMandateStatus || "NON_RENSEIGNE",
    });
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setEditForm(null);
    setEditError(null);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await api.patch(`/accounts/${id}`, editForm);
      setAccount((a) => ({ ...a, ...updated }));
      setEditMode(false);
      setEditForm(null);
      setToast(t("account.editSaved"));
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus() {
    if (!account || account.status === "ARCHIVE") return;
    const target = account.status === "INACTIF" ? "ACTIF" : "INACTIF";
    setStatusBusy(true);
    try {
      const updated = await api.patch(`/accounts/${id}/status`, { status: target });
      setAccount((a) => ({ ...a, status: updated.status }));
      setToast(t("account.statusSaved"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setStatusBusy(false);
    }
  }

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
      await api.post(`/accounts/${id}/interactions`, { note: note.trim(), type: interactionType || null });
      setNote("");
      setInteractionType("");
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
      await api.post("/tasks", {
        title: planTitle.trim(),
        dueDate,
        accountId: id,
        type: "RDV",
        rdvSubtype: planType || null,
      });
      setPlanTitle("");
      setPlanType("");
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

  async function handleCreateSav(e) {
    e.preventDefault();
    if (!savSubject.trim()) {
      setSavError(t("account.savMissing"));
      return;
    }
    setSavError(null);
    setSavingSav(true);
    try {
      await api.post("/sav", {
        accountId: id,
        subject: savSubject.trim(),
        description: savDescription.trim() || null,
      });
      setSavSubject("");
      setSavDescription("");
      await loadSav();
      setToast(t("account.savCreated"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setSavingSav(false);
    }
  }

  async function handleAttachmentUpload(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/accounts/${id}/attachments`, form);
      await loadAttachments();
      setToast(t("account.attachmentAdded"));
    } catch (err) {
      setToast(err.message);
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    try {
      await api.del(`/accounts/${id}/attachments/${attachmentId}`);
      setAttachments((list) => list.filter((a) => a.id !== attachmentId));
      setToast(t("account.attachmentDeleted"));
    } catch (err) {
      setToast(err.message);
    }
  }

  // Historique fusionné (PDF section 4 : "appels, emails, visites, rendez-
  // vous, commandes, SAV et autres interactions") — combine les interactions
  // textuelles (qui incluent déjà les traces automatiques de planification /
  // compte rendu RDV, cf. routes/tasks.js) avec les commandes et tickets SAV
  // du compte, dans un seul flux chronologique filtrable.
  const mergedHistory = useMemo(() => {
    const items = [
      ...interactions.map((it) => ({
        id: `interaction-${it.id}`,
        date: it.createdAt,
        kind: "interaction",
        label: it.type ? t(`interactionType.${it.type}`) : null,
        text: it.note,
        author: `${it.firstName || ""} ${it.lastName || ""}`.trim(),
      })),
      ...orders.map((o) => ({
        id: `order-${o.id}`,
        date: o.createdAt,
        kind: "order",
        label: t("account.historyOrderLabel"),
        text: `${t(`orders.status${o.status}`)} — ${money(o.merchandiseTotal, locale)}`,
        author: null,
      })),
      ...savTickets.map((s) => ({
        id: `sav-${s.id}`,
        date: s.createdAt,
        kind: "sav",
        label: t("account.historySavLabel"),
        text: `${s.subject} (${t(`sav.status.${s.status}`)})`,
        author: null,
      })),
    ];
    const cutoff = historyCutoff(historyFilter);
    const filtered = cutoff ? items.filter((it) => it.date && new Date(it.date) >= cutoff) : items;
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [interactions, orders, savTickets, historyFilter, t, locale]);

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
            <span
              className="typology-badge"
              style={
                account.status === "INACTIF"
                  ? { background: "var(--danger-soft, #fde8e8)", color: "var(--danger, #c0392b)" }
                  : account.status === "ARCHIVE"
                  ? { opacity: 0.6 }
                  : undefined
              }
            >
              {t(STATUS_LABEL_KEY[account.status] || "account.statusActif")}
            </span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {account.status !== "ARCHIVE" && (
            <button className="btn outline" disabled={statusBusy} onClick={handleToggleStatus}>
              {statusBusy
                ? t("account.statusSaving")
                : account.status === "INACTIF"
                ? t("account.statusSetActif")
                : t("account.statusSetInactif")}
            </button>
          )}
          {!editMode && (
            <button className="btn outline" onClick={startEdit}>
              <Pencil size={14} /> {t("account.editButton")}
            </button>
          )}
          {canCreateOrder && (
            <button className="btn primary" onClick={() => navigate(`/clients/${id}/commande`)}>
              <ShoppingCart size={15} /> {t("account.newOrder")}
            </button>
          )}
        </div>
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

      <form onSubmit={handleSaveEdit}>
        <div className="panel">
          <h3>
            <Building2 size={14} /> {t("account.sectionCompany")}
          </h3>
          {!editMode ? (
            <>
              {account.storeName && (
                <div className="task-row">
                  <span>{t("account.storeName")}</span>
                  <span>{account.storeName}</span>
                </div>
              )}
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
            </>
          ) : (
            <>
              <div className="form-row">
                <div className="field">
                  <label>{t("clients.newAccountName")}</label>
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t("account.storeName")}</label>
                  <input value={editForm.storeName} onChange={(e) => setEditForm((f) => ({ ...f, storeName: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{t("clients.newAccountTypology")}</label>
                  <select value={editForm.typology} onChange={(e) => setEditForm((f) => ({ ...f, typology: e.target.value }))}>
                    {TYPOLOGIES.map((ty) => (
                      <option key={ty} value={ty}>
                        {t(`typology.${ty}`)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{t("account.billingAddress")}</label>
                  <input
                    placeholder="Rue"
                    value={editForm.billingStreet}
                    onChange={(e) => setEditForm((f) => ({ ...f, billingStreet: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <input
                    placeholder="Code postal"
                    value={editForm.billingZip}
                    onChange={(e) => setEditForm((f) => ({ ...f, billingZip: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <input
                    placeholder="Ville"
                    value={editForm.billingCity}
                    onChange={(e) => setEditForm((f) => ({ ...f, billingCity: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{t("account.shippingAddress")}</label>
                  <input
                    placeholder="Rue"
                    value={editForm.shippingStreet}
                    onChange={(e) => setEditForm((f) => ({ ...f, shippingStreet: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <input
                    placeholder="Code postal"
                    value={editForm.shippingZip}
                    onChange={(e) => setEditForm((f) => ({ ...f, shippingZip: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <input
                    placeholder="Ville"
                    value={editForm.shippingCity}
                    onChange={(e) => setEditForm((f) => ({ ...f, shippingCity: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{t("account.contact")}</label>
                  <input value={editForm.contactName} onChange={(e) => setEditForm((f) => ({ ...f, contactName: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t("account.email")}</label>
                  <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{t("account.phone")}</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t("account.mobile")}</label>
                  <input value={editForm.mobile} onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="field">
                  <label>{account.taxIdLabel || "N° fiscal"}</label>
                  <input value={editForm.taxId} onChange={(e) => setEditForm((f) => ({ ...f, taxId: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t("account.vat")}</label>
                  <input value={editForm.vatNumber} onChange={(e) => setEditForm((f) => ({ ...f, vatNumber: e.target.value }))} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="panel">
          <h3>
            <CreditCard size={14} /> {t("account.sectionBank")}
          </h3>
          {!editMode ? (
            <>
              <div className="task-row">
                <span>{t("account.iban")}</span>
                <span>{account.iban || t("account.noValue")}</span>
              </div>
              <div className="task-row">
                <span>{t("account.bic")}</span>
                <span>{account.bic || t("account.noValue")}</span>
              </div>
              <div className="task-row">
                <span>{t("account.sepaStatusLabel")}</span>
                <span>{t(`sepaStatus.${account.sepaMandateStatus}`)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <div className="field">
                  <label>{t("account.iban")}</label>
                  <input value={editForm.iban} onChange={(e) => setEditForm((f) => ({ ...f, iban: e.target.value }))} />
                </div>
                <div className="field">
                  <label>{t("account.bic")}</label>
                  <input value={editForm.bic} onChange={(e) => setEditForm((f) => ({ ...f, bic: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label>{t("account.sepaStatusLabel")}</label>
                <select
                  value={editForm.sepaMandateStatus}
                  onChange={(e) => setEditForm((f) => ({ ...f, sepaMandateStatus: e.target.value }))}
                >
                  {SEPA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`sepaStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              {editError && <p className="error-text">{editError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn primary" type="submit" disabled={savingEdit}>
                  {savingEdit ? t("account.editSaving") : t("account.editSave")}
                </button>
                <button className="btn outline" type="button" onClick={cancelEdit} disabled={savingEdit}>
                  {t("account.editCancel")}
                </button>
              </div>
            </>
          )}
        </div>
      </form>

      <div className="panel">
        <h3>
          <Plus size={14} /> {t("account.sectionInteraction")}
        </h3>
        <form onSubmit={handleAddInteraction}>
          <div className="field">
            <label>{t("account.interactionTypeLabel")}</label>
            <select value={interactionType} onChange={(e) => setInteractionType(e.target.value)}>
              <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
              {INTERACTION_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`interactionType.${ty}`)}
                </option>
              ))}
            </select>
          </div>
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
            <div className="field">
              <label>{t("account.planTypeLabel")}</label>
              <select value={planType} onChange={(e) => setPlanType(e.target.value)}>
                <option value="">{t("directeurDashboard.objectiveRepChoose")}</option>
                {INTERACTION_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(`interactionType.${ty}`)}
                  </option>
                ))}
              </select>
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

      {!isAdministrateur && (
        <div className="panel">
          <h3>
            <LifeBuoy size={14} /> {t("account.sectionSav")}
          </h3>
          <form onSubmit={handleCreateSav}>
            <div className="field">
              <input
                placeholder={t("account.savSubjectPlaceholder")}
                value={savSubject}
                onChange={(e) => setSavSubject(e.target.value)}
              />
            </div>
            <div className="field">
              <textarea
                placeholder={t("account.savDescriptionPlaceholder")}
                value={savDescription}
                onChange={(e) => setSavDescription(e.target.value)}
              />
            </div>
            {savError && <p className="error-text">{savError}</p>}
            <button className="btn primary" type="submit" disabled={savingSav}>
              {savingSav ? t("account.savSubmitting") : t("account.savSubmit")}
            </button>
          </form>
          {!loadingSav && savTickets.length === 0 && <p className="empty-state">{t("account.savTicketsEmpty")}</p>}
          {savTickets.map((ticket) => (
            <div className="task-row" key={ticket.id}>
              <span>{ticket.subject}</span>
              <span className="typology-badge">{t(`sav.status.${ticket.status}`)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>
          <Paperclip size={14} /> {t("account.sectionAttachments")}
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <label className="btn outline" style={{ cursor: "pointer", margin: 0 }}>
            <Paperclip size={14} /> {uploadingAttachment ? t("account.attachmentUploading") : t("account.attachmentAdd")}
            <input type="file" style={{ display: "none" }} onChange={handleAttachmentUpload} disabled={uploadingAttachment} />
          </label>
          <label className="btn outline" style={{ cursor: "pointer", margin: 0 }}>
            <Camera size={14} /> {t("account.attachmentTakePhoto")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleAttachmentUpload}
              disabled={uploadingAttachment}
            />
          </label>
        </div>
        {!loadingAttachments && attachments.length === 0 && <p className="empty-state">{t("account.attachmentEmpty")}</p>}
        {attachments.map((a) => (
          <div className="task-row" key={a.id}>
            <a href={a.fileUrl} target="_blank" rel="noreferrer">
              {a.fileName}
            </a>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>{shortDate(a.createdAt, locale)}</span>
              <button
                className="btn outline"
                style={{ padding: "3px 8px" }}
                onClick={() => handleDeleteAttachment(a.id)}
                title={t("account.attachmentDelete")}
              >
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {!isAdministrateur && (
        <div className="panel">
          <h3>
            <ShoppingCart size={14} /> {t("account.sectionOrders")}
          </h3>
          <div className="form-row">
            <div className="field">
              <label>{t("account.ordersFilterFrom")}</label>
              <input type="date" value={orderDateFrom} onChange={(e) => setOrderDateFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("account.ordersFilterTo")}</label>
              <input type="date" value={orderDateTo} onChange={(e) => setOrderDateTo(e.target.value)} />
            </div>
          </div>
          {(orderDateFrom || orderDateTo) && (
            <button
              className="btn outline"
              style={{ marginBottom: 10 }}
              onClick={() => {
                setOrderDateFrom("");
                setOrderDateTo("");
              }}
            >
              {t("account.ordersFilterReset")}
            </button>
          )}
          {!loadingOrders && orders.length === 0 && <p className="empty-state">{t("account.ordersEmpty")}</p>}
          {orders.length > 0 && (
            <div className="table-scroll">
              <table className="lines-table">
                <thead>
                  <tr>
                    <th>{t("account.colDate")}</th>
                    <th>{t("account.colAmount")}</th>
                    <th>{t("account.colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => navigate(ordersListPath)}>
                      <td>{shortDate(o.createdAt, locale)}</td>
                      <td>{money(o.merchandiseTotal, locale)}</td>
                      <td>{t(`orders.status${o.status}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <h3>
          <History size={14} /> {t("account.sectionHistory")}
        </h3>
        <div className="cat-tabs">
          {HISTORY_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`cat-tab ${historyFilter === f.key ? "active" : ""}`}
              onClick={() => setHistoryFilter(f.key)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
        {!loadingHistory && mergedHistory.length === 0 && <p className="empty-state">{t("account.historyEmpty")}</p>}
        {mergedHistory.map((it) => (
          <div className="task-row" key={it.id} style={{ alignItems: "flex-start" }}>
            <span>
              {it.label && <span className="typology-badge" style={{ marginRight: 6 }}>{it.label}</span>}
              {it.text}
            </span>
            <span style={{ whiteSpace: "nowrap", color: "var(--ink-soft)", fontSize: 11.5 }}>
              {dateTime(it.date, locale)}
              {it.author ? ` · ${it.author}` : ""}
            </span>
          </div>
        ))}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
