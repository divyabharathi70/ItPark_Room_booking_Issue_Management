import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { MOCK_USERS, ROLES, PENDING_USER_ROLE } from "../data/mockUsers";
import { saveSession, getSession, clearSession } from "../utils/storage";
import { getClientByEmail, CLIENTS_EVENT } from "../utils/clientStorage";
import { getSelfSignupUserByEmail, registerSelfSignupUser } from "../utils/selfSignupStorage";
import { getClientAccessRole } from "../utils/clientAccess";
import { getUserProfile, saveUserProfile } from "../utils/profileStorage";
import { getCustomStaff, STAFF_ROLE } from "../utils/customStaffStorage";
import { getStaffOverride, isStaffActive, isStaffDeleted } from "../utils/staffOverridesStorage";
import { getStoredPassword, saveStoredPassword } from "../utils/passwordStorage";

const AuthContext = createContext(null);

// Clients created/activated via the Admin booking-confirmation flow (see
// utils/clientStorage.js) don't get to pick a password — there's no
// signup screen in this mock app. They sign in with this fixed demo
// password instead, the same way every other MOCK_USERS demo account uses
// "123456". This never affects the static demo users above.
const ACTIVATED_CLIENT_PASSWORD = "123456";

// A restored session only remembers the role it was saved with. For anyone
// who signed up as a customer, re-check that role against the approved-client
// records so access is always correct after a refresh: a "user" whose booking
// has since been accepted becomes a "client", and a session that says "client"
// for someone who was never approved is corrected back to "user". Admin,
// Employee and Worker sessions are never touched.
function refreshClientRole(session) {
  if (!session) return null;
  if (session.role !== ROLES.CLIENT && session.role !== PENDING_USER_ROLE) return session;

  const role = getClientAccessRole(session.email);
  if (role === session.role) return session;
  return saveSession({ ...session, role });
}

function withSavedProfile(session) {
  return session ? { ...session, ...getUserProfile(session.id) } : null;
}

export function AuthProvider({ children }) {
  // Lazy initializer: restore any session persisted in localStorage on the
  // very first render so a page refresh doesn't kick the user back to the
  // login screen (and so there's no separate "loading" flash afterward).
  const [user, setUser] = useState(() => withSavedProfile(refreshClientRole(getSession())));
  const [isInitializing] = useState(false);

  // If the approved-client records change while the app is open (Admin
  // accepting a booking, or another tab), re-check the signed-in customer's role.
  useEffect(() => {
    function recheckRole() {
      const stored = getSession();
      const refreshed = withSavedProfile(refreshClientRole(stored));
      if (stored && refreshed) setUser(refreshed);
    }
    window.addEventListener(CLIENTS_EVENT, recheckRole);
    window.addEventListener("storage", recheckRole);
    return () => {
      window.removeEventListener(CLIENTS_EVENT, recheckRole);
      window.removeEventListener("storage", recheckRole);
    };
  }, []);

  const login = useCallback(({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const match = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );

    if (match) {
      if (getStoredPassword(match.id, match.password) !== password) {
        return { ok: false, error: "Incorrect password. Please try again." };
      }
      const session = saveSession(match);
      setUser(withSavedProfile(session));
      return { ok: true, user: session };
    }

    const employee = getCustomStaff(STAFF_ROLE.EMPLOYEE).find((entry) =>
      (getStaffOverride(entry.id).email || entry.email).trim().toLowerCase() === normalizedEmail
    );
    if (employee?.clientId) {
      if (employee.clientId && !isStaffActive(employee.id)) {
        return { ok: false, error: "This employee account is inactive. Contact your client administrator." };
      }
      if (isStaffDeleted(employee.id)) return { ok: false, error: "No account found with that email." };
      if (getStoredPassword(employee.id, "123456") !== password) return { ok: false, error: "Incorrect password. Please try again." };
      const override = getStaffOverride(employee.id);
      const session = saveSession({ id: employee.id, name: override.name || employee.name, email: override.email || employee.email, role: ROLES.EMPLOYEE, organization: override.organization || employee.organization, phone: override.phone || employee.phone, clientId: employee.clientId });
      setUser(withSavedProfile(session));
      return { ok: true, user: session };
    }

    // A signed-up user keeps their own login credentials. They only get the
    // "client" role if Admin has accepted one of their bookings;
    // otherwise they sign in as a regular (pending) user with no dashboard.
    const selfUser = getSelfSignupUserByEmail(normalizedEmail);
    if (selfUser) {
      if (getStoredPassword(selfUser.id, selfUser.password) !== password) {
        return { ok: false, error: "Incorrect password. Please try again." };
      }
      const session = saveSession({
        id: selfUser.id,
        name: selfUser.name,
        email: selfUser.email,
        role: getClientAccessRole(selfUser.email),
        organization: selfUser.company || null,
        phone: selfUser.phone || null,
      });
      setUser(withSavedProfile(session));
      return { ok: true, user: session };
    }

    // Guest bookings become client accounts after Admin confirmation and
    // continue using the existing demo password.
    const client = getClientByEmail(normalizedEmail);
    if (client && client.approved && client.active) {
      if (getStoredPassword(client.clientId, ACTIVATED_CLIENT_PASSWORD) !== password) {
        return { ok: false, error: "Incorrect password. Please try again." };
      }
      const session = saveSession({
        id: client.clientId,
        name: client.name,
        email: client.email,
        role: ROLES.CLIENT,
        organization: client.company || null,
        phone: client.phone || null,
      });
      setUser(withSavedProfile(session));
      return { ok: true, user: session };
    }

    return { ok: false, error: "No account found with that email." };
  }, []);

  // Public self-service signup (route "/signup"). Creates a regular user
  // account (NOT a client). The user can browse rooms and request a booking,
  // but only becomes an approved client - and gets the Client Dashboard - once
  // Admin accepts a booking (see utils/clientStorage.js header comment).
  const signup = useCallback(({ name, email, phone, company, password }) => {
    const normalizedEmail = (email || "").trim().toLowerCase();

    const takenByDemoUser = MOCK_USERS.some((u) => u.email.toLowerCase() === normalizedEmail);
    const takenByConfirmedClient = !!getClientByEmail(normalizedEmail);
    if (takenByDemoUser || takenByConfirmedClient) {
      return { ok: false, error: "An account with that email already exists. Try signing in instead." };
    }

    const result = registerSelfSignupUser({ name, email: normalizedEmail, phone, company, password });
    if (!result.ok) return result;

    const session = saveSession({
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: PENDING_USER_ROLE,
      organization: result.user.company || null,
      phone: result.user.phone || null,
    });
    setUser(withSavedProfile(session));
    return { ok: true, user: session };
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateProfile = useCallback((patch) => {
    if (!user) return null;
    const profile = saveUserProfile(user.id, patch, user);
    const updated = saveSession({ ...user, ...profile });
    setUser(updated);
    return updated;
  }, [user]);

  const changePassword = useCallback(({ currentPassword, newPassword }) => {
    if (!user) return { ok: false, error: "Please sign in again before changing your password." };
    const mockUser = MOCK_USERS.find((entry) => entry.id === user.id);
    const selfUser = getSelfSignupUserByEmail(user.email);
    const fallback = mockUser?.password || selfUser?.password || ACTIVATED_CLIENT_PASSWORD;
    if (getStoredPassword(user.id, fallback) !== currentPassword) {
      return { ok: false, error: "Current password is incorrect." };
    }
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: "New password must be at least 6 characters." };
    }
    saveStoredPassword(user.id, newPassword);
    return { ok: true };
  }, [user]);

  const value = {
    user,
    isAuthenticated: !!user,
    isInitializing,
    login,
    signup,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
