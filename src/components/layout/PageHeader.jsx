/**
 * Standard heading block for the top of a page's content area (below the
 * topbar). Every placeholder/dashboard page renders one of these so the
 * content area has a consistent rhythm once real features are built.
 */
export default function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-blueprint-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-1.5 font-mono text-[11px] tracking-[0.25em] text-blueprint-amber">
            {eyebrow.toUpperCase()}
          </p>
        )}
        <h1 className="font-display text-2xl font-semibold text-blueprint-text">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-blueprint-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
