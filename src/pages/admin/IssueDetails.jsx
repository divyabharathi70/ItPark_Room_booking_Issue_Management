import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import IssueTimeline from "../../components/issues/IssueTimeline";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import ResolveIssueModal from "../../components/issues/ResolveIssueModal";
import AssignWorkerModal from "../../components/issues/AssignWorkerModal";
import SelectFieldModal from "../../components/issues/SelectFieldModal";
import BlockRoomModal from "../../components/issues/BlockRoomModal";
import {
  ISSUE_STATUS,
  PRIORITY_ORDER,
  getIssueById,
  assignWorkerToIssue,
  autoAssignIssue,
  getActiveWorkloadForWorker,
  changeIssuePriority,
  changeIssueStatus,
  resolveIssueByAdmin,
  reopenIssue,
  blockRoomForIssue,
  isIssueOverdue,
} from "../../utils/issueStorage";
import { blockRoom as persistRoomBlock, getRoomBlock } from "../../utils/roomStatusStorage";

const STATUS_OPTIONS = Object.values(ISSUE_STATUS);

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

export default function AdminIssueDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [issue, setIssue] = useState(undefined); // undefined = loading, null = not found
  const [roomBlock, setRoomBlock] = useState(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  function refresh() {
    const found = getIssueById(id);
    setIssue(found || null);
    if (found?.roomId) setRoomBlock(getRoomBlock(found.roomId));
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

  if (issue === null) {
    return (
      <div>
        <PageHeader title="Issue Not Found" />
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="alert" className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h2 className="text-base font-semibold text-slate-900">This issue doesn't exist</h2>
          <Link
            to="/admin/issues"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Back to Issue Management
          </Link>
        </div>
      </div>
    );
  }

  const isAssigned = !!issue.assignedWorkerId;
  const canResolve = issue.status === ISSUE_STATUS.IN_PROGRESS || issue.status === ISSUE_STATUS.ASSIGNED;
  const canReopen = issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;

  function handleAssignSubmit({ worker, department }) {
    setBusy(true);
    setTimeout(() => {
      assignWorkerToIssue(issue.id, { worker, department, adminName: user.name });
      setBusy(false);
      setAssignOpen(false);
      setToast(`${isAssigned ? "Reassigned to" : "Assigned to"} ${worker.name}.`);
      refresh();
    }, 400);
  }

  function handleAutoAssign() {
    setBusy(true);
    setTimeout(() => {
      const result = autoAssignIssue(issue.id);
      setBusy(false);
      if (result) {
        setToast(
          `Automatically assigned to ${result.worker.name} (${result.department}) — current active work: ${getActiveWorkloadForWorker(result.worker.id)}.`
        );
      } else {
        setToast("No workers available in the routed department for auto assignment.");
      }
      refresh();
    }, 400);
  }

  function handlePrioritySubmit(newPriority) {
    setBusy(true);
    setTimeout(() => {
      changeIssuePriority(issue.id, newPriority, user.name);
      setBusy(false);
      setPriorityOpen(false);
      setToast(`Priority set to ${newPriority}.`);
      refresh();
    }, 300);
  }

  function handleStatusSubmit(newStatus) {
    setBusy(true);
    setTimeout(() => {
      changeIssueStatus(issue.id, newStatus, user.name);
      setBusy(false);
      setStatusOpen(false);
      setToast(`Status changed to ${newStatus.replace(/_/g, " ")}.`);
      refresh();
    }, 300);
  }

  function handleBlockSubmit({ reason }) {
    setBusy(true);
    setTimeout(() => {
      persistRoomBlock({
        roomId: issue.roomId,
        roomName: issue.roomName,
        reason,
        relatedIssueId: issue.id,
        blockedBy: user.name,
      });
      blockRoomForIssue(issue.id, { roomId: issue.roomId, roomName: issue.roomName, reason, adminName: user.name });
      setBusy(false);
      setBlockOpen(false);
      setToast(`${issue.roomName} blocked for maintenance.`);
      refresh();
    }, 350);
  }

  function handleResolveSubmit({ resolutionDescription, resolutionPhoto }) {
    setBusy(true);
    setTimeout(() => {
      resolveIssueByAdmin(issue.id, user.name, { resolutionNotes: resolutionDescription, resolutionPhoto });
      setBusy(false);
      setResolveOpen(false);
      setToast("Issue marked as Resolved.");
      refresh();
    }, 400);
  }

  function handleReopenConfirm() {
    setBusy(true);
    setTimeout(() => {
      reopenIssue(issue.id, user.name);
      setBusy(false);
      setReopenOpen(false);
      setToast("Issue reopened.");
      refresh();
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title={`Issue ${issue.id}`}
        description={issue.category}
        actions={
          <Link
            to="/admin/issues"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Icon name="chevronLeft" className="h-4 w-4" />
            Back to Issue Management
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
              {isIssueOverdue(issue) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600 ring-1 ring-inset ring-rose-200">
                  <Icon name="alert" className="h-3 w-3" />
                  Overdue
                </span>
              )}
              {roomBlock?.blocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-white">
                  <Icon name="ban" className="h-3 w-3" />
                  Room Blocked
                </span>
              )}
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <DetailRow label="Issue ID" value={issue.id} mono />
              <DetailRow label="Room" value={issue.roomName} />
              <DetailRow label="Booking" value={issue.bookingId || "—"} mono />
              <DetailRow label="Category" value={`${issue.categoryGroup || ""} · ${issue.category}`} />
              <DetailRow label="Priority" value={issue.priority} />
              <DetailRow label="Reporter" value={issue.employeeName || "—"} />
              <DetailRow label="Assigned Worker" value={issue.assignedWorker || "Not yet assigned"} />
              <DetailRow label="Assigned Department" value={issue.assignedDepartment || "—"} />
              <DetailRow
                label="Assignment Method"
                value={issue.assignmentMethod === "AUTO" ? "Automatic" : issue.assignmentMethod === "MANUAL" ? "Manual" : "—"}
              />
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
                <img src={issue.photo.dataUrl} alt={issue.photo.name} className="h-56 w-full rounded-xl object-cover" />
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Resolution Notes</p>
              {issue.resolutionNotes ? (
                <>
                  <p className="text-sm leading-relaxed text-slate-700">{issue.resolutionNotes}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {issue.resolvedBy && `Resolved by ${issue.resolvedBy}`}
                    {issue.resolvedAt && ` · ${formatDateTime(issue.resolvedAt)}`}
                  </p>
                </>
              ) : (
                <p className="text-sm italic text-slate-400">No resolution notes yet.</p>
              )}
              {issue.resolutionPhoto && (
                <img
                  src={issue.resolutionPhoto.dataUrl}
                  alt={issue.resolutionPhoto.name}
                  className="mt-3 h-56 w-full rounded-xl object-cover"
                />
              )}
            </div>

            {roomBlock?.blocked && (
              <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-600">
                  <Icon name="ban" className="h-3.5 w-3.5" />
                  Room Currently Blocked
                </p>
                <p className="text-sm text-rose-700">{roomBlock.reason}</p>
                <p className="mt-1 text-xs text-rose-400">
                  {roomBlock.blockedBy && `By ${roomBlock.blockedBy}`}
                  {roomBlock.blockedAt && ` · ${formatDateTime(roomBlock.blockedAt)}`}
                </p>
              </div>
            )}

            {/* Admin actions */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <ActionButton
                label={isAssigned ? "Reassign Worker" : "Assign Worker"}
                icon={isAssigned ? "usersSmall" : "wrench"}
                onClick={() => setAssignOpen(true)}
                primary
              />
              <ActionButton label="Auto Assign" icon="zap" onClick={handleAutoAssign} />
              <ActionButton label="Change Priority" icon="tag" onClick={() => setPriorityOpen(true)} />
              <ActionButton label="Change Status" icon="listChecks" onClick={() => setStatusOpen(true)} />
              <ActionButton label="Block Room" icon="ban" onClick={() => setBlockOpen(true)} />
              {canResolve && (
                <ActionButton label="Resolve" icon="checkCircle" onClick={() => setResolveOpen(true)} tone="emerald" />
              )}
              {canReopen && <ActionButton label="Reopen" icon="alert" onClick={() => setReopenOpen(true)} tone="orange" />}
            </div>
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

      <AssignWorkerModal open={assignOpen} issue={issue} busy={busy} onSubmit={handleAssignSubmit} onCancel={() => setAssignOpen(false)} />

      <SelectFieldModal
        open={priorityOpen}
        icon="tag"
        title="Change Priority"
        issueId={issue.id}
        label="Priority"
        options={PRIORITY_ORDER}
        value={issue.priority}
        busy={busy}
        submitLabel="Save Priority"
        onSubmit={handlePrioritySubmit}
        onCancel={() => setPriorityOpen(false)}
      />

      <SelectFieldModal
        open={statusOpen}
        icon="listChecks"
        title="Change Status"
        issueId={issue.id}
        label="Status"
        options={STATUS_OPTIONS}
        value={issue.status}
        busy={busy}
        submitLabel="Save Status"
        onSubmit={handleStatusSubmit}
        onCancel={() => setStatusOpen(false)}
      />

      <BlockRoomModal open={blockOpen} issue={issue} busy={busy} onSubmit={handleBlockSubmit} onCancel={() => setBlockOpen(false)} />

      <ResolveIssueModal
        open={resolveOpen}
        issueId={issue.id}
        busy={busy}
        onSubmit={handleResolveSubmit}
        onCancel={() => setResolveOpen(false)}
      />

      <ConfirmDialog
        open={reopenOpen}
        title="Reopen this issue?"
        message="This issue will move back to Reopened and can be assigned again. Its previous resolution details are kept."
        confirmLabel="Reopen Issue"
        busy={busy}
        onConfirm={handleReopenConfirm}
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

function ActionButton({ label, icon, onClick, primary = false, tone }) {
  const style = primary
    ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
    : tone === "emerald"
      ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
      : tone === "orange"
        ? "bg-orange-500 text-white shadow-sm hover:bg-orange-600"
        : "border border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${style}`}
    >
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </button>
  );
}
