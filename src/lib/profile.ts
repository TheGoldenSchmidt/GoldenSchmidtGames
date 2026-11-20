import type { GuestProfile } from "../../shared/types";

const PROFILE_KEY = "spielraum.profile.v1";

export function loadProfile(): GuestProfile {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GuestProfile;
      if (typeof parsed?.id === "string" && parsed.id && typeof parsed.username === "string") return parsed;
    }
  } catch {
    // Ein beschädigtes lokales Profil wird ersetzt.
  }
  const profile = { id: crypto.randomUUID(), username: "" };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function saveProfile(profile: GuestProfile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  if (!profile.id.startsWith("acct_")) localStorage.setItem("spielraum.guest.v1", JSON.stringify(profile));
}

export function loadGuestProfile(): GuestProfile {
  try {
    const saved = JSON.parse(localStorage.getItem("spielraum.guest.v1") ?? "null") as GuestProfile | null;
    if (typeof saved?.id === "string" && saved.id && typeof saved.username === "string" && !saved.id.startsWith("acct_")) return saved;
    const current = loadProfile();
    if (!current.id.startsWith("acct_")) return current;
  } catch { /* Restore an independent guest when no guest profile remains. */ }
  return { id: crypto.randomUUID(), username: "" };
}

export function displayName(profile: GuestProfile) {
  return profile.username.trim() || `Gast ${profile.id.slice(0, 4).toUpperCase()}`;
}
