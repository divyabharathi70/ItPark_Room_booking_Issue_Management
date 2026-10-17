import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import Stepper from "../../components/booking/Stepper";
import RoomCard from "../../components/booking/RoomCard";
import PaymentModal from "../../components/booking/PaymentModal";
import StatusBadge from "../../components/booking/StatusBadge";
import SelectionSummary from "../../components/booking/SelectionSummary";
import { AMENITIES, AMENITY_MAP } from "../../data/mockRooms";
import { ROLES } from "../../data/mockUsers";
import {
  addDuration,
  calculateBookingPrice,
  checkAvailability,
  createBookingIfAvailable,
  durationHours,
  DURATION_UNITS,
  formatDuration,
  generateBookingId,
  seedBookingsIfEmpty,
  updateBooking,
  BOOKING_STATUS,
  BOOKINGS_EVENT,
  PAYMENT_STATUS,
} from "../../utils/bookingStorage";
import { getRoomAvailability, ROOM_STATUS_EVENT, ROOM_AVAILABILITY } from "../../utils/roomStatusStorage";
import { getAllRooms, ROOMS_EVENT } from "../../utils/roomStorage";
import { getWorstUnresolvedIssueForRoom, PRIORITY } from "../../utils/issueStorage";
import { createNotification, NOTIFICATION_TYPES } from "../../utils/notificationStorage";

const TODAY = new Date().toISOString().slice(0, 10);

const PRESETS = [
  { label: "1 Hour", qty: 1, unit: "hours" },
  { label: "4 Hours", qty: 4, unit: "hours" },
  { label: "1 Day", qty: 1, unit: "days" },
  { label: "1 Week", qty: 1, unit: "weeks" },
  { label: "1 Month", qty: 1, unit: "months" },
  { label: "6 Months", qty: 6, unit: "months" },
  { label: "1 Year", qty: 1, unit: "years" },
  { label: "5 Years", qty: 5, unit: "years" },
];

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

export default function BookingNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Only an approved client has a Client Dashboard / "My Bookings" page. A
  // signed-up user reaching this wizard from the public site (/book-room)
  // does not, so the screens below adapt their wording and buttons.
  const isApprovedClient = user.role === ROLES.CLIENT;

  const [step, setStep] = useState(1);
  const [roomId, setRoomId] = useState(null);
  // Tracks whether we've already applied a ?roomId=... coming from the
  // public site (Book Now -> signup/login -> back here), so it only ever
  // pre-selects the room once and never fights the user's own choices.
  const appliedRoomFromQueryRef = useRef(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customUnit, setCustomUnit] = useState("hours");
  const [extraAmenities, setExtraAmenities] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [bookingRequest, setBookingRequest] = useState(null);
  const [bookingError, setBookingError] = useState("");
  const [reserving, setReserving] = useState(false);
  // Bumped whenever room maintenance/block state changes elsewhere in the
  // app (admin blocking a room, an issue getting resolved, a critical
  // issue being reported) so this page's room list refreshes live instead
  // of only on the next navigation/page load.
  const [statusTick, setStatusTick] = useState(0);

  useEffect(() => {
    seedBookingsIfEmpty();
  }, []);

  useEffect(() => {
    const bump = () => setStatusTick((t) => t + 1);
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    window.addEventListener(BOOKINGS_EVENT, bump);
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
      window.removeEventListener(BOOKINGS_EVENT, bump);
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
    };
  }, []);

  // The live room catalog (admin-managed via Admin > Rooms / roomStorage.js)
  // — recomputed whenever statusTick changes so a newly added, edited, or
  // removed room (and any price change) is reflected without a full reload.
  const rooms = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    statusTick;
    return getAllRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusTick]);

  // Live availability + unresolved-issue warning for every room, keyed by
  // room id — recomputed whenever statusTick changes so newly-created
  // critical issues or admin block/unblock actions are reflected without
  // a full reload.
  const roomState = useMemo(() => {
    const map = {};
    rooms.forEach((r) => {
      const availability = getRoomAvailability(r.id);
      const worstIssue = getWorstUnresolvedIssueForRoom(r.id);
      map[r.id] = { availability, worstIssue };
    });
    return map;
  }, [rooms]);

  // Pre-select the room carried over from the public site (Book Now on
  // "/", "/rooms" or "/rooms/:roomId" for a room chosen before the user
  // had an account/session — see pendingBookingStorage.js). Runs once the
  // live room catalog is available, then clears the query param so a
  // later refresh doesn't re-trigger it and doesn't fight manual changes.
  useEffect(() => {
    if (appliedRoomFromQueryRef.current) return;
    const preselectId = searchParams.get("roomId");
    if (!preselectId || rooms.length === 0) return;

    appliedRoomFromQueryRef.current = true;
    const match = rooms.find((r) => r.id === preselectId);
    if (match) {
      setRoomId(preselectId);
      // Only skip ahead past room selection if it's actually bookable right
      // now — otherwise leave the user on step 1, where the existing
      // unavailable/critical-issue messaging for the selected room shows.
      const availability = getRoomAvailability(match.id);
      const worstIssue = getWorstUnresolvedIssueForRoom(match.id);
      const bookable =
        match.isActive &&
        availability.status === ROOM_AVAILABILITY.AVAILABLE &&
        worstIssue?.priority !== PRIORITY.CRITICAL;
      if (bookable) setStep(2);
    }
    setSearchParams({}, { replace: true });
  }, [rooms, searchParams, setSearchParams]);

  const room = useMemo(() => rooms.find((r) => r.id === roomId) || null, [roomId, rooms]);
  const selectedRoomState = roomId ? roomState[roomId] : null;
  // A room can only truly be booked when it's both AVAILABLE in the
  // maintenance sense AND has no unresolved CRITICAL issue directly
  // against it (covers the edge case of an admin unblocking a room while
  // its triggering critical issue is still open).
  const roomIsBookable =
    !!room &&
    room.isActive &&
    selectedRoomState?.availability.status === ROOM_AVAILABILITY.AVAILABLE &&
    selectedRoomState?.worstIssue?.priority !== PRIORITY.CRITICAL;

  const availability = useMemo(
    () => {
      // eslint-disable-next-line no-unused-expressions
      statusTick;
      return checkAvailability(roomId, startDate, startTime, endDate, endTime);
    },
    [roomId, startDate, startTime, endDate, endTime, statusTick]
  );

  const duration = durationHours(startDate, startTime, endDate, endTime);

  const allSelectedAmenities = useMemo(() => {
    if (!room) return [];
    return Array.from(new Set([...room.includedAmenities, ...extraAmenities]));
  }, [room, extraAmenities]);

  // ONE price calculation (see bookingStorage.calculateBookingPrice) feeds the
  // "Your selection" card, the summary step, the payment modal and the saved
  // booking - so the amount is the same everywhere.
  const pricing = useMemo(
    () => calculateBookingPrice(room, duration, extraAmenities),
    [room, duration, extraAmenities]
  );
  const { amenityChargePerHour, roomCharge, amenityCharge, totalAmount } = pricing;

  const paymentDetails = useMemo(() => {
    if (!room) return null;
    return {
      roomName: room.name,
      roomNumber: room.roomNumber,
      dateLabel:
        startDate === endDate
          ? formatDateLong(startDate)
          : `${formatDateLong(startDate)} – ${formatDateLong(endDate)}`,
      startTimeLabel: formatTime12h(startTime),
      endTimeLabel: formatTime12h(endTime),
      durationLabel: formatDuration(duration),
      roomCharge,
      amenityCharge,
      totalAmount,
    };
  }, [room, startDate, endDate, startTime, endTime, duration, roomCharge, amenityCharge, totalAmount]);

  function toggleAmenity(id) {
    if (room?.includedAmenities.includes(id)) return; // already included, can't toggle off
    setExtraAmenities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function applyPreset(qty, unit) {
    if (!startDate || !startTime) return;
    const result = addDuration(startDate, startTime, qty, unit);
    setEndDate(result.date);
    setEndTime(result.time);
  }

  const stepValid = {
    1: roomIsBookable,
    2: roomIsBookable && !!startDate && !!startTime,
    3: roomIsBookable && !!endDate && !!endTime && duration > 0 && availability.available === true,
    4: roomIsBookable,
    5: roomIsBookable && availability.available === true,
  }[step];

  function goNext() {
    if (!stepValid) return;
    setStep((s) => Math.min(5, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  function handlePaymentSuccess(method) {
    const booking = updateBooking(bookingRequest.id, {
      paymentMethod: method,
      paymentStatus: PAYMENT_STATUS.PAID,
    });
    createNotification({
      recipientId: user.id,
      recipientRole: user.role,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
      message: `Payment for Booking #${booking.id} was successful.`,
      relatedId: booking.id,
      relatedType: "booking",
    });
    setShowPayment(false);
    setConfirmedBooking(booking);
  }

  async function continueToPayment() {
    setBookingError("");
    if (!roomIsBookable || !checkAvailability(roomId, startDate, startTime, endDate, endTime).available) {
      setStatusTick((tick) => tick + 1);
      setBookingError("This room was just booked for that time. Choose another time to continue.");
      setStep(3);
      return;
    }
    if (!bookingRequest) {
      const booking = {
        id: generateBookingId(),
        clientId: user.id,
        clientName: user.name,
        clientEmail: user.email,
        roomId: room.id,
        roomName: room.name,
        roomNumber: room.roomNumber,
        floor: room.floor,
        startDate,
        startTime,
        endDate,
        endTime,
        durationHours: duration,
        amenities: allSelectedAmenities,
        pricePerHour: room.pricePerHour,
        amenityChargePerHour,
        roomCharge,
        amenityCharge,
        totalAmount,
        // Send the request to Admin as soon as the customer continues to
        // checkout. Payment can then be completed while approval is pending.
        paymentStatus: PAYMENT_STATUS.PENDING,
        bookingStatus: BOOKING_STATUS.PENDING,
        createdAt: new Date().toISOString(),
      };
      setReserving(true);
      const result = await createBookingIfAvailable(booking);
      setReserving(false);
      if (!result.available) {
        setStatusTick((tick) => tick + 1);
        setBookingError(
          result.error
            ? "We couldn't verify this time slot. Please try again."
            : "This room was just booked for that time. Choose another time to continue."
        );
        setStep(3);
        return;
      }
      setBookingRequest(result.booking);
    }
    setShowPayment(true);
  }

  // ---- Confirmation screen ----
  if (confirmedBooking) {
    return (
      <div>
        <PageHeader
          eyebrow="Room Booking"
          title="Booking Request Submitted"
        />
        <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="checkCircle" className="h-9 w-9" strokeWidth={1.6} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Booking Request Submitted Successfully</h2>
          <p className="mt-1 text-sm text-slate-500">
            Booking <span className="font-mono font-semibold text-slate-700">{confirmedBooking.id}</span> has been
            paid and is now awaiting Admin approval.
          </p>

          <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Booking ID</span>
              <span className="font-mono font-medium text-slate-800">{confirmedBooking.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Room</span>
              <span className="font-medium text-slate-800">
                {confirmedBooking.roomName} ({confirmedBooking.roomNumber})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">From</span>
              <span className="font-medium text-slate-800">
                {formatDateLong(confirmedBooking.startDate)}, {formatTime12h(confirmedBooking.startTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">To</span>
              <span className="font-medium text-slate-800">
                {formatDateLong(confirmedBooking.endDate)}, {formatTime12h(confirmedBooking.endTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span className="font-medium text-slate-800">{formatDuration(confirmedBooking.durationHours)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500">Amount Paid</span>
              <span className="font-bold text-slate-900">₹{confirmedBooking.totalAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Status</span>
              <StatusBadge status={confirmedBooking.paymentStatus} />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Booking Status</span>
              <StatusBadge status="PENDING_APPROVAL" />
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            An administrator will review your request shortly. You'll be notified once it's confirmed.
          </p>
          {!isApprovedClient && (
            <p className="mt-2 text-xs text-slate-500">
              Your Client Dashboard unlocks after the administrator accepts this booking. Sign in again with the
              same email once it has been approved.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Back to Home
            </button>
            {isApprovedClient && (
              <button
                type="button"
                onClick={() => navigate("/client/bookings")}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                View My Bookings
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Room Booking"
        title="Book a Room"
        description="Pick a room, choose your start time and how long you need it, then confirm with a simulated payment."
      />

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <Stepper current={step} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            {step === 1 && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Select a room</h2>
                <p className="mb-5 text-xs text-slate-500">Choose the space that fits your meeting.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {rooms.map((r) => {
                    const state = roomState[r.id];
                    return (
                      <RoomCard
                        key={r.id}
                        room={r}
                        selected={roomId === r.id}
                        onSelect={setRoomId}
                        availabilityStatus={state?.availability.status}
                        issueWarning={
                          state?.worstIssue && state.worstIssue.priority !== PRIORITY.CRITICAL
                            ? state.worstIssue
                            : null
                        }
                      />
                    );
                  })}
                </div>

                {room && !roomIsBookable && (
                  <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    <Icon name="ban" className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      🚫{" "}
                      {selectedRoomState?.availability.status === ROOM_AVAILABILITY.BLOCKED
                        ? "This room is unavailable due to a critical issue."
                        : "Room unavailable due to critical maintenance."}
                    </span>
                  </div>
                )}

                {room &&
                  roomIsBookable &&
                  selectedRoomState?.worstIssue &&
                  selectedRoomState.worstIssue.priority === PRIORITY.HIGH && (
                    // Large warning banner. The icon sits in its own fixed-size
                    // circle (it never shrinks or wraps) and the text takes the
                    // remaining width, so the two stay aligned on every screen
                    // size - on phones the text just wraps to more lines.
                    <div
                      role="alert"
                      className="mt-6 flex w-full items-center gap-3 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-sm sm:gap-4 sm:p-5"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl leading-none text-orange-600 ring-2 ring-orange-300 sm:h-14 sm:w-14 sm:text-3xl"
                      >
                        ⚠
                      </span>{" "}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold leading-snug text-orange-800 sm:text-base">
                          Warning: This room has a high-priority maintenance issue.
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-orange-700 sm:text-sm">
                          Reported issue: {selectedRoomState.worstIssue.category}
                        </p>
                      </div>
                    </div>
                  )}

                {room &&
                  roomIsBookable &&
                  selectedRoomState?.worstIssue &&
                  (selectedRoomState.worstIssue.priority === PRIORITY.LOW ||
                    selectedRoomState.worstIssue.priority === PRIORITY.MEDIUM) && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                      <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
                      <span>
                        ⚠ This room currently has an unresolved {selectedRoomState.worstIssue.category} issue.
                      </span>
                    </div>
                  )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">When do you want to start?</h2>
                <p className="mb-5 text-xs text-slate-500">
                  Pick the start date and time for {room?.name}. You'll choose how long to stay next.
                </p>
                <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Start date</label>
                    <input
                      type="date"
                      min={TODAY}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setEndDate("");
                        setEndTime("");
                      }}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Start time</label>
                    <input
                      type="time"
                      step={900}
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setEndDate("");
                        setEndTime("");
                      }}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">How long do you need it?</h2>
                <p className="mb-5 text-xs text-slate-500">
                  Starting {formatDateLong(startDate)} at {formatTime12h(startTime)}. Pick a quick duration, set a
                  custom one, or fine-tune the exact end date &amp; time.
                </p>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick durations</p>
                <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PRESETS.map((p) => {
                    const preview = addDuration(startDate, startTime, p.qty, p.unit);
                    const active = endDate === preview.date && endTime === preview.time;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyPreset(p.qty, p.unit)}
                        className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                          active
                            ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                            : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Or a custom duration
                </p>
                <div className="mb-5 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Amount</label>
                    <input
                      type="number"
                      min={1}
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value)}
                      className="w-24 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">Unit</label>
                    <select
                      value={customUnit}
                      onChange={(e) => setCustomUnit(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    >
                      {DURATION_UNITS.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => applyPreset(Number(customQty) || 0, customUnit)}
                    disabled={!customQty || Number(customQty) <= 0}
                    className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    Apply
                  </button>
                </div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fine-tune exact end date &amp; time
                </p>
                <div className="grid gap-4 sm:grid-cols-2 sm:max-w-md">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">End date</label>
                    <input
                      type="date"
                      min={startDate || TODAY}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">End time</label>
                    <input
                      type="time"
                      step={900}
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                    />
                  </div>
                </div>

                {endDate && endTime && (
                  <div
                    className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                      duration <= 0
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : availability.available
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    <Icon
                      name={duration > 0 && availability.available ? "checkCircle" : "ban"}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <div>
                      {duration <= 0 ? (
                        <p className="font-semibold">End date &amp; time must be after the start.</p>
                      ) : availability.available ? (
                        <p className="font-semibold">
                          Room Available for {formatDuration(duration)} ✓
                        </p>
                      ) : (
                        <>
                          <p className="font-semibold">Room is already booked during part of this period.</p>
                          {availability.conflict && (
                            <p className="mt-0.5 text-xs text-rose-600">
                              Already reserved {formatDateLong(availability.conflict.startDate)}{" "}
                              {formatTime12h(availability.conflict.startTime)} –{" "}
                              {formatDateLong(availability.conflict.endDate)}{" "}
                              {formatTime12h(availability.conflict.endTime)}. Please choose another window.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 4 && room && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Select amenities</h2>
                <p className="mb-5 text-xs text-slate-500">
                  Some amenities are already included with this room at no extra cost.
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {AMENITIES.map((a) => {
                    const included = room.includedAmenities.includes(a.id);
                    const checked = included || extraAmenities.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAmenity(a.id)}
                        disabled={included}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          checked
                            ? "border-indigo-300 bg-indigo-50/60"
                            : "border-slate-200 bg-white hover:border-indigo-200"
                        } ${included ? "cursor-default" : ""}`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                              checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"
                            }`}
                          >
                            <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                          </span>
                          <Icon name={a.icon} className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium text-slate-700">{a.label}</span>
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {included ? (
                            <span className="text-emerald-600">Included</span>
                          ) : a.pricePerHour === 0 ? (
                            "Free"
                          ) : (
                            `+₹${a.pricePerHour}/hr`
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 5 && room && (
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">Booking summary</h2>
                <p className="mb-5 text-xs text-slate-500">Review the details before you pay.</p>

                <div className="space-y-3 text-sm">
                  <SummaryRow label="Room" value={`${room.name} (${room.roomNumber}, Floor ${room.floor})`} />
                  <SummaryRow label="From" value={`${formatDateLong(startDate)}, ${formatTime12h(startTime)}`} />
                  <SummaryRow label="To" value={`${formatDateLong(endDate)}, ${formatTime12h(endTime)}`} />
                  <SummaryRow label="Duration" value={formatDuration(duration)} />
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500">Amenities</span>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {allSelectedAmenities.map((id) => (
                        <span
                          key={id}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {AMENITY_MAP[id].label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Room charge ({formatDuration(duration)} × ₹{room.pricePerHour}/hr)</span>
                    <span className="text-slate-700">₹{roomCharge.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Amenity charges</span>
                    <span className="text-slate-700">₹{Math.round(amenityCharge).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                    <span>Total Amount</span>
                    <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step nav */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={step === 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icon name="chevronLeft" className="h-4 w-4" />
              Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!stepValid}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Next
                <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={continueToPayment}
                disabled={!stepValid || reserving}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Icon name="creditCard" className="h-4 w-4" />
                {reserving ? "Checking availability…" : "Continue to Payment"}
              </button>
            )}
          </div>
          {bookingError && (
            <p role="alert" className="mt-3 text-right text-sm font-medium text-rose-600">{bookingError}</p>
          )}
        </div>

        {/* Live price sidebar */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <SelectionSummary
            room={room}
            startDate={startDate}
            startTime={startTime}
            endDate={endDate}
            endTime={endTime}
            duration={duration}
            pricing={pricing}
          />
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          amount={totalAmount}
          details={paymentDetails}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}
