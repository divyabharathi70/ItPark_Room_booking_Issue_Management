import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NAV_ITEMS } from "../../data/navigation";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Topbar from "./Topbar";

/**
 * Shared layout for every authenticated, role-protected route: a fixed
 * sidebar on desktop, a collapsible drawer on mobile, a sticky topbar,
 * and the page content in between. Individual pages only need to render
 * their own content — this shell (and the role-based nav menu) is common
 * to all of them.
 */
export default function AppLayout() {
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = NAV_ITEMS[user.role] || [];

  // The drawer closes itself via Sidebar's onNavigate (fired on link click)
  // and via the MobileNav backdrop/close-button — no route-watching effect
  // needed here.

  return (
    <div className="flex h-screen overflow-hidden bg-blueprint-bg">
      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-blueprint-line bg-blueprint-secondary lg:block">
        <Sidebar navItems={navItems} />
      </aside>

      {/* Mobile: collapsible drawer */}
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <Sidebar navItems={navItems} onNavigate={() => setMobileNavOpen(false)} />
      </MobileNav>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-sky-50 via-blue-50/70 to-indigo-50/60 blueprint-grid-bg">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
