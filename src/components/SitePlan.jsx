import { ROLES } from "../data/mockUsers";

const ZONE_LAYOUT = [
  { role: ROLES.ADMIN, x: 40, y: 40, w: 210, h: 150 },
  { role: ROLES.CLIENT, x: 270, y: 40, w: 210, h: 150 },
  { role: ROLES.WORKER, x: 40, y: 210, w: 210, h: 150 },
  { role: ROLES.EMPLOYEE, x: 270, y: 210, w: 210, h: 150 },
];

/**
 * Schematic "site plan" of the IT Park, rendered as SVG in the style of an
 * architectural drawing: dimension lines, a compass rose, a scale bar and a
 * title block. Each block represents one of the four role zones so the
 * login screen doubles as a map of who goes where after signing in.
 */
export default function SitePlan({ activeRole }) {
  return (
    <svg
      viewBox="0 0 520 460"
      className="h-full w-full"
      role="img"
      aria-label="Schematic site plan of the IT Park showing four access zones"
    >
      <defs>
        <pattern id="finegrid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1B2830" strokeWidth="0.5" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="520" height="460" fill="url(#finegrid)" />

      {/* Outer perimeter with corner ticks, like a survey boundary */}
      <rect
        x="20" y="20" width="480" height="380"
        fill="none" stroke="#3E6E8E" strokeWidth="1" strokeDasharray="2 4"
      />

      {/* Compass rose, top-left */}
      <g transform="translate(455, 45)" stroke="#5B8DAE" strokeWidth="1.2">
        <circle r="18" fill="none" />
        <line x1="0" y1="-18" x2="0" y2="18" />
        <line x1="-18" y1="0" x2="18" y2="0" />
        <path d="M0,-18 L-4,-9 L4,-9 Z" fill="#F2A93B" stroke="none" />
        <text x="0" y="-24" textAnchor="middle" fill="#7C93A3" fontSize="9" fontFamily="'IBM Plex Mono', monospace">N</text>
      </g>

      {/* Top dimension line */}
      <g stroke="#3E6E8E" strokeWidth="1">
        <line x1="40" y1="30" x2="480" y2="30" />
        <line x1="40" y1="26" x2="40" y2="34" />
        <line x1="480" y1="26" x2="480" y2="34" />
      </g>
      <text x="260" y="24" textAnchor="middle" fill="#547084" fontSize="9" fontFamily="'IBM Plex Mono', monospace" letterSpacing="1">
        SITE WIDTH — 440.0 M
      </text>

      {/* Zone blocks */}
      {ZONE_LAYOUT.map(({ role, x, y, w, h }) => {
        const isActive = activeRole === role;
        return (
          <g key={role} className="transition-opacity duration-300">
            <rect
              x={x} y={y} width={w} height={h}
              rx="3"
              fill={isActive ? "rgba(242,169,59,0.08)" : "#131C22"}
              stroke={isActive ? "#F2A93B" : "#2A3F4D"}
              strokeWidth={isActive ? 1.6 : 1}
            />
            {/* corner brackets */}
            {[
              [x, y, 1, 1],
              [x + w, y, -1, 1],
              [x, y + h, 1, -1],
              [x + w, y + h, -1, -1],
            ].map(([cx, cy, dx, dy], i) => (
              <path
                key={i}
                d={`M ${cx + dx * 12} ${cy} L ${cx} ${cy} L ${cx} ${cy + dy * 12}`}
                fill="none"
                stroke={isActive ? "#F2A93B" : "#5B8DAE"}
                strokeWidth="1.4"
              />
            ))}
            {isActive && (
              <circle cx={x + w - 18} cy={y + 18} r="4" fill="#F2A93B">
                <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}

      {/* Left dimension line */}
      <g stroke="#3E6E8E" strokeWidth="1">
        <line x1="30" y1="40" x2="30" y2="360" />
        <line x1="26" y1="40" x2="34" y2="40" />
        <line x1="26" y1="360" x2="34" y2="360" />
      </g>

      {/* Scale bar */}
      <g transform="translate(40, 390)">
        <line x1="0" y1="0" x2="80" y2="0" stroke="#5B8DAE" strokeWidth="1.4" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="#5B8DAE" strokeWidth="1.4" />
        <line x1="40" y1="-3" x2="40" y2="3" stroke="#5B8DAE" strokeWidth="1.4" />
        <line x1="80" y1="-4" x2="80" y2="4" stroke="#5B8DAE" strokeWidth="1.4" />
        <text x="0" y="16" fill="#547084" fontSize="8" fontFamily="'IBM Plex Mono', monospace">0</text>
        <text x="72" y="16" fill="#547084" fontSize="8" fontFamily="'IBM Plex Mono', monospace">40M</text>
      </g>

      {/* Title block, bottom-right */}
      <g transform="translate(300, 380)">
        <rect x="0" y="0" width="200" height="40" fill="#0D1418" stroke="#2A3F4D" strokeWidth="1" />
        <line x1="0" y1="18" x2="200" y2="18" stroke="#2A3F4D" strokeWidth="1" />
        <text x="8" y="12" fill="#E7EEF3" fontSize="9" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" letterSpacing="0.5">
          IT PARK — MASTER SITE PLAN
        </text>
        <text x="8" y="30" fill="#547084" fontSize="8" fontFamily="'IBM Plex Mono', monospace">
          SHEET A-01 · REV 3 · SCALE 1:400
        </text>
      </g>
    </svg>
  );
}
