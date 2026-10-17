import { useRef, useState } from "react";
import Icon from "../icons/Icon";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Modal a worker uses to resolve an issue: a resolution description plus an
 * optional frontend-only photo (read as a data URL, same pattern as the
 * "Raise Issue" photo upload — nothing is ever sent to a server). On submit
 * the parent is handed { resolutionDescription, resolutionPhoto } and is
 * responsible for actually persisting the resolution.
 */
export default function ResolveIssueModal({ open, issueId, busy, onSubmit, onCancel }) {
  const fileInputRef = useRef(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null); // { name, size, dataUrl }
  const [photoError, setPhotoError] = useState("");

  if (!open) return null;

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
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
    reader.onload = () => setPhoto({ name: file.name, size: file.size, dataUrl: reader.result });
    reader.onerror = () => setPhotoError("Couldn't read that file. Please try a different image.");
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhoto(null);
    setPhotoError("");
  }

  function handleClose() {
    setDescription("");
    setError("");
    setPhoto(null);
    setPhotoError("");
    onCancel();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError("Add a little more detail (10+ characters) so the reporter knows what was fixed.");
      return;
    }
    setError("");
    onSubmit({
      resolutionDescription: description.trim(),
      resolutionPhoto: photo ? { name: photo.name, dataUrl: photo.dataUrl } : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Icon name="checkCircle" className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Mark Resolved</h3>
              <p className="text-xs text-slate-400">
                {issueId ? `Issue ${issueId}` : "Add resolution details"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resolution Description
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (e.target.value.trim().length >= 10) setError("");
              }}
              rows={4}
              maxLength={600}
              placeholder="e.g. Replaced the AC compressor capacitor and confirmed cooling is back to normal."
              className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                error ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:border-indigo-300 focus:ring-indigo-100"
              }`}
            />
            <div className="mt-1 flex items-center justify-between">
              {error ? (
                <p className="text-xs font-medium text-rose-600">{error}</p>
              ) : (
                <span />
              )}
              <span className="text-[11px] text-slate-400">{description.length}/600</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resolution Photo (optional)
            </label>
            {!photo ? (
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-7 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
                    <Icon name="upload" className="h-4.5 w-4.5" />
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
                {photoError && <p className="mt-1.5 text-xs font-medium text-rose-600">{photoError}</p>}
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
                <img src={photo.dataUrl} alt={photo.name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
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
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
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
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Mark Resolved"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
