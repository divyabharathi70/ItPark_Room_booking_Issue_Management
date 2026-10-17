import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_HOME, ROLE_LABELS, PENDING_USER_ROLE } from "../data/mockUsers";

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const isPendingUser = user?.role === PENDING_USER_ROLE;
  // A registered user (booking not approved yet) has no dashboard to go back
  // to, so they are sent to the public home page instead.
  const homePath = user ? ROLE_HOME[user.role] || "/" : "/login";

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-blueprint-bg blueprint-grid-bg px-6">
      <div className="w-full max-w-md rounded-lg border border-blueprint-line bg-blueprint-panel p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-blueprint-error/50 bg-blueprint-error/10 text-blueprint-error">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 9v4M12 17h.01M10.3 3.6 2.6 17.4A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.6L13.7 3.6a1.8 1.8 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mb-1 font-mono text-[11px] tracking-[0.25em] text-blueprint-error">ACCESS DENIED</p>
        <h1 className="font-display text-2xl font-semibold text-blueprint-text">Zone restricted</h1>
        <p className="mt-3 text-sm leading-relaxed text-blueprint-muted">
          {isPendingUser ? (
            "The Client Dashboard becomes available once an administrator approves your booking request. You can still browse rooms and request bookings from the home page."
          ) : user ? (
            <>
              Your account is registered as{" "}
              <span className="font-medium text-blueprint-steel">{ROLE_LABELS[user.role]}</span>.
              This area belongs to a different access zone.
            </>
          ) : (
            "You need to sign in before entering this zone."
          )}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to={homePath}
            className="rounded-md bg-blueprint-amber px-5 py-2.5 font-display text-sm font-semibold text-blueprint-bg transition hover:bg-blueprint-amberDim"
          >
            {isPendingUser ? "Back to home" : "Go to my dashboard"}
          </Link>
          {user && (
            <button
              onClick={logout}
              className="rounded-md border border-blueprint-line px-5 py-2.5 font-display text-sm font-semibold text-blueprint-text transition hover:border-blueprint-steel2"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
