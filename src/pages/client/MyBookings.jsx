import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { AMENITY_MAP } from "../../data/mockRooms";
import {
  addDuration,
  cancelBooking,
  checkAvailability,
  checkSharedAvailability,
  durationHours,
  getBookingsForClient,
  syncCompletedBookings,
  formatDuration,
  toTimestamp,
  DURATION_UNITS,
  BOOKINGS_EVENT,
  BOOKING_STATUS,
  PAYMENT_STATUS,
} from "../../utils/bookingStorage";
import { getEligibleBookingsForIssue } from "../../utils/issueStorage";
import {
  createExtendRequest,
  generateExtendRequestId,
  getExtendRequestsForBooking,
  getExtendRequestsForClient,
  EXTEND_REQUESTS_EVENT,
  EXTEND_STATUS,
} from "../../utils/extendRequestStorage";

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

const TABS = ["All", "Pending", "Upcoming", "Confirmed", "Cancelled"];

/** A booking only ever shows as "Pending Approval" once it's actually been
 * paid — mirrors isPendingApproval() in Admin > Bookings. Display-only:
 * the underlying stored bookingStatus stays PENDING either way. */
function isPendingApproval(b) {
  return b.bookingStatus === BOOKING_STATUS.PENDING && b.paymentStatus === PAYMENT_STATUS.PAID;
}
function bookingBadgeStatus(b) {
  return isPendingApproval(b) ? "PENDING_APPROVAL" : b.bookingStatus;
}

/** A CONFIRMED booking whose start hasn't arrived yet — shown under the
 * "Upcoming" tab. Once it starts, it moves to "Confirmed" (still active,
 * not yet completed); it remains CONFIRMED after the booking ends. */
function isUpcoming(b) {
  if (b.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
  const startTs = toTimestamp(b.startDate, b.startTime);
  return startTs !== null && startTs > Date.now();
}

export default function MyBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [extendRequests, setExtendRequests] = useState([]);
  const [tab, setTab] = useState("All");
  const [detailsBooking, setDetailsBooking] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [extendTarget, setExtendTarget] = useState(null);

  function refresh() {
    syncCompletedBookings();
    refreshLists();
  }

  function refreshLists() {
    setBookings(getBookingsForClient(user.id));
    setExtendRequests(getExtendRequestsForClient(user.id));
  }

  useEffect(() => {
    refresh();
    window.addEventListener(BOOKINGS_EVENT, refreshLists);
    window.addEventListener(EXTEND_REQUESTS_EVENT, refreshLists);
    window.addEventListener("storage", refreshLists);
    return () => {
      window.removeEventListener(BOOKINGS_EVENT, refreshLists);
      window.removeEventListener(EXTEND_REQUESTS_EVENT, refreshLists);
      window.removeEventListener("storage", refreshLists);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const pendingExtendBookingIds = useMemo(
    () => new Set(extendRequests.filter((r) => r.status === EXTEND_STATUS.PENDING).map((r) => r.bookingId)),
    [extendRequests]
  );
  const latestExtendRequestByBooking = useMemo(() => {
    const latest = new Map();
    extendRequests.forEach((request) => {
      if (!latest.has(request.bookingId)) latest.set(request.bookingId, request);
    });
    return latest;
  }, [extendRequests]);

  // Bookings the client is allowed to raise an issue against — mirrors
  // the exact rule the Raise Issue form itself uses, so the button here
  // never offers a booking the form would then reject.
  const raiseIssueEligibleIds = useMemo(
    () => new Set(getEligibleBookingsForIssue(user.id).map((b) => b.id)),
    // bookings is included so this recomputes after a status change (e.g.
    // admin confirms a booking, or it completes) without a page reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.id, bookings]
  );

  const filtered = useMemo(() => {
    const confirmedBookings = bookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED);
    const visibleBookings = bookings.filter((b) =>
      b.bookingStatus !== BOOKING_STATUS.PENDING ||
      !confirmedBookings.some((confirmedBooking) =>
        (b.roomId && confirmedBooking.roomId && b.roomId === confirmedBooking.roomId) ||
        (b.roomName && confirmedBooking.roomName &&
          b.roomName.trim().toLowerCase() === confirmedBooking.roomName.trim().toLowerCase())
      )
    );
    if (tab === "All") return visibleBookings;
    if (tab === "Pending") return visibleBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.PENDING);
    if (tab === "Upcoming") return visibleBookings.filter(isUpcoming);
    if (tab === "Confirmed") {
      return visibleBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED && !isUpcoming(b));
    }
    return visibleBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CANCELLED);
  }, [bookings, tab]);

  function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setTimeout(() => {
      cancelBooking(cancelTarget.id);
      setCancelling(false);
      setCancelTarget(null);
      refresh();
    }, 500);
  }

  return (
    <div>
      <PageHeader
        title="My Bookings"
        description="Everything you've booked, with live status and payment details."
        actions={
          <Link
            to="/client/bookings/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            New Booking
          </Link>
        }
      />

      <div className="mb-5 flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="clipboardList" className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No bookings here yet</p>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            Once you book a room it'll show up in this list with its live status.
          </p>
          <Link
            to="/client/bookings/new"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Book a Room
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => {
            const cancellable =
              b.bookingStatus === BOOKING_STATUS.CONFIRMED || b.bookingStatus === BOOKING_STATUS.PENDING;
            const extendable = b.bookingStatus === BOOKING_STATUS.CONFIRMED;
            const extendPending = pendingExtendBookingIds.has(b.id);
            const latestExtendRequest = latestExtendRequestByBooking.get(b.id);
            const canRaiseIssue = raiseIssueEligibleIds.has(b.id);
            return (
              <div key={b.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{b.id}</p>
                    <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{b.roomName}</h3>
                    <p className="text-xs text-slate-500">
                      {b.roomNumber} &middot; Floor {b.floor}
                    </p>
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
                  <p className="flex items-center gap-1.5">
                    <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                    {formatDuration(b.durationHours)}
                  </p>
                </div>

                <div className="mb-4 flex flex-wrap gap-1.5">
                  {b.amenities.slice(0, 4).map((id) => (
                    <span key={id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {AMENITY_MAP[id]?.label || id}
                    </span>
                  ))}
                  {b.amenities.length > 4 && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      +{b.amenities.length - 4} more
                    </span>
                  )}
                </div>

                {extendPending && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700">
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    Extension request pending admin review
                  </div>
                )}
                {!extendPending && latestExtendRequest?.status === EXTEND_STATUS.APPROVED && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                    <Icon name="checkCircle" className="h-3.5 w-3.5" />
                    Extension approved through {formatDateLong(b.endDate)}, {formatTime12h(b.endTime)}
                  </div>
                )}
                {!extendPending && latestExtendRequest?.status === EXTEND_STATUS.REJECTED && (
                  <div className="mb-3 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
                    Extension request cancelled{latestExtendRequest.adminNote ? `: ${latestExtendRequest.adminNote}` : "."}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">₹{b.totalAmount.toLocaleString("en-IN")}</p>
                    <StatusBadge status={b.paymentStatus} className="mt-1" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailsBooking(b)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      View Details
                    </button>
                    {canRaiseIssue && (
                      <button
                        type="button"
                        onClick={() => navigate(`/client/issues/new?bookingId=${encodeURIComponent(b.id)}`)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Raise Issue
                      </button>
                    )}
                    {extendable && !extendPending && (
                      <button
                        type="button"
                        onClick={() => setExtendTarget(b)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Request Extension
                      </button>
                    )}
                    {cancellable && (
                      <button
                        type="button"
                        onClick={() => setCancelTarget(b)}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details modal */}
      {detailsBooking && (
        <DetailsModal
          booking={detailsBooking}
          onClose={() => setDetailsBooking(null)}
        />
      )}

      {/* Extension request modal */}
      {extendTarget && (
        <ExtendRequestModal
          booking={extendTarget}
          onClose={() => setExtendTarget(null)}
          onSubmitted={() => {
            setExtendTarget(null);
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        danger
        busy={cancelling}
        title="Cancel this booking?"
        message={
          cancelTarget
            ? `This will cancel your booking for ${cancelTarget.roomName} starting ${formatDateLong(cancelTarget.startDate)}. This can't be undone.`
            : ""
        }
        confirmLabel="Yes, cancel booking"
        cancelLabel="Keep booking"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
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

function DetailsModal({ booking, onClose }) {
  const [history, setHistory] = useState(() => getExtendRequestsForBooking(booking.id));

  useEffect(() => {
    const refresh = () => setHistory(getExtendRequestsForBooking(booking.id));
    refresh();
    window.addEventListener(EXTEND_REQUESTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EXTEND_REQUESTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [booking.id]);

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

        <div className="space-y-2.5 text-sm">
          <DetailRow label="Room" value={`${booking.roomNumber}, Floor ${booking.floor}`} />
          <DetailRow label="From" value={`${formatDateLong(booking.startDate)}, ${formatTime12h(booking.startTime)}`} />
          <DetailRow label="To" value={`${formatDateLong(booking.endDate)}, ${formatTime12h(booking.endTime)}`} />
          <DetailRow label="Duration" value={formatDuration(booking.durationHours)} />
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
          <DetailRow label="Price / hour" value={`₹${booking.pricePerHour.toLocaleString("en-IN")}`} />
          <DetailRow label="Payment method" value={booking.paymentMethod?.toUpperCase() || "—"} />
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="text-slate-500">Booking status</span>
            <StatusBadge status={bookingBadgeStatus(booking)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Payment status</span>
            <StatusBadge status={booking.paymentStatus} />
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-base font-bold text-slate-900">
            <span>Total Paid</span>
            <span>₹{booking.totalAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Extension requests
            </p>
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      Until {formatDateLong(r.requestedEndDate)}, {formatTime12h(r.requestedEndTime)}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.reason && <p className="text-slate-500">"{r.reason}"</p>}
                  {r.status === EXTEND_STATUS.REJECTED && r.adminNote && (
                    <p className="mt-1 text-rose-500">Admin note: {r.adminNote}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExtendRequestModal({ booking, onClose, onSubmitted }) {
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("hours");
  const [requestedEndDate, setRequestedEndDate] = useState(booking.endDate);
  const [requestedEndTime, setRequestedEndTime] = useState(booking.endTime);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [availabilityTick, setAvailabilityTick] = useState(0);

  useEffect(() => {
    const refreshAvailability = () => setAvailabilityTick((tick) => tick + 1);
    window.addEventListener(BOOKINGS_EVENT, refreshAvailability);
    window.addEventListener("storage", refreshAvailability);
    window.addEventListener("focus", refreshAvailability);
    return () => {
      window.removeEventListener(BOOKINGS_EVENT, refreshAvailability);
      window.removeEventListener("storage", refreshAvailability);
      window.removeEventListener("focus", refreshAvailability);
    };
  }, []);

  function applyPreset() {
    const result = addDuration(booking.endDate, booking.endTime, Number(qty) || 0, unit);
    setRequestedEndDate(result.date);
    setRequestedEndTime(result.time);
  }

  const additionalHours = durationHours(booking.endDate, booking.endTime, requestedEndDate, requestedEndTime);
  const estimatedAdditionalAmount = Math.round(
    (booking.pricePerHour + (booking.amenityChargePerHour || 0)) * additionalHours
  );

  const availability = useMemo(
    () => {
      // eslint-disable-next-line no-unused-expressions
      availabilityTick;
      return checkAvailability(
        booking.roomId,
        booking.endDate,
        booking.endTime,
        requestedEndDate,
        requestedEndTime,
        booking.id
      );
    },
    [booking, requestedEndDate, requestedEndTime, availabilityTick]
  );

  const valid = additionalHours > 0 && availability.available === true;

  async function handleSubmit() {
    if (!valid || submitting) return;
    setError("");
    setSubmitting(true);
    const latestAvailability = await checkSharedAvailability(
      booking.roomId,
      booking.endDate,
      booking.endTime,
      requestedEndDate,
      requestedEndTime,
      booking.id
    );
    if (!latestAvailability.available) {
      setAvailabilityTick((tick) => tick + 1);
      setError(
        latestAvailability.error
          ? "We couldn't check availability. Please try again."
          : "Already booked in your requested period. Change the duration or choose another end time."
      );
      setSubmitting(false);
      return;
    }

    createExtendRequest({
      id: generateExtendRequestId(),
      bookingId: booking.id,
      clientId: booking.clientId,
      clientName: booking.clientName,
      roomId: booking.roomId,
      roomName: booking.roomName,
      roomNumber: booking.roomNumber,
      currentEndDate: booking.endDate,
      currentEndTime: booking.endTime,
      requestedEndDate,
      requestedEndTime,
      additionalHours,
      estimatedAdditionalAmount,
      reason: reason.trim(),
    });
    setSubmitting(false);
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={submitting ? undefined : onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Request Extension</p>
            <p className="text-xs text-slate-400">
              {booking.roomName} — currently ends {formatDateLong(booking.endDate)}, {formatTime12h(booking.endTime)}
            </p>
          </div>
          <button
            type="button"
            onClick={submitting ? undefined : onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-2 text-xs font-medium text-slate-600">Extend by</p>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          >
            {DURATION_UNITS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={applyPreset}
            className="rounded-xl bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Apply
          </button>
        </div>

        <p className="mb-2 text-xs font-medium text-slate-600">New end date &amp; time</p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <input
            type="date"
            min={booking.endDate}
            value={requestedEndDate}
            onChange={(e) => setRequestedEndDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
          <input
            type="time"
            step={900}
            value={requestedEndTime}
            onChange={(e) => setRequestedEndTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
          />
        </div>

        <p className="mb-2 text-xs font-medium text-slate-600">Reason (optional)</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Let the admin know why you need more time…"
          className="mb-4 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
        />

        {additionalHours > 0 && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
              availability.available
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <Icon name={availability.available ? "checkCircle" : "ban"} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              {availability.available ? (
                <p>
                  Adds {formatDuration(additionalHours)} &middot; est. +₹
                  {estimatedAdditionalAmount.toLocaleString("en-IN")} if approved.
                </p>
              ) : (
                <p>Already booked in your requested period. Change the duration or choose another end time.</p>
              )}
            </div>
          </div>
        )}
        {additionalHours <= 0 && (
          <p className="mb-4 text-xs font-medium text-rose-600">New end must be after the current end date/time.</p>
        )}
        {error && <p className="mb-4 text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!valid || submitting}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {submitting ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}
