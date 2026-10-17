// Thin localStorage-backed persistence for admin category management.
// Mirrors the pattern already used in utils/issueStorage.js / bookingStorage.js
// — synchronous, mock-only, no server behind it.
//
// IMPORTANT — this does NOT introduce a second, incompatible category model.
// The app already has a real category structure:
//   - Issue categories: ISSUE_CATEGORIES groups in utils/issueStorage.js
//     (Facilities, Technical, Cleanliness, Safety), which drive the Raise
//     Issue form, priority suggestions, and department routing.
//   - Room "categories": the capacity buckets (Small / Medium / Large)
//     already used as the room type filter on Admin > Rooms.
// Those groups/buckets are surfaced here as read-only "system" categories
// so admins can see real counts and toggle their active flag for
// organizational/reporting purposes. Nothing here changes the values that
// issueStorage.js or Rooms.jsx actually key off of, so existing issue
// category filtering, routing, and the Raise Issue form are untouched.
//
// Admins can additionally define their own custom categories (of either
// type) for extra organization — these are fully editable/deletable and
// live entirely in this store.

import { ISSUE_CATEGORIES, CATEGORY_LOOKUP, getAllIssues } from "./issueStorage";
import { CAPACITY_BUCKETS } from "../data/mockRooms";
import { getAllRooms } from "./roomStorage";

const CATEGORIES_KEY = "itpark_categories";

// Dispatched on every write so any mounted component (e.g. multiple open
// tabs of the Categories page) can react — mirrors ROOM_STATUS_EVENT.
export const CATEGORY_EVENT = "itpark:categories-changed";

export const CATEGORY_TYPES = {
  ROOM: "ROOM",
  ISSUE: "ISSUE",
};

export const CATEGORY_TYPE_LABELS = {
  [CATEGORY_TYPES.ROOM]: "Room",
  [CATEGORY_TYPES.ISSUE]: "Issue",
};

function readStore() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : { custom: [], overrides: {} };
  } catch (err) {
    console.error("Corrupted category data, clearing it.", err);
    localStorage.removeItem(CATEGORIES_KEY);
    return { custom: [], overrides: {} };
  }
}

function writeStore(store) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CATEGORY_EVENT));
}

// ---------------------------------------------------------------------
// System categories — derived live from real app data, never stored.
// Only their `active` flag (and, for issue groups, description) can be
// overridden, and those overrides live in store.overrides[id].
// ---------------------------------------------------------------------

function buildSystemIssueCategories() {
  return Object.entries(ISSUE_CATEGORIES).map(([key, group]) => ({
    id: `sys-issue-${key}`,
    system: true,
    type: CATEGORY_TYPES.ISSUE,
    key,
    name: group.label,
    defaultDescription: `Issues related to ${group.label.toLowerCase()} — covers ${group.items
      .map((i) => i.label)
      .join(", ")}.`,
    icon: group.icon,
    items: group.items,
  }));
}

function buildSystemRoomCategories() {
  return CAPACITY_BUCKETS.map((bucket) => ({
    id: `sys-room-${bucket.id}`,
    system: true,
    type: CATEGORY_TYPES.ROOM,
    key: bucket.id,
    name: bucket.label,
    defaultDescription: `Rooms with a capacity in the "${bucket.label}" range.`,
    icon: "door",
    test: bucket.test,
  }));
}

function relatedCountForSystem(category, issues) {
  if (category.type === CATEGORY_TYPES.ISSUE) {
    return issues.filter((i) => i.categoryGroup === category.key).length;
  }
  return getAllRooms().filter((r) => category.test(r.capacity)).length;
}

function relatedCountForCustom(category, issues) {
  if (category.type === CATEGORY_TYPES.ROOM) {
    const validRoomIds = new Set(getAllRooms().map((r) => r.id));
    return (category.roomIds || []).filter((id) => validRoomIds.has(id)).length;
  }
  // ISSUE custom category: counts real issues whose category value was
  // explicitly linked to this custom grouping.
  const values = new Set(category.issueValues || []);
  if (values.size === 0) return 0;
  return issues.filter((i) => values.has(i.category)).length;
}

/** Every available (existing app) issue category value, grouped — used to
 * populate the "link existing categories" picker when creating/editing a
 * custom ISSUE category. */
export function getLinkableIssueValues() {
  return Object.entries(ISSUE_CATEGORIES).map(([key, group]) => ({
    group: key,
    groupLabel: group.label,
    items: group.items.map((i) => ({ value: i.value, label: i.label })),
  }));
}

/** Every existing room, for the "assign rooms" picker on a custom ROOM
 * category. */
export function getAssignableRooms() {
  return getAllRooms().map((r) => ({ id: r.id, name: r.name, roomNumber: r.roomNumber, floor: r.floor }));
}

export function getCategoryLookupLabel(value) {
  return CATEGORY_LOOKUP[value]?.label || value;
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------

/** Full merged list: system categories (live-derived, with any stored
 * overrides applied) + custom categories, each with a freshly computed
 * `relatedCount` and resolved `active`/`description`. */
export function getCategories() {
  const store = readStore();
  const issues = getAllIssues();

  const systemCats = [...buildSystemIssueCategories(), ...buildSystemRoomCategories()].map((cat) => {
    const override = store.overrides[cat.id] || {};
    return {
      id: cat.id,
      system: true,
      type: cat.type,
      name: cat.name,
      description: override.description ?? cat.defaultDescription,
      icon: cat.icon,
      active: override.active !== undefined ? override.active : true,
      relatedCount: relatedCountForSystem(cat, issues),
      createdAt: null,
    };
  });

  const customCats = (store.custom || []).map((cat) => ({
    ...cat,
    system: false,
    relatedCount: relatedCountForCustom(cat, issues),
  }));

  return [...systemCats, ...customCats].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCategoryById(id) {
  return getCategories().find((c) => c.id === id) || null;
}

function generateCategoryId() {
  return `cat-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** Creates a new custom category. `type` must be CATEGORY_TYPES.ROOM or
 * .ISSUE. `roomIds` / `issueValues` are optional links used purely for
 * the related-count calculation above. */
export function addCategory({ type, name, description, roomIds = [], issueValues = [] }) {
  const store = readStore();
  const category = {
    id: generateCategoryId(),
    type,
    name: name.trim(),
    description: (description || "").trim(),
    active: true,
    roomIds: type === CATEGORY_TYPES.ROOM ? roomIds : [],
    issueValues: type === CATEGORY_TYPES.ISSUE ? issueValues : [],
    createdAt: new Date().toISOString(),
  };
  store.custom = [...(store.custom || []), category];
  writeStore(store);
  return category;
}

/** Updates a category. For system categories, only `description` and
 * `active` may change (stored as an override) — their name/type/key stay
 * tied to the real ISSUE_CATEGORIES group or capacity bucket they mirror,
 * so nothing that issueStorage.js or the booking/room filters rely on is
 * ever altered here. Custom categories support full field updates. */
export function updateCategory(id, patch) {
  const store = readStore();
  if (id.startsWith("sys-")) {
    const existingOverride = store.overrides[id] || {};
    const nextOverride = { ...existingOverride };
    if (patch.description !== undefined) nextOverride.description = patch.description;
    if (patch.active !== undefined) nextOverride.active = patch.active;
    store.overrides = { ...store.overrides, [id]: nextOverride };
    writeStore(store);
    return getCategoryById(id);
  }

  const idx = (store.custom || []).findIndex((c) => c.id === id);
  if (idx === -1) return null;
  store.custom[idx] = { ...store.custom[idx], ...patch, id };
  writeStore(store);
  return getCategoryById(id);
}

export function toggleCategoryActive(id) {
  const current = getCategoryById(id);
  if (!current) return null;
  return updateCategory(id, { active: !current.active });
}

/** Deletes a custom category. Refuses (returns a reason instead of
 * deleting) for system categories — which are structural, not
 * app-managed rows — and for any custom category that still has rooms or
 * issue values linked to it and therefore a non-zero related count, so an
 * admin can never silently orphan a reference. Deactivate instead in that
 * case. */
export function deleteCategory(id) {
  const category = getCategoryById(id);
  if (!category) return { success: false, reason: "Category not found." };
  if (category.system) {
    return {
      success: false,
      reason: "Built-in categories can't be deleted — deactivate them instead.",
    };
  }
  if (category.relatedCount > 0) {
    return {
      success: false,
      reason: `This category still has ${category.relatedCount} linked ${
        category.type === CATEGORY_TYPES.ROOM ? "room(s)" : "issue(s)"
      }. Remove those links or deactivate the category instead of deleting it.`,
    };
  }
  const store = readStore();
  store.custom = (store.custom || []).filter((c) => c.id !== id);
  writeStore(store);
  return { success: true };
}
