import { useEffect, useState } from "react";
import Icon from "../icons/Icon";

/**
 * Small reusable "pick one value and confirm" modal. Used for both
 * Change Priority and Change Status so those two admin actions share one
 * implementation instead of two near-identical modals.
 */
export default function SelectFieldModal({
  open,
  icon = "tag",
  title,
  issueId,
  label,
  options,
  value,
  busy,
  submitLabel = "Save",
  onSubmit,
  onCancel,
}) {
  const [selected, setSelected] = useState(value || options?.[0] || "");

  useEffect(() => {
    if (open) setSelected(value || options?.[0] || "");
  }, [open, value, options]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Icon name={icon} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {issueId && <p className="text-xs text-slate-400">Issue {issueId}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {String(opt).replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

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
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
