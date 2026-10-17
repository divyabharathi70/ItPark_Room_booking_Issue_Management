import { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";

const FAQS = [
  {
    q: "Do I need an account to book a room?",
    a: "No — you can submit a booking request as a guest from any room's page. Guest requests are reviewed and approved by an administrator before they're confirmed. Signing up gives you an account to track and manage all your bookings in one place.",
  },
  {
    q: "How is pricing calculated?",
    a: "Every room has an hourly rate. Your total is the room rate multiplied by your booked duration, plus any optional amenities you add, each billed per hour.",
  },
  {
    q: "Can I book a room for multiple days, weeks or months?",
    a: "Yes — when booking you can choose a duration from a single hour up to several years, using either quick presets or a custom duration.",
  },
  {
    q: "What happens if a room is under maintenance?",
    a: "Rooms flagged for maintenance or blocked by facility management show as unavailable and can't be booked until the issue is resolved and the room is reopened.",
  },
  {
    q: "Is payment real?",
    a: "This is a frontend-only demo — payment is simulated and no real card is charged.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">SUPPORT</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Frequently Asked Questions</h1>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="space-y-3">
          {FAQS.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                  <Icon
                    name="chevronDown"
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </button>
                {open && <p className="px-5 pb-4 text-sm text-slate-500">{item.a}</p>}
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">Still have questions?</p>
          <Link to="/contact" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600">
            Contact us
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
