// Thin localStorage-backed overlay for admin-editable fields on top of the
// read-only staff directories (data/mockWorkers.js, data/mockUsers.js) and
// the client roster derived from bookingStorage.js. Mirrors the pattern
// already used by roomStatusStorage.js: source records are never mutated,
// admin edits/activation toggles are layered on as a keyed overlay instead.
//
// Used by the Admin Workers, Employees, and Clients management pages. Not
// wired into AuthContext — deactivating a worker/employee/client here only
// changes what admin sees, it never blocks that account's login, so the
// existing authentication flow is left untouched.

const STAFF_KEY = "itpark_staff_overrides";

// Dispatched on every write so any mounted admin page can react immediately,
// mirroring ROOM_STATUS_EVENT in roomStatusStorage.js.
export const STAFF_OVERRIDES_EVENT = "itpark:staff-overrides-changed";

function readAll() {
  try {
    const raw = localStorage.getItem(STAFF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Corrupted staff override data, clearing it.", err);
    localStorage.removeItem(STAFF_KEY);
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(map));
  window.dispatchEvent(new Event(STAFF_OVERRIDES_EVENT));
}

// name/email/organization/department let admin edits override the read-only
// mock directories without mutating them; deleted lets admin "remove" a
// record that's actually backed by a real login account (we can't drop it
// from the source array, so we just hide it from the admin roster instead).
const DEFAULT_OVERRIDE = {
  active: true,
  phone: null,
  name: null,
  email: null,
  organization: null,
  department: null,
  notes: null,
  deleted: false,
};

/** Admin-editable overlay for one staff record (worker/employee/client id),
 * falling back to sane defaults if the admin hasn't touched it yet. */
export function getStaffOverride(id) {
  const map = readAll();
  return { ...DEFAULT_OVERRIDE, ...map[id] };
}

export function isStaffActive(id) {
  return getStaffOverride(id).active !== false;
}

export function setStaffActive(id, active) {
  const map = readAll();
  map[id] = { ...DEFAULT_OVERRIDE, ...map[id], active };
  writeAll(map);
  return map[id];
}

export function updateStaffOverride(id, patch) {
  const map = readAll();
  map[id] = { ...DEFAULT_OVERRIDE, ...map[id], ...patch, updatedAt: new Date().toISOString() };
  writeAll(map);
  return map[id];
}

export function getAllStaffOverrides() {
  return readAll();
}

export function isStaffDeleted(id) {
  return getStaffOverride(id).deleted === true;
}

/** Soft-delete: hides a record that's backed by a real account/mock entry
 * from the admin roster. Doesn't touch login ability, mirroring how
 * setStaffActive never blocks sign-in either. */
export function setStaffDeleted(id, deleted) {
  const map = readAll();
  map[id] = { ...DEFAULT_OVERRIDE, ...map[id], deleted };
  writeAll(map);
  return map[id];
}
