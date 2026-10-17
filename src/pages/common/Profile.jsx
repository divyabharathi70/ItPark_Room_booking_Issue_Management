import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS, ROLES } from "../../data/mockUsers";

const fieldClass = "mt-1 w-full rounded-md border border-blueprint-line bg-blueprint-panel px-3 py-2.5 text-sm text-blueprint-text outline-none focus:border-blueprint-amber";

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => { image.src = reader.result; };
    image.onerror = reject;
    image.onload = () => {
      const scale = Math.min(1, 512 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    reader.readAsDataURL(file);
  });
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", organization: user?.organization || "", department: user?.department || "" });
  const [picture, setPicture] = useState(user?.profilePicture || "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({ name: user?.name || "", phone: user?.phone || "", organization: user?.organization || "", department: user?.department || "" });
    setPicture(user?.profilePicture || "");
  }, [user]);

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function choosePicture(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("Choose an image file to use as your profile picture.");
      return;
    }
    setBusy(true);
    try {
      setPicture(await resizeImage(file));
      setNotice("");
    } catch {
      setNotice("That image could not be loaded. Please choose another one.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) {
      setNotice("Name is required.");
      return;
    }
    updateProfile({ name: form.name.trim(), phone: form.phone.trim() || null, organization: form.organization.trim() || null, department: form.department.trim() || null, profilePicture: picture || null });
    setNotice("Profile saved.");
  }

  const isWorker = user?.role === ROLES.WORKER;
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 text-center">
        <p className="mb-1.5 font-mono text-[11px] tracking-[0.25em] text-blueprint-amber">{`${ROLE_LABELS[user?.role] || "Account"} · Account`.toUpperCase()}</p>
        <h1 className="font-display text-2xl font-semibold text-blueprint-text">My Profile</h1>
        <p className="mt-1.5 text-sm text-blueprint-muted">Update your contact details and profile picture.</p>
      </div>
      <form onSubmit={submit} className="rounded-2xl border border-blueprint-line bg-blueprint-panel p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex flex-col items-center gap-4 border-b border-blueprint-line pb-7 text-center">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-blueprint-secondary bg-blueprint-panel2 font-mono text-3xl font-semibold text-blueprint-amber shadow-sm">
            {picture ? <img src={picture} alt="Profile" className="h-full w-full object-cover" /> : initials(form.name)}
          </div>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-semibold text-blueprint-text">Profile picture</h2>
            <p className="mt-1 text-sm text-blueprint-muted">Upload a picture to personalize your account.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <label className="cursor-pointer rounded-md border border-blueprint-steel2 px-3 py-2 text-sm text-blueprint-text transition hover:bg-blueprint-panel2">
                {busy ? "Loading…" : "Choose picture"}
                <input type="file" accept="image/*" onChange={choosePicture} disabled={busy} className="sr-only" />
              </label>
              {picture && <button type="button" onClick={() => setPicture("")} className="rounded-md px-3 py-2 text-sm text-blueprint-error hover:bg-blueprint-error/10">Remove</button>}
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-blueprint-muted">Full name<input className={fieldClass} name="name" value={form.name} onChange={change} autoComplete="name" required /></label>
          <label className="text-sm text-blueprint-muted">Email address<input className={`${fieldClass} opacity-70`} value={user?.email || ""} readOnly /></label>
          <label className="text-sm text-blueprint-muted">Phone number<input className={fieldClass} name="phone" value={form.phone} onChange={change} autoComplete="tel" /></label>
          {isWorker ? (
            <label className="text-sm text-blueprint-muted">Department<input className={fieldClass} name="department" value={form.department} onChange={change} /></label>
          ) : (
            <label className="text-sm text-blueprint-muted">{user?.role === ROLES.CLIENT ? "Company / organization" : "Organization"}<input className={fieldClass} name="organization" value={form.organization} onChange={change} /></label>
          )}
        </div>
        <div className="mt-7 flex flex-col items-center gap-3 border-t border-blueprint-line pt-6">
          <button type="submit" className="w-full rounded-md bg-blueprint-amber px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto sm:min-w-[200px]">Save changes</button>
          {notice && <p role="status" className="text-sm text-blueprint-muted">{notice}</p>}
        </div>
      </form>
    </div>
  );
}
