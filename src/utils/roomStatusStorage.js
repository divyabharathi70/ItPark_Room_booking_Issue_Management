// Thin localStorage-backed persistence for room block/maintenance status,
// used by Admin Issue Management's "Block Room" action. Kept as its own
// small store (separate from bookingStorage.js) so blocking a room never
// touches — let alone deletes — existing booking records; it only marks
// the room unavailable and remembers why.

const ROOM_STATUS_KEY = "itpark_room_status";

// Dispatched on every write so any mounted component (booking wizard, room
// cards, admin maintenance screen) can react immediately without prop
// drilling — mirrors NOTIFICATIONS_EVENT in notificationStorage.js.
export const ROOM_STATUS_EVENT = "itpark:room-status-changed";

// The three availability states the booking system must recognize.
// MAINTENANCE = unavailable because of a linked issue (auto or admin-linked).
// BLOCKED = unavailable because an admin blocked it with no issue attached.
// Both make a room unbookable; they're kept distinct only so admins can see
// *why* a room is down at a glance.
export const ROOM_AVAILABILITY = {
  AVAILABLE: "AVAILABLE",
  MAINTENANCE: "MAINTENANCE",
  BLOCKED: "BLOCKED",
};

function readAll() {
  try {
    const raw = localStorage.getItem(ROOM_STATUS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted room status data, clearing it.", err);
    localStorage.removeItem(ROOM_STATUS_KEY);
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(ROOM_STATUS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(ROOM_STATUS_EVENT));
}

export function getAllRoomStatuses() {
  return readAll();
}

/** Current block record for a room, or null if it isn't blocked. */
export function getRoomBlock(roomId) {
  return readAll().find((r) => r.roomId === roomId && r.blocked) || null;
}

export function isRoomBlocked(roomId) {
  return !!getRoomBlock(roomId);
}

/** Marks a room unavailable due to maintenance, tied back to the issue
 * that triggered it. Never touches booking records — this is purely a
 * room-availability flag layered on top. */
export function blockRoom({ roomId, roomName, reason, relatedIssueId, blockedBy }) {
  const list = readAll().filter((r) => r.roomId !== roomId);
  const record = {
    roomId,
    roomName,
    reason,
    relatedIssueId: relatedIssueId || null,
    blockedBy: blockedBy || null,
    blockedAt: new Date().toISOString(),
    blocked: true,
  };
  list.push(record);
  writeAll(list);
  return record;
}

export function unblockRoom(roomId) {
  const list = readAll();
  const idx = list.findIndex((r) => r.roomId === roomId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], blocked: false, unblockedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}

/** Full maintenance history for a room, most recent first — kept even
 * after a room is unblocked so admins can review past maintenance. */
export function getRoomHistory(roomId) {
  return readAll()
    .filter((r) => r.roomId === roomId)
    .sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt));
}

/** The single source of truth for "is this room bookable right now, and
 * why not if it isn't". Combines with issueStorage's unresolved-issue
 * checks at the call site for the stricter, issue-driven CRITICAL rule —
 * this function only reflects the block record itself.
 *
 * - No active block  -> AVAILABLE
 * - Active block tied to an issue (relatedIssueId set) -> MAINTENANCE
 * - Active block with no issue (admin blocked directly) -> BLOCKED
 */
export function getRoomAvailability(roomId) {
  const block = getRoomBlock(roomId);
  if (!block) {
    return { status: ROOM_AVAILABILITY.AVAILABLE, reason: null, relatedIssueId: null, blockedBy: null, blockedAt: null };
  }
  return {
    status: block.relatedIssueId ? ROOM_AVAILABILITY.MAINTENANCE : ROOM_AVAILABILITY.BLOCKED,
    reason: block.reason,
    relatedIssueId: block.relatedIssueId,
    blockedBy: block.blockedBy,
    blockedAt: block.blockedAt,
  };
}
