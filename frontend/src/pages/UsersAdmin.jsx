import { useCallback, useEffect, useState } from "react";
import { KeyRound, ShieldAlert, UserPlus } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { dateTime } from "../lib/format.js";

// Écran "Utilisateurs" — administration générale des comptes (tous rôles),
// réservé au directeur, branché sur /api/admin/users (routes/admin-users.js).
// Volontairement DISTINCT de TeamManagement.jsx (qui couvre uniquement
// représentants/Master Reps via /api/team) : ici, création de FRONT_DESK et
// ADMINISTRATEUR (les deux seuls rôles créables par cette route), changement
// de rôle encadré, activation/désactivation, réinitialisation forcée de mot
// de passe. Le rôle DIRECTEUR n'est ni créable ni modifiable ici (cf.
// commentaire en tête du fichier backend) — ses lignes s'affichent en lecture
// seule dans la liste, sans aucune action disponible.
//
// Un mot de passe temporaire n'est communiqué qu'UNE SEULE FOIS, dans la
// réponse HTTP de création/réinitialisation (jamais journalisé, jamais
// récupérable ensuite) — affiché ici dans un encart explicite avec avertissement,
// pas de bouton "copier" presse-papier pour rester simple (pas de nouvelle
// dépendance), l'utilisateur sélectionne/copie le texte lui-même.
const MANAGEABLE_ROLES = ["REPRESENTANT", "MASTER_REP", "FRONT_DESK", "ADMINISTRATEUR"];
const CREATABLE_ROLES = ["FRONT_DESK", "ADMINISTRATEUR"];

export default function UsersAdmin() {
  const { t, locale } = useI18n();
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);
  const [tempPasswordInfo, setTempPasswordInfo] = useState(null); // { email, password }

  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ email: "", firstName: "", lastName: "", role: "FRONT_DESK" });
  const [creating, setCreating] = useState(false);
  const [newUserError, setNewUserError] = useState(null);

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

  async function handleCreateUser(e) {
    e.preventDefault();
    setNewUserError(null);
    if (!newUserForm.email.trim() || !newUserForm.firstName.trim() || !newUserForm.lastName.trim()) {
      setNewUserError(t("usersAdmin.newUserMissing"));
      return;
    }
    setCreating(true);
    try {
      const created = await api.post("/admin/users", {
        email: newUserForm.email.trim(),
        firstName: newUserForm.firstName.trim(),
        lastName: newUserForm.lastName.trim(),
        role: newUserForm.role,
      });
      setNewUserForm({ email: "", firstName: "", lastName: "", role: "FRONT_DESK" });
      setShowNewUser(false);
      setTempPasswordInfo({ email: created.email, password: created.temporaryPassword });
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
            <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>{t("usersAdmin.newUserPasswordHint")}</p>
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
