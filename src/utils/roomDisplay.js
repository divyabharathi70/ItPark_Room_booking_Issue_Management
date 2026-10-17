// Display-only helpers for the public marketing site (Home / Rooms /
// Room Details). These derive presentation values (a room "type" label,
// popularity, etc.) from the existing room catalog (data/mockRooms.js via
// utils/roomStorage.js) WITHOUT adding any new field to the stored room
// object and WITHOUT changing anything Admin/Client/Employee/Worker rely
// on. Nothing here writes to localStorage.

// Public-facing room "type" categories used for the /rooms filter UI.
// The underlying catalog doesn't store an explicit type, so it's inferred
// from the room's name/capacity below — purely a presentation concern.
export const ROOM_TYPES = [
  { id: "meeting", label: "Meeting Room" },
  { id: "conference", label: "Conference Room" },
  { id: "training", label: "Training Room" },
  { id: "office", label: "Private Office" },
  { id: "event", label: "Event Hall" },
];

const ROOM_TYPE_MAP = Object.fromEntries(ROOM_TYPES.map((t) => [t.id, t]));

/**
 * Infers a room "type" id (see ROOM_TYPES) from its name and capacity.
 * This is a best-effort presentation label only — it never affects
 * booking, pricing, or availability logic.
 */
export function getRoomTypeId(room) {
  const name = (room?.name || "").toLowerCase();
  if (name.includes("event") || name.includes("hall")) return "event";
  if (name.includes("training")) return "training";
  if (name.includes("conference")) return "conference";
  if (name.includes("interview") || name.includes("huddle") || name.includes("office")) return "office";
  if (name.includes("boardroom") || name.includes("meeting")) return "meeting";
  // Fall back to capacity so every room still gets a sensible bucket.
  if (room?.capacity >= 40) return "event";
  if (room?.capacity >= 16) return "training";
  if (room?.capacity >= 8) return "conference";
  return "meeting";
}

export function getRoomTypeLabel(room) {
  return ROOM_TYPE_MAP[getRoomTypeId(room)]?.label || "Meeting Room";
}

// Capacity range buckets for the /rooms filter UI (distinct from
// data/mockRooms.js's CAPACITY_BUCKETS, which drives Admin categories).
export const CAPACITY_RANGES = [
  { id: "1-10", label: "1 – 10", test: (c) => c >= 1 && c <= 10 },
  { id: "11-25", label: "11 – 25", test: (c) => c >= 11 && c <= 25 },
  { id: "26-50", label: "26 – 50", test: (c) => c >= 26 && c <= 50 },
  { id: "50+", label: "50+", test: (c) => c > 50 },
];

// A handful of "featured" amenity filters surfaced on the public site,
// mapped onto the ids already defined in data/mockRooms.js's AMENITIES.
export const FEATURED_AMENITY_IDS = ["wifi", "ac", "projector", "whiteboard", "videoconf", "parking"];

/** Simple, deterministic "popularity" score so a Sort:Popular option has
 * something stable to sort by (higher capacity + more amenities = more
 * broadly bookable, used purely as a tie-breaking heuristic). */
export function popularityScore(room) {
  return (room.capacity || 0) + (room.includedAmenities?.length || 0) * 3;
}
