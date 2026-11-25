import { FL, FLOOR_TILES, floorIsLava, type LavaGame, type Runner } from "./floorIsLava";
import { inputOfPlayer, presence, rank, type MatchModule } from "./types";

/**
 * Floor is Lava, pilot "Unity · Host rechnet": the Unity scene on the host's phone simulates the
 * whole match with Unity physics. This module only relays: the room keeps the inputs of all
 * devices as usual (the host sees them in `inputs`), stores the snapshots the host reports
 * (`party:unity`, checked by `checkedHostSnap`) and sends them to everyone, where Unity draws
 * them like the room's own Floor is Lava (same format as `unityLavaSnapshot`, plus the physical
 * height `h`). The points of the newest snapshot rank the players; the host's final report or the
 * time limit ends the match. Never in the random pool: chosen as a rendering of "lava" by the host.
 */
export interface LavaHostRunner {
  id: string; x: number; y: number; vx: number; vy: number; fx: number; fy: number; floor: number; alive: boolean;
  dropUntil: number; airUntil: number; shoveUntil: number; slideUntil: number; diveUntil: number; proneUntil: number;
  jumpReady: number; shoveReady: number; diveReady: number; invulnUntil: number;
  /** Height above the own floor in metres (Unity physics). */
  h: number;
}
export interface LavaHostEvent { seq: number; kind: string; text: string; ids: string[] }
export interface LavaHostSnap {
  type: "snap"; time: number; done: boolean; round: number; phase: "play" | "pause" | "done"; tiebreak: boolean; roundStart: number; rings: number;
  tiles: string; regen: string; tiebreakWinner: number; runners: LavaHostRunner[]; points: number[]; events: LavaHostEvent[];
  /** Heights come from `h` instead of the jump and drop timers. */
  physical: boolean;
}
/** Inputs of every player for the host's simulation (cumulative tap counters as the devices send them). */
export interface LavaHostInput { id: string; x: number; y: number; ca: number; cb: number; cn: number; gone: boolean }
export interface LavaHostGame {
  /** Player whose Unity scene simulates (the room host who chose this rendering). */
  host: string;
  snap?: LavaHostSnap;
  /** Number of the last accepted report (older ones are ignored). */
  seq: number;
  points: Record<string, number>;
  tiebreakWinner: string;
  finished: boolean;
  /** Only in the host's view: the current inputs of all players. */
  inputs?: LavaHostInput[];
}

const TILE_COUNT = FLOOR_TILES * FL.floors;
const EVENT_KINDS = new Set(["round", "result", "out", "shove", "shrink", "jump", "dive", "dash", "drop"]);
const num = (v: unknown, min: number, max: number) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error("Ungültiger Unity-Zustand."); return Math.max(min, Math.min(max, n)); };
const TIMERS = ["dropUntil", "airUntil", "shoveUntil", "slideUntil", "diveUntil", "proneUntil", "jumpReady", "shoveReady", "diveReady", "invulnUntil"] as const;

/** Checks a snapshot reported by the host's Unity scene: the match's players in seat order, values in range. */
export function checkedHostSnap(raw: unknown, ids: readonly string[]): LavaHostSnap {
  const v = raw as Partial<LavaHostSnap> | null;
  if (!v || typeof v !== "object") throw new Error("Ungültiger Unity-Zustand.");
  if (typeof v.tiles !== "string" || !new RegExp(`^[0-3]{${TILE_COUNT}}$`).test(v.tiles)) throw new Error("Ungültige Platten im Unity-Zustand.");
  if (typeof v.regen !== "string" || !new RegExp(`^[01]{${TILE_COUNT}}$`).test(v.regen)) throw new Error("Ungültige Runen im Unity-Zustand.");
  if (!Array.isArray(v.runners) || v.runners.length !== ids.length || v.runners.some((r, i) => (r as LavaHostRunner)?.id !== ids[i])) throw new Error("Unbekannter Läufer im Unity-Zustand.");
  if (!Array.isArray(v.points) || v.points.length !== ids.length) throw new Error("Ungültige Punkte im Unity-Zustand.");
  const runners = v.runners.map(raw => {
    const r = raw as LavaHostRunner;
    const out: LavaHostRunner = { id: r.id, x: num(r.x, -2, FL.cols + 2), y: num(r.y, -2, FL.rows + 2), vx: num(r.vx, -30, 30), vy: num(r.vy, -30, 30),
      fx: num(r.fx, -1, 1), fy: num(r.fy, -1, 1), floor: Math.round(num(r.floor, 0, FL.floors - 1)), alive: r.alive === true, h: num(r.h, -8, 8),
      dropUntil: 0, airUntil: 0, shoveUntil: 0, slideUntil: 0, diveUntil: 0, proneUntil: 0, jumpReady: 0, shoveReady: 0, diveReady: 0, invulnUntil: 0 };
    for (const key of TIMERS) out[key] = num(r[key], -1e6, 1e7);
    return out;
  });
  const events = (Array.isArray(v.events) ? v.events : []).slice(-8).map(raw => {
    const e = raw as Partial<LavaHostEvent>;
    if (!e || typeof e.kind !== "string" || !EVENT_KINDS.has(e.kind)) throw new Error("Ungültiges Ereignis im Unity-Zustand.");
    const who = Array.isArray(e.ids) ? e.ids.filter((id): id is string => typeof id === "string" && ids.includes(id)).slice(0, 6) : [];
    return { seq: Math.round(num(e.seq, 0, 1e9)), kind: e.kind, text: typeof e.text === "string" ? e.text.slice(0, 60) : "", ids: who };
  });
  const phase = v.phase === "pause" || v.phase === "done" ? v.phase : "play";
  const winner = Math.round(num(v.tiebreakWinner ?? -1, -1, ids.length - 1));
  return {
    type: "snap", time: num(v.time, 0, 1e7), done: v.done === true, round: Math.round(num(v.round, 0, 9)), phase, tiebreak: v.tiebreak === true,
    roundStart: num(v.roundStart, -1e6, 1e7), rings: Math.round(num(v.rings, 0, FL.ringAt.length)), tiles: v.tiles, regen: v.regen, tiebreakWinner: winner,
    runners, points: v.points.map(p => num(p, 0, 100)), events, physical: true
  };
}

/**
 * The web view of a reported snapshot (a device without Unity): Floor is Lava's own shape, with the
 * host's timers moved onto the room's clock (`time`), so the web client draws it unchanged.
 */
export function lavaFromHostSnap(snap: LavaHostSnap | undefined, ids: readonly string[], time: number): LavaGame {
  const shift = snap ? time - snap.time : 0;
  const runners: Record<string, Runner> = {};
  ids.forEach((id, i) => {
    const r = snap?.runners[i];
    const at = (v: number | undefined) => (v ?? 0) + shift;
    runners[id] = {
      id, x: r?.x ?? FL.cols / 2, y: r?.y ?? FL.rows / 2, floor: r?.floor ?? 0, vx: r?.vx ?? 0, vy: r?.vy ?? 0, fx: r?.fx ?? 0, fy: r?.fy ?? 1, alive: !!r?.alive,
      dropUntil: at(r?.dropUntil), airUntil: at(r?.airUntil), invulnUntil: at(r?.invulnUntil), jumpReady: at(r?.jumpReady), shoveReady: at(r?.shoveReady), diveReady: at(r?.diveReady),
      shoveUntil: at(r?.shoveUntil), slideUntil: at(r?.slideUntil), diveUntil: at(r?.diveUntil), proneUntil: at(r?.proneUntil), pushedBy: "", pushedAt: -1e9
    };
  });
  return {
    round: snap?.round ?? 1, phase: snap?.phase ?? "play", tiebreak: !!snap?.tiebreak, roundStart: (snap?.roundStart ?? 0) + shift, tiles: snap?.tiles ?? "1".repeat(TILE_COUNT),
    regen: snap?.regen ?? "0".repeat(TILE_COUNT), timers: {}, rings: snap?.rings ?? 0, runners, history: [],
    points: Object.fromEntries(ids.map((id, i) => [id, snap?.points[i] ?? 0])),
    ...(snap && snap.tiebreakWinner >= 0 ? { tiebreakWinner: ids[snap.tiebreakWinner] } : {})
  };
}

/** Extra time on top of Floor is Lava's limit: the host's Unity build may still be loading at the start. */
const LOAD_MARGIN = 20;

export const lavaHost: MatchModule<LavaHostGame> = {
  id: "lavahost",
  meta: { ...floorIsLava.meta, seconds: floorIsLava.meta.seconds + LOAD_MARGIN },
  create(s) {
    return { host: "", seq: 0, points: Object.fromEntries(s.players.map(p => [p.id, 0])), tiebreakWinner: "", finished: false };
  },
  step(s) { if (s.game.finished) s.done = true; },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id] ?? 0, detail: g.tiebreakWinner === p.id ? "Stechrunde gewonnen" : `${g.points[p.id] ?? 0} Punkte`,
      keys: [presence(p), g.points[p.id] ?? 0, g.tiebreakWinner === p.id ? 1 : 0] })));
  },
  finish(s) { s.game.finished = true; },
  publicGame(s, viewer) {
    const g = s.game, view: LavaHostGame = { host: g.host, seq: g.seq, points: { ...g.points }, tiebreakWinner: g.tiebreakWinner, finished: g.finished, ...(g.snap ? { snap: structuredClone(g.snap) } : {}) };
    if (viewer === g.host) view.inputs = s.players.map(p => { const input = inputOfPlayer(s, p); return { id: p.id, x: input.x, y: input.y, ca: input.ca, cb: input.cb, cn: input.cn, gone: p.gone }; });
    return view;
  },
  // Bots are driven inside the host's Unity scene.
  bot() { return {}; }
};
