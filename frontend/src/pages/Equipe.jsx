import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Globe } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

// Un objectif est "actif" si la date du jour tombe dans sa période — même
// règle que Dashboard.jsx (le Master Rep veut voir la progression de la
// période en cours, pas des objectifs déjà écoulés ou pas encore commencés).
function isActivePeriod(o) {
  const now = Date.now();
  return new Date(o.periodStart).getTime() <= now && now <= new Date(o.periodEnd).getTime();
}

// "Mon équipe" — écran d'accueil du Master Rep (docs/prototype-crm-commercial.jsx,
// role === "masterrep", view === "equipe") : les représentants qui lui sont
// affectés par la direction (GET /api/team/mine, scopé à lui — jamais
// l'équipe complète de l'entreprise, réservée au directeur via /team/members),
// avec la progression de leurs objectifs ACTIFS en cours — en lecture seule,
// le Master Rep ne fixe jamais d'objectif (section 3 du handoff).
//
// GET /api/objectives est déjà filtré côté serveur (lui-même + ses reps
// affectés) : on exclut ici ses propres objectifs pour ne garder que ceux de
// son équipe, cet écran étant spécifiquement le suivi d'équipe (ses propres
// commandes/objectifs, s'il en a, ne concernent pas cette vue).
export default function Equipe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  const [reps, setReps] = useState([]);
  const [objectivesWithProgress, setObjectivesWithProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [repsData, objectivesData] = await Promise.all([
        api.get("/team/mine"),
        api.get("/objectives"),
      ]);
      setReps(repsData);

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

  function sumTargetAchieved(list) {
    return list.reduce(
      (acc, o) => ({
        target: acc.target + Number(o.targetAmount),
        achieved: acc.achieved + (o.progress ? Number(o.progress.achievedAmount) : 0),
      }),
      { target: 0, achieved: 0 }
    );
  }

  const teamCa = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "CHIFFRE_AFFAIRES"));
  const teamPrecommande = sumTargetAchieved(objectivesWithProgress.filter((o) => o.type === "PRECOMMANDE"));
  const teamCaPct = teamCa.target > 0 ? Math.min(100, Math.round((teamCa.achieved / teamCa.target) * 100)) : 0;

  return (
    <>
      <h1 className="page-title">{t("equipe.title")}</h1>
      <p className="page-sub">{t("equipe.subtitle")}</p>

      {loading && <p className="empty-state">{t("equipe.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && reps.length > 0 && (
        <div className="cards-row">
          <div className="stat-card">
            <div className="stat-label">{t("equipe.statCa")}</div>
            <div className="stat-value">
              {money(teamCa.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamCa.target, locale)}</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${teamCaPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("equipe.statPrecommande")}</div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>
              {money(teamPrecommande.achieved, locale)}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}> / {money(teamPrecommande.target, locale)}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{t("equipe.statReps")}</div>
            <div className="stat-value">{reps.length}</div>
          </div>
        </div>
      )}

      {!loading && !error && reps.length === 0 && <p className="empty-state">{t("equipe.empty")}</p>}

      {!loading && !error && reps.length > 0 && (
        <div className="panel">
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
                    <Globe size={11} /> {r.email}
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

      {!loading && !error && reps.length > 0 && (
        <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 10 }}>{t("equipe.readOnlyHint")}</p>
      )}
    </>
  );
}
