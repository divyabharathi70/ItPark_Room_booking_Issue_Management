// Pure, storage-agnostic helpers that turn the app's real booking/issue/
// room/maintenance records into the numbers and chart series the Admin
// Analytics dashboard renders. Nothing in this file reads or writes
// localStorage itself — callers (Analytics.jsx) pass in whatever
// getAllBookings()/getIssuesForAdmin()/etc. already returned, which keeps
// analytics guaranteed to reflect the exact same source data used
// everywhere else in the app.

import { BOOKING_STATUS } from "./bookingStorage";
import { ISSUE_STATUS, PRIORITY_ORDER } from "./issueStorage";
import { ROOM_AVAILABILITY } from "./roomStatusStorage";

export const TIME_RANGES = {
  TODAY: "TODAY",
  LAST_7_DAYS: "LAST_7_DAYS",
  LAST_30_DAYS: "LAST_30_DAYS",
  LAST_3_MONTHS: "LAST_3_MONTHS",
  ALL_TIME: "ALL_TIME",
};

export const TIME_RANGE_LABELS = {
  [TIME_RANGES.TODAY]: "Today",
  [TIME_RANGES.LAST_7_DAYS]: "Last 7 days",
  [TIME_RANGES.LAST_30_DAYS]: "Last 30 days",
  [TIME_RANGES.LAST_3_MONTHS]: "Last 3 months",
  [TIME_RANGES.ALL_TIME]: "All time",
};

/** Start-of-range Date for the given TIME_RANGES value, or null for
 * ALL_TIME (no lower bound). */
function rangeStart(range) {
  const now = new Date();
  const start = new Date(now);
  switch (range) {
    case TIME_RANGES.TODAY:
      start.setHours(0, 0, 0, 0);
      return start;
    case TIME_RANGES.LAST_7_DAYS:
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return start;
    case TIME_RANGES.LAST_30_DAYS:
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return start;
    case TIME_RANGES.LAST_3_MONTHS:
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      return start;
    case TIME_RANGES.ALL_TIME:
    default:
      return null;
  }
}

/** Filters `list` down to items whose `dateField` value falls within the
 * selected range (inclusive lower bound, up to now). Items with a missing
 * or unparsable date are excluded rather than silently kept. */
export function filterByRange(list, dateField, range) {
  const start = rangeStart(range);
  if (!start) return list.filter((item) => !!item[dateField] && !Number.isNaN(new Date(item[dateField]).getTime()));
  const startTs = start.getTime();
  const nowTs = Date.now();
  return list.filter((item) => {
    const raw = item[dateField];
    if (!raw) return false;
    const ts = new Date(raw).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= startTs && ts <= nowTs;
  });
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dayKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(d) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function monthKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthLabel(d) {
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function hourLabel(h) {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12} ${period}`;
}

/** Builds a { label, count } series for a trend chart, bucketed at a
 * granularity appropriate to the selected range: hourly for Today, daily
 * for 7/30 days, weekly for 3 months, monthly for All time. Every bucket
 * in the window is included (zero-filled) so the chart always shows the
 * full period's shape rather than only days that happened to have data —
 * except ALL_TIME, which only has real records to anchor a start point,
 * so it spans from the earliest record's month to the current month. */
export function buildTrend(list, dateField, range) {
  const now = new Date();

  if (range === TIME_RANGES.TODAY) {
    const buckets = new Map();
    for (let h = 0; h <= now.getHours(); h++) buckets.set(h, 0);
    list.forEach((item) => {
      const d = new Date(item[dateField]);
      if (Number.isNaN(d.getTime())) return;
      const h = d.getHours();
      if (buckets.has(h)) buckets.set(h, buckets.get(h) + 1);
    });
    return Array.from(buckets.entries()).map(([h, count]) => ({ label: hourLabel(h), count }));
  }

  if (range === TIME_RANGES.LAST_7_DAYS || range === TIME_RANGES.LAST_30_DAYS) {
    const days = range === TIME_RANGES.LAST_7_DAYS ? 7 : 30;
    const buckets = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets.set(dayKey(d), { label: dayLabel(d), count: 0 });
    }
    list.forEach((item) => {
      const d = new Date(item[dateField]);
      if (Number.isNaN(d.getTime())) return;
      const key = dayKey(d);
      if (buckets.has(key)) buckets.get(key).count += 1;
    });
    return Array.from(buckets.values());
  }

  if (range === TIME_RANGES.LAST_3_MONTHS) {
    // Weekly buckets, ~13 weeks back.
    const weeks = 13;
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      buckets.push({ start, end, label: dayLabel(start), count: 0 });
    }
    list.forEach((item) => {
      const d = new Date(item[dateField]);
      if (Number.isNaN(d.getTime())) return;
      const ts = d.getTime();
      const bucket = buckets.find((b) => ts >= b.start.setHours(0, 0, 0, 0) && ts <= b.end.setHours(23, 59, 59, 999));
      if (bucket) bucket.count += 1;
    });
    return buckets.map((b) => ({ label: b.label, count: b.count }));
  }

  // ALL_TIME: monthly buckets from earliest record to this month.
  const validDates = list
    .map((item) => new Date(item[dateField]))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (validDates.length === 0) return [];
  const earliest = validDates.reduce((a, b) => (a < b ? a : b));
  const buckets = new Map();
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  while (cursor <= end) {
    buckets.set(monthKey(cursor), { label: monthLabel(cursor), count: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  list.forEach((item) => {
    const d = new Date(item[dateField]);
    if (Number.isNaN(d.getTime())) return;
    const key = monthKey(d);
    if (buckets.has(key)) buckets.get(key).count += 1;
  });
  return Array.from(buckets.values());
}

/** Counts `list` by an arbitrary field, returning [{ name, value }] in a
 * given preferred order (any values not in `order` are appended,
 * alphabetically). Zero-count entries are omitted so pie/bar charts don't
 * render empty slices for statuses that never occurred. */
export function countBy(list, field, order = []) {
  const counts = new Map();
  list.forEach((item) => {
    const key = item[field];
    if (key === undefined || key === null || key === "") return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const ordered = order.filter((k) => counts.has(k));
  const rest = Array.from(counts.keys())
    .filter((k) => !order.includes(k))
    .sort();
  return [...ordered, ...rest].map((key) => ({ name: String(key).replace(/_/g, " "), value: counts.get(key) }));
}

// ---------------------------------------------------------------------
// Booking analytics
// ---------------------------------------------------------------------

export function getBookingAnalytics(allBookings, range) {
  const filtered = filterByRange(allBookings, "createdAt", range);
  const now = Date.now();
  const isUpcoming = (b) =>
    b.bookingStatus === BOOKING_STATUS.CONFIRMED && new Date(`${b.startDate}T${b.startTime}:00`).getTime() > now;

  return {
    total: filtered.length,
    upcoming: filtered.filter(isUpcoming).length,
    completed: filtered.filter((b) => b.bookingStatus === BOOKING_STATUS.COMPLETED).length,
    cancelled: filtered.filter((b) => b.bookingStatus === BOOKING_STATUS.CANCELLED).length,
    trend: buildTrend(filtered, "createdAt", range),
    statusDistribution: countBy(filtered, "bookingStatus", Object.values(BOOKING_STATUS)),
    hasData: allBookings.length > 0,
    hasDataInRange: filtered.length > 0,
  };
}

// ---------------------------------------------------------------------
// Room analytics — live snapshot, independent of the time filter (an
// admin always wants "what's true right now" for occupancy, not "what
// was true during the selected window").
// ---------------------------------------------------------------------

export function getRoomAnalytics(rooms, roomAvailabilities) {
  const total = rooms.length;
  let available = 0;
  let occupied = 0;
  let maintenance = 0;
  let blocked = 0;

  rooms.forEach((room) => {
    const info = roomAvailabilities[room.id];
    if (!info) return;
    if (info.isOccupied) occupied += 1;
    else if (info.status === ROOM_AVAILABILITY.AVAILABLE) available += 1;
    else if (info.status === ROOM_AVAILABILITY.MAINTENANCE) maintenance += 1;
    else blocked += 1;
  });

  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const statusDistribution = [
    { name: "Available", value: available },
    { name: "Occupied", value: occupied },
    { name: "Maintenance", value: maintenance },
    { name: "Blocked", value: blocked },
  ].filter((s) => s.value > 0);

  return {
    total,
    available,
    occupied,
    maintenance,
    blocked,
    occupancyRate,
    statusDistribution,
    hasData: total > 0,
  };
}

// ---------------------------------------------------------------------
// Issue analytics
// ---------------------------------------------------------------------

const OPEN_STATUSES = [ISSUE_STATUS.OPEN, ISSUE_STATUS.ASSIGNED, ISSUE_STATUS.IN_PROGRESS, ISSUE_STATUS.REOPENED];
const RESOLVED_STATUSES = [ISSUE_STATUS.RESOLVED, ISSUE_STATUS.CLOSED];

export function getIssueAnalytics(allIssues, range) {
  const filtered = filterByRange(allIssues, "createdDate", range);

  const open = filtered.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const resolved = filtered.filter((i) => RESOLVED_STATUSES.includes(i.status)).length;

  const resolutionSamples = filtered
    .filter((i) => RESOLVED_STATUSES.includes(i.status) && i.resolvedAt && i.createdDate)
    .map((i) => (new Date(i.resolvedAt).getTime() - new Date(i.createdDate).getTime()) / 3600000)
    .filter((hrs) => Number.isFinite(hrs) && hrs >= 0);

  const avgResolutionHours =
    resolutionSamples.length > 0 ? resolutionSamples.reduce((a, b) => a + b, 0) / resolutionSamples.length : null;

  return {
    total: filtered.length,
    open,
    resolved,
    avgResolutionHours,
    hasResolutionData: resolutionSamples.length > 0,
    byCategory: countBy(filtered, "categoryGroup"),
    byPriority: countBy(filtered, "priority", PRIORITY_ORDER),
    byStatus: countBy(filtered, "status", [
      ISSUE_STATUS.OPEN,
      ISSUE_STATUS.ASSIGNED,
      ISSUE_STATUS.IN_PROGRESS,
      ISSUE_STATUS.RESOLVED,
      ISSUE_STATUS.CLOSED,
      ISSUE_STATUS.REOPENED,
    ]),
    hasData: allIssues.length > 0,
    hasDataInRange: filtered.length > 0,
  };
}

export function formatResolutionTime(hours) {
  if (hours === null || hours === undefined) return "No data";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

// ---------------------------------------------------------------------
// Maintenance analytics — block/unblock events from roomStatusStorage.
// ---------------------------------------------------------------------

export function getMaintenanceAnalytics(allRoomStatusRecords, range) {
  const filtered = filterByRange(allRoomStatusRecords, "blockedAt", range);
  return {
    totalEvents: filtered.length,
    trend: buildTrend(filtered, "blockedAt", range),
    hasData: allRoomStatusRecords.length > 0,
    hasDataInRange: filtered.length > 0,
  };
}
