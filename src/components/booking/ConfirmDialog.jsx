import Icon from "../icons/Icon";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div
          className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${
            danger ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
          }`}
        >
          <Icon name={danger ? "ban" : "checkCircle"} className="h-5 w-5" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${
              danger ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
