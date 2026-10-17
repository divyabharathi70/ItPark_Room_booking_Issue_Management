import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getPendingBookingRoomId, clearPendingBookingRoomId, clientBookingPath } from "../utils/pendingBookingStorage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: "", email: "", phone: "", company: "", password: "", confirmPassword: "" };

/**
 * Public self-service signup (route "/signup"). Creates a regular user
 * account (see AuthContext.signup / utils/selfSignupStorage.js). The user
 * can browse and book rooms, but only becomes an approved Client - and
 * gets the Client Dashboard - once Admin accepts a booking (see
 * bookingStorage.approveBooking / utils/clientStorage.js).
 */
export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = "Full name is required.";
    if (!form.email.trim()) errors.email = "Email is required.";
    else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = "Enter a valid email address.";
    if (!form.phone.trim()) errors.phone = "Phone number is required.";
    if (!form.password) errors.password = "Password is required.";
    else if (form.password.length < 6) errors.password = "Password must be at least 6 characters.";
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!validate()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const result = signup(form);
      setIsSubmitting(false);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      // If the visitor picked a room before creating an account, send them
      // straight back to that room's booking page instead of the generic
      // dashboard — they shouldn't have to search for it again.
      const pendingRoomId = getPendingBookingRoomId();
      if (pendingRoomId) {
        clearPendingBookingRoomId();
        navigate(clientBookingPath(pendingRoomId), { replace: true });
        return;
      }

      // New users begin in the booking flow; the Client Dashboard becomes
      // available after Admin approves their booking.
      navigate("/book-room", { replace: true });
    }, 450);
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-blueprint-bg blueprint-grid-bg px-4 py-8 sm:px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-blueprint-line bg-blueprint-panel p-6 shadow-2xl shadow-black/20 sm:p-9">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-blueprint-steel2 text-blueprint-amber">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="font-display text-sm font-semibold tracking-wide text-blueprint-text">IT PARK</p>
            <p className="font-mono text-[10px] tracking-[0.2em] text-blueprint-muted">ROOM BOOKING</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-blueprint-amber">CREATE ACCOUNT</p>
          <h1 className="font-display text-2xl font-semibold text-blueprint-text sm:text-3xl">Create your account</h1>
          <p className="mt-2 text-sm text-blueprint-muted">Sign up to browse rooms and request a booking.</p>
        </div>

        <form noValidate onSubmit={handleSubmit} className="space-y-4">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="FULL NAME" value={form.name} onChange={(v) => setField("name", v)} error={fieldErrors.name} placeholder="Your full name" />
            <TextField label="EMAIL ADDRESS" type="email" value={form.email} onChange={(v) => setField("email", v)} error={fieldErrors.email} placeholder="you@company.com" autoComplete="username" />
            <TextField label="PHONE NUMBER" value={form.phone} onChange={(v) => setField("phone", v)} error={fieldErrors.phone} placeholder="9876543210" />
            <TextField label="COMPANY (OPTIONAL)" value={form.company} onChange={(v) => setField("company", v)} placeholder="Your organization" />
            <TextField label="PASSWORD" type="password" value={form.password} onChange={(v) => setField("password", v)} error={fieldErrors.password} placeholder="••••••" autoComplete="new-password" />
            <TextField label="CONFIRM PASSWORD" type="password" value={form.confirmPassword} onChange={(v) => setField("confirmPassword", v)} error={fieldErrors.confirmPassword} placeholder="••••••" autoComplete="new-password" />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blueprint-amber py-3 font-display text-sm font-semibold tracking-wide text-blueprint-bg transition hover:bg-blueprint-amberDim disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-blueprint-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-blueprint-amber hover:text-blueprint-amberDim">
            Sign in
          </Link>
        </p>

        <p className="mt-5 border-t border-blueprint-line pt-4 text-center text-xs leading-5 text-blueprint-muted2">
          Client dashboard access is available after your booking request is approved.
        </p>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, error, type = "text", placeholder, autoComplete }) {
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] tracking-wider text-blueprint-muted">{label}</label>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-blueprint-panel2 px-4 py-3 text-sm text-blueprint-text placeholder:text-blueprint-muted2 outline-none transition focus:border-blueprint-amber focus:ring-1 focus:ring-blueprint-amber ${
          error ? "border-blueprint-error" : "border-blueprint-line"
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-blueprint-error">{error}</p>}
    </div>
  );
}
