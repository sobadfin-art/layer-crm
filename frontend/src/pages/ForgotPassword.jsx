import { useState } from "react";
import { api } from "../api.js";
import { useI18n } from "../i18n/I18nContext.jsx";

// Écran "mot de passe oublié" — étape 1 (demande). Réponse toujours générique
// (cf. backend POST /api/auth/password-reset/request) : on ne révèle jamais si
// l'email existe. Pas d'envoi d'email réel dans ce projet pour l'instant (cf.
// README) : l'utilisateur doit contacter son directeur pour obtenir le jeton
// généré côté serveur, en attendant qu'un vrai fournisseur d'email soit
// branché.
export default function ForgotPassword({ onBack }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/auth/password-reset/request", { email });
    } catch {
      // Volontairement ignoré : la réponse backend est déjà générique, et une
      // erreur réseau ne doit rien révéler de plus qu'un succès silencieux.
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  return (
    <div className="login-shell">
      <h1>{t("forgotPassword.title")}</h1>
      {done ? (
        <>
          <p>{t("forgotPassword.genericNotice")}</p>
          <button className="btn outline" onClick={onBack} style={{ width: "100%", justifyContent: "center" }}>
            {t("login.backToLogin")}
          </button>
        </>
      ) : (
        <>
          <p>{t("forgotPassword.subtitle")}</p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>{t("forgotPassword.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <button
              className="btn primary"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={onBack}
              style={{ marginTop: 12, width: "100%" }}
            >
              {t("login.backToLogin")}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
