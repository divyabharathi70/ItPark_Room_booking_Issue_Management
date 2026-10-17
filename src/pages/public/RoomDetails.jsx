import { useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PublicLayout from "../../components/layout/PublicLayout";
import Icon from "../../components/icons/Icon";
import { AMENITIES, AMENITY_MAP } from "../../data/mockRooms";
import { ROOM_AVAILABILITY } from "../../utils/roomStatusStorage";
import { PRIORITY } from "../../utils/issueStorage";
import { getRoomTypeLabel } from "../../utils/roomDisplay";
import { getRoomImage } from "../../data/roomImages";
import usePublicRooms from "../../hooks/usePublicRooms";
import { useAuth } from "../../context/AuthContext";
import { setPendingBookingRoomId, clientBookingPath } from "../../utils/pendingBookingStorage";

function availabilityMeta(status) {
  switch (status) {
    case ROOM_AVAILABILITY.MAINTENANCE:
      return { label: "Under Maintenance", classes: "bg-orange-50 text-orange-600 border-orange-200", icon: "tool" };
    case ROOM_AVAILABILITY.BLOCKED:
      return { label: "Blocked", classes: "bg-rose-50 text-rose-600 border-rose-200", icon: "ban" };
    case ROOM_AVAILABILITY.AVAILABLE:
      return { label: "Available", classes: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: "checkCircle" };
    default:
      return { label: "Currently Unavailable", classes: "bg-rose-50 text-rose-600 border-rose-200", icon: "ban" };
  }
}

/**
 * Public room-details page (route "/rooms/:roomId"). Purely presentational
 * — every field comes from the same live sources as the rest of the app
 * (roomStorage / roomStatusStorage / issueStorage via usePublicRooms), so
 * it can never drift from what Admin manages. This supersedes the old
 * details *modal* on the homepage with a real, linkable, shareable page,
 * while GuestBooking.jsx (/book/:roomId) still owns the actual booking
 * request flow untouched.
 */
export default function RoomDetails() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { rooms, roomState } = usePublicRooms();
  const { isAuthenticated } = useAuth();

  // Open every room at the top of the page, not where the previous page was scrolled.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [roomId]);

  const room = useMemo(() => rooms.find((r) => r.id === roomId) || null, [rooms, roomId]);
  const state = room ? roomState[room.id] : null;

  if (!room) {
    return (
      <PublicLayout>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <p className="font-mono text-xs tracking-[0.25em] text-indigo-500">ROOM NOT FOUND</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">We couldn't find that room</h1>
          <p className="mt-2 text-sm text-slate-500">It may have been removed from the catalog.</p>
          <Link
            to="/rooms"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Back to Rooms
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const availabilityStatus = state?.availability.status || ROOM_AVAILABILITY.AVAILABLE;
  const worstIssue = state?.worstIssue;
  const isBookable =
    room.isActive && availabilityStatus === ROOM_AVAILABILITY.AVAILABLE && worstIssue?.priority !== PRIORITY.CRITICAL;
  const meta = availabilityMeta(isBookable ? ROOM_AVAILABILITY.AVAILABLE : availabilityStatus);

  const included = room.includedAmenities || [];
  const additional = AMENITIES.filter((a) => !included.includes(a.id));

  // Signed-in users go straight to the client booking wizard with this
  // room pre-selected. Signed-out visitors are sent to create an account
  // first — the room id is stashed in localStorage (pendingBookingRoomId)
  // so Signup/Login can send them straight back to it afterwards without
  // having to search for the room again.
  function handleBookNow() {
    if (isAuthenticated) {
      navigate(clientBookingPath(room.id));
      return;
    }
    setPendingBookingRoomId(room.id);
    navigate("/signup");
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate("/rooms")}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-indigo-600"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
          Back to Rooms
        </button>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {/* Room photo (falls back to a branded banner if a room has none) */}
            <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 sm:h-80 lg:h-96">
              {getRoomImage(room) ? (
                <img
                  src={getRoomImage(room)}
                  alt={room.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Icon name="door" className="h-16 w-16 text-white/80" strokeWidth={1.2} />
                </div>
              )}
              <span
                className={`absolute left-5 bottom-4 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-xs font-semibold ${meta.classes}`}
              >
                <Icon name={meta.icon} className="h-3.5 w-3.5" />
                {meta.label}
              </span>
            </div>

            <div className="mt-6">
              <p className="font-mono text-xs tracking-[0.2em] text-indigo-500">{getRoomTypeLabel(room).toUpperCase()}</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{room.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {room.roomNumber} &middot; Floor {room.floor}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{room.description}</p>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <StatBox icon="usersSmall" label="Capacity" value={`${room.capacity} people`} />
              <StatBox icon="mapPin" label="Floor" value={room.floor} />
              <StatBox icon="tag" label="Room No." value={room.roomNumber} />
            </div>

            <div className="mt-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Included Amenities</p>
              {included.length === 0 ? (
                <p className="text-xs text-slate-400">No amenities included by default.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {included.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700"
                    >
                      <Icon name={AMENITY_MAP[id]?.icon} className="h-3.5 w-3.5" />
                      {AMENITY_MAP[id]?.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {additional.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Additional Amenities (add-on)
                </p>
                <div className="space-y-1.5">
                  {additional.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-600">
                        <Icon name={a.icon} className="h-3.5 w-3.5 text-slate-400" />
                        {a.label}
                      </span>
                      <span className="font-semibold text-slate-500">
                        {a.pricePerHour === 0 ? "Free" : `+₹${a.pricePerHour}/hr`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Booking info sidebar */}
          <div className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Price</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                ₹{room.pricePerHour.toLocaleString("en-IN")}
                <span className="text-sm font-normal text-slate-400"> /hour</span>
              </p>

              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                <p>
                  <Icon name="clock" className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                  Billed hourly; pick your own start time and duration in the next step.
                </p>
                <p>
                  <Icon name="creditCard" className="mr-1.5 inline h-3.5 w-3.5 text-slate-400" />
                  Payment is simulated — no real card is charged in this demo.
                </p>
              </div>

              {!isBookable && (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {availabilityStatus === ROOM_AVAILABILITY.BLOCKED
                      ? "This room is currently blocked by facility management and can't be booked right now."
                      : availabilityStatus === ROOM_AVAILABILITY.MAINTENANCE || worstIssue?.priority === PRIORITY.CRITICAL
                      ? "This room can't be booked right now due to a critical maintenance issue."
                      : "This room can't be booked right now."}
                  </span>
                </div>
              )}

              {isBookable && worstIssue && (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Unresolved issue reported: {worstIssue.category}. The room is still bookable, but this
                    may be resolved by the time of your visit.
                  </span>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={!isBookable}
                  onClick={handleBookNow}
                  className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isBookable ? "Book This Room" : "Currently Unavailable"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/rooms")}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Back to Rooms
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
      <Icon name={icon} className="mx-auto h-4 w-4 text-slate-400" />
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
