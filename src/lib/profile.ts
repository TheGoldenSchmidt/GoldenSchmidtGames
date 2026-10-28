import type { GuestProfile } from "../../shared/types";

const PROFILE_KEY = "spielraum.profile.v1";

export function loadProfile(): GuestProfile {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as GuestProfile;
      if (parsed.id) return parsed;
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
}

export function displayName(profile: GuestProfile) {
  return profile.username.trim() || `Gast ${profile.id.slice(0, 4).toUpperCase()}`;
}
