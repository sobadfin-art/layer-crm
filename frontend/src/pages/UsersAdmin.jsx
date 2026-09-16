import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldAlert, UserPlus } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime } from "../lib/format.js";

// Écran "Utilisateurs" — administration générale des comptes (tous rôles),
// réservé au directeur.
//
// CORRECTIF (fiche corrective "Direction Commerciale + Représentant + Règles
// de remise", section 1 : "l'écran actuel de création d'utilisateur (côté
// Direction Commerciale) est trop limité ... il faut ajouter un champ RÔLE
// avec au minimum : Représentant, Master Rep, Front Desk, Administrateur")
// — ce formulaire de création couvre désormais les 4 rôles depuis ce même
// écran, au lieu de se limiter à Front Desk/Administrateur. Le rôle
// sélectionné détermine réellement les droits (jamais de création
// "Administrateur par défaut" — section 1, "IMPORTANT" du cahier des
// charges) : selon le rôle choisi, la création est routée vers la bonne
// route backend, EXACTEMENT comme si elle avait été faite depuis l'écran
// dédié :
//   - REPRESENTANT / MASTER_REP → POST /api/team/members (routes/team.js),
//     avec mot de passe initial saisi par le directeur, rattachement Master
//     Rep (pour un représentant) et Pays/Territoire (section 1 : "ajouter
//     également obligatoirement : PAYS/TERRITOIRE" pour les profils
//     commerciaux) — obligatoire pour ces deux rôles.
//   - FRONT_DESK / ADMINISTRATEUR → POST /api/admin/users
//     (routes/admin-users.js), mot de passe temporaire auto-généré, comme
//     avant.
// Les deux routes backend restent délibérément séparées (cf. commentaire en
// tête du fichier backend admin-users.js — "pour qu'une route nommée
// team/members ne modifie jamais silencieusement un DIRECTEUR/FRONT_DESK/
// ADMINISTRATEUR") : cet écran ne fait qu'appeler l'une ou l'autre selon le
// rôle choisi, il ne les fusionne pas. TeamManagement.jsx (écran "Équipe",
// /equipe) reste pleinement fonctionnel et inchangé — cet écran-ci est un
// second point d'entrée vers la même création de représentant/Master Rep,
// pas un remplacement.
//
// Changement de rôle encadré, activation/désactivation, réinitialisation
// forcée de mot de passe. Le rôle DIRECTEUR n'est ni créable ni modifiable
// ici (cf. commentaire en tête du fichier backend) — ses lignes s'affichent
// en lecture seule dans la liste, sans aucune action disponible.
//
// Un mot de passe temporaire (Front Desk/Administrateur) n'est communiqué
// qu'UNE SEULE FOIS, dans la réponse HTTP de création/réinitialisation
// (jamais journalisé, jamais récupérable ensuite) — affiché ici dans un
// encart explicite avec avertissement, pas de bouton "copier" presse-papier
// pour rester simple (pas de nouvelle dépendance), l'utilisateur
// sélectionne/copie le texte lui-même.
const MANAGEABLE_ROLES = ["REPRESENTANT", "MASTER_REP", "FRONT_DESK", "ADMINISTRATEUR"];
const CREATABLE_ROLES = ["REPRESENTANT", "MASTER_REP", "FRONT_DESK", "ADMINISTRATEUR"];
// Rôles "commerciaux" : créés via /api/team/members, nécessitent un mot de
// passe initial saisi par le directeur ainsi qu'un Pays/Territoire.
const COMMERCIAL_ROLES = ["REPRESENTANT", "MASTER_REP"];

export default function UsersAdmin() {
  const { t, locale } = useI18n();
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  // Décluttering (demande directe, 2026-09-16 : nettoyage des comptes de démo
  // — "trop d'élément" une fois les comptes désactivés) : l'écran s'ouvre
  // désormais filtré sur "Actifs" par défaut plutôt que "Tous" — le filtre
  // existant permet toujours de repasser sur "Tous"/"Désactivés" en un clic,
  // rien n'est retiré, seul le réglage d'ouverture change.
  const [activeFilter, setActiveFilter] = useState("true");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null); // { email, password }

  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "REPRESENTANT",
    password: "",
    masterRepUserId: "",
    territoryIds: [],
  });
  const [creating, setCreating] = useState(false);
  const [newUserError, setNewUserError] = useState(null);

  // Territoires (Pays/Territoire) + membres d'équipe existants (pour le
  // sélecteur Master Rep) — chargés indépendamment de roleFilter/activeFilter
  // ci-dessus (qui ne filtrent que la LISTE affichée), pour que le formulaire
  // de création dispose toujours des Master Reps même si la liste est
  // actuellement filtrée sur un autre rôle.
  const [territories, setTerritories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  const loadTeamData = useCallback(async () => {
    try {
      const [terr, members] = await Promise.all([api.get("/team/territories"), api.get("/team/members")]);
      setTerritories(terr);
      setTeamMembers(members);
    } catch {
      // Non bloquant : n'alimente que le formulaire de création représentant/Master Rep.
    }
  }, []);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const masterReps = teamMembers.filter((m) => m.role === "MASTER_REP" && m.active);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (activeFilter !== "all") params.set("active", activeFilter);
      const qs = params.toString();
      const data = await api.get(`/admin/users${qs ? `?${qs}` : ""}`);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  function resetNewUserForm() {
    setNewUserForm({ email: "", firstName: "", lastName: "", role: "REPRESENTANT", password: "", masterRepUserId: "", territoryIds: [] });
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setNewUserError(null);
    if (!newUserForm.email.trim() || !newUserForm.firstName.trim() || !newUserForm.lastName.trim()) {
      setNewUserError(t("usersAdmin.newUserMissing"));
      return;
    }
    const isCommercial = COMMERCIAL_ROLES.includes(newUserForm.role);
    if (isCommercial) {
      if (newUserForm.password.length < 8) {
        setNewUserError(t("teamManagement.newMemberPasswordShort"));
        return;
      }
      if (newUserForm.territoryIds.length === 0) {
        setNewUserError(t("usersAdmin.newUserTerritoryMissing"));
        return;
      }
    }
    setCreating(true);
    try {
      if (isCommercial) {
        // REPRESENTANT / MASTER_REP : même route et mêmes règles que l'écran
        // Équipe (TeamManagement.jsx) — le rôle choisi détermine réellement
        // les droits, jamais de repli sur Administrateur (section 1 du
        // cahier des charges).
        await api.post("/team/members", {
          email: newUserForm.email.trim(),
          firstName: newUserForm.firstName.trim(),
          lastName: newUserForm.lastName.trim(),
          role: newUserForm.role,
          password: newUserForm.password,
          masterRepUserId: newUserForm.role === "REPRESENTANT" && newUserForm.masterRepUserId ? newUserForm.masterRepUserId : undefined,
          territoryIds: newUserForm.territoryIds,
        });
        setToast(t("teamManagement.memberCreated"));
        await loadTeamData();
      } else {
        const created = await api.post("/admin/users", {
          email: newUserForm.email.trim(),
          firstName: newUserForm.firstName.trim(),
          lastName: newUserForm.lastName.trim(),
          role: newUserForm.role,
        });
        setTempPasswordInfo({ email: created.email, password: created.temporaryPassword });
      }
      resetNewUserForm();
      setShowNewUser(false);
      await load();
    } catch (err) {
      setNewUserError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u) {
    setBusyId(u.id);
    try {
      await api.patch(`/admin/users/${u.id}/${u.active ? "deactivate" : "reactivate"}`, {});
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(u, role) {
    if (role === u.role) return;
    setBusyId(u.id);
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role });
      setToast(t("usersAdmin.roleChanged"));
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function forceReset(u) {
    setBusyId(u.id);
    try {
      const result = await api.post(`/admin/users/${u.id}/force-password-reset`, {});
      setTempPasswordInfo({ email: u.email, password: result.temporaryPassword });
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="page-title">{t("usersAdmin.title")}</h1>
          <p className="page-sub">{t("usersAdmin.subtitle")}</p>
        </div>
        <button className="btn primary" onClick={() => setShowNewUser((v) => !v)}>
          <UserPlus size={15} /> {t("usersAdmin.newUser")}
        </button>
      </div>

      {tempPasswordInfo && (
        <div className="panel" style={{ borderColor: "var(--gold)" }}>
          <h3>
            <ShieldAlert size={14} /> {t("usersAdmin.tempPasswordTitle")}
          </h3>
          <p style={{ fontSize: 12.5 }}>{t("usersAdmin.tempPasswordHint", { email: tempPasswordInfo.email })}</p>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 16,
              fontWeight: 700,
              background: "var(--butter, #faf6ec)",
              padding: "8px 12px",
              borderRadius: 6,
              userSelect: "all",
              width: "fit-content",
            }}
          >
            {tempPasswordInfo.password}
          </p>
          <button className="btn outline" onClick={() => setTempPasswordInfo(null)}>
            {t("usersAdmin.tempPasswordDismiss")}
          </button>
        </div>
      )}

      {showNewUser && (
        <div className="panel">
          <h3>{t("usersAdmin.newUserTitle")}</h3>
          <form onSubmit={handleCreateUser}>
            <div className="cat-tabs" style={{ marginBottom: 10 }}>
              {CREATABLE_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`cat-tab ${newUserForm.role === r ? "active" : ""}`}
                  onClick={() => setNewUserForm((f) => ({ ...f, role: r }))}
                >
                  {t(`role.${r}`)}
                </button>
              ))}
            </div>
            <div className="form-row">
              <div className="field">
                <label>{t("teamManagement.firstName")}</label>
                <input value={newUserForm.firstName} onChange={(e) => setNewUserForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="field">
                <label>{t("teamManagement.lastName")}</label>
                <input value={newUserForm.lastName} onChange={(e) => setNewUserForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>{t("teamManagement.email")}</label>
              <input type="email" value={newUserForm.email} onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))} />
            </div>

            {COMMERCIAL_ROLES.includes(newUserForm.role) ? (
              <>
                <div className="field">
                  <label>{t("teamManagement.initialPassword")}</label>
                  <input
                    type="password"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{t("teamManagement.initialPasswordHint")}</span>
                </div>
                {newUserForm.role === "REPRESENTANT" && (
                  <div className="field">
                    <label>{t("teamManagement.masterRepLabel")}</label>
                    <select
                      value={newUserForm.masterRepUserId}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, masterRepUserId: e.target.value }))}
                    >
                      <option value="">{t("teamManagement.noMasterRep")}</option>
                      {masterReps.map((mr) => (
                        <option key={mr.id} value={mr.id}>
                          {mr.firstName} {mr.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field">
                  <label>{t("usersAdmin.countryTerritoryLabel")}</label>
                  <div className="cat-tabs" style={{ marginTop: 4 }}>
                    {territories.map((terr) => {
                      const active = newUserForm.territoryIds.includes(terr.id);
                      return (
                        <span
                          key={terr.id}
                          className="typology-badge"
                          style={{
                            cursor: "pointer",
                            background: active ? "var(--teal-soft, #d7ece7)" : undefined,
                          }}
                          onClick={() =>
                            setNewUserForm((f) => ({
                              ...f,
                              territoryIds: f.territoryIds.includes(terr.id)
                                ? f.territoryIds.filter((x) => x !== terr.id)
                                : [...f.territoryIds, terr.id],
                            }))
                          }
                        >
                          {terr.name}
                        </span>
                      );
                    })}
                  </div>
                  {territories.length === 0 && (
                    <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{t("usersAdmin.noTerritoriesHint")}</p>
                  )}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{t("usersAdmin.newUserPasswordHint")}</p>
            )}
            {newUserError && <p className="error-text">{newUserError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn primary" type="submit" disabled={creating}>
                {creating ? t("teamManagement.creating") : t("teamManagement.create")}
              </button>
              <button className="btn outline" type="button" onClick={() => setShowNewUser(false)}>
                {t("teamManagement.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-row">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">{t("usersAdmin.filterAllRoles")}</option>
          <option value="REPRESENTANT">{t("role.REPRESENTANT")}</option>
          <option value="MASTER_REP">{t("role.MASTER_REP")}</option>
          <option value="FRONT_DESK">{t("role.FRONT_DESK")}</option>
          <option value="DIRECTEUR">{t("role.DIRECTEUR")}</option>
          <option value="ADMINISTRATEUR">{t("role.ADMINISTRATEUR")}</option>
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
          <option value="all">{t("usersAdmin.filterAllStatus")}</option>
          <option value="true">{t("usersAdmin.filterActive")}</option>
          <option value="false">{t("usersAdmin.filterInactive")}</option>
        </select>
      </div>

      {loading && <p className="empty-state">{t("usersAdmin.loading")}</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && users.length === 0 && <p className="empty-state">{t("usersAdmin.empty")}</p>}

      <div className="panel">
        {users.map((u) => {
          const busy = busyId === u.id;
          const isSelf = u.id === me.id;
          const isDirecteur = u.role === "DIRECTEUR";
          const locked = isSelf || isDirecteur;
          return (
            <div className="task-row" style={{ alignItems: "flex-start" }} key={u.id}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong>
                    {u.firstName} {u.lastName}
                  </strong>
                  <span className="typology-badge">{t(`role.${u.role}`)}</span>
                  {!u.active && (
                    <span className="typology-badge" style={{ color: "var(--danger)" }}>
                      {t("teamManagement.inactive")}
                    </span>
                  )}
                  {u.mustChangePassword && (
                    <span className="typology-badge">{t("usersAdmin.mustChangePassword")}</span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 2 }}>
                  {u.email} · {t("usersAdmin.createdAt", { date: dateTime(u.createdAt, locale) })}
                </div>
                {!locked && MANAGEABLE_ROLES.includes(u.role) && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: "var(--ink-soft)" }}>{t("usersAdmin.changeRole")}</span>
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => changeRole(u, e.target.value)}
                      style={{ padding: "4px 6px", border: "1px solid var(--line)", borderRadius: 5, fontSize: 12, fontFamily: "inherit" }}
                    >
                      {MANAGEABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {!locked && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button className="btn outline" disabled={busy} onClick={() => forceReset(u)}>
                    <KeyRound size={13} /> {t("usersAdmin.forceReset")}
                  </button>
                  <button className="btn outline" disabled={busy} onClick={() => toggleActive(u)}>
                    {u.active ? t("teamManagement.deactivate") : t("teamManagement.reactivate")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
