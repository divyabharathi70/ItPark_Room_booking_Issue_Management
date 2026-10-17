import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import { NOTIFICATION_META, formatRelativeTime } from "../../utils/notificationStorage";
import Icon from "../icons/Icon";

const PREVIEW_COUNT = 6;

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const preview = notifications.slice(0, PREVIEW_COUNT);

  function handleSelect(notification) {
    if (!notification.read) markAsRead(notification.id);
    setOpen(false);
    if (notification.relatedType === "issue" && notification.relatedId) {
      navigate(`/${user.role}/issues/${notification.relatedId}`);
    }
  }

  function handleViewAll() {
    setOpen(false);
    navigate(`/${user.role}/notifications`);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-blueprint-line text-blueprint-muted transition hover:border-blueprint-steel2 hover:text-blueprint-text"
      >
        <Icon name="bell" className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-blueprint-bg bg-blueprint-amber px-1 font-mono text-[9px] font-semibold text-blueprint-bg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[90vw] overflow-hidden rounded-md border border-blueprint-line bg-blueprint-panel shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-blueprint-line px-4 py-3">
            <p className="text-sm font-semibold text-blueprint-text">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-medium text-blueprint-steel transition hover:text-blueprint-amber"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {preview.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Icon name="bell" className="h-6 w-6 text-blueprint-muted2" />
                <p className="text-xs text-blueprint-muted">You're all caught up.</p>
              </div>
            ) : (
              preview.map((n) => {
                const meta = NOTIFICATION_META[n.type] || { icon: "bell", color: "text-slate-600 bg-slate-100" };
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSelect(n)}
                    className={`flex w-full items-start gap-3 border-b border-blueprint-line/60 px-4 py-3 text-left transition last:border-0 hover:bg-blueprint-panel2 ${
                      n.read ? "" : "bg-blueprint-panel2/60"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                      <Icon name={meta.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`text-xs leading-snug ${
                            n.read ? "text-blueprint-muted" : "font-medium text-blueprint-text"
                          }`}
                        >
                          {n.message}
                        </span>
                        {!n.read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blueprint-amber" />}
                      </span>
                      <span className="mt-1 block text-[10px] text-blueprint-muted2">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={handleViewAll}
            className="block w-full border-t border-blueprint-line px-4 py-2.5 text-center text-xs font-semibold text-blueprint-steel transition hover:bg-blueprint-panel2 hover:text-blueprint-amber"
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
}
