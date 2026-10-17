import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import Icon from "../components/icons/Icon";
import Stepper from "../components/booking/Stepper";
import PaymentModal from "../components/booking/PaymentModal";
import SelectionSummary from "../components/booking/SelectionSummary";
import { AMENITIES, AMENITY_MAP } from "../data/mockRooms";
import { getRoomById, ROOMS_EVENT } from "../utils/roomStorage";
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
  BOOKINGS_EVENT,
  BOOKING_STATUS,
  PAYMENT_STATUS,
} from "../utils/bookingStorage";
import { getRoomAvailability, ROOM_STATUS_EVENT, ROOM_AVAILABILITY } from "../utils/roomStatusStorage";
import { getWorstUnresolvedIssueForRoom, PRIORITY } from "../utils/issueStorage";

const TODAY = new Date().toISOString().slice(0, 10);

const GUEST_STEPS = [
  { n: 1, label: "Your Details" },
  { n: 2, label: "Start" },
  { n: 3, label: "Duration" },
  { n: 4, label: "Amenities" },
  { n: 5, label: "Summary" },
];

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

const EMPTY_VISITOR = { name: "", email: "", phone: "", company: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/**
 * Public, no-login booking REQUEST flow (route "/book/:roomId"). Visitors
 * reach this from the room-details modal on "/", fill in their contact
 * details, then pay via the same simulated PaymentModal used by the
 * authenticated client wizard. A booking record is only written after that
 * payment succeeds — it is stored as PAID + PENDING (see
 * bookingStorage.BOOKING_STATUS / PAYMENT_STATUS): payment never confirms
 * the booking by itself, it only proves payment was made. The visitor
 * still has no account and no Client Dashboard access; an Admin must
 * review and approve the request (a separate, not-yet-implemented step)
 * before it becomes a real Client + CONFIRMED booking. Room data, duration
 * math, and availability logic are all reused as-is from roomStorage /
 * bookingStorage / roomStatusStorage / issueStorage — nothing here
 * re-implements them.
 */
export default function GuestBooking() {
  const { roomId } = useParams();

  const [step, setStep] = useState(1);
  const [visitor, setVisitor] = useState(EMPTY_VISITOR);
  const [visitorErrors, setVisitorErrors] = useState({});
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [customQty, setCustomQty] = useState(1);
  const [customUnit, setCustomUnit] = useState("hours");
  const [extraAmenities, setExtraAmenities] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [statusTick, setStatusTick] = useState(0);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    seedBookingsIfEmpty();
  }, []);

  useEffect(() => {
    const bump = () => setStatusTick((t) => t + 1);
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    window.addEventListener(BOOKINGS_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
      window.removeEventListener(BOOKINGS_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  // The live room record — reused straight from roomStorage (same source
  // Admin > Rooms manages), never a second/local copy of room data.
  const room = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    statusTick;
    return getRoomById(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, statusTick]);

  const roomState = useMemo(() => {
    if (!room) return null;
    return {
      availability: getRoomAvailability(room.id),
      worstIssue: getWorstUnresolvedIssueForRoom(room.id),
    };
  }, [room, statusTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same "truly bookable" rule as the authenticated wizard: active, not
  // blocked/under maintenance, and no unresolved CRITICAL issue.
  const roomIsBookable =
    !!room &&
    room.isActive &&
    roomState?.availability.status === ROOM_AVAILABILITY.AVAILABLE &&
    roomState?.worstIssue?.priority !== PRIORITY.CRITICAL;

  const availability = useMemo(
    () => {
      // eslint-disable-next-line no-unused-expressions
      statusTick;
      return checkAvailability(room?.id, startDate, startTime, endDate, endTime);
    },
    [room, startDate, startTime, endDate, endTime, statusTick]
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

  // Same shape as BookingNew.jsx's paymentDetails — reused here so
  // PaymentModal renders identically for the guest flow.
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

  function setVisitorField(key, value) {
    setVisitor((v) => ({ ...v, [key]: value }));
  }

  function validateVisitor() {
    const next = {};
    if (!visitor.name.trim()) next.name = "Full name is required.";
    if (!visitor.email.trim()) next.email = "Email address is required.";
    else if (!EMAIL_RE.test(visitor.email.trim())) next.email = "Enter a valid email address.";
    if (!visitor.phone.trim()) next.phone = "Phone number is required.";
    else if (visitor.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a valid phone number.";
    setVisitorErrors(next);
    return Object.keys(next).length === 0;
  }

  function toggleAmenity(id) {
    if (room?.includedAmenities.includes(id)) return;
    setExtraAmenities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function applyPreset(qty, unit) {
    if (!startDate || !startTime) return;
    const result = addDuration(startDate, startTime, qty, unit);
    setEndDate(result.date);
    setEndTime(result.time);
  }

  const stepValid = {
    1: roomIsBookable && visitor.name.trim() && EMAIL_RE.test(visitor.email.trim()) && visitor.phone.trim(),
    2: roomIsBookable && !!startDate && !!startTime,
    3: roomIsBookable && !!endDate && !!endTime && duration > 0 && availability.available === true,
    4: roomIsBookable,
    5: roomIsBookable && availability.available === true,
  }[step];

  function goNext() {
    if (step === 1 && !validateVisitor()) return;
    if (!stepValid) return;
    setStep((s) => Math.min(5, s + 1));
  }
  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  // Opens the payment step instead of writing a booking directly — a guest
  // booking request is only ever created once payment has gone through
  // (see handlePaymentSuccess below).
  function handleProceedToPayment() {
    setBookingError("");
    if (!roomIsBookable || !validateVisitor()) return;
    if (!startDate || !startTime || !endDate || !endTime || duration <= 0) return;
    if (!checkAvailability(room.id, startDate, startTime, endDate, endTime).available) {
      setStatusTick((tick) => tick + 1);
      setBookingError("This room was just booked for that time. Choose another time to continue.");
      setStep(3);
      return;
    }
    setShowPayment(true);
  }

  // Fires once PaymentModal's simulated checkout succeeds. Paying never
  // confirms a public booking request by itself — it only proves payment
  // was made. bookingStatus stays PENDING until an Admin reviews and
  // approves it; that approval step (and turning the visitor into a real
  // Client account) is handled elsewhere, not here.
  async function handlePaymentSuccess(method) {
    const booking = {
      id: generateBookingId(),
      // No client account exists yet — the visitor's own details are
      // stored directly. clientName mirrors the guest name so existing
      // admin screens (which read booking.clientName) still show something
      // meaningful without any changes there. Email is kept front and
      // center since it's what the Admin-approval step will use to match
      // this request to (or create) a Client account.
      clientId: null,
      clientName: visitor.name.trim(),
      guestName: visitor.name.trim(),
      guestEmail: visitor.email.trim(),
      guestPhone: visitor.phone.trim(),
      guestCompany: visitor.company.trim(),
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
      // Actual charged amounts (not just per-hour rates) so Admin can see
      // exactly what was paid without recomputing anything.
      roomCharge,
      amenityCharge,
      totalAmount,
      paymentMethod: method,
      // Payment succeeded, but that only ever means PAID — it never
      // implies the booking itself is confirmed.
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.PENDING,
      source: "public",
      createdAt: new Date().toISOString(),
    };

    const result = await createBookingIfAvailable(booking);
    if (!result.available) {
      setShowPayment(false);
      setStatusTick((tick) => tick + 1);
      setBookingError(
        result.error
          ? "We couldn't verify this time slot. Please try again."
          : "This room was booked by someone else while checkout was open. Choose another time."
      );
      setStep(3);
      return;
    }
    setShowPayment(false);
    setSubmitted(result.booking);
  }

  // ---- Room missing / no longer exists ----
  if (!room) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Icon name="ban" className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Room not found</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            This room may have been removed from the catalog. Please pick another one.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Back to Rooms
          </Link>
        </div>
      </PublicLayout>
    );
  }

  // ---- Submitted confirmation ----
  // Payment succeeded, but that is NOT the same as the booking being
  // confirmed — this screen deliberately never says "Booking Confirmed".
  // The request now sits at PAID + PENDING until an Admin reviews it.
  if (submitted) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name="checkCircle" className="h-9 w-9" strokeWidth={1.6} />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Payment Successful</h2>
            <p className="mt-1.5 text-sm text-slate-500">Your booking request has been submitted.</p>
            <p className="mt-3 text-sm text-slate-500">
              Booking ID: <span className="font-mono font-semibold text-slate-700">{submitted.id}</span>
            </p>

            <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Room</span>
                <span className="font-medium text-slate-800">
                  {submitted.roomName} ({submitted.roomNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-800">
                  {submitted.startDate === submitted.endDate
                    ? formatDateLong(submitted.startDate)
                    : `${formatDateLong(submitted.startDate)} – ${formatDateLong(submitted.endDate)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-800">
                  {formatTime12h(submitted.startTime)} – {formatTime12h(submitted.endTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duration</span>
                <span className="font-medium text-slate-800">{formatDuration(submitted.durationHours)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-bold text-slate-900">₹{submitted.totalAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Status</p>
              <p className="mt-0.5 text-sm font-semibold text-amber-800">Waiting for Admin Confirmation</p>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Your account will become an approved Client after the administrator confirms your booking. Once
              confirmed, sign in with this email and the password <span className="font-mono">123456</span> to reach
              your Client Dashboard.
            </p>

            <p className="mt-3 text-xs text-slate-400">
              We'll reach out at <span className="font-medium text-slate-500">{submitted.guestEmail}</span> once
              your request has been reviewed.
            </p>

            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Back to Rooms
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <p className="font-mono text-xs tracking-[0.25em] text-indigo-500">BOOKING REQUEST</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {room.name} <span className="font-normal text-slate-400">({room.roomNumber})</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            No account needed to request a booking. After payment, an administrator will review and confirm it.
          </p>
        </div>

        {!roomIsBookable && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            <Icon name="ban" className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              This room is currently unavailable for booking
              {roomState?.availability.status === ROOM_AVAILABILITY.MAINTENANCE ? " (under maintenance)" : ""}.
              Please{" "}
              <Link to="/" className="underline">
                choose another room
              </Link>
              .
            </span>
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <Stepper current={step} steps={GUEST_STEPS} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {step === 1 && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Your details</h2>
                  <p className="mb-5 text-xs text-slate-500">
                    So we can identify you as the client once this request is approved.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full Name" error={visitorErrors.name}>
                      <input
                        type="text"
                        value={visitor.name}
                        onChange={(e) => setVisitorField("name", e.target.value)}
                        placeholder="Jane Doe"
                        className={inputClass(visitorErrors.name)}
                      />
                    </Field>
                    <Field label="Email Address" error={visitorErrors.email}>
                      <input
                        type="email"
                        value={visitor.email}
                        onChange={(e) => setVisitorField("email", e.target.value)}
                        placeholder="jane@company.com"
                        className={inputClass(visitorErrors.email)}
                      />
                    </Field>
                    <Field label="Phone Number" error={visitorErrors.phone}>
                      <input
                        type="tel"
                        value={visitor.phone}
                        onChange={(e) => setVisitorField("phone", e.target.value)}
                        placeholder="+91 98765 43210"
                        className={inputClass(visitorErrors.phone)}
                      />
                    </Field>
                    <Field label="Company / Organization" optional>
                      <input
                        type="text"
                        value={visitor.company}
                        onChange={(e) => setVisitorField("company", e.target.value)}
                        placeholder="Acme Inc."
                        className={inputClass()}
                      />
                    </Field>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">When do you want to start?</h2>
                  <p className="mb-5 text-xs text-slate-500">
                    Pick the start date and time for {room.name}. You'll choose how long to stay next.
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
                        className={inputClass()}
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
                        className={inputClass()}
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

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Quick durations
                  </p>
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
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-600">End time</label>
                      <input
                        type="time"
                        step={900}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className={inputClass()}
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
                          <p className="font-semibold">Room Available for {formatDuration(duration)} ✓</p>
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

              {step === 4 && (
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

              {step === 5 && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-slate-900">Booking summary</h2>
                  <p className="mb-5 text-xs text-slate-500">Review the details before submitting your request.</p>

                  <div className="space-y-3 text-sm">
                    <SummaryRow label="Name" value={visitor.name} />
                    <SummaryRow label="Email" value={visitor.email} />
                    <SummaryRow label="Phone" value={visitor.phone} />
                    {visitor.company && <SummaryRow label="Company" value={visitor.company} />}
                    <div className="border-t border-slate-100 pt-3">
                      <SummaryRow label="Room" value={`${room.name} (${room.roomNumber}, Floor ${room.floor})`} />
                    </div>
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

                  <p className="mt-4 text-xs text-slate-400">
                    Paying does not confirm your booking. Your request will be held as pending until an
                    administrator reviews and approves it.
                  </p>
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
                  onClick={handleProceedToPayment}
                  disabled={!stepValid || !roomIsBookable || !availability.available || duration <= 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Icon name="creditCard" className="h-4 w-4" />
                  Continue to Payment
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
      </div>

      {showPayment && (
        <PaymentModal
          amount={totalAmount}
          details={paymentDetails}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          // This is a public booking request, not a confirmed booking —
          // never claim "Booking Confirmed" here.
          successSubtitle="Request Submitted ✓"
        />
      )}
    </PublicLayout>
  );
}

function Field({ label, error, optional, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {optional && <span className="text-slate-300">(optional)</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function inputClass(error) {
  return `w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-4 ${
    error
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
      : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-50"
  }`;
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
