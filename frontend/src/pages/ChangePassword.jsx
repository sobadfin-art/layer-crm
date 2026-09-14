import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { validatePasswordClientSide } from "../lib/passwordCheck.js";

// Écran de changement de mot de passe.
//
// Utilisé dans deux contextes :
//  - forcé (forced=true) : compte créé par un administrateur, must_change_password
//    encore vrai. App.jsx affiche cet écran à la place de l'app tant que
//    l'utilisateur n'a pas changé son mot de passe — et le backend refuse
//    aussi toute autre route tant que c'est le cas (requireAuth), donc ce
//    n'est pas qu'une contrainte d'interface.
//  - volontaire : accessible plus tard depuis un menu "Mon compte" (à
//    brancher lors de la construction du portail — non fait ici pour ne pas
//    élargir le périmètre de ce chantier).
export default function ChangePassword({ forced = false, onSuccess }) {
  const { clearMustChangePassword } = useAuth();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t("changePassword.mismatch"));
      return;
    }
    const localCheck = validatePasswordClientSide(newPassword);
    if (!localCheck.ok) {
      setError(localCheck.error);
      return;
    }
    setSubmitting(true);
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      clearMustChangePassword();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <h1>{t("changePassword.title")}</h1>
      <p>{forced ? t("changePassword.subtitle") : t("changePassword.subtitleVoluntary")}</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{t("changePassword.current")}</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label>{t("changePassword.new")}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <small>{t("changePassword.hint")}</small>
        </div>
        <div className="field">
          <label>{t("changePassword.confirm")}</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button
          className="btn primary"
          type="submit"
          disabled={submitting}
          style={{ width: "100%", justifyContent: "center" }}
        >
          {submitting ? t("changePassword.submitting") : t("changePassword.submit")}
        </button>
      </form>
    </div>
  );
}
