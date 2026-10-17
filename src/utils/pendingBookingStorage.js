// Persists the room a signed-out visitor picked on the public site before
// being routed to /signup or /login, so the booking wizard can resume with
// that room pre-selected once they have an account/session — instead of
// making them search for it again. Frontend-only, backed by localStorage,
// same pattern as utils/storage.js (session) and utils/selfSignupStorage.js.

import { ROLES } from "../data/mockUsers";
import { getSession } from "./storage";

const PENDING_BOOKING_KEY = "pendingBookingRoomId";

export function setPendingBookingRoomId(roomId) {
  if (!roomId) return;
  try {
    localStorage.setItem(PENDING_BOOKING_KEY, roomId);
  } catch (err) {
    console.error("Could not persist pending booking room id.", err);
  }
}

export function getPendingBookingRoomId() {
  try {
    return localStorage.getItem(PENDING_BOOKING_KEY);
  } catch (err) {
    console.error("Could not read pending booking room id.", err);
    return null;
  }
}

export function clearPendingBookingRoomId() {
  try {
    localStorage.removeItem(PENDING_BOOKING_KEY);
  } catch (err) {
    console.error("Could not clear pending booking room id.", err);
  }
}

// Booking wizard route (BookingNew.jsx), with the room to pre-select passed
// as a query param it reads on mount. An APPROVED client uses the wizard
// inside their Client Dashboard; a signed-up user who is not approved yet
// uses the same wizard on the public site (/book-room) so they never touch
// the dashboard routes.
export function clientBookingPath(roomId) {
  const session = getSession();
  const base = session?.role === ROLES.CLIENT ? "/client/bookings/new" : "/book-room";
  return `${base}?roomId=${encodeURIComponent(roomId)}`;
}
