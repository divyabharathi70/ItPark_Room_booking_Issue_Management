import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_HOME, ROLES, PENDING_USER_ROLE } from "../data/mockUsers";
import { getPendingBookingRoomId, clearPendingBookingRoomId, clientBookingPath } from "../utils/pendingBookingStorage";

/**
 * Wraps routes that should only be visible to signed-out visitors
 * (/login, /signup). If a session already exists, skip straight to that
 * role's dashboard instead of showing the form again — unless the visitor
 * has a room pending from the public booking flow, in which case a Client
 * session is sent straight back to finish that booking instead.
 */
export default function GuestRoute() {
  const { user, isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) return null;

  if (isAuthenticated) {
    const pendingRoomId = getPendingBookingRoomId();
    if (pendingRoomId && (user.role === ROLES.CLIENT || user.role === PENDING_USER_ROLE)) {
      clearPendingBookingRoomId();
      return <Navigate to={clientBookingPath(pendingRoomId)} replace />;
    }
    return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  }

  return <Outlet />;
}
