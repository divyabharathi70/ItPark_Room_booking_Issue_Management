import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import BlockRoomFormModal from "../../components/rooms/BlockRoomFormModal";
import MaintenanceReasonModal from "../../components/rooms/MaintenanceReasonModal";
import {
  getRoomAvailability,
  blockRoom,
  unblockRoom,
  ROOM_STATUS_EVENT,
  ROOM_AVAILABILITY,
} from "../../utils/roomStatusStorage";
import { getUnresolvedIssuesForRoom, PRIORITY } from "../../utils/issueStorage";
import { getAllRooms, ROOMS_EVENT } from "../../utils/roomStorage";

const FILTERS = ["All", "Available", "Maintenance", "Blocked"];

export default function AdminMaintenance() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const [blockTarget, setBlockTarget] = useState(null); // room
  const [unblockTarget, setUnblockTarget] = useState(null); // { room, info }
  const [reasonTarget, setReasonTarget] = useState(null); // { room, info }

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
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
    tick; // dependency: force recompute on room-status/catalog changes
    return getAllRooms().map((room) => {
      const availability = getRoomAvailability(room.id);
      const unresolvedIssues = getUnresolvedIssuesForRoom(room.id);
      const hasCritical = unresolvedIssues.some((i) => i.priority === PRIORITY.CRITICAL);
      return { room, availability, unresolvedIssues, hasCritical };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const counts = useMemo(() => {
    const c = { Available: 0, Maintenance: 0, Blocked: 0 };
    rooms.forEach((r) => {
      if (r.availability.status === ROOM_AVAILABILITY.AVAILABLE) c.Available += 1;
      else if (r.availability.status === ROOM_AVAILABILITY.MAINTENANCE) c.Maintenance += 1;
      else c.Blocked += 1;
    });
    return c;
  }, [rooms]);

  const filtered = rooms.filter((r) => {
    if (filter === "All") return true;
    return r.availability.status === filter.toUpperCase();
  });

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

  return (
    <div>
      <PageHeader
        title="Room Maintenance"
        description="Every room's live availability — block a room for maintenance, unblock it when work is done, and see exactly why any room is unavailable."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
            }`}
          >
            {f}
            {f !== "All" && (
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="door" className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No rooms match this filter</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(({ room, availability, unresolvedIssues, hasCritical }) => (
            <RoomMaintenanceCard
              key={room.id}
              room={room}
              availability={availability}
              unresolvedIssues={unresolvedIssues}
              hasCritical={hasCritical}
              onBlock={() => setBlockTarget(room)}
              onUnblock={() => setUnblockTarget({ room, info: availability })}
              onViewReason={() => setReasonTarget({ room, info: availability })}
            />
          ))}
        </div>
      )}

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

function RoomMaintenanceCard({ room, availability, unresolvedIssues, hasCritical, onBlock, onUnblock, onViewReason }) {
  const isAvailable = availability.status === ROOM_AVAILABILITY.AVAILABLE;

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isAvailable ? "border-slate-200" : "border-orange-200"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{room.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {room.roomNumber} &middot; Floor {room.floor} &middot; {room.capacity} people
          </p>
        </div>
        <StatusBadge status={availability.status} />
      </div>

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
        {!isAvailable && (
          <button
            type="button"
            onClick={onViewReason}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <Icon name="clipboardList" className="h-3.5 w-3.5" />
            View Reason
          </button>
        )}
        {isAvailable ? (
          <button
            type="button"
            onClick={onBlock}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <Icon name="ban" className="h-3.5 w-3.5" />
            Block Room
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnblock}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Icon name="checkCircle" className="h-3.5 w-3.5" />
            Unblock Room
          </button>
        )}
      </div>
    </div>
  );
}
