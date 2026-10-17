import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../icons/Icon";
import FacilityIcon from "./FacilityIcon";
import { CAMPUS_FACILITIES } from "../../data/campusFacilities";

// Local photos live in public/images/campus/. If a file is missing or fails
// to load, the card falls back to a soft gradient with the facility icon.
function FacilityCard({ facility }) {
  const [failed, setFailed] = useState(false);

  return (
    <Link
      to={`/campus/${facility.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
    >
      <div className="relative h-48 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-50">
        {failed ? (
          <div role="img" aria-label={facility.alt} className="flex h-full w-full items-center justify-center text-indigo-300">
            <FacilityIcon name={facility.icon} className="h-14 w-14" />
          </div>
        ) : (
          <img
            src={facility.image}
            alt={facility.alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-indigo-600 shadow-sm backdrop-blur">
          <FacilityIcon name={facility.icon} className="h-4.5 w-4.5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-slate-900">{facility.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{facility.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="inline-flex w-fit items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {facility.detail}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition group-hover:text-indigo-600">
            Learn more
            <Icon name="chevronRight" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CampusOverview() {
  return (
    <section className="border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-indigo-500">EXPLORE OUR CAMPUS</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">More Than Just a Workspace</h2>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            Discover a thoughtfully designed IT Park with modern workspaces, convenient amenities, and everything you
            need for a productive day.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CAMPUS_FACILITIES.map((f) => (
            <FacilityCard key={f.id} facility={f} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="door" className="h-4 w-4" />
            Explore Available Rooms
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
