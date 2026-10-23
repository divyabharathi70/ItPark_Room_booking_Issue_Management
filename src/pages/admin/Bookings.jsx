import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { AMENITY_MAP } from "../../data/mockRooms";
import { getRoomById } from "../../utils/roomStorage";
import {
  getAllBookings,
  updateBookings,
  deleteBooking,
  cancelBooking,
  approveBooking,
  rejectBooking,
  formatDuration,
  BOOKING_STATUS,
  BOOKINGS_EVENT,
} from "../../utils/bookingStorage";

function formatTime12h(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const EMPTY_FILTERS = { status: "All", room: "All", date: "" };

// Friendly labels for the status filter dropdown. Order matches the
// requested filter set: All, Pending
// Approval, Confirmed, Cancelled.
const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "All" },
  { value: BOOKING_STATUS.PENDING, label: "Pending Approval" },
  { value: BOOKING_STATUS.CONFIRMED, label: "Confirmed" },
  { value: BOOKING_STATUS.CANCELLED, label: "Cancelled" },
];

/** Every new user request waits for Admin approval, whether payment has
 * completed yet or not. */
function isPendingApproval(b) {
  return b.bookingStatus === BOOKING_STATUS.PENDING;
}

/** The status value handed to <StatusBadge> for a booking's own status
 * column — display-only substitution, never written back to storage. */
function bookingBadgeStatus(b) {
  return isPendingApproval(b) ? "PENDING_APPROVAL" : b.bookingStatus;
}

/** Is `booking` currently in-progress right now (confirmed and the clock
 * is between its start and end)? Used only for the "Active" stat — it
 * doesn't change bookingStatus itself, which stays CONFIRMED after the
 * booked time passes. */
function isCurrentlyActive(booking) {
  if (booking.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
  const now = Date.now();
  const start = new Date(`${booking.startDate}T${booking.startTime}:00`).getTime();
  const end = new Date(`${booking.endDate}T${booking.endTime}:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

export default function AdminBookings() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approving, setApproving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [toast, setToast] = useState("");

  function refresh() {
    let current = getAllBookings();
    const needsUpdate = current.some((b) =>
      b.bookingStatus === "COMPLETED" || b.paymentStatus === "PENDING"
    );
    if (needsUpdate) {
      const updates = current.flatMap((b) => {
        const patch = {
          ...(b.bookingStatus === "COMPLETED" ? { bookingStatus: BOOKING_STATUS.CONFIRMED } : {}),
          ...(b.paymentStatus === "PENDING" ? { paymentStatus: "PAID" } : {}),
        };
        return Object.keys(patch).length ? [{ id: b.id, patch }] : [];
      });
      // Persist in one write and broadcast once to other open views.
      current = updateBookings(updates);
    }
    setBookings(current);
  }

  useEffect(() => {
    refresh();
    window.addEventListener(BOOKINGS_EVENT, refresh);
    // The user and admin commonly have separate tabs open. localStorage
    // changes in the user's tab arrive through the browser storage event.
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BOOKINGS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const roomOptions = useMemo(() => {
    const rooms = new Set();
    bookings.forEach((b) => b.roomName && rooms.add(b.roomName));
    return Array.from(rooms).sort();
  }, [bookings]);

  const stats = useMemo(() => {
    const total = bookings.length;
    const pendingApproval = bookings.filter(isPendingApproval).length;
    const upcoming = bookings.filter(
      (b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED && !isCurrentlyActive(b)
    ).length;
    const active = bookings.filter(isCurrentlyActive).length;
    const cancelled = bookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CANCELLED).length;
    return { total, pendingApproval, upcoming, active, cancelled };
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (filters.status !== "All" && b.bookingStatus !== filters.status) return false;
        if (filters.room !== "All" && b.roomName !== filters.room) return false;
        if (filters.date && b.startDate !== filters.date) return false;
        if (!q) return true;
        return (
          b.id.toLowerCase().includes(q) ||
          b.clientName?.toLowerCase().includes(q) ||
          b.roomName?.toLowerCase().includes(q) ||
          b.roomNumber?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [bookings, filters, query]);

  const filtersActive = query.trim() !== "" || Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setTimeout(() => {
      cancelBooking(cancelTarget.id);
      setCancelling(false);
      setToast(`Booking ${cancelTarget.id} cancelled.`);
      setCancelTarget(null);
      refresh();
    }, 400);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setTimeout(() => {
      deleteBooking(deleteTarget.id);
      setDeleting(false);
      setToast(`Booking ${deleteTarget.id} deleted.`);
      setDeleteTarget(null);
      if (detailsBooking?.id === deleteTarget.id) setDetailsBooking(null);
      refresh();
    }, 400);
  }

  // Admin approves a pending request and activates the customer. Closes
  // the details modal too, in case approval was triggered
  // from inside it.
  function confirmApprove() {
    if (!approveTarget) return;
    setApproving(true);
    setTimeout(() => {
      approveBooking(approveTarget.id);
      setApproving(false);
      setToast(`Booking ${approveTarget.id} confirmed.`);
      setApproveTarget(null);
      setDetailsBooking(null);
      refresh();
    }, 400);
  }

  // Admin cancels a pending request and notifies the customer — see
  // rejectBooking() in bookingStorage.js.
  // No Client account is created or activated here.
  function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    setTimeout(() => {
      rejectBooking(rejectTarget.id);
      setRejecting(false);
      setToast(`Booking ${rejectTarget.id} rejected.`);
      setRejectTarget(null);
      setDetailsBooking(null);
      refresh();
    }, 400);
  }

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Review and manage every room booking across the park."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon="clipboardList" label="Total Bookings" value={stats.total} />
        <StatCard icon="alert" label="Pending Approval" value={stats.pendingApproval} tone="amber" />
        <StatCard icon="clock" label="Upcoming" value={stats.upcoming} tone="amber" />
        <StatCard icon="checkCircle" label="Active Now" value={stats.active} tone="emerald" />
        <StatCard icon="ban" label="Cancelled" value={stats.cancelled} tone="rose" />
      </div>

      <Filters
        filters={filters}
        setFilters={setFilters}
        query={query}
        setQuery={setQuery}
        roomOptions={roomOptions}
        onReset={resetFilters}
        active={filtersActive}
      />

      {filtered.length === 0 ? (
        <EmptyState hasAny={bookings.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden lg:block">
            <BookingTable
              bookings={filtered}
              onView={setDetailsBooking}
              onCancel={setCancelTarget}
              onDelete={setDeleteTarget}
              onApprove={setApproveTarget}
              onReject={setRejectTarget}
            />
          </div>
          <div className="grid gap-4 lg:hidden">
            {filtered.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onView={() => setDetailsBooking(b)}
                onCancel={() => setCancelTarget(b)}
                onDelete={() => setDeleteTarget(b)}
                onApprove={() => setApproveTarget(b)}
                onReject={() => setRejectTarget(b)}
              />
            ))}
          </div>
        </>
      )}

      {detailsBooking && (
        <DetailsModal
          booking={detailsBooking}
          onClose={() => setDetailsBooking(null)}
          onApprove={() => setApproveTarget(detailsBooking)}
          onReject={() => setRejectTarget(detailsBooking)}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        danger
        busy={cancelling}
        title="Cancel this booking?"
        message={
          cancelTarget
            ? `This will cancel ${cancelTarget.clientName}'s booking for ${cancelTarget.roomName} starting ${formatDateLong(cancelTarget.startDate)}. This can't be undone.`
            : ""
        }
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        busy={deleting}
        title="Delete this booking?"
        message={deleteTarget
          ? `This will permanently remove booking ${deleteTarget.id} for ${deleteTarget.clientName} from booking lists.`
          : ""}
        confirmLabel="Delete booking"
        cancelLabel="Keep booking"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={!!approveTarget}
        busy={approving}
        title="Confirm this booking?"
        message={
          approveTarget
            ? `This will approve ${approveTarget.clientName}'s booking for ${approveTarget.roomName} and notify them.`
            : ""
        }
        confirmLabel="Yes, confirm booking"
        cancelLabel="Not yet"
        onConfirm={confirmApprove}
        onCancel={() => setApproveTarget(null)}
      />

      <ConfirmDialog
        open={!!rejectTarget}
        danger
        busy={rejecting}
        title="Cancel this booking?"
        message={
          rejectTarget
            ? `This will cancel ${rejectTarget.clientName}'s booking request for ${rejectTarget.roomName} and notify them.`
            : ""
        }
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        onConfirm={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 align-middle">
            <Icon name="check" className="h-3 w-3" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
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

function Filters({ filters, setFilters, query, setQuery, roomOptions, onReset, active }) {
  function set(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={STATUS_FILTER_OPTIONS} />
          <Select label="Room" value={filters.room} onChange={(v) => set("room", v)} options={["All", ...roomOptions]} />
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search booking ID, client, room…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 sm:self-auto"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  // Options may be plain strings (e.g. room names) or { value, label }
  // pairs (e.g. status filter, where the stored value and the label
  // shown to Admin differ — "PENDING" displays as "Pending Approval").
  const normalized = options.map((opt) =>
    typeof opt === "object" && opt !== null ? opt : { value: opt, label: String(opt).replace(/_/g, " ") }
  );
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      >
        {normalized.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ hasAny, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="calendar" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No bookings match your filters" : "No bookings yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny
          ? "Try clearing filters or searching for something else."
          : "Once clients start booking rooms, they'll show up here."}
      </p>
      {hasAny && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function BookingTable({ bookings, onView, onCancel, onDelete, onApprove, onReject }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Booking ID</th>
              <th className="px-4 py-3">Client / Company</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Start</th>
              <th className="px-4 py-3">End</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const pendingApproval = isPendingApproval(b);
              const cancelled = b.bookingStatus === BOOKING_STATUS.CANCELLED;
              return (
                <tr
                  key={b.id}
                  onClick={() => onView(b)}
                  className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/30"
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{b.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{b.clientName}</p>
                    {(b.guestEmail || b.clientEmail) && (
                      <p className="text-[11px] text-slate-400">{b.guestEmail || b.clientEmail}</p>
                    )}
                    {b.guestCompany && <p className="text-[11px] text-slate-400">{b.guestCompany}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{b.roomName}</p>
                    <p className="text-[11px] text-slate-400">
                      {b.roomNumber} &middot; Floor {b.floor}
                    </p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatDateShort(b.startDate)}
                    {b.startDate !== b.endDate && <> &rarr; {formatDateShort(b.endDate)}</>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatTime12h(b.startTime)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatTime12h(b.endTime)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={bookingBadgeStatus(b)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {pendingApproval ? (
                        <>
                          <button type="button" onClick={() => onView(b)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">View</button>
                          <button
                            type="button"
                            onClick={() => onApprove(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => onReject(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onView(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          {(!cancelled) && <button
                            type="button"
                            onClick={() => onCancel(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Cancel
                          </button>}
                          {cancelled && <button type="button" onClick={() => onApprove(b)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50">Confirm</button>}
                          <button
                            type="button"
                            onClick={() => onDelete(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BookingCard({ booking: b, onView, onCancel, onDelete, onApprove, onReject }) {
  const pendingApproval = isPendingApproval(b);
  const cancelled = b.bookingStatus === BOOKING_STATUS.CANCELLED;
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onView} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{b.id}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{b.roomName}</h3>
          <p className="truncate text-xs text-slate-500">{b.clientName}</p>
          {(b.guestEmail || b.clientEmail) && (
            <p className="truncate text-[11px] text-slate-400">{b.guestEmail || b.clientEmail}</p>
          )}
          {b.guestCompany && <p className="truncate text-[11px] text-slate-400">{b.guestCompany}</p>}
        </div>
        <StatusBadge status={bookingBadgeStatus(b)} />
      </div>

      <div className="mb-3 space-y-1.5 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
          From {formatDateLong(b.startDate)}, {formatTime12h(b.startTime)}
        </p>
        <p className="flex items-center gap-1.5">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
          To {formatDateLong(b.endDate)}, {formatTime12h(b.endTime)}
        </p>
        <p className="flex items-center gap-1.5 font-semibold text-slate-700">
          <Icon name="rupee" className="h-3.5 w-3.5 text-slate-400" />
          ₹{(b.totalAmount || 0).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
        <StatusBadge status={b.paymentStatus} />
        <div className="flex items-center gap-3">
          {pendingApproval ? (
            <>
              <button type="button" onClick={onView} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View</button>
              <button type="button" onClick={onApprove} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                Confirm
              </button>
              <button type="button" onClick={onReject} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
                Cancel
              </button>
              <button type="button" onClick={onDelete} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
                Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onView} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View Details
              </button>
              {!cancelled && (
              <button type="button" onClick={onCancel} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
                Cancel
              </button>
              )}
              {cancelled && <button type="button" onClick={onApprove} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">Confirm</button>}
              <button type="button" onClick={onDelete} className="text-xs font-semibold text-rose-500 hover:text-rose-600">
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function DetailsModal({ booking, onClose, onApprove, onReject }) {
  const room = getRoomById(booking.roomId);
  const pendingApproval = isPendingApproval(booking);
  const cancelled = booking.bookingStatus === BOOKING_STATUS.CANCELLED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{booking.id}</p>
            <h3 className="text-base font-semibold text-slate-900">{booking.roomName}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {pendingApproval && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This booking request is awaiting your approval.</span>
          </div>
        )}

        <div className="space-y-2.5 text-sm">
          <DetailRow label="Customer" value={booking.clientName} />
          {(booking.guestEmail || booking.clientEmail) && (
            <DetailRow label="Email" value={booking.guestEmail || booking.clientEmail} />
          )}
          {booking.guestPhone && <DetailRow label="Phone" value={booking.guestPhone} />}
          {booking.guestCompany && <DetailRow label="Company" value={booking.guestCompany} />}
          <DetailRow label="Room" value={`${booking.roomNumber}, Floor ${booking.floor}`} />
          <DetailRow label="From" value={`${formatDateLong(booking.startDate)}, ${formatTime12h(booking.startTime)}`} />
          <DetailRow label="To" value={`${formatDateLong(booking.endDate)}, ${formatTime12h(booking.endTime)}`} />
          <DetailRow label="Duration" value={formatDuration(booking.durationHours)} />
          {booking.amenities?.length > 0 && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-slate-500">Amenities</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {booking.amenities.map((id) => (
                  <span key={id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {AMENITY_MAP[id]?.label || id}
                  </span>
                ))}
              </div>
            </div>
          )}
          <DetailRow label="Price / hour" value={`₹${(booking.pricePerHour || 0).toLocaleString("en-IN")}`} />
          <DetailRow label="Payment method" value={booking.paymentMethod?.toUpperCase() || "—"} />
          {room && <DetailRow label="Room capacity" value={`${room.capacity} people`} />}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="text-slate-500">Booking status</span>
            <StatusBadge status={bookingBadgeStatus(booking)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Payment status</span>
            <StatusBadge status={booking.paymentStatus} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-base font-bold text-slate-900">
            <span>Total Amount</span>
            <span>₹{(booking.totalAmount || 0).toLocaleString("en-IN")}</span>
          </div>
        </div>

        {(pendingApproval || cancelled) ? (
          <div className="mt-6 flex items-center gap-3">
            {pendingApproval && <button
              type="button"
              onClick={onReject}
              className="flex-1 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >Cancel</button>}
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Confirm
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
