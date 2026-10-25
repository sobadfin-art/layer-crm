import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime, shortDate } from "../lib/format.js";
import ClientSearchPicker from "../components/ClientSearchPicker.jsx";
import AgendaCalendar from "../components/AgendaCalendar.jsx";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Mêmes valeurs que le backend (backend/src/lib/interactionTypes.js) et que
// AccountDetail.jsx (qui les redéfinit aussi localement plutôt que de les
// importer, aucun module partagé côté frontend n'existe pour ça) — à garder
// synchronisé si l'énum change côté serveur.
const INTERACTION_TYPES = ["VISITE", "APPEL", "EMAIL", "RDV_COURTOISIE", "SAV", "AUTRE"];

// Correctif 2026-09-22 (demande client — "Création de RDV et de tâches avec
// allocation client directe, depuis l'Agenda") : le RDV créé depuis l'Agenda
// utilise EXACTEMENT les mêmes champs que le formulaire de planification déjà
// présent sur la fiche client (AccountDetail.jsx#handlePlanRdv — objet, type
// via INTERACTION_TYPES, date, heure) et le même endpoint POST /api/tasks
// avec type: "RDV" — donc la même structure de données, la même validation
// serveur (accountId obligatoire pour un RDV, cf. tasks.js) et les mêmes
// règles de visibilité par rôle. Seule différence : le client est choisi ici
// via ClientSearchPicker (composant réutilisable du point 1) plutôt qu'être
// implicite à la fiche déjà ouverte.

// Agenda — deux sous-vues fidèles à la maquette (docs/prototype-crm-commercial.jsx,
// view === "agenda") : "Rendez-vous" (issus de GET /api/dashboard/rdv, qui
// couvre passé ET futur — nécessaire ici pour pouvoir saisir un compte rendu
// sur un RDV déjà passé) et "Tâches" (GET /api/tasks, génériques, avec
// création + case à cocher).
//
// Pour un Master Rep, ces deux endpoints renvoient SES rendez-vous/tâches ET
// ceux de son équipe affectée (cf. commentaires dashboard.js#/rdv et
// tasks.js#/) — "agenda équipe". Le Master Rep ne peut cocher une tâche ou
// saisir un compte rendu que sur SES PROPRES éléments (isOwnTask ci-dessous,
// même règle que le serveur — tasks.js isOwnTask/isPrivileged) : ceux de son
// équipe restent strictement en lecture seule (section 3 : "tâches, agenda"
// en lecture seule pour le Master Rep), avec le nom du titulaire affiché pour
// les distinguer des siens.
//
// Point 3 (2026-10-25) : nouvelle sous-vue "Calendrier" (par défaut) — Jour,
// Semaine, Mois, Année (components/AgendaCalendar.jsx), alimentée par les
// MÊMES données que les deux listes ci-dessus (aucun nouvel endpoint, aucun
// changement de structure sur les RDV/tâches, visibilité par rôle
// inchangée). Clic sur un créneau → même formulaire de création de RDV que
// le bouton "Nouveau RDV" (date/heure pré-remplies) ; clic sur un événement
// → son détail (réutilise renderRdvCard, compte rendu compris) et l'accès à
// la fiche client. Les listes "Rendez-vous" et "Tâches" restent disponibles
// telles quelles (compte rendu, cases à cocher, création de tâche).
export default function Agenda() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPrivileged = user.role === "FRONT_DESK" || user.role === "DIRECTEUR";
  const [subview, setSubview] = useState("calendar");
  // Détail ouvert depuis le calendrier : { kind: "rdv" | "task", id }.
  const [detail, setDetail] = useState(null);
  const [slotModalOpen, setSlotModalOpen] = useState(false);

  const [rdvList, setRdvList] = useState([]);
  const [loadingRdv, setLoadingRdv] = useState(true);
  const [rdvError, setRdvError] = useState(null);

  const [taskList, setTaskList] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState(null);

  const [accounts, setAccounts] = useState([]);

  const [openCompteRenduId, setOpenCompteRenduId] = useState(null);
  const [compteRenduText, setCompteRenduText] = useState("");
  const [savingCompteRendu, setSavingCompteRendu] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAccountId, setNewTaskAccountId] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  // Formulaire "Créer un RDV" (point 3) — replie/déplie, mêmes champs que
  // AccountDetail.jsx#handlePlanRdv (cf. commentaire en tête de fichier).
  const [newRdvOpen, setNewRdvOpen] = useState(false);
  const [newRdvAccountId, setNewRdvAccountId] = useState("");
  const [newRdvTitle, setNewRdvTitle] = useState("");
  const [newRdvType, setNewRdvType] = useState("");
  const [newRdvDate, setNewRdvDate] = useState("");
  const [newRdvTime, setNewRdvTime] = useState("");
  const [savingRdv, setSavingRdv] = useState(false);
  const [rdvCreateError, setRdvCreateError] = useState(null);

  const loadRdv = useCallback(async () => {
    setLoadingRdv(true);
    setRdvError(null);
    try {
      const data = await api.get("/dashboard/rdv");
      data.sort((a, b) => {
        const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return at - bt;
      });
      setRdvList(data);
    } catch (err) {
      setRdvError(err.message);
    } finally {
      setLoadingRdv(false);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setTasksError(null);
    try {
      const data = await api.get("/tasks");
      setTaskList(data.filter((tk) => tk.type === "TACHE"));
    } catch (err) {
      setTasksError(err.message);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    loadRdv();
    loadTasks();
    api
      .get("/accounts")
      .then(setAccounts)
      .catch(() => {});
  }, [loadRdv, loadTasks]);

  const accountName = useMemo(() => {
    const map = new Map(accounts.map((a) => [a.id, a.name]));
    return (id) => map.get(id) || null;
  }, [accounts]);

  function startCompteRendu(task) {
    setOpenCompteRenduId(task.id);
    setCompteRenduText(task.compteRendu || "");
  }

  async function submitCompteRendu(task) {
    if (!compteRenduText.trim()) return;
    setSavingCompteRendu(true);
    try {
      await api.patch(`/tasks/${task.id}/compte-rendu`, { compteRendu: compteRenduText.trim() });
      setOpenCompteRenduId(null);
      setCompteRenduText("");
      await loadRdv();
    } finally {
      setSavingCompteRendu(false);
    }
  }

  async function toggleTaskDone(task) {
    try {
      await api.patch(`/tasks/${task.id}`, { done: !task.done });
    } finally {
      await loadTasks();
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      await api.post("/tasks", {
        title: newTaskTitle.trim(),
        accountId: newTaskAccountId || null,
        dueDate: newTaskDueDate ? new Date(`${newTaskDueDate}T09:00:00`).toISOString() : null,
        type: "TACHE",
      });
      setNewTaskTitle("");
      setNewTaskAccountId("");
      setNewTaskDueDate("");
      await loadTasks();
    } finally {
      setCreatingTask(false);
    }
  }

  // Mêmes règles que handlePlanRdv (AccountDetail.jsx) : titre + date
  // obligatoires, POST /api/tasks avec type: "RDV" (le serveur refuse un RDV
  // sans accountId, cf. tasks.js — d'où la validation client identique ici),
  // rdvSubtype optionnel issu de INTERACTION_TYPES. Seule différence : le
  // compte est choisi explicitement via ClientSearchPicker plutôt qu'implicite
  // à la fiche déjà ouverte.
  function openNewRdvForm() {
    setNewRdvOpen(true);
    setRdvCreateError(null);
  }

  function closeNewRdvForm() {
    setNewRdvOpen(false);
    setSlotModalOpen(false);
    setRdvCreateError(null);
    setNewRdvAccountId("");
    setNewRdvTitle("");
    setNewRdvType("");
    setNewRdvDate("");
    setNewRdvTime("");
  }

  async function handleCreateRdv(e) {
    e.preventDefault();
    if (!newRdvAccountId) {
      setRdvCreateError(t("agenda.newRdvClientRequired"));
      return;
    }
    if (!newRdvTitle.trim() || !newRdvDate) {
      setRdvCreateError(t("account.planMissing"));
      return;
    }
    setRdvCreateError(null);
    setSavingRdv(true);
    try {
      const dueDate = new Date(`${newRdvDate}T${newRdvTime || "09:00"}:00`).toISOString();
      await api.post("/tasks", {
        title: newRdvTitle.trim(),
        dueDate,
        accountId: newRdvAccountId,
        type: "RDV",
        rdvSubtype: newRdvType || null,
      });
      closeNewRdvForm();
      await loadRdv();
    } catch (err) {
      setRdvCreateError(err.message);
    } finally {
      setSavingRdv(false);
    }
  }

  // Créneau cliqué dans le calendrier : ouvre le formulaire de création de
  // RDV avec la date et l'heure du créneau déjà renseignées.
  function openSlot(date) {
    setNewRdvAccountId("");
    setNewRdvTitle("");
    setNewRdvType("");
    setNewRdvDate(`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`);
    setNewRdvTime(`${pad2(date.getHours())}:${pad2(date.getMinutes())}`);
    setRdvCreateError(null);
    setNewRdvOpen(false);
    setSlotModalOpen(true);
  }

  // Événements du calendrier : tous les RDV datés (passés et à venir) et
  // toutes les tâches ayant une échéance (faites comprises, affichées
  // atténuées). Les éléments sans date n'ont pas de place dans un
  // calendrier et restent visibles dans les listes.
  const calendarEvents = useMemo(
    () => [
      ...rdvList
        .filter((ev) => ev.dueDate)
        .map((ev) => ({ id: `rdv-${ev.id}`, refId: ev.id, kind: "rdv", start: new Date(ev.dueDate), title: ev.title, accountName: ev.accountName, done: false })),
      ...taskList
        .filter((tk) => tk.dueDate)
        .map((tk) => ({
          id: `task-${tk.id}`,
          refId: tk.id,
          kind: "task",
          start: new Date(tk.dueDate),
          title: tk.title,
          accountName: tk.accountId ? accountName(tk.accountId) : null,
          done: tk.done,
        })),
    ],
    [rdvList, taskList, accountName]
  );

  const detailRdv = detail?.kind === "rdv" ? rdvList.find((ev) => ev.id === detail.id) : null;
  const detailTask = detail?.kind === "task" ? taskList.find((tk) => tk.id === detail.id) : null;

  const pendingTasks = taskList.filter((tk) => !tk.done);
  const doneTasks = taskList.filter((tk) => tk.done);

  // Un rendez-vous passé est "archivé" (PDF Directeur section 0 : "rendre les
  // tâches cliquables/archivables et conserver le contenu des rendez-vous
  // réalisés" ; PDF Représentant section 10 : "Un rendez-vous passé / terminé
  // est archivé et ne reste pas dans les vues courantes. L'historique doit
  // rester consultable.") — même principe que pendingTasks/doneTasks
  // ci-dessus, décliné pour les RDV : la vue principale ne montre que les RDV
  // à venir, les RDV passés restent consultables (et le compte rendu reste
  // saisissable) dans une section séparée, jamais supprimés.
  const now = Date.now();
  const upcomingRdvList = rdvList.filter((ev) => !ev.dueDate || new Date(ev.dueDate).getTime() >= now);
  const pastRdvList = rdvList.filter((ev) => ev.dueDate && new Date(ev.dueDate).getTime() < now);

  // Formulaire de création de RDV — partagé entre le bouton "Nouveau RDV" de
  // la liste et le clic sur un créneau du calendrier (même champs, même
  // validation, même endpoint).
  function renderRdvForm() {
    return (
      <form onSubmit={handleCreateRdv}>
        <div className="field">
          <label>{t("agenda.newRdvClientLabel")}</label>
          <ClientSearchPicker accounts={accounts} value={newRdvAccountId} onChange={setNewRdvAccountId} />
        </div>
        <div className="field">
          <input
            placeholder={t("account.planTitlePlaceholder")}
            value={newRdvTitle}
            onChange={(e) => setNewRdvTitle(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t("account.planTypeLabel")}</label>
          <select value={newRdvType} onChange={(e) => setNewRdvType(e.target.value)}>
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
            <input type="date" value={newRdvDate} onChange={(e) => setNewRdvDate(e.target.value)} />
          </div>
          <div className="field">
            <label>{t("account.planTime")}</label>
            <input type="time" value={newRdvTime} onChange={(e) => setNewRdvTime(e.target.value)} />
          </div>
        </div>
        {rdvCreateError && <p className="error-text">{rdvCreateError}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn primary" type="submit" disabled={savingRdv}>
            {savingRdv ? t("account.planSaving") : t("account.planSubmit")}
          </button>
          <button className="btn outline" type="button" onClick={closeNewRdvForm}>
            {t("agenda.newRdvCancel")}
          </button>
        </div>
      </form>
    );
  }

  function renderRdvCard(ev, archived = false) {
    const isOwn = ev.assigneeId === user.id;
    const canEdit = isOwn || isPrivileged;
    return (
      <div className="panel" key={ev.id} style={archived ? { opacity: 0.75 } : undefined}>
        <div className="task-row" style={{ border: "none", padding: "0 0 4px" }}>
          <span
            style={{ cursor: ev.accountId ? "pointer" : "default", textDecoration: ev.accountId ? "underline" : "none" }}
            onClick={() => ev.accountId && navigate(`/clients/${ev.accountId}`)}
          >
            <strong>{ev.accountName || t("agenda.personalTask")}</strong> — {ev.title}
            {/* GET /api/dashboard/rdv joint le nom du représentant sous
                repFirstName/repLastName (et non assigneeFirstName/Last —
                alias différent de GET /api/tasks, cf. dashboard.js). */}
            {!isOwn && (ev.repFirstName || ev.repLastName) && (
              <span className="typology-badge" style={{ marginLeft: 6 }}>
                {ev.repFirstName} {ev.repLastName}
              </span>
            )}
          </span>
          <span>{ev.dueDate ? dateTime(ev.dueDate, locale) : "—"}</span>
        </div>

        {ev.compteRendu ? (
          <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>
            <strong>{t("agenda.compteRenduSavedOn", { date: dateTime(ev.compteRenduAt, locale) })}</strong>
            <br />
            {ev.compteRendu}
          </p>
        ) : !canEdit ? null : openCompteRenduId === ev.id ? (
          <div style={{ marginTop: 8 }}>
            <div className="field">
              <textarea
                placeholder={t("agenda.compteRenduPlaceholder")}
                value={compteRenduText}
                onChange={(e) => setCompteRenduText(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" disabled={savingCompteRendu} onClick={() => submitCompteRendu(ev)}>
                {savingCompteRendu ? t("agenda.compteRenduSaving") : t("agenda.compteRenduSubmit")}
              </button>
              <button className="btn outline" onClick={() => setOpenCompteRenduId(null)}>
                {t("agenda.compteRenduCancel")}
              </button>
            </div>
          </div>
        ) : (
          <button className="btn outline" style={{ marginTop: 8 }} onClick={() => startCompteRendu(ev)}>
            {t("agenda.compteRenduAdd")}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">{t("agenda.title")}</h1>
      <p className="page-sub">{t("agenda.subtitle")}</p>

      <div className="cat-tabs">
        <button className={`cat-tab ${subview === "calendar" ? "active" : ""}`} onClick={() => setSubview("calendar")}>
          {t("agenda.tabCalendar")}
        </button>
        <button className={`cat-tab ${subview === "rdv" ? "active" : ""}`} onClick={() => setSubview("rdv")}>
          {t("agenda.tabRdv")}
        </button>
        <button className={`cat-tab ${subview === "taches" ? "active" : ""}`} onClick={() => setSubview("taches")}>
          {t("agenda.tabTasks")}
          {pendingTasks.length > 0 && ` (${pendingTasks.length})`}
        </button>
      </div>

      {subview === "calendar" && (
        <>
          {(rdvError || tasksError) && <p className="error-text">{rdvError || tasksError}</p>}
          <AgendaCalendar
            events={calendarEvents}
            onSlotClick={openSlot}
            onEventClick={(ev) => setDetail({ kind: ev.kind, id: ev.refId })}
            t={t}
            locale={locale}
          />
        </>
      )}

      {slotModalOpen && (
        <div className="modal-overlay" onClick={closeNewRdvForm}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{t("agenda.newRdvButton")}</h3>
            {renderRdvForm()}
          </div>
        </div>
      )}

      {(detailRdv || detailTask) && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{detailRdv ? t("agenda.calLegendRdv") : t("agenda.calLegendTask")}</h3>
            {detailRdv && (
              <>
                {detailRdv.rdvSubtype && (
                  <p className="page-sub" style={{ marginTop: 0 }}>
                    {t(`interactionType.${detailRdv.rdvSubtype}`)}
                  </p>
                )}
                {renderRdvCard(detailRdv, detailRdv.dueDate && new Date(detailRdv.dueDate).getTime() < Date.now())}
              </>
            )}
            {detailTask && (
              <div className="panel">
                {(() => {
                  const canEdit = detailTask.assigneeId === user.id || isPrivileged;
                  return (
                    <div className="task-row" style={{ border: "none" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={detailTask.done}
                          disabled={!canEdit}
                          onChange={() => canEdit && toggleTaskDone(detailTask)}
                        />
                        <span style={detailTask.done ? { textDecoration: "line-through" } : undefined}>{detailTask.title}</span>
                        {detailTask.assigneeId !== user.id && (detailTask.assigneeFirstName || detailTask.assigneeLastName) && (
                          <span className="typology-badge">
                            {detailTask.assigneeFirstName} {detailTask.assigneeLastName}
                          </span>
                        )}
                      </span>
                      <span>{detailTask.dueDate ? shortDate(detailTask.dueDate, locale) : "—"}</span>
                    </div>
                  );
                })()}
                {detailTask.accountId && accountName(detailTask.accountId) && (
                  <p style={{ fontSize: 13, margin: "6px 0 0" }}>{accountName(detailTask.accountId)}</p>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn outline" onClick={() => setDetail(null)}>
                {t("agenda.calClose")}
              </button>
              {(detailRdv?.accountId || detailTask?.accountId) && (
                <button className="btn primary" onClick={() => navigate(`/clients/${detailRdv?.accountId || detailTask?.accountId}`)}>
                  {t("agenda.calOpenAccount")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {subview === "rdv" && (
        <>
          <div className="panel">
            {!newRdvOpen ? (
              <button className="btn primary" type="button" onClick={openNewRdvForm}>
                {t("agenda.newRdvButton")}
              </button>
            ) : (
              renderRdvForm()
            )}
          </div>

          {rdvError && <p className="error-text">{rdvError}</p>}
          {!loadingRdv && rdvList.length === 0 && !rdvError && <p className="empty-state">{t("agenda.rdvEmpty")}</p>}

          {rdvList.length > 0 && (
            <>
              <h3 style={{ margin: "4px 0 8px" }}>{t("agenda.upcomingTitle")}</h3>
              {upcomingRdvList.length === 0 && <p className="empty-state">{t("agenda.upcomingEmpty")}</p>}
              {upcomingRdvList.map((ev) => renderRdvCard(ev))}
            </>
          )}

          {pastRdvList.length > 0 && (
            <>
              <h3 style={{ margin: "18px 0 8px" }}>{t("agenda.pastTitle")}</h3>
              {pastRdvList.map((ev) => renderRdvCard(ev, true))}
            </>
          )}
        </>
      )}

      {subview === "taches" && (
        <>
          <div className="panel">
            <form onSubmit={handleCreateTask}>
              <div className="filter-row" style={{ marginBottom: 10, alignItems: "center" }}>
                <input
                  placeholder={t("agenda.newTaskTitlePlaceholder")}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 160,
                    padding: "8px 10px",
                    border: "1px solid var(--line)",
                    borderRadius: 5,
                    fontSize: 13,
                    fontFamily: "inherit",
                  }}
                />
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, fontFamily: "inherit" }}
                />
                <button className="btn primary" type="submit" disabled={creatingTask || !newTaskTitle.trim()}>
                  {creatingTask ? t("agenda.newTaskCreating") : t("agenda.newTaskSubmit")}
                </button>
              </div>
              {/* Correctif 2026-09-22 (point 3) : ClientSearchPicker remplace le
                  <select> à plat — même comportement "Moi-même si aucun client
                  sélectionné" qu'avant (allowNone + noneLabel), déjà le cas
                  pour une tâche créée depuis la fiche client. */}
              <div className="field">
                <ClientSearchPicker
                  accounts={accounts}
                  value={newTaskAccountId}
                  onChange={setNewTaskAccountId}
                  allowNone
                  noneLabel={t("agenda.newTaskAccountNone")}
                />
              </div>
            </form>
          </div>

          {tasksError && <p className="error-text">{tasksError}</p>}

          <div className="panel">
            <h3>{t("agenda.pendingTitle")}</h3>
            {!loadingTasks && pendingTasks.length === 0 && <p className="empty-state">{t("agenda.pendingEmpty")}</p>}
            {pendingTasks.map((tk) => {
              const overdue = tk.dueDate && new Date(tk.dueDate).getTime() < Date.now();
              const linkedName = tk.accountId ? accountName(tk.accountId) : null;
              const isOwn = tk.assigneeId === user.id;
              const canEdit = isOwn || isPrivileged;
              return (
                <div className="task-row" key={tk.id}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={tk.done} disabled={!canEdit} onChange={() => canEdit && toggleTaskDone(tk)} />
                    {linkedName && (
                      <span
                        style={{ cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => navigate(`/clients/${tk.accountId}`)}
                      >
                        {linkedName}
                      </span>
                    )}
                    {linkedName ? " — " : ""}
                    {tk.title}
                    {!isOwn && (tk.assigneeFirstName || tk.assigneeLastName) && (
                      <span className="typology-badge">
                        {tk.assigneeFirstName} {tk.assigneeLastName}
                      </span>
                    )}
                  </span>
                  <span style={{ color: overdue ? "var(--danger)" : "inherit" }}>
                    {tk.dueDate ? shortDate(tk.dueDate, locale) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {doneTasks.length > 0 && (
            <div className="panel">
              <h3>{t("agenda.doneTitle")}</h3>
              {doneTasks.map((tk) => {
                const canEdit = tk.assigneeId === user.id || isPrivileged;
                return (
                  <div className="task-row" key={tk.id} style={{ opacity: 0.6 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={tk.done} disabled={!canEdit} onChange={() => canEdit && toggleTaskDone(tk)} />
                      <span style={{ textDecoration: "line-through" }}>{tk.title}</span>
                      {tk.assigneeId !== user.id && (tk.assigneeFirstName || tk.assigneeLastName) && (
                        <span className="typology-badge">
                          {tk.assigneeFirstName} {tk.assigneeLastName}
                        </span>
                      )}
                    </span>
                    <span>{tk.dueDate ? shortDate(tk.dueDate, locale) : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
