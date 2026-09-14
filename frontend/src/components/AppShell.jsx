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
// Déconnexion : un vrai bouton texte+icône dans le bloc identité du bas
// (.user-chip), sous le nom/rôle — plus visible qu'une icône perdue parmi
// la cloche et les 3 boutons de langue. Cette rangée du haut (logo + cloche
// + langue) est déjà serrée sur les 210px de la sidebar desktop ; y ajouter
// la déconnexion la faisait déborder hors de la sidebar, par-dessus le
// contenu principal — au point de rendre le bouton in-cliquable (retour
// utilisateur : "impossibilité de se déconnecter"). Sur mobile, où
// .user-chip est masqué (largeur limitée, cf. règle plus bas), on garde une
// icône compacte dans cette rangée du haut : il y a assez de place sur la
// largeur pleine d'un téléphone pour ne pas reproduire le débordement
// desktop (cf. classe .logout-mobile-only, visible seulement sous 680px).
//
// Cloche de notifications : même famille de bug (retour utilisateur : icône
// mal positionnée en responsive, panneau inaccessible au clic). Le logo +
// la cloche + les 3 boutons de langue ne tiennent pas côte à côte sur les
// 210px de la sidebar une fois les marges internes retirées — ils débordent
// hors de la sidebar plutôt que de passer à la ligne (cf. .sidebar-brand,
// flex-wrap ajouté dans styles.css). Une fois la cloche correctement
// positionnée par ce retour à la ligne, son panneau (positionné en absolu
// par rapport à elle, cf. .notif-panel) s'ouvre au bon endroit.
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
              className="sidebar-lang logout-mobile-only"
              style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 3, padding: "5px 6px", cursor: "pointer", color: "#b7becb" }}
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
          <button className="user-chip-logout" onClick={logout}>
            <LogOut size={14} />
            {t("logout")}
          </button>
        </div>
      </div>

      <div className="shell-main">
        <OfflineBanner />
        <Outlet />
      </div>
    </div>
  );
}
