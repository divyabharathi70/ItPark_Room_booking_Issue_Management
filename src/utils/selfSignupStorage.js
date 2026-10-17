// Thin localStorage-backed persistence for visitors who create their own
// Client account via the public /signup page.
//
// IMPORTANT — this is intentionally a SEPARATE store from
// utils/clientStorage.js. clientStorage.js documents a strict invariant:
// a Client record there is only ever created via Admin confirming a paid
// guest booking (Payment Successful + Admin Confirmation). Self-service
// signup is a different, additive path — someone creating an ordinary
// account on the website, the way any booking site lets a visitor sign
// up — and must never bypass or touch that existing approval workflow.
// So self-signed-up accounts live entirely in their own key here; nothing
// in this file reads or writes CLIENTS_KEY.
//
// Mirrors the same synchronous, mock-only pattern used everywhere else in
// utils/*.js.

const SELF_USERS_KEY = "itpark_self_signup_users";

export const SELF_SIGNUP_EVENT = "itpark:self-signup-changed";

function readAll() {
  try {
    const raw = localStorage.getItem(SELF_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Corrupted self-signup data, clearing it.", err);
    localStorage.removeItem(SELF_USERS_KEY);
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(SELF_USERS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(SELF_SIGNUP_EVENT));
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function generateSelfClientId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `SU-${stamp}${rand}`;
}

export function getSelfSignupUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return readAll().find((u) => normalizeEmail(u.email) === normalized) || null;
}

/**
 * Registers a new self-service Client account. Returns
 * { ok: false, error } if the email is already taken by this store; the
 * caller (AuthContext.signup) is responsible for also checking the demo
 * MOCK_USERS and admin-confirmed Client records so a single email can't
 * collide across stores.
 */
export function registerSelfSignupUser({ name, email, phone, company, password }) {
  const normalizedEmail = normalizeEmail(email);
  const list = readAll();
  if (list.some((u) => normalizeEmail(u.email) === normalizedEmail)) {
    return { ok: false, error: "An account with that email already exists." };
  }
  const created = {
    id: generateSelfClientId(),
    name: (name || "").trim(),
    email: normalizedEmail,
    phone: (phone || "").trim() || null,
    company: (company || "").trim() || null,
    password,
    createdAt: new Date().toISOString(),
  };
  list.push(created);
  writeAll(list);
  return { ok: true, user: created };
}
