// Small mock dataset used only to populate the "Open Issues" widgets on
// the client dashboard. The full Issues module is a separate feature —
// this is just enough demo data to make the dashboard feel real.

export const MOCK_ISSUES = [
  {
    id: "ISS-2201",
    title: "Projector flickering in Orion Boardroom",
    room: "Orion Boardroom (R-101)",
    status: "OPEN",
    raisedOn: "2026-08-24",
  },
  {
    id: "ISS-2198",
    title: "AC not cooling in Pixel Huddle Room",
    room: "Pixel Huddle Room (R-203)",
    status: "IN_PROGRESS",
    raisedOn: "2026-08-21",
  },
  {
    id: "ISS-2190",
    title: "Whiteboard markers missing",
    room: "Skyline Training Room (R-301)",
    status: "RESOLVED",
    raisedOn: "2026-08-15",
  },
];
