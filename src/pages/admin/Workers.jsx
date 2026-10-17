import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { MOCK_WORKERS, DEPARTMENTS } from "../../data/mockWorkers";
import { MOCK_USERS } from "../../data/mockUsers";
import { getAllIssues, ACTIVE_ISSUE_STATUSES, RESOLVED_ISSUE_STATUSES } from "../../utils/issueStorage";
import {
  getStaffOverride,
  isStaffActive,
  isStaffDeleted,
  setStaffActive,
  setStaffDeleted,
  updateStaffOverride,
  STAFF_OVERRIDES_EVENT,
} from "../../utils/staffOverridesStorage";
import { addCustomStaff, deleteCustomStaff, getCustomStaff, STAFF_ROLE } from "../../utils/customStaffStorage";

const EMPTY_FILTERS = { department: "All", status: "All" };

export default function AdminWorkers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  const [issues, setIssues] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [viewTarget, setViewTarget] = useState(null); // worker
  const [editTarget, setEditTarget] = useState(null); // worker
  const [statusTarget, setStatusTarget] = useState(null); // worker
  const [deleteTarget, setDeleteTarget] = useState(null); // worker
  const [addOpen, setAddOpen] = useState(false);

  function refresh() {
    setIssues(getAllIssues());
    setTick((t) => t + 1);
  }

  useEffect(() => {
    refresh();
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(STAFF_OVERRIDES_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(STAFF_OVERRIDES_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Suresh Kumar (u-004) is also the real "worker@park.com" login — pull his
  // contact email from the auth directory since it genuinely exists there.
  const loginEmailById = useMemo(() => {
    const map = {};
    MOCK_USERS.forEach((u) => {
      if (u.email) map[u.id] = u.email;
    });
    return map;
  }, []);

  const workers = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick; // dependency: recompute when an override changes
    const base = MOCK_WORKERS.map((w) => ({
      id: w.id,
      baseName: w.name,
      baseDepartment: w.department,
      baseEmail: loginEmailById[w.id] || null,
      isCustom: false,
    }));
    getCustomStaff(STAFF_ROLE.WORKER).forEach((c) => {
      base.push({
        id: c.id,
        baseName: c.name,
        baseDepartment: c.department,
        baseEmail: c.email,
        isCustom: true,
        custom: c,
      });
    });

    return base
      .filter((entry) => !isStaffDeleted(entry.id))
      .map((entry) => {
        const override = getStaffOverride(entry.id);
        const worker = {
          id: entry.id,
          name: override.name || entry.baseName,
          department: override.department || entry.baseDepartment,
        };
        const assigned = issues.filter((i) => i.assignedWorkerId === worker.id);
        const activeIssues = assigned.filter((i) => ACTIVE_ISSUE_STATUSES.includes(i.status));
        const resolvedIssues = assigned.filter((i) => RESOLVED_ISSUE_STATUSES.includes(i.status));
        return {
          worker,
          assigned,
          activeIssues,
          resolvedIssues,
          workload: activeIssues.length,
          active: isStaffActive(entry.id),
          email: override.email || entry.baseEmail || null,
          phone: override.phone || entry.custom?.phone || null,
          profilePicture: override.profilePicture || null,
          isCustom: entry.isCustom,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, tick, loginEmailById]);

  const stats = useMemo(() => {
    const totalWorkers = workers.length;
    const activeWorkers = workers.filter((w) => w.active).length;
    const availableWorkers = workers.filter((w) => w.active && w.workload === 0).length;
    const withTasks = workers.filter((w) => w.workload > 0).length;
    return [
      { label: "Total Workers", value: totalWorkers, icon: "wrench", tone: "indigo" },
      { label: "Active Workers", value: activeWorkers, icon: "checkCircle", tone: "emerald" },
      { label: "Available Workers", value: availableWorkers, icon: "user", tone: "slate" },
      { label: "Workers With Tasks", value: withTasks, icon: "listChecks", tone: "amber" },
    ];
  }, [workers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workers.filter((w) => {
      if (filters.department !== "All" && w.worker.department !== filters.department) return false;
      if (filters.status !== "All") {
        const wantActive = filters.status === "Active";
        if (w.active !== wantActive) return false;
      }
      if (!q) return true;
      return (
        w.worker.name.toLowerCase().includes(q) ||
        w.worker.id.toLowerCase().includes(q) ||
        (w.worker.department || "").toLowerCase().includes(q)
      );
    });
  }, [workers, filters, query]);

  const filtersActive = query.trim() !== "" || filters.department !== "All" || filters.status !== "All";

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function handleAddSubmit(data) {
    setBusy(true);
    setTimeout(() => {
      addCustomStaff(STAFF_ROLE.WORKER, data);
      setBusy(false);
      setAddOpen(false);
      setToast(`${data.name} was added.`);
      refresh();
    }, 300);
  }

  function handleEditSubmit(patch) {
    setBusy(true);
    setTimeout(() => {
      updateStaffOverride(editTarget.worker.id, patch);
      setBusy(false);
      setEditTarget(null);
      setToast(`${editTarget.worker.name}'s details were updated.`);
      refresh();
    }, 300);
  }

  function handleStatusConfirm() {
    setBusy(true);
    const nextActive = !statusTarget.active;
    setTimeout(() => {
      setStaffActive(statusTarget.worker.id, nextActive);
      setBusy(false);
      setToast(`${statusTarget.worker.name} ${nextActive ? "activated" : "deactivated"}.`);
      setStatusTarget(null);
      refresh();
    }, 300);
  }

  function handleDeleteConfirm() {
    setBusy(true);
    setTimeout(() => {
      if (deleteTarget.isCustom) {
        deleteCustomStaff(deleteTarget.worker.id);
      } else {
        setStaffDeleted(deleteTarget.worker.id, true);
      }
      setBusy(false);
      setToast(`${deleteTarget.worker.name} was deleted.`);
      setDeleteTarget(null);
      refresh();
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Workers"
        description="Manage facility workers and their assigned tasks."
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Add New Worker
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <Filters
        filters={filters}
        setFilters={setFilters}
        query={query}
        setQuery={setQuery}
        onReset={resetFilters}
        active={filtersActive}
      />

      {filtered.length === 0 ? (
        <EmptyState hasAny={workers.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Worker</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Workload</th>
                    <th className="px-4 py-3">Resolved</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => (
                    <tr
                      key={w.worker.id}
                      onClick={() => setViewTarget(w)}
                      className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{w.worker.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{w.worker.id}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{w.worker.department || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{w.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{w.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <ActiveStatusBadge active={w.active} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{w.workload} active</td>
                      <td className="px-4 py-3 text-slate-600">{w.resolvedIssues.length}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewTarget(w)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(w)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusTarget(w)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                              w.active
                                ? "bg-rose-600 text-white hover:bg-rose-700"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {w.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(w)}
                            aria-label="Delete worker"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:hidden">
            {filtered.map((w) => (
              <WorkerCard
                key={w.worker.id}
                data={w}
                onView={() => setViewTarget(w)}
                onEdit={() => setEditTarget(w)}
                onToggleStatus={() => setStatusTarget(w)}
                onDelete={() => setDeleteTarget(w)}
              />
            ))}
          </div>
        </>
      )}

      {viewTarget && (
        <WorkerDetailsModal
          data={viewTarget}
          onClose={() => setViewTarget(null)}
          onViewIssue={(id) => navigate(`/admin/issues/${id}`)}
          onEdit={() => {
            setEditTarget(viewTarget);
            setViewTarget(null);
          }}
        />
      )}

      <AddWorkerModal open={addOpen} busy={busy} onSubmit={handleAddSubmit} onCancel={() => setAddOpen(false)} />

      <EditWorkerModal
        key={editTarget?.worker.id || "none"}
        open={!!editTarget}
        data={editTarget}
        busy={busy}
        onSubmit={handleEditSubmit}
        onCancel={() => setEditTarget(null)}
      />

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? "Deactivate this worker?" : "Activate this worker?"}
        message={
          statusTarget?.active
            ? `${statusTarget?.worker.name} will be marked inactive and hidden from the "Active" worker pool. This only updates their admin status — it doesn't remove their ability to sign in.`
            : `${statusTarget?.worker.name} will be marked active again and available for new assignments.`
        }
        confirmLabel={statusTarget?.active ? "Deactivate" : "Activate"}
        danger={!!statusTarget?.active}
        busy={busy}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this worker?"
        message={
          deleteTarget?.isCustom
            ? `${deleteTarget?.worker.name} will be permanently removed from the worker directory.`
            : `${deleteTarget?.worker.name} will be removed from the admin worker directory. This doesn't affect their ability to sign in — it only hides them from this list and any assign-worker dropdowns.`
        }
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
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

function ActiveStatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${
        active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatCard({ icon, label, value, tone = "indigo" }) {
  const toneStyle =
    {
      indigo: "bg-indigo-50 text-indigo-600",
      amber: "bg-amber-50 text-amber-600",
      emerald: "bg-emerald-50 text-emerald-600",
      rose: "bg-rose-50 text-rose-600",
      slate: "bg-slate-100 text-slate-600",
    }[tone] || "bg-indigo-50 text-indigo-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${toneStyle}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Filters({ filters, setFilters, query, setQuery, onReset, active }) {
  function set(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:w-72 sm:grid-cols-2">
          <Select
            label="Department"
            value={filters.department}
            onChange={(v) => set("department", v)}
            options={["All", ...DEPARTMENTS]}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(v) => set("status", v)}
            options={["All", "Active", "Inactive"]}
          />
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
            placeholder="Search worker name, ID, department…"
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
            {opt}
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
        <Icon name="wrench" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No workers match your filters" : "No workers in the directory yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny ? "Try clearing filters or searching for something else." : "Add a worker to get started."}
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

function WorkerCard({ data, onView, onEdit, onToggleStatus, onDelete }) {
  const { worker, workload, resolvedIssues, active, email, phone, profilePicture } = data;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onView} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        {profilePicture && <img src={profilePicture} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />}
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{worker.id}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{worker.name}</h3>
          <p className="truncate text-xs text-slate-500">{worker.department}</p>
        </div>
        <ActiveStatusBadge active={active} />
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="user" className="h-3.5 w-3.5 text-slate-400" />
        {email || phone || "No contact on file"}
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="listChecks" className="h-3.5 w-3.5 text-slate-400" />
          {workload} active task{workload === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="checkCircle" className="h-3.5 w-3.5 text-slate-400" />
          {resolvedIssues.length} resolved
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <ActionButton label="View" icon="clipboardList" onClick={onView} />
        <ActionButton label="Edit" icon="tag" onClick={onEdit} />
        <ActionButton label="Delete" icon="trash" onClick={onDelete} />
        <ActionButton
          label={active ? "Deactivate" : "Activate"}
          icon={active ? "ban" : "checkCircle"}
          onClick={onToggleStatus}
          highlight={active ? "rose" : "emerald"}
        />
      </div>
    </div>
  );
}

function ActionButton({ label, icon, onClick, highlight }) {
  const style =
    highlight === "emerald"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : highlight === "rose"
        ? "bg-rose-600 text-white hover:bg-rose-700"
        : "border border-slate-200 text-slate-600 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition first:ml-0 ${style}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function WorkerDetailsModal({ data, onClose, onViewIssue, onEdit }) {
  const { worker, assigned, activeIssues, resolvedIssues, active, email, phone } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-6 pb-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{worker.id}</p>
            <h3 className="text-base font-semibold text-slate-900">{worker.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{worker.department}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Department / Skill</span>
              <span className="font-medium text-slate-800">{worker.department}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-medium text-slate-800">{email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Phone</span>
              <span className="font-medium text-slate-800">{phone || "—"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="text-slate-500">Status</span>
              <ActiveStatusBadge active={active} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Current workload</span>
              <span className="font-medium text-slate-800">{activeIssues.length} active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Resolved (all time)</span>
              <span className="font-medium text-slate-800">{resolvedIssues.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total assigned (all time)</span>
              <span className="font-medium text-slate-800">{assigned.length}</span>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned Issues</p>
            {assigned.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                No issues have been assigned to this worker yet.
              </p>
            ) : (
              <div className="space-y-2">
                {assigned.slice(0, 8).map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => onViewIssue(issue.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-700">
                        {issue.id} &middot; {issue.category}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{issue.roomName}</p>
                    </div>
                    <StatusBadge status={issue.status} />
                  </button>
                ))}
                {assigned.length > 8 && (
                  <p className="text-center text-[11px] text-slate-400">+{assigned.length - 8} more</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Edit Worker
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, ...inputProps }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      <input
        {...inputProps}
        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function AddWorkerModal({ open, busy, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPhone("");
      setDepartment(DEPARTMENTS[0]);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), department });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">Add New Worker</h3>
        <p className="mt-1 text-xs text-slate-500">Create a new facility worker for the admin directory.</p>

        <div className="mt-4 space-y-3">
          <FormField label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ravi Shankar" />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. worker@park.com"
          />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add Worker"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditWorkerModal({ open, data, busy, onSubmit, onCancel }) {
  const [name, setName] = useState(data?.worker.name || "");
  const [email, setEmail] = useState(data?.email || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [department, setDepartment] = useState(data?.worker.department || DEPARTMENTS[0]);
  const [error, setError] = useState("");

  if (!open || !data) return null;
  const { worker } = data;

  function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    onSubmit({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      department: department || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">Edit Worker</h3>
        <p className="mt-1 text-xs text-slate-500">
          {worker.name} &middot; {worker.id}
        </p>

        <div className="mt-4 space-y-3">
          <FormField label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. worker@park.com"
          />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
