import type { CharacterId } from "../characters";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchModule, type MatchPlayer, type MatchStanding, type MatchState } from "./types";
import { quickDraw } from "./quickDraw";
import { neonPong } from "./neonPong";
import { tankTrouble } from "./tankTrouble";
import { bombArena } from "./bombArena";
import { floorIsLava } from "./floorIsLava";
import { sumoSmash } from "./sumoSmash";
import { bumperMayhem } from "./bumperMayhem";
import { chaosRun } from "./chaosRun";
import { arrowMasters } from "./arrowMasters";
import { towerTumble } from "./towerTumble";
import { lightTrails } from "./lightTrails";

/**
 * Registry of the new touch minigames ("Match-Minispiele"). Only complete
 * games are listed here; the lobby, pools and bots read this list.
 */
export const MATCH_IDS = ["quickdraw", "trails", "pong", "tanks", "bombs", "lava", "sumo", "bumpercars", "chaosrun", "arrows", "tower"] as const;
export type MatchId = typeof MATCH_IDS[number];
export const MATCH_MODULES: Record<MatchId, MatchModule<any>> = { quickdraw: quickDraw, trails: lightTrails, pong: neonPong, tanks: tankTrouble, bombs: bombArena, lava: floorIsLava, sumo: sumoSmash, bumpercars: bumperMayhem, chaosrun: chaosRun, arrows: arrowMasters, tower: towerTumble };
export const isMatchId = (id: unknown): id is MatchId => typeof id === "string" && (MATCH_IDS as readonly string[]).includes(id);
export const matchModule = (id: string) => { if (!isMatchId(id)) throw new Error("Unbekanntes Minispiel."); return MATCH_MODULES[id]; };
export const MATCH_STEP = 50;
/** Inputs older than this fall back to neutral, e.g. after a lost connection. */
export const INPUT_HOLD = 400;
const MAX_RTT = 300;

export function matchEligible(id: MatchId, players: number) { return MATCH_MODULES[id].meta.players.includes(players); }
export function playerRange(id: MatchId) {
  const counts = MATCH_MODULES[id].meta.players;
  return counts.length > 1 && counts.every((n, i) => i === 0 || n === counts[i - 1] + 1) ? `${counts[0]}–${counts.at(-1)}` : counts.join(" oder ");
}

export function createMatch(id: MatchId, players: { id: string; style: number; characterId?: CharacterId }[], seed: number): MatchState {
  const module = MATCH_MODULES[id];
  if (!matchEligible(id, players.length)) throw new Error(`${module.meta.name} braucht ${playerRange(id)} Spieler.`);
  const teams = module.teams?.(players.length) ?? players.map((_, i) => i);
  const s: MatchState = { id, seed, rng: (seed ^ 0x9e3779b9) >>> 0, time: 0, done: false, events: [], eventSeq: 0, game: undefined,
    players: players.map((p, i) => ({ id: p.id, style: p.style, ...(p.characterId ? { characterId: p.characterId } : {}), team: teams[i], input: { ...NEUTRAL_MATCH_INPUT },
      inputUntil: 0, inputSeq: 0, usedA: 0, usedB: 0, usedN: 0, played: false, gone: false, rtt: 120 })) };
  s.game = module.create(s);
  return s;
}

export { inputOfPlayer as inputOf } from "./types";

/** Advance in fixed steps up to `elapsed` ms after the start signal. */
export function advanceMatch(s: MatchState, elapsed: number) {
  const module = MATCH_MODULES[s.id as MatchId];
  const until = Math.min(Math.floor(elapsed / MATCH_STEP) * MATCH_STEP, module.meta.seconds * 1000);
  while (!s.done && s.time < until) {
    s.time += MATCH_STEP;
    module.step(s, MATCH_STEP / 1000);
  }
  if (!s.done && s.time >= module.meta.seconds * 1000) finishMatch(s);
  return s;
}

export function finishMatch(s: MatchState) {
  if (s.done) return;
  const module = MATCH_MODULES[s.id as MatchId];
  module.finish?.(s);
  s.done = true;
}

const finite = (value: unknown, limit: number) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit;
const counter = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1e7;
export function checkedMatchInput(raw: unknown): MatchInput {
  if (!raw || typeof raw !== "object") throw new Error("Ungültige Steuerung.");
  const v = raw as MatchInput;
  if (!finite(v.x, 1) || !finite(v.y, 1) || !finite(v.ax, 1) || !finite(v.ay, 1) || typeof v.ha !== "boolean" || typeof v.hb !== "boolean" ||
    !counter(v.ca) || !counter(v.cb) || !counter(v.cn) || !finite(v.n, 1e6) ||
    (v.echo !== undefined && !(typeof v.echo === "number" && Number.isFinite(v.echo))) || (v.held !== undefined && !finite(v.held, 60000))) throw new Error("Ungültige Steuerung.");
  const stick = Math.max(1, Math.hypot(v.x, v.y)), aim = Math.max(1, Math.hypot(v.ax, v.ay));
  // Only defined fields, so stored states survive a JSON round trip unchanged.
  return { x: v.x / stick, y: v.y / stick, ax: v.ax / aim, ay: v.ay / aim, ha: v.ha, hb: v.hb, ca: v.ca, cb: v.cb, cn: v.cn, n: v.n, ...(v.echo !== undefined ? { echo: v.echo } : {}), ...(v.held !== undefined ? { held: v.held } : {}) };
}

/**
 * Applies one validated control packet at the exact simulation time `at`.
 * `now` is the authority's wall clock for the round-trip estimate.
 */
export function setMatchControl(s: MatchState, id: string, raw: unknown, seq: number, at: number, now?: number) {
  const p = s.players.find(player => player.id === id);
  if (!p) throw new Error("Diese Figur gehört nicht zu deinem Spiel.");
  if (!Number.isSafeInteger(seq) || seq <= 0) throw new Error("Ungültige Eingabefolge.");
  const input = checkedMatchInput(raw);
  if (seq <= p.inputSeq || p.gone || s.done) return false;
  p.inputSeq = seq;
  if (now !== undefined && input.echo !== undefined && input.held !== undefined) {
    const sample = now - input.echo - input.held;
    if (sample >= 0 && sample < 5000) p.rtt = Math.round(Math.min(MAX_RTT, p.rtt * .7 + Math.min(MAX_RTT, sample) * .3));
  }
  const module = MATCH_MODULES[s.id as MatchId];
  const presses: ["a" | "b" | "n", number][] = [["a", input.ca - p.usedA], ["b", input.cb - p.usedB], ["n", input.cn - p.usedN]];
  p.input = { ...input, ca: Math.max(p.usedA, input.ca), cb: Math.max(p.usedB, input.cb), cn: Math.max(p.usedN, input.cn) };
  p.inputUntil = s.time + INPUT_HOLD;
  if (Math.hypot(input.x, input.y) > .08 || Math.hypot(input.ax, input.ay) > .08 || input.ha || input.hb || presses.some(([, delta]) => delta > 0)) p.played = true;
  for (const [kind, delta] of presses) {
    if (delta <= 0) continue;
    // At most three taps per packet: a burst of stale counters must not flood the game.
    for (let i = 0; i < Math.min(3, delta); i++) module.press?.(s, p, kind, at, input.n);
    if (kind === "a") p.usedA = input.ca; else if (kind === "b") p.usedB = input.cb; else p.usedN = input.cn;
  }
  return true;
}

export function removeMatchPlayer(s: MatchState, id: string) {
  const p = s.players.find(player => player.id === id);
  if (!p || p.gone) return;
  p.gone = true; s.leftCount = (s.leftCount ?? 0) + 1; p.left = s.leftCount; p.input = { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN }; p.inputUntil = 0;
  MATCH_MODULES[s.id as MatchId].remove?.(s, id);
  // Without an opponent there is nothing left to decide.
  if (s.players.filter(player => !player.gone).length <= 1) finishMatch(s);
}

export function neutralizeMatch(s: MatchState) {
  for (const p of s.players) { p.input = { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN }; p.inputUntil = 0; }
}

export function matchStandings(s: MatchState): MatchStanding[] { return MATCH_MODULES[s.id as MatchId].standings(s); }

/** Per-device projection: no RNG state, no foreign raw inputs, module secrets hidden. */
export function publicMatch(s: MatchState, viewer: string): MatchState {
  const view = structuredClone(s);
  view.rng = 0;
  for (const p of view.players) if (p.id !== viewer) { p.input = { ...NEUTRAL_MATCH_INPUT }; p.rtt = 0; }
  MATCH_MODULES[s.id as MatchId].view?.(view, viewer);
  return view;
}

/** Bots act like a device: they see only their public view and send normal inputs. */
export function botMatchInput(s: MatchState, id: string): MatchInput {
  const p = s.players.find(player => player.id === id)!;
  const intent = MATCH_MODULES[s.id as MatchId].bot(publicMatch(s, id), id);
  return {
    x: intent.x ?? 0, y: intent.y ?? 0, ax: intent.ax ?? 0, ay: intent.ay ?? 0, ha: intent.ha ?? false, hb: intent.hb ?? false,
    ca: p.usedA + (intent.pressA ? 1 : 0), cb: p.usedB + (intent.pressB ? 1 : 0),
    cn: p.usedN + (intent.command !== undefined ? 1 : 0), n: intent.command ?? 0
  };
}
