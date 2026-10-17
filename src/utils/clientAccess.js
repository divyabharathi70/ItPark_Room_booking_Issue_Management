// Answers ONE question for the whole app: "is this person an APPROVED client?"
//
// Signing up does not make someone a client. A person becomes an approved
// client only after they have paid for a booking AND an Admin has accepted
// it (see bookingStorage.approveBooking -> clientStorage.activateClient).
// That approval is stored in the "itpark_clients" localStorage list, so it
// survives a page refresh and can be re-checked at any time.
//
// Login, the route guard (ProtectedRoute) and the public navbar all call
// these helpers, so they can never disagree with each other.

import { MOCK_USERS, ROLES, PENDING_USER_ROLE } from "../data/mockUsers";
import { getClientByEmail } from "./clientStorage";

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

/** True when this email belongs to an approved, active client:
 *  - the built-in demo client account (client@company.com), or
 *  - a client record created by Admin accepting a paid booking. */
export function isApprovedClientEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  const isDemoClient = MOCK_USERS.some(
    (u) => u.role === ROLES.CLIENT && u.email.toLowerCase() === normalized
  );
  if (isDemoClient) return true;

  const client = getClientByEmail(normalized);
  return !!(client && client.approved && client.active);
}

/** The role a client-type person should have right now: "client" if they
 *  are approved, otherwise the plain registered-user role. */
export function getClientAccessRole(email) {
  return isApprovedClientEmail(email) ? ROLES.CLIENT : PENDING_USER_ROLE;
}
