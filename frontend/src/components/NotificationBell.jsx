import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useAuth } from "../AuthContext.jsx";

// Détermine où ouvrir directement l'élément concerné par une notification
// (règle explicite, PDF Front Desk section 2 : "Un clic sur une notification
// doit ouvrir directement l'élément correspondant" — même principe appliqué
// aux autres rôles qui reçoivent des notifications). `entity`/`entityId`
// viennent de lib/notifications.js côté backend (toujours renseignés).
function targetPath(notification, role) {
  const { entity, entityId } = notification;
  if (!entity || !entityId) return null;
  if (entity === "accounts") return `/clients/${entityId}`;
  if (entity === "sav_tickets") return `/sav?ticketId=${entityId}`;
  if (entity === "orders") {
    return role === "FRONT_DESK" || role === "DIRECTEUR" ? `/orders?orderId=${entityId}` : `/commandes?orderId=${entityId}`;
  }
  return null;
}

// Largeur fixe du panneau (cf. .notif-panel dans styles.css) — reprise ici
// pour calculer le clamp horizontal sans dépendre du rendu (le panneau n'est
// pas encore dans le DOM au moment où on calcule sa position d'ouverture).
const PANEL_WIDTH = 320;

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState(null);
  const boxRef = useRef(null);

  function handleItemClick(n) {
    if (!n.readAt) markRead(n.id);
    const path = targetPath(n, user?.role);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  }

  // Ancrage en `position: fixed`, calculé depuis la position réelle de la
  // cloche à l'écran (getBoundingClientRect), plutôt qu'un `position:
  // absolute` relatif au wrapper — cf. commentaire de AppShell.jsx : la
  // cloche vit dans la sidebar desktop étroite (210px), où un panneau de
  // 320px ancré en `right: 0` relatif au seul bouton déborde très largement
  // à gauche, hors écran, et le fragment qui reste visible recouvre le menu
  // de navigation en dessous (retour utilisateur : "grand panneau blanc vide,
  // mal positionné, recouvre le menu latéral").
  //
  // Un simple clamp horizontal borné à la cloche laisse encore le panneau
  // chevaucher les liens de nav (qui vivent dans la même colonne étroite,
  // juste sous la cloche) — pas ce que demande la fiche corrective V2
  // ("ne pas masquer la navigation"). On distingue donc deux cas via la
  // largeur/hauteur de `.sidebar` : en sidebar verticale desktop (plus haute
  // que large), le panneau s'ouvre entièrement à DROITE de la sidebar,
  // jamais par-dessus ; en barre horizontale mobile (@max-width:680px, cf.
  // styles.css), il s'ouvre sous la cloche comme un menu déroulant classique
  // (la nav y est fixée en bas de l'écran, hors de toute zone de chevauchement).
  function computePanelPos() {
    if (!boxRef.current) return null;
    const bellRect = boxRef.current.getBoundingClientRect();
    const sidebar = boxRef.current.closest(".sidebar");
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    const isVerticalSidebar = sidebarRect && sidebarRect.height > sidebarRect.width;

    if (isVerticalSidebar) {
      const left = Math.min(sidebarRect.right + 8, window.innerWidth - PANEL_WIDTH - 8);
      return { top: Math.max(8, bellRect.top), left: Math.max(8, left) };
    }
    const left = Math.max(8, Math.min(bellRect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8));
    return { top: bellRect.bottom + 8, left };
  }

  function toggleOpen() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) setPanelPos(computePanelPos());
      return next;
    });
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Repositionne si la fenêtre est redimensionnée (rotation mobile,
  // redimensionnement desktop) pendant que le panneau est ouvert — sinon le
  // clamp calculé à l'ouverture devient obsolète.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      setPanelPos(computePanelPos());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="notif-bell-wrap" ref={boxRef}>
      <button className="notif-bell" onClick={toggleOpen} aria-label={t("notifications.title")}>
        <Bell size={14} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && panelPos && (
        <div className="notif-panel" style={{ top: panelPos.top, left: panelPos.left }}>
          <div className="notif-panel-head">
            <strong>{t("notifications.title")}</strong>
            {unread > 0 && (
              <button className="btn-link" onClick={markAllRead}>
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="empty-state" style={{ margin: "12px 0" }}>
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`notif-item ${n.readAt ? "" : "unread"}`}
                  style={{ cursor: targetPath(n, user?.role) ? "pointer" : "default" }}
                  onClick={() => handleItemClick(n)}
                >
                  <div className="notif-item-title">{n.title}</div>
                  {n.body && <div className="notif-item-body">{n.body}</div>}
                  <div className="notif-item-time">{new Date(n.createdAt).toLocaleString()}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
