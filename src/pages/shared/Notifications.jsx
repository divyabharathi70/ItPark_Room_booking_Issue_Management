import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import { NOTIFICATION_META, formatRelativeTime } from "../../utils/notificationStorage";

const FILTERS = ["All", "Unread"];

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(() => {
    if (filter === "Unread") return notifications.filter((n) => !n.read);
    return notifications;
  }, [notifications, filter]);

  function handleSelect(notification) {
    if (!notification.read) markAsRead(notification.id);
    if (notification.relatedType === "issue" && notification.relatedId) {
      navigate(`/${user.role}/issues/${notification.relatedId}`);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Updates on bookings, issues, and maintenance relevant to your account."
        actions={
          unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              <Icon name="checkCircle" className="h-4 w-4" />
              Mark All as Read
            </button>
          )
        }
      />

      <div className="mb-5 inline-flex gap-1.5 rounded-xl bg-slate-100 p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f}
            {f === "Unread" && unreadCount > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === f ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"
                }`}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={notifications.length > 0} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {filtered.map((n) => {
            const meta = NOTIFICATION_META[n.type] || { icon: "bell", color: "text-slate-600 bg-slate-100" };
            const clickable = n.relatedType === "issue" && n.relatedId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleSelect(n)}
                className={`flex w-full items-start gap-4 border-b border-slate-100 px-5 py-4 text-left transition last:border-0 hover:bg-slate-50 ${
                  n.read ? "" : "bg-indigo-50/30"
                } ${clickable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className={`text-sm leading-snug ${n.read ? "text-slate-600" : "font-semibold text-slate-900"}`}>
                      {n.message}
                    </span>
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatRelativeTime(n.createdAt)}</span>
                    {n.relatedId && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{n.relatedId}</span>
                      </>
                    )}
                  </span>
                </span>
                {!n.read && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      markAsRead(n.id);
                    }}
                    className="shrink-0 self-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 opacity-0 transition hover:bg-indigo-50 group-hover:opacity-100 sm:opacity-100"
                  >
                    Mark as read
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="bell" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No unread notifications" : "No notifications yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny
          ? "You're all caught up — check back later for new updates."
          : "Booking, payment, and issue updates will show up here as they happen."}
      </p>
    </div>
  );
}
