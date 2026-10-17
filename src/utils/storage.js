// Thin wrapper around localStorage so the rest of the app never touches
// the raw API directly. Everything here is synchronous mock persistence —
// there is no server session behind it.

const SESSION_KEY = "itpark_session";

export function saveSession(user) {
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organization: user.organization || null,
    phone: user.phone || null,
    department: user.department || null,
    profilePicture: user.profilePicture || null,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Corrupted session data, clearing it.", err);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
