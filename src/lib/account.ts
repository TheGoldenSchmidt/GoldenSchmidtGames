import type { Account } from "../../shared/accounts";
import type { GuestProfile } from "../../shared/types";

export async function accountRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/account${path}`, { method, credentials: "same-origin", cache: "no-store",
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000) });
  } catch { throw new Error("Der Kontoserver ist nicht erreichbar. Prüfe deine Verbindung."); }
  const data = await response.json().catch(() => {
    throw new Error("Die Kontoanfrage konnte nicht beantwortet werden. Versuche es später erneut.");
  });
  if (!response.ok) throw new Error(data.error ?? "Kontoanfrage fehlgeschlagen. Bitte erneut versuchen.");
  return data as T;
}
export function accountProfile(account: Account): GuestProfile {
  return { id: account.id, username: account.settings.displayName, characterId: account.settings.characterId };
}
