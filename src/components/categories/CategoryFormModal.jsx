import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
import { CATEGORY_TYPES, getLinkableIssueValues, getAssignableRooms } from "../../utils/categoryStorage";

/**
 * Add / edit modal for custom categories. System categories (derived from
 * ISSUE_CATEGORIES groups or room capacity buckets) never open this modal
 * in "create" mode and only expose description + active when editing —
 * enforced by the caller (Categories.jsx) passing `lockType`/`lockName`.
 */
export default function CategoryFormModal({ open, mode, category, busy, onSubmit, onCancel }) {
  const isEdit = mode === "edit";
  const isSystem = !!category?.system;

  const [type, setType] = useState(CATEGORY_TYPES.ISSUE);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [roomIds, setRoomIds] = useState([]);
  const [issueValues, setIssueValues] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(category?.type || CATEGORY_TYPES.ISSUE);
    setName(category?.name || "");
    setDescription(category?.description || "");
    setRoomIds(category?.roomIds || []);
    setIssueValues(category?.issueValues || []);
    setError("");
  }, [open, category]);

  if (!open) return null;

  const linkableIssueGroups = getLinkableIssueValues();
  const assignableRooms = getAssignableRooms();

  function toggleRoom(id) {
    setRoomIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function toggleIssueValue(value) {
    setIssueValues((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!isSystem && !name.trim()) {
      setError("Give the category a name.");
      return;
    }
    setError("");
    onSubmit({
      type,
      name: name.trim(),
      description: description.trim(),
      roomIds,
      issueValues,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" aria-label="Close" onClick={onCancel} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Icon name="tag" className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isEdit ? "Edit Category" : "Add Category"}
            </h3>
            <p className="text-xs text-slate-400">
              {isSystem ? "Built-in category — description only" : "Custom category"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Category Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(CATEGORY_TYPES).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isSystem}
                  onClick={() => setType(t)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    type === t
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  } ${isSystem ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  {t === CATEGORY_TYPES.ROOM ? "Room Category" : "Issue Category"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Name
            </label>
            <input
              type="text"
              value={name}
              disabled={isSystem}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive Suites"
              maxLength={60}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="What this category is used for…"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {!isSystem && type === CATEGORY_TYPES.ROOM && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assign Rooms (optional)
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {assignableRooms.map((room) => (
                  <label
                    key={room.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={roomIds.includes(room.id)}
                      onChange={() => toggleRoom(room.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                    />
                    {room.name} <span className="text-xs text-slate-400">· {room.roomNumber}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isSystem && type === CATEGORY_TYPES.ISSUE && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Link Existing Issue Types (optional)
              </label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {linkableIssueGroups.map((group) => (
                  <div key={group.group}>
                    <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {group.groupLabel}
                    </p>
                    {group.items.map((item) => (
                      <label
                        key={item.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={issueValues.includes(item.value)}
                          onChange={() => toggleIssueValue(item.value)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-200"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : isEdit ? "Save Changes" : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
