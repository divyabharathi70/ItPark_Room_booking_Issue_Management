import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/icons/Icon";
import ConfirmDialog from "../../components/booking/ConfirmDialog";
import { CAPACITY_BUCKETS } from "../../data/mockRooms";
import { DURATION_UNITS, BOOKING_STATUS } from "../../utils/bookingStorage";
import { PRIORITY_ORDER } from "../../utils/issueStorage";
import { getSettings, saveSettings, resetSettings, clearSettings } from "../../utils/settingsStorage";

const DURATION_PRESETS = [
  { id: "1h", label: "1 Hour" },
  { id: "4h", label: "4 Hours" },
  { id: "1d", label: "1 Day" },
  { id: "1w", label: "1 Week" },
  { id: "1m", label: "1 Month" },
];

const CANCELLATION_POLICIES = [
  { id: "flexible", label: "Flexible", hint: "Cancel any time before start" },
  { id: "moderate", label: "Moderate", hint: "Cancel up to 24h before start" },
  { id: "strict", label: "Strict", hint: "Cancellations are discouraged" },
];

const BOOKING_STATUS_OPTIONS = [
  { id: BOOKING_STATUS.PENDING, label: "Pending (needs review)" },
  { id: BOOKING_STATUS.CONFIRMED, label: "Confirmed (auto-approve)" },
];

function titleCase(s) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function AdminSettings() {
  const { user } = useAuth();

  const [settings, setSettings] = useState(getSettings());
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "reset" | "clear" | null

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function update(section, field, value) {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
    setDirty(true);
  }

  function handleSave() {
    setBusy(true);
    setTimeout(() => {
      const saved = saveSettings(settings);
      setSettings(saved);
      setBusy(false);
      setDirty(false);
      setToast("Settings saved.");
    }, 300);
  }

  function handleReset() {
    setBusy(true);
    setTimeout(() => {
      const next = resetSettings();
      setSettings(next);
      setBusy(false);
      setDirty(false);
      setConfirmAction(null);
      setToast("Settings reset to defaults.");
    }, 300);
  }

  function handleClear() {
    setBusy(true);
    setTimeout(() => {
      const next = clearSettings();
      setSettings(next);
      setBusy(false);
      setDirty(false);
      setConfirmAction(null);
      setToast("Saved settings cleared.");
    }, 300);
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure system preferences and defaults."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmAction("reset")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Icon name="clock" className="h-4 w-4" />
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="check" className="h-4 w-4" />
              Save settings
            </button>
          </div>
        }
      />

      {dirty && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Icon name="alert" className="h-4 w-4 shrink-0" />
          You have unsaved changes. Click "Save settings" to persist them.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="General" icon="building" description="Park identity and system-wide defaults.">
          <Field label="Park / System Name">
            <input
              type="text"
              value={settings.general.parkName}
              onChange={(e) => update("general", "parkName", e.target.value)}
              placeholder="IT Park"
              className={inputCls}
            />
            <Hint>Shown as the brand name in the sidebar for every role.</Hint>
          </Field>

          <Field label="Default Booking Duration">
            <SelectPills
              options={DURATION_PRESETS}
              value={settings.general.defaultBookingDuration}
              onChange={(v) => update("general", "defaultBookingDuration", v)}
            />
            <Hint reference>Reference default — the booking flow still lets clients pick any duration.</Hint>
          </Field>

          <Field label="Default Advance Booking Period">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={365}
                value={settings.general.defaultAdvanceBookingDays}
                onChange={(e) => update("general", "defaultAdvanceBookingDays", Number(e.target.value))}
                className={`${inputCls} w-28`}
              />
              <span className="text-sm text-slate-500">days ahead</span>
            </div>
            <Hint reference>How far in advance bookings are expected to be made, for reporting purposes.</Hint>
          </Field>

          <Field label="Default Cancellation Policy">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CANCELLATION_POLICIES.map((p) => (
                <RadioCard
                  key={p.id}
                  active={settings.general.defaultCancellationPolicy === p.id}
                  title={p.label}
                  subtitle={p.hint}
                  onClick={() => update("general", "defaultCancellationPolicy", p.id)}
                />
              ))}
            </div>
            <Hint reference>The current booking model doesn't yet enforce a cancellation window — saved for future use.</Hint>
          </Field>
        </Section>

        <Section title="Booking" icon="calendar" description="Defaults for the client booking flow.">
          <ToggleField
            label="Enable Booking Functionality"
            description="Master switch for whether clients can create new bookings."
            checked={settings.booking.bookingEnabled}
            onChange={(v) => update("booking", "bookingEnabled", v)}
            reference
          />
          <ToggleField
            label="Allow Booking Extensions"
            description="Whether clients can request an extension on a confirmed booking."
            checked={settings.booking.allowExtensions}
            onChange={(v) => update("booking", "allowExtensions", v)}
            reference
          />

          <Field label="Maximum Booking Duration">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={settings.booking.maxBookingDurationValue}
                onChange={(e) => update("booking", "maxBookingDurationValue", Number(e.target.value))}
                className={`${inputCls} w-24`}
              />
              <select
                value={settings.booking.maxBookingDurationUnit}
                onChange={(e) => update("booking", "maxBookingDurationUnit", e.target.value)}
                className={selectCls}
              >
                {DURATION_UNITS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <Hint reference>Longest stay a client should be able to book, e.g. 5 Years.</Hint>
          </Field>

          <Field label="Default Booking Status">
            <select
              value={settings.booking.defaultBookingStatus}
              onChange={(e) => update("booking", "defaultBookingStatus", e.target.value)}
              className={selectCls}
            >
              {BOOKING_STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Hint reference>Status a new booking should start in before any manual review.</Hint>
          </Field>
        </Section>

        <Section title="Room" icon="door" description="Defaults for room capacity and maintenance behavior.">
          <Field label="Default Room Capacity">
            <SelectPills
              options={CAPACITY_BUCKETS.map((b) => ({ id: b.id, label: b.label }))}
              value={settings.room.defaultCapacityBucket}
              onChange={(v) => update("room", "defaultCapacityBucket", v)}
            />
            <Hint reference>Bucket suggested first when adding a new room.</Hint>
          </Field>

          <ToggleField
            label="Auto-mark Unavailable on Maintenance"
            description="A room under maintenance is treated as unavailable for booking."
            checked={settings.room.autoMarkUnavailableOnMaintenance}
            onChange={(v) => update("room", "autoMarkUnavailableOnMaintenance", v)}
            reference
          />
          <ToggleField
            label="Maintenance Requires Approval"
            description="Marking a room for maintenance needs a second admin sign-off."
            checked={settings.room.maintenanceRequiresApproval}
            onChange={(v) => update("room", "maintenanceRequiresApproval", v)}
            reference
          />
        </Section>

        <Section title="Issues" icon="alert" description="Defaults for issue handling and assignment.">
          <Field label="Default Issue Priority">
            <SelectPills
              options={PRIORITY_ORDER.map((p) => ({ id: p, label: titleCase(p) }))}
              value={settings.issues.defaultPriority}
              onChange={(v) => update("issues", "defaultPriority", v)}
            />
            <Hint reference>Used when a raised issue's category has no suggested priority of its own.</Hint>
          </Field>

          <ToggleField
            label="Auto-escalate Critical Issues"
            description="Critical-priority issues are flagged for immediate admin attention."
            checked={settings.issues.autoEscalateCritical}
            onChange={(v) => update("issues", "autoEscalateCritical", v)}
            reference
          />
          <ToggleField
            label="Auto-assign to Least-busy Worker"
            description="New issues are suggested to the worker with the fewest open assignments."
            checked={settings.issues.autoAssignToLeastBusyWorker}
            onChange={(v) => update("issues", "autoAssignToLeastBusyWorker", v)}
            reference
          />
        </Section>

        <Section
          title="Notifications"
          icon="bell"
          description="Control which system notifications are created."
          className="lg:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ToggleField
              compact
              label="Booking Notifications"
              description="Booking confirmed & payment alerts."
              checked={settings.notifications.bookings}
              onChange={(v) => update("notifications", "bookings", v)}
            />
            <ToggleField
              compact
              label="Issue Notifications"
              description="Created, assigned & status-change alerts."
              checked={settings.notifications.issues}
              onChange={(v) => update("notifications", "issues", v)}
            />
            <ToggleField
              compact
              label="Maintenance Notifications"
              description="Maintenance started & completed alerts."
              checked={settings.notifications.maintenance}
              onChange={(v) => update("notifications", "maintenance", v)}
            />
            <ToggleField
              compact
              label="Critical Alerts"
              description="Critical-priority issue alerts."
              checked={settings.notifications.critical}
              onChange={(v) => update("notifications", "critical", v)}
            />
          </div>
          <p className="mt-4 text-xs text-slate-400">
            These four toggles are live — turning one off stops that category of notification from being created
            anywhere in the app, including for other roles.
          </p>
        </Section>
      </div>

      <div className="mt-6 flex flex-col items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-rose-700">Clear all saved settings</p>
          <p className="mt-0.5 text-xs text-rose-500">
            Removes every saved preference from this browser and reverts to defaults. This can't be undone.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmAction("clear")}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
        >
          <Icon name="trash" className="h-4 w-4" />
          Clear settings
        </button>
      </div>

      <ConfirmDialog
        open={confirmAction === "reset"}
        busy={busy}
        title="Reset settings to defaults?"
        message="Every field on this page will be restored to its original default value. Unsaved changes will be lost."
        confirmLabel="Yes, reset"
        cancelLabel="Cancel"
        onConfirm={handleReset}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === "clear"}
        danger
        busy={busy}
        title="Clear all saved settings?"
        message="This removes the saved settings entirely from this browser's storage. The app will fall back to default behavior."
        confirmLabel="Yes, clear"
        cancelLabel="Cancel"
        onConfirm={handleClear}
        onCancel={() => setConfirmAction(null)}
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

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";
const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

function Section({ title, icon, description, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Icon name={icon} className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children, reference }) {
  return (
    <p className={`mt-1.5 text-[11px] ${reference ? "text-slate-400" : "text-slate-400"}`}>
      {reference && <span className="mr-1 font-semibold text-slate-400">Reference —</span>}
      {children}
    </p>
  );
}

function SelectPills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            value === opt.id
              ? "bg-indigo-600 text-white shadow-sm"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RadioCard({ active, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"
      }`}
    >
      <p className={`text-xs font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}>{title}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
    </button>
  );
}

function ToggleField({ label, description, checked, onChange, reference, compact }) {
  return (
    <div className={`flex items-start justify-between gap-3 ${compact ? "rounded-xl border border-slate-100 p-3" : ""}`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {reference && <span className="mr-1 font-semibold text-slate-400">Reference —</span>}
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-indigo-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
