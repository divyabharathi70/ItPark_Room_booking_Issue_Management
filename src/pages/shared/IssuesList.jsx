import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { getIssuesForUser, ISSUE_STATUS, PRIORITY, ISSUES_EVENT } from "../../utils/issueStorage";

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

const FILTERS = ["All", "Open", "In Progress", "Resolved", "Critical"];

function matchesFilter(issue, filter) {
  switch (filter) {
    case "Open":
      return (
        issue.status === ISSUE_STATUS.OPEN ||
        issue.status === ISSUE_STATUS.ASSIGNED ||
        issue.status === ISSUE_STATUS.REOPENED
      );
    case "In Progress":
      return issue.status === ISSUE_STATUS.IN_PROGRESS;
    case "Resolved":
      return issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;
    case "Critical":
      return issue.priority === PRIORITY.CRITICAL;
    default:
      return true;
  }
}

export default function IssuesList() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const basePath = `/${user.role}/issues`;

  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("table"); // "table" | "cards" — table is the default on desktop

  useEffect(() => {
    const refresh = () => setIssues(getIssuesForUser(user.id));
    refresh();
    window.addEventListener(ISSUES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ISSUES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user.id, location.key]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (!matchesFilter(issue, filter)) return false;
      if (!q) return true;
      return (
        issue.id.toLowerCase().includes(q) ||
        issue.roomName?.toLowerCase().includes(q) ||
        issue.bookingId?.toLowerCase().includes(q) ||
        issue.category?.toLowerCase().includes(q) ||
        issue.description?.toLowerCase().includes(q) ||
        issue.assignedWorker?.toLowerCase().includes(q)
      );
    });
  }, [issues, filter, query]);

  const counts = useMemo(
    () => ({
      All: issues.length,
      Open: issues.filter((i) => matchesFilter(i, "Open")).length,
      "In Progress": issues.filter((i) => matchesFilter(i, "In Progress")).length,
      Resolved: issues.filter((i) => matchesFilter(i, "Resolved")).length,
      Critical: issues.filter((i) => matchesFilter(i, "Critical")).length,
    }),
    [issues]
  );

  return (
    <div>
      <PageHeader
        title="My Issues"
        description="Everything you've reported, with live status, priority, and resolution details."
        actions={
          <Link
            to={`${basePath}/new`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="megaphone" className="h-4 w-4" />
            Raise Issue
          </Link>
        }
      />

      {/* Filters + search + view toggle */}
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

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
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
          <div className="hidden shrink-0 gap-1 rounded-xl bg-slate-100 p-1 sm:flex">
            <button
              type="button"
              onClick={() => setView("table")}
              title="Table view"
              className={`rounded-lg p-2 transition ${
                view === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="clipboardList" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              title="Card view"
              className={`rounded-lg p-2 transition ${
                view === "cards" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon name="dashboard" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasAny={issues.length > 0} newPath={`${basePath}/new`} />
      ) : (
        <>
          {/* Desktop: professional table (or card grid if toggled) */}
          <div className="hidden sm:block">
            {view === "table" ? (
              <IssueTable issues={filtered} onOpen={(id) => navigate(`${basePath}/${id}`)} />
            ) : (
              <CardGrid issues={filtered} onOpen={(id) => navigate(`${basePath}/${id}`)} />
            )}
          </div>
          {/* Mobile: always cards */}
          <div className="sm:hidden">
            <CardGrid issues={filtered} onOpen={(id) => navigate(`${basePath}/${id}`)} />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ hasAny, newPath }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="alert" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No issues match this filter" : "No issues here yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny
          ? "Try a different filter or clear your search."
          : "Once you report a facility issue it'll show up in this list with its live status."}
      </p>
      {!hasAny && (
        <Link
          to={newPath}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Raise an Issue
        </Link>
      )}
    </div>
  );
}

function IssueTable({ issues, onOpen }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Issue ID</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Booking</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned Worker</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Last Updated</th>
              <th className="px-4 py-3" />
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
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{issue.bookingId}</td>
                <td className="px-4 py-3 text-slate-600">{issue.category}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={issue.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={issue.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">{issue.assignedWorker || "Unassigned"}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                  {formatDateTime(issue.createdDate)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">
                  {formatDateTime(issue.lastUpdated)}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                    View
                    <Icon name="chevronRight" className="h-3.5 w-3.5" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardGrid({ issues, onOpen }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {issues.map((issue) => (
        <button
          key={issue.id}
          type="button"
          onClick={() => onOpen(issue.id)}
          className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{issue.id}</p>
              <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{issue.category}</h3>
              <p className="truncate text-xs text-slate-500">{issue.roomName}</p>
            </div>
            <StatusBadge status={issue.status} />
          </div>

          <p className="mb-3 line-clamp-2 text-xs text-slate-500">{issue.description}</p>

          {issue.photo && (
            <img src={issue.photo.dataUrl} alt={issue.photo.name} className="mb-3 h-24 w-full rounded-lg object-cover" />
          )}

          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Icon name="wrench" className="h-3.5 w-3.5 text-slate-400" />
            {issue.assignedWorker || "Unassigned"}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
            <StatusBadge status={issue.priority} />
            <span className="text-[11px] text-slate-400">{formatDateTime(issue.createdDate)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}
