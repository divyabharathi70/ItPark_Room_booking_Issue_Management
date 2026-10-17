// Thin localStorage-backed persistence for in-app notifications. Mirrors
// the pattern already used across utils/*.js — synchronous, mock-only, no
// server behind it.
//
// This is the single notification store for the whole app: every
// notification, for every role, lives in this one localStorage key so
// there's never a risk of multiple conflicting stores. Other storage
// modules (bookingStorage.js, issueStorage.js) call createNotification()
// as a side effect right after they persist the underlying record, so
// every existing call site gets notifications "for free" without any
// page needing to remember to fire one.

import { isNotificationCategoryEnabled } from "./settingsStorage";
import { publishSharedRecords } from "./sharedDataSync";

const NOTIFICATIONS_KEY = "itpark_notifications";

// Maps each notification type to the Admin > Settings > Notifications
// toggle that governs it. Kept local to this module so every existing
// createNotification() call site (bookingStorage.js, issueStorage.js)
// gets the gating "for free" without needing to know settings exist.

// Dispatched on every write so any mounted component (topbar bell,
// dropdown, /notifications pages) can react immediately without prop
// drilling or a context provider. Components also listen for the native
// `storage` event so other tabs stay in sync too.
export const NOTIFICATIONS_EVENT = "itpark:notifications-changed";

export const NOTIFICATION_TYPES = {
  BOOKING_CONFIRMED: "BOOKING_CONFIRMED",
  BOOKING_REJECTED: "BOOKING_REJECTED",
  PAYMENT_SUCCESSFUL: "PAYMENT_SUCCESSFUL",
  EXTEND_REQUESTED: "EXTEND_REQUESTED",
  EXTEND_APPROVED: "EXTEND_APPROVED",
  EXTEND_REJECTED: "EXTEND_REJECTED",
  ISSUE_CREATED: "ISSUE_CREATED",
  ISSUE_ASSIGNED: "ISSUE_ASSIGNED",
  ISSUE_STATUS_CHANGED: "ISSUE_STATUS_CHANGED",
  ISSUE_RESOLVED: "ISSUE_RESOLVED",
  ISSUE_CRITICAL: "ISSUE_CRITICAL",
  MAINTENANCE_STARTED: "MAINTENANCE_STARTED",
  MAINTENANCE_COMPLETED: "MAINTENANCE_COMPLETED",
};

const TYPE_TO_SETTINGS_CATEGORY = {
  [NOTIFICATION_TYPES.BOOKING_CONFIRMED]: "bookings",
  [NOTIFICATION_TYPES.BOOKING_REJECTED]: "bookings",
  [NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL]: "bookings",
  [NOTIFICATION_TYPES.EXTEND_REQUESTED]: "bookings",
  [NOTIFICATION_TYPES.EXTEND_APPROVED]: "bookings",
  [NOTIFICATION_TYPES.EXTEND_REJECTED]: "bookings",
  [NOTIFICATION_TYPES.ISSUE_CREATED]: "issues",
  [NOTIFICATION_TYPES.ISSUE_ASSIGNED]: "issues",
  [NOTIFICATION_TYPES.ISSUE_STATUS_CHANGED]: "issues",
  [NOTIFICATION_TYPES.ISSUE_RESOLVED]: "issues",
  [NOTIFICATION_TYPES.ISSUE_CRITICAL]: "critical",
  [NOTIFICATION_TYPES.MAINTENANCE_STARTED]: "maintenance",
  [NOTIFICATION_TYPES.MAINTENANCE_COMPLETED]: "maintenance",
};

// Icon + accent colour per type, used everywhere a notification is
// rendered (topbar dropdown, /notifications pages) so the two never
// drift out of sync with each other.
export const NOTIFICATION_META = {
  [NOTIFICATION_TYPES.BOOKING_CONFIRMED]: { icon: "calendar", color: "text-emerald-600 bg-emerald-50" },
  [NOTIFICATION_TYPES.BOOKING_REJECTED]: { icon: "ban", color: "text-rose-600 bg-rose-50" },
  [NOTIFICATION_TYPES.PAYMENT_SUCCESSFUL]: { icon: "creditCard", color: "text-emerald-600 bg-emerald-50" },
  [NOTIFICATION_TYPES.EXTEND_REQUESTED]: { icon: "calendar", color: "text-indigo-600 bg-indigo-50" },
  [NOTIFICATION_TYPES.EXTEND_APPROVED]: { icon: "checkCircle", color: "text-emerald-600 bg-emerald-50" },
  [NOTIFICATION_TYPES.EXTEND_REJECTED]: { icon: "ban", color: "text-rose-600 bg-rose-50" },
  [NOTIFICATION_TYPES.ISSUE_CREATED]: { icon: "megaphone", color: "text-indigo-600 bg-indigo-50" },
  [NOTIFICATION_TYPES.ISSUE_ASSIGNED]: { icon: "wrench", color: "text-indigo-600 bg-indigo-50" },
  [NOTIFICATION_TYPES.ISSUE_STATUS_CHANGED]: { icon: "clock", color: "text-amber-600 bg-amber-50" },
  [NOTIFICATION_TYPES.ISSUE_RESOLVED]: { icon: "checkCircle", color: "text-emerald-600 bg-emerald-50" },
  [NOTIFICATION_TYPES.ISSUE_CRITICAL]: { icon: "alert", color: "text-rose-600 bg-rose-50" },
  [NOTIFICATION_TYPES.MAINTENANCE_STARTED]: { icon: "tool", color: "text-amber-600 bg-amber-50" },
  [NOTIFICATION_TYPES.MAINTENANCE_COMPLETED]: { icon: "shieldCheck", color: "text-emerald-600 bg-emerald-50" },
};

function readAll() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted notification data, clearing it.", err);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    return [];
  }
}

function writeAll(list) {
  const previous = readAll();
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
  const previousById = new Map(previous.map((notification) => [notification.id, notification]));
  const changed = list.filter((notification) => JSON.stringify(previousById.get(notification.id)) !== JSON.stringify(notification));
  void publishSharedRecords("notifications", changed);
}

function generateNotificationId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `NTF-${stamp}${rand}`;
}

/**
 * Creates one notification record.
 *
 * - `recipientId` addresses a specific user (e.g. the client who made a
 *   booking, or the worker an issue was just assigned to).
 * - `recipientRole` alone (with no `recipientId`) is a role-wide
 *   broadcast — every logged-in user of that role sees it. This is how
 *   "every admin" notifications (new issue, critical issue, worker
 *   assignment, maintenance, booking/payment activity) work, since the
 *   mock data only ever has one seeded admin account.
 * - When both are set, `recipientRole` is just descriptive metadata; the
 *   `recipientId` match is what actually scopes visibility.
 */
export function createNotification({
  recipientId = null,
  recipientRole,
  type,
  message,
  relatedId = null,
  relatedType = null,
}) {
  const category = TYPE_TO_SETTINGS_CATEGORY[type];
  if (category && !isNotificationCategoryEnabled(category)) return null;

  const list = readAll();
  const notification = {
    id: generateNotificationId(),
    recipientId,
    recipientRole,
    type,
    message,
    relatedId,
    relatedType,
    createdAt: new Date().toISOString(),
    read: false,
  };
  list.push(notification);
  writeAll(list);
  return notification;
}

/** Every notification meant for this user: either addressed to them
 * directly by id, or broadcast to their whole role with no specific
 * recipient set. Newest first. */
export function getNotificationsForUser(userId, role) {
  return readAll()
    .filter((n) => n.recipientId === userId || (!n.recipientId && n.recipientRole === role))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getUnreadCountForUser(userId, role) {
  return getNotificationsForUser(userId, role).filter((n) => !n.read).length;
}

export function markNotificationRead(id) {
  const list = readAll();
  const idx = list.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  if (list[idx].read) return list[idx];
  list[idx] = { ...list[idx], read: true };
  writeAll(list);
  return list[idx];
}

/** Marks every notification visible to this user (direct + role
 * broadcasts) as read in one write. */
export function markAllNotificationsRead(userId, role) {
  const list = readAll();
  let changed = false;
  const updated = list.map((n) => {
    const isForUser = n.recipientId === userId || (!n.recipientId && n.recipientRole === role);
    if (isForUser && !n.read) {
      changed = true;
      return { ...n, read: true };
    }
    return n;
  });
  if (changed) writeAll(updated);
  return updated;
}

/** Short, human "time ago" label for a notification timestamp. */
export function formatRelativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
