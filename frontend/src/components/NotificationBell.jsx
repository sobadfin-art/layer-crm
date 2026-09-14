import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications.js";
import { useI18n } from "../i18n/I18nContext.jsx";

export default function NotificationBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

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
                  onClick={() => !n.readAt && markRead(n.id)}
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
