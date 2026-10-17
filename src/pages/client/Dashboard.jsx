import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { NOTIFICATION_META, formatRelativeTime } from "../../utils/notificationStorage";
import {
  getBookingsForClient,
  syncCompletedBookings,
  seedBookingsIfEmpty,
  formatDuration,
  BOOKING_STATUS,
} from "../../utils/bookingStorage";
import { getIssuesForClient, ISSUE_STATUS } from "../../utils/issueStorage";

function formatTime12h(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  // Every client's own issues only — scoped by their logged-in id, the
  // same way MyIssues/IssueDetails are (see utils/issueStorage.js).
  const [issues, setIssues] = useState([]);
  const { notifications: realNotifications } = useNotifications();

  useEffect(() => {
    seedBookingsIfEmpty();
    syncCompletedBookings();
    setBookings(getBookingsForClient(user.id));
    setIssues(getIssuesForClient(user.id));
  }, [user.id]);

  const now = new Date();

  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED || b.bookingStatus === BOOKING_STATUS.PENDING)
        .sort((a, b) => new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`)),
    [bookings]
  );

  const activeNow = useMemo(
    () =>
      bookings.filter((b) => {
        if (b.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
        const start = new Date(`${b.startDate}T${b.startTime}`);
        const end = new Date(`${b.endDate}T${b.endTime}`);
        return start <= now && now <= end;
      }),
    [bookings] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const completed = useMemo(() => bookings.filter((b) => b.bookingStatus === BOOKING_STATUS.COMPLETED), [bookings]);
  const recentIssues = useMemo(
    () => [...issues].sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate)).slice(0, 3),
    [issues]
  );
  const openIssues = useMemo(
    () => issues.filter((i) => i.status !== ISSUE_STATUS.RESOLVED && i.status !== ISSUE_STATUS.CLOSED),
    [issues]
  );

  // Real, per-user notifications (same store/hook the /client/notifications
  // page uses — see hooks/useNotifications.js) — newest first, capped to a
  // handful for this summary widget.
  const notifications = useMemo(() => realNotifications.slice(0, 4), [realNotifications]);

  const stats = [
    { label: "Upcoming Bookings", value: upcoming.length, icon: "calendar", tone: "bg-indigo-50 text-indigo-600" },
    { label: "Active Bookings", value: activeNow.length, icon: "clock", tone: "bg-emerald-50 text-emerald-600" },
    { label: "Completed Bookings", value: completed.length, icon: "checkCircle", tone: "bg-slate-100 text-slate-600" },
    { label: "Open Issues", value: openIssues.length, icon: "alert", tone: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Book rooms, track your bookings, and keep an eye on open issues — all in one place."
        actions={
          <Link
            to="/client/bookings/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Book a Room
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}>
              <Icon name={s.icon} className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming Bookings</h2>
              <Link to="/client/bookings" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>

            {upcoming.length === 0 ? (
              <EmptyRow
                icon="clipboardList"
                text="No upcoming bookings yet."
                cta="Book a Room"
                to="/client/bookings/new"
              />
            ) : (
              <div className="space-y-3">
                {upcoming.slice(0, 4).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <span className="text-[10px] font-semibold leading-none">
                          {formatDateShort(b.startDate).split(" ")[1]}
                        </span>
                        <span className="text-sm font-bold leading-none">{formatDateShort(b.startDate).split(" ")[0]}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {b.roomName}
                          {b.roomNumber && <span className="font-normal text-slate-400"> ({b.roomNumber})</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)} &middot;{" "}
                          {formatDuration(b.durationHours)}
                        </p>
                      </div>
                    </div>
                    {/* Booking status + payment details for this booking */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={b.bookingStatus} />
                      <p className="text-xs font-semibold text-slate-700">
                        ₹{(b.totalAmount || 0).toLocaleString("en-IN")}
                        <span className="ml-1 font-normal text-slate-400">
                          &middot; {b.paymentStatus === "PAID" ? "Paid" : "Payment pending"}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent issues */}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent Issues</h2>
              <Link to="/client/issues" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            {recentIssues.length === 0 ? (
              <EmptyRow icon="alert" text="No issues raised yet." cta="Raise an Issue" to="/client/issues/new" />
            ) : (
              <div className="space-y-3">
                {recentIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    to={`/client/issues/${issue.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{issue.category}</p>
                      <p className="truncate text-xs text-slate-500">{issue.roomName}</p>
                    </div>
                    <StatusBadge status={issue.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent Notifications</h2>
              <Link to="/client/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400">No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => {
                  const meta = NOTIFICATION_META[n.type] || { icon: "bell", color: "text-slate-600 bg-slate-100" };
                  return (
                    <div key={n.id} className="flex items-start gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                        <Icon name={meta.icon} className="h-4 w-4" />
                      </span>
                      <div>
                        <p className={`text-xs leading-relaxed ${n.read ? "text-slate-600" : "font-semibold text-slate-700"}`}>
                          {n.message}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ icon, text, cta, to }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-xs text-slate-500">{text}</p>
      {cta && (
        <Link to={to} className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {cta} →
        </Link>
      )}
    </div>
  );
}
