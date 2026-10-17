import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { getIssuesForEmployee, ISSUE_STATUS } from "../../utils/issueStorage";

function formatDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    setIssues(getIssuesForEmployee(user.id));
  }, [user.id]);

  const openIssues = useMemo(() => issues.filter((i) => i.status === ISSUE_STATUS.OPEN), [issues]);
  const inProgressIssues = useMemo(() => issues.filter((i) => i.status === ISSUE_STATUS.IN_PROGRESS), [issues]);
  const resolvedIssues = useMemo(
    () => issues.filter((i) => i.status === ISSUE_STATUS.RESOLVED || i.status === ISSUE_STATUS.CLOSED),
    [issues]
  );

  const stats = [
    { label: "Total Issues", value: issues.length, icon: "clipboardList", tone: "bg-indigo-50 text-indigo-600" },
    { label: "Open Issues", value: openIssues.length, icon: "alert", tone: "bg-rose-50 text-rose-600" },
    { label: "In Progress", value: inProgressIssues.length, icon: "clock", tone: "bg-amber-50 text-amber-600" },
    { label: "Resolved Issues", value: resolvedIssues.length, icon: "checkCircle", tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Raise and track the facility issues you've reported."
        actions={
          <Link
            to="/employee/issues/new"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="megaphone" className="h-4 w-4" />
            Raise Issue
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent issues */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Recent Issues</h2>
              <Link to="/employee/issues" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View all
              </Link>
            </div>

            {issues.length === 0 ? (
              <EmptyRow icon="alert" text="You haven't raised any issues yet." cta="Raise an Issue" to="/employee/issues/new" />
            ) : (
              <div className="space-y-3">
                {issues.slice(0, 6).map((issue) => (
                  <div
                    key={issue.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {issue.category} &middot; {issue.roomName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-mono">{issue.id}</span>
                        <span>&middot;</span>
                        <span>{formatDateShort(issue.createdDate)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={issue.priority} />
                      <StatusBadge status={issue.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                to="/employee/issues/new"
                className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon name="megaphone" className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Raise Issue</p>
                  <p className="text-xs text-slate-500">Report a facility problem</p>
                </div>
              </Link>
              <Link
                to="/employee/issues"
                className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 transition hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Icon name="alert" className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">My Issues</p>
                  <p className="text-xs text-slate-500">Track everything you've reported</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyRow({ icon, text, cta, to }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-xs text-slate-500">{text}</p>
      {cta && (
        <Link to={to} className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          {cta} →
        </Link>
      )}
    </div>
  );
}
