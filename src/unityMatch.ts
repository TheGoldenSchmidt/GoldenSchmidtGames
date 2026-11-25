import type { MatchState } from "../shared/matches/types";
import type { TankGame } from "../shared/matches/tankTrouble";
import type { RingGame } from "../shared/matches/ringCore";
import type { BombGame } from "../shared/matches/bombArena";
import type { SnowGame } from "../shared/matches/snowball";
import type { LavaGame } from "../shared/matches/floorIsLava";
import type { LavaHostGame } from "../shared/matches/lavaHost";
import type { ParcoursGame } from "../shared/matches/parcours";

/**
 * Unity as the rendering of a room's match: the room authority keeps computing with the rules
 * from `shared/`, one Unity build per page stays loaded (it starts during the minigame intro)
 * and draws the snapshots under the app's own controls, HUD and countdown. Messages run by
 * `postMessage` between the app and its own iframe only (same origin, sender checked).
 */
export const UNITY_MATCH_URL = "/unity/spiele/index.html?spiel=online";

/** Match modules with a Unity rendering → game id in the Unity build (`GameSwitch`). */
export const UNITY_MATCH_SCENES: Readonly<Record<string, string>> = { tanks: "tanks", tankview: "tanks", sumo: "sumo", bumpercars: "bumpercars", bombs: "bombs", snowball: "snowball", lava: "lava", lavahost: "lava", tuerenlotto: "tuerenlotto", kreiselkurs: "kreiselkurs", standhaft: "standhaft" };
export const hasUnityMatch = (matchId: string) => matchId in UNITY_MATCH_SCENES;

export interface UnityMessage { type: string; yaw?: number; kind?: string; value?: number; x?: number; y?: number; ax?: number; ay?: number; ha?: boolean; hb?: boolean; snap?: object }
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

/** "Unity · Host rechnet": this device's Unity scene simulates the match for everyone. */
export const isUnityHost = (s: MatchState, viewer: string) => s.id === "lavahost" && (s.game as LavaHostGame).host === viewer;

/**
 * Seats for the Unity scene: colour slot, name and the figure chosen in the app (Unity falls back
 * to a base human). `role` "host" makes the scene simulate (the room's bots included), "view" only
 * draws; `resume` hands a reloaded host the last reported snapshot (points and round continue).
 */
export function unityMatchSetup(s: MatchState, viewer: string, view: string, reduced: boolean, names: Record<string, string>, characters: Record<string, string | undefined>, startIn = 0, sound = true) {
  const host = isUnityHost(s, viewer), snap = s.id === "lavahost" ? (s.game as LavaHostGame).snap : undefined;
  return {
    type: "setup", game: UNITY_MATCH_SCENES[s.id], view, viewer, reduced, startIn: Math.round(startIn), sound,
    role: host ? "host" : "view", resume: host && snap ? JSON.stringify(snap) : "",
    players: s.players.map(p => ({ id: p.id, slot: p.style, name: names[p.id] ?? "", figure: characters[p.id] ?? "", bot: !!p.bot }))
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

/** Bomb Arena (bombArena.ts): cells, bombers in seat order, bombs, flames, items and points (owners as seat indices). */
export function unityBombSnapshot(s: MatchState) {
  const g = s.game as BombGame, seat = (id: string) => s.players.findIndex(p => p.id === id);
  return {
    type: "snap", time: s.time, round: g.round, phase: g.phase, sudden: g.sudden, roundStart: g.roundStart, cells: g.cells, shrunk: g.shrunk, done: s.done,
    suddenWinner: g.suddenWinner ? seat(g.suddenWinner) : -1,
    bombers: s.players.map(p => {
      const b = g.bombers[p.id];
      return { id: p.id, cx: b.cx, cy: b.cy, tx: b.tx, ty: b.ty, progress: b.progress, dir: b.dir, lives: b.lives, alive: b.alive, invulnUntil: b.invulnUntil, maxBombs: b.maxBombs, range: b.range, speed: b.speed, kick: b.kick };
    }),
    bombs: g.bombs.map(b => ({ id: b.id, x: b.x, y: b.y, owner: seat(b.owner), range: b.range, at: b.at, sliding: !!b.slide })),
    flames: g.flames.map(f => ({ x: f.x, y: f.y, group: f.group, owner: seat(f.owner), until: f.until, center: f.center })),
    items: g.items.map(i => ({ x: i.x, y: i.y, kind: i.kind })),
    points: s.players.map(p => g.points[p.id] ?? 0),
    events: unityEvents(s)
  };
}

/** Schneeballschlacht (snowball.ts): players in seat order, balls (owner as seat index) and pile timers. */
export function unitySnowSnapshot(s: MatchState) {
  const g = s.game as SnowGame, seat = (id: string) => s.players.findIndex(p => p.id === id);
  return {
    type: "snap", time: s.time, done: s.done,
    players: s.players.map(p => {
      const b = g.players[p.id];
      return { id: p.id, x: b.x, y: b.y, fx: b.fx, fy: b.fy, form: b.form, forming: !!b.forming, lastThrow: b.lastThrow, hitAt: b.hitAt, outAt: b.outAt ?? -1, balls: b.balls, hits: b.hits, dealt: b.dealt };
    }),
    balls: g.balls.map(b => ({ id: b.id, owner: seat(b.owner), x: b.x, y: b.y, vx: b.vx, vy: b.vy, sx: b.sx, sy: b.sy, born: b.born })),
    piles: g.piles.map(p => ({ x: p.x, y: p.y, readyAt: p.readyAt })),
    events: unityEvents(s)
  };
}

/** Snapshot builder per Unity game id. */
/**
 * Floor is Lava: tile states of all three floors (digit string, see floorIsLava.ts), the runners in
 * seat order and the points; Unity animates cracks, falls, returns, jumps, dives and drops from them.
 */
export function unityLavaSnapshot(s: MatchState): object | undefined {
  // "Unity · Host rechnet": the host's own report, relayed by the room (same format, physical heights).
  if (s.id === "lavahost") return (s.game as LavaHostGame).snap;
  const g = s.game as LavaGame, seat = (id: string | undefined) => id ? s.players.findIndex(p => p.id === id) : -1;
  return {
    type: "snap", time: s.time, done: s.done, round: g.round, phase: g.phase, tiebreak: g.tiebreak, roundStart: g.roundStart, rings: g.rings, tiles: g.tiles, regen: g.regen,
    tiebreakWinner: seat(g.tiebreakWinner),
    runners: s.players.map(p => {
      const r = g.runners[p.id];
      return {
        id: p.id, x: r?.x ?? 0, y: r?.y ?? 0, vx: r?.vx ?? 0, vy: r?.vy ?? 0, fx: r?.fx ?? 0, fy: r?.fy ?? 1, floor: r?.floor ?? 0, alive: r?.alive ?? false,
        dropUntil: r?.dropUntil ?? 0, airUntil: r?.airUntil ?? 0, shoveUntil: r?.shoveUntil ?? 0, slideUntil: r?.slideUntil ?? 0, diveUntil: r?.diveUntil ?? 0, proneUntil: r?.proneUntil ?? 0,
        jumpReady: r?.jumpReady ?? 0, shoveReady: r?.shoveReady ?? 0, diveReady: r?.diveReady ?? 0, invulnUntil: r?.invulnUntil ?? 0
      };
    }),
    points: s.players.map(p => g.points[p.id] ?? 0),
    events: unityEvents(s)
  };
}

/**
 * Parcours runs and the Standhaft final (parcours.ts): racers in seat order, the public door and
 * secret-floor states (the secrets themselves never leave the authority), seesaw tilts and the
 * finishing order as seat indices. Moving parts follow the room's clock (`time`).
 */
export function unityParcoursSnapshot(s: MatchState) {
  const g = s.game as ParcoursGame, seat = (id: string | undefined) => id ? s.players.findIndex(p => p.id === id) : -1;
  return {
    type: "snap", time: s.time, done: s.done, course: g.course, doors: g.doors, tiles: g.tiles, tilt: g.tilt, firstFinish: g.firstFinish ?? -1,
    order: g.order.map(seat),
    racers: s.players.map(p => {
      const r = g.racers[p.id];
      return {
        id: p.id, pose: r?.pose ?? "out", x: r?.x ?? 0, y: r?.y ?? 0, z: r?.z ?? 0, vx: r?.vx ?? 0, vy: r?.vy ?? 0, vz: r?.vz ?? 0, face: r?.face ?? 0,
        best: r?.best ?? 0, finishAt: r?.finishAt ?? -1, outAt: r?.outAt ?? -1, checkpoint: r?.checkpoint ?? 0, falls: r?.falls ?? 0, grab: seat(r?.grab),
        duck: !!r?.duck, grounded: !!r?.grounded
      };
    }),
    events: unityEvents(s)
  };
}

export const UNITY_SNAPSHOTS: Readonly<Record<string, (s: MatchState) => object | undefined>> = {
  tanks: unityTankSnapshot, sumo: unityRingSnapshot, bumpercars: unityRingSnapshot, bombs: unityBombSnapshot, snowball: unitySnowSnapshot, lava: unityLavaSnapshot,
  tuerenlotto: unityParcoursSnapshot, kreiselkurs: unityParcoursSnapshot, standhaft: unityParcoursSnapshot
};
