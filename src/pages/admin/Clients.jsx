import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { MOCK_USERS, ROLES } from "../../data/mockUsers";
import { getAllBookings, BOOKING_STATUS, toTimestamp } from "../../utils/bookingStorage";
import { getIssuesForClient } from "../../utils/issueStorage";
import { getAllClients } from "../../utils/clientStorage";
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

const EMPTY_FILTERS = { status: "All" };

function buildClientRoster() {
  const bookings = getAllBookings();
  const usersById = new Map(MOCK_USERS.filter((u) => u.role === ROLES.CLIENT).map((u) => [u.id, u]));
  // Clients auto-created/activated by Admin confirming a paid booking
  // request (Payment Successful + Admin Confirmation — see
  // bookingStorage.approveBooking + utils/clientStorage.js).
  const activatedById = new Map(getAllClients().map((c) => [c.clientId, c]));

  const byId = new Map();
  // Seed with every real client login account, even one with zero bookings
  // so far, since that's still a real client account admin should see.
  usersById.forEach((u, id) => {
    byId.set(id, { clientId: id, clientName: u.name, user: u, bookings: [], custom: null, activated: null });
  });
  // Seed with every activated Client too, so one with zero *other*
  // bookings still shows up right away with their real contact details —
  // this is what makes a newly approved client automatically appear here.
  activatedById.forEach((c, id) => {
    byId.set(id, { clientId: id, clientName: c.name, user: null, bookings: [], custom: null, activated: c });
  });
  bookings.forEach((b) => {
    // Guest booking requests (public "/book" flow) still awaiting Admin
    // approval have no clientId yet — they aren't a real client account
    // until that approval step links them to one (see approveBooking), so
    // they're left out of the client roster here rather than showing up
    // as a stray "unknown" client entry.
    if (!b.clientId) return;
    if (!byId.has(b.clientId)) {
      byId.set(b.clientId, {
        clientId: b.clientId,
        clientName: b.clientName,
        user: usersById.get(b.clientId) || null,
        bookings: [],
        custom: null,
        activated: activatedById.get(b.clientId) || null,
      });
    }
    byId.get(b.clientId).bookings.push(b);
  });

  // Admin-added clients (created via "Add New Client", no login/booking yet).
  getCustomStaff(STAFF_ROLE.CLIENT).forEach((c) => {
    byId.set(c.id, { clientId: c.id, clientName: c.name, user: null, bookings: [], custom: c, activated: null });
  });

  const now = Date.now();
  return Array.from(byId.values())
    .filter((entry) => !isStaffDeleted(entry.clientId))
    .map((entry) => {
      const { bookings: clientBookings, user, clientId, clientName, custom, activated } = entry;
      const upcoming = clientBookings.filter((b) => {
        if (b.bookingStatus === BOOKING_STATUS.CANCELLED) return false;
        const start = toTimestamp(b.startDate, b.startTime);
        return start !== null && start > now;
      });
      const activeBookings = clientBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED);
      const issues = getIssuesForClient(clientId);
      const override = getStaffOverride(clientId);

      const baseName = user?.name || custom?.name || activated?.name || clientName;
      const baseEmail = user?.email || custom?.email || activated?.email || null;
      const baseOrg = user?.organization || custom?.organization || activated?.company || null;
      const basePhone = custom?.phone || activated?.phone || null;

      return {
        clientId,
        companyName: override.organization || baseOrg || baseName,
        contactName: override.name || baseName,
        email: override.email || baseEmail,
        bookings: clientBookings,
        upcoming,
        activeBookings,
        issues,
        active: isStaffActive(clientId),
        phone: override.phone || basePhone,
        profilePicture: override.profilePicture || null,
        isCustom: !!custom,
      };
    });
}

export default function AdminClients() {
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

  const clients = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick;
    return buildClientRoster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const stats = useMemo(() => {
    const totalClients = clients.length;
    const activeClients = clients.filter((c) => c.active).length;
    const totalBookings = clients.reduce((sum, c) => sum + c.bookings.length, 0);
    const upcomingBookings = clients.reduce((sum, c) => sum + c.upcoming.length, 0);
    const withActiveBookings = clients.filter((c) => c.activeBookings.length > 0).length;
    return [
      { label: "Total Clients", value: totalClients, icon: "users", tone: "indigo" },
      { label: "Active Clients", value: activeClients, icon: "checkCircle", tone: "emerald" },
      { label: "Total Bookings", value: totalBookings, icon: "calendar", tone: "slate" },
      { label: "Upcoming Bookings", value: upcomingBookings, icon: "clock", tone: "amber" },
      { label: "With Active Bookings", value: withActiveBookings, icon: "door", tone: "indigo" },
    ];
  }, [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (filters.status !== "All") {
        const wantActive = filters.status === "Active";
        if (c.active !== wantActive) return false;
      }
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    });
  }, [clients, filters, query]);

  const filtersActive = query.trim() !== "" || filters.status !== "All";

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function handleAddSubmit(data) {
    setBusy(true);
    setTimeout(() => {
      addCustomStaff(STAFF_ROLE.CLIENT, data);
      setBusy(false);
      setAddOpen(false);
      setToast(`${data.organization || data.name} was added.`);
      refresh();
    }, 300);
  }

  function handleEditSubmit(patch) {
    setBusy(true);
    setTimeout(() => {
      updateStaffOverride(editTarget.clientId, patch);
      setBusy(false);
      setEditTarget(null);
      setToast(`${editTarget.companyName}'s details were updated.`);
      refresh();
    }, 300);
  }

  function handleStatusConfirm() {
    setBusy(true);
    const nextActive = !statusTarget.active;
    setTimeout(() => {
      setStaffActive(statusTarget.clientId, nextActive);
      setBusy(false);
      setToast(`${statusTarget.companyName} ${nextActive ? "activated" : "deactivated"}.`);
      setStatusTarget(null);
      refresh();
    }, 300);
  }

  function handleDeleteConfirm() {
    setBusy(true);
    setTimeout(() => {
      if (deleteTarget.isCustom) {
        deleteCustomStaff(deleteTarget.clientId);
      } else {
        setStaffDeleted(deleteTarget.clientId, true);
      }
      setBusy(false);
      setToast(`${deleteTarget.companyName} was deleted.`);
      setDeleteTarget(null);
      refresh();
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Manage client companies and their accounts."
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Add New Client
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <Filters filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} onReset={resetFilters} active={filtersActive} />

      {filtered.length === 0 ? (
        <EmptyState hasAny={clients.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Client / Company</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Bookings</th>
                    <th className="px-4 py-3">Upcoming</th>
                    <th className="px-4 py-3">Issues</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.clientId}
                      onClick={() => setViewTarget(c)}
                      className="cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.companyName}</p>
                        <p className="font-mono text-[11px] text-slate-400">{c.clientId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.contactName}</td>
                      <td className="px-4 py-3 text-slate-500">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.bookings.length}</td>
                      <td className="px-4 py-3 text-slate-600">{c.upcoming.length}</td>
                      <td className="px-4 py-3 text-slate-600">{c.issues.length}</td>
                      <td className="px-4 py-3">
                        <ActiveStatusBadge active={c.active} />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewTarget(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditTarget(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatusTarget(c)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                              c.active
                                ? "bg-rose-600 text-white hover:bg-rose-700"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            }`}
                          >
                            {c.active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            aria-label="Delete client"
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
            {filtered.map((c) => (
              <ClientCard
                key={c.clientId}
                data={c}
                onView={() => setViewTarget(c)}
                onEdit={() => setEditTarget(c)}
                onToggleStatus={() => setStatusTarget(c)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}
          </div>
        </>
      )}

      {viewTarget && (
        <ClientDetailsModal
          data={viewTarget}
          onClose={() => setViewTarget(null)}
          onViewBookings={() => navigate("/admin/bookings")}
          onViewIssues={() => navigate("/admin/issues")}
          onEdit={() => {
            setEditTarget(viewTarget);
            setViewTarget(null);
          }}
        />
      )}

      <AddClientModal open={addOpen} busy={busy} onSubmit={handleAddSubmit} onCancel={() => setAddOpen(false)} />

      <EditClientModal
        key={editTarget?.clientId || "none"}
        open={!!editTarget}
        data={editTarget}
        busy={busy}
        onSubmit={handleEditSubmit}
        onCancel={() => setEditTarget(null)}
      />

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.active ? "Deactivate this client?" : "Activate this client?"}
        message={
          statusTarget?.active
            ? `${statusTarget?.companyName} will be marked inactive in the admin directory. This only updates their admin status — it doesn't remove their ability to sign in or affect existing bookings.`
            : `${statusTarget?.companyName} will be marked active again.`
        }
        confirmLabel={statusTarget?.active ? "Deactivate" : "Activate"}
        danger={!!statusTarget?.active}
        busy={busy}
        onConfirm={handleStatusConfirm}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this client?"
        message={
          deleteTarget?.isCustom
            ? `${deleteTarget?.companyName} will be permanently removed from the client directory.`
            : `${deleteTarget?.companyName} will be removed from the admin client directory. This doesn't affect their ability to sign in or their existing bookings — it only hides them from this list.`
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
        <div className="grid w-40 grid-cols-1 gap-2">
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={["All", "Active", "Inactive"]} />
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
            placeholder="Search company, contact, email…"
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
        <Icon name="users" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{hasAny ? "No clients match your filters" : "No clients yet"}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny ? "Try clearing filters or searching for something else." : "Add a client, or they'll show up here once they book a room."}
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

function ClientCard({ data, onView, onEdit, onToggleStatus, onDelete }) {
  const { companyName, contactName, email, bookings, upcoming, issues, active, profilePicture } = data;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div onClick={onView} className="mb-3 flex cursor-pointer items-start justify-between gap-2">
        {profilePicture && <img src={profilePicture} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{companyName}</h3>
          <p className="truncate text-xs text-slate-500">{contactName}</p>
        </div>
        <ActiveStatusBadge active={active} />
      </div>

      <p className="mb-3 truncate text-xs text-slate-500">{email || "No email on file"}</p>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
          {bookings.length} bookings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
          {upcoming.length} upcoming
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="alert" className="h-3.5 w-3.5 text-slate-400" />
          {issues.length} issues
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

function ClientDetailsModal({ data, onClose, onViewBookings, onViewIssues, onEdit }) {
  const { companyName, contactName, email, phone, bookings, upcoming, activeBookings, issues, active } = data;

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
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{data.clientId}</p>
            <h3 className="text-base font-semibold text-slate-900">{companyName}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{contactName}</p>
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
            <span className="text-slate-500">Total bookings</span>
            <span className="font-medium text-slate-800">{bookings.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Upcoming bookings</span>
            <span className="font-medium text-slate-800">{upcoming.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Active (confirmed) bookings</span>
            <span className="font-medium text-slate-800">{activeBookings.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Total issues</span>
            <span className="font-medium text-slate-800">{issues.length}</span>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onViewBookings}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            View Bookings
          </button>
          <button
            type="button"
            onClick={onViewIssues}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            View Issues
          </button>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Edit Client
        </button>
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

function AddClientModal({ open, busy, onSubmit, onCancel }) {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit() {
    if (!contactName.trim() || !email.trim()) {
      setError("Contact name and email are required.");
      return;
    }
    onSubmit({ organization: companyName.trim(), name: contactName.trim(), email: email.trim(), phone: phone.trim() });
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
        <h3 className="text-base font-semibold text-slate-900">Add New Client</h3>
        <p className="mt-1 text-xs text-slate-500">Create a new client company for the admin directory.</p>

        <div className="mt-4 space-y-3">
          <FormField
            label="Company Name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. ABC Technologies"
          />
          <FormField
            label="Contact Name"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Priya Nair"
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. contact@company.com"
          />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
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
            {busy ? "Adding…" : "Add Client"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditClientModal({ open, data, busy, onSubmit, onCancel }) {
  const [companyName, setCompanyName] = useState(data?.companyName || "");
  const [contactName, setContactName] = useState(data?.contactName || "");
  const [email, setEmail] = useState(data?.email || "");
  const [phone, setPhone] = useState(data?.phone || "");
  const [error, setError] = useState("");

  if (!open || !data) return null;

  function handleSubmit() {
    if (!contactName.trim() || !email.trim()) {
      setError("Contact name and email are required.");
      return;
    }
    onSubmit({
      organization: companyName.trim() || null,
      name: contactName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
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
        <h3 className="text-base font-semibold text-slate-900">Edit Client</h3>
        <p className="mt-1 text-xs text-slate-500">{data.companyName}</p>

        <div className="mt-4 space-y-3">
          <FormField
            label="Company Name"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company / organization"
          />
          <FormField
            label="Contact Name"
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Contact name"
          />
          <FormField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
          />
          <FormField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +91 98765 43210"
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
