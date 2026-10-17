import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { MOCK_USERS, ROLES } from "../../data/mockUsers";
import { getIssuesForEmployee, ISSUE_STATUS } from "../../utils/issueStorage";
import { getBookingsForClient } from "../../utils/bookingStorage";
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

const OPEN_ISSUE_STATUSES = [
  ISSUE_STATUS.OPEN,
  ISSUE_STATUS.ASSIGNED,
  ISSUE_STATUS.IN_PROGRESS,
  ISSUE_STATUS.REOPENED,
];

const EMPTY_FILTERS = { department: "All", status: "All" };

function buildEmployeeRoster() {
  const base = MOCK_USERS.filter((u) => u.role === ROLES.EMPLOYEE).map((u) => ({
    id: u.id,
    baseName: u.name,
    baseEmail: u.email,
    baseOrg: u.organization,
    isCustom: false,
  }));

  getCustomStaff(STAFF_ROLE.EMPLOYEE).forEach((c) => {
    base.push({ id: c.id, baseName: c.name, baseEmail: c.email, baseOrg: c.organization, isCustom: true, custom: c });
  });

  return base
    .filter((entry) => !isStaffDeleted(entry.id))
    .map((entry) => {
      const override = getStaffOverride(entry.id);
      const employee = {
        id: entry.id,
        name: override.name || entry.baseName,
        email: override.email || entry.baseEmail,
        organization: override.organization || entry.baseOrg,
        profilePicture: override.profilePicture || null,
      };
      const issues = getIssuesForEmployee(entry.id);
      const openIssues = issues.filter((i) => OPEN_ISSUE_STATUSES.includes(i.status));
      const bookings = getBookingsForClient(entry.id);
      return {
        employee,
        issues,
        openIssues,
        bookings,
        active: isStaffActive(entry.id),
        phone: override.phone || entry.custom?.phone || null,
        isCustom: entry.isCustom,
      };
    });
}

export default function AdminEmployees() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(STAFF_OVERRIDES_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(STAFF_OVERRIDES_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function refresh() {
    setTick((t) => t + 1);
  }

  // Employees come from the real login-account directory plus any admin
  // has added directly, with admin edits layered on top of both.
  const employees = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick;
    return buildEmployeeRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.employee.organization).filter(Boolean))).sort(),
    [employees]
  );

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.active).length;
    const inactive = total - active;
    const withOpenIssues = employees.filter((e) => e.openIssues.length > 0).length;
    return [
      { label: "Total Employees", value: total, icon: "briefcase", tone: "indigo" },
      { label: "Active Employees", value: active, icon: "checkCircle", tone: "emerald" },
      { label: "Inactive Employees", value: inactive, icon: "ban", tone: "slate" },
      { label: "With Open Issues", value: withOpenIssues, icon: "alert", tone: "amber" },
    ];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (filters.department !== "All" && e.employee.organization !== filters.department) return false;
      if (filters.status !== "All") {
        const wantActive = filters.status === "Active";
        if (e.active !== wantActive) return false;
      }
      if (!q) return true;
      return (
        e.employee.name.toLowerCase().includes(q) ||
        e.employee.id.toLowerCase().includes(q) ||
        (e.employee.email || "").toLowerCase().includes(q)
      );
    });
  }, [employees, filters, query]);

  const filtersActive = query.trim() !== "" || filters.department !== "All" || filters.status !== "All";

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function handleAddSubmit(data) {
    setBusy(true);
    setTimeout(() => {
      addCustomStaff(STAFF_ROLE.EMPLOYEE, data);
      setBusy(false);
      setAddOpen(false);
      setToast(`${data.name} was added.`);
      refresh();
    }, 300);
  }

  function handleEditSubmit(patch) {
    setBusy(true);
    setTimeout(() => {
      updateStaffOverride(editTarget.employee.id, patch);
      setBusy(false);
      setEditTarget(null);
      setToast(`${editTarget.employee.name}'s details were updated.`);
      refresh();
    }, 300);
  }

  function handleStatusConfirm() {
    setBusy(true);
    const nextActive = !statusTarget.active;
    setTimeout(() => {
      setStaffActive(statusTarget.employee.id, nextActive);
      setBusy(false);
      setToast(`${statusTarget.employee.name} ${nextActive ? "activated" : "deactivated"}.`);
      setStatusTarget(null);
      refresh();
    }, 300);
  }

  function handleDeleteConfirm() {
    setBusy(true);
    setTimeout(() => {
      if (deleteTarget.isCustom) {
        deleteCustomStaff(deleteTarget.employee.id);
      } else {
        setStaffDeleted(deleteTarget.employee.id, true);
      }
      setBusy(false);
      setToast(`${deleteTarget.employee.name} was deleted.`);
      setDeleteTarget(null);
      refresh();
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage employee accounts and access."
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Add New Employee
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
        departments={departments}
        onReset={resetFilters}
        active={filtersActive}
      />

      {filtered.length === 0 ? (
        <EmptyState hasAny={employees.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1160px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3">Bookings</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.employee.id}
                      onClick={() => setViewTarget(e)}
                      className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{e.employee.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{e.employee.id}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.employee.organization || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{e.employee.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{e.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <ActiveStatusBadge active={e.active} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {e.issues.length}
                        {e.openIssues.length > 0 && (
                          <span className="ml-1.5 text-[11px] text-amber-600">({e.openIssues.length} open)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{e.bookings.length}</td>
                      <td className="px-4 py-3 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewTarget(e)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(e)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusTarget(e)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                              e.active
                                ? "bg-rose-600 text-white hover:bg-rose-700"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {e.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(e)}
                            aria-label="Delete employee"
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
            {filtered.map((e) => (
              <EmployeeCard
                key={e.employee.id}
                data={e}
                onView={() => setViewTarget(e)}
                onEdit={() => setEditTarget(e)}
                onToggleStatus={() => setStatusTarget(e)}
                onDelete={() => setDeleteTarget(e)}
              />
            ))}
          </div>
        </>
      )}

      {viewTarget && (
        <EmployeeDetailsModal
          data={viewTarget}
          onClose={() => setViewTarget(null)}
          onViewIssues={() => navigate("/admin/issues")}
          onEdit={() => {
            setEditTarget(viewTarget);
            setViewTarget(null);
          }}
        />
      )}

      <AddEmployeeModal open={addOpen} busy={busy} onSubmit={handleAddSubmit} onCancel={() => setAddOpen(false)} />

      <EditEmployeeModal
        key={editTarget?.employee.id || "none"}
        open={!!editTarget}
        data={editTarget}
        busy={busy}
        onSubmit={handleEditSubmit}
        onCancel={() => setEditTarget(null)}
      />

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? "Deactivate this employee?" : "Activate this employee?"}
        message={
          statusTarget?.active
            ? `${statusTarget?.employee.name} will be marked inactive in the admin directory. This only updates their admin status — it doesn't remove their ability to sign in.`
            : `${statusTarget?.employee.name} will be marked active again.`
        }
        confirmLabel={statusTarget?.active ? "Deactivate" : "Activate"}
        danger={!!statusTarget?.active}
        busy={busy}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this employee?"
        message={
          deleteTarget?.isCustom
            ? `${deleteTarget?.employee.name} will be permanently removed from the employee directory.`
            : `${deleteTarget?.employee.name} will be removed from the admin employee directory. This doesn't affect their ability to sign in — it only hides them from this list.`
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

function Filters({ filters, setFilters, query, setQuery, departments, onReset, active }) {
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
            options={["All", ...departments]}
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
            placeholder="Search name, ID, email…"
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
        <Icon name="briefcase" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No employees match your filters" : "No employee accounts yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny ? "Try clearing filters or searching for something else." : "Add an employee to get started."}
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

function EmployeeCard({ data, onView, onEdit, onToggleStatus, onDelete }) {
  const { employee, issues, openIssues, bookings, active } = data;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onView} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        {employee.profilePicture && <img src={employee.profilePicture} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />}
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{employee.id}</p>
          <h3 className="mt-0.5 truncate text-sm font-semibold text-slate-900">{employee.name}</h3>
          <p className="truncate text-xs text-slate-500">{employee.organization || "—"}</p>
        </div>
        <ActiveStatusBadge active={active} />
      </div>

      <p className="mb-3 truncate text-xs text-slate-500">{employee.email || "No email on file"}</p>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="alert" className="h-3.5 w-3.5 text-slate-400" />
          {issues.length} issue{issues.length === 1 ? "" : "s"} ({openIssues.length} open)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
          {bookings.length} booking{bookings.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Icon name="clipboardList" className="h-3.5 w-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Icon name="tag" className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
          Delete
        </button>
        <button
          type="button"
          onClick={onToggleStatus}
          className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
            active ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          <Icon name={active ? "ban" : "checkCircle"} className="h-3.5 w-3.5" />
          {active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>
  );
}

function EmployeeDetailsModal({ data, onClose, onViewIssues, onEdit }) {
  const { employee, issues, openIssues, bookings, active, phone } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{employee.id}</p>
            <h3 className="text-base font-semibold text-slate-900">{employee.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Department</span>
            <span className="font-medium text-slate-800">{employee.organization || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-800">{employee.email || "—"}</span>
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
            <span className="text-slate-500">Total issues raised</span>
            <span className="font-medium text-slate-800">{issues.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Open issues</span>
            <span className="font-medium text-slate-800">{openIssues.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bookings</span>
            <span className="font-medium text-slate-800">{bookings.length}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onViewIssues}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            View Issues
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Edit
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

function AddEmployeeModal({ open, busy, onSubmit, onCancel }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPhone("");
      setDepartment("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    onSubmit({ name: name.trim(), email: email.trim(), phone: phone.trim(), organization: department.trim() });
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
        <h3 className="text-base font-semibold text-slate-900">Add New Employee</h3>
        <p className="mt-1 text-xs text-slate-500">Create a new employee account for the admin directory.</p>

        <div className="mt-4 space-y-3">
          <FormField label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rohan Iyer" />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. employee@company.com"
          />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <FormField
            label="Department"
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. IT Park Internal Staff"
          />
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
            {busy ? "Adding…" : "Add Employee"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditEmployeeModal({ open, data, busy, onSubmit, onCancel }) {
  const [name, setName] = useState(data?.employee.name || "");
  const [email, setEmail] = useState(data?.employee.email || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [department, setDepartment] = useState(data?.employee.organization || "");
  const [error, setError] = useState("");

  if (!open || !data) return null;
  const { employee } = data;

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      organization: department.trim() || null,
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
        <h3 className="text-base font-semibold text-slate-900">Edit Employee</h3>
        <p className="mt-1 text-xs text-slate-500">
          {employee.name} &middot; {employee.id}
        </p>

        <div className="mt-4 space-y-3">
          <FormField label="Name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          <FormField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
          />
          <FormField
            label="Department"
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
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
