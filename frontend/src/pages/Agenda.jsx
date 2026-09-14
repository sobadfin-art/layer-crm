import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime, shortDate } from "../lib/format.js";

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
export default function Agenda() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPrivileged = user.role === "FRONT_DESK" || user.role === "DIRECTEUR";
  const [subview, setSubview] = useState("rdv");

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

  const pendingTasks = taskList.filter((tk) => !tk.done);
  const doneTasks = taskList.filter((tk) => tk.done);

  return (
    <>
      <h1 className="page-title">{t("agenda.title")}</h1>
      <p className="page-sub">{t("agenda.subtitle")}</p>

      <div className="cat-tabs">
        <button className={`cat-tab ${subview === "rdv" ? "active" : ""}`} onClick={() => setSubview("rdv")}>
          {t("agenda.tabRdv")}
        </button>
        <button className={`cat-tab ${subview === "taches" ? "active" : ""}`} onClick={() => setSubview("taches")}>
          {t("agenda.tabTasks")}
          {pendingTasks.length > 0 && ` (${pendingTasks.length})`}
        </button>
      </div>

      {subview === "rdv" && (
        <>
          {rdvError && <p className="error-text">{rdvError}</p>}
          {!loadingRdv && rdvList.length === 0 && !rdvError && <p className="empty-state">{t("agenda.rdvEmpty")}</p>}
          {rdvList.map((ev) => {
            const isOwn = ev.assigneeId === user.id;
            const canEdit = isOwn || isPrivileged;
            return (
              <div className="panel" key={ev.id}>
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
          })}
        </>
      )}

      {subview === "taches" && (
        <>
          <div className="panel">
            <form onSubmit={handleCreateTask} className="filter-row" style={{ marginBottom: 0, alignItems: "center" }}>
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
              <select value={newTaskAccountId} onChange={(e) => setNewTaskAccountId(e.target.value)}>
                <option value="">{t("agenda.newTaskAccountNone")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                style={{ padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 13, fontFamily: "inherit" }}
              />
              <button className="btn primary" type="submit" disabled={creatingTask || !newTaskTitle.trim()}>
                {creatingTask ? t("agenda.newTaskCreating") : t("agenda.newTaskSubmit")}
              </button>
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
