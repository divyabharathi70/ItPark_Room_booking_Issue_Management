import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MOCK_USERS, ROLE_HOME, ROLE_LABELS, ROLES, PENDING_USER_ROLE } from "../data/mockUsers";
import { getPendingBookingRoomId, clearPendingBookingRoomId, clientBookingPath } from "../utils/pendingBookingStorage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  const redirectTo = location.state?.from?.pathname || null;

  function validate() {
    const errors = {};
    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setIsSubmitting(true);
    // Small artificial delay so the "AUTHENTICATING" state is visible —
    // there is no real network request since this is a mock login.
    setTimeout(() => {
      const result = login({ email, password });
      setIsSubmitting(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      // If a room was selected before signing in, resume that booking
      // instead of sending the (client) user to their dashboard or wherever
      // they were headed. Never applies to non-Client roles — Admin/Worker/
      // Employee logins always follow the normal role-based navigation.
      const pendingRoomId = getPendingBookingRoomId();
      const canBook = result.user.role === ROLES.CLIENT || result.user.role === PENDING_USER_ROLE;
      if (pendingRoomId && canBook) {
        clearPendingBookingRoomId();
        navigate(clientBookingPath(pendingRoomId), { replace: true });
        return;
      }

      // A registered user whose booking hasn't been approved has no
      // dashboard, so send them to the public home page instead of a
      // protected page they'd only be bounced away from.
      if (result.user.role === PENDING_USER_ROLE) {
        navigate("/book-room", { replace: true });
        return;
      }

      const destination = redirectTo || ROLE_HOME[result.user.role] || "/";
      navigate(destination, { replace: true });
    }, 450);
  }

  function fillDemo(user) {
    setEmail(user.email);
    setPassword(user.password);
    setFieldErrors({});
    setFormError("");
  }

  return (
    <div
      className="relative min-h-screen w-full bg-blueprint-bg bg-cover bg-center lg:grid lg:grid-cols-2"
      style={{ backgroundImage: "url(/itpark-banner.svg)" }}
    >
      {/* Banner overlay keeps the text readable over the image */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/45 to-white/10" />

      {/* Left: brand + banner message — hidden on small screens, shown as the hero on large ones */}
      <div className="relative hidden flex-col justify-between px-12 py-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/30">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-white">IT PARK</p>
            <p className="text-[11px] tracking-wide text-white/70">Facility Management System</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight text-white">
            Book rooms and run your facility from one place.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/80">
            Sign in with your role credential to enter your dashboard. Room booking, facility
            requests and maintenance queues are routed by access level.
          </p>
        </div>

        <span />
      </div>

      {/* Right: login card */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-slate-900/5 sm:p-10">
          {/* Mobile-only compact header (site plan is desktop-only) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-blueprint-steel2 text-blueprint-amber">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-display text-sm font-semibold tracking-wide text-blueprint-text">IT PARK</p>
              <p className="font-mono text-[10px] tracking-[0.2em] text-blueprint-muted">FACILITY MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-2 font-mono text-xs tracking-[0.25em] text-blueprint-amber">SITE ACCESS TERMINAL</p>
            <h1 className="font-display text-3xl font-semibold text-blueprint-text">Sign in to continue</h1>
            <p className="mt-2 text-sm text-blueprint-muted">
              Enter your credentials to reach your zone dashboard — Admin, Client, Employee or Worker.
            </p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="space-y-5">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-blueprint-error/40 bg-blueprint-error/10 px-4 py-3 text-sm text-blueprint-error"
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block font-mono text-[11px] tracking-wider text-blueprint-muted">
                EMAIL ADDRESS
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`w-full rounded-md border bg-blueprint-panel2 px-4 py-3 text-sm text-blueprint-text placeholder:text-blueprint-muted2 outline-none transition focus:border-blueprint-amber focus:ring-1 focus:ring-blueprint-amber ${
                  fieldErrors.email ? "border-blueprint-error" : "border-blueprint-line"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-blueprint-error">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block font-mono text-[11px] tracking-wider text-blueprint-muted">
                  PASSWORD
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  className={`w-full rounded-md border bg-blueprint-panel2 px-4 py-3 pr-11 text-sm text-blueprint-text placeholder:text-blueprint-muted2 outline-none transition focus:border-blueprint-amber focus:ring-1 focus:ring-blueprint-amber ${
                    fieldErrors.password ? "border-blueprint-error" : "border-blueprint-line"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-blueprint-muted transition hover:text-blueprint-amber"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.4 5.5A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a13.7 13.7 0 0 1-3.2 4M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 3.4-.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs text-blueprint-error">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blueprint-amber py-3 font-display text-sm font-semibold tracking-wide text-blueprint-bg transition hover:bg-blueprint-amberDim disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
                  </svg>
                  AUTHENTICATING…
                </>
              ) : (
                "AUTHENTICATE"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-blueprint-muted">
            New User?{" "}
            <Link to="/signup" className="font-semibold text-blueprint-amber transition hover:text-blueprint-amberDim hover:underline">
              Register
            </Link>
          </p>

          <div className="mt-6 rounded-md border border-blueprint-line bg-blueprint-panel">
            <button
              type="button"
              onClick={() => setShowDemoPanel((s) => !s)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-mono text-[11px] tracking-wider text-blueprint-steel">
                DEMO CREDENTIALS
              </span>
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 text-blueprint-muted transition-transform ${showDemoPanel ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showDemoPanel && (
              <div className="grid grid-cols-1 gap-2 border-t border-blueprint-line p-3 sm:grid-cols-2">
                {MOCK_USERS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => fillDemo(u)}
                    className="rounded-md border border-blueprint-line bg-blueprint-panel2 px-3 py-2.5 text-left transition hover:border-blueprint-amber/60 hover:bg-blueprint-amber/5"
                  >
                    <p className="font-mono text-[10px] tracking-wider text-blueprint-amber">
                      {ROLE_LABELS[u.role].toUpperCase()}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-blueprint-text">{u.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
