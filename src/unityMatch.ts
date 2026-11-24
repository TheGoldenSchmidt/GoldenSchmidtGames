import type { MatchState } from "../shared/matches/types";
import type { TankGame } from "../shared/matches/tankTrouble";

/**
 * Unity as the rendering of a room's match: the room authority keeps computing with the rules
 * from `shared/`, one Unity build per page stays loaded (it starts during the minigame intro)
 * and draws the snapshots under the app's own controls, HUD and countdown. Messages run by
 * `postMessage` between the app and its own iframe only (same origin, sender checked).
 */
export const UNITY_MATCH_URL = "/unity/spiele/index.html?spiel=online";

/** Match modules with a Unity rendering → game id in the Unity build (`GameSwitch`). */
export const UNITY_MATCH_SCENES: Readonly<Record<string, string>> = { tanks: "tanks", tankview: "tanks" };
export const hasUnityMatch = (matchId: string) => matchId in UNITY_MATCH_SCENES;

export interface UnityMessage { type: string; yaw?: number }
type Listener = (message: UnityMessage) => void;

/** The persistent Unity frame of the current page (mounted by `UnityMatchHost`). */
class UnityStage {
  private frame?: HTMLIFrameElement;
  private listeners = new Set<Listener>();
  ready = false;

  attach(frame: HTMLIFrameElement | undefined) { this.frame = frame; if (!frame) { this.ready = false; this.show(false); } }
  isFrame(source: MessageEventSource | null) { return !!this.frame && source === this.frame.contentWindow; }
  post(payload: object) { this.frame?.contentWindow?.postMessage({ source: "gsg-app", payload }, window.location.origin); }
  listen(listener: Listener) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  receive(message: UnityMessage) {
    if (message.type === "ready") this.ready = true;
    for (const listener of this.listeners) listener(message);
  }
  show(on: boolean) { this.frame?.parentElement?.classList.toggle("is-shown", on); }
}
export const unityStage = new UnityStage();

/** Seats for the Unity scene: colour slot, name and the figure chosen in the app (Unity falls back to a base human). */
export function unityMatchSetup(s: MatchState, viewer: string, view: string, reduced: boolean, names: Record<string, string>, characters: Record<string, string | undefined>) {
  return {
    type: "setup", game: UNITY_MATCH_SCENES[s.id], view, viewer, reduced,
    players: s.players.map(p => ({ id: p.id, slot: p.style, name: names[p.id] ?? "", figure: characters[p.id] ?? "" }))
  };
}

/**
 * Flat Tank Trouble snapshot for Unity's `JsonUtility` (no maps, no optional fields). In 3rd and
 * 1st person the authority only sends what the own tank sees: missing tanks arrive as `seen: false`.
 */
export function unityTankSnapshot(s: MatchState) {
  const g = s.game as TankGame, slot = (id: string) => s.players.find(p => p.id === id)?.style ?? 0;
  return {
    type: "snap", time: s.time, done: s.done, overtime: !!g.overtime, h: g.h, v: g.v,
    tanks: s.players.map(p => {
      const t = g.tanks[p.id];
      return {
        id: p.id, slot: p.style, seen: !!t, gone: p.gone, x: t?.x ?? 0, y: t?.y ?? 0, angle: t?.angle ?? 0, aim: t?.aim ?? 0,
        hp: t?.hp ?? 0, alive: t?.alive ?? false, respawnAt: t?.respawnAt ?? 0, shieldUntil: t?.shieldUntil ?? 0,
        power: t?.power?.kind ?? "", powerUntil: t?.power?.until ?? 0, kills: g.kills[p.id] ?? 0, deaths: g.deaths[p.id] ?? 0
      };
    }),
    bullets: g.bullets.map(b => ({ id: b.id, slot: slot(b.owner), x: b.x, y: b.y })),
    powers: g.powers.map(p => ({ id: p.id, kind: p.kind, x: p.x, y: p.y }))
  };
}

/** Snapshot builder per Unity game id. */
export const UNITY_SNAPSHOTS: Readonly<Record<string, (s: MatchState) => object>> = { tanks: unityTankSnapshot };
