// localStorage-backed store for Clients, Employees, and Workers that admin
// creates from scratch via "Add New …" in the admin panel. Complements
// staffOverridesStorage.js, which layers admin edits on top of the
// read-only mock directories (mockUsers.js / mockWorkers.js) — those source
// arrays are never mutated. Records added here have no source array to
// preserve, so add/edit/delete just mutate this list directly.

import { STAFF_OVERRIDES_EVENT } from "./staffOverridesStorage";

const CUSTOM_STAFF_KEY = "itpark_custom_staff";

export const STAFF_ROLE = {
  CLIENT: "client",
  EMPLOYEE: "employee",
  WORKER: "worker",
};

const ID_PREFIX = {
  [STAFF_ROLE.CLIENT]: "cc",
  [STAFF_ROLE.EMPLOYEE]: "ce",
  [STAFF_ROLE.WORKER]: "cw",
};

function readAll() {
  try {
    const raw = localStorage.getItem(CUSTOM_STAFF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted custom staff data, clearing it.", err);
    localStorage.removeItem(CUSTOM_STAFF_KEY);
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(CUSTOM_STAFF_KEY, JSON.stringify(list));
  // Reuse the same event the overrides store dispatches so every admin page
  // that already listens for it (Clients/Employees/Workers) refreshes too.
  window.dispatchEvent(new Event(STAFF_OVERRIDES_EVENT));
}

function nextId(role) {
  const prefix = ID_PREFIX[role] || "cs";
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/** All admin-added records for one role (client/employee/worker). */
export function getCustomStaff(role) {
  return readAll().filter((r) => r.role === role);
}

export function addCustomStaff(role, data) {
  const list = readAll();
  const record = {
    id: nextId(role),
    role,
    clientId: data.clientId || null,
    name: (data.name || "").trim(),
    email: (data.email || "").trim(),
    phone: (data.phone || "").trim() || null,
    organization: (data.organization || "").trim() || null,
    department: data.department || null,
    active: true,
    createdAt: new Date().toISOString(),
  };
  list.push(record);
  writeAll(list);
  return record;
}

export function updateCustomStaff(id, patch) {
  const list = readAll();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(list);
  return list[idx];
}

export function deleteCustomStaff(id) {
  const list = readAll().filter((r) => r.id !== id);
  writeAll(list);
}
