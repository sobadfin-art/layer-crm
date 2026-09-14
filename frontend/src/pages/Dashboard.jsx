import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate, dateTime } from "../lib/format.js";
import { useAgendaSummary } from "../hooks/useAgendaSummary.js";

// Un objectif est "actif" si la date du jour tombe dans sa période — on le
// met en avant (trié en premier) plutôt qu'un objectif déjà écoulé ou pas
// encore commencé, cohérent avec ce qu'un représentant veut voir en premier
// en arrivant sur son tableau de bord.
function isActivePeriod(o) {
  const now = Date.now();
  return new Date(o.periodStart).getTime() <= now && now <= new Date(o.periodEnd).getTime();
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [objectives, setObjectives] = useState([]);
  const [loadingObjectives, setLoadingObjectives] = useState(true);
  const [objectivesError, setObjectivesError] = useState(null);
  const {
    upcomingRdv,
    pendingTasks,
    overdueTasks,
    loading: loadingAgenda,
    error: agendaError,
    reload: reloadAgenda,
  } = useAgendaSummary();

  const loadObjectives = useCallback(async () => {
    setLoadingObjectives(true);
    setObjectivesError(null);
    try {
      const list = await api.get("/objectives");
      // Le réalisé (computeObjectiveProgress) n'est pas inclus dans la liste —
      // un appel par objectif, cf. GET /api/objectives/:id/progress.
      const withProgress = await Promise.all(
        list.map(async (o) => {
          try {
            const progress = await api.get(`/objectives/${o.id}/progress`);
            return { ...o, progress };
          } catch {
            return { ...o, progress: null };
          }
        })
      );
      withProgress.sort((a, b) => {
        const aActive = isActivePeriod(a) ? 0 : 1;
        const bActive = isActivePeriod(b) ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return new Date(b.periodStart) - new Date(a.periodStart);
      });
      setObjectives(withProgress);
    } catch (err) {
      setObjectivesError(err.message);
    } finally {
      setLoadingObjectives(false);
    }
  }, []);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  async function toggleTaskDone(task) {
    try {
      await api.patch(`/tasks/${task.id}`, { done: !task.done });
    } finally {
      // Que la mise à jour réussisse ou échoue, on recharge depuis le serveur
      // plutôt que de mettre à jour l'état localement — évite tout risque de
      // désynchronisation d'affichage avec la vraie donnée.
      reloadAgenda();
    }
  }

  return (
    <>
      <h1 className="page-title">{t("dashboard.title", { name: user.firstName })}</h1>
      <p className="page-sub">{t("dashboard.subtitle")}</p>

      {objectivesError && <p className="error-text">{objectivesError}</p>}
      {!loadingObjectives && objectives.length === 0 && !objectivesError && (
        <p className="empty-state">{t("dashboard.noObjectives")}</p>
      )}

      {objectives.length > 0 && (
        <div className="cards-row">
          {objectives.map((o) => {
            const pct = o.progress ? Math.min(100, Math.round(o.progress.achievedPct)) : 0;
            return (
              <div className="stat-card" key={o.id}>
                <div className="stat-label">
                  {t(`dashboard.objectiveType.${o.type}`)} · {shortDate(o.periodStart, locale)} – {shortDate(o.periodEnd, locale)}
                </div>
                <div className="stat-value">
                  {o.progress ? money(o.progress.achievedAmount, locale) : "—"}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
                    {" "}
                    / {money(o.targetAmount, locale)}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cards-row">
        <div className="stat-card">
          <div className="stat-label">{t("dashboard.upcomingRdv")}</div>
          <div className="stat-value">{loadingAgenda ? "…" : upcomingRdv.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("dashboard.pendingTasks")}</div>
          <div className="stat-value">{loadingAgenda ? "…" : pendingTasks.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("dashboard.overdueTasks")}</div>
          <div className="stat-value" style={{ color: overdueTasks.length > 0 ? "var(--danger)" : "inherit" }}>
            {loadingAgenda ? "…" : overdueTasks.length}
          </div>
        </div>
      </div>

      {agendaError && <p className="error-text">{agendaError}</p>}

      <div className="panel">
        <h3>{t("dashboard.nextRdvTitle")}</h3>
        {upcomingRdv.slice(0, 5).map((r) => (
          <div className="task-row" key={r.id}>
            <span>
              {r.accountName || t("dashboard.noAccount")} — {r.title}
            </span>
            <span>{r.dueDate ? dateTime(r.dueDate, locale) : t("dashboard.noDate")}</span>
          </div>
        ))}
        {!loadingAgenda && upcomingRdv.length === 0 && <p className="empty-state">{t("dashboard.noRdv")}</p>}
      </div>

      <div className="panel">
        <h3>{t("dashboard.tasksTitle")}</h3>
        {pendingTasks.map((tk) => {
          const overdue = tk.dueDate && new Date(tk.dueDate).getTime() < Date.now();
          return (
            <div className="task-row" key={tk.id}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={tk.done} onChange={() => toggleTaskDone(tk)} />
                {tk.title}
              </span>
              <span style={{ color: overdue ? "var(--danger)" : "inherit" }}>
                {overdue ? t("dashboard.overdue") : tk.dueDate ? dateTime(tk.dueDate, locale) : t("dashboard.noDate")}
              </span>
            </div>
          );
        })}
        {!loadingAgenda && pendingTasks.length === 0 && <p className="empty-state">{t("dashboard.noTasks")}</p>}
      </div>
    </>
  );
}
