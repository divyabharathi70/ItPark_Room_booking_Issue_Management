import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLES, PENDING_USER_ROLE } from "../data/mockUsers";
import { isApprovedClientEmail } from "../utils/clientAccess";

/**
 * Wrap around a group of routes to require an authenticated session.
 * Optionally restrict access further to a specific list of roles.
 *
 * Usage:
 *   <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
 *     <Route path="/admin/dashboard" element={<AdminDashboard />} />
 *   </Route>
 */
export default function ProtectedRoute({ allowedRoles }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  // Avoid a flash-redirect to /login while we're still reading
  // localStorage on first load.
  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-blueprint-bg">
        <div className="flex items-center gap-3 font-mono text-sm text-blueprint-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blueprint-amber" />
          VERIFYING SESSION…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // The "client" role is only valid for an APPROVED client. It is re-checked
  // against the stored client records on every navigation (not just trusted
  // from the saved session), so typing /client/dashboard into the address bar
  // can never get a signed-up-but-not-approved user in.
  let role = user.role;
  if (role === ROLES.CLIENT && !isApprovedClientEmail(user.email)) {
    role = PENDING_USER_ROLE;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
