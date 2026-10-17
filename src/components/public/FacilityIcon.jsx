import Icon from "../icons/Icon";

// Icons the shared Icon set doesn't have (kept local so Icon.jsx is untouched).
const EXTRA_ICONS = {
  bell: (
    <>
      <path d="M3 18h18" strokeLinecap="round" />
      <path d="M5 18a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8V6m-2 0h4" strokeLinecap="round" />
    </>
  ),
  coffee: (
    <>
      <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" strokeLinejoin="round" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" strokeLinecap="round" />
      <path d="M8 3v3m4-3v3" strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M5 16V12l1.6-4.2A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.3L19 12v4" strokeLinejoin="round" />
      <path d="M3.5 12h17v4a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4Z" strokeLinejoin="round" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </>
  ),
};

export default function FacilityIcon({ name, className = "h-4 w-4" }) {
  const extra = EXTRA_ICONS[name];
  if (!extra) return <Icon name={name} className={className} />;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
      {extra}
    </svg>
  );
}
