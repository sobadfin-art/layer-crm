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
  if (entity === "sav_tickets") return "/sav";
  if (entity === "orders") {
    return role === "FRONT_DESK" || role === "DIRECTEUR" ? "/orders" : "/commandes";
  }
  return null;
}

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  function handleItemClick(n) {
    if (!n.readAt) markRead(n.id);
    const path = targetPath(n, user?.role);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="notif-bell-wrap" ref={boxRef}>
      <button className="notif-bell" onClick={() => setOpen((o) => !o)} aria-label={t("notifications.title")}>
        <Bell size={14} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
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
