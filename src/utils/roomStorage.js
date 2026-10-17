// Thin localStorage-backed persistence for the admin-managed room catalog.
// Mirrors the pattern already used in utils/bookingStorage.js /
// utils/categoryStorage.js — synchronous, mock-only, no server behind it.
//
// This is the runtime source of truth for room catalog data (name, number,
// floor, capacity, price, amenities, description, active flag). It is
// SEPARATE from utils/roomStatusStorage.js, which continues to own purely
// operational state (available / blocked / maintenance) — editing or
// deleting a room here never touches that store, so existing block/
// maintenance/issue-driven behavior keeps working untouched.
//
// data/mockRooms.js's MOCK_ROOMS is used only as first-run seed data. Once
// localStorage has been initialized (even to an empty array, e.g. after an
// admin deletes every room), it is never overwritten from MOCK_ROOMS again.

import { MOCK_ROOMS } from "../data/mockRooms";

const ROOMS_KEY = "itpark_rooms";

// Dispatched on every write so any mounted component (client booking wizard,
// admin rooms grid, dashboards/analytics) can react immediately — mirrors
// ROOM_STATUS_EVENT in roomStatusStorage.js and CATEGORY_EVENT in
// categoryStorage.js.
export const ROOMS_EVENT = "itpark:rooms-changed";

function readRaw() {
  return localStorage.getItem(ROOMS_KEY);
}

function readAll() {
  try {
    const raw = readRaw();
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted room catalog data, clearing it.", err);
    localStorage.removeItem(ROOMS_KEY);
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(ROOMS_EVENT));
}

/** Seeds the room catalog from MOCK_ROOMS exactly once. Distinguishes
 * "never initialized" (localStorage key missing entirely) from "admin has
 * deleted every room" (key present, holding an empty array) so a fully
 * emptied catalog is never silently repopulated with mock data. */
export function initializeRooms() {
  const raw = readRaw();
  if (raw !== null) return; // already initialized (possibly empty) — never overwrite
  const now = new Date().toISOString();
  const seeded = MOCK_ROOMS.map((room) => ({ ...room, createdAt: now, updatedAt: now }));
  localStorage.setItem(ROOMS_KEY, JSON.stringify(seeded));
}

export function getAllRooms() {
  initializeRooms();
  return readAll();
}

export function getRoomById(id) {
  if (!id) return null;
  return getAllRooms().find((r) => r.id === id) || null;
}

/** Only rooms flagged active — what new client bookings should be able to
 * select from. (Room status — blocked/maintenance — is layered on top of
 * this separately via roomStatusStorage.) */
export function getActiveRooms() {
  return getAllRooms().filter((r) => r.isActive);
}

export function isRoomIdTaken(id, excludeId = null) {
  const normalized = (id || "").trim().toLowerCase();
  if (!normalized) return false;
  return getAllRooms().some((r) => r.id !== excludeId && r.id.trim().toLowerCase() === normalized);
}

export function isRoomNumberTaken(roomNumber, excludeId = null) {
  const normalized = (roomNumber || "").trim().toLowerCase();
  if (!normalized) return false;
  return getAllRooms().some((r) => r.id !== excludeId && r.roomNumber.trim().toLowerCase() === normalized);
}

/** Suggests the next free "r-###" id so the Add Room form can prefill
 * something reasonable while still letting the admin change it. */
export function suggestRoomId() {
  const existing = new Set(getAllRooms().map((r) => r.id.trim().toLowerCase()));
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = `r-${String(n).padStart(3, "0")}`;
    if (!existing.has(candidate)) return candidate;
    n += 1;
  }
}

/** Adds a new room to the catalog. Caller is responsible for validation
 * (required fields, uniqueness) before calling this — see Admin > Rooms. */
export function addRoom(room) {
  const list = readAll();
  const now = new Date().toISOString();
  const newRoom = {
    ...room,
    createdAt: now,
    updatedAt: now,
  };
  list.push(newRoom);
  writeAll(list);
  return newRoom;
}

/** Updates catalog fields for an existing room. Never touches roomId
 * (the id itself can't be changed once created — bookings/status records
 * are keyed off it) and never touches operational status, which lives
 * entirely in roomStatusStorage.js. */
export function updateRoom(id, updates) {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...updates,
    id: list[idx].id,
    createdAt: list[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  writeAll(list);
  return list[idx];
}

/** Removes a room from the catalog only. Historical bookings reference
 * rooms by denormalized fields (roomName/roomNumber/floor/pricePerHour
 * stored directly on the booking, see bookingStorage.js) so they are
 * completely unaffected by this — nothing here touches BOOKINGS_KEY.
 * Room status/maintenance records for the id are also left as-is; they
 * simply become unreachable since the room no longer appears in any
 * catalog listing. */
export function deleteRoom(id) {
  const list = readAll();
  const filtered = list.filter((r) => r.id !== id);
  if (filtered.length === list.length) return false;
  writeAll(filtered);
  return true;
}
