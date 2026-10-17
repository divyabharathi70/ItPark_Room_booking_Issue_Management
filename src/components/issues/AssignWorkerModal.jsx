import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
import StatusBadge from "../booking/StatusBadge";
import { DEPARTMENTS, suggestDepartment } from "../../utils/issueStorage";
import { getWorkersByDepartment } from "../../data/mockWorkers";

/**
 * Shared modal for both "Assign Worker" (first assignment) and "Reassign
 * Worker" (issue already has a worker). The department defaults to the
 * category-based suggestion but admin can override it, which re-filters
 * the worker dropdown live.
 */
export default function AssignWorkerModal({ open, issue, busy, onSubmit, onCancel }) {
  const [department, setDepartment] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [error, setError] = useState("");

  const isReassign = !!issue?.assignedWorkerId;
  const suggested = issue ? suggestDepartment(issue.category) : "";

  useEffect(() => {
    if (!open || !issue) return;
    const dept = issue.assignedDepartment || suggestDepartment(issue.category);
    setDepartment(dept);
    setWorkerId(issue.assignedWorkerId || "");
    setError("");
  }, [open, issue]);

  if (!open || !issue) return null;

  const workerOptions = getWorkersByDepartment(department);

  function handleClose() {
    setError("");
    onCancel();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!department) {
      setError("Choose a department to route this issue to.");
      return;
    }
    const worker = workerOptions.find((w) => w.id === workerId);
    if (!worker) {
      setError("Choose a worker from the list.");
      return;
    }
    setError("");
    onSubmit({ worker, department });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Icon name={isReassign ? "usersSmall" : "wrench"} className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {isReassign ? "Reassign Worker" : "Assign Worker"}
              </h3>
              <p className="text-xs text-slate-400">Issue {issue.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* Read-only issue summary */}
        <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl bg-slate-50 p-4 text-sm">
          <SummaryRow label="Issue ID" value={issue.id} mono />
          <SummaryRow label="Room" value={issue.roomName} />
          <SummaryRow label="Category" value={issue.category} />
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-500">Priority</dt>
            <dd>
              <StatusBadge status={issue.priority} />
            </dd>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5">
            <dt className="text-slate-500">Suggested Department</dt>
            <dd className="font-medium text-indigo-700">{suggested}</dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setWorkerId("");
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                  {d === suggested ? " (Suggested)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Worker
            </label>
            {workerOptions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-400">
                No workers found in this department.
              </p>
            ) : (
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="">Select a worker…</option>
                {workerOptions.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.id === issue.assignedWorkerId ? " (Currently assigned)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
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
              {busy ? "Saving…" : isReassign ? "Reassign" : "Assign Worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
