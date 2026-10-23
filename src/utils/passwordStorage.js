const PASSWORDS_KEY = "itpark_user_passwords";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(PASSWORDS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getStoredPassword(userId, fallback = "") {
  return userId ? readAll()[userId] || fallback : fallback;
}

export function saveStoredPassword(userId, password) {
  if (!userId || !password) return false;
  const passwords = readAll();
  passwords[userId] = password;
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  return true;
}
