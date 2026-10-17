// Small inline-SVG icon set shared across the app layout (sidebar, topbar,
// nav items). Kept as one lookup so every icon shares the same stroke
// weight and viewBox instead of pulling in an external icon library.

const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
    </>
  ),
  door: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="1" />
      <path d="M15 12h.01" strokeLinecap="round" strokeWidth="2.4" />
    </>
  ),
  alert: (
    <path
      d="M12 9v4M12 17h.01M10.3 3.6 2.6 17.4A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.6L13.7 3.6a1.8 1.8 0 0 0-3.4 0Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  wrench: (
    <path
      d="M14.7 6.3a4 4 0 0 0-5.4 4.6L3 17.2V21h3.8l6.3-6.3a4 4 0 0 0 4.6-5.4l-2.8 2.8-2.6-.6-.6-2.6Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7.5M3 12.5h18" strokeLinecap="round" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" strokeLinecap="round" />
      <path d="M16 4.3a3.2 3.2 0 0 1 0 6.3M21.2 20a5.5 5.5 0 0 0-4.6-6" strokeLinecap="round" />
    </>
  ),
  tool: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.3-.9-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  tag: (
    <path
      d="M11.5 3H5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 .6 1.4l8.5 8.5a2 2 0 0 0 2.8 0l6.5-6.5a2 2 0 0 0 0-2.8l-8.5-8.5a2 2 0 0 0-1.4-.6ZM7.5 7.5h.01"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  chart: (
    <>
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" />
      <path d="M2 20h20" strokeLinecap="round" />
    </>
  ),
  bell: (
    <path
      d="M18 16.3V11a6 6 0 1 0-12 0v5.3L4 19h16l-2-2.7ZM10 21a2 2 0 0 0 4 0"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  logout: (
    <path
      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  plusSquare: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </>
  ),
  clipboardList: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 2.5h6a1 1 0 0 1 1 1V5H8V3.5a1 1 0 0 1 1-1Z" />
      <path d="M8.5 10.5h7M8.5 14h7M8.5 17.5h4.5" strokeLinecap="round" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
    </>
  ),
  listChecks: (
    <path
      d="m4 6 1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9M11 12h9M11 18h9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  megaphone: (
    <path
      d="M3 11v2a2 2 0 0 0 2 2h1l1 5h2l-1-5h2l7 4V7l-7 4H6a2 2 0 0 0-2 2Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />,
  building: (
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
  ),

  // --- Added for the client room-booking flow ---
  wifi: (
    <>
      <path d="M2 8.8a15.5 15.5 0 0 1 20 0" strokeLinecap="round" />
      <path d="M5.3 12.5a11 11 0 0 1 13.4 0" strokeLinecap="round" />
      <path d="M8.7 16.2a6.3 6.3 0 0 1 6.6 0" strokeLinecap="round" />
      <circle cx="12" cy="19.3" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  projector: (
    <>
      <rect x="2.5" y="7" width="14" height="9" rx="2" />
      <circle cx="9.5" cy="11.5" r="2.3" />
      <path d="M16.5 10.2 21 8.5v6l-4.5-1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 16v2.5M6 21h.01" strokeLinecap="round" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="4" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 17v4" strokeLinecap="round" />
    </>
  ),
  whiteboard: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="1.5" />
      <path d="M7 21h10M9.5 17v4M14.5 17v4M6 8h6M6 11h9" strokeLinecap="round" />
    </>
  ),
  snow: (
    <path
      d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M12 6l-2 2M12 6l2 2M12 18l-2-2M12 18l2-2M7.5 9.5l-2.6-.7.7-2.6M16.5 9.5l2.6-.7-.7-2.6M7.5 14.5l-2.6.7.7 2.6M16.5 14.5l2.6.7-.7 2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" strokeLinecap="round" />
    </>
  ),
  speaker: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <circle cx="12" cy="8" r="2.2" />
      <circle cx="12" cy="15.5" r="3.2" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
      <path d="M15.5 10.8 21.5 7.5v9l-6-3.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  parking: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" stroke="none" fill="currentColor">
        P
      </text>
    </>
  ),
  check: <path d="M4 12.5 9.5 18 20 6.5" strokeLinecap="round" strokeLinejoin="round" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m7.8 12.3 2.7 2.7 5.7-6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.8V12l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  creditCard: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <path d="M2.5 9.5h19M6 15h4" strokeLinecap="round" />
    </>
  ),
  rupee: (
    <text x="12" y="17.5" textAnchor="middle" fontSize="17" fontWeight="700" stroke="none" fill="currentColor">
      ₹
    </text>
  ),
  chevronLeft: <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />,
  chevronRight: <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />,
  mapPin: (
    <>
      <path d="M12 21.5S4.5 14.9 4.5 9.5a7.5 7.5 0 0 1 15 0c0 5.4-7.5 12-7.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="2.4" />
    </>
  ),
  usersSmall: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 19.5a6 6 0 0 1 12 0" strokeLinecap="round" />
      <path d="M15 5.3a3 3 0 0 1 0 5.9M20.5 19.5a5 5 0 0 0-4-5.6" strokeLinecap="round" />
    </>
  ),
  shieldCheck: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10v-6L12 2.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.7 12 2.3 2.3 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  spinner: (
    <path
      d="M12 3a9 9 0 1 0 9 9"
      strokeLinecap="round"
    />
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m5.5 5.5 13 13" strokeLinecap="round" />
    </>
  ),

  // --- Added for the employee issue-reporting flow ---
  upload: (
    <>
      <path d="M12 15.5V4M12 4 7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15.5v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4.5 17 4.5-4.8 3 2.8 3.5-3.8 5 5.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  trash: (
    <>
      <path
        d="M4 7h16M9 7V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V7M6 7l1 13a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8l1-13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </>
  ),
  edit: (
    <>
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19 3 20l1-4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14.5 5.5 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  zap: (
    <path
      d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export default function Icon({ name, className = "h-5 w-5", strokeWidth = 1.7 }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
