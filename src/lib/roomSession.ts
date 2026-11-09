// Keep rooms independent, including when two tabs use the same guest profile.
const activeTokens = new Map<string, string>();
const storageKey = (code: string, playerId: string) => `spielraum.room.v1.${code}.${playerId}`;

export function rememberRoomToken(code: string, playerId: string, token: string) {
  const key = storageKey(code, playerId);
  activeTokens.set(key, token);
  try { localStorage.setItem(key, token); } catch { /* Still usable in this tab. */ }
}

export function tokenForJoin(code: string, playerId: string) {
  const key = storageKey(code, playerId);
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch { /* Storage may be unavailable. */ }
  const token = activeTokens.get(key) ?? crypto.randomUUID();
  rememberRoomToken(code, playerId, token);
  return token;
}

export interface ActiveSession { nearby?: import("../nearby/nearbySocket").TableRoute; code: string; playerId: string; sessionToken: string }
const activeKey = "spielraum.active-room.v1";

export function loadActiveSession(playerId: string): ActiveSession | undefined {
  try {
    const saved = JSON.parse(localStorage.getItem(activeKey) ?? "null");
    if (saved?.playerId === playerId && typeof saved.code === "string" && typeof saved.sessionToken === "string") return saved;
  } catch { /* No saved session on this device. */ }
}

export function storeActiveSession(session: ActiveSession) {
  rememberRoomToken(session.code, session.playerId, session.sessionToken);
  try {
    localStorage.setItem(activeKey, JSON.stringify(session));
    if(session.nearby?.role==="host")localStorage.setItem("spielraum.last-host.v1",JSON.stringify(session));
  } catch { /* Still active in memory. */ }
}

export function loadLastHost(playerId:string):ActiveSession|undefined {
  try {
    const saved=JSON.parse(localStorage.getItem("spielraum.last-host.v1")??"null");
    if(saved?.playerId===playerId && saved.nearby?.role==="host" && typeof saved.sessionToken==="string")return saved;
  } catch { /* No previous local host. */ }
}

export function clearActiveSession(session: ActiveSession | undefined, closed = false) {
  if (!session) return;
  try {
    if (loadActiveSession(session.playerId)?.code === session.code) localStorage.removeItem(activeKey);
    if (closed && session.nearby?.role === "host" && loadLastHost(session.playerId)?.nearby?.table === session.nearby.table) {
      localStorage.removeItem("spielraum.last-host.v1");
    }
  } catch { /* Storage may be disabled. */ }
}
