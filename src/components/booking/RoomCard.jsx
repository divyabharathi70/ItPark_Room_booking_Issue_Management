import Icon from "../icons/Icon";
import { AMENITY_MAP } from "../../data/mockRooms";
import { PRIORITY } from "../../utils/issueStorage";
import { getRoomImage } from "../../data/roomImages";

// Small badge shown on the card when the room isn't fully available.
// `availabilityStatus` (AVAILABLE/MAINTENANCE/BLOCKED) always wins over a
// mere issue warning, since it means the room can't be booked at all.
function UnavailableReason({ availabilityStatus }) {
  if (availabilityStatus === "MAINTENANCE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600">
        <Icon name="tool" className="h-3 w-3" />
        Maintenance
      </span>
    );
  }
  if (availabilityStatus === "BLOCKED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
        <Icon name="ban" className="h-3 w-3" />
        Blocked
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
      Currently Unavailable
    </span>
  );
}

export default function RoomCard({
  room,
  selected,
  onSelect,
  availabilityStatus = "AVAILABLE",
  issueWarning,
  // Optional "browse" mode for the public marketing site (Home / Rooms):
  // when either callback is supplied, the card renders separate
  // "View Details" / "Book Now" actions instead of being a single
  // whole-card select button. Existing callers (BookingNew's wizard,
  // the homepage's legacy modal flow) that only pass onSelect are
  // completely unaffected — this is additive.
  onViewDetails,
  onBookNow,
}) {
  const unavailable = !room.isActive || availabilityStatus !== "AVAILABLE";
  const disabled = unavailable;
  const linkMode = !!(onViewDetails || onBookNow);

  const warningStyle =
    issueWarning?.priority === PRIORITY.HIGH
      ? "border-orange-200 bg-orange-50 text-orange-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  const Wrapper = linkMode ? "div" : "button";
  const wrapperProps = linkMode
    ? {}
    : { type: "button", disabled, onClick: () => onSelect(room.id) };

  return (
    <Wrapper
      {...wrapperProps}
      className={`group relative flex flex-col rounded-2xl border p-5 text-left transition ${
        disabled
          ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
          : selected
          ? "border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
      }`}
    >
      {selected && !disabled && (
        <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white">
          <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>
      )}

      {linkMode && getRoomImage(room) && (
        <img
          src={getRoomImage(room)}
          alt={room.name}
          loading="lazy"
          className="-mx-5 -mt-5 mb-4 h-44 w-[calc(100%+2.5rem)] max-w-none rounded-t-2xl object-cover"
        />
      )}

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{room.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {room.roomNumber} &middot; Floor {room.floor}
          </p>
        </div>
        {unavailable && <UnavailableReason availabilityStatus={availabilityStatus} />}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-slate-500">{room.description}</p>

      <div className="mb-4 flex items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="usersSmall" className="h-4 w-4 text-slate-400" />
          {room.capacity} people
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="mapPin" className="h-4 w-4 text-slate-400" />
          Floor {room.floor}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {room.includedAmenities.slice(0, 5).map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600"
          >
            <Icon name={AMENITY_MAP[id].icon} className="h-3 w-3" />
            {AMENITY_MAP[id].label}
          </span>
        ))}
      </div>

      {!unavailable && issueWarning && (
        <div
          className={`mb-4 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-medium ${warningStyle}`}
        >
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {issueWarning.priority === PRIORITY.HIGH ? "High-priority issue: " : "Unresolved issue: "}
            {issueWarning.category}
          </span>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
        <div>
          <p className="text-lg font-bold text-slate-900">
            ₹{room.pricePerHour.toLocaleString("en-IN")}
            <span className="text-xs font-normal text-slate-400">/hr</span>
          </p>
        </div>
        {!linkMode && (
          <span
            className={`text-xs font-semibold ${
              selected && !disabled ? "text-indigo-600" : "text-slate-300 group-hover:text-indigo-500"
            }`}
          >
            {disabled
              ? availabilityStatus === "BLOCKED"
                ? "Blocked"
                : "Under maintenance"
              : selected
              ? "Selected"
              : "Select room"}
          </span>
        )}
      </div>

      {linkMode && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => onViewDetails?.(room.id)}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
          >
            View Details
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onBookNow?.(room.id)}
            className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {disabled ? "Unavailable" : "Book Now"}
          </button>
        </div>
      )}
    </Wrapper>
  );
}
