import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import Icon from "../components/icons/Icon";
import RoomCard from "../components/booking/RoomCard";
import CampusOverview from "../components/public/CampusOverview";
import heroBanner from "../assets/hero-banner.jpg";
import usePublicRooms from "../hooks/usePublicRooms";
import { AMENITIES } from "../data/mockRooms";
import { ROOM_TYPES, popularityScore } from "../utils/roomDisplay";
import { useAuth } from "../context/AuthContext";
import { setPendingBookingRoomId, clientBookingPath } from "../utils/pendingBookingStorage";

const TODAY = new Date().toISOString().slice(0, 10);

const DURATION_OPTIONS = [
  { id: "1", label: "1 Hour" },
  { id: "4", label: "4 Hours" },
  { id: "8", label: "Full Day" },
  { id: "week", label: "1 Week" },
  { id: "month", label: "1 Month" },
];

const WHY_US = [
  { icon: "shieldCheck", title: "Verified availability", description: "Every room's status is live — no double-booking a room that's under maintenance." },
  { icon: "zap", title: "Book in minutes", description: "Search, select and pay in a few quick steps, whether you sign in or book as a guest." },
  { icon: "creditCard", title: "Transparent pricing", description: "Clear hourly rates with amenity add-ons shown upfront — no hidden charges." },
  { icon: "users", title: "Spaces for every team", description: "From 3-person huddle rooms to 50-seat event halls across four floors." },
];

const FAQ_PREVIEW = [
  { q: "Do I need an account to book a room?", a: "No — you can request a booking as a guest; signing up just lets you track and manage bookings in one place." },
  { q: "Can I book for a single hour or several months?", a: "Both — choose anything from a 1-hour slot up to a multi-year lease." },
];

/**
 * Public entry point of the app (route "/"). Visitors can browse the live
 * room catalog without an account, run a quick search, and start a
 * no-login booking request (see /book/:roomId, GuestBooking.jsx) for any
 * room that's actually available. Blocked/maintenance rooms stay
 * unselectable via RoomCard's own disabled state — unchanged from before.
 */
export default function PublicBooking() {
  const navigate = useNavigate();
  const { rooms, roomState } = usePublicRooms();
  const { isAuthenticated } = useAuth();

  const [searchDate, setSearchDate] = useState(TODAY);
  const [searchTime, setSearchTime] = useState("09:00");
  const [searchDuration, setSearchDuration] = useState("1");
  const [searchType, setSearchType] = useState("");

  const popularRooms = useMemo(
    () => [...rooms].sort((a, b) => popularityScore(b) - popularityScore(a)).slice(0, 6),
    [rooms]
  );

  function handleViewDetails(roomId) {
    navigate(`/rooms/${roomId}`);
  }

  // Signed-in users go straight to the client booking wizard with this
  // room pre-selected; signed-out visitors create an account first, with
  // the room id preserved via pendingBookingRoomId (see Signup.jsx/Login.jsx).
  function handleBookNow(roomId) {
    if (isAuthenticated) {
      navigate(clientBookingPath(roomId));
      return;
    }
    setPendingBookingRoomId(roomId);
    navigate("/signup");
  }

  function handleSearch(e) {
    e.preventDefault();
    // Reuses the existing room catalog only — no separate search index.
    // Room type narrows the /rooms results; date/time/duration are carried
    // along for context but this demo's availability is status-based
    // (Available/Maintenance/Blocked) rather than calendar-based.
    navigate(searchType ? `/rooms?type=${searchType}` : "/rooms");
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <div className="relative flex min-h-[calc(100vh-4rem)] w-full flex-col justify-center overflow-hidden border-b border-slate-100 bg-white">
        <img src={heroBanner} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center" />
      <section className="relative">
        <div className="mx-auto max-w-6xl px-6 pb-8 pt-12 text-center sm:pt-20">
          <p className="mb-3 font-mono text-xs tracking-[0.25em] text-indigo-500">IT PARK · FACILITY MANAGEMENT</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Book Your Perfect Workspace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-slate-500 sm:text-base">
            Professional rooms for meetings, conferences, training, events and every other business
            activity — browse live availability across IT Park and book the space you need in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/rooms"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Icon name="door" className="h-4 w-4" />
              Browse Rooms
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Quick search */}
      <section className="relative mx-auto max-w-5xl px-6 pb-10 pt-2">
        <form
          onSubmit={handleSearch}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5 lg:grid-cols-5 lg:items-end"
        >
          <QuickField label="Date">
            <input
              type="date"
              value={searchDate}
              min={TODAY}
              onChange={(e) => setSearchDate(e.target.value)}
              className={quickInputClass}
            />
          </QuickField>
          <QuickField label="Start Time">
            <input
              type="time"
              value={searchTime}
              onChange={(e) => setSearchTime(e.target.value)}
              className={quickInputClass}
            />
          </QuickField>
          <QuickField label="Duration">
            <select value={searchDuration} onChange={(e) => setSearchDuration(e.target.value)} className={quickInputClass}>
              {DURATION_OPTIONS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </QuickField>
          <QuickField label="Room Type">
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)} className={quickInputClass}>
              <option value="">Any Type</option>
              {ROOM_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </QuickField>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="search" className="h-4 w-4" />
            Search Rooms
          </button>
        </form>
      </section>
      </div>

      {/* Popular rooms */}
      <section id="browse-rooms" className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Popular Rooms</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rooms.length} room{rooms.length === 1 ? "" : "s"} in the current catalog.
            </p>
          </div>
          <Link to="/rooms" className="hidden text-sm font-semibold text-indigo-600 hover:text-indigo-700 sm:inline-flex">
            View all rooms →
          </Link>
        </div>

        {popularRooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">
            No rooms are available right now. Please check back later.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {popularRooms.map((room) => {
              const state = roomState[room.id];
              return (
                <RoomCard
                  key={room.id}
                  room={room}
                  availabilityStatus={state?.availability.status}
                  issueWarning={state?.worstIssue}
                  onViewDetails={handleViewDetails}
                  onBookNow={handleBookNow}
                />
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center sm:hidden">
          <Link to="/rooms" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            View all rooms →
          </Link>
        </div>
      </section>

      {/* Explore the IT Park Campus */}
      <CampusOverview />

      {/* Room categories */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Room Categories</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ROOM_TYPES.map((t) => (
              <Link
                key={t.id}
                to={`/rooms?type=${t.id}`}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-center transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon name="door" className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold text-slate-800">{t.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Amenities preview */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Amenities</h2>
          <Link to="/amenities" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {AMENITIES.slice(0, 6).map((a) => (
            <div key={a.id} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon name={a.icon} className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-medium text-slate-700">{a.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">How It Works</h2>
            <Link to="/how-it-works" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Learn more →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StepPreview n={1} title="Find a room" description="Browse or search the live catalog." />
            <StepPreview n={2} title="Pick a time" description="Choose your start time and duration." />
            <StepPreview n={3} title="Book & pay" description="Confirm amenities and complete payment." />
          </div>
        </div>
      </section>

      {/* Why choose IT Park */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="mb-6 text-lg font-semibold text-slate-900">Why Choose IT Park</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY_US.map((w) => (
            <div key={w.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon name={w.icon} className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-900">{w.title}</p>
              <p className="mt-1 text-xs text-slate-500">{w.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ preview */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Frequently Asked Questions</h2>
            <Link to="/faq" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {FAQ_PREVIEW.map((f) => (
              <div key={f.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-slate-900">{f.q}</p>
                <p className="mt-1 text-sm text-slate-500">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-8 text-center">
          <p className="text-base font-semibold text-slate-800">Ready to book a room?</p>
          <p className="mt-1 text-sm text-slate-500">Sign up for an account, or continue as a guest to request a booking.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Sign Up
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
            <Link
              to="/rooms"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              Browse Rooms
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

const quickInputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50";

function QuickField({ label, children }) {
  return (
    <label className="block text-left">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function StepPreview({ n, title, description }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
        {n}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
