import Icon from "../icons/Icon";
import { AMENITIES, AMENITY_MAP } from "../../data/mockRooms";
import { ROOM_AVAILABILITY } from "../../utils/roomStatusStorage";

// Presentation-only mapping from the room's live availability status (as
// computed by roomStatusStorage.getRoomAvailability + room.isActive) to a
// label/color for this modal. No availability logic lives here — this only
// decides how to *display* a status that was already decided elsewhere.
function availabilityMeta(status) {
  switch (status) {
    case ROOM_AVAILABILITY.MAINTENANCE:
      return { label: "Maintenance", classes: "bg-orange-50 text-orange-600 border-orange-200", icon: "tool" };
    case ROOM_AVAILABILITY.BLOCKED:
      return { label: "Blocked", classes: "bg-rose-50 text-rose-600 border-rose-200", icon: "ban" };
    case ROOM_AVAILABILITY.AVAILABLE:
      return { label: "Available", classes: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: "checkCircle" };
    default:
      return { label: "Unavailable", classes: "bg-rose-50 text-rose-600 border-rose-200", icon: "ban" };
  }
}

/**
 * Public room-details view (route "/"). Purely presentational: every field
 * comes from the room object already loaded via roomStorage.getAllRooms()
 * and the availability already computed via roomStatusStorage — this
 * component does not read localStorage or re-derive availability itself,
 * so it can never drift from the live catalog / status Admin manages.
 */
export default function RoomDetailsModal({ room, availabilityStatus, onClose, onBook }) {
  if (!room) return null;

  const included = room.includedAmenities || [];
  const additional = AMENITIES.filter((a) => !included.includes(a.id));
  const isBookable = room.isActive && availabilityStatus === ROOM_AVAILABILITY.AVAILABLE;
  const meta = availabilityMeta(isBookable ? ROOM_AVAILABILITY.AVAILABLE : availabilityStatus);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
      />

      <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Visual header — no room photo assets exist in this project, so a
            branded icon banner stands in for one. */}
        <div className="relative flex h-28 shrink-0 items-center justify-center bg-gradient-to-br from-indigo-600 to-indigo-800">
          <Icon name="door" className="h-10 w-10 text-white/80" strokeWidth={1.4} />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
          <span
            className={`absolute left-4 bottom-3 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.classes} bg-white`}
          >
            <Icon name={meta.icon} className="h-3 w-3" />
            {meta.label}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <h3 className="text-lg font-bold text-slate-900">{room.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {room.roomNumber} &middot; Floor {room.floor}
          </p>

          <p className="mt-3 text-sm leading-relaxed text-slate-600">{room.description}</p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatBox icon="usersSmall" label="Capacity" value={`${room.capacity} people`} />
            <StatBox icon="mapPin" label="Floor" value={room.floor} />
            <StatBox icon="tag" label="Room No." value={room.roomNumber} />
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Included Amenities
            </p>
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
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Additional Amenities
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

          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Room Price</span>
            <span className="text-xl font-bold text-slate-900">
              ₹{room.pricePerHour.toLocaleString("en-IN")}
              <span className="text-xs font-normal text-slate-400">/hour</span>
            </span>
          </div>

          {!isBookable && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This room can't be booked right now — it is currently {meta.label.toLowerCase()}.</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onBook}
            disabled={!isBookable}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isBookable ? "Request to Book" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
      <Icon name={icon} className="mx-auto h-4 w-4 text-slate-400" />
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
