import type { MatchState } from "../shared/matches/types";
import type { TankGame } from "../shared/matches/tankTrouble";
import type { RingGame } from "../shared/matches/ringCore";

/**
 * Unity as the rendering of a room's match: the room authority keeps computing with the rules
 * from `shared/`, one Unity build per page stays loaded (it starts during the minigame intro)
 * and draws the snapshots under the app's own controls, HUD and countdown. Messages run by
 * `postMessage` between the app and its own iframe only (same origin, sender checked).
 */
export const UNITY_MATCH_URL = "/unity/spiele/index.html?spiel=online";

/** Match modules with a Unity rendering → game id in the Unity build (`GameSwitch`). */
export const UNITY_MATCH_SCENES: Readonly<Record<string, string>> = { tanks: "tanks", tankview: "tanks", sumo: "sumo", bumpercars: "bumpercars" };
export const hasUnityMatch = (matchId: string) => matchId in UNITY_MATCH_SCENES;

export interface UnityMessage { type: string; yaw?: number; kind?: string; x?: number; y?: number; ax?: number; ay?: number; ha?: boolean; hb?: boolean }
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
  show(on: boolean) { this.frame?.parentElement?.classList.toggle("is-shown", on); if (!on) this.interactive(false); }
  /** Unity's own HUD takes the touches (the app layer above lets them through). */
  interactive(on: boolean) { this.frame?.parentElement?.classList.toggle("is-interactive", on); }
}
export const unityStage = new UnityStage();

/** Seats for the Unity scene: colour slot, name and the figure chosen in the app (Unity falls back to a base human). */
export function unityMatchSetup(s: MatchState, viewer: string, view: string, reduced: boolean, names: Record<string, string>, characters: Record<string, string | undefined>, startIn = 0, sound = true) {
  return {
    type: "setup", game: UNITY_MATCH_SCENES[s.id], view, viewer, reduced, startIn: Math.round(startIn), sound,
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
    powers: g.powers.map(p => ({ id: p.id, kind: p.kind, x: p.x, y: p.y })),
    events: unityEvents(s)
  };
}

/** The room's recent events (Unity plays their sounds, toasts and effects while it draws). */
export const unityEvents = (s: MatchState) => s.events.map(e => ({ seq: e.seq, kind: e.kind, text: e.text, ids: e.ids }));

/** Input from Unity's own HUD, checked before it reaches the room (finite, within −1…1). */
export function unityInput(message: UnityMessage) {
  const clamp = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  return { x: clamp(message.x), y: clamp(message.y), ax: clamp(message.ax), ay: clamp(message.ay), ha: message.ha === true, hb: message.hb === true };
}

/** Sumo Smash and Bumper Mayhem (ringCore.ts): fighters in seat order, arena, posts, items and oil. */
export function unityRingSnapshot(s: MatchState) {
  const g = s.game as RingGame;
  return {
    type: "snap", time: s.time, radius: g.radius, resetAt: g.resetAt ?? -1, sudden: !!g.sudden, suddenStart: g.sudden?.start ?? 0, done: s.done,
    fighters: s.players.map(p => {
      const f = g.fighters[p.id];
      return {
        id: p.id, x: f.x, y: f.y, vx: f.vx, vy: f.vy, heading: f.heading, respawnAt: f.respawnAt, shieldUntil: f.shieldUntil,
        actionAt: f.actionAt, actionUntil: f.actionUntil, stunUntil: f.stunUntil, bigUntil: f.bigUntil ?? 0,
        lives: f.lives, ringOuts: f.ringOuts, alive: f.alive, isOut: f.out
      };
    }),
    items: (g.items ?? []).map(i => ({ id: i.id, kind: i.kind, x: i.x, y: i.y })),
    slicks: (g.slicks ?? []).map(o => ({ id: o.id, owner: o.owner, x: o.x, y: o.y, until: o.until, armedAt: o.armedAt })),
    obstacles: g.obstacles.map(o => ({ id: o.id, x: o.x, y: o.y, r: o.r, angle: o.angle })),
    events: unityEvents(s)
  };
}

/** Snapshot builder per Unity game id. */
export const UNITY_SNAPSHOTS: Readonly<Record<string, (s: MatchState) => object>> = { tanks: unityTankSnapshot, sumo: unityRingSnapshot, bumpercars: unityRingSnapshot };
