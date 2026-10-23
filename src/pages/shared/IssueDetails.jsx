import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import IssueTimeline from "../../components/issues/IssueTimeline";
import { ROLES } from "../../data/mockUsers";
import { getIssueById, getIssuesForClient, updateIssue, ISSUE_STATUS } from "../../utils/issueStorage";

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

export default function IssueDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const basePath = `/${user.role}/issues`;

  const [issue, setIssue] = useState(undefined); // undefined = loading, null = not found
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [toast, setToast] = useState("");

  function refresh() {
    const found = getIssueById(id);
    setIssue(found || null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (issue === undefined) return null;

  const clientId = user.clientId || (user.role === ROLES.CLIENT ? user.id : null);
  const canView = issue && (issue.employeeId === user.id || (clientId && getIssuesForClient(clientId).some((item) => item.id === issue.id)));
  if (!canView) {
    return (
      <div>
        <PageHeader title="Issue Not Found" />
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="alert" className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h2 className="text-base font-semibold text-slate-900">This issue isn't available</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            It may not exist, or it doesn't belong to your account.
          </p>
          <Link
            to={basePath}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Back to My Issues
          </Link>
        </div>
      </div>
    );
  }

  const canReopen = issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;

  function confirmReopen() {
    setReopening(true);
    setTimeout(() => {
      updateIssue(issue.id, {
        status: ISSUE_STATUS.REOPENED,
        statusNote: `Reopened by ${user.name}.`,
      });
      setReopening(false);
      setReopenOpen(false);
      setToast("Issue reopened.");
      refresh();
    }, 400);
  }

  return (
    <div>
      <PageHeader
        title={`Issue ${issue.id}`}
        description={issue.category}
        actions={
          <Link
            to={basePath}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Back to My Issues
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge status={issue.status} />
              <StatusBadge status={issue.priority} />
              {issue.status === ISSUE_STATUS.REOPENED && (
                <span className="text-xs font-medium text-orange-600">
                  This issue was reopened after being marked {issue.statusHistory?.[issue.statusHistory.length - 2]?.status?.toLowerCase() || "resolved"}.
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <DetailRow label="Issue ID" value={issue.id} mono />
              <DetailRow label="Booking" value={issue.bookingId} mono />
              <DetailRow label="Room" value={issue.roomName} />
              <DetailRow label="Category" value={`${issue.categoryGroup || ""} · ${issue.category}`} />
              <DetailRow label="Assigned Worker" value={issue.assignedWorker || "Not yet assigned"} />
              <DetailRow label="Organization" value={issue.organization || "—"} />
              <DetailRow label="Created" value={formatDateTime(issue.createdDate)} />
              <DetailRow label="Last Updated" value={formatDateTime(issue.lastUpdated)} />
            </dl>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
              <p className="text-sm leading-relaxed text-slate-700">{issue.description}</p>
            </div>

            {issue.photo && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Uploaded Photo</p>
                <img
                  src={issue.photo.dataUrl}
                  alt={issue.photo.name}
                  className="h-56 w-full rounded-xl object-cover"
                />
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Resolution Notes</p>
              {issue.resolutionNotes ? (
                <p className="text-sm leading-relaxed text-slate-700">{issue.resolutionNotes}</p>
              ) : (
                <p className="text-sm italic text-slate-400">No resolution notes yet.</p>
              )}
            </div>

            {canReopen && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setReopenOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                >
                  <Icon name="alert" className="h-3.5 w-3.5" />
                  Reopen This Issue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Issue Timeline</p>
            <IssueTimeline issue={issue} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={reopenOpen}
        busy={reopening}
        title="Reopen this issue?"
        message="This will mark the issue as reopened so it can be picked up for another look."
        confirmLabel="Yes, reopen issue"
        cancelLabel="Never mind"
        onConfirm={confirmReopen}
        onCancel={() => setReopenOpen(false)}
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

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2.5 sm:border-0 sm:pb-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
