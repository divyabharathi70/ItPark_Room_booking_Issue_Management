import Icon from "../icons/Icon";
import SearchBar from "./SearchBar";
import NotificationBell from "./NotificationBell";
import UserProfileMenu from "./UserProfileMenu";

export default function Topbar({ onOpenMobileNav }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-blueprint-dashnav bg-blueprint-dashnav px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-blueprint-line text-blueprint-text lg:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      <SearchBar className="hidden max-w-sm flex-1 sm:block" />

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <NotificationBell />
        <UserProfileMenu />
      </div>
    </header>
  );
}
