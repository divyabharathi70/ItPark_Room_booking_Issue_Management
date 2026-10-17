// Content for the "Explore the IT Park Campus" cards on the home page and
// the per-facility detail pages (/campus/:facilityId). Presentation only —
// nothing here is bookable and no live availability is implied.

export const CAMPUS_FACILITIES = [
  {
    id: "campus",
    title: "Modern IT Park",
    image: "/images/campus/modern-it-park.jpg",
    alt: "Modern glass office buildings surrounded by landscaped gardens at the IT Park campus",
    description: "A modern business environment designed for collaboration, innovation, and productivity.",
    detail: "4 Floors",
    icon: "building",
    tagline: "A campus built around the way teams work today.",
    about: [
      "IT Park brings meeting rooms, conference halls, training rooms and event spaces together in one contemporary, glass-fronted campus.",
      "Rooms are spread across four floors, so you can pick the space that fits your group — from a quiet huddle room to a large event hall — without leaving the building.",
    ],
    highlights: [
      { icon: "building", title: "Four floors", text: "Rooms organised across four floors, from huddle rooms to event halls." },
      { icon: "users", title: "Spaces for every team", text: "Small meeting rooms through to large conference and event spaces." },
      { icon: "wifi", title: "Work-ready rooms", text: "Rooms come with amenities such as WiFi and AC, with extras available to add." },
      { icon: "mapPin", title: "Landscaped surroundings", text: "Green, open surroundings that make arriving and stepping out easy." },
    ],
    goodToKnow: [
      "Browse every room, its floor and its amenities on the Rooms page.",
      "Room availability is shown on each room's card and details page.",
    ],
  },
  {
    id: "reception",
    title: "Reception & Lobby",
    image: "/images/campus/reception-lobby.jpg",
    alt: "Elegant corporate reception lobby with a front desk, glass walls and indoor plants",
    description: "A welcoming entrance with a professional reception and visitor assistance.",
    detail: "Visitor Assistance",
    icon: "bell",
    tagline: "A first impression worth walking in for.",
    about: [
      "The lobby is the front door to IT Park: an airy, light-filled entrance with a staffed reception desk, glass partitions and indoor greenery.",
      "Whether you are hosting clients or arriving for a workshop, the reception area is where visitors are welcomed and pointed in the right direction.",
    ],
    highlights: [
      { icon: "users", title: "Visitor assistance", text: "A reception desk to help guests find their way on arrival." },
      { icon: "shieldCheck", title: "Professional front desk", text: "A polished, organised entrance for clients and attendees." },
      { icon: "mapPin", title: "Easy to find", text: "A clear main entrance that connects to the rest of the building." },
      { icon: "check", title: "Calm, bright space", text: "Natural materials, soft lighting and plants for a relaxed welcome." },
    ],
    goodToKnow: [
      "Planning an event? Let your guests know to check in at reception on arrival.",
      "Reception services are general campus information — they are not booked through this site.",
    ],
  },
  {
    id: "cafeteria",
    title: "Cafeteria & Lounge",
    image: "/images/campus/cafeteria-lounge.jpg",
    alt: "Bright modern office cafeteria with dining tables, comfortable seating and natural light",
    description: "Take a break, enjoy refreshments, and connect with colleagues in a comfortable space.",
    detail: "Dining & Relaxation",
    icon: "coffee",
    tagline: "Step away from the meeting, not from the day.",
    about: [
      "The cafeteria and lounge is a relaxed, naturally lit space with a mix of dining tables, booths and soft seating — good for a quick bite, a coffee, or an informal catch-up.",
      "It gives teams a place to reset between sessions, so long workshops and full-day events stay comfortable.",
    ],
    highlights: [
      { icon: "coffee", title: "Refreshments", text: "A place to take a break and enjoy a drink or a snack." },
      { icon: "users", title: "Mix of seating", text: "Tables, booths and lounge chairs for groups large and small." },
      { icon: "zap", title: "Natural light", text: "Large windows and warm interiors for an easy, energising feel." },
      { icon: "usersSmall", title: "Informal meet-ups", text: "Ideal for casual conversations away from the meeting table." },
    ],
    goodToKnow: [
      "Dining and lounge areas are general campus facilities — they are not reserved through this site.",
      "Need catering for an event? Reach out through the Contact page.",
    ],
  },
  {
    id: "parking",
    title: "Parking Facilities",
    image: "/images/campus/parking.jpg",
    alt: "Clean, organised parking area beside a modern corporate office building",
    description: "Convenient parking facilities for employees and visitors.",
    detail: "Parking Area",
    icon: "car",
    tagline: "Arrive easily. Park without the hassle.",
    about: [
      "IT Park's parking area is clean and clearly marked, with lanes, bays and landscaped edges close to the office buildings.",
      "It is set up for both employees and visitors, so guests attending a meeting or event have somewhere convenient to leave their vehicles.",
    ],
    highlights: [
      { icon: "parking", title: "Employees & visitors", text: "Parking provision for the people who work here and those who visit." },
      { icon: "check", title: "Marked bays & lanes", text: "Clear markings and directional arrows keep the area organised." },
      { icon: "building", title: "Close to the buildings", text: "Short walk from the lot to the office entrances." },
      { icon: "mapPin", title: "Landscaped edges", text: "Trees, lawns and walkways frame the parking area." },
    ],
    goodToKnow: [
      "Parking is also listed as an amenity on selected rooms — check a room's details to see what it includes.",
      "Parking is general campus information; this site does not show live space availability.",
    ],
  },
];

export function getCampusFacility(id) {
  return CAMPUS_FACILITIES.find((f) => f.id === id) || null;
}
