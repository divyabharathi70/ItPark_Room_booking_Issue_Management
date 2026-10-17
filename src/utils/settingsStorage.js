// Thin localStorage-backed persistence for Admin > Settings. Mirrors the
// pattern already used across utils/*.js — synchronous, mock-only, no
// server behind it.
//
// Scope note: this is a frontend-only project, so "settings" here means
// saved preferences/defaults, not a backend config service. Where a
// setting can safely and predictably control something that already
// exists (the four Notifications toggles gate createNotification() in
// notificationStorage.js; Park/System Name is reflected in the sidebar
// brand), it does. Everywhere else — Booking/Room/Issue defaults that
// would otherwise mean reaching into the booking flow, room/maintenance
// logic, or issue routing — the value is saved and surfaced as a
// reference default rather than silently rewired into those working
// screens, per the "don't let settings quietly break existing features"
// rule this page was built under.

const SETTINGS_KEY = "itpark_admin_settings";

// Dispatched on every write so any mounted component (Sidebar brand,
// multiple open tabs of Settings) can react immediately — mirrors
// CATEGORY_EVENT / ROOM_STATUS_EVENT.
export const SETTINGS_EVENT = "itpark:settings-changed";

export const DEFAULT_SETTINGS = {
  general: {
    parkName: "IT Park",
    defaultBookingDuration: "4h", // 1h | 4h | 1d | 1w | 1m
    defaultAdvanceBookingDays: 30,
    defaultCancellationPolicy: "flexible", // flexible | moderate | strict
  },
  booking: {
    bookingEnabled: true,
    allowExtensions: true,
    maxBookingDurationValue: 5,
    maxBookingDurationUnit: "years", // matches DURATION_UNITS ids in bookingStorage.js
    defaultBookingStatus: "CONFIRMED", // matches BOOKING_STATUS values
  },
  room: {
    defaultCapacityBucket: "medium", // matches CAPACITY_BUCKETS ids in mockRooms.js
    autoMarkUnavailableOnMaintenance: true,
    maintenanceRequiresApproval: false,
  },
  issues: {
    defaultPriority: "MEDIUM", // matches PRIORITY values in issueStorage.js
    autoEscalateCritical: true,
    autoAssignToLeastBusyWorker: false,
  },
  notifications: {
    bookings: true,
    issues: true,
    maintenance: true,
    critical: true,
  },
};

function deepMerge(defaults, saved) {
  if (!saved || typeof saved !== "object") return { ...defaults };
  const result = {};
  for (const key of Object.keys(defaults)) {
    const defaultVal = defaults[key];
    const savedVal = saved[key];
    if (defaultVal && typeof defaultVal === "object" && !Array.isArray(defaultVal)) {
      result[key] = deepMerge(defaultVal, savedVal);
    } else {
      result[key] = savedVal !== undefined ? savedVal : defaultVal;
    }
  }
  return result;
}

/** Full settings object, merged over DEFAULT_SETTINGS so a partially-saved
 * or older shape never produces `undefined` fields for the page to render. */
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(raw));
  } catch (err) {
    console.error("Corrupted settings data, clearing it.", err);
    localStorage.removeItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  const merged = deepMerge(DEFAULT_SETTINGS, settings);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return merged;
}

/** Restores every field to DEFAULT_SETTINGS but keeps the key populated
 * (as opposed to clearSettings, which removes it entirely). */
export function resetSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return { ...DEFAULT_SETTINGS };
}

/** Removes the settings key from localStorage entirely. Reads fall back
 * to DEFAULT_SETTINGS afterwards, same as a first-run visit. */
export function clearSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return { ...DEFAULT_SETTINGS };
}

/** Display name for the sidebar brand block. Falls back to the app's
 * original hardcoded name if nothing has been saved or the saved value
 * is blank, so Sidebar.jsx never renders an empty title. */
export function getParkName() {
  const name = getSettings().general.parkName;
  return name && name.trim() ? name.trim() : DEFAULT_SETTINGS.general.parkName;
}

/** Whether notifications of a given category should be created. Used by
 * notificationStorage.js so the four Notifications toggles have a real,
 * narrowly-scoped effect without that module needing to know anything
 * about the Settings page itself. Unknown categories default to enabled
 * so nothing is silently dropped if a new notification type is added
 * later without a matching settings entry. */
export function isNotificationCategoryEnabled(category) {
  const { notifications } = getSettings();
  if (!(category in notifications)) return true;
  return !!notifications[category];
}
