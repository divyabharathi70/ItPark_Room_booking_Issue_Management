import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import StatusBadge from "../../components/booking/StatusBadge";
import { ROLE_HOME, ROLES } from "../../data/mockUsers";
import { seedBookingsIfEmpty, seedEmployeeBookingsIfEmpty } from "../../utils/bookingStorage";
import {
  ISSUE_CATEGORIES,
  ISSUE_STATUS,
  PRIORITY_ORDER,
  createIssue,
  generateIssueId,
  getEligibleBookingsForIssue,
  suggestPriority,
} from "../../utils/issueStorage";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RaiseIssue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const basePath = `/${user.role}/issues`;
  const dashboardPath = ROLE_HOME[user.role] || `/${user.role}/dashboard`;

  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const [bookingId, setBookingId] = useState("");
  const [activeGroup, setActiveGroup] = useState("FACILITIES");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("");
  const [priorityTouched, setPriorityTouched] = useState(false);
  const [photo, setPhoto] = useState(null); // { name, size, type, dataUrl }
  const [photoError, setPhotoError] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [createdIssue, setCreatedIssue] = useState(null);

  useEffect(() => {
    seedBookingsIfEmpty();
    seedEmployeeBookingsIfEmpty(user.id, user.name);
    const bookings = getEligibleBookingsForIssue(user.id, user.role === ROLES.CLIENT);
    setEligibleBookings(bookings);
    // Deep-linked from My Bookings > Raise Issue: pre-select that booking
    // if it's actually one of this user's eligible bookings.
    const requestedId = searchParams.get("bookingId");
    const requested = requestedId && bookings.find((b) => b.id === requestedId);
    if (requested) setBookingId(requested.id);
    else if (bookings.length === 1) setBookingId(bookings[0].id);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.name]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedBooking = useMemo(
    () => eligibleBookings.find((b) => b.id === bookingId) || null,
    [eligibleBookings, bookingId]
  );

  function handleSelectCategory(value) {
    setCategory(value);
    if (!priorityTouched) {
      setPriority(suggestPriority(value));
    }
    setErrors((e) => ({ ...e, category: undefined }));
  }

  function handleSelectPriority(value) {
    setPriority(value);
    setPriorityTouched(true);
    setErrors((e) => ({ ...e, priority: undefined }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Unsupported file type. Please upload a JPG, PNG, WEBP, or GIF image.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError(`Image is too large (${formatBytes(file.size)}). Max size is 3 MB.`);
      return;
    }

    setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto({ name: file.name, size: file.size, type: file.type, dataUrl: reader.result });
    };
    reader.onerror = () => {
      setPhotoError("Couldn't read that file. Please try a different image.");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoError("");
  }

  function validate() {
    const next = {};
    if (!bookingId) next.booking = "Select the booking this issue relates to.";
    if (!category) next.category = "Choose an issue category.";
    if (!description.trim()) next.description = "Describe the issue.";
    else if (description.trim().length < 10) next.description = "Please add a little more detail (10+ characters).";
    if (!priority) next.priority = "Select a priority.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate() || !selectedBooking) return;

    setSubmitting(true);
    const now = new Date().toISOString();
    const issue = {
      id: generateIssueId(),
      employeeId: user.id,
      employeeName: user.name,
      reporterRole: user.role,
      organization: user.organization || "IT Park Internal Staff",
      // Explicit client-identity fields (Raise Issue requirement): only
      // populated when the reporter is actually a Client, and always
      // derived from the logged-in session — never something the client
      // can type in, so nobody can attach another client's identity to
      // an issue.
      clientId: user.role === ROLES.CLIENT ? user.id : null,
      clientEmail: user.role === ROLES.CLIENT ? user.email : null,
      bookingId: selectedBooking.id,
      roomId: selectedBooking.roomId,
      roomName: selectedBooking.roomName,
      roomNumber: selectedBooking.roomNumber,
      category,
      categoryGroup: activeGroup,
      description: description.trim(),
      priority,
      photo: photo ? { name: photo.name, dataUrl: photo.dataUrl } : null,
      status: ISSUE_STATUS.OPEN,
      createdDate: now,
      lastUpdated: now,
      assignedWorker: null,
      resolutionNotes: "",
    };

    // Simulate a brief submit delay for a realistic feel — this is a
    // frontend-only mock, there's no real network call here.
    setTimeout(() => {
      const saved = createIssue(issue);
      setCreatedIssue(saved || issue);
      setSubmitting(false);
      setToast("Issue submitted successfully.");
    }, 450);
  }

  function resetForm() {
    setCreatedIssue(null);
    setBookingId(eligibleBookings.length === 1 ? eligibleBookings[0].id : "");
    setCategory("");
    setDescription("");
    setPriority("");
    setPriorityTouched(false);
    setPhoto(null);
    setPhotoError("");
    setErrors({});
  }

  if (!loaded) return null;

  // ---- No eligible booking: block the form ----
  if (!createdIssue && eligibleBookings.length === 0) {
    return (
      <div>
        <PageHeader title="Raise an Issue" />
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Icon name="alert" className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <h2 className="text-base font-semibold text-slate-900">No eligible booking yet</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            You can raise an issue against a pending or confirmed booking. Once you have one, it'll show up here automatically.
          </p>
          <Link
            to={dashboardPath}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ---- Success screen ----
  if (createdIssue) {
    return (
      <div>
        <PageHeader title="Issue Submitted" />
        <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="checkCircle" className="h-9 w-9" strokeWidth={1.6} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Thanks, {user.name.split(" ")[0]}!</h2>
          <p className="mt-1 text-sm text-slate-500">
            Issue <span className="font-mono font-semibold text-slate-700">{createdIssue.id}</span> has been logged
            and is now open.
          </p>

          <div className="mt-6 space-y-2.5 rounded-xl bg-slate-50 p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Room</span>
              <span className="font-medium text-slate-800">{createdIssue.roomName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Category</span>
              <span className="font-medium text-slate-800">{createdIssue.category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Priority</span>
              <StatusBadge status={createdIssue.priority} />
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={createdIssue.status} />
            </div>
            {createdIssue.assignedWorker && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assigned Worker</span>
                <span className="font-medium text-slate-800">{createdIssue.assignedWorker}</span>
              </div>
            )}
            {createdIssue.photo && (
              <div className="border-t border-slate-200 pt-2.5">
                <p className="mb-1.5 text-slate-500">Attached photo</p>
                <img
                  src={createdIssue.photo.dataUrl}
                  alt={createdIssue.photo.name}
                  className="h-28 w-full rounded-lg object-cover"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate(`${basePath}/${createdIssue.id}`)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              View Issue
            </button>
            <Link
              to={basePath}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Go to My Issues
            </Link>
            <Link
              to={dashboardPath}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Return to Dashboard
            </Link>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Raise another issue
          </button>
        </div>
      </div>
    );
  }

  // ---- Form ----
  return (
    <div>
      <PageHeader
        title="Raise an Issue"
        description="Report a problem with a room from one of your eligible bookings."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Booking */}
          <Section title="Booking" description="Pick the booking this issue relates to.">
            <div className="space-y-2.5">
              {eligibleBookings.map((b) => {
                const selected = b.id === bookingId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBookingId(b.id);
                      setErrors((e) => ({ ...e, booking: undefined }));
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      selected ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 bg-white hover:border-indigo-200"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 text-transparent"
                        }`}
                      >
                        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-slate-800">
                          {b.roomName} ({b.roomNumber})
                        </span>
                        <span className="block text-xs text-slate-500">
                          {formatDateLong(b.startDate)} &middot; {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{b.id}</span>
                  </button>
                );
              })}
            </div>
            {errors.booking && <ErrorText text={errors.booking} />}
          </Section>

          {/* Room (auto-filled) */}
          {selectedBooking && (
            <Section title="Room">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
                  <Icon name="door" className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{selectedBooking.roomName}</p>
                  <p className="text-xs text-slate-500">
                    {selectedBooking.roomNumber} &middot; Floor {selectedBooking.floor}
                  </p>
                </div>
              </div>
            </Section>
          )}

          {/* Category */}
          <Section title="Issue Category" description="Choose the group, then the specific issue.">
            <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
              {Object.entries(ISSUE_CATEGORIES).map(([key, group]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveGroup(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    activeGroup === key ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon name={group.icon} className="h-3.5 w-3.5" />
                  {group.label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ISSUE_CATEGORIES[activeGroup].items.map((item) => {
                const selected = category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelectCategory(item.value)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                      selected
                        ? "border-indigo-300 bg-indigo-50/60 font-semibold text-indigo-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
                    }`}
                  >
                    {item.label}
                    {selected && <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>
            {errors.category && <ErrorText text={errors.category} />}
          </Section>

          {/* Description */}
          <Section title="Description" description="What's wrong? Add any details that'll help a worker fix it fast.">
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (e.target.value.trim().length >= 10) setErrors((er) => ({ ...er, description: undefined }));
              }}
              rows={4}
              maxLength={600}
              placeholder="e.g. The AC in the room has stopped cooling since this morning's meeting started."
              className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.description
                  ? "border-rose-300 focus:ring-rose-200"
                  : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
              }`}
            />
            <div className="mt-1 flex items-center justify-between">
              {errors.description ? <ErrorText text={errors.description} /> : <span />}
              <span className="text-[11px] text-slate-400">{description.length}/600</span>
            </div>
          </Section>

          {/* Photo */}
          <Section title="Photo (optional)" description="Attach a photo of the issue — JPG, PNG, WEBP or GIF, up to 3 MB.">
            {!photo ? (
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
                    <Icon name="upload" className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-medium text-slate-600">Click to upload a photo</span>
                  <span className="text-xs text-slate-400">JPG, PNG, WEBP or GIF — max 3 MB</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
                <img src={photo.dataUrl} alt={photo.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{photo.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(photo.size)}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Change photo
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-600"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>
            )}
            {photoError && <ErrorText text={photoError} />}
          </Section>

          {/* Priority */}
          <Section
            title="Priority"
            description="Suggested automatically from the category you picked — change it if needed."
          >
            <div className="flex flex-wrap gap-2">
              {PRIORITY_ORDER.map((p) => {
                const selected = priority === p;
                const suggested = category && suggestPriority(category) === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleSelectPriority(p)}
                    className={`relative rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-inset transition ${
                      selected
                        ? PRIORITY_RING[p]
                        : "bg-white text-slate-500 ring-slate-200 hover:ring-slate-300"
                    }`}
                  >
                    {p}
                    {suggested && !priorityTouched && selected && (
                      <span className="ml-1.5 rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                        Suggested
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {errors.priority && <ErrorText text={errors.priority} />}
          </Section>
        </div>

        {/* Summary sidebar */}
        <div className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Issue summary</p>
            <div className="space-y-3 text-sm">
              <MiniRow icon="door" label={selectedBooking ? selectedBooking.roomName : "No booking selected"} />
              <MiniRow icon="tag" label={category || "No category selected"} />
              <MiniRow
                icon="user"
                label={`${user.name} · ${user.organization || "IT Park Internal Staff"}`}
              />
            </div>
            {priority && (
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-200 pt-4">
                <span className="text-xs text-slate-400">Priority</span>
                <StatusBadge status={priority} />
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Icon name="spinner" className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Icon name="megaphone" className="h-4 w-4" />
                  Submit Issue
                </>
              )}
            </button>
          </div>
        </div>
      </form>

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

const PRIORITY_RING = {
  LOW: "bg-slate-600 text-white ring-slate-600",
  MEDIUM: "bg-amber-500 text-white ring-amber-500",
  HIGH: "bg-orange-500 text-white ring-orange-500",
  CRITICAL: "bg-rose-600 text-white ring-rose-600",
};

function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-slate-500">{description}</p>}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </div>
  );
}

function ErrorText({ text }) {
  return <p className="mt-1.5 text-xs font-medium text-rose-500">{text}</p>;
}

function MiniRow({ icon, label }) {
  return (
    <div className="flex items-center gap-2.5 text-slate-600">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}
