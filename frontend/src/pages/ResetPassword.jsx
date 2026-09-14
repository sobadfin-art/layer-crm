import { useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { validatePasswordClientSide } from "../lib/passwordCheck.js";

// Écran "mot de passe oublié" — étape 2 (confirmation avec le jeton). Le jeton
// est saisi/collé manuellement ici (pas de lien cliquable automatique tant
// qu'aucun envoi d'email réel n'est branché — cf. ForgotPassword.jsx et le
// README pour le détail de cette limitation assumée).
export default function ResetPassword({ initialToken = "", onDone }) {
  const { t } = useI18n();
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError(t("resetPassword.mismatch"));
      return;
    }
    const localCheck = validatePasswordClientSide(newPassword);
    if (!localCheck.ok) {
      setError(localCheck.error);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/password-reset/confirm", { token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <h1>{t("resetPassword.title")}</h1>
      {success ? (
        <>
          <p>{t("resetPassword.success")}</p>
          <button className="btn primary" onClick={onDone} style={{ width: "100%", justifyContent: "center" }}>
            {t("login.backToLogin")}
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t("resetPassword.token")}</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
            <small>{t("resetPassword.tokenHint")}</small>
          </div>
          <div className="field">
            <label>{t("resetPassword.new")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>{t("resetPassword.confirm")}</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button
            className="btn primary"
            type="submit"
            disabled={submitting}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
          </button>
          <button type="button" className="btn-link" onClick={onDone} style={{ marginTop: 12, width: "100%" }}>
            {t("login.backToLogin")}
          </button>
        </form>
      )}
    </div>
  );
}
