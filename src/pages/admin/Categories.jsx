import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import CategoryFormModal from "../../components/categories/CategoryFormModal";
import {
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABELS,
  getCategories,
  addCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategory,
  CATEGORY_EVENT,
} from "../../utils/categoryStorage";

const EMPTY_FILTERS = { type: "All", status: "All" };

export default function AdminCategories() {
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [formState, setFormState] = useState(null); // { mode: 'add'|'edit', category }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  function refresh() {
    setCategories(getCategories());
  }

  useEffect(() => {
    refresh();
    window.addEventListener(CATEGORY_EVENT, refresh);
    return () => window.removeEventListener(CATEGORY_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.active).length;
    const roomCats = categories.filter((c) => c.type === CATEGORY_TYPES.ROOM).length;
    const issueCats = categories.filter((c) => c.type === CATEGORY_TYPES.ISSUE).length;
    return { total, active, roomCats, issueCats };
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => {
      if (filters.type !== "All" && c.type !== filters.type) return false;
      if (filters.status !== "All") {
        const wantActive = filters.status === "Active";
        if (c.active !== wantActive) return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    });
  }, [categories, filters, query]);

  const filtersActive = query.trim() !== "" || Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function handleFormSubmit(payload) {
    setBusy(true);
    setTimeout(() => {
      if (formState.mode === "edit") {
        updateCategory(formState.category.id, payload);
        setToast(`"${formState.category.name}" updated.`);
      } else {
        addCategory(payload);
        setToast(`"${payload.name}" category added.`);
      }
      setBusy(false);
      setFormState(null);
      refresh();
    }, 350);
  }

  function handleToggleActive(category) {
    toggleCategoryActive(category.id);
    setToast(`"${category.name}" ${category.active ? "deactivated" : "activated"}.`);
    refresh();
  }

  function handleDeleteConfirm() {
    setBusy(true);
    setTimeout(() => {
      const result = deleteCategory(deleteTarget.id);
      setBusy(false);
      if (result.success) {
        setToast(`"${deleteTarget.name}" deleted.`);
        setDeleteTarget(null);
        setDeleteError("");
        refresh();
      } else {
        setDeleteError(result.reason);
      }
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize rooms and issues into categories."
        actions={
          <button
            type="button"
            onClick={() => setFormState({ mode: "add", category: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Add Category
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon="tag" label="Total Categories" value={stats.total} />
        <StatCard icon="checkCircle" label="Active" value={stats.active} tone="emerald" />
        <StatCard icon="door" label="Room Categories" value={stats.roomCats} tone="indigo" />
        <StatCard icon="alert" label="Issue Categories" value={stats.issueCats} tone="amber" />
      </div>

      <Filters filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} onReset={resetFilters} active={filtersActive} />

      {filtered.length === 0 ? (
        <EmptyState hasAny={categories.length > 0} onReset={resetFilters} />
      ) : (
        <>
          <div className="hidden lg:block">
            <CategoryTable
              categories={filtered}
              onEdit={(c) => setFormState({ mode: "edit", category: c })}
              onToggle={handleToggleActive}
              onDelete={setDeleteTarget}
            />
          </div>
          <div className="grid gap-4 lg:hidden">
            {filtered.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                onEdit={() => setFormState({ mode: "edit", category: c })}
                onToggle={() => handleToggleActive(c)}
                onDelete={() => setDeleteTarget(c)}
              />
            ))}
          </div>
        </>
      )}

      <CategoryFormModal
        open={!!formState}
        mode={formState?.mode}
        category={formState?.category}
        busy={busy}
        onSubmit={handleFormSubmit}
        onCancel={() => setFormState(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        busy={busy}
        title="Delete this category?"
        message={
          deleteError ||
          (deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. This can't be undone.`
            : "")
        }
        confirmLabel="Yes, delete"
        cancelLabel="Keep category"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
        }}
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
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneStyle}`}>
        <Icon name={icon} className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
        <p className="truncate text-[11px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function Filters({ filters, setFilters, query, setQuery, onReset, active }) {
  function set(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:max-w-md">
          <Select label="Type" value={filters.type} onChange={(v) => set("type", v)} options={["All", ...Object.values(CATEGORY_TYPES)]} labelFor={(v) => (v === "All" ? "All" : CATEGORY_TYPE_LABELS[v])} />
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={["All", "Active", "Inactive"]} />
        </div>
        <div className="relative sm:w-64">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>
      {active && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, labelFor }) {
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
            {labelFor ? labelFor(opt) : opt}
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
        <Icon name="tag" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No categories match your filters" : "No categories yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny ? "Try clearing filters or searching for something else." : "Add a category to start organizing rooms and issues."}
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

function TypeBadge({ type }) {
  const style = type === CATEGORY_TYPES.ROOM ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-amber-50 text-amber-700 ring-amber-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {CATEGORY_TYPE_LABELS[type]}
    </span>
  );
}

function ActiveBadge({ active }) {
  const style = active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ring-1 ring-inset ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CategoryTable({ categories, onEdit, onToggle, onDelete }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Related</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{c.name}</p>
                    {c.system && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Built-in</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={c.type} />
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-500">
                  <p className="truncate">{c.description || "—"}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.relatedCount} {c.type === CATEGORY_TYPES.ROOM ? "room(s)" : "issue(s)"}
                </td>
                <td className="px-4 py-3">
                  <ActiveBadge active={c.active} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(c)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(c)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        c.active
                          ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                    {!c.system && (
                      <button
                        type="button"
                        onClick={() => onDelete(c)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    )}
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

function CategoryCard({ category, onEdit, onToggle, onDelete }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">{category.name}</h3>
            {category.system && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Built-in</span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">{category.description || "—"}</p>
        </div>
        <ActiveBadge active={category.active} />
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <TypeBadge type={category.type} />
        <span>
          {category.relatedCount} {category.type === CATEGORY_TYPES.ROOM ? "room(s)" : "issue(s)"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Icon name="listChecks" className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
            category.active ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          <Icon name={category.active ? "ban" : "checkCircle"} className="h-3.5 w-3.5" />
          {category.active ? "Deactivate" : "Activate"}
        </button>
        {!category.system && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
