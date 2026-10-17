import { useEffect } from "react";
import Icon from "../icons/Icon";

/**
 * Slide-in drawer for small screens. Renders whatever is passed as
 * children (the shared Sidebar content) inside a fixed panel with a
 * dismissible backdrop. Desktop uses a plain fixed <aside> instead —
 * see AppLayout.
 */
export default function MobileNav({ open, onClose, children }) {
  // Prevent the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`absolute inset-y-0 left-0 w-72 max-w-[85%] transform bg-blueprint-panel shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-blueprint-muted transition hover:bg-blueprint-panel2 hover:text-blueprint-text"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}
