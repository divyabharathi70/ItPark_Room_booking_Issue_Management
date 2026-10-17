const STYLES = {
  // Booking status
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  // Display-only status for a paid booking still awaiting Admin review —
  // the underlying stored bookingStatus stays PENDING; this key is only
  // ever passed to <StatusBadge> for the label/colour, never persisted.
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  COMPLETED: "bg-slate-100 text-slate-600 ring-slate-200",
  // Payment status
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
  // Extension-request status
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-200",
  // Issue status
  OPEN: "bg-rose-50 text-rose-700 ring-rose-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 ring-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CLOSED: "bg-slate-100 text-slate-600 ring-slate-200",
  REOPENED: "bg-orange-50 text-orange-700 ring-orange-200",
  // Issue priority
  LOW: "bg-slate-100 text-slate-600 ring-slate-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-200",
  CRITICAL: "bg-rose-50 text-rose-700 ring-rose-200",
  // Room availability
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  OCCUPIED: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  MAINTENANCE: "bg-orange-50 text-orange-700 ring-orange-200",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200",
};

export default function StatusBadge({ status, className = "" }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${style} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {typeof status === "string" ? status.replace(/_/g, " ") : status}
    </span>
  );
}
