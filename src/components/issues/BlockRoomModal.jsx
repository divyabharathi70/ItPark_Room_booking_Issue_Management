import { useEffect, useState } from "react";
import Icon from "../icons/Icon";

const PRESET_REASONS = [
  "Under maintenance",
  "Awaiting parts/repair",
  "Safety hazard",
  "Deep cleaning required",
  "Other",
];

/**
 * Modal admin uses to mark a room unavailable while an issue is being
 * worked on. Stores a reason plus the triggering issue id — booking
 * records are never touched by this action.
 */
export default function BlockRoomModal({ open, issue, busy, onSubmit, onCancel }) {
  const [reasonPreset, setReasonPreset] = useState(PRESET_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReasonPreset(PRESET_REASONS[0]);
      setCustomReason("");
      setError("");
    }
  }, [open]);

  if (!open || !issue) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const reason = reasonPreset === "Other" ? customReason.trim() : reasonPreset;
    if (!reason) {
      setError("Add a reason so the front desk knows why the room is blocked.");
      return;
    }
    setError("");
    onSubmit({ reason });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <Icon name="ban" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Block Room</h3>
            <p className="text-xs text-slate-400">
              {issue.roomName} · Issue {issue.id}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          The room will be marked unavailable for new bookings until it's unblocked. Existing booking
          records are kept as-is.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reason
            </label>
            <select
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              {PRESET_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reasonPreset === "Other" && (
            <div>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Describe why this room is being blocked…"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
              />
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            >
              {busy ? "Blocking…" : "Block Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
