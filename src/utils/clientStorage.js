// Thin localStorage-backed persistence for real Client accounts. Mirrors the
// pattern already used across utils/*.js — synchronous, mock-only, no server
// behind it.
//
// THIS IS THE KEY CLIENT ACTIVATION WORKFLOW.
//
// A person becomes a Client only after Admin approves their booking. The
// only call site allowed to create or activate a Client is
// bookingStorage.approveBooking(). Payment status is tracked separately.
//
// Identity: a Client is uniquely identified by email (normalized to
// lower-case). Confirming a second booking from an email that's already a
// Client reuses that same Client record — it never creates a duplicate.

import { STAFF_OVERRIDES_EVENT } from "./staffOverridesStorage";
import { publishSharedRecords } from "./sharedDataSync";

const CLIENTS_KEY = "itpark_clients";

// Reuses the same event the admin staff-overrides store dispatches so the
// Admin > Clients page (which already listens for STAFF_OVERRIDES_EVENT)
// refreshes automatically the moment a Client is created/activated here —
// no changes needed there just to pick up new records. Also dispatches its
// own, more specific event for anything that only cares about Clients.
export const CLIENTS_EVENT = "itpark:clients-changed";

function readAll() {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted client data, clearing it.", err);
    localStorage.removeItem(CLIENTS_KEY);
    return [];
  }
}

function writeAll(list) {
  const previous = readAll();
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CLIENTS_EVENT));
  window.dispatchEvent(new Event(STAFF_OVERRIDES_EVENT));
  const previousByEmail = new Map(previous.map((client) => [normalizeEmail(client.email), client]));
  const changed = list.filter((client) => JSON.stringify(previousByEmail.get(normalizeEmail(client.email))) !== JSON.stringify(client));
  void publishSharedRecords("clients", changed);
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function generateClientId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `CLI-${stamp}${rand}`;
}

export function getAllClients() {
  return readAll();
}

export function getClientById(clientId) {
  return readAll().find((c) => c.clientId === clientId) || null;
}

export function getClientByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return readAll().find((c) => normalizeEmail(c.email) === normalized) || null;
}

/**
 * The single entrypoint for turning a customer into a Client. Call this
 * ONLY after Admin approves a booking — never merely when payment succeeds.
 *
 * DUPLICATE PREVENTION: looked up by email (the unique Client identity). If
 * a Client with this email already exists, that record is reused (and
 * (re)activated/approved, with any missing contact details filled in) —
 * never duplicated. Otherwise a brand-new Client is created, already
 * active + approved since both required conditions are already satisfied
 * by the time this is called.
 *
 * Returns the resulting Client record — { clientId, name, email, phone,
 * company, active, approved, createdAt }.
 */
export function activateClient({ clientId, name, email, phone, company }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const list = readAll();
  const idx = list.findIndex((c) => normalizeEmail(c.email) === normalizedEmail);

  if (idx !== -1) {
    // Reuse existing client — do NOT create a duplicate. Fill in any
    // details that were missing before, and make sure a client who was
    // previously deactivated is (re)activated by this fresh confirmation.
    const existing = list[idx];
    const updated = {
      ...existing,
      name: existing.name || name || existing.email,
      phone: existing.phone || phone || null,
      company: existing.company || company || null,
      active: true,
      approved: true,
    };
    list[idx] = updated;
    writeAll(list);
    return updated;
  }

  const created = {
    clientId: clientId || generateClientId(),
    name: (name || "").trim() || normalizedEmail,
    email: normalizedEmail,
    phone: (phone || "").trim() || null,
    company: (company || "").trim() || null,
    active: true,
    approved: true,
    createdAt: new Date().toISOString(),
  };
  list.push(created);
  writeAll(list);
  return created;
}

export function updateClient(clientId, patch) {
  const list = readAll();
  const idx = list.findIndex((c) => c.clientId === clientId);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  writeAll(list);
  return list[idx];
}
