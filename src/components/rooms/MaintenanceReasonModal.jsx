import Icon from "../icons/Icon";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Read-only "View Maintenance Reason" details for a room currently under
 * MAINTENANCE or BLOCKED — who blocked it, why, when, and which issue (if
 * any) triggered it. */
export default function MaintenanceReasonModal({ open, room, info, onViewIssue, onClose }) {
  if (!open || !room || !info) return null;

  const isAuto = info.blockedBy === "System (auto)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              info.status === "MAINTENANCE" ? "bg-orange-50 text-orange-600" : "bg-rose-50 text-rose-600"
            }`}
          >
            <Icon name={info.status === "MAINTENANCE" ? "tool" : "ban"} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Maintenance Details</h3>
            <p className="text-xs text-slate-400">
              {room.name} · {room.roomNumber}
            </p>
          </div>
        </div>

        <dl className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-semibold text-slate-800">
              {info.status === "MAINTENANCE" ? "Under Maintenance" : "Blocked"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-slate-500">Reason</dt>
            <dd className="text-right font-medium text-slate-800">{info.reason || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Blocked by</dt>
            <dd className="font-medium text-slate-800">{isAuto ? "System (auto)" : info.blockedBy || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Since</dt>
            <dd className="font-medium text-slate-800">{formatDateTime(info.blockedAt)}</dd>
          </div>
          {info.relatedIssueId && (
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Related issue</dt>
              <dd className="font-mono font-semibold text-indigo-600">{info.relatedIssueId}</dd>
            </div>
          )}
        </dl>

        {isAuto && (
          <p className="mt-3 text-xs text-slate-400">
            This room was blocked automatically because it has an unresolved critical issue. It will become
            available again once that issue is resolved, or you can unblock it manually below.
          </p>
        )}

        <div className="mt-6 flex items-center gap-3">
          {info.relatedIssueId && onViewIssue && (
            <button
              type="button"
              onClick={() => onViewIssue(info.relatedIssueId)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              View Issue
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
