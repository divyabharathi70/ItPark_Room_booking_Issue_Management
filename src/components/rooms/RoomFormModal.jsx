import { useEffect, useState } from "react";
import Icon from "../icons/Icon";
import { AMENITIES } from "../../data/mockRooms";
import { isRoomIdTaken, isRoomNumberTaken, suggestRoomId } from "../../utils/roomStorage";

const EMPTY_FORM = {
  id: "",
  name: "",
  roomNumber: "",
  floor: "",
  capacity: "",
  pricePerHour: "",
  description: "",
  includedAmenities: [],
  isActive: true,
};

function toFormState(room) {
  if (!room) return { ...EMPTY_FORM, id: suggestRoomId() };
  return {
    id: room.id,
    name: room.name || "",
    roomNumber: room.roomNumber || "",
    floor: room.floor ?? "",
    capacity: room.capacity ?? "",
    pricePerHour: room.pricePerHour ?? "",
    description: room.description || "",
    includedAmenities: room.includedAmenities || [],
    isActive: room.isActive !== false,
  };
}

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

/**
 * Add/Edit Room modal for Admin > Rooms. Handles catalog fields only
 * (name, number, floor, capacity, price, description, amenities, active
 * flag) — operational status (blocked/maintenance) is untouched and lives
 * in roomStatusStorage.js. Validation happens here; the actual
 * addRoom()/updateRoom() localStorage write happens in the parent so it
 * can also refresh page-level state and show a success toast.
 */
export default function RoomFormModal({ open, mode, room, busy, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => toFormState(room));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(toFormState(room));
      setErrors({});
    }
  }, [open, room]);

  if (!open) return null;

  const isEdit = mode === "edit";

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleAmenity(id) {
    setForm((f) => ({
      ...f,
      includedAmenities: f.includedAmenities.includes(id)
        ? f.includedAmenities.filter((a) => a !== id)
        : [...f.includedAmenities, id],
    }));
  }

  function validate() {
    const next = {};
    if (!form.id.trim()) next.id = "Room ID is required.";
    else if (!isEdit && isRoomIdTaken(form.id, null)) next.id = "This Room ID is already in use.";

    if (!form.name.trim()) next.name = "Room name is required.";
    if (!form.roomNumber.trim()) next.roomNumber = "Room number is required.";
    else if (isRoomNumberTaken(form.roomNumber, isEdit ? room.id : null)) {
      next.roomNumber = "This room number is already used by another room.";
    }

    if (form.floor === "" || form.floor === null || Number.isNaN(Number(form.floor))) {
      next.floor = "Floor is required.";
    }

    const capacityNum = Number(form.capacity);
    if (form.capacity === "" || Number.isNaN(capacityNum) || capacityNum <= 0) {
      next.capacity = "Capacity must be a positive number.";
    }

    const priceNum = Number(form.pricePerHour);
    if (form.pricePerHour === "" || Number.isNaN(priceNum) || priceNum < 0) {
      next.pricePerHour = "Price per hour must be zero or greater.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!validate()) return;

    onSubmit({
      id: form.id.trim(),
      name: form.name.trim(),
      roomNumber: form.roomNumber.trim(),
      floor: Number(form.floor),
      capacity: Number(form.capacity),
      pricePerHour: Number(form.pricePerHour),
      description: form.description.trim(),
      includedAmenities: form.includedAmenities,
      isActive: form.isActive,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={busy ? undefined : onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Icon name={isEdit ? "edit" : "plusSquare"} className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{isEdit ? "Edit Room" : "Add Room"}</h3>
              <p className="text-xs text-slate-400">
                {isEdit ? `${room?.name} · ${room?.roomNumber}` : "Add a new bookable room to the catalog."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Room ID" error={errors.id}>
                <input
                  type="text"
                  value={form.id}
                  disabled={isEdit}
                  onChange={(e) => set("id", e.target.value)}
                  placeholder="r-501"
                  className={inputClass(errors.id, isEdit)}
                />
              </Field>
              <Field label="Room Number" error={errors.roomNumber}>
                <input
                  type="text"
                  value={form.roomNumber}
                  onChange={(e) => set("roomNumber", e.target.value)}
                  placeholder="R-501"
                  className={inputClass(errors.roomNumber)}
                />
              </Field>
            </div>

            <Field label="Room Name" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Test Conference Room"
                className={inputClass(errors.name)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Floor" error={errors.floor}>
                <input
                  type="number"
                  value={form.floor}
                  onChange={(e) => set("floor", e.target.value)}
                  placeholder="5"
                  className={inputClass(errors.floor)}
                />
              </Field>
              <Field label="Capacity" error={errors.capacity}>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => set("capacity", e.target.value)}
                  placeholder="25"
                  className={inputClass(errors.capacity)}
                />
              </Field>
              <Field label="Price / hour (₹)" error={errors.pricePerHour}>
                <input
                  type="number"
                  min={0}
                  value={form.pricePerHour}
                  onChange={(e) => set("pricePerHour", e.target.value)}
                  placeholder="2000"
                  className={inputClass(errors.pricePerHour)}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="A short description of the space…"
                className={inputClass()}
              />
            </Field>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amenities
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {AMENITIES.map((a) => {
                  const checked = form.includedAmenities.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAmenity(a.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                        checked
                          ? "border-indigo-300 bg-indigo-50/60 text-indigo-700"
                          : "border-slate-200 text-slate-600 hover:border-indigo-200"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"
                        }`}
                      >
                        <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                      </span>
                      <Icon name={a.icon} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Active</p>
                <p className="text-xs text-slate-400">Inactive rooms can't be selected for new bookings.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isActive}
                onClick={() => set("isActive", !form.isActive)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  form.isActive ? "bg-emerald-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    form.isActive ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {isEdit && (
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">Created</p>
                  <p className="mt-0.5 text-slate-700">{formatDateTime(room?.createdAt)}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-slate-400">Last Updated</p>
                  <p className="mt-0.5 text-slate-700">{formatDateTime(room?.updatedAt)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
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
              {busy ? "Saving…" : isEdit ? "Save Changes" : "Add Room"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputClass(error, disabled) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-4 ${
    error
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
      : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-50"
  } ${disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""}`;
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
