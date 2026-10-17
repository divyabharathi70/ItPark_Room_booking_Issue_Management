import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import BlockRoomFormModal from "../../components/rooms/BlockRoomFormModal";
import MaintenanceReasonModal from "../../components/rooms/MaintenanceReasonModal";
import RoomFormModal from "../../components/rooms/RoomFormModal";
import { AMENITY_MAP, CAPACITY_BUCKETS } from "../../data/mockRooms";
import {
  getRoomAvailability,
  blockRoom,
  unblockRoom,
  ROOM_STATUS_EVENT,
  ROOM_AVAILABILITY,
} from "../../utils/roomStatusStorage";
import { getUnresolvedIssuesForRoom, PRIORITY } from "../../utils/issueStorage";
import { getAllBookings, formatDuration, BOOKING_STATUS } from "../../utils/bookingStorage";
import { getAllRooms, addRoom, updateRoom, deleteRoom, ROOMS_EVENT } from "../../utils/roomStorage";

function formatTime12h(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** The booking currently occupying this room right now, if any — a
 * CONFIRMED booking whose start/end window contains the current time. */
function getCurrentBookingForRoom(roomId, bookings) {
  const now = Date.now();
  return (
    bookings.find((b) => {
      if (b.roomId !== roomId || b.bookingStatus !== BOOKING_STATUS.CONFIRMED) return false;
      const start = new Date(`${b.startDate}T${b.startTime}:00`).getTime();
      const end = new Date(`${b.endDate}T${b.endTime}:00`).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return now >= start && now <= end;
    }) || null
  );
}

const STATUS_FILTERS = ["All", "Available", "Occupied", "Maintenance", "Blocked"];
const EMPTY_FILTERS = { status: "All", capacity: "All" };

export default function AdminRooms() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  const [catalog, setCatalog] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [detailsRoom, setDetailsRoom] = useState(null); // room
  const [blockTarget, setBlockTarget] = useState(null); // room
  const [unblockTarget, setUnblockTarget] = useState(null); // { room, info }
  const [reasonTarget, setReasonTarget] = useState(null); // { room, info }
  const [formModal, setFormModal] = useState(null); // { mode: "add"|"edit", room }
  const [deleteTarget, setDeleteTarget] = useState(null); // room

  function refresh() {
    setCatalog(getAllRooms());
    setBookings(getAllBookings());
  }

  useEffect(() => {
    refresh();
    const bump = () => {
      setTick((t) => t + 1);
      refresh();
    };
    window.addEventListener(ROOM_STATUS_EVENT, bump);
    window.addEventListener(ROOMS_EVENT, bump);
    return () => {
      window.removeEventListener(ROOM_STATUS_EVENT, bump);
      window.removeEventListener(ROOMS_EVENT, bump);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const rooms = useMemo(() => {
    // eslint-disable-next-line no-unused-expressions
    tick; // dependency: force recompute on room-status changes
    return catalog.map((room) => {
      const availability = getRoomAvailability(room.id);
      const unresolvedIssues = getUnresolvedIssuesForRoom(room.id);
      const hasCritical = unresolvedIssues.some((i) => i.priority === PRIORITY.CRITICAL);
      const currentBooking = getCurrentBookingForRoom(room.id, bookings);
      const isOccupied = availability.status === ROOM_AVAILABILITY.AVAILABLE && !!currentBooking;
      const displayStatus = isOccupied ? "OCCUPIED" : availability.status;
      return { room, availability, unresolvedIssues, hasCritical, currentBooking, isOccupied, displayStatus };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [tick, bookings, catalog]);

  const counts = useMemo(() => {
    const c = { Available: 0, Occupied: 0, Maintenance: 0, Blocked: 0 };
    rooms.forEach((r) => {
      if (r.isOccupied) c.Occupied += 1;
      else if (r.availability.status === ROOM_AVAILABILITY.AVAILABLE) c.Available += 1;
      else if (r.availability.status === ROOM_AVAILABILITY.MAINTENANCE) c.Maintenance += 1;
      else c.Blocked += 1;
    });
    return c;
  }, [rooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filters.status !== "All" && r.displayStatus !== filters.status.toUpperCase()) return false;
      if (filters.capacity !== "All") {
        const bucket = CAPACITY_BUCKETS.find((b) => b.id === filters.capacity);
        if (bucket && !bucket.test(r.room.capacity)) return false;
      }
      if (!q) return true;
      return (
        r.room.name.toLowerCase().includes(q) ||
        r.room.roomNumber.toLowerCase().includes(q) ||
        String(r.room.floor).includes(q)
      );
    });
  }, [rooms, filters, query]);

  const filtersActive = query.trim() !== "" || Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  function handleBlockSubmit({ reason }) {
    setBusy(true);
    setTimeout(() => {
      blockRoom({
        roomId: blockTarget.id,
        roomName: blockTarget.name,
        reason,
        relatedIssueId: null,
        blockedBy: user.name,
      });
      setBusy(false);
      setToast(`${blockTarget.name} blocked for maintenance.`);
      setBlockTarget(null);
    }, 350);
  }

  function handleUnblockConfirm() {
    setBusy(true);
    setTimeout(() => {
      unblockRoom(unblockTarget.room.id);
      setBusy(false);
      setToast(`${unblockTarget.room.name} is available again.`);
      setUnblockTarget(null);
    }, 300);
  }

  function handleRoomFormSubmit(values) {
    setBusy(true);
    setTimeout(() => {
      if (formModal.mode === "edit") {
        updateRoom(formModal.room.id, values);
        setToast(`${values.name} updated.`);
      } else {
        addRoom(values);
        setToast(`${values.name} added to the room catalog.`);
      }
      refresh();
      setBusy(false);
      setFormModal(null);
    }, 300);
  }

  function handleDeleteConfirm() {
    setBusy(true);
    setTimeout(() => {
      deleteRoom(deleteTarget.id);
      refresh();
      setBusy(false);
      setToast(`${deleteTarget.name} removed from the room catalog.`);
      setDeleteTarget(null);
      setDetailsRoom(null);
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Rooms"
        description="Add, edit, and configure bookable rooms and facilities."
        actions={
          <button
            type="button"
            onClick={() => setFormModal({ mode: "add", room: null })}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Icon name="plusSquare" className="h-4 w-4" />
            Add Room
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon="door" label="Total Rooms" value={catalog.length} />
        <StatCard icon="checkCircle" label="Available" value={counts.Available} tone="emerald" />
        <StatCard icon="usersSmall" label="Occupied" value={counts.Occupied} tone="indigo" />
        <StatCard icon="tool" label="Maintenance" value={counts.Maintenance} tone="amber" />
        <StatCard icon="ban" label="Blocked" value={counts.Blocked} tone="rose" />
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
        <EmptyState hasAny={rooms.length > 0} onReset={resetFilters} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <RoomAdminCard
              key={r.room.id}
              data={r}
              onViewDetails={() => setDetailsRoom(r)}
              onEdit={() => setFormModal({ mode: "edit", room: r.room })}
              onDelete={() => setDeleteTarget(r.room)}
              onBlock={() => setBlockTarget(r.room)}
              onUnblock={() => setUnblockTarget({ room: r.room, info: r.availability })}
              onViewReason={() => setReasonTarget({ room: r.room, info: r.availability })}
            />
          ))}
        </div>
      )}

      {detailsRoom && (
        <RoomDetailsModal
          data={detailsRoom}
          onClose={() => setDetailsRoom(null)}
          onEdit={() => {
            setFormModal({ mode: "edit", room: detailsRoom.room });
            setDetailsRoom(null);
          }}
          onDelete={() => setDeleteTarget(detailsRoom.room)}
          onBlock={() => {
            setBlockTarget(detailsRoom.room);
            setDetailsRoom(null);
          }}
          onUnblock={() => {
            setUnblockTarget({ room: detailsRoom.room, info: detailsRoom.availability });
            setDetailsRoom(null);
          }}
        />
      )}

      <RoomFormModal
        open={!!formModal}
        mode={formModal?.mode}
        room={formModal?.room}
        busy={busy}
        onSubmit={handleRoomFormSubmit}
        onCancel={() => setFormModal(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this room?"
        message={
          deleteTarget
            ? `${deleteTarget.name} (${deleteTarget.roomNumber}) will be removed from the room catalog and can no longer be selected for new bookings. Existing bookings for this room are kept as historical records.`
            : ""
        }
        confirmLabel="Remove Room"
        danger
        busy={busy}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <BlockRoomFormModal
        open={!!blockTarget}
        room={blockTarget}
        busy={busy}
        onSubmit={handleBlockSubmit}
        onCancel={() => setBlockTarget(null)}
      />

      <MaintenanceReasonModal
        open={!!reasonTarget}
        room={reasonTarget?.room}
        info={reasonTarget?.info}
        onViewIssue={(issueId) => navigate(`/admin/issues/${issueId}`)}
        onClose={() => setReasonTarget(null)}
      />

      <ConfirmDialog
        open={!!unblockTarget}
        title="Unblock this room?"
        message={
          unblockTarget?.info?.relatedIssueId &&
          rooms.find((r) => r.room.id === unblockTarget.room.id)?.hasCritical
            ? `${unblockTarget?.room.name} still has an unresolved critical issue. Unblocking it now will make the room bookable again even though the issue isn't fixed yet. Continue anyway?`
            : `${unblockTarget?.room.name} will be marked AVAILABLE and can be booked again immediately.`
        }
        confirmLabel="Unblock Room"
        danger={rooms.find((r) => r.room.id === unblockTarget?.room.id)?.hasCritical}
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 grid-cols-2 gap-2 sm:w-72 sm:grid-cols-2">
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={STATUS_FILTERS} />
          <Select
            label="Capacity"
            value={filters.capacity}
            onChange={(v) => set("capacity", v)}
            options={["All", ...CAPACITY_BUCKETS.map((b) => b.id)]}
            display={(v) => (v === "All" ? "All" : CAPACITY_BUCKETS.find((b) => b.id === v)?.label || v)}
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
            placeholder="Search room name, number, floor…"
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

function Select({ label, value, onChange, options, display }) {
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
            {display ? display(opt) : String(opt).replace(/_/g, " ")}
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
        <Icon name="door" className="h-6 w-6" />
      </div>
      <p className="text-sm font-semibold text-slate-700">
        {hasAny ? "No rooms match your filters" : "No rooms configured yet"}
      </p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">
        {hasAny ? "Try clearing filters or searching for something else." : "Rooms added to the catalog will show up here."}
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

function RoomAdminCard({ data, onViewDetails, onEdit, onDelete, onBlock, onUnblock, onViewReason }) {
  const { room, availability, unresolvedIssues, hasCritical, currentBooking, isOccupied, displayStatus } = data;
  const isAvailable = availability.status === ROOM_AVAILABILITY.AVAILABLE;

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isAvailable ? "border-slate-200" : "border-orange-200"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={onViewDetails}>
          <h3 className="truncate text-sm font-semibold text-slate-900">{room.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {room.roomNumber} &middot; Floor {room.floor} &middot; {room.capacity} people
          </p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {room.includedAmenities.slice(0, 4).map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
            <Icon name={AMENITY_MAP[id]?.icon} className="h-3 w-3" />
            {AMENITY_MAP[id]?.label || id}
          </span>
        ))}
        {room.includedAmenities.length > 4 && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
            +{room.includedAmenities.length - 4} more
          </span>
        )}
      </div>

      {isOccupied && currentBooking && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-indigo-50 px-2.5 py-2 text-xs text-indigo-700">
          <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">
            {currentBooking.clientName} until {formatTime12h(currentBooking.endTime)}
          </span>
        </div>
      )}

      {!isAvailable && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500">
          <Icon
            name={availability.status === ROOM_AVAILABILITY.MAINTENANCE ? "tool" : "ban"}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
          />
          <span className="line-clamp-2">{availability.reason}</span>
        </div>
      )}

      {unresolvedIssues.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              hasCritical ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
            }`}
          >
            <Icon name="alert" className="h-3 w-3" />
            {unresolvedIssues.length} unresolved issue{unresolvedIssues.length > 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onViewDetails}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Icon name="clipboardList" className="h-3.5 w-3.5" />
          View
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <Icon name="edit" className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
          Remove
        </button>
        {!isAvailable && (
          <button
            type="button"
            onClick={onViewReason}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Reason
          </button>
        )}
        {isAvailable ? (
          <button
            type="button"
            onClick={onBlock}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <Icon name="ban" className="h-3.5 w-3.5" />
            Block
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnblock}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Icon name="checkCircle" className="h-3.5 w-3.5" />
            Unblock
          </button>
        )}
      </div>
    </div>
  );
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

function RoomDetailsModal({ data, onClose, onEdit, onDelete, onBlock, onUnblock }) {
  const { room, availability, currentBooking, displayStatus, unresolvedIssues } = data;
  const isAvailable = availability.status === ROOM_AVAILABILITY.AVAILABLE;

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
            <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">{room.roomNumber}</p>
            <h3 className="text-base font-semibold text-slate-900">{room.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-slate-500">{room.description}</p>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Floor</span>
            <span className="font-medium text-slate-800">{room.floor}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Capacity</span>
            <span className="font-medium text-slate-800">{room.capacity} people</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Price / hour</span>
            <span className="font-medium text-slate-800">₹{room.pricePerHour.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-500">Amenities</span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {room.includedAmenities.map((id) => (
                <span key={id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {AMENITY_MAP[id]?.label || id}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="text-slate-500">Status</span>
            <StatusBadge status={displayStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Active</span>
            <span className={`font-medium ${room.isActive ? "text-emerald-600" : "text-slate-400"}`}>
              {room.isActive ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Created</span>
            <span className="font-medium text-slate-800">{formatDateTime(room.createdAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Last Updated</span>
            <span className="font-medium text-slate-800">{formatDateTime(room.updatedAt)}</span>
          </div>
          {currentBooking && (
            <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-700">
              <p className="font-semibold">Currently booked by {currentBooking.clientName}</p>
              <p className="mt-0.5">
                {formatTime12h(currentBooking.startTime)} &ndash; {formatTime12h(currentBooking.endTime)} &middot;{" "}
                {formatDuration(currentBooking.durationHours)}
              </p>
            </div>
          )}
          {!isAvailable && (
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">
                {availability.status === ROOM_AVAILABILITY.MAINTENANCE ? "Under maintenance" : "Blocked"}
              </p>
              <p className="mt-0.5">{availability.reason}</p>
            </div>
          )}
          {unresolvedIssues.length > 0 && (
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700">
              {unresolvedIssues.length} unresolved issue{unresolvedIssues.length > 1 ? "s" : ""} reported for this room.
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {isAvailable ? (
            <button
              type="button"
              onClick={onBlock}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
            >
              Block Room
            </button>
          ) : (
            <button
              type="button"
              onClick={onUnblock}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              Unblock Room
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Edit Room
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
          Remove Room
        </button>
      </div>
    </div>
  );
}
