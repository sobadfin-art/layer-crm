import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money, shortDate, dateTime } from "../lib/format.js";
// Chargement paresseux (2026-09-23) — cf. commentaire équivalent dans
// Dashboard.jsx : mapbox-gl (~1.9 Mo minifié) ne doit jamais peser sur les
// pages qui ne montrent pas la carte.
const AccountsMap = lazy(() => import("../components/AccountsMap.jsx"));
import { fiscalYearBounds, fiscalYearLabel } from "../lib/fiscalYear.js";
import { useAgendaSummary } from "../hooks/useAgendaSummary.js";
import { useObjectiveForm } from "../hooks/useObjectiveForm.jsx";
import NewOrderQuickAccess from "../components/NewOrderQuickAccess.jsx";

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Un objectif est "actif" si la date du jour tombe dans sa période — même
// règle que Equipe.jsx/Dashboard.jsx.
function isActivePeriod(o) {
  const now = Date.now();
  return new Date(o.periodStart).getTime() <= now && now <= new Date(o.periodEnd).getTime();
}

function sumTargetAchieved(list) {
  return list.reduce(
    (acc, o) => ({
      target: acc.target + Number(o.targetAmount),
      achieved: acc.achieved + (o.progress ? Number(o.progress.achievedAmount) : 0),
    }),
    { target: 0, achieved: 0 }
  );
}

// Tableau de bord global du Directeur (section 3 : "vision globale sur toute
// l'entreprise" + "fixe les objectifs"). Combine dans un seul écran :
//  - les indicateurs globaux (CA ferme, précommande, commandes en attente
//    front desk — GET /orders?status=ENVOYEE_FRONT_DESK, seul le compte
//    importe ici, la file elle-même reste consultable via /orders, l'onglet
//    "Front desk" déjà routé) ;
//  - la performance de toute l'équipe (Master Reps + leurs représentants +
//    représentants non rattachés), même construction que Equipe.jsx (Master
//    Rep) mais sur GET /team/members (équipe complète) + GET /objectives
//    (non filtré côté serveur pour un directeur — cf. objectives.js) ;
//  - la fixation d'objectifs (POST /objectives, réservé DIRECTEUR), seul
//    endroit de l'app où un objectif est créé — le Master Rep ne les voit
//    qu'en lecture seule (Equipe.jsx/RepProfile.jsx).
export default function DirecteurDashboard() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [members, setMembers] = useState([]);

  // Décluttering élargi (demande directe, 2026-09-16 : "retire tous les reps
  // fictifs... de tous les filtres, et apparitions dans l'app") : /team/members
  // exclut désormais les comptes désactivés par défaut (cf. team.js), donc ce
  // tableau de bord passe ?includeInactive=true (voir load() ci-dessous) pour
  // que le toggle "Afficher les désactivés" du bloc Performance ci-dessous
  // garde quelque chose à révéler. En contrepartie, masterReps/reps — qui
  // alimentent le formulaire "Nouvel objectif" (useObjectiveForm) et
  // AccountsMap (repOptions/masterRepOptions) — filtrent maintenant
  // explicitement .active, pour qu'un rep désactivé/fictif n'apparaisse plus
  // nulle part dans l'app, comme demandé. Ceci remplace la portée volontairement
  // limitée d'un précédent correctif ("n'affecte que le bloc Performance").
  const masterReps = members.filter((m) => m.role === "MASTER_REP" && m.active);
  const reps = members.filter((m) => m.role === "REPRESENTANT" && m.active);
  const unassignedReps = reps.filter((r) => !r.masterRepId);

  // Bloc "Performance de l'équipe" : garde son propre toggle pour réafficher
  // les comptes désactivés à la demande (masqués par défaut).
  const [showInactivePerf, setShowInactivePerf] = useState(false);
  const perfVisibleMembers = showInactivePerf ? members : members.filter((m) => m.active);
  const perfMasterReps = perfVisibleMembers.filter((m) => m.role === "MASTER_REP");
  const perfReps = perfVisibleMembers.filter((m) => m.role === "REPRESENTANT");
  const perfUnassignedReps = perfReps.filter((r) => !r.masterRepId);
  const [objectivesWithProgress, setObjectivesWithProgress] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Rendez-vous / tâches du jour, vision globale (fiche corrective Direction
  // Commerciale V3, section dashboard : blocs à insérer entre "Performance de
  // l'équipe" et "Carte & tournées", portée tous-représentants). Réutilise
  // directement GET /dashboard/rdv + GET /tasks, déjà scopés globalement pour
  // DIRECTEUR côté serveur (cf. routes/dashboard.js et routes/tasks.js) — même
  // hook que le Dashboard Représentant, aucun nouveau système.
  const { rdv, pendingTasks, loading: loadingAgenda } = useAgendaSummary();
  const todayRdv = rdv.filter((r) => isToday(r.dueDate));
  const todayTasks = pendingTasks.filter((tk) => isToday(tk.dueDate));

  // 4 KPI clients (fiche corrective V2 Direction commerciale, section 2.3 :
  // "Réintégrer dans le dashboard Direction commerciale les indicateurs qui
  // existaient dans le dashboard des représentants" — actifs / inactifs /
  // commandé depuis le début de la période / pas commandé depuis le début de
  // la période). Portée globale (tous les comptes, pas de scoping par rep :
  // GET /accounts et GET /orders ne filtrent rien pour un DIRECTEUR — cf.
  // lib/scope.js / routes/orders.js).
  //
  // Mise à jour (2026-09-16, confirmation explicite du client) : ces deux
  // indicateurs "année en cours" basculent de l'année CIVILE (1er janvier) à
  // l'année COMMERCIALE (01/11-31/10, cf. lib/fiscalYear.js), pour rester
  // lisibles avec le même repère que le portefeuille du Dashboard
  // Représentant, qui utilisait déjà cette période. Périmètre volontairement
  // limité à la lisibilité de ces indicateurs cumulés du Dashboard (ici et le
  // bloc CA ferme/précommande cumulés plus bas) — aucune autre donnée
  // Directeur (Data/extraction, historique fiche compte...) n'est concernée.
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

  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersData, objectivesData, pendingOrders] = await Promise.all([
        // includeInactive=true : nécessaire pour que le toggle "Afficher les
        // désactivés" du bloc Performance de l'équipe (plus bas) ait quelque
        // chose à révéler — /team/members exclut les désactivés par défaut
        // depuis le correctif du 2026-09-16 (voir team.js backend). Les reps
        // désactivés/fictifs sont ensuite explicitement retirés de
        // masterReps/reps ci-dessus (formulaire objectif + AccountsMap).
        api.get("/team/members?includeInactive=true"),
        api.get("/objectives"),
        api.get("/orders?status=ENVOYEE_FRONT_DESK"),
      ]);
      setMembers(membersData);
      setPendingOrdersCount(pendingOrders.length);

      const activeObjectives = objectivesData.filter(isActivePeriod);
      const withProgress = await Promise.all(
        activeObjectives.map(async (o) => {
          try {
            const progress = await api.get(`/objectives/${o.id}/progress`);
            return { ...o, progress };
          } catch {
            return { ...o, progress: null };
          }
        })
      );
      setObjectivesWithProgress(withProgress);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Bouton + formulaire "Nouvel objectif" — cf. hooks/useObjectiveForm.jsx
  // (partagé avec TeamManagement.jsx, correctif 2026-09-16).
  const { trigger: objectiveTrigger, panel: objectivePanel } = useObjectiveForm({
    masterReps,
    reps,
    onCreated: async () => {
      await load();
      setToast(t("directeurDashboard.objectiveCreated"));
    },
  });

  function objectivesFor(repId, type) {
    return objectivesWithProgress.filter((o) => o.repId === repId && o.type === type);
  }

  const activeClients = accounts.filter((a) => a.type === "CLIENT" && a.status === "ACTIF");
  const inactiveClients = accounts.filter((a) => a.type === "CLIENT" && a.status === "INACTIF");
  const accountIdsWithOrderThisYear = new Set(ordersThisYear.map((o) => o.accountId));
  const activeClientsOrdered = activeClients.filter((a) => accountIdsWithOrderThisYear.has(a.id));
  const activeClientsNotOrdered = activeClients.filter((a) => !accountIdsWithOrderThisYear.has(a.id));

  const teamCa = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "CHIFFRE_AFFAIRES"));
  const teamPrecommande = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "PRECOMMANDE"));
  const teamCaPct = teamCa.target > 0 ? Math.min(100, Math.round((teamCa.achieved / teamCa.target) * 100)) : 0;
  const teamPrecommandePct =
    teamPrecommande.target > 0 ? Math.min(100, Math.round((teamPrecommande.achieved / teamPrecommande.target) * 100)) : 0;

  function MemberPerfRow({ member, indent }) {
    const caObjectives = objectivesFor(member.id, "CHIFFRE_AFFAIRES");
    const repCa = sumTargetAchieved(caObjectives);
    const repCaPct = repCa.target > 0 ? Math.min(100, Math.round((repCa.achieved / repCa.target) * 100)) : 0;
    return (
      <div className="account-row" style={{ paddingLeft: indent ? 20 : 0 }} onClick={() => navigate("/clients")}>
        <div>
          <div className="account-name">
            {indent && <span style={{ color: "var(--ink-soft)", marginRight: 4 }}>↳</span>}
            {member.firstName} {member.lastName}
            {!member.active && (
              <span className="typology-badge" style={{ marginLeft: 6 }}>
                {t("teamManagement.inactive")}
              </span>
            )}
          </div>
          <div className="account-meta">
            <Globe size={11} /> {member.email}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          {caObjectives.length > 0 ? (
            <div style={{ fontWeight: 700 }}>
              {money(repCa.achieved, locale)}
              <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> / {money(repCa.target, locale)}</span>
            </div>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>{t("directeurDashboard.noActiveObjective")}</span>
          )}
          {caObjectives.length > 0 && (
            <div className="progress-track" style={{ width: 120, marginTop: 4 }}>
              <div className="progress-fill" style={{ width: `${repCaPct}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{t("directeurDashboard.title")}</h1>
          <p className="page-sub">{t("directeurDashboard.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* Parcours C — accès rapide "Nouvelle commande" (fiche corrective
              Direction Commerciale V3, même parcours que le Représentant). */}
          <NewOrderQuickAccess />
          {objectiveTrigger}
        </div>
      </div>

      {loading && <p className="empty-state">{t("directeurDashboard.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {objectivePanel}

      {!loading && !error && (
        <div className="cards-row">
          <div className="stat-card">
            <div className="stat-label">
              {t("directeurDashboard.statCa")}
              <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-soft)" }}>
                {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
              </div>
            </div>
            <div className="stat-value">
              {money(teamCa.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamCa.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamCaPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              {t("directeurDashboard.statPrecommande")}
              <div style={{ fontSize: 10.5, fontWeight: 500, color: "var(--ink-soft)" }}>
                {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
              </div>
            </div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {money(teamPrecommande.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamPrecommande.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamPrecommandePct}%`, background: "var(--gold)" }} />
            </div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/orders")}>
            <div className="stat-label">{t("directeurDashboard.statPending")}</div>
            <div className="stat-value">{pendingOrdersCount}</div>
          </div>
        </div>
      )}

      <div className="panel">
        <h3>
          {t("directeurDashboard.clientKpiTitle")}{" "}
          <span style={{ fontWeight: 500, color: "var(--ink-soft)", fontSize: 12 }}>
            — {t("directeurDashboard.fiscalYearLabel", { range: fiscalYearLabel() })}
          </span>
        </h3>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiActive")}</span>
          <span>{loadingPortfolio ? "…" : activeClients.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiInactive")}</span>
          <span>{loadingPortfolio ? "…" : inactiveClients.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsOrdered.length}</span>
        </div>
        <div className="task-row">
          <span>{t("directeurDashboard.clientKpiNotOrdered")}</span>
          <span>{loadingPortfolio ? "…" : activeClientsNotOrdered.length}</span>
        </div>
      </div>

      {!loading && !error && (
        <div className="panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ margin: 0 }}>{t("directeurDashboard.teamPerfTitle")}</h3>
            <button type="button" className="btn-link" onClick={() => setShowInactivePerf((v) => !v)}>
              {showInactivePerf ? t("teamManagement.hideInactive") : t("teamManagement.showInactive")}
            </button>
          </div>
          {perfMasterReps.length === 0 && perfUnassignedReps.length === 0 && (
            <p className="empty-state">{t("teamManagement.noMasterReps")}</p>
          )}
          {perfMasterReps.map((mr) => (
            <div key={mr.id}>
              <MemberPerfRow member={mr} />
              {perfReps.filter((r) => r.masterRepId === mr.id).map((r) => (
                <MemberPerfRow member={r} indent key={r.id} />
              ))}
            </div>
          ))}
          {perfUnassignedReps.map((r) => (
            <MemberPerfRow member={r} key={r.id} />
          ))}
        </div>
      )}

      {/* Rendez-vous / Tâches du jour — vision globale tous représentants
          (fiche corrective Direction Commerciale V3), insérés entre
          "Performance de l'équipe" et "Carte & tournées" comme demandé. */}
      <div className="panel">
        <h3>{t("directeurDashboard.nextRdvTitle")}</h3>
        {todayRdv.map((r) => (
          <div className="task-row" key={r.id}>
            <span>
              {r.repFirstName} {r.repLastName} — {r.accountName || t("dashboard.noAccount")} — {r.title}
            </span>
            <span>{r.dueDate ? dateTime(r.dueDate, locale) : t("dashboard.noDate")}</span>
          </div>
        ))}
        {!loadingAgenda && todayRdv.length === 0 && <p className="empty-state">{t("dashboard.noRdv")}</p>}
      </div>

      <div className="panel">
        <h3>{t("directeurDashboard.tasksTitle")}</h3>
        {todayTasks.map((tk) => (
          <div className="task-row" key={tk.id}>
            <span>
              {tk.assigneeFirstName} {tk.assigneeLastName} — {tk.title}
            </span>
            <span style={{ color: tk.dueDate && new Date(tk.dueDate).getTime() < Date.now() ? "var(--danger)" : "inherit" }}>
              {tk.dueDate ? dateTime(tk.dueDate, locale) : t("dashboard.noDate")}
            </span>
          </div>
        ))}
        {!loadingAgenda && todayTasks.length === 0 && <p className="empty-state">{t("dashboard.noTasks")}</p>}
      </div>

      {/* Carte & tournées — directement sous "Performance par représentant"
          (PDF Directeur commercial section 2 : "Le bloc Carte & tournées doit
          apparaître directement sous « Performance par représentant »"). */}
      {!loading && !error && (
        <Suspense fallback={<div className="panel"><p className="empty-state">{t("accountsMap.loading")}</p></div>}>
          <AccountsMap scope="directeur" repOptions={reps} masterRepOptions={masterReps} />
        </Suspense>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
