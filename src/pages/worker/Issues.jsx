import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ResolveIssueModal from "../../components/issues/ResolveIssueModal";
import {
  ISSUE_STATUS,
  PRIORITY,
  ISSUES_EVENT,
  getIssuesForWorker,
  isIssueOverdue,
  resolveIssueByWorker,
  seedWorkerIssuesIfEmpty,
  startWork,
} from "../../utils/issueStorage";

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

const FILTERS = ["All", "New", "In Progress", "High Priority", "Resolved"];

function matchesFilter(issue, filter) {
  switch (filter) {
    case "New":
      return issue.status === ISSUE_STATUS.ASSIGNED;
    case "In Progress":
      return issue.status === ISSUE_STATUS.IN_PROGRESS;
    case "High Priority":
      return (
        (issue.priority === PRIORITY.HIGH || issue.priority === PRIORITY.CRITICAL) &&
        issue.status !== ISSUE_STATUS.RESOLVED &&
        issue.status !== ISSUE_STATUS.CLOSED
      );
    case "Resolved":
      return issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;
    default:
      return true;
  }
}

export default function WorkerIssues({ adminAssignedOnly = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [startingId, setStartingId] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null); // issue id or null
  const [resolving, setResolving] = useState(false);

  function refresh() {
    const assignedIssues = getIssuesForWorker(user.id);
    setIssues(adminAssignedOnly ? assignedIssues.filter((issue) => issue.assignmentMethod === "MANUAL") : assignedIssues);
  }

  useEffect(() => {
    if (!adminAssignedOnly) seedWorkerIssuesIfEmpty(user.id, user.name);
    refresh();
    window.addEventListener(ISSUES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ISSUES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user.id, user.name, adminAssignedOnly]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (!matchesFilter(issue, filter)) return false;
      if (!q) return true;
      return (
        issue.id.toLowerCase().includes(q) ||
        issue.roomName?.toLowerCase().includes(q) ||
        issue.category?.toLowerCase().includes(q) ||
        issue.description?.toLowerCase().includes(q) ||
        issue.employeeName?.toLowerCase().includes(q)
      );
    });
  }, [issues, filter, query]);

  const counts = useMemo(
    () => ({
      All: issues.length,
      New: issues.filter((i) => matchesFilter(i, "New")).length,
      "In Progress": issues.filter((i) => matchesFilter(i, "In Progress")).length,
      "High Priority": issues.filter((i) => matchesFilter(i, "High Priority")).length,
      Resolved: issues.filter((i) => matchesFilter(i, "Resolved")).length,
    }),
    [issues]
  );

  function handleStartWork(issue) {
    if (issue.assignedWorkerId !== user.id) return;
    setStartingId(issue.id);
    setTimeout(() => {
      startWork(issue.id, user);
      setStartingId(null);
      setToast(`${issue.id} moved to In Progress.`);
      refresh();
    }, 350);
  }

  function handleResolveSubmit({ resolutionDescription, resolutionPhoto }) {
    if (!resolveTarget) return;
    setResolving(true);
    setTimeout(() => {
      resolveIssueByWorker(resolveTarget, user, { resolutionDescription, resolutionPhoto });
      setResolving(false);
      setResolveTarget(null);
      setToast(`${resolveTarget} marked as Resolved.`);
      refresh();
    }, 450);
  }

  return (
    <div>
      <PageHeader
        title={adminAssignedOnly ? "Assigned Tasks" : "My Issues"}
        description={adminAssignedOnly
          ? "Tasks assigned or reassigned to you directly by an admin."
          : "All issues assigned to you — view details, start work, and record resolutions."}
      />

      {/* Filters + search */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === f ? "bg-indigo-50 text-indigo-600" : "bg-slate-200 text-slate-500"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative sm:w-64">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issue, room, category…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={issues.length > 0} />
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden sm:block">
            <IssueTable
              issues={filtered}
              onOpen={(id) => navigate(`/worker/issues/${id}`)}
              onStartWork={handleStartWork}
              onResolve={(id) => setResolveTarget(id)}
              startingId={startingId}
              workerId={user.id}
            />
          </div>
          {/* Mobile: cards */}
          <div className="grid gap-4 sm:hidden">
            {filtered.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => navigate(`/worker/issues/${issue.id}`)}
                onStartWork={() => handleStartWork(issue)}
                onResolve={() => setResolveTarget(issue.id)}
                starting={startingId === issue.id}
                workerId={user.id}
              />
            ))}
          </div>
        </>
      )}

      <ResolveIssueModal
        open={!!resolveTarget}
        issueId={resolveTarget}
        busy={resolving}
        onSubmit={handleResolveSubmit}
        onCancel={() => setResolveTarget(null)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 align-middle">
            <Icon name="check" className="h-3 w-3" strokeWidth={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasAny }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="alert" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No issues match this filter" : "No issues assigned to you yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny
          ? "Try a different filter or clear your search."
          : "Once an issue is assigned to you, it'll show up here with its live status."}
      </p>
    </div>
  );
}

function RowActions({ issue, onOpen, onStartWork, onResolve, starting, workerId, compact = false }) {
  const isOwn = issue.assignedWorkerId === workerId;
  const wrap = compact ? "flex flex-wrap items-center gap-2" : "flex items-center justify-end gap-2";

  return (
    <div className={wrap}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        <Icon name="chevronRight" className="h-3.5 w-3.5" />
        View
      </button>
      {isOwn && issue.status === ISSUE_STATUS.ASSIGNED && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartWork();
          }}
          disabled={starting}
          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          <Icon name="clock" className="h-3.5 w-3.5" />
          {starting ? "Starting…" : "Start Work"}
        </button>
      )}
      {isOwn && issue.status === ISSUE_STATUS.IN_PROGRESS && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onResolve();
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Icon name="checkCircle" className="h-3.5 w-3.5" />
          Mark Resolved
        </button>
      )}
    </div>
  );
}

function IssueTable({ issues, onOpen, onStartWork, onResolve, startingId, workerId }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Issue ID</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Reporter</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr
                key={issue.id}
                onClick={() => onOpen(issue.id)}
                className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/30"
              >
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">{issue.id}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{issue.roomName}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{issue.category}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={issue.priority} />
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-slate-600" title={issue.description}>
                    {issue.description}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-500">{issue.employeeName || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                  {formatDateTime(issue.createdDate)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={issue.status} />
                    {isIssueOverdue(issue) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <Icon name="alert" className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    issue={issue}
                    onOpen={() => onOpen(issue.id)}
                    onStartWork={() => onStartWork(issue)}
                    onResolve={() => onResolve(issue.id)}
                    starting={startingId === issue.id}
                    workerId={workerId}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueCard({ issue, onOpen, onStartWork, onResolve, starting, workerId }) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onOpen} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{issue.id}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{issue.category}</h3>
          <p className="truncate text-xs text-slate-500">{issue.roomName}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={issue.status} />
          {isIssueOverdue(issue) && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
              <Icon name="alert" className="h-3 w-3" />
              Overdue
            </span>
          )}
        </div>
      </div>

      <p className="mb-3 line-clamp-2 text-xs text-slate-500">{issue.description}</p>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="user" className="h-3.5 w-3.5 text-slate-400" />
          {issue.employeeName || "—"}
        </span>
        <StatusBadge status={issue.priority} />
      </div>

      <p className="mb-3 text-[11px] text-slate-400">{formatDateTime(issue.createdDate)}</p>

      <div className="mt-auto border-t border-slate-100 pt-3">
        <RowActions
          issue={issue}
          onOpen={onOpen}
          onStartWork={onStartWork}
          onResolve={onResolve}
          starting={starting}
          workerId={workerId}
          compact
        />
      </div>
    </div>
  );
}
