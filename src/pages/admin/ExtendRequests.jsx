import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { formatDuration } from "../../utils/bookingStorage";
import {
  approveExtendRequest,
  getAllExtendRequests,
  rejectExtendRequest,
  EXTEND_REQUESTS_EVENT,
  EXTEND_STATUS,
} from "../../utils/extendRequestStorage";

function formatTime12h(hhmm) {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDateLong(dateStr) {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TABS = ["Pending", "Approved", "Rejected", "All"];

export default function AdminExtendRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("Pending");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState(null);

  function refresh() {
    setRequests(getAllExtendRequests());
  }

  useEffect(() => {
    refresh();
    window.addEventListener(EXTEND_REQUESTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EXTEND_REQUESTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (tab === "All") return requests;
    return requests.filter((r) => r.status === tab.toUpperCase());
  }, [requests, tab]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === EXTEND_STATUS.PENDING).length,
    [requests]
  );

  function handleApprove(request) {
    setBusyId(request.id);
    setBanner(null);
    setTimeout(async () => {
      const result = await approveExtendRequest(request.id, user);
      setBusyId(null);
      if (!result.ok) {
        setBanner({ tone: "error", text: result.reason });
      } else {
        setBanner({ tone: "success", text: `Extension approved — ${request.roomName} now runs to ${formatDateLong(request.requestedEndDate)}, ${formatTime12h(request.requestedEndTime)}.` });
      }
      refresh();
    }, 400);
  }

  function confirmReject() {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    setTimeout(() => {
      rejectExtendRequest(rejectTarget.id, user, rejectNote.trim());
      setBusyId(null);
      setRejectTarget(null);
      setRejectNote("");
      refresh();
    }, 400);
  }

  return (
    <div>
      <PageHeader
        title="Extension Requests"
        description="Clients asking to keep their current room for longer. Approve to push the booking's end date out, or reject with a note."
      />

      {banner && (
        <div
          className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            banner.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <Icon name={banner.tone === "success" ? "checkCircle" : "ban"} className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{banner.text}</p>
        </div>
      )}

      <div className="mb-5 flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === t ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
            {t === "Pending" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Icon name="clock" className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Nothing here</p>
          <p className="mt-1 max-w-xs text-xs text-slate-400">
            {tab === "Pending" ? "No pending extension requests right now." : `No ${tab.toLowerCase()} requests yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-wide text-slate-400">
                    {r.id} &middot; {r.bookingId}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
                    {r.roomName} ({r.roomNumber})
                  </h3>
                  <p className="text-xs text-slate-500">{r.clientName}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="mb-3 grid gap-3 rounded-xl bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
                <div>
                  <p className="text-slate-400">Current end</p>
                  <p className="font-medium text-slate-700">
                    {formatDateLong(r.currentEndDate)}, {formatTime12h(r.currentEndTime)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Requested end</p>
                  <p className="font-medium text-slate-700">
                    {formatDateLong(r.requestedEndDate)}, {formatTime12h(r.requestedEndTime)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Additional time</p>
                  <p className="font-medium text-slate-700">{formatDuration(r.additionalHours)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Est. additional charge</p>
                  <p className="font-medium text-slate-700">
                    ₹{(r.estimatedAdditionalAmount || 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              {r.reason && (
                <p className="mb-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-600">Client note: </span>"{r.reason}"
                </p>
              )}
              {r.status === EXTEND_STATUS.REJECTED && r.adminNote && (
                <p className="mb-3 text-xs text-rose-600">
                  <span className="font-semibold">Rejection note: </span>
                  {r.adminNote}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-[11px] text-slate-400">
                  Requested {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {r.resolvedAt &&
                    ` · Resolved by ${r.resolvedBy} on ${new Date(r.resolvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                </p>
                {r.status === EXTEND_STATUS.PENDING && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectTarget(r)}
                      disabled={busyId === r.id}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(r)}
                      disabled={busyId === r.id}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Approving…" : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        danger
        busy={busyId === rejectTarget?.id}
        title="Cancel this extension request?"
        message={
          rejectTarget ? (
            <span>
              This will cancel {rejectTarget.clientName}'s request to extend {rejectTarget.roomName} to the requested end date.
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder="Optional note for the client…"
                className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </span>
          ) : (
            ""
          )
        }
        confirmLabel="Cancel request"
        cancelLabel="Go back"
        onConfirm={confirmReject}
        onCancel={() => {
          setRejectTarget(null);
          setRejectNote("");
        }}
      />
    </div>
  );
}
