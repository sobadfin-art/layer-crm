import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate, dateTime } from "../lib/format.js";
import { useAgendaSummary } from "../hooks/useAgendaSummary.js";
import AccountsMap from "../components/AccountsMap.jsx";
import { fiscalYearBounds, fiscalYearLabel } from "../lib/fiscalYear.js";

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

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
    rdv,
    tasks,
    pendingTasks,
    overdueTasks,
    loading: loadingAgenda,
    error: agendaError,
    reload: reloadAgenda,
  } = useAgendaSummary();

  // Portefeuille — PDF section 1 : comptes gagnés/perdus sur la période
  // (annuelle), clients actifs ayant/n'ayant pas commandé sur la période, et
  // nombre total de comptes clients actifs affectés. Calculé à partir des
  // données déjà scopées au représentant côté serveur (GET /accounts,
  // GET /orders), jamais d'appel élargi.
  //
  // Période = l'année COMMERCIALE (01/11-31/10), pas l'année civile — règle
  // explicite du PDF Représentant ("Période commerciale par défaut : du 1er
  // novembre au 31 octobre... pour le portefeuille annuel et les indicateurs
  // annuels du représentant"), cf. lib/fiscalYear.js.
  const [accounts, setAccounts] = useState([]);
  const [ordersThisYear, setOrdersThisYear] = useState([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);

  const loadPortfolio = useCallback(async () => {
    setLoadingPortfolio(true);
    try {
      const { start } = fiscalYearBounds();
      const [accountsData, ordersData] = await Promise.all([
        api.get("/accounts"),
        api.get(`/orders?dateFrom=${encodeURIComponent(start.toISOString())}`),
      ]);
      setAccounts(accountsData);
      setOrdersThisYear(ordersData);
    } catch {
      // Non bloquant — le reste du tableau de bord reste utilisable.
    } finally {
      setLoadingPortfolio(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  // Tâches du jour et rendez-vous du jour uniquement (PDF section 1) —
  // distinct des listes "à venir" utilisées par le badge de nav/Agenda.jsx,
  // qui restent, elles, inchangées.
  const todayTasks = pendingTasks.filter((t) => isToday(t.dueDate));
  const todayRdv = rdv.filter((r) => isToday(r.dueDate));

  const { start: fyStart, end: fyEnd } = fiscalYearBounds();
  const activeClients = accounts.filter((a) => a.type === "CLIENT" && a.status !== "ARCHIVE" && a.status !== "INACTIF");
  const wonThisYear = accounts.filter(
    (a) => a.wonDate && new Date(a.wonDate) >= fyStart && new Date(a.wonDate) <= fyEnd
  );
  const lostThisYear = accounts.filter(
    (a) => a.lostDate && new Date(a.lostDate) >= fyStart && new Date(a.lostDate) <= fyEnd
  );
  const accountIdsWithOrder = new Set(ordersThisYear.map((o) => o.accountId));
  const activeClientsWithOrder = activeClients.filter((a) => accountIdsWithOrder.has(a.id));
  const activeClientsWithoutOrder = activeClients.filter((a) => !accountIdsWithOrder.has(a.id));

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
          <div className="stat-label">{t("dashboard.activeClients")}</div>
          <div className="stat-value">{loadingPortfolio ? "…" : activeClients.length}</div>
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
        <h3>
          {t("dashboard.portfolioTitle")}{" "}
          <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 12 }}>
            — {t("dashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
          </span>
        </h3>
        <div className="task-row">
          <span>{t("dashboard.portfolioWon")}</span>
          <span>{loadingPortfolio ? "…" : wonThisYear.length}</span>
        </div>
        <div className="task-row">
          <span>{t("dashboard.portfolioLost")}</span>
          <span>{loadingPortfolio ? "…" : lostThisYear.length}</span>
        </div>
        <div className="task-row">
          <span>{t("dashboard.portfolioActiveOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsWithOrder.length}</span>
        </div>
        <div className="task-row">
          <span>{t("dashboard.portfolioActiveNotOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsWithoutOrder.length}</span>
        </div>
      </div>

      <div className="panel">
        <h3>{t("dashboard.nextRdvTitle")}</h3>
        {todayRdv.map((r) => (
          <div className="task-row" key={r.id}>
            <span>
              {r.accountName || t("dashboard.noAccount")} — {r.title}
            </span>
            <span>{r.dueDate ? dateTime(r.dueDate, locale) : t("dashboard.noDate")}</span>
          </div>
        ))}
        {!loadingAgenda && todayRdv.length === 0 && <p className="empty-state">{t("dashboard.noRdv")}</p>}
      </div>

      <div className="panel">
        <h3>{t("dashboard.tasksTitle")}</h3>
        {todayTasks.map((tk) => {
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
        {!loadingAgenda && todayTasks.length === 0 && <p className="empty-state">{t("dashboard.noTasks")}</p>}
      </div>

      {/* Carte & tournées — sous les tâches et rendez-vous du jour (PDF
          Représentant section 1 : "Le bloc doit être présent directement sur
          le Dashboard, sous les tâches et rendez-vous."). */}
      <AccountsMap scope="representant" />
    </>
  );
}
