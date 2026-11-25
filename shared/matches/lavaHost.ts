import { floorIsLava } from "./floorIsLava";
import type { LavaSnap } from "./lavaSnap";
import { inputOfPlayer, presence, rank, type MatchModule } from "./types";

/** Inputs of every player for the host's Unity simulation (cumulative tap counters as sent by the devices). */
export interface LavaHostInput { id: string; x: number; y: number; ca: number; cb: number; cn: number; gone: boolean }

/**
 * Floor is Lava, Variant B ("Unity · Host rechnet"): the Unity scene on the host's phone
 * simulates the whole match, with Unity physics. This module only relays: the room keeps the
 * inputs of all devices as usual (the host sees them in `inputs`), stores the snapshots the
 * host reports (`party:unity`, checked by `checkedLavaSnap`) and sends them to everyone. The
 * points of the newest snapshot rank the players; the host's final report or the time limit
 * ends the match. Never in the random pool: chosen as a rendering of "lava" by the host.
 */
export interface LavaHostGame {
  /** Player whose Unity scene simulates (the room host who chose this rendering). */
  host: string;
  snap?: LavaSnap;
  /** Number of the last accepted report (older ones are ignored). */
  seq: number;
  points: Record<string, number>;
  tiebreakWinner: string;
  finished: boolean;
  /** Only in the host's view: the current inputs of all players. */
  inputs?: LavaHostInput[];
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
    const g = s.game, wins = (id: string) => g.snap?.runners.find(r => r.id === id)?.won ? 1 : 0;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id] ?? 0, detail: g.tiebreakWinner === p.id ? "Stechrunde gewonnen" : `${g.points[p.id] ?? 0} Punkte`,
      keys: [presence(p), g.points[p.id] ?? 0, g.tiebreakWinner === p.id ? 1 : 0, wins(p.id)] })));
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
