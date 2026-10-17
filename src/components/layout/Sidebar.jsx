import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Icon from "../icons/Icon";
import UserProfile from "./UserProfile";
import { getParkName, SETTINGS_EVENT } from "../../utils/settingsStorage";

/**
 * Renders the nav list for the signed-in user's role plus a profile
 * footer and a logout action. This is pure content — no fixed/drawer
 * positioning — so AppLayout can drop it into the desktop <aside> and
 * into the mobile drawer without duplicating the menu logic.
 *
 * `onNavigate` is called after a link is clicked, letting the mobile
 * drawer close itself on navigation.
 */
export default function Sidebar({ navItems, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [parkName, setParkName] = useState(getParkName());

  // Admin > Settings > General > Park/System Name can rename the brand
  // shown here. Re-reads on the settings-changed event so it updates live
  // if Settings is saved in another tab, without polling or a context.
  useEffect(() => {
    function refresh() {
      setParkName(getParkName());
    }
    window.addEventListener(SETTINGS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function handleLogout() {
    onNavigate?.();
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-blueprint-line px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-blueprint-steel2 text-blueprint-amber">
          <Icon name="building" className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div>
          <p className="font-display text-sm font-semibold tracking-wide text-blueprint-text">
            {parkName.toUpperCase()}
          </p>
          <p className="font-mono text-[9px] tracking-[0.2em] text-blueprint-muted">FACILITY MANAGEMENT</p>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition ${
                    isActive
                      ? "border-blueprint-amber bg-blueprint-amber/10 text-blueprint-text"
                      : "border-transparent text-blueprint-muted hover:border-blueprint-steel2 hover:bg-blueprint-panel2 hover:text-blueprint-text"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={item.icon}
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? "text-blueprint-amber" : "text-blueprint-muted group-hover:text-blueprint-steel"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Profile + logout footer */}
      <div className="border-t border-blueprint-line p-4">
        <UserProfile user={user} variant="full" className="mb-3 px-1" />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md border border-blueprint-line px-3 py-2.5 text-sm text-blueprint-text transition hover:border-blueprint-error/50 hover:bg-blueprint-error/10 hover:text-blueprint-error"
        >
          <Icon name="logout" className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </div>
  );
}
