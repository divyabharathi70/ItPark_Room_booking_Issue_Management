// Mock room + amenity catalog for the Client Room Booking flow.
// Frontend-only demo data — nothing here talks to a real backend.

export const AMENITIES = [
  { id: "wifi", label: "WiFi", icon: "wifi", pricePerHour: 0 },
  { id: "projector", label: "Projector", icon: "projector", pricePerHour: 150 },
  { id: "smarttv", label: "Smart TV", icon: "tv", pricePerHour: 200 },
  { id: "whiteboard", label: "Whiteboard", icon: "whiteboard", pricePerHour: 0 },
  { id: "ac", label: "AC", icon: "snow", pricePerHour: 0 },
  { id: "mic", label: "Microphone", icon: "mic", pricePerHour: 100 },
  { id: "speakers", label: "Speakers", icon: "speaker", pricePerHour: 100 },
  { id: "videoconf", label: "Video Conference", icon: "video", pricePerHour: 300 },
  { id: "parking", label: "Parking", icon: "parking", pricePerHour: 50 },
];

export const AMENITY_MAP = Object.fromEntries(AMENITIES.map((a) => [a.id, a]));

export const MOCK_ROOMS = [
  {
    id: "r-101",
    name: "Orion Boardroom",
    roomNumber: "R-101",
    floor: 1,
    capacity: 12,
    pricePerHour: 1200,
    includedAmenities: ["wifi", "ac", "projector", "whiteboard"],
    isActive: true,
    description: "A polished executive boardroom, well suited to client-facing meetings.",
  },
  {
    id: "r-102",
    name: "Nebula Meeting Room",
    roomNumber: "R-102",
    floor: 1,
    capacity: 6,
    pricePerHour: 700,
    includedAmenities: ["wifi", "ac", "whiteboard"],
    isActive: true,
    description: "A bright, compact room for focused team check-ins.",
  },
  {
    id: "r-201",
    name: "Zenith Conference Hall",
    roomNumber: "R-201",
    floor: 2,
    capacity: 30,
    pricePerHour: 2500,
    includedAmenities: ["wifi", "ac", "projector", "smarttv", "mic", "speakers", "videoconf"],
    isActive: true,
    description: "A large, fully wired hall for town halls and multi-site conferences.",
  },
  {
    id: "r-203",
    name: "Pixel Huddle Room",
    roomNumber: "R-203",
    floor: 2,
    capacity: 4,
    pricePerHour: 450,
    includedAmenities: ["wifi", "ac"],
    isActive: true,
    description: "A quiet two-to-four person space for quick huddles and calls.",
  },
  {
    id: "r-301",
    name: "Skyline Training Room",
    roomNumber: "R-301",
    floor: 3,
    capacity: 20,
    pricePerHour: 1800,
    includedAmenities: ["wifi", "ac", "projector", "whiteboard", "mic"],
    isActive: true,
    description: "A classroom-style layout built for workshops and training sessions.",
  },
  {
    id: "r-302",
    name: "Aurora Interview Room",
    roomNumber: "R-302",
    floor: 3,
    capacity: 3,
    pricePerHour: 350,
    includedAmenities: ["wifi", "ac"],
    isActive: false,
    description: "Currently closed for scheduled maintenance.",
  },
  {
    id: "r-401",
    name: "Vertex Boardroom",
    roomNumber: "R-401",
    floor: 4,
    capacity: 10,
    pricePerHour: 1100,
    includedAmenities: ["wifi", "ac", "smarttv", "videoconf"],
    isActive: true,
    description: "A modern boardroom tuned for hybrid and video-first meetings.",
  },
  {
    id: "r-402",
    name: "Quartz Event Hall",
    roomNumber: "R-402",
    floor: 4,
    capacity: 50,
    pricePerHour: 4000,
    includedAmenities: ["wifi", "ac", "projector", "smarttv", "mic", "speakers", "parking"],
    isActive: true,
    description: "The largest space on campus — launches, all-hands, and events.",
  },
];

export function getRoomById(roomId) {
  return MOCK_ROOMS.find((r) => r.id === roomId) || null;
}

// Capacity buckets used as the room "type/category" filter on Admin >
// Rooms, and reused by utils/categoryStorage.js as the system Room
// categories — this dataset doesn't otherwise categorize rooms beyond
// size/capacity, so keeping the single definition here (rather than
// duplicating it) is what lets both places agree on the same buckets.
export const CAPACITY_BUCKETS = [
  { id: "small", label: "Small (≤ 6)", test: (c) => c <= 6 },
  { id: "medium", label: "Medium (7–15)", test: (c) => c > 6 && c <= 15 },
  { id: "large", label: "Large (16+)", test: (c) => c > 15 },
];
