import { ROLE_LABELS } from "../../data/mockUsers";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Shows an avatar (initials), display name and role label.
 * `variant="compact"` is used in tight spaces like the sidebar footer;
 * `variant="full"` is used as the trigger inside UserProfileMenu.
 */
export default function UserProfile({ user, variant = "full", className = "" }) {
  if (!user) return null;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blueprint-steel2 bg-blueprint-panel2 font-mono text-xs font-semibold text-blueprint-amber">
        {user.profilePicture ? <img src={user.profilePicture} alt="" className="h-full w-full object-cover" /> : initials(user.name)}
      </div>
      {variant === "full" && (
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-blueprint-text">{user.name}</p>
          <p className="truncate font-mono text-[10px] tracking-wider text-blueprint-muted">
            {ROLE_LABELS[user.role]?.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}
