import { useState } from "react";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";

const EMPTY = { name: "", email: "", message: "" };

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required.";
    if (!form.email.trim()) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email.";
    if (!form.message.trim()) next.message = "Please add a short message.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    // Frontend-only demo — no backend/API to send this to, so we just
    // confirm receipt in the UI.
    setSubmitted(true);
    setForm(EMPTY);
  }

  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">GET IN TOUCH</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Contact Us</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Questions about a booking, a room, or your account? Send us a message.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <ContactRow icon="mapPin" label="Location" value="IT Park Campus, Chennai, Tamil Nadu" />
          <ContactRow icon="user" label="Email" value="bookings@itpark.example" />
          <ContactRow icon="clock" label="Hours" value="Mon – Sat, 9:00 AM – 7:00 PM" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon name="checkCircle" className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-slate-900">Message sent</p>
              <p className="text-xs text-slate-500">Thanks for reaching out — we'll get back to you soon.</p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form noValidate onSubmit={handleSubmit} className="space-y-4">
              <Field label="Full Name" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={inputClass(errors.name)}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={inputClass(errors.email)}
                  placeholder="you@company.com"
                />
              </Field>
              <Field label="Message" error={errors.message}>
                <textarea
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  rows={4}
                  className={inputClass(errors.message)}
                  placeholder="How can we help?"
                />
              </Field>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

function ContactRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon name={icon} className="h-4.5 w-4.5" />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function inputClass(error) {
  return `w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-4 ${
    error
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
      : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-50"
  }`;
}
