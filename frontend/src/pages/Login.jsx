import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { LOCALES, LOCALE_LABEL } from "../i18n/translations.js";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";

// Bascule interne simple entre login / mot de passe oublié / réinitialisation
// plutôt qu'un vrai routeur : le reste de l'app n'a pas encore de routing
// (une seule page à la fois selon le rôle), donc introduire react-router-dom
// ici aurait été disproportionné pour ce chantier — à revoir quand le portail
// (plusieurs écrans, navigation) sera construit.
export default function Login() {
  const { login } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const initialResetToken = new URLSearchParams(window.location.search).get("reset_token") || "";
  const [mode, setMode] = useState(initialResetToken ? "reset" : "login");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "forgot") {
    return <ForgotPassword onBack={() => setMode("login")} />;
  }
  if (mode === "reset") {
    return (
      <ResetPassword
        initialToken={initialResetToken}
        onDone={() => {
          // On retire le jeton de l'URL pour ne pas le laisser traîner dans
          // l'historique du navigateur une fois utilisé.
          window.history.replaceState({}, "", window.location.pathname);
          setMode("login");
        }}
      />
    );
  }

  return (
    <div className="login-shell">
      <select
        className="lang-switch"
        style={{ alignSelf: "flex-end", marginBottom: 8 }}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        aria-label="Langue / Language / Idioma"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABEL[l]}
          </option>
        ))}
      </select>
      <h1>{t("login.title")}</h1>
      <p>{t("login.subtitle")}</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{t("login.email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.emailPlaceholder")}
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label>{t("login.password")}</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ paddingRight: 38 }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-soft)",
                padding: 6,
                display: "flex",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit" disabled={submitting} style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? t("login.submitting") : t("login.submit")}
        </button>
        <button
          type="button"
          className="btn-link"
          onClick={() => setMode("forgot")}
          style={{ marginTop: 12, width: "100%" }}
        >
          {t("login.forgotPassword")}
        </button>
      </form>
    </div>
  );
}
