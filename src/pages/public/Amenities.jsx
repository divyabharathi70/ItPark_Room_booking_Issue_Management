import { Link } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";
import { AMENITIES } from "../../data/mockRooms";

export default function Amenities() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">FACILITIES</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Amenities</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Every room comes with a base set of amenities, and most spaces let you add extras like a
            projector or video conferencing for an hourly rate.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AMENITIES.map((a) => (
            <div key={a.id} className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon name={a.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{a.label}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {a.pricePerHour === 0
                    ? "Included free with eligible rooms."
                    : `Available as an add-on for ₹${a.pricePerHour}/hour.`}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 text-center">
          <p className="text-sm font-semibold text-slate-800">Looking for a specific setup?</p>
          <p className="mt-1 text-sm text-slate-500">Browse rooms and filter by the amenities you need.</p>
          <Link
            to="/rooms"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Browse Rooms
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
