import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import { LOCALES, LOCALE_LABEL } from "../i18n/translations.js";
import NotificationBell from "./NotificationBell.jsx";
import OfflineBanner from "./OfflineBanner.jsx";
import logo from "../assets/moken-logo.png";

// Structure commune à tout l'appli connectée : sidebar desktop / barre de
// navigation basse mobile (cf. styles.css, règles reprises de la maquette
// docs/prototype-crm-commercial.jsx). Remplace l'ancienne topbar à ligne
// unique qui débordait sur petit écran (identité + déconnexion écrasées).
//
// Déconnexion et notifications sont volontairement dans la même rangée que
// le logo (icônes seules, toujours visibles) plutôt que dans le bloc
// identité du bas — qui, lui, est masqué sur mobile comme dans la maquette
// (.user-chip { display:none } sous 680px). La maquette originale n'avait
// pas de vraie déconnexion à placer (c'est une démo à bascule de rôle) ;
// ce choix comble ce trou fonctionnel sans réintroduire le débordement.
//
// navItems : [{ to, label, icon: ComposantLucide, badge? }] — propre à
// chaque rôle, défini par l'appelant (cf. App.jsx).
export default function AppShell({ navItems }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const roleLabel = t(`role.${user.role}`);

  return (
    <div className="shell">
      <div className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="Moken" />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <NotificationBell />
            <div className="sidebar-lang">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  className={locale === l ? "active" : ""}
                  onClick={() => setLocale(l)}
                  aria-label={LOCALE_LABEL[l]}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className="sidebar-lang"
              style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, padding: "5px 6px", cursor: "pointer", color: "#b7becb", display: "flex" }}
              onClick={logout}
              aria-label={t("logout")}
              title={t("logout")}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

        {navItems.length > 0 && (
          <div className={`nav ${navItems.length > 5 ? "nav-dense" : ""}`}>
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
                <item.icon size={16} />
                <span className="nav-label">{item.label}</span>
                {!!item.badge && <span className="nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        )}

        <div className="user-chip">
          <span>
            {user.firstName} {user.lastName} · {roleLabel}
          </span>
        </div>
      </div>

      <div className="shell-main">
        <OfflineBanner />
        <Outlet />
      </div>
    </div>
  );
}
