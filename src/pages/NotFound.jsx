import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-blueprint-bg blueprint-grid-bg px-6 text-center">
      <div>
        <p className="font-mono text-[11px] tracking-[0.25em] text-blueprint-amber">SHEET NOT FOUND</p>
        <h1 className="mt-2 font-display text-5xl font-semibold text-blueprint-text">404</h1>
        <p className="mt-3 text-sm text-blueprint-muted">This zone doesn't exist on the site plan.</p>
        <Link
          to="/login"
          className="mt-6 inline-block rounded-md bg-blueprint-amber px-5 py-2.5 font-display text-sm font-semibold text-blueprint-bg transition hover:bg-blueprint-amberDim"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
