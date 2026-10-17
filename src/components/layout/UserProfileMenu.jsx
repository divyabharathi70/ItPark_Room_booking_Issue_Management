import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_ITEMS } from "../../data/navigation";
import Icon from "../icons/Icon";
import UserProfile from "./UserProfile";

export default function UserProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Only some roles have a dedicated Profile page in their sidebar.
  const profileItem = NAV_ITEMS[user.role]?.find((item) => item.label === "Profile");

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-transparent py-1 pl-1 pr-2 transition hover:border-blueprint-line hover:bg-blueprint-panel2"
      >
        <UserProfile user={user} variant="full" className="hidden sm:flex" />
        <UserProfile user={user} variant="compact" className="sm:hidden" />
        <Icon
          name="chevronDown"
          className={`h-4 w-4 text-blueprint-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-md border border-blueprint-line bg-blueprint-panel shadow-xl"
        >
          <div className="border-b border-blueprint-line px-4 py-3">
            <p className="truncate text-sm font-medium text-blueprint-text">{user.name}</p>
            <p className="truncate text-xs text-blueprint-muted">{user.email}</p>
          </div>

          {profileItem && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(profileItem.path);
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-blueprint-text transition hover:bg-blueprint-panel2"
            >
              <Icon name="user" className="h-4 w-4 text-blueprint-muted" />
              Profile
            </button>
          )}

          <button
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-blueprint-error transition hover:bg-blueprint-error/10"
          >
            <Icon name="logout" className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
