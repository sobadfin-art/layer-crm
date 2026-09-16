import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { money } from "../lib/format.js";

// Mêmes helpers que DirecteurDashboard.jsx (objectifs actifs + somme
// cible/réalisé) — reprises ici à l'identique pour le nouveau bloc
// "Performance de l'équipe" (fiche corrective Direction Commerciale V3 :
// "même source de données que le dashboard").
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

// "Mon équipe" du Master Rep (Equipe.jsx) est un écran de SUIVI en lecture
// seule sur SA propre équipe. Celui-ci est différent : c'est la GESTION
// complète de l'équipe commerciale de toute l'entreprise, réservée au
// directeur (section 3 : "gère l'équipe (reps + Master Reps)") — création de
// représentants/Master Reps, rattachement à un Master Rep, affectation de
// territoires, activation/désactivation. Routes dédiées et distinctes de
// admin-users.js (qui couvre front desk/administrateur, jamais les rôles
// d'équipe commerciale — cf. commentaire en tête de ce fichier backend).
export default function TeamManagement() {
  const { t, locale } = useI18n();
  const [members, setMembers] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [countries, setCountries] = useState([]);
  // Objectifs actifs + progression — alimente le nouveau bloc "Performance de
  // l'équipe" ci-dessous (fiche corrective Direction Commerciale V3).
  const [objectivesWithProgress, setObjectivesWithProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [showNewMember, setShowNewMember] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState("REPRESENTANT");
  const [newMemberForm, setNewMemberForm] = useState({ email: "", firstName: "", lastName: "", password: "", masterRepUserId: "", territoryIds: [] });
  const [creatingMember, setCreatingMember] = useState(false);
  const [newMemberError, setNewMemberError] = useState(null);

  const [showNewTerritory, setShowNewTerritory] = useState(false);
  const [newTerritoryForm, setNewTerritoryForm] = useState({ name: "", countryCodes: [] });
  const [creatingTerritory, setCreatingTerritory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersData, territoriesData, countriesData, objectivesData] = await Promise.all([
        api.get("/team/members"),
        api.get("/team/territories"),
        api.get("/countries"),
        api.get("/objectives"),
      ]);
      setMembers(membersData);
      setTerritories(territoriesData);
      setCountries(countriesData);

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

  const masterReps = members.filter((m) => m.role === "MASTER_REP");
  const reps = members.filter((m) => m.role === "REPRESENTANT");
  const unassignedReps = reps.filter((r) => !r.masterRepId);

  async function toggleActive(member) {
    setBusyId(member.id);
    try {
      await api.patch(`/team/members/${member.id}`, { active: !member.active });
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changeMasterRep(rep, masterRepUserId) {
    setBusyId(rep.id);
    try {
      await api.patch(`/team/members/${rep.id}`, { masterRepUserId: masterRepUserId || null });
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTerritory(member, territoryId) {
    const current = member.territoryIds || [];
    const next = current.includes(territoryId) ? current.filter((id) => id !== territoryId) : [...current, territoryId];
    setBusyId(member.id);
    try {
      await api.patch(`/team/members/${member.id}`, { territoryIds: next });
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateMember(e) {
    e.preventDefault();
    setNewMemberError(null);
    if (!newMemberForm.email.trim() || !newMemberForm.firstName.trim() || !newMemberForm.lastName.trim()) {
      setNewMemberError(t("teamManagement.newMemberMissing"));
      return;
    }
    if (newMemberForm.password.length < 8) {
      setNewMemberError(t("teamManagement.newMemberPasswordShort"));
      return;
    }
    setCreatingMember(true);
    try {
      await api.post("/team/members", {
        email: newMemberForm.email.trim(),
        firstName: newMemberForm.firstName.trim(),
        lastName: newMemberForm.lastName.trim(),
        role: newMemberRole,
        password: newMemberForm.password,
        masterRepUserId: newMemberRole === "REPRESENTANT" && newMemberForm.masterRepUserId ? newMemberForm.masterRepUserId : undefined,
        territoryIds: newMemberForm.territoryIds,
      });
      setNewMemberForm({ email: "", firstName: "", lastName: "", password: "", masterRepUserId: "", territoryIds: [] });
      setShowNewMember(false);
      setToast(t("teamManagement.memberCreated"));
      await load();
    } catch (err) {
      setNewMemberError(err.message);
    } finally {
      setCreatingMember(false);
    }
  }

  async function handleCreateTerritory(e) {
    e.preventDefault();
    if (!newTerritoryForm.name.trim()) return;
    setCreatingTerritory(true);
    try {
      await api.post("/team/territories", newTerritoryForm);
      setNewTerritoryForm({ name: "", countryCodes: [] });
      setShowNewTerritory(false);
      setToast(t("teamManagement.territoryCreated"));
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setCreatingTerritory(false);
    }
  }

  function toggleFormTerritory(id) {
    setNewMemberForm((f) => ({
      ...f,
      territoryIds: f.territoryIds.includes(id) ? f.territoryIds.filter((x) => x !== id) : [...f.territoryIds, id],
    }));
  }

  function toggleFormCountry(code) {
    setNewTerritoryForm((f) => ({
      ...f,
      countryCodes: f.countryCodes.includes(code) ? f.countryCodes.filter((x) => x !== code) : [...f.countryCodes, code],
    }));
  }

  function MemberRow({ member, indent }) {
    const busy = busyId === member.id;
    return (
      <div className="task-row" style={{ alignItems: "flex-start", paddingLeft: indent ? 20 : 0 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {indent && <span style={{ color: "var(--ink-soft)" }}>↳</span>}
            <strong>{member.firstName} {member.lastName}</strong>
            <span className="typology-badge">{t(`role.${member.role}`)}</span>
            {!member.active && <span className="typology-badge" style={{ color: "var(--danger)" }}>{t("teamManagement.inactive")}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>{member.email}</div>
          {member.role === "REPRESENTANT" && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "var(--ink-soft)" }}>{t("teamManagement.masterRepLabel")}</span>
              <select
                value={member.masterRepId || ""}
                disabled={busy}
                onChange={(e) => changeMasterRep(member, e.target.value)}
                style={{ padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
              >
                <option value="">{t("teamManagement.noMasterRep")}</option>
                {masterReps.map((mr) => (
                  <option key={mr.id} value={mr.id}>{mr.firstName} {mr.lastName}</option>
                ))}
              </select>
            </div>
          )}
          {territories.length > 0 && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <span style={{ color: "var(--ink-soft)", fontSize: 11.5 }}>{t("teamManagement.territoriesLabel")}</span>
              {territories.map((terr) => {
                const active = (member.territoryIds || []).includes(terr.id);
                return (
                  <span
                    key={terr.id}
                    className="typology-badge"
                    style={{
                      cursor: busy ? "default" : "pointer",
                      background: active ? "var(--teal-soft, #d7ece7)" : undefined,
                      opacity: busy ? 0.6 : 1,
                    }}
                    onClick={() => !busy && toggleTerritory(member, terr.id)}
                  >
                    {terr.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <button className="btn outline" disabled={busy} onClick={() => toggleActive(member)}>
          {member.active ? t("teamManagement.deactivate") : t("teamManagement.reactivate")}
        </button>
      </div>
    );
  }

  function objectivesFor(repId, type) {
    return objectivesWithProgress.filter((o) => o.repId === repId && o.type === type);
  }

  // Ligne "Performance de l'équipe" (fiche corrective Direction Commerciale
  // V3 : "par représentant : nom, territoire, CA, objectif, progression —
  // même source de données que le dashboard") — reprend exactement le calcul
  // de MemberPerfRow dans DirecteurDashboard.jsx, avec le(s) territoire(s) en
  // plus (déjà disponibles ici, pas sur le dashboard).
  function TeamPerfRow({ member, indent }) {
    const caObjectives = objectivesFor(member.id, "CHIFFRE_AFFAIRES");
    const repCa = sumTargetAchieved(caObjectives);
    const repCaPct = repCa.target > 0 ? Math.min(100, Math.round((repCa.achieved / repCa.target) * 100)) : 0;
    const memberTerritories = territories.filter((terr) => (member.territoryIds || []).includes(terr.id));
    return (
      <div className="account-row" style={{ paddingLeft: indent ? 20 : 0 }}>
        <div>
          <div className="account-name">
            {indent && <span style={{ color: "var(--ink-soft)", marginRight: 4 }}>↳</span>}
            {member.firstName} {member.lastName}
          </div>
          <div className="account-meta">
            {memberTerritories.length > 0 ? memberTerritories.map((terr) => terr.name).join(", ") : t("teamManagement.noTerritory")}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }}>
          {caObjectives.length > 0 ? (
            <div style={{ fontWeight: 700 }}>
              {money(repCa.achieved, locale)}
              <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}> / {money(repCa.target, locale)}</span>
            </div>
          ) : (
            <span style={{ color: "var(--ink-soft)" }}>{t("teamManagement.noActiveObjective")}</span>
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
          <h1 className="page-title">{t("teamManagement.title")}</h1>
          <p className="page-sub">{t("teamManagement.subtitle")}</p>
        </div>
        <button className="btn primary" onClick={() => setShowNewMember((v) => !v)}>
          {t("teamManagement.newMember")}
        </button>
      </div>

      {loading && <p className="empty-state">{t("teamManagement.loading")}</p>}
      {error && <p className="error-text">{error}</p>}

      {showNewMember && (
        <div className="panel">
          <h3>{t("teamManagement.newMemberTitle")}</h3>
          <form onSubmit={handleCreateMember}>
            <div className="cat-tabs" style={{ marginBottom: 10 }}>
              <button type="button" className={`cat-tab ${newMemberRole === "REPRESENTANT" ? "active" : ""}`} onClick={() => setNewMemberRole("REPRESENTANT")}>
                {t("role.REPRESENTANT")}
              </button>
              <button type="button" className={`cat-tab ${newMemberRole === "MASTER_REP" ? "active" : ""}`} onClick={() => setNewMemberRole("MASTER_REP")}>
                {t("role.MASTER_REP")}
              </button>
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("teamManagement.firstName")}</label>
                <input value={newMemberForm.firstName} onChange={(e) => setNewMemberForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("teamManagement.lastName")}</label>
                <input value={newMemberForm.lastName} onChange={(e) => setNewMemberForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("teamManagement.email")}</label>
                <input type="email" value={newMemberForm.email} onChange={(e) => setNewMemberForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("teamManagement.initialPassword")}</label>
                <input
                  type="text"
                  value={newMemberForm.password}
                  onChange={(e) => setNewMemberForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t("teamManagement.initialPasswordHint")}
                />
              </div>
            </div>
            {newMemberRole === "REPRESENTANT" && (
              <div className="field">
                <label>{t("teamManagement.masterRepLabel")}</label>
                <select
                  value={newMemberForm.masterRepUserId}
                  onChange={(e) => setNewMemberForm((f) => ({ ...f, masterRepUserId: e.target.value }))}
                >
                  <option value="">{t("teamManagement.noMasterRep")}</option>
                  {masterReps.map((mr) => (
                    <option key={mr.id} value={mr.id}>{mr.firstName} {mr.lastName}</option>
                  ))}
                </select>
              </div>
            )}
            {territories.length > 0 && (
              <div className="field">
                <label>{t("teamManagement.territoriesLabel")}</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {territories.map((terr) => {
                    const active = newMemberForm.territoryIds.includes(terr.id);
                    return (
                      <span
                        key={terr.id}
                        className="typology-badge"
                        style={{ cursor: "pointer", background: active ? "var(--teal-soft, #d7ece7)" : undefined }}
                        onClick={() => toggleFormTerritory(terr.id)}
                      >
                        {terr.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {newMemberError && <p className="error-text">{newMemberError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn primary" type="submit" disabled={creatingMember}>
                {creatingMember ? t("teamManagement.creating") : t("teamManagement.create")}
              </button>
              <button className="btn outline" type="button" onClick={() => setShowNewMember(false)}>
                {t("teamManagement.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          <h3>{t("teamManagement.masterRepsTitle")}</h3>
          {masterReps.length === 0 && <p className="empty-state">{t("teamManagement.noMasterReps")}</p>}
          {masterReps.map((mr) => (
            <div key={mr.id}>
              <MemberRow member={mr} />
              {reps.filter((r) => r.masterRepId === mr.id).map((r) => (
                <MemberRow member={r} indent key={r.id} />
              ))}
            </div>
          ))}

          {unassignedReps.length > 0 && (
            <>
              <h3 style={{ marginTop: 18 }}>{t("teamManagement.unassignedRepsTitle")}</h3>
              {unassignedReps.map((r) => (
                <MemberRow member={r} key={r.id} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Performance de l'équipe — fiche corrective Direction Commerciale V3 :
          nouveau bloc sous la hiérarchie Master Rep/représentants ci-dessus,
          même source de données (objectifs actifs + progression) que le
          dashboard Directeur. */}
      {!loading && !error && (
        <div className="panel">
          <h3>{t("teamManagement.teamPerfTitle")}</h3>
          {members.length === 0 && <p className="empty-state">{t("teamManagement.noMasterReps")}</p>}
          {masterReps.map((mr) => (
            <div key={mr.id}>
              <TeamPerfRow member={mr} />
              {reps.filter((r) => r.masterRepId === mr.id).map((r) => (
                <TeamPerfRow member={r} indent key={r.id} />
              ))}
            </div>
          ))}
          {unassignedReps.map((r) => (
            <TeamPerfRow member={r} key={r.id} />
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>{t("teamManagement.territoriesTitle")}</h3>
            <button className="btn outline" onClick={() => setShowNewTerritory((v) => !v)}>
              {t("teamManagement.newTerritory")}
            </button>
          </div>

          {showNewTerritory && (
            <form onSubmit={handleCreateTerritory} style={{ marginTop: 12 }}>
              <div className="field">
                <label>{t("teamManagement.territoryName")}</label>
                <input value={newTerritoryForm.name} onChange={(e) => setNewTerritoryForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("teamManagement.territoryCountries")}</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {countries.map((c) => {
                    const active = newTerritoryForm.countryCodes.includes(c.code);
                    return (
                      <span
                        key={c.code}
                        className="typology-badge"
                        style={{ cursor: "pointer", background: active ? "var(--teal-soft, #d7ece7)" : undefined }}
                        onClick={() => toggleFormCountry(c.code)}
                      >
                        {c.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn primary" type="submit" disabled={creatingTerritory || !newTerritoryForm.name.trim()}>
                  {creatingTerritory ? t("teamManagement.creating") : t("teamManagement.create")}
                </button>
                <button className="btn outline" type="button" onClick={() => setShowNewTerritory(false)}>
                  {t("teamManagement.cancel")}
                </button>
              </div>
            </form>
          )}

          {territories.length === 0 && !showNewTerritory && <p className="empty-state">{t("teamManagement.noTerritories")}</p>}
          {territories.map((terr) => (
            <div className="task-row" key={terr.id}>
              <span>{terr.name}</span>
              <span style={{ color: "var(--ink-soft)" }}>{(terr.countryCodes || []).join(", ") || "—"}</span>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
