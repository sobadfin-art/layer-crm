import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";
import AccountsMap from "../components/AccountsMap.jsx";

// Un objectif est "actif" si la date du jour tombe dans sa période.
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

// Tableau de bord Master Rep — n'existait pas jusqu'ici (la nav allait
// directement sur "Mon équipe"/Equipe.jsx, un simple suivi lecture seule).
// PDF Master Rep section 1 : "Le Dashboard doit reprendre la logique du
// Dashboard Directeur commercial, avec une différence fondamentale : chaque
// agrégat doit être calculé uniquement sur le secteur du Master Rep et sur
// les représentants qui lui sont affiliés." Tout le scoping est déjà garanti
// CÔTÉ SERVEUR (GET /team/mine, /objectives, /orders sont tous filtrés par
// getManagedRepUserIds pour ce rôle — cf. lib/managedReps.js, lib/scope.js) :
// cet écran ne fait qu'agréger ce qui revient déjà scopé, jamais de filtrage
// côté client qui pourrait laisser fuiter d'autres secteurs.
export default function MasterRepDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [reps, setReps] = useState([]);
  const [objectivesWithProgress, setObjectivesWithProgress] = useState([]);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repsData, objectivesData, pendingOrders] = await Promise.all([
        api.get("/team/mine"),
        api.get("/objectives"),
        api.get("/orders?status=ENVOYEE_FRONT_DESK"),
      ]);
      setReps(repsData);
      setPendingOrdersCount(pendingOrders.length);

      // Ses propres objectifs (s'il en a) sont exclus : ce tableau de bord
      // porte sur le secteur/l'équipe, comme Equipe.jsx.
      const teamObjectives = objectivesData.filter((o) => o.repId !== user.id && isActivePeriod(o));
      const withProgress = await Promise.all(
        teamObjectives.map(async (o) => {
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
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  function objectivesFor(repId, type) {
    return objectivesWithProgress.filter((o) => o.repId === repId && o.type === type);
  }

  const teamCa = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "CHIFFRE_AFFAIRES"));
  const teamPrecommande = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "PRECOMMANDE"));
  const teamCaPct = teamCa.target > 0 ? Math.min(100, Math.round((teamCa.achieved / teamCa.target) * 100)) : 0;
  const teamPrecommandePct =
    teamPrecommande.target > 0 ? Math.min(100, Math.round((teamPrecommande.achieved / teamPrecommande.target) * 100)) : 0;

  return (
    <>
      <h1 className="page-title">{t("masterRepDashboard.title")}</h1>
      <p className="page-sub">{t("masterRepDashboard.subtitle")}</p>

      {loading && <p className="empty-state">{t("masterRepDashboard.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="cards-row">
          <div className="stat-card">
            <div className="stat-label">{t("masterRepDashboard.statCa")}</div>
            <div className="stat-value">
              {money(teamCa.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamCa.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamCaPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("masterRepDashboard.statPrecommande")}</div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {money(teamPrecommande.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamPrecommande.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamPrecommandePct}%`, background: "var(--gold)" }} />
            </div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => navigate("/commandes")}>
            <div className="stat-label">{t("masterRepDashboard.statPending")}</div>
            <div className="stat-value">{pendingOrdersCount}</div>
          </div>
        </div>
      )}

      {!loading && !error && reps.length === 0 && <p className="empty-state">{t("masterRepDashboard.empty")}</p>}

      {!loading && !error && reps.length > 0 && (
        <div className="panel">
          <h3>{t("masterRepDashboard.teamPerfTitle")}</h3>
          {reps.map((r) => {
            const caObjectives = objectivesFor(r.id, "CHIFFRE_AFFAIRES");
            const repCa = sumTargetAchieved(caObjectives);
            const repCaPct = repCa.target > 0 ? Math.min(100, Math.round((repCa.achieved / repCa.target) * 100)) : 0;
            return (
              <div className="account-row" key={r.id} onClick={() => navigate(`/equipe/${r.id}`)}>
                <div>
                  <div className="account-name">
                    {r.firstName} {r.lastName}
                    {!r.active && (
                      <span className="typology-badge" style={{ marginLeft: 6 }}>
                        {t("equipe.inactiveBadge")}
                      </span>
                    )}
                  </div>
                  <div className="account-meta">
                    <Globe size={11} /> {(r.territoryNames || []).join(", ") || t("masterRepDashboard.noTerritory")}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12 }}>
                  {caObjectives.length > 0 ? (
                    <div style={{ fontWeight: 700 }}>
                      {money(repCa.achieved, locale)}
                      <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> / {money(repCa.target, locale)}</span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--ink-soft)" }}>{t("equipe.noActiveObjective")}</span>
                  )}
                  {caObjectives.length > 0 && (
                    <div className="progress-track" style={{ width: 120, marginTop: 4 }}>
                      <div className="progress-fill" style={{ width: `${repCaPct}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Carte & tournées — directement sous la performance par représentant
          (PDF Master Rep section 2), filtrée à l'équipe affiliée uniquement
          (accountsScopeClause côté serveur garantit déjà ce périmètre). */}
      {!loading && !error && <AccountsMap scope="masterrep" repOptions={reps} />}
    </>
  );
}
