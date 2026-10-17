import { Link } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";

const STEPS = [
  {
    icon: "search",
    title: "Find a room",
    description: "Browse the catalog or use the quick search to filter by date, capacity and room type.",
  },
  {
    icon: "door",
    title: "Check details",
    description: "View capacity, amenities, floor and pricing for any room before you commit.",
  },
  {
    icon: "calendar",
    title: "Choose your time",
    description: "Pick a start time and how long you need the space — from an hour to several months.",
  },
  {
    icon: "creditCard",
    title: "Pay securely",
    description: "Confirm amenities and complete a simulated payment for your requested slot.",
  },
  {
    icon: "checkCircle",
    title: "Get confirmed",
    description:
      "Signed-in clients get an instant confirmed booking. Guest requests are reviewed and approved by an administrator.",
  },
];

export default function HowItWorks() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">GETTING STARTED</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How It Works</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Booking a room at IT Park takes just a few minutes — no lengthy paperwork, no phone calls.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-12">
        <ol className="space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
                {i + 1}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <Icon name={step.icon} className="h-4 w-4 text-indigo-500" />
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                </div>
                <p className="text-sm text-slate-500">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Browse Rooms
          </Link>
          <Link
            to="/faq"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Read the FAQ
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
