import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES, ROLE_HOME, PENDING_USER_ROLE } from "../../data/mockUsers";
import { isApprovedClientEmail } from "../../utils/clientAccess";
import Icon from "../icons/Icon";
import MobileNav from "./MobileNav";

// Public-facing (logged-out) top nav — visible on every marketing page.
const PUBLIC_LINKS = [
  { label: "Home", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "Amenities", path: "/amenities" },
  { label: "How It Works", path: "/how-it-works" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

// Nav for a signed-up user whose booking has not been approved yet: the
// public links plus a way to start a booking. No client-dashboard links.
const USER_LINKS = [...PUBLIC_LINKS, { label: "Book a Room", path: "/book-room" }];

// Nav shown instead, once an APPROVED Client is signed in and browsing the
// public site — never shows Admin/Worker/Employee links here.
const CLIENT_LINKS = [
  { label: "Home", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "Book a Room", path: "/client/book-room" },
  { label: "My Bookings", path: "/client/bookings" },
  { label: "Notifications", path: "/client/notifications" },
  { label: "Profile", path: "/client/profile" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-blueprint-steel2 text-blueprint-amber">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="font-display text-sm font-semibold tracking-wide text-blueprint-text">IT PARK</p>
        <p className="font-mono text-[10px] tracking-[0.2em] text-blueprint-muted">ROOM BOOKING</p>
      </div>
    </Link>
  );
}

function navLinkClass({ isActive }) {
  return `font-mono text-[11px] tracking-wider transition ${
    isActive ? "text-blueprint-amber" : "text-blueprint-steel hover:text-blueprint-amber"
  }`;
}

/**
 * Shell for every page reachable without an authenticated Admin/Employee/
 * Worker session — the public marketing site (Home, Rooms, Room Details,
 * Amenities, How It Works, About, FAQ, Contact) plus the no-login guest
 * booking flow at /book/:roomId. Deliberately does NOT use AppLayout/
 * Sidebar/Topbar — those stay behind ProtectedRoute — but reuses the same
 * blueprint-branded header treatment as Login.jsx / NotFound.jsx, and the
 * existing MobileNav drawer component for small screens, so the visual
 * language and mobile-menu behavior stay consistent across the app.
 *
 * Nav content adapts to auth state: a signed-out visitor sees the public
 * marketing links + Sign In/Sign Up; a signed-in Client sees their own
 * shortcut links + profile/logout instead. Admin/Employee/Worker sessions
 * never see role-specific navigation here — if one of them ends up on a
 * public page they just get a link back to their dashboard.
 */
export default function PublicLayout({ children, showFooter = true }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Three kinds of signed-in customer-type visitor:
  //  - approved client  -> client links + DASHBOARD button
  //  - registered user  -> public links, no dashboard (booking not approved yet)
  //  - everyone else (Admin/Employee/Worker) -> "MY DASHBOARD" link
  // Approval is re-checked from the stored client records, not just the role.
  const isCustomer = isAuthenticated && (user.role === ROLES.CLIENT || user.role === PENDING_USER_ROLE);
  const isApprovedClient = isCustomer && isApprovedClientEmail(user.email);
  const isClient = isApprovedClient;
  const isRegisteredUser = isCustomer && !isApprovedClient;
  const isOtherStaff = isAuthenticated && !isCustomer;
  const navLinks = isClient ? CLIENT_LINKS : isRegisteredUser ? USER_LINKS : PUBLIC_LINKS;

  function handleLogout() {
    setMobileOpen(false);
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-blueprint-nav bg-blueprint-nav blueprint-grid-bg">
        <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 lg:flex">
              {navLinks.map((item) => (
                <NavLink key={item.path} to={item.path} end={item.path === "/"} className={navLinkClass}>
                  {item.label.toUpperCase()}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {isClient ? (
              <>
                {isApprovedClient && (
                  <Link
                    to="/client/dashboard"
                    className="hidden rounded-md border border-blueprint-steel2 px-4 py-2 font-mono text-[11px] tracking-wider text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber sm:inline-block"
                  >
                    DASHBOARD
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden items-center gap-1.5 rounded-md border border-blueprint-steel2 px-4 py-2 font-mono text-[11px] tracking-wider text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber sm:inline-flex"
                >
                  <Icon name="logout" className="h-3.5 w-3.5" />
                  LOGOUT
                </button>
              </>
            ) : isRegisteredUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="hidden items-center gap-1.5 rounded-md border border-blueprint-steel2 px-4 py-2 font-mono text-[11px] tracking-wider text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber sm:inline-flex"
              >
                <Icon name="logout" className="h-3.5 w-3.5" />
                LOGOUT
              </button>
            ) : isOtherStaff ? (
              <Link
                to={ROLE_HOME[user.role] || "/"}
                className="hidden rounded-md border border-blueprint-steel2 px-4 py-2 font-mono text-[11px] tracking-wider text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber sm:inline-block"
              >
                MY DASHBOARD
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-md border border-blueprint-steel2 px-4 py-2 font-display text-sm font-semibold text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber sm:inline-block"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-blueprint-amber px-4 py-2 font-display text-sm font-semibold text-blueprint-bg transition hover:bg-blueprint-amberDim"
                >
                  Sign Up
                </Link>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-blueprint-line text-blueprint-muted transition hover:border-blueprint-amber hover:text-blueprint-amber lg:hidden"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <div className="flex h-full flex-col px-5 py-8">
          <div className="mb-8">
            <Logo />
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2.5 font-mono text-xs tracking-wider transition ${
                    isActive
                      ? "bg-blueprint-panel2 text-blueprint-amber"
                      : "text-blueprint-steel hover:bg-blueprint-panel2 hover:text-blueprint-amber"
                  }`
                }
              >
                {item.label.toUpperCase()}
              </NavLink>
            ))}
            {isApprovedClient && (
              <NavLink
                to="/client/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 font-mono text-xs tracking-wider text-blueprint-steel transition hover:bg-blueprint-panel2 hover:text-blueprint-amber"
              >
                DASHBOARD
              </NavLink>
            )}
            {isOtherStaff && (
              <NavLink
                to={ROLE_HOME[user.role] || "/"}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-3 py-2.5 font-mono text-xs tracking-wider text-blueprint-steel transition hover:bg-blueprint-panel2 hover:text-blueprint-amber"
              >
                MY DASHBOARD
              </NavLink>
            )}
          </nav>
          <div className="mt-6 border-t border-blueprint-line pt-6">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-blueprint-steel2 px-4 py-2.5 font-mono text-[11px] tracking-wider text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber"
              >
                <Icon name="logout" className="h-3.5 w-3.5" />
                LOGOUT
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center justify-center rounded-md border border-blueprint-steel2 px-4 py-2.5 font-display text-sm font-semibold text-blueprint-steel transition hover:border-blueprint-amber hover:text-blueprint-amber"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center justify-center rounded-md bg-blueprint-amber px-4 py-2.5 font-display text-sm font-semibold text-blueprint-bg transition hover:bg-blueprint-amberDim"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </MobileNav>

      <main className="flex-1">{children}</main>

      {showFooter && <PublicFooter />}
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-indigo-200 text-indigo-600">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-display text-sm font-semibold text-slate-900">IT PARK</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Professional meeting, conference, training and event spaces — book the room you need, when
            you need it.
          </p>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Explore</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><Link to="/rooms" className="hover:text-indigo-600">Browse Rooms</Link></li>
            <li><Link to="/amenities" className="hover:text-indigo-600">Amenities</Link></li>
            <li><Link to="/how-it-works" className="hover:text-indigo-600">How It Works</Link></li>
            <li><Link to="/faq" className="hover:text-indigo-600">FAQ</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Company</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li><Link to="/about" className="hover:text-indigo-600">About Us</Link></li>
            <li><Link to="/contact" className="hover:text-indigo-600">Contact</Link></li>
            <li><Link to="/login" className="hover:text-indigo-600">Sign In</Link></li>
            <li><Link to="/signup" className="hover:text-indigo-600">Sign Up</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Get in touch</p>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2"><Icon name="mapPin" className="h-4 w-4 text-slate-400" /> IT Park Campus, Chennai</li>
            <li className="flex items-center gap-2"><Icon name="user" className="h-4 w-4 text-slate-400" /> bookings@itpark.example</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} IT Park Room Booking. Frontend-only demo.
      </div>
    </footer>
  );
}
