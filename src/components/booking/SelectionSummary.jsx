import Icon from "../icons/Icon";
import { formatDuration } from "../../utils/bookingStorage";

// Small display-only helpers (same formats the booking pages already use).
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

function formatRupees(amount) {
  return `₹${(amount || 0).toLocaleString("en-IN")}`;
}

/**
 * The "Your selection" side card of the booking wizard.
 *
 * It only DISPLAYS values - the parent page owns the state and the price
 * (calculated once by bookingStorage.calculateBookingPrice) and passes them
 * in. Because of that, whatever this card shows is exactly the amount that
 * is later charged in the payment modal and saved on the booking.
 *
 * Props:
 *   room       the selected room object, or null
 *   startDate / startTime / endDate / endTime   "YYYY-MM-DD" / "HH:MM" strings ("" if not chosen yet)
 *   duration   booking length in hours (0 if not chosen yet)
 *   pricing    result of calculateBookingPrice(room, duration, extraAmenities)
 */
export default function SelectionSummary({ room, startDate, startTime, endDate, endTime, duration, pricing }) {
  const hasStart = !!(startDate && startTime);
  const hasEnd = !!(endDate && endTime);
  const hasDuration = duration > 0;

  let startLabel = "No start selected";
  if (hasStart) startLabel = `From ${formatDateLong(startDate)}, ${formatTime12h(startTime)}`;
  else if (startDate) startLabel = `From ${formatDateLong(startDate)} (time not set)`;
  else if (startTime) startLabel = `Starts at ${formatTime12h(startTime)} (date not set)`;

  let durationLabel = "No duration selected";
  let durationSub = null;
  if (hasDuration) {
    durationLabel = formatDuration(duration);
    durationSub = `Ends ${formatDateLong(endDate)}, ${formatTime12h(endTime)}`;
  } else if (hasEnd) {
    durationLabel = "End must be after the start";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Your selection</p>

      <div className="space-y-3 text-sm">
        <Row
          icon="door"
          label={room ? room.name : "No room selected"}
          sub={room ? `${room.roomNumber} · Floor ${room.floor}` : null}
          strong={!!room}
        />
        <Row icon="calendar" label={startLabel} strong={hasStart} />
        <Row icon="clock" label={durationLabel} sub={durationSub} strong={hasDuration} />
      </div>

      {/* Rates - shown as soon as a room is picked so the price is visible
          before a duration has been chosen. */}
      {room && (
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-3">
            <span>Room rate</span>
            <span className="font-semibold text-slate-700">{formatRupees(pricing.pricePerHour)} / hr</span>
          </div>
          {pricing.amenityChargePerHour > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span>Extra amenities</span>
              <span className="font-semibold text-slate-700">+{formatRupees(pricing.amenityChargePerHour)} / hr</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-dashed border-slate-200 pt-4">
        <p className="text-xs text-slate-400">Estimated total</p>
        <p className="text-2xl font-bold text-slate-900">{formatRupees(pricing.totalAmount)}</p>
        {hasDuration ? (
          <p className="text-xs text-slate-400">for {formatDuration(duration)}</p>
        ) : (
          <p className="text-xs text-slate-400">
            {room ? "Choose a duration to see your total." : "Select a room to get started."}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, sub, strong }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className={`break-words leading-snug ${strong ? "font-semibold text-slate-800" : "text-slate-400"}`}>{label}</p>
        {sub && <p className="mt-0.5 break-words text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}
