import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import { getAllBookings, syncCompletedBookings, BOOKING_STATUS } from "../../utils/bookingStorage";
import { getIssuesForAdmin } from "../../utils/issueStorage";
import { getRoomAvailability, getAllRoomStatuses, ROOM_STATUS_EVENT, ROOM_AVAILABILITY } from "../../utils/roomStatusStorage";
import { getAllRooms, ROOMS_EVENT } from "../../utils/roomStorage";
import {
  TIME_RANGES,
  TIME_RANGE_LABELS,
  getBookingAnalytics,
  getRoomAnalytics,
  getIssueAnalytics,
  getMaintenanceAnalytics,
  formatResolutionTime,
} from "../../utils/analyticsUtils";

const COLORS = ["#4F46E5", "#F59E0B", "#10B981", "#F43F5E", "#64748B", "#FB923C", "#0EA5E9"];

export default function AdminAnalytics() {
  const { user } = useAuth();

  const [range, setRange] = useState(TIME_RANGES.LAST_30_DAYS);
  const [bookings, setBookings] = useState([]);
  const [issues, setIssues] = useState([]);
  const [roomStatusRecords, setRoomStatusRecords] = useState([]);
  const [tick, setTick] = useState(0);

  function refresh() {
    syncCompletedBookings();
    setBookings(getAllBookings());
    setIssues(getIssuesForAdmin());
    setRoomStatusRecords(getAllRoomStatuses());
  }

  useEffect(() => {
    refresh();
    const bump = () => {
      setTick((t) => t + 1);
      refresh();
    };
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
    };
  }, []);

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
        const start = new Date(`${b.startDate}T${b.startTime}:00`).getTime();
        const end = new Date(`${b.endDate}T${b.endTime}:00`).getTime();
        if (Number.isNaN(start) || Number.isNaN(end)) return false;
        return now >= start && now <= end;
      });
      const isOccupied = availability.status === ROOM_AVAILABILITY.AVAILABLE && !!currentBooking;
      map[room.id] = { status: availability.status, isOccupied };
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, bookings, rooms]);

  const bookingStats = useMemo(() => getBookingAnalytics(bookings, range), [bookings, range]);
  const roomStats = useMemo(() => getRoomAnalytics(rooms, roomAvailabilities), [rooms, roomAvailabilities]);
  const issueStats = useMemo(() => getIssueAnalytics(issues, range), [issues, range]);
  const maintenanceStats = useMemo(() => getMaintenanceAnalytics(roomStatusRecords, range), [roomStatusRecords, range]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Usage trends, occupancy, and system-wide reporting."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      <Section title="Bookings">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="clipboardList" label="Total Bookings" value={bookingStats.total} />
          <StatCard icon="clock" label="Upcoming" value={bookingStats.upcoming} tone="amber" />
          <StatCard icon="ban" label="Cancelled" value={bookingStats.cancelled} tone="rose" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Booking Trend" subtitle={TIME_RANGE_LABELS[range]}>
            {bookingStats.hasDataInRange ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={bookingStats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Bookings" stroke="#4F46E5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No bookings created in this period." />
            )}
          </ChartCard>
          <ChartCard title="Booking Status Distribution" subtitle={TIME_RANGE_LABELS[range]}>
            {bookingStats.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={bookingStats.statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {bookingStats.statusDistribution.map((entry, idx) => (
                      <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No bookings in this period to break down." />
            )}
          </ChartCard>
        </div>
      </Section>

      <Section title="Rooms">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="door" label="Room Occupancy" value={`${roomStats.occupancyRate}%`} tone="indigo" />
          <StatCard icon="checkCircle" label="Available Rooms" value={roomStats.available} tone="emerald" />
          <StatCard icon="tool" label="Maintenance Rooms" value={roomStats.maintenance} tone="amber" />
          <StatCard icon="ban" label="Blocked Rooms" value={roomStats.blocked} tone="rose" />
        </div>
        <ChartCard title="Room Status" subtitle="Live snapshot">
          {roomStats.hasData && roomStats.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={roomStats.statusDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {roomStats.statusDistribution.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No rooms configured." />
          )}
        </ChartCard>
      </Section>

      <Section title="Issues">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="alert" label="Open Issues" value={issueStats.open} tone="rose" />
          <StatCard icon="checkCircle" label="Resolved Issues" value={issueStats.resolved} tone="emerald" />
          <StatCard icon="clock" label="Avg. Resolution Time" value={formatResolutionTime(issueStats.avgResolutionHours)} tone="amber" />
          <StatCard icon="clipboardList" label="Total Issues" value={issueStats.total} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Issues by Category" subtitle={TIME_RANGE_LABELS[range]}>
            {issueStats.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={issueStats.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Issues" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No issues reported in this period." />
            )}
          </ChartCard>
          <ChartCard title="Issues by Priority" subtitle={TIME_RANGE_LABELS[range]}>
            {issueStats.byPriority.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={issueStats.byPriority}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Issues" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No issues reported in this period." />
            )}
          </ChartCard>
          <ChartCard title="Issue Status Distribution" subtitle={TIME_RANGE_LABELS[range]}>
            {issueStats.byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={issueStats.byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {issueStats.byStatus.map((entry, idx) => (
                      <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="No issues reported in this period." />
            )}
          </ChartCard>
          <ChartCard title="Maintenance Activity" subtitle={TIME_RANGE_LABELS[range]}>
            {maintenanceStats.hasDataInRange ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={maintenanceStats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Maintenance events" fill="#FB923C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart
                message={
                  maintenanceStats.hasData
                    ? "No maintenance events in this period."
                    : "No maintenance activity recorded yet."
                }
              />
            )}
          </ChartCard>
        </div>
      </Section>
    </div>
  );
}

function RangeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
    >
      {Object.values(TIME_RANGES).map((r) => (
        <option key={r} value={r}>
          {TIME_RANGE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, tone = "indigo" }) {
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
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyle}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <span className="text-[11px] text-slate-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="chart" className="h-5 w-5" />
      </div>
      <p className="max-w-[220px] text-xs text-slate-400">{message}</p>
    </div>
  );
}
