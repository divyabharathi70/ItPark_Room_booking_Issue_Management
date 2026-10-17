import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { MOCK_USERS, ROLES } from "../../data/mockUsers";
import { MOCK_WORKERS } from "../../data/mockWorkers";
import {
  getAllBookings,
  syncCompletedBookings,
  BOOKING_STATUS,
  toTimestamp,
} from "../../utils/bookingStorage";
import {
  getIssuesForAdmin,
  ISSUE_STATUS,
  PRIORITY,
  isIssueOverdue,
} from "../../utils/issueStorage";
import {
  getRoomAvailability,
  ROOM_STATUS_EVENT,
  ROOM_AVAILABILITY,
} from "../../utils/roomStatusStorage";
import { isStaffActive, isStaffDeleted, STAFF_OVERRIDES_EVENT } from "../../utils/staffOverridesStorage";
import { getCustomStaff, STAFF_ROLE } from "../../utils/customStaffStorage";
import { NOTIFICATION_META, formatRelativeTime } from "../../utils/notificationStorage";
import { getRoomAnalytics } from "../../utils/analyticsUtils";
import { getAllRooms, ROOMS_EVENT } from "../../utils/roomStorage";

const OPEN_ISSUE_STATUSES = [
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.REOPENED,
];

const ACTIVE_WORKER_ISSUE_STATUSES = [ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.IN_PROGRESS];

const PRIORITY_WEIGHT = {
  [PRIORITY.CRITICAL]: 3,
  [PRIORITY.HIGH]: 2,
  [PRIORITY.MEDIUM]: 1,
  [PRIORITY.LOW]: 0,
};

function formatBookingWhen(booking) {
  if (!booking?.startDate) return "—";
  const date = new Date(`${booking.startDate}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
  return `${date} · ${booking.startTime || "—"}`;
}

/** Counts active (non-deleted) records from a mock roster plus any
 * admin-added custom staff of the same role, honoring admin
 * activate/deactivate overrides. Mirrors the roster-building pattern
 * already used on the Workers/Employees admin pages, trimmed down to
 * just the counts this dashboard widget needs. */
function countStaff(baseIds, staffRole) {
  const ids = [...baseIds, ...getCustomStaff(staffRole).map((c) => c.id)].filter((id) => !isStaffDeleted(id));
  const total = ids.length;
  const active = ids.filter((id) => isStaffActive(id)).length;
  return { total, active };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications } = useNotifications();

  const [tick, setTick] = useState(0);
  const [bookings, setBookings] = useState([]);
  const [issues, setIssues] = useState([]);

  function refresh() {
    syncCompletedBookings();
    setBookings(getAllBookings());
    setIssues(getIssuesForAdmin());
  }

  useEffect(() => {
    refresh();
    const bump = () => {
      setTick((t) => t + 1);
      refresh();
    };
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(STAFF_OVERRIDES_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(STAFF_OVERRIDES_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
    };
  }, []);

  // --- Rooms / occupancy -------------------------------------------------

  const rooms = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick; // dependency: force recompute on room-catalog changes
    return getAllRooms();
  }, [tick]);

  const roomAvailabilities = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick; // dependency: force recompute on room-status changes
    const now = Date.now();
    const map = {};
    rooms.forEach((room) => {
      const availability = getRoomAvailability(room.id);
      const currentBooking = bookings.find((b) => {
        if (b.roomId !== room.id || b.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
        const start = toTimestamp(b.startDate, b.startTime);
        const end = toTimestamp(b.endDate, b.endTime);
        if (start === null || end === null) return false;
        return now >= start && now <= end;
      });
      const isOccupied = availability.status === ROOM_AVAILABILITY.AVAILABLE && !!currentBooking;
      map[room.id] = { status: availability.status, isOccupied };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, bookings, rooms]);

  const roomStats = useMemo(() => getRoomAnalytics(rooms, roomAvailabilities), [rooms, roomAvailabilities]);

  const roomStatusRows = useMemo(
    () => [
      { key: "Available", label: "Available", value: roomStats.available, dot: "bg-emerald-500" },
      { key: "Occupied", label: "Occupied", value: roomStats.occupied, dot: "bg-indigo-500" },
      { key: "Maintenance", label: "Maintenance", value: roomStats.maintenance, dot: "bg-amber-500" },
      { key: "Blocked", label: "Blocked", value: roomStats.blocked, dot: "bg-rose-500" },
    ],
    [roomStats]
  );

  // --- Issues --------------------------------------------------------------

  const issueStats = useMemo(() => {
    const open = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status));
    const overdue = open.filter(isIssueOverdue);
    const critical = open.filter((i) => i.priority === PRIORITY.CRITICAL);
    return { openCount: open.length, overdueCount: overdue.length, criticalCount: critical.length };
  }, [issues]);

  const urgentIssues = useMemo(() => {
    return issues
      .filter((i) => OPEN_ISSUE_STATUSES.includes(i.status))
      .slice()
      .sort((a, b) => {
        const overdueDiff = Number(isIssueOverdue(b)) - Number(isIssueOverdue(a));
        if (overdueDiff !== 0) return overdueDiff;
        const weightDiff = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
        if (weightDiff !== 0) return weightDiff;
        return new Date(a.createdDate) - new Date(b.createdDate);
      })
      .slice(0, 5);
  }, [issues]);

  // --- Bookings ------------------------------------------------------------

  const bookingStats = useMemo(() => {
    const now = Date.now();
    const pending = bookings.filter((b) => b.bookingStatus === BOOKING_STATUS.PENDING);
    const upcoming = bookings.filter((b) => {
      if (b.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
      const start = toTimestamp(b.startDate, b.startTime);
      return start !== null && start > now;
    });
    return { pendingCount: pending.length, upcomingCount: upcoming.length };
  }, [bookings]);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => b.bookingStatus === BOOKING_STATUS.PENDING || b.bookingStatus === BOOKING_STATUS.CONFIRMED)
      .map((b) => ({ booking: b, start: toTimestamp(b.startDate, b.startTime) }))
      .filter(({ start, booking }) => start !== null && (booking.bookingStatus === BOOKING_STATUS.PENDING || start > now))
      .sort((a, b) => a.start - b.start)
      .slice(0, 5)
      .map(({ booking }) => booking);
  }, [bookings]);

  // --- Staff -----------------------------------------------------------------

  const staffStats = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick; // dependency: recompute when an activate/deactivate override changes
    const workerIds = MOCK_WORKERS.map((w) => w.id);
    const employeeIds = MOCK_USERS.filter((u) => u.role === ROLES.EMPLOYEE).map((u) => u.id);

    const workers = countStaff(workerIds, STAFF_ROLE.WORKER);
    const employees = countStaff(employeeIds, STAFF_ROLE.EMPLOYEE);

    const workersWithTasks = new Set(
      issues
        .filter((i) => ACTIVE_WORKER_ISSUE_STATUSES.includes(i.status) && i.assignedWorkerId)
        .map((i) => i.assignedWorkerId)
    ).size;

    return {
      totalStaff: workers.total + employees.total,
      activeStaff: workers.active + employees.active,
      activeWorkers: workers.active,
      activeEmployees: employees.active,
      workersWithTasks,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, issues]);

  const recentActivity = useMemo(() => notifications.slice(0, 6), [notifications]);

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="System-wide overview — bookings, rooms, issues, and staff at a glance."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon="door" label="Room Occupancy" value={`${roomStats.occupancyRate}%`} tone="indigo" />
        <KpiCard icon="alert" label="Open Issues" value={issueStats.openCount} tone="rose" />
        <KpiCard icon="clock" label="Pending Bookings" value={bookingStats.pendingCount} tone="amber" />
        <KpiCard icon="users" label="Active Staff" value={staffStats.activeStaff} tone="emerald" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Occupancy */}
        <Panel
          icon="door"
          title="Room Occupancy"
          subtitle="Live snapshot"
          onViewAll={() => navigate("/admin/rooms")}
        >
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{roomStats.occupancyRate}%</span>
            <span className="text-xs text-slate-400">
              {roomStats.occupied} of {roomStats.total} rooms occupied right now
            </span>
          </div>
          <div className="space-y-2.5">
            {roomStatusRows.map((row) => (
              <BreakdownRow key={row.key} {...row} total={roomStats.total} />
            ))}
          </div>
        </Panel>

        {/* Open issues */}
        <Panel
          icon="alert"
          title="Open Issues"
          subtitle={`${issueStats.overdueCount} overdue · ${issueStats.criticalCount} critical`}
          onViewAll={() => navigate("/admin/issues")}
        >
          {urgentIssues.length === 0 ? (
            <EmptyRow icon="checkCircle" message="No open issues — all clear." />
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  onClick={() => navigate(`/admin/issues/${issue.id}`)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left transition hover:bg-slate-50/80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{issue.roomName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {issue.id} · {issue.category}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isIssueOverdue(issue) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <Icon name="alert" className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                    <StatusBadge status={issue.priority} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {/* Pending bookings */}
        <Panel
          icon="clock"
          title="Pending Bookings"
          subtitle={`${bookingStats.upcomingCount} confirmed & upcoming`}
          onViewAll={() => navigate("/admin/bookings")}
        >
          {upcomingBookings.length === 0 ? (
            <EmptyRow icon="calendar" message="No pending or upcoming bookings." />
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{booking.roomName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {booking.clientName} · {formatBookingWhen(booking)}
                    </p>
                  </div>
                  <StatusBadge status={booking.bookingStatus} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Staff activity */}
        <Panel
          icon="users"
          title="Staff Activity"
          subtitle={`${staffStats.activeWorkers} active workers · ${staffStats.activeEmployees} active employees`}
          onViewAll={() => navigate("/admin/notifications")}
        >
          <div className="mb-4 grid grid-cols-3 gap-2">
            <MiniStat label="Active Staff" value={staffStats.activeStaff} />
            <MiniStat label="Total Staff" value={staffStats.totalStaff} />
            <MiniStat label="Workers Busy" value={staffStats.workersWithTasks} />
          </div>
          {recentActivity.length === 0 ? (
            <EmptyRow icon="bell" message="No recent activity yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentActivity.map((n) => {
                const meta = NOTIFICATION_META[n.type] || { icon: "bell", color: "text-slate-600 bg-slate-100" };
                return (
                  <div key={n.id} className="flex items-start gap-2.5 py-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                      <Icon name={meta.icon} className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs text-slate-700">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tone = "indigo" }) {
  const toneStyle =
    {
      indigo: "bg-indigo-50 text-indigo-600",
      amber: "bg-amber-50 text-amber-600",
      emerald: "bg-emerald-50 text-emerald-600",
      rose: "bg-rose-50 text-rose-600",
      slate: "bg-slate-100 text-slate-600",
    }[tone] || "bg-indigo-50 text-indigo-600";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${toneStyle}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-tight text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function Panel({ icon, title, subtitle, onViewAll, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Icon name={icon} className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            View all
            <Icon name="chevronRight" className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BreakdownRow({ label, value, total, dot }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="w-20 shrink-0 text-xs text-slate-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${dot}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-center">
      <p className="text-base font-bold text-slate-900">{value}</p>
      <p className="truncate text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

function EmptyRow({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </div>
      <p className="max-w-[220px] text-xs text-slate-400">{message}</p>
    </div>
  );
}
