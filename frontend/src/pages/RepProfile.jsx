import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate, dateTime } from "../lib/format.js";

function isActivePeriod(o) {
  const now = Date.now();
  return new Date(o.periodStart).getTime() <= now && now <= new Date(o.periodEnd).getTime();
}

// Fiche représentant consolidée (docs/prototype-crm-commercial.jsx,
// view === "rep-profile") — objectifs, tâches et prochains rendez-vous d'UN
// représentant de l'équipe du Master Rep. Toujours en lecture seule ici
// (section 3 : le Master Rep "ne fixe jamais d'objectif", et ne peut
// modifier que ses propres tâches — cf. tasks.js isOwnTask/isPrivileged).
//
// Pas de route dédiée côté backend pour "un seul rep + son détail" : on
// recompose la fiche à partir des mêmes endpoints déjà scopés à l'équipe du
// Master Rep (GET /team/mine, /objectives, /objectives/:id/progress, /tasks,
// /dashboard/rdv), filtrés côté client sur repId — cohérent avec le reste du
// portail Master Rep, qui n'introduit aucun nouvel endpoint au-delà de
// /team/mine.
export default function RepProfile() {
  const { repId } = useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [rep, setRep] = useState(null);
  const [objectives, setObjectives] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [rdv, setRdv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repsData, objectivesData, tasksData, rdvData] = await Promise.all([
        api.get("/team/mine"),
        api.get("/objectives"),
        api.get("/tasks"),
        api.get("/dashboard/rdv"),
      ]);

      const foundRep = repsData.find((r) => r.id === repId);
      setRep(foundRep || null);

      const repObjectives = objectivesData.filter((o) => o.repId === repId);
      const withProgress = await Promise.all(
        repObjectives.map(async (o) => {
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

      setTasks(tasksData.filter((tk) => tk.type === "TACHE" && tk.assigneeId === repId));

      const now = Date.now();
      setRdv(
        rdvData
          .filter((r) => r.assigneeId === repId && (!r.dueDate || new Date(r.dueDate).getTime() >= now))
          .sort((a, b) => {
            const at = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const bt = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return at - bt;
          })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [repId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="empty-state">{t("repProfile.loading")}</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!rep) return <p className="error-text">{t("repProfile.notFound")}</p>;

  const caObjectives = objectives.filter((o) => o.type === "CHIFFRE_AFFAIRES" && isActivePeriod(o));
  const caTotals = caObjectives.reduce(
    (acc, o) => ({
      target: acc.target + Number(o.targetAmount),
      achieved: acc.achieved + (o.progress ? Number(o.progress.achievedAmount) : 0),
    }),
    { target: 0, achieved: 0 }
  );
  const caPct = caTotals.target > 0 ? Math.min(100, Math.round((caTotals.achieved / caTotals.target) * 100)) : 0;

  const overdueCount = tasks.filter((tk) => !tk.done && tk.dueDate && new Date(tk.dueDate).getTime() < Date.now()).length;

  return (
    <>
      <button className="btn outline" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }} onClick={() => navigate("/equipe")}>
        <ArrowLeft size={14} /> {t("repProfile.back")}
      </button>

      <h1 className="page-title">
        {rep.firstName} {rep.lastName}
      </h1>
      <p className="page-sub">{rep.email}</p>

      <div className="cards-row">
        <div className="stat-card">
          <div className="stat-label">{t("repProfile.statCa")}</div>
          <div className="stat-value">
            {caObjectives.length > 0 ? (
              <>
                {money(caTotals.achieved, locale)}
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(caTotals.target, locale)}</span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("equipe.noActiveObjective")}</span>
            )}
          </div>
          {caObjectives.length > 0 && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${caPct}%` }} />
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("repProfile.statOverdue")}</div>
          <div className="stat-value" style={{ color: overdueCount > 0 ? "var(--danger)" : "inherit" }}>{overdueCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t("repProfile.statUpcomingRdv")}</div>
          <div className="stat-value">{rdv.length}</div>
        </div>
      </div>

      <div className="panel">
        <h3>{t("repProfile.sectionObjectives")}</h3>
        {objectives.length === 0 && <p className="empty-state">{t("repProfile.noObjectives")}</p>}
        {objectives.map((o) => {
          const pct = o.progress ? Math.min(100, Math.round(o.progress.achievedPct)) : 0;
          return (
            <div className="task-row" key={o.id} style={{ alignItems: "flex-start" }}>
              <span>
                {o.type === "PRECOMMANDE" && (
                  <span className="typology-badge" style={{ background: "var(--gold-soft)", color: "#8A6A0E", marginRight: 4 }}>
                    {t("dashboard.objectiveType.PRECOMMANDE")}
                  </span>
                )}
                {shortDate(o.periodStart, locale)} – {shortDate(o.periodEnd, locale)}
              </span>
              <span style={{ textAlign: "right" }}>
                {o.progress ? money(o.progress.achievedAmount, locale) : "—"} / {money(o.targetAmount, locale)}
                <div className="progress-track" style={{ width: 100, marginTop: 4 }}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </span>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h3>{t("repProfile.sectionTasks")}</h3>
        {tasks.length === 0 && <p className="empty-state">{t("repProfile.noTasks")}</p>}
        {tasks.map((tk) => (
          <div className="task-row" key={tk.id}>
            <span style={{ textDecoration: tk.done ? "line-through" : "none", opacity: tk.done ? 0.6 : 1 }}>{tk.title}</span>
            <span style={{ color: !tk.done && tk.dueDate && new Date(tk.dueDate) < Date.now() ? "var(--danger)" : "inherit" }}>
              {tk.done ? t("repProfile.taskDone") : tk.dueDate ? shortDate(tk.dueDate, locale) : "—"}
            </span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>{t("repProfile.sectionRdv")}</h3>
        {rdv.length === 0 && <p className="empty-state">{t("repProfile.noRdv")}</p>}
        {rdv.map((ev) => (
          <div className="task-row" key={ev.id}>
            <span>
              <strong>{ev.title}</strong>
              {ev.accountName ? ` — ${ev.accountName}` : ""}
            </span>
            <span>{ev.dueDate ? dateTime(ev.dueDate, locale) : "—"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
