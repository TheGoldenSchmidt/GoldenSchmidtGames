import type { CharacterId } from "../characters";

/**
 * Touch input of one device. Counters (`ca`, `cb`, `cn`) only grow: a lost
 * packet is repaired by the next one, duplicates have no effect.
 */
export interface MatchInput {
  /** Stick or drag position, -1…1. */
  x: number; y: number;
  /** Aim vector, -1…1 (length may encode strength). */
  ax: number; ay: number;
  /** Buttons currently held. */
  ha: boolean; hb: boolean;
  /** Total taps of button A/B since the match started. */
  ca: number; cb: number;
  /** Total commands sent; `n` is the value of the latest command. */
  cn: number; n: number;
  /** Server time of the last received snapshot and how long the client held it. */
  echo?: number; held?: number;
}
export const NEUTRAL_MATCH_INPUT: MatchInput = { x: 0, y: 0, ax: 0, ay: 0, ha: false, hb: false, ca: 0, cb: 0, cn: 0, n: 0 };

export interface MatchPlayer {
  id: string;
  style: number;
  characterId?: CharacterId;
  team: number;
  input: MatchInput;
  inputUntil: number;
  inputSeq: number;
  usedA: number; usedB: number; usedN: number;
  played: boolean;
  gone: boolean;
  /** Order of leaving (1 = first). Later leavers rank higher among those who left. */
  left?: number;
  /** Smoothed round-trip estimate in ms, capped. Only used for fairness bounds. */
  rtt: number;
}

export interface MatchStanding { id: string; place: number; score: number; detail?: string }
export interface MatchEvent { seq: number; at: number; kind: string; text: string; ids: string[] }

export interface MatchState<G = unknown> {
  id: string;
  seed: number;
  rng: number;
  /** Simulation time in ms since the shared start signal. */
  time: number;
  players: MatchPlayer[];
  done: boolean;
  events: MatchEvent[];
  eventSeq: number;
  leftCount?: number;
  game: G;
}

export interface MatchLook { icon: string; action: string; hint: string; goal: string }
export interface MatchMeta {
  name: string;
  /** Hard time limit including overtime. The module normally ends earlier. */
  seconds: number;
  /** Allowed numbers of players. */
  players: readonly number[];
  /** Short rules: goal, controls and victory condition. */
  instruction: string;
  controls: string;
  /** Snapshot rate sent to the devices. */
  hz: 10 | 20;
  look: MatchLook;
}

export type Press = "a" | "b" | "n";
export interface BotIntent { x?: number; y?: number; ax?: number; ay?: number; ha?: boolean; hb?: boolean; pressA?: boolean; pressB?: boolean; command?: number }

export interface MatchModule<G = unknown> {
  id: string;
  meta: MatchMeta;
  /** Team per seat; defaults to one team per player. */
  teams?(count: number): number[];
  create(s: MatchState<G>): G;
  /** Called once per fixed step after `time` advanced. */
  step(s: MatchState<G>, dt: number): void;
  /** A new tap or command at the exact simulation time `at`. */
  press?(s: MatchState<G>, p: MatchPlayer, kind: Press, at: number, value: number): void;
  /** The player left for good (e.g. passive after a long disconnect). */
  remove?(s: MatchState<G>, id: string): void;
  /** Current ranking; final once `done` is set or after `finish`. */
  standings(s: MatchState<G>): MatchStanding[];
  /** End immediately at the hard time limit. */
  finish?(s: MatchState<G>): void;
  /** Hide secrets in the cloned state sent to `viewer`. */
  view?(s: MatchState<G>, viewer: string): void;
  /** Bot decision from the public view only. */
  bot(s: MatchState<G>, id: string): BotIntent;
}

export function random(s: MatchState): number {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function randomInt(s: MatchState, min: number, max: number) { return min + Math.floor(random(s) * (max - min + 1)); }
export function shuffled<T>(s: MatchState, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export function emit(s: MatchState, kind: string, text: string, ids: string[] = []) {
  s.events = [...s.events.slice(-11), { seq: ++s.eventSeq, at: s.time, kind, text, ids }];
}
export const activePlayers = (s: MatchState) => s.players.filter(p => !p.gone);
/** Effective input at the current simulation time; expired or departed players are neutral. */
export function inputOfPlayer(s: MatchState, p: MatchPlayer): MatchInput {
  return !p.gone && s.time <= p.inputUntil ? p.input : { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN };
}
/** First ranking key for every module: players still in the match rank above those who gave up or left. */
export const presence = (p: MatchPlayer) => p.gone ? (p.left ?? 0) - 1000 : 0;
/** Stable 32-bit hash for deterministic per-player bot variation. */
export function hash(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return h >>> 0; }

/** Competition ranking: higher keys are better, equal keys share a place. */
export function rank(rows: { id: string; score: number; keys: number[]; detail?: string }[]): MatchStanding[] {
  const better = (a: number[], b: number[]) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] ?? 0) - (b[i] ?? 0); if (d) return d; } return 0; };
  const sorted = [...rows].sort((a, b) => better(b.keys, a.keys));
  return sorted.map(row => ({ id: row.id, score: row.score, detail: row.detail, place: 1 + sorted.filter(other => better(other.keys, row.keys) > 0).length }));
}
