import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { useNotifications } from "../../hooks/useNotifications";
import { NOTIFICATION_META, formatRelativeTime } from "../../utils/notificationStorage";
import {
  ISSUE_STATUS,
  PRIORITY,
  ISSUES_EVENT,
  getIssuesForWorker,
  isIssueOverdue,
  isResolvedToday,
  seedWorkerIssuesIfEmpty,
  startWork,
} from "../../utils/issueStorage";

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const QUEUE_PRIORITY_ORDER = [PRIORITY.CRITICAL, PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW];

function queuePriority(issue) {
  const value = String(issue.priority || "").trim().toUpperCase();
  return QUEUE_PRIORITY_ORDER.find((priority) => value === priority || value.includes(priority)) || null;
}

function newestFirst(issues) {
  return [...issues].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [startingId, setStartingId] = useState(null);
  const [toast, setToast] = useState("");

  function refresh() {
    setIssues(getIssuesForWorker(user.id));
  }

  useEffect(() => {
    seedWorkerIssuesIfEmpty(user.id, user.name);
    refresh();
    window.addEventListener(ISSUES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ISSUES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const activeIssues = useMemo(
    () => issues.filter((i) => i.status === ISSUE_STATUS.ASSIGNED || i.status === ISSUE_STATUS.IN_PROGRESS),
    [issues]
  );

  const queueIssues = useMemo(
    () => issues.filter((i) => i.status !== ISSUE_STATUS.RESOLVED && i.status !== ISSUE_STATUS.CLOSED),
    [issues]
  );

  const stats = useMemo(() => {
    const newIssues = issues.filter((i) => i.status === ISSUE_STATUS.ASSIGNED);
    const inProgress = issues.filter((i) => i.status === ISSUE_STATUS.IN_PROGRESS);
    const highPriority = activeIssues.filter(
      (i) => i.priority === PRIORITY.HIGH || i.priority === PRIORITY.CRITICAL
    );
    const overdue = activeIssues.filter(isIssueOverdue);
    const resolvedToday = issues.filter(isResolvedToday);

    return [
      { label: "New Issues", value: newIssues.length, icon: "megaphone", tone: "bg-rose-50 text-rose-600" },
      { label: "Assigned Issues", value: activeIssues.length, icon: "listChecks", tone: "bg-indigo-50 text-indigo-600" },
      { label: "In Progress", value: inProgress.length, icon: "clock", tone: "bg-amber-50 text-amber-600" },
      { label: "High Priority", value: highPriority.length, icon: "alert", tone: "bg-orange-50 text-orange-600" },
      { label: "Overdue", value: overdue.length, icon: "ban", tone: "bg-rose-50 text-rose-600" },
      { label: "Resolved Today", value: resolvedToday.length, icon: "checkCircle", tone: "bg-emerald-50 text-emerald-600" },
    ];
  }, [issues, activeIssues]);

  const queue = useMemo(
    () => [
      ...QUEUE_PRIORITY_ORDER.flatMap((priority) => newestFirst(queueIssues.filter((issue) => queuePriority(issue) === priority))),
      ...newestFirst(queueIssues.filter((issue) => queuePriority(issue) === null)),
    ].slice(0, 5),
    [queueIssues]
  );

  function handleStartWork(issue) {
    setStartingId(issue.id);
    setTimeout(() => {
      startWork(issue.id, user);
      setStartingId(null);
      setToast(`${issue.id} moved to In Progress.`);
      refresh();
    }, 350);
  }

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Your assigned issue queue, at a glance — priority, ageing, and what still needs work."
        actions={
          <Link
            to="/worker/issues"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="alert" className="h-4 w-4" />
            View My Issues
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}>
              <Icon name={s.icon} className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs font-medium text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Priority queue */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Your Priority Queue</h2>
          <Link to="/worker/issues" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View all
          </Link>
        </div>

        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Icon name="checkCircle" className="h-5 w-5" />
            </div>
            <p className="text-xs text-slate-500">You're all caught up — nothing active right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((issue) => (
              <div
                key={issue.id}
                onClick={() => navigate(`/worker/issues/${issue.id}`)}
                className="flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-400">{issue.id}</span>
                    <StatusBadge status={issue.priority} />
                    <StatusBadge status={issue.status} />
                    {isIssueOverdue(issue) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                        <Icon name="alert" className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-slate-800">
                    {issue.category} &middot; {issue.roomName}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(issue.createdDate)}</p>
                </div>

                {issue.status === ISSUE_STATUS.ASSIGNED && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartWork(issue);
                    }}
                    disabled={startingId === issue.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 sm:self-center"
                  >
                    <Icon name="clock" className="h-3.5 w-3.5" />
                    {startingId === issue.id ? "Starting…" : "Start Work"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications addressed to this worker */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Notifications</h2>
          <Link to="/worker/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
            View all
          </Link>
        </div>
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-400">No notifications yet.</p>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 4).map((notification) => {
              const meta = NOTIFICATION_META[notification.type] || { icon: "bell", color: "text-slate-600 bg-slate-100" };
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (!notification.read) markAsRead(notification.id);
                    if (notification.relatedType === "issue" && notification.relatedId) {
                      navigate(`/worker/issues/${notification.relatedId}`);
                    } else {
                      navigate("/worker/notifications");
                    }
                  }}
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-100 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs ${notification.read ? "font-medium text-slate-600" : "font-semibold text-slate-900"}`}>
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-[11px] text-slate-400">{formatRelativeTime(notification.createdAt)}</span>
                  </span>
                  {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

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
