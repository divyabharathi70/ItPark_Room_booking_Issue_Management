// Thin localStorage-backed persistence for the client room-booking flow.
// Mirrors the pattern already used in utils/storage.js — synchronous,
// mock-only, no server behind it.
//
// Bookings are no longer confined to a single calendar day: every booking
// has an independent start (date + time) and end (date + time), so a stay
// can be as short as an hour or as long as several years.

import { getRoomById, AMENITY_MAP } from "../data/mockRooms";
import { createNotification, NOTIFICATION_TYPES } from "./notificationStorage";
import { activateClient } from "./clientStorage";
import { getSelfSignupUserByEmail } from "./selfSignupStorage";
import { publishSharedRecords } from "./sharedDataSync";

const BOOKINGS_KEY = "itpark_bookings";

// Dispatched on every write so any mounted component (admin bookings grid,
// client dashboards, analytics) can react immediately without polling —
// mirrors ROOM_STATUS_EVENT in roomStatusStorage.js and ROOMS_EVENT in
// roomStorage.js.
export const BOOKINGS_EVENT = "itpark:bookings-changed";

export const BOOKING_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
};

export const PAYMENT_STATUS = {
  PAID: "PAID",
  PENDING: "PENDING",
  FAILED: "FAILED",
};

// Units a client can select/extend a stay by. Order matters for display.
export const DURATION_UNITS = [
  { id: "hours", label: "Hours" },
  { id: "days", label: "Days" },
  { id: "weeks", label: "Weeks" },
  { id: "months", label: "Months" },
  { id: "years", label: "Years" },
];

function readAll() {
  try {
    const raw = localStorage.getItem(BOOKINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted booking data, clearing it.", err);
    localStorage.removeItem(BOOKINGS_KEY);
    return [];
  }
}

function writeAll(list) {
  const previous = readAll();
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(BOOKINGS_EVENT));
  const previousById = new Map(previous.map((booking) => [booking.id, booking]));
  const changed = list.filter((booking) => JSON.stringify(previousById.get(booking.id)) !== JSON.stringify(booking));
  void publishSharedRecords("bookings", changed);
}

/** Seeds a couple of bookings from "other" clients once, on first run,
 * so the availability checker has real data to collide with. */
export function seedBookingsIfEmpty() {
  const existing = readAll();
  if (existing.length > 0) return;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const fmt = (d) => d.toISOString().slice(0, 10);

  const seed = [
    {
      id: "BKG-SEED01",
      clientId: "seed-client-1",
      clientName: "Neha Kapoor",
      roomId: "r-101",
      roomName: "Orion Boardroom",
      roomNumber: "R-101",
      floor: 1,
      startDate: fmt(today),
      startTime: "10:00",
      endDate: fmt(today),
      endTime: "14:00",
      durationHours: 4,
      amenities: ["wifi", "ac", "projector", "whiteboard"],
      pricePerHour: 1200,
      amenityChargePerHour: 0,
      totalAmount: 4800,
      paymentMethod: "upi",
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      createdAt: new Date(today.getTime() - 86400000).toISOString(),
    },
    {
      id: "BKG-SEED02",
      clientId: "seed-client-2",
      clientName: "Farhan Sheikh",
      roomId: "r-201",
      roomName: "Zenith Conference Hall",
      roomNumber: "R-201",
      floor: 2,
      startDate: fmt(tomorrow),
      startTime: "15:00",
      endDate: fmt(tomorrow),
      endTime: "17:00",
      durationHours: 2,
      amenities: ["wifi", "ac", "projector", "smarttv", "mic", "speakers", "videoconf"],
      pricePerHour: 2500,
      amenityChargePerHour: 0,
      totalAmount: 5000,
      paymentMethod: "card",
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      createdAt: new Date(today.getTime() - 43200000).toISOString(),
    },
  ];
  writeAll(seed);
}

/** Seeds a couple of confirmed & paid bookings for the given employee, once,
 * so the Employee Issue Management System has real bookings to attach
 * issues to. Mirrors seedBookingsIfEmpty() but is keyed to one user instead
 * of running unconditionally, since the global bookings list is never
 * empty once a client has booked anything. */
export function seedEmployeeBookingsIfEmpty(employeeId, employeeName) {
  const alreadyHasBookings = readAll().some((b) => b.clientId === employeeId);
  if (alreadyHasBookings) return;

  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const inDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };

  const hour = today.getHours();
  const activeStart = `${String(Math.min(18, Math.max(8, hour - 1))).padStart(2, "0")}:00`;
  const activeEnd = `${String(Math.min(20, Math.max(10, hour + 2))).padStart(2, "0")}:00`;

  const room1 = getRoomById("r-102"); // Nebula Meeting Room
  const room2 = getRoomById("r-203"); // Pixel Huddle Room
  const todayStr = fmt(today);
  const upcomingStr = fmt(inDays(3));
  const activeDuration = durationHours(todayStr, activeStart, todayStr, activeEnd);
  const upcomingDuration = durationHours(upcomingStr, "11:00", upcomingStr, "12:30");

  const seed = [
    {
      id: generateBookingId(),
      clientId: employeeId,
      clientName: employeeName,
      roomId: room1.id,
      roomName: room1.name,
      roomNumber: room1.roomNumber,
      floor: room1.floor,
      startDate: todayStr,
      startTime: activeStart,
      endDate: todayStr,
      endTime: activeEnd,
      durationHours: activeDuration,
      amenities: room1.includedAmenities,
      pricePerHour: room1.pricePerHour,
      amenityChargePerHour: 0,
      totalAmount: Math.round(room1.pricePerHour * activeDuration),
      paymentMethod: "upi",
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      createdAt: new Date(today.getTime() - 3 * 3600000).toISOString(),
    },
    {
      id: generateBookingId(),
      clientId: employeeId,
      clientName: employeeName,
      roomId: room2.id,
      roomName: room2.name,
      roomNumber: room2.roomNumber,
      floor: room2.floor,
      startDate: upcomingStr,
      startTime: "11:00",
      endDate: upcomingStr,
      endTime: "12:30",
      durationHours: upcomingDuration,
      amenities: room2.includedAmenities,
      pricePerHour: room2.pricePerHour,
      amenityChargePerHour: 0,
      totalAmount: Math.round(room2.pricePerHour * upcomingDuration),
      paymentMethod: "card",
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.CONFIRMED,
      createdAt: new Date(today.getTime() - 2 * 3600000).toISOString(),
    },
  ];

  writeAll([...readAll(), ...seed]);
}

export function getAllBookings() {
  return readAll().filter((booking) => !booking.deletedAt);
}

export function getBookingsForClient(clientId) {
  return readAll()
    .filter((b) => !b.deletedAt && b.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBookingById(id) {
  return readAll().find((b) => b.id === id && !b.deletedAt) || null;
}

/** Removes booking details and keeps only a synced tombstone so another
 * open app tab or browser cannot restore the deleted record. */
export function deleteBooking(id) {
  const list = readAll();
  const idx = list.findIndex((b) => b.id === id && !b.deletedAt);
  if (idx === -1) return null;
  const deletedAt = new Date().toISOString();
  list[idx] = { id, deletedAt, lastUpdated: deletedAt };
  writeAll(list);
  return list[idx];
}

function getActiveBookingsForRoom(roomId, excludeId) {
  return readAll().filter(
    (b) => b.roomId === roomId && b.id !== excludeId && b.bookingStatus !== BOOKING_STATUS.CANCELLED
  );
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Combines a date ("YYYY-MM-DD") and time ("HH:MM") into a millisecond
 * timestamp, or null if either piece is missing/unparsable. */
export function toTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const ts = new Date(`${dateStr}T${timeStr}:00`).getTime();
  return Number.isNaN(ts) ? null : ts;
}

/** Returns { available: boolean, conflict: booking|null } for the given
 * room/start/end window (each a date+time pair), ignoring cancelled
 * bookings and (optionally) one booking id being edited. Unlike a
 * same-day slot check, this compares full timestamps so a booking that
 * spans multiple days, months, or years is still caught correctly. */
export function checkAvailability(roomId, startDate, startTime, endDate, endTime, excludeId) {
  if (!roomId || !startDate || !startTime || !endDate || !endTime) {
    return { available: null, conflict: null };
  }
  const startTs = toTimestamp(startDate, startTime);
  const endTs = toTimestamp(endDate, endTime);
  if (startTs === null || endTs === null || endTs <= startTs) {
    return { available: false, conflict: null };
  }

  const existing = getActiveBookingsForRoom(roomId, excludeId);
  const conflict = existing.find((b) => {
    const bStart = toTimestamp(b.startDate || b.date, b.startTime);
    const bEnd = toTimestamp(b.endDate || b.date, b.endTime);
    if (bStart === null || bEnd === null) return false;
    return startTs < bEnd && bStart < endTs;
  });
  return { available: !conflict, conflict: conflict || null };
}

/** Reads the shared local-server booking store before submitting extension
 * requests, so a request on another localhost port is visible immediately. */
export async function checkSharedAvailability(roomId, startDate, startTime, endDate, endTime, excludeId) {
  try {
    const response = await fetch("/__itpark_check_availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, startDate, startTime, endDate, endTime, excludeId }),
    });
    if (response.ok) return response.json();
    if (response.status !== 404) return { available: false, conflict: null, error: true };
  } catch {
    // Retain local-only behavior when running without the Vite shared store.
  }
  return checkAvailability(roomId, startDate, startTime, endDate, endTime, excludeId);
}

export function generateBookingId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `BKG-${stamp}${rand}`;
}

/** Fires the booking-confirmed / payment-successful / admin-activity
 * notifications for a freshly created booking. Kept separate from
 * createBooking so the seed helpers above (which write bookings directly
 * via writeAll, on purpose) never trigger notification spam on first
 * load — only a real, user-initiated booking goes through here. */
function notifyBookingCreated(booking) {
  const isPaidAwaitingApproval = booking.paymentStatus === PAYMENT_STATUS.PAID;

  // Client-facing notifications only make sense for an actual client
  // account — guest/visitor bookings (clientId === null) have no client
  // inbox to deliver these to yet, so they're skipped until the booking is
  // approved and a client account exists.
  if (booking.clientId) {
    if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      createNotification({
        recipientId: booking.clientId,
        recipientRole: "client",
        type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
        message: `Booking #${booking.id} has been confirmed.`,
        relatedId: booking.id,
        relatedType: "booking",
      });
    }
    if (booking.paymentStatus === PAYMENT_STATUS.PAID) {
      createNotification({
        recipientId: booking.clientId,
        recipientRole: "client",
        type: NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL,
        message: `Payment for Booking #${booking.id} was successful.`,
        relatedId: booking.id,
        relatedType: "booking",
      });
    }
  }

  if (booking.bookingStatus === BOOKING_STATUS.PENDING) {
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      message: `${isPaidAwaitingApproval ? "New paid booking request" : "New booking request"} from ${booking.clientName} for ${booking.roomName}. Waiting for confirmation.`,
      relatedId: booking.id,
      relatedType: "booking",
    });
  } else if (booking.bookingStatus === BOOKING_STATUS.CONFIRMED || booking.paymentStatus === PAYMENT_STATUS.PAID) {
    createNotification({
      recipientRole: "admin",
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      message: `New booking #${booking.id} by ${booking.clientName} — payment ${booking.paymentStatus}.`,
      relatedId: booking.id,
      relatedType: "booking",
    });
  }
}

export function createBooking(booking) {
  const list = readAll();
  list.push(booking);
  writeAll(list);
  notifyBookingCreated(booking);
  return booking;
}

/** Atomically checks and reserves a room window through the shared Vite
 * store, preventing two localhost tabs/ports from claiming an overlapping
 * pending booking at the same time. Falls back to this origin's local data
 * when the shared reservation endpoint is unavailable (e.g. static hosting).
 */
export async function createBookingIfAvailable(booking) {
  try {
    const response = await fetch("/__itpark_reserve_booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking }),
    });
    if (response.status === 409) {
      const result = await response.json();
      return { available: false, conflict: result.conflict || null };
    }
    if (response.ok) {
      return { available: true, booking: createBooking(booking) };
    }
    if (response.status !== 404) return { available: false, error: true };
  } catch {
    // Use the same local fallback as the rest of the demo when the shared
    // Vite endpoint is not running.
  }

  const finalCheck = checkAvailability(
    booking.roomId,
    booking.startDate || booking.date,
    booking.startTime,
    booking.endDate || booking.date,
    booking.endTime
  );
  if (!finalCheck.available) return { available: false, conflict: finalCheck.conflict };
  return { available: true, booking: createBooking(booking) };
}

/** Atomically extends an existing booking in the shared store, so another
 * booking cannot claim the requested time between the admin check and save. */
export async function updateBookingIfAvailable(id, patch) {
  const current = getBookingById(id);
  if (!current) return { available: false, error: true };
  const updated = { ...current, ...patch };

  try {
    const response = await fetch("/__itpark_reserve_booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking: updated }),
    });
    if (response.status === 409) {
      const result = await response.json();
      return { available: false, conflict: result.conflict || null };
    }
    if (response.ok) return { available: true, booking: updateBooking(id, patch) };
    if (response.status !== 404) return { available: false, error: true };
  } catch {
    // Fall through to local-only storage when the Vite endpoint is absent.
  }

  const availability = checkAvailability(
    updated.roomId,
    updated.startDate || updated.date,
    updated.startTime,
    updated.endDate || updated.date,
    updated.endTime,
    id
  );
  if (!availability.available) return { available: false, conflict: availability.conflict };
  return { available: true, booking: updateBooking(id, patch) };
}

export function updateBooking(id, patch) {
  const list = readAll();
  const idx = list.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeAll(list);
  return list[idx];
}

/** Updates a batch of existing bookings with one storage write/event. */
export function updateBookings(updates) {
  const patches = new Map(updates.map(({ id, patch }) => [id, patch]));
  const list = readAll();
  let changed = false;
  const updated = list.map((booking) => {
    const patch = patches.get(booking.id);
    if (!patch) return booking;
    changed = true;
    return { ...booking, ...patch };
  });
  if (changed) writeAll(updated);
  return updated;
}

export function cancelBooking(id) {
  return updateBooking(id, { bookingStatus: BOOKING_STATUS.CANCELLED });
}

/** Admin approval activates the customer and confirms their booking. */
export function approveBooking(id) {
  const before = getBookingById(id);
  if (!before) return null;

  let client = null;
  const email = before.guestEmail || before.clientEmail;
  if (email) {
    const signedUpUser = getSelfSignupUserByEmail(email);
    client = activateClient({
      clientId: signedUpUser?.id || before.clientId,
      name: before.guestName || before.clientName,
      email,
      phone: before.guestPhone || before.clientPhone || signedUpUser?.phone,
      company: before.guestCompany || before.companyName || signedUpUser?.company,
    });
  }

  const patch = {
    bookingStatus: BOOKING_STATUS.CONFIRMED,
  };
  // Add clientId to the booking (Client -> clientId -> Booking -> roomId),
  // retaining clientName/clientEmail/companyName alongside it.
  if (client) {
    patch.clientId = client.clientId;
    patch.clientName = client.name;
    patch.clientEmail = client.email;
    patch.companyName = client.company;
  }

  const updated = updateBooking(id, patch);
  if (updated) {
    createNotification({
      recipientId: updated.clientId,
      // Guest bookings that somehow had no email (so no Client could be
      // created above) have no client account/role yet to broadcast to —
      // "guest" is a placeholder role nothing currently reads, so this
      // simply won't spam existing logged-in clients.
      recipientRole: updated.clientId ? "client" : "guest",
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      message: `Your booking ${updated.id} has been confirmed. You can now access your Client Dashboard.`,
      relatedId: updated.id,
      relatedType: "booking",
    });
  }
  return updated;
}

/** Admin cancels a pending request, preserves its payment details, and
 * notifies the customer. Does not activate a Client account. */
export function rejectBooking(id) {
  const updated = updateBooking(id, { bookingStatus: BOOKING_STATUS.CANCELLED });
  if (updated) {
    createNotification({
      recipientId: updated.clientId,
      recipientRole: updated.clientId ? "client" : "guest",
      type: NOTIFICATION_TYPES.BOOKING_REJECTED,
      message: `Your booking ${updated.id} was not approved by the administrator.`,
      relatedId: updated.id,
      relatedType: "booking",
    });
  }
  return updated;
}

/** Lazily promotes CONFIRMED bookings whose end date/time has already
 * passed to COMPLETED. Call once on pages that display booking lists. */
export function syncCompletedBookings() {
  const list = readAll();
  const now = new Date();
  let changed = false;
  const updated = list.map((b) => {
    if (b.bookingStatus === BOOKING_STATUS.CONFIRMED) {
      const endTs = toTimestamp(b.endDate, b.endTime);
      if (endTs !== null && endTs < now.getTime()) {
        changed = true;
        return { ...b, bookingStatus: BOOKING_STATUS.COMPLETED };
      }
    }
    return b;
  });
  if (changed) writeAll(updated);
  return updated;
}

/** THE one pricing calculation used by the booking wizard, the "Your
 * selection" card, the payment modal and the saved booking, so the amount
 * can never differ between them.
 *
 *   total = room rate x hours  +  extra-amenity rate x hours
 *
 * `extraAmenityIds` are only the amenities the client added on top of what
 * the room already includes (included ones are free). Each charge is rounded
 * to whole rupees, and totalAmount is the sum of the two rounded charges so
 * the lines shown on screen always add up exactly. With no duration yet,
 * every charge is 0 - the rate is still returned so it can be displayed. */
export function calculateBookingPrice(room, durationInHours, extraAmenityIds = []) {
  const pricePerHour = Number(room?.pricePerHour) || 0;
  const amenityChargePerHour = extraAmenityIds.reduce(
    (sum, id) => sum + (AMENITY_MAP[id]?.pricePerHour || 0),
    0
  );
  const hours = durationInHours > 0 ? durationInHours : 0;

  const roomCharge = Math.round(pricePerHour * hours);
  const amenityCharge = Math.round(amenityChargePerHour * hours);

  return {
    pricePerHour,
    amenityChargePerHour,
    roomCharge,
    amenityCharge,
    totalAmount: roomCharge + amenityCharge,
  };
}

/** Duration, in (possibly fractional) hours, between a start and end
 * date+time pair. Works the same whether the gap is 30 minutes or 5 years. */
export function durationHours(startDate, startTime, endDate, endTime) {
  const start = toTimestamp(startDate, startTime);
  const end = toTimestamp(endDate, endTime);
  if (start === null || end === null) return 0;
  const diff = (end - start) / 3600000;
  return diff > 0 ? diff : 0;
}

/** Adds `amount` of `unit` (hours/days/weeks/months/years) to a date+time
 * pair and returns the resulting { date, time } strings. Used by the
 * booking wizard and the extension-request flow to compute an end (or new
 * end) from a chosen duration instead of forcing the client to pick an
 * exact end date/time by hand. */
export function addDuration(dateStr, timeStr, amount, unit) {
  const base = new Date(`${dateStr}T${timeStr}:00`);
  const n = Number(amount) || 0;
  switch (unit) {
    case "hours":
      base.setHours(base.getHours() + n);
      break;
    case "days":
      base.setDate(base.getDate() + n);
      break;
    case "weeks":
      base.setDate(base.getDate() + n * 7);
      break;
    case "months":
      base.setMonth(base.getMonth() + n);
      break;
    case "years":
      base.setFullYear(base.getFullYear() + n);
      break;
    default:
      break;
  }
  const pad = (x) => String(x).padStart(2, "0");
  return {
    date: `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`,
    time: `${pad(base.getHours())}:${pad(base.getMinutes())}`,
  };
}

/** Renders a duration in hours as a short, human string, picking the two
 * most significant units so a 5-year booking reads "5 yr" rather than a
 * huge hour count, while a 90-minute one still reads "1 hr 30 min". */
export function formatDuration(hours) {
  if (!hours || hours <= 0) return "—";

  const UNITS = [
    { id: "yr", hours: 24 * 365 },
    { id: "mo", hours: 24 * 30 },
    { id: "wk", hours: 24 * 7 },
    { id: "day", hours: 24 },
    { id: "hr", hours: 1 },
  ];

  let remaining = hours;
  const parts = [];
  for (const u of UNITS) {
    const count = Math.floor(remaining / u.hours + 1e-9);
    if (count > 0) {
      parts.push(`${count} ${u.id}`);
      remaining -= count * u.hours;
    }
    if (parts.length === 2) break;
  }

  if (parts.length === 0) {
    const minutes = Math.round(hours * 60);
    return minutes > 0 ? `${minutes} min` : "< 1 min";
  }
  // If the only part so far is hours, still show trailing minutes.
  if (parts.length === 1 && parts[0].endsWith("hr")) {
    const minutes = Math.round(remaining * 60);
    if (minutes > 0) parts.push(`${minutes} min`);
  }
  return parts.join(" ");
}
