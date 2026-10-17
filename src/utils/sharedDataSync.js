// Shares booking workflow data between Vite servers running this project on
// different localhost ports. Each origin still has its own localStorage, so
// the Vite middleware provides one project-local source of truth.

const ENDPOINT = "/__itpark_shared_data";

const COLLECTIONS = {
  bookings: { key: "itpark_bookings", event: "itpark:bookings-changed" },
  notifications: { key: "itpark_notifications", event: "itpark:notifications-changed" },
  clients: { key: "itpark_clients", event: "itpark:clients-changed" },
  issues: { key: "itpark_issues", event: "itpark:issues-changed" },
  extendRequests: { key: "itpark_extend_requests", event: "itpark:extend-requests-changed" },
  staffProfiles: { key: "itpark_staff_profiles", event: "itpark:staff-profiles-changed" },
};

let syncTimer = null;
let syncPending = false;

function parseLocalCollection(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function itemKey(collection, item) {
  return collection === "clients" ? (item.email || "").trim().toLowerCase() : item.id;
}

function mergeCollections(collection, localItems, sharedItems) {
  const merged = new Map();
  const add = (item, preferNewest = false) => {
    const key = itemKey(collection, item);
    if (!key) return;
    const existing = merged.get(key);
    if (
      preferNewest && existing &&
      Date.parse(existing.lastUpdated || existing.updatedAt || existing.createdDate || existing.createdAt || 0) >
        Date.parse(item.lastUpdated || item.updatedAt || item.createdDate || item.createdAt || 0)
    ) return;
    merged.set(key, item);
  };
  localItems.forEach((item) => add(item));
  // Shared data wins for duplicate records, so a stale tab cannot undo an
  // approval or notification update that was already saved by another port.
  sharedItems.forEach((item) => add(item, collection === "issues" || collection === "extendRequests" || collection === "staffProfiles"));
  return Array.from(merged.values());
}

function dispatchCollectionEvent(collection) {
  window.dispatchEvent(new Event(COLLECTIONS[collection].event));
  if (collection === "clients") {
    window.dispatchEvent(new Event("itpark:staff-overrides-changed"));
  }
  if (collection === "staffProfiles") applySharedStaffProfiles();
}

function applySharedStaffProfiles() {
  try {
    const records = JSON.parse(localStorage.getItem(COLLECTIONS.staffProfiles.key) || "[]");
    const overrides = JSON.parse(localStorage.getItem("itpark_staff_overrides") || "{}");
    let changed = false;
    records.forEach(({ id, updatedAt, ...profile }) => {
      if (!id) return;
      const current = overrides[id] || {};
      if (Date.parse(current.updatedAt || 0) > Date.parse(updatedAt || 0)) return;
      overrides[id] = { ...current, ...profile, updatedAt };
      changed = true;
    });
    if (changed) {
      localStorage.setItem("itpark_staff_overrides", JSON.stringify(overrides));
      window.dispatchEvent(new Event("itpark:staff-overrides-changed"));
    }
  } catch {
    // Keep local profile edits available if shared staff data is malformed.
  }
}

async function fetchSharedData() {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`Shared data request failed (${response.status})`);
  return response.json();
}

export async function publishSharedRecords(collection, records) {
  if (!COLLECTIONS[collection] || records.length === 0) return;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection, records }),
    });
  } catch {
    // Keep this app usable with its existing localStorage fallback if the
    // shared local server is temporarily unavailable.
  }
}

export async function syncSharedData() {
  if (syncPending) return;
  syncPending = true;
  try {
    const shared = await fetchSharedData();
    for (const [collection, config] of Object.entries(COLLECTIONS)) {
      const localItems = parseLocalCollection(config.key);
      const sharedItems = Array.isArray(shared[collection]) ? shared[collection] : [];
      const merged = mergeCollections(collection, localItems, sharedItems);
      const mergedJson = JSON.stringify(merged);
      if (localStorage.getItem(config.key) !== mergedJson) {
        localStorage.setItem(config.key, mergedJson);
        dispatchCollectionEvent(collection);
      }

      // Migrate records that existed before shared storage was enabled. The
      // server upserts by record ID/email and preserves records from other
      // origins that are not present in this browser's localStorage.
      const sharedKeys = new Set(sharedItems.map((item) => itemKey(collection, item)));
      const localOnly = localItems.filter((item) => !sharedKeys.has(itemKey(collection, item)));
      if (localOnly.length) await publishSharedRecords(collection, localOnly);
    }
  } catch {
    // Local-only operation remains available if the Vite shared endpoint is
    // not running (for example, when a prebuilt static bundle is opened).
  } finally {
    syncPending = false;
  }
}

export function startSharedDataSync() {
  if (syncTimer !== null) return;
  syncTimer = window.setInterval(syncSharedData, 1200);
}

