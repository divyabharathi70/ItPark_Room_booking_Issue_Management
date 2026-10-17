import { useState } from "react";
import Icon from "../icons/Icon";

/**
 * Presentational search input for the topbar. Content search (rooms,
 * bookings, issues, etc.) doesn't exist yet, so this just holds local
 * state and calls an optional onSearch callback — wire it up once the
 * real data views exist.
 */
export default function SearchBar({ placeholder = "Search rooms, bookings, issues…", onSearch, className = "" }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch?.(value.trim());
  }

  return (
    <form onSubmit={handleSubmit} role="search" className={`relative ${className}`}>
      <Icon
        name="search"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blueprint-muted"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full rounded-md border border-blueprint-line bg-blueprint-panel2 py-2 pl-9 pr-3 text-sm text-blueprint-text placeholder:text-blueprint-muted2 outline-none transition focus:border-blueprint-amber focus:ring-1 focus:ring-blueprint-amber"
      />
    </form>
  );
}
