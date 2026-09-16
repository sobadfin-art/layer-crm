import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { LOCALES, LOCALE_LABEL } from "../i18n/translations.js";
import ForgotPassword from "./ForgotPassword.jsx";
import ResetPassword from "./ResetPassword.jsx";
import logo from "../assets/moken-logo.png";

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

  // Visuel d'intro (correctif 2026-09-16, demande directe : "rajoute sur
  // l'intro de l'appli ce visuel en responsive. tout doit etre visible. log
  // in au milieu") : reconstruit en HTML/CSS (texte réel, pas une image
  // figée) plutôt qu'en insérant le PDF/visuel fourni tel quel — un texte
  // reste net et se redimensionne proprement à toutes les tailles d'écran
  // (clamp() sur les polices), alors qu'une image plein cadre se serait soit
  // recadrée, soit aurait laissée des bandes vides selon le ratio de l'écran,
  // ce qui aurait contredit l'exigence "tout doit être visible". Couleurs et
  // mise en page (accroche calée à gauche, logo centré en bas) reprises du
  // visuel fourni (fond #FDEE93, encre #042D13) ; le login reste au centre
  // (zone naturellement vide du visuel d'origine, entre l'accroche et le
  // logo). Englobe les trois écrans (connexion / mot de passe oublié /
  // réinitialisation) pour que le visuel reste présent tout au long du
  // parcours "avant connexion" — jamais affiché une fois connecté
  // (AppShell.jsx, inchangé, garde son propre en-tête).
  let content;
  if (mode === "forgot") {
    content = <ForgotPassword onBack={() => setMode("login")} />;
  } else if (mode === "reset") {
    content = (
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
  } else {
    content = (
      <div className="login-shell">
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

  return (
    <div className="auth-poster">
      <div className="auth-poster-inner">
        <div className="auth-poster-top">
          <select
            className="lang-switch auth-poster-lang"
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
          {/* Correctif 2026-09-16 (référence image fournie directement, "reprend
              exactement le modele de reference, ne fait pas d'interpretation") :
              le modèle de référence n'a pas de ligne "Now," — seulement ces deux
              lignes. Retiré en conséquence. */}
          <h2 className="auth-poster-headline">
            Let&rsquo;s make
            <br />
            millions.
          </h2>
        </div>

        <div className="auth-poster-middle">{content}</div>

        <div className="auth-poster-bottom">
          {/* Modèle de référence : pas de parenthèses, texte droit (non
              italique) — cf. commentaire sur le headline plus haut. */}
          <p className="auth-poster-tagline">So we can surf a million waves together.</p>
          <img className="auth-poster-logo" src={logo} alt="Moken — Organic Eyewear" />
        </div>
      </div>
    </div>
  );
}
