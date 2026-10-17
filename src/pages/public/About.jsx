import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";

const VALUES = [
  { icon: "shieldCheck", title: "Reliable spaces", description: "Every room is actively maintained and monitored, with issues tracked and resolved quickly." },
  { icon: "zap", title: "Fast booking", description: "Search, compare and book a room in minutes — for a single meeting or a multi-month lease." },
  { icon: "users", title: "Built for teams", description: "From two-person huddle rooms to fifty-seat event halls, there's a space for every group size." },
];

export default function About() {
  return (
    <PublicLayout>
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.25em] text-indigo-500">ABOUT US</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">About IT Park</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
            IT Park is a multi-floor facility offering meeting rooms, conference halls, training rooms and
            event spaces for businesses that need professional space without the overhead of a permanent
            office. Our room booking platform lets clients search, reserve and manage bookings online, while
            our facility team keeps every space maintained and ready to use.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon name={v.icon} className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-900">{v.title}</p>
              <p className="mt-1 text-xs text-slate-500">{v.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p>
            Behind the scenes, an admin team manages the room catalog, reviews booking requests, and
            coordinates facility workers who resolve maintenance issues — so the spaces you book are always
            ready when you arrive.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
