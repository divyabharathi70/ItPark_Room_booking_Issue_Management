import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";

/**
 * Placeholder body for any menu item that has a working route but no
 * real feature yet. Confirms the layout, routing and role-based nav are
 * all correct while the actual screens (bookings table, issue board,
 * etc.) get built one at a time.
 */
export default function ComingSoon({ eyebrow, title, description, icon = "wrench" }) {
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-blueprint-line bg-blueprint-panel/40 px-6 py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-blueprint-steel2 text-blueprint-steel">
          <Icon name={icon} className="h-6 w-6" />
        </div>
        <p className="font-mono text-[11px] tracking-[0.25em] text-blueprint-amber">UNDER CONSTRUCTION</p>
        <p className="mt-2 max-w-sm text-sm text-blueprint-muted">
          This screen is on the roadmap. The route, sidebar link, and layout are already wired up —
          the feature itself comes next.
        </p>
      </div>
    </div>
  );
}
