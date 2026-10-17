import { updateStaffOverride } from "./staffOverridesStorage";
import { getClientByEmail, updateClient } from "./clientStorage";
import { publishSharedRecords } from "./sharedDataSync";

const PROFILE_KEY = "itpark_user_profiles";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getUserProfile(id) {
  return id ? readAll()[id] || {} : {};
}

export function saveUserProfile(id, profile, user = {}) {
  if (!id) return null;
  const profiles = readAll();
  profiles[id] = { ...(profiles[id] || {}), ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  // The admin staff directories read from this shared override layer, so
  // profile edits are immediately reflected in their corresponding roster.
  const staffPatch = { name: profile.name, phone: profile.phone, profilePicture: profile.profilePicture };
  if (profile.organization !== undefined) staffPatch.organization = profile.organization;
  if (profile.department !== undefined) staffPatch.department = profile.department;
  const savedOverride = updateStaffOverride(id, staffPatch);
  const sharedUpdatedAt = savedOverride?.updatedAt || profiles[id].updatedAt;
  // Approved self-signup clients can have a session id different from the
  // clientId used by Admin > Clients. Resolve that directory record by email.
  if (user.role === "client" && user.email) {
    const client = getClientByEmail(user.email);
    if (client) {
      updateClient(client.clientId, {
        name: profile.name,
        phone: profile.phone,
        company: profile.organization,
        profilePicture: profile.profilePicture,
      });
      updateStaffOverride(client.clientId, staffPatch);
      void publishSharedRecords("staffProfiles", [{ id: client.clientId, ...staffPatch, updatedAt: sharedUpdatedAt }]);
    }
  }
  void publishSharedRecords("staffProfiles", [{ id, ...staffPatch, updatedAt: sharedUpdatedAt }]);
  window.dispatchEvent(new CustomEvent("itpark:profile-changed", { detail: { id, profile: profiles[id] } }));
  return profiles[id];
}
