import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import ResolveIssueModal from "../../components/issues/ResolveIssueModal";
import AssignWorkerModal from "../../components/issues/AssignWorkerModal";
import SelectFieldModal from "../../components/issues/SelectFieldModal";
import BlockRoomModal from "../../components/issues/BlockRoomModal";
import {
  ISSUE_STATUS,
  ISSUES_EVENT,
  PRIORITY_ORDER,
  getIssuesForAdmin,
  assignWorkerToIssue,
  autoAssignIssue,
  changeIssuePriority,
  changeIssueStatus,
  resolveIssueByAdmin,
  reopenIssue,
  blockRoomForIssue,
  isIssueOverdue,
} from "../../utils/issueStorage";
import { blockRoom as persistRoomBlock, unblockRoom as persistRoomUnblock, isRoomBlocked } from "../../utils/roomStatusStorage";

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

function formatDateOnly(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY_FILTERS = { status: "All", priority: "All", category: "All", room: "All", worker: "All", date: "" };

export default function AdminIssues() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  // Modal state — one shared "active action" so only ever one modal is open.
  const [assignTarget, setAssignTarget] = useState(null); // issue
  const [priorityTarget, setPriorityTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setIssues(getIssuesForAdmin());
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    refresh();
    window.addEventListener(ISSUES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(ISSUES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filterOptions = useMemo(() => {
    const categories = new Set();
    const rooms = new Set();
    const workers = new Set();
    issues.forEach((i) => {
      if (i.category) categories.add(i.category);
      if (i.roomName) rooms.add(i.roomName);
      if (i.assignedWorker) workers.add(i.assignedWorker);
    });
    return {
      categories: Array.from(categories).sort(),
      rooms: Array.from(rooms).sort(),
      workers: Array.from(workers).sort(),
    };
  }, [issues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return issues.filter((issue) => {
      if (filters.status !== "All" && issue.status !== filters.status) return false;
      if (filters.priority !== "All" && issue.priority !== filters.priority) return false;
      if (filters.category !== "All" && issue.category !== filters.category) return false;
      if (filters.room !== "All" && issue.roomName !== filters.room) return false;
      if (filters.worker !== "All") {
        if (filters.worker === "Unassigned") {
          if (issue.assignedWorker) return false;
        } else if (issue.assignedWorker !== filters.worker) {
          return false;
        }
      }
      if (filters.date) {
        const issueDate = issue.createdDate ? issue.createdDate.slice(0, 10) : "";
        if (issueDate !== filters.date) return false;
      }
      if (!q) return true;
      return (
        issue.id.toLowerCase().includes(q) ||
        issue.roomName?.toLowerCase().includes(q) ||
        issue.employeeName?.toLowerCase().includes(q)
      );
    });
  }, [issues, filters, query]);

  const filtersActive =
    query.trim() !== "" || Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  // --- Action handlers -------------------------------------------------

  function handleAssignSubmit({ worker, department }) {
    setBusy(true);
    setTimeout(() => {
      const wasAssigned = !!assignTarget.assignedWorkerId;
      assignWorkerToIssue(assignTarget.id, { worker, department, adminName: user.name });
      setBusy(false);
      setAssignTarget(null);
      setToast(`${assignTarget.id} ${wasAssigned ? "reassigned to" : "assigned to"} ${worker.name}.`);
      refresh();
    }, 400);
  }

  function handleAutoAssign(issue) {
    setBusy(true);
    setTimeout(() => {
      const result = autoAssignIssue(issue.id);
      setBusy(false);
      setToast(
        result
          ? `${issue.id} automatically assigned to ${result.worker.name} (${result.department}).`
          : `${issue.id}: no workers available in the routed department.`
      );
      refresh();
    }, 400);
  }

  function handlePrioritySubmit(newPriority) {
    setBusy(true);
    setTimeout(() => {
      changeIssuePriority(priorityTarget.id, newPriority, user.name);
      setBusy(false);
      setPriorityTarget(null);
      setToast(`${priorityTarget.id} priority set to ${newPriority}.`);
      refresh();
    }, 300);
  }

  function handleStatusSubmit(newStatus) {
    setBusy(true);
    setTimeout(() => {
      changeIssueStatus(statusTarget.id, newStatus, user.name);
      setBusy(false);
      setStatusTarget(null);
      setToast(`${statusTarget.id} status changed to ${newStatus.replace(/_/g, " ")}.`);
      refresh();
    }, 300);
  }

  function handleBlockSubmit({ reason }) {
    setBusy(true);
    setTimeout(() => {
      persistRoomBlock({
        roomId: blockTarget.roomId,
        roomName: blockTarget.roomName,
        reason,
        relatedIssueId: blockTarget.id,
        blockedBy: user.name,
      });
      blockRoomForIssue(blockTarget.id, {
        roomId: blockTarget.roomId,
        roomName: blockTarget.roomName,
        reason,
        adminName: user.name,
      });
      setBusy(false);
      setBlockTarget(null);
      setToast(`${blockTarget.roomName} blocked for maintenance.`);
      refresh();
    }, 350);
  }

  function handleUnblockConfirm() {
    setBusy(true);
    setTimeout(() => {
      persistRoomUnblock(unblockTarget.roomId);
      setBusy(false);
      setToast(`${unblockTarget.roomName} is available again.`);
      setUnblockTarget(null);
      refresh();
    }, 300);
  }

  function handleResolveSubmit({ resolutionDescription, resolutionPhoto }) {
    setBusy(true);
    setTimeout(() => {
      resolveIssueByAdmin(resolveTarget.id, user.name, {
        resolutionNotes: resolutionDescription,
        resolutionPhoto,
      });
      setBusy(false);
      setResolveTarget(null);
      setToast(`${resolveTarget.id} marked as Resolved.`);
      refresh();
    }, 400);
  }

  function handleReopenConfirm() {
    setBusy(true);
    setTimeout(() => {
      reopenIssue(reopenTarget.id, user.name);
      setBusy(false);
      setReopenTarget(null);
      setToast(`${reopenTarget.id} reopened.`);
      refresh();
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Issue Management"
        description="Every issue reported across the park — assign workers, track progress, and resolve."
      />

      <Filters
        filters={filters}
        setFilters={setFilters}
        query={query}
        setQuery={setQuery}
        options={filterOptions}
        onReset={resetFilters}
        active={filtersActive}
      />

      {filtered.length === 0 ? (
        <EmptyState hasAny={issues.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden lg:block">
            <IssueTable
              issues={filtered}
              onOpen={(id) => navigate(`/admin/issues/${id}`)}
              onAssign={setAssignTarget}
              onAutoAssign={handleAutoAssign}
              onPriority={setPriorityTarget}
              onStatus={setStatusTarget}
              onBlock={setBlockTarget}
              onUnblock={setUnblockTarget}
              onResolve={setResolveTarget}
              onReopen={setReopenTarget}
            />
          </div>
          <div className="grid gap-4 lg:hidden">
            {filtered.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onOpen={() => navigate(`/admin/issues/${issue.id}`)}
                onAssign={() => setAssignTarget(issue)}
                onAutoAssign={() => handleAutoAssign(issue)}
                onPriority={() => setPriorityTarget(issue)}
                onStatus={() => setStatusTarget(issue)}
                onBlock={() => setBlockTarget(issue)}
                onUnblock={() => setUnblockTarget(issue)}
                onResolve={() => setResolveTarget(issue)}
                onReopen={() => setReopenTarget(issue)}
              />
            ))}
          </div>
        </>
      )}

      <AssignWorkerModal
        open={!!assignTarget}
        issue={assignTarget}
        busy={busy}
        onSubmit={handleAssignSubmit}
        onCancel={() => setAssignTarget(null)}
      />

      <SelectFieldModal
        open={!!priorityTarget}
        icon="tag"
        title="Change Priority"
        issueId={priorityTarget?.id}
        label="Priority"
        options={PRIORITY_ORDER}
        value={priorityTarget?.priority}
        busy={busy}
        submitLabel="Save Priority"
        onSubmit={handlePrioritySubmit}
        onCancel={() => setPriorityTarget(null)}
      />

      <SelectFieldModal
        open={!!statusTarget}
        icon="listChecks"
        title="Change Status"
        issueId={statusTarget?.id}
        label="Status"
        options={STATUS_OPTIONS}
        value={statusTarget?.status}
        busy={busy}
        submitLabel="Save Status"
        onSubmit={handleStatusSubmit}
        onCancel={() => setStatusTarget(null)}
      />

      <BlockRoomModal
        open={!!blockTarget}
        issue={blockTarget}
        busy={busy}
        onSubmit={handleBlockSubmit}
        onCancel={() => setBlockTarget(null)}
      />

      <ResolveIssueModal
        open={!!resolveTarget}
        issueId={resolveTarget?.id}
        busy={busy}
        onSubmit={handleResolveSubmit}
        onCancel={() => setResolveTarget(null)}
      />

      <ConfirmDialog
        open={!!reopenTarget}
        title="Reopen this issue?"
        message={`${reopenTarget?.id} will move back to Reopened and can be assigned again. Its previous resolution details are kept.`}
        confirmLabel="Reopen Issue"
        busy={busy}
        onConfirm={handleReopenConfirm}
        onCancel={() => setReopenTarget(null)}
      />

      <ConfirmDialog
        open={!!unblockTarget}
        title="Unblock this room?"
        message={`${unblockTarget?.roomName} will be marked AVAILABLE and can be booked again immediately. If the issue that caused this block (${unblockTarget?.id}) is still unresolved, consider resolving it first.`}
        confirmLabel="Unblock Room"
        busy={busy}
        onConfirm={handleUnblockConfirm}
        onCancel={() => setUnblockTarget(null)}
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

function Filters({ filters, setFilters, query, setQuery, options, onReset, active }) {
  function set(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={["All", ...STATUS_OPTIONS]} />
          <Select
            label="Priority"
            value={filters.priority}
            onChange={(v) => set("priority", v)}
            options={["All", ...PRIORITY_ORDER]}
          />
          <Select
            label="Category"
            value={filters.category}
            onChange={(v) => set("category", v)}
            options={["All", ...options.categories]}
          />
          <Select label="Room" value={filters.room} onChange={(v) => set("room", v)} options={["All", ...options.rooms]} />
          <Select
            label="Worker"
            value={filters.worker}
            onChange={(v) => set("worker", v)}
            options={["All", "Unassigned", ...options.workers]}
          />
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issue ID, room, reporter…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {active && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 sm:self-auto"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {String(opt).replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ hasAny, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="alert" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No issues match your filters" : "No issues reported yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny
          ? "Try clearing filters or searching for something else."
          : "Once clients or employees report facility issues, they'll show up here."}
      </p>
      {hasAny && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function ActionMenu({ issue, onAssign, onAutoAssign, onPriority, onStatus, onBlock, onUnblock, onResolve, onReopen }) {
  const [open, setOpen] = useState(false);
  const isAssigned = !!issue.assignedWorkerId;
  const canResolve = issue.status === ISSUE_STATUS.IN_PROGRESS || issue.status === ISSUE_STATUS.ASSIGNED;
  const canReopen = issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;
  const roomBlocked = isRoomBlocked(issue.roomId);

  const items = [
    { key: "assign", label: isAssigned ? "Reassign" : "Assign", icon: isAssigned ? "usersSmall" : "wrench", onClick: onAssign },
    { key: "autoAssign", label: "Auto Assign", icon: "zap", onClick: onAutoAssign },
    { key: "priority", label: "Change Priority", icon: "tag", onClick: onPriority },
    { key: "status", label: "Change Status", icon: "listChecks", onClick: onStatus },
    roomBlocked
      ? { key: "unblock", label: "Unblock Room", icon: "checkCircle", onClick: onUnblock }
      : { key: "block", label: "Block Room", icon: "ban", onClick: onBlock },
    canResolve && { key: "resolve", label: "Resolve", icon: "checkCircle", onClick: onResolve },
    canReopen && { key: "reopen", label: "Reopen", icon: "alert", onClick: onReopen },
  ].filter(Boolean);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
      >
        Actions
        <Icon name="chevronDown" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-full z-20 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick(issue.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <Icon name={item.icon} className="h-3.5 w-3.5 text-slate-400" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function IssueTable({ issues, onOpen, onAssign, onAutoAssign, onPriority, onStatus, onBlock, onUnblock, onResolve, onReopen }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Issue ID</th>
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Reporter</th>
              <th className="px-4 py-3">Assigned Worker</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created Date</th>
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
                <td className="px-4 py-3 text-slate-500">{issue.employeeName || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{issue.assignedWorker || "Unassigned"}</td>
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
                <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400">{formatDateOnly(issue.createdDate)}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen(issue.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      View
                    </button>
                    <ActionMenu
                      issue={issue}
                      onAssign={() => onAssign(issue)}
                      onAutoAssign={() => onAutoAssign(issue)}
                      onPriority={() => onPriority(issue)}
                      onStatus={() => onStatus(issue)}
                      onBlock={() => onBlock(issue)}
                      onUnblock={() => onUnblock(issue)}
                      onResolve={() => onResolve(issue)}
                      onReopen={() => onReopen(issue)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueCard({ issue, onOpen, onAssign, onAutoAssign, onPriority, onStatus, onBlock, onUnblock, onResolve, onReopen }) {
  const isAssigned = !!issue.assignedWorkerId;
  const canResolve = issue.status === ISSUE_STATUS.IN_PROGRESS || issue.status === ISSUE_STATUS.ASSIGNED;
  const canReopen = issue.status === ISSUE_STATUS.RESOLVED || issue.status === ISSUE_STATUS.CLOSED;
  const roomBlocked = isRoomBlocked(issue.roomId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onOpen} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{issue.id}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{issue.category}</h3>
          <p className="truncate text-xs text-slate-500">{issue.roomName}</p>
        </div>
        <StatusBadge status={issue.status} />
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span>{issue.employeeName || "—"}</span>
        <StatusBadge status={issue.priority} />
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="wrench" className="h-3.5 w-3.5 text-slate-400" />
        {issue.assignedWorker || "Unassigned"}
      </div>

      <p className="mb-3 text-[11px] text-slate-400">{formatDateTime(issue.createdDate)}</p>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <ActionButton label={isAssigned ? "Reassign" : "Assign"} icon={isAssigned ? "usersSmall" : "wrench"} onClick={onAssign} />
        <ActionButton label="Auto Assign" icon="zap" onClick={onAutoAssign} />
        <ActionButton label="Priority" icon="tag" onClick={onPriority} />
        <ActionButton label="Status" icon="listChecks" onClick={onStatus} />
        {roomBlocked ? (
          <ActionButton label="Unblock Room" icon="checkCircle" onClick={onUnblock} highlight="emerald" />
        ) : (
          <ActionButton label="Block Room" icon="ban" onClick={onBlock} />
        )}
        {canResolve && <ActionButton label="Resolve" icon="checkCircle" onClick={onResolve} highlight="emerald" />}
        {canReopen && <ActionButton label="Reopen" icon="alert" onClick={onReopen} highlight="orange" />}
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, highlight }) {
  const style =
    highlight === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : highlight === "orange"
        ? "bg-orange-500 text-white hover:bg-orange-600"
        : "border border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${style}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
