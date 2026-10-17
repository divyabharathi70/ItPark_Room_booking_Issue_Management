// localStorage-backed persistence for "extend my stay" requests. A client
// with a CONFIRMED (or already-extended) booking can ask to keep the same
// room for longer; an admin then approves (which pushes the booking's end
// date/time out and adds the extra charge) or rejects the request.

import {
  BOOKING_STATUS,
  durationHours,
  getBookingById,
  updateBookingIfAvailable,
} from "./bookingStorage";
import { createNotification, NOTIFICATION_TYPES } from "./notificationStorage";
import { publishSharedRecords } from "./sharedDataSync";

const EXTEND_REQUESTS_KEY = "itpark_extend_requests";
export const EXTEND_REQUESTS_EVENT = "itpark:extend-requests-changed";

export const EXTEND_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

function readAll() {
  try {
    const raw = localStorage.getItem(EXTEND_REQUESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted extension-request data, clearing it.", err);
    localStorage.removeItem(EXTEND_REQUESTS_KEY);
    return [];
  }
}

function writeAll(list) {
  const previous = readAll();
  localStorage.setItem(EXTEND_REQUESTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EXTEND_REQUESTS_EVENT));
  const previousById = new Map(previous.map((request) => [request.id, JSON.stringify(request)]));
  const changed = list.filter((request) => previousById.get(request.id) !== JSON.stringify(request));
  void publishSharedRecords("extendRequests", changed);
}

export function generateExtendRequestId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `EXT-${stamp}${rand}`;
}

export function getAllExtendRequests() {
  return readAll().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getExtendRequestsForClient(clientId) {
  return readAll()
    .filter((r) => r.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getExtendRequestsForBooking(bookingId) {
  return readAll()
    .filter((r) => r.bookingId === bookingId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function hasPendingExtendRequest(bookingId) {
  return readAll().some((r) => r.bookingId === bookingId && r.status === EXTEND_STATUS.PENDING);
}

/** Creates a new PENDING extension request. Expects a fully-formed request
 * object (see MyBookings.jsx for the shape) — this module doesn't validate
 * business rules on create, only on approve. */
export function createExtendRequest(request) {
  const list = readAll();
  const full = {
    status: EXTEND_STATUS.PENDING,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
    adminNote: "",
    updatedAt: new Date().toISOString(),
    ...request,
  };
  list.push(full);
  writeAll(list);
  createNotification({
    recipientRole: "admin",
    type: NOTIFICATION_TYPES.EXTEND_REQUESTED,
    message: `${full.clientName} requested an extension for ${full.roomName}.`,
    relatedId: full.id,
    relatedType: "extend_request",
  });
  return full;
}

/** Approves a request: re-checks the room is still free for the new window
 * (something else may have been booked since the request was raised),
 * then pushes the booking's end date/time out and tops up the total.
 * Returns { ok: true, request, booking } or { ok: false, reason }. */
export async function approveExtendRequest(id, admin) {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, reason: "Request not found." };
  const request = list[idx];
  if (request.status !== EXTEND_STATUS.PENDING) {
    return { ok: false, reason: "This request has already been resolved." };
  }

  const booking = getBookingById(request.bookingId);
  if (!booking) return { ok: false, reason: "The original booking no longer exists." };
  if (booking.bookingStatus === BOOKING_STATUS.CANCELLED) {
    return { ok: false, reason: "That booking has been cancelled." };
  }

  const newDurationHours = durationHours(
    booking.startDate,
    booking.startTime,
    request.requestedEndDate,
    request.requestedEndTime
  );
  const additionalHours = durationHours(
    booking.endDate,
    booking.endTime,
    request.requestedEndDate,
    request.requestedEndTime
  );
  const additionalAmount = Math.round(
    (booking.pricePerHour + (booking.amenityChargePerHour || 0)) * additionalHours
  );
  const updatedBookingResult = await updateBookingIfAvailable(booking.id, {
    endDate: request.requestedEndDate,
    endTime: request.requestedEndTime,
    durationHours: newDurationHours,
    totalAmount: booking.totalAmount + additionalAmount,
    bookingStatus: BOOKING_STATUS.CONFIRMED,
  });
  if (!updatedBookingResult.available) {
    return {
      ok: false,
      reason: updatedBookingResult.error
        ? "Couldn't verify room availability. Please try again."
        : updatedBookingResult.conflict
          ? `Room is already booked by ${updatedBookingResult.conflict.clientName || "another client"} during part of the requested extension.`
          : "The extended time window is invalid.",
    };
  }

  const updatedBooking = updatedBookingResult.booking;

  list[idx] = {
    ...request,
    status: EXTEND_STATUS.APPROVED,
    additionalAmount,
    resolvedAt: new Date().toISOString(),
    resolvedBy: admin?.name || "Admin",
    updatedAt: new Date().toISOString(),
  };
  writeAll(list);

  createNotification({
    recipientId: request.clientId,
    recipientRole: "client",
    type: NOTIFICATION_TYPES.EXTEND_APPROVED,
    message: `Your extension request for ${request.roomName} has been approved.`,
    relatedId: request.id,
    relatedType: "extend_request",
  });

  return { ok: true, request: list[idx], booking: updatedBooking };
}

export function rejectExtendRequest(id, admin, note = "") {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return { ok: false, reason: "Request not found." };
  if (list[idx].status !== EXTEND_STATUS.PENDING) {
    return { ok: false, reason: "This request has already been resolved." };
  }

  list[idx] = {
    ...list[idx],
    status: EXTEND_STATUS.REJECTED,
    adminNote: note,
    resolvedAt: new Date().toISOString(),
    resolvedBy: admin?.name || "Admin",
    updatedAt: new Date().toISOString(),
  };
  writeAll(list);
  createNotification({
    recipientId: list[idx].clientId,
    recipientRole: "client",
    type: NOTIFICATION_TYPES.EXTEND_REJECTED,
    message: `Your extension request for ${list[idx].roomName} was cancelled.${note ? ` ${note}` : ""}`,
    relatedId: list[idx].id,
    relatedType: "extend_request",
  });
  return { ok: true, request: list[idx] };
}
