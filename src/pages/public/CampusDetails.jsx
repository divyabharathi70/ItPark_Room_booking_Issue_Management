import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";
import FacilityIcon from "../../components/public/FacilityIcon";
import { CAMPUS_FACILITIES, getCampusFacility } from "../../data/campusFacilities";

/**
 * Detail page for one "Explore the IT Park Campus" card (route
 * /campus/:facilityId). Purely informational — facilities are not bookable
 * and no live availability is shown; the only booking path is /rooms.
 */
export default function CampusDetails() {
  const { facilityId } = useParams();
  const facility = getCampusFacility(facilityId);
  const [failedId, setFailedId] = useState(null);

  // Always open a facility at the top of the page, not wherever the previous
  // page (e.g. the bottom of Home) was scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [facilityId]);

  if (!facility) {
    return (
      <PublicLayout>
        <section className="mx-auto max-w-xl px-6 py-24 text-center">
          <p className="font-mono text-xs tracking-[0.25em] text-indigo-500">NOT FOUND</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">We couldn't find that facility</h1>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Back to Home
          </Link>
        </section>
      </PublicLayout>
    );
  }

  const imageFailed = failedId === facility.id;
  const others = CAMPUS_FACILITIES.filter((f) => f.id !== facility.id);

  return (
    <PublicLayout>
      <section className="mx-auto max-w-5xl px-6 pb-4 pt-8">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
          Back to campus
        </Link>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {/* Photo card — sized to the source image so it stays sharp */}
            <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 via-slate-100 to-sky-100 sm:h-64 lg:h-72">
              {imageFailed ? (
                <div role="img" aria-label={facility.alt} className="flex h-full w-full items-center justify-center text-indigo-300">
                  <FacilityIcon name={facility.icon} className="h-20 w-20" />
                </div>
              ) : (
                <img
                  src={facility.image}
                  alt={facility.alt}
                  onError={() => setFailedId(facility.id)}
                  className="h-full w-full object-cover"
                />
              )}
              <span className="absolute bottom-4 left-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm">
                <FacilityIcon name={facility.icon} className="h-3.5 w-3.5" />
                {facility.detail}
              </span>
            </div>

            <div className="mt-6">
              <p className="font-mono text-xs tracking-[0.2em] text-indigo-500">ABOUT THIS SPACE</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{facility.title}</h1>
              <p className="mt-1 text-sm text-slate-500">{facility.tagline}</p>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
                {facility.about.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-mono text-xs tracking-[0.2em] text-slate-400">GOOD TO KNOW</p>
            <ul className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
              {facility.goodToKnow.map((g) => (
                <li key={g} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Icon name="check" className="h-3 w-3" strokeWidth={2.6} />
                  </span>
                  {g}
                </li>
              ))}
            </ul>
            <Link
              to="/rooms"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Icon name="door" className="h-4 w-4" />
              Explore Available Rooms
            </Link>
            <Link
              to="/"
              className="mt-3 flex w-full items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Back to campus
            </Link>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12 pt-4">

        {/* Highlights */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-slate-900">Highlights</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {facility.highlights.map((h) => (
              <div
                key={h.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FacilityIcon name={h.icon} className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">{h.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{h.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* More facilities */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h3 className="text-lg font-semibold text-slate-900">Explore more of the campus</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {others.map((o) => (
              <Link
                key={o.id}
                to={`/campus/${o.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FacilityIcon name={o.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                  <span className="block truncate text-xs text-slate-500">{o.detail}</span>
                </span>
                <Icon name="chevronRight" className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
              </Link>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-indigo-100 bg-white p-8 text-center shadow-sm">
            <p className="text-base font-semibold text-slate-800">Ready to find your space?</p>
            <p className="mt-1 text-sm text-slate-500">See every room, its amenities and its current status.</p>
            <Link
              to="/rooms"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Icon name="door" className="h-4 w-4" />
              Explore Available Rooms
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
