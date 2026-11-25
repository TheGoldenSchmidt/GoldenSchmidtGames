import { FL, FLOOR_TILES, dropping, grounded, type LavaGame, type Runner } from "./floorIsLava";
import type { MatchState } from "./types";

/**
 * Floor is Lava as a flat snapshot for Unity (`JsonUtility`: no maps, no optional fields).
 * Positions in tiles (x 0–9, y 0–13, y grows towards the bottom rows), `floor` 0 = top,
 * `h` the height above that floor in floors (1 = one floor higher). Two sources:
 * - Variant A ("Unity zeichnet"): `lavaSnapshot` builds it from the room's floorIsLava.ts state.
 * - Variant B ("Host rechnet"): the host's Unity scene simulates and reports it;
 *   `checkedLavaSnap` validates it before the room stores and relays it.
 */
export interface LavaSnapRunner {
  id: string; x: number; y: number; floor: number; h: number; vx: number; vy: number; fx: number; fy: number;
  alive: boolean; air: boolean;
  /** "" | "drop" | "dive" | "prone" | "slide" | "shove" */
  act: string;
  points: number;
  /** Points and win of the last finished round (shown during the pause). */
  gain: number; won: boolean;
  /** Remaining cooldown as a share (0 = ready). */
  jump: number; shove: number; dive: number;
}
export interface LavaSnap {
  type: "snap"; time: number; round: number; phase: "play" | "pause" | "done"; tiebreak: boolean; roundTime: number; rings: number;
  tiles: string; regen: string; runners: LavaSnapRunner[]; done: boolean; tiebreakWinner: string;
}

const TILE_COUNT = FLOOR_TILES * FL.floors;
const JUMP_HEIGHT = .28, DIVE_HEIGHT = .1;
const share = (ready: number, time: number, cooldown: number) => Math.max(0, Math.min(1, (ready - time) / cooldown));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function height(s: MatchState<LavaGame>, r: Runner) {
  if (dropping(s, r)) { const left = (r.dropUntil - s.time) / FL.dropMs; return 1 - (1 - left) * (1 - left); }
  if (grounded(s, r)) return 0;
  if (s.time < (r.diveUntil ?? 0)) { const k = 1 - ((r.diveUntil ?? 0) - s.time) / FL.diveMs; return 4 * DIVE_HEIGHT * k * (1 - k); }
  const k = 1 - (r.airUntil - s.time) / FL.jumpMs;
  return 4 * JUMP_HEIGHT * Math.max(0, Math.min(1, k)) * (1 - Math.max(0, Math.min(1, k)));
}
function action(s: MatchState<LavaGame>, r: Runner) {
  if (dropping(s, r)) return "drop";
  if (s.time < (r.diveUntil ?? 0)) return "dive";
  if (s.time < (r.proneUntil ?? 0)) return "prone";
  if (s.time < r.slideUntil) return "slide";
  if (s.time < r.shoveUntil) return "shove";
  return "";
}

/** Variant A: snapshot of the room's Floor is Lava state. */
export function lavaSnapshot(s: MatchState<LavaGame>): LavaSnap {
  const g = s.game, last = g.phase !== "play" ? g.history.at(-1) : undefined;
  return {
    type: "snap", time: s.time, round: g.round, phase: g.phase, tiebreak: g.tiebreak, roundTime: s.time - g.roundStart, rings: g.rings,
    tiles: g.tiles, regen: g.regen, done: s.done, tiebreakWinner: g.tiebreakWinner ?? "",
    runners: s.players.map(p => {
      const r = g.runners[p.id];
      return {
        id: p.id, x: round3(r?.x ?? 0), y: round3(r?.y ?? 0), floor: r?.floor ?? 0, h: r ? round3(height(s, r)) : 0,
        vx: round3(r?.vx ?? 0), vy: round3(r?.vy ?? 0), fx: round3(r?.fx ?? 0), fy: round3(r?.fy ?? 1),
        alive: !!r?.alive && !p.gone, air: !!r && !grounded(s, r), act: r ? action(s, r) : "", points: g.points[p.id] ?? 0,
        gain: last?.points[p.id] ?? 0, won: !!last?.winners.includes(p.id),
        jump: r ? round3(share(r.jumpReady, s.time, FL.jumpCooldown)) : 0, shove: r ? round3(share(r.shoveReady, s.time, FL.shoveCooldown)) : 0,
        dive: r ? round3(share(r.diveReady ?? 0, s.time, FL.diveCooldown)) : 0
      };
    })
  };
}

const ACTS = new Set(["", "drop", "dive", "prone", "slide", "shove"]);
const num = (v: unknown, min: number, max: number) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error("Ungültiger Unity-Zustand."); return Math.max(min, Math.min(max, n)); };

/** Variant B: checks a snapshot reported by the host's Unity scene; only players of the match, values in range. */
export function checkedLavaSnap(raw: unknown, ids: readonly string[]): LavaSnap {
  const v = raw as Partial<LavaSnap> | null;
  if (!v || typeof v !== "object") throw new Error("Ungültiger Unity-Zustand.");
  if (typeof v.tiles !== "string" || !new RegExp(`^[0-3]{${TILE_COUNT}}$`).test(v.tiles)) throw new Error("Ungültige Platten im Unity-Zustand.");
  if (typeof v.regen !== "string" || !new RegExp(`^[01]{${TILE_COUNT}}$`).test(v.regen)) throw new Error("Ungültige Runen im Unity-Zustand.");
  if (!Array.isArray(v.runners) || v.runners.length > ids.length) throw new Error("Ungültige Läufer im Unity-Zustand.");
  const seen = new Set<string>();
  const runners = v.runners.map(raw => {
    const r = raw as Partial<LavaSnapRunner>;
    if (!r || typeof r.id !== "string" || !ids.includes(r.id) || seen.has(r.id)) throw new Error("Unbekannter Läufer im Unity-Zustand.");
    seen.add(r.id);
    const act = typeof r.act === "string" && ACTS.has(r.act) ? r.act : "";
    return {
      id: r.id, x: num(r.x, -2, FL.cols + 2), y: num(r.y, -2, FL.rows + 2), floor: Math.round(num(r.floor, 0, FL.floors - 1)), h: num(r.h, -1, 2),
      vx: num(r.vx, -30, 30), vy: num(r.vy, -30, 30), fx: num(r.fx, -1, 1), fy: num(r.fy, -1, 1), alive: r.alive === true, air: r.air === true, act,
      points: num(r.points, 0, 100), gain: num(r.gain, 0, 100), won: r.won === true, jump: num(r.jump, 0, 1), shove: num(r.shove, 0, 1), dive: num(r.dive, 0, 1)
    };
  });
  const phase = v.phase === "pause" || v.phase === "done" ? v.phase : "play";
  return {
    type: "snap", time: num(v.time, 0, 600000), round: Math.round(num(v.round, 0, 9)), phase, tiebreak: v.tiebreak === true,
    roundTime: num(v.roundTime, 0, 600000), rings: Math.round(num(v.rings, 0, FL.ringAt.length)), tiles: v.tiles, regen: v.regen,
    runners, done: v.done === true, tiebreakWinner: typeof v.tiebreakWinner === "string" && ids.includes(v.tiebreakWinner) ? v.tiebreakWinner : ""
  };
}

/**
 * The web view of a reported snapshot (fallback without Unity on a non-host device): a LavaGame
 * shaped like floorIsLava.ts so the web client draws it unchanged. Timings are rebuilt at `time`.
 */
export function lavaFromSnap(snap: LavaSnap | undefined, ids: readonly string[], time: number): LavaGame {
  const runners: Record<string, Runner> = {};
  for (const id of ids) {
    const r = snap?.runners.find(x => x.id === id);
    runners[id] = {
      id, x: r?.x ?? FL.cols / 2, y: r?.y ?? FL.rows / 2, floor: r?.floor ?? 0, vx: r?.vx ?? 0, vy: r?.vy ?? 0, fx: r?.fx ?? 0, fy: r?.fy ?? 1,
      alive: !!r?.alive, airUntil: r?.air ? time + FL.jumpMs : 0, dropUntil: r?.act === "drop" ? time + FL.dropMs : 0, invulnUntil: 0,
      jumpReady: time + (r?.jump ?? 0) * FL.jumpCooldown, shoveReady: time + (r?.shove ?? 0) * FL.shoveCooldown, diveReady: time + (r?.dive ?? 0) * FL.diveCooldown,
      shoveUntil: r?.act === "shove" ? time + FL.shoveMs : 0, slideUntil: r?.act === "slide" ? time + FL.slideMs : 0,
      diveUntil: r?.act === "dive" ? time + FL.diveMs : 0, proneUntil: r?.act === "prone" ? time + FL.proneMs : 0, pushedBy: "", pushedAt: -1e9
    };
  }
  const phase = snap?.phase ?? "play", round = snap?.round ?? 1;
  const points = Object.fromEntries(ids.map(id => [id, snap?.runners.find(r => r.id === id)?.points ?? 0]));
  const history = phase !== "play" && snap ? [{ points: Object.fromEntries(snap.runners.map(r => [r.id, r.gain])), winners: snap.runners.filter(r => r.won).map(r => r.id), tiebreak: snap.tiebreak }] : [];
  return {
    round, phase, tiebreak: !!snap?.tiebreak, roundStart: time - (snap?.roundTime ?? 0), tiles: snap?.tiles ?? "1".repeat(TILE_COUNT),
    regen: snap?.regen ?? "0".repeat(TILE_COUNT), timers: {}, rings: snap?.rings ?? 0, runners, points, history,
    ...(snap?.tiebreakWinner ? { tiebreakWinner: snap.tiebreakWinner } : {})
  };
}
