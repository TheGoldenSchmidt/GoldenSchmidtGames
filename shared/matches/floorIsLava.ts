import { clamp, dist, separateCircles } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Floor is Lava – square temple tiles over lava. Tile states (digit string):
 * 0 gone for good, 1 intact, 2 cracking, 3 gone but regenerating.
 * Stepping on an intact tile starts its 0.8 s crack timer.
 */
export const FL = {
  cols: 9, rows: 13, radius: .32, speed: 3.2, airSpeed: 1.4, inertia: .35,
  crackMs: 800, regenMs: 2500, regenShare: .35,
  jumpMs: 550, jumpCooldown: 3000, lives: 2, invulnMs: 1200,
  ringAt: [10000, 15000] as const, roundMax: 20000, pause: 2600, rounds: 3, winBonus: 3,
  tiebreakMax: 20000
} as const;
export interface Runner { id: string; x: number; y: number; vx: number; vy: number; lives: number; alive: boolean; airUntil: number; jumpReady: number; invulnUntil: number; outAt?: number }
export interface LavaGame {
  round: number;
  phase: "play" | "pause" | "done";
  tiebreak: boolean;
  roundStart: number;
  tiles: string;
  regen: string;
  timers: Record<string, number>;
  rings: number;
  runners: Record<string, Runner>;
  points: Record<string, number>;
  tiebreakWinner?: string;
  history: { points: Record<string, number>; winners: string[]; tiebreak: boolean }[];
}
const index = (x: number, y: number) => Math.floor(y) * FL.cols + Math.floor(x);
const setTile = (g: LavaGame, i: number, v: string) => { g.tiles = g.tiles.slice(0, i) + v + g.tiles.slice(i + 1); };
export const grounded = (s: MatchState, r: Runner) => s.time >= r.airUntil;
const ring = (i: number) => { const x = i % FL.cols, y = Math.floor(i / FL.cols); return Math.min(x, y, FL.cols - 1 - x, FL.rows - 1 - y); };

function startRound(s: MatchState<LavaGame>, ids: string[], tiebreak: boolean) {
  const g = s.game;
  g.round++; g.tiebreak = tiebreak; g.phase = "play"; g.roundStart = s.time; g.rings = 0; g.timers = {};
  g.tiles = "1".repeat(FL.cols * FL.rows);
  g.regen = Array.from({ length: FL.cols * FL.rows }, () => random(s) < FL.regenShare ? "1" : "0").join("");
  // Start positions on a ring around the centre, same distance for everyone.
  const placed = s.players.filter(p => ids.includes(p.id));
  g.runners = Object.fromEntries(s.players.map(p => {
    const i = placed.indexOf(p), a = (i / Math.max(1, placed.length)) * Math.PI * 2 + (g.round - 1) * .5;
    const x = FL.cols / 2 + Math.cos(a) * 2.6, y = FL.rows / 2 + Math.sin(a) * 3.6;
    return [p.id, { id: p.id, x, y, vx: 0, vy: 0, lives: tiebreak ? 1 : FL.lives, alive: i >= 0 && !p.gone, airUntil: 0, jumpReady: s.time, invulnUntil: s.time + 500 }];
  }));
  emit(s, "round", tiebreak ? "Stechrunde!" : `Durchgang ${g.round} von ${FL.rounds}`, ids);
}

function endRound(s: MatchState<LavaGame>) {
  const g = s.game, runners = Object.values(g.runners).filter(r => r.alive || r.outAt !== undefined), alive = runners.filter(r => r.alive);
  const points: Record<string, number> = {};
  for (const r of runners) {
    const mine = r.alive ? Infinity : r.outAt!;
    // +1 for every opponent who fell earlier; simultaneous falls share the rank.
    points[r.id] = runners.filter(o => o.id !== r.id && !o.alive && o.outAt! < mine).length;
  }
  // Survivors share the best placement and the round bonus.
  const winners = alive.length ? alive.map(r => r.id) : runners.filter(r => r.outAt === Math.max(...runners.map(o => o.outAt ?? -1))).map(r => r.id);
  if (alive.length) for (const id of winners) points[id] += FL.winBonus / winners.length;
  if (g.tiebreak) { if (winners.length === 1) g.tiebreakWinner = winners[0]; }
  else for (const [id, n] of Object.entries(points)) g.points[id] = Math.round((g.points[id] + n) * 100) / 100;
  g.history.push({ points, winners, tiebreak: g.tiebreak });
  g.phase = "pause"; g.roundStart = s.time;
  emit(s, "result", winners.length === 1 ? "Durchgang gewonnen!" : "Geteilte Platzierung", winners);
}

function lava(s: MatchState<LavaGame>, r: Runner) {
  const g = s.game;
  r.lives--;
  if (r.lives <= 0) { r.alive = false; r.outAt = s.time; emit(s, "out", "In die Lava!", [r.id]); return; }
  // Safe respawn on the intact tile farthest from the others.
  const others = Object.values(g.runners).filter(o => o.alive && o.id !== r.id);
  let best = -1, score = -1;
  for (let i = 0; i < g.tiles.length; i++) if (g.tiles[i] === "1" && ring(i) >= 1) {
    const x = i % FL.cols + .5, y = Math.floor(i / FL.cols) + .5, d = others.length ? Math.min(...others.map(o => dist(o.x, o.y, x, y))) : 9;
    if (d > score + 1e-9) { best = i; score = d; }
  }
  if (best >= 0) Object.assign(r, { x: best % FL.cols + .5, y: Math.floor(best / FL.cols) + .5 });
  Object.assign(r, { vx: 0, vy: 0, invulnUntil: s.time + FL.invulnMs, airUntil: 0 });
  emit(s, "hit", "Heiß! Ein Leben weg", [r.id]);
}

export const floorIsLava: MatchModule<LavaGame> = {
  id: "lava",
  meta: {
    name: "Floor is Lava", seconds: (FL.rounds * (FL.roundMax + FL.pause) + FL.tiebreakMax + FL.pause) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Jede Platte, die du betrittst, zerbröselt nach 0,8 Sekunden. Platten mit leuchtender Rune kommen nach 2,5 Sekunden zurück. Mit dem Sprungknopf überspringst du kleine Lücken (alle 3 Sekunden). Lava kostet ein Leben, du hast 2 pro Durchgang. Ab Sekunde 10 verschwindet der Rand. +1 für jede Person, die vor dir fällt, +3 für den Durchgangssieg. Drei Durchgänge.",
    controls: "Stick: laufen · Knopf: springen.",
    look: { icon: "♨", action: "Bleib in Bewegung", hint: "Stick laufen · Knopf springen", goal: "Am längsten über der Lava bleiben" }
  },
  create(s) {
    s.game = { round: 0, phase: "play", tiebreak: false, roundStart: 0, tiles: "", regen: "", timers: {}, rings: 0, runners: {}, points: Object.fromEntries(s.players.map(p => [p.id, 0])), history: [] };
    startRound(s, s.players.map(p => p.id), false);
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    if (g.phase === "pause") {
      if (s.time - g.roundStart < FL.pause) return;
      const active = s.players.filter(p => !p.gone).map(p => p.id);
      if (!g.tiebreak && g.round < FL.rounds && active.length > 1) { startRound(s, active, false); return; }
      const best = Math.max(...active.map(id => g.points[id])), tied = active.filter(id => g.points[id] === best);
      if (!g.tiebreak && tied.length > 1) { startRound(s, tied, true); return; }
      g.phase = "done"; s.done = true; return;
    }
    if (g.phase !== "play") return;
    const roundTime = s.time - g.roundStart, alive = s.players.map(p => g.runners[p.id]).filter(r => r?.alive);
    for (const p of s.players) {
      const r = g.runners[p.id];
      if (!r?.alive) continue;
      const input = inputOfPlayer(s, p), speed = FL.speed * (grounded(s, r) ? 1 : FL.airSpeed);
      r.vx += (input.x * speed - r.vx) * FL.inertia; r.vy += (input.y * speed - r.vy) * FL.inertia;
      r.x = clamp(r.x + r.vx * dt, FL.radius, FL.cols - FL.radius); r.y = clamp(r.y + r.vy * dt, FL.radius, FL.rows - FL.radius);
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) if (grounded(s, alive[i]) === grounded(s, alive[j])) separateCircles(alive[i], alive[j], FL.radius, FL.radius, i + j);
    // Tile timers: cracking tiles fall, regenerating tiles return.
    for (const [key, time] of Object.entries(g.timers)) {
      if (time > s.time) continue;
      const i = Number(key);
      delete g.timers[key];
      if (g.tiles[i] === "2") { if (g.regen[i] === "1" && ring(i) >= g.rings) { setTile(g, i, "3"); g.timers[key] = s.time + FL.regenMs; } else setTile(g, i, "0"); }
      else if (g.tiles[i] === "3") setTile(g, i, ring(i) >= g.rings ? "1" : "0");
    }
    const rings = FL.ringAt.filter(t => roundTime >= t).length;
    if (rings > g.rings) {
      g.rings = rings;
      for (let i = 0; i < g.tiles.length; i++) if (ring(i) < rings) { setTile(g, i, "0"); delete g.timers[i]; }
      emit(s, "shrink", "Der Rand stürzt ein!", []);
    }
    for (const r of alive) {
      if (!grounded(s, r)) continue;
      const i = index(r.x, r.y), tile = g.tiles[i];
      if (tile === "1") { setTile(g, i, "2"); g.timers[i] = s.time + FL.crackMs; }
      else if ((tile === "0" || tile === "3") && s.time >= r.invulnUntil) lava(s, r);
    }
    const left = Object.values(g.runners).filter(r => r.alive);
    if (left.length <= 1 || roundTime >= (g.tiebreak ? FL.tiebreakMax : FL.roundMax)) endRound(s);
  },
  press(s, p: MatchPlayer, kind) {
    const g = s.game, r = g.runners[p.id];
    if (kind !== "a" || g.phase !== "play" || !r?.alive || s.time < r.jumpReady || !grounded(s, r)) return;
    r.airUntil = s.time + FL.jumpMs; r.jumpReady = s.time + FL.jumpCooldown;
    emit(s, "jump", "", [p.id]);
  },
  remove(s, id) { const r = s.game.runners[id]; if (r?.alive) { r.alive = false; r.outAt = s.time; } },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id], detail: g.tiebreakWinner === p.id ? "Stechrunde gewonnen" : `${g.history.filter(h => !h.tiebreak && h.winners.includes(p.id)).length} Durchgangssiege`,
      keys: [presence(p), g.points[p.id], g.tiebreakWinner === p.id ? 1 : 0] })));
  },
  finish(s) { if (s.game.phase === "play") endRound(s); s.game.phase = "done"; },
  bot(s, id) {
    const g = s.game, me = g.runners[id];
    if (g.phase !== "play" || !me?.alive) return {};
    // Head for the nearest intact tile that is not the current one; jump when the floor is about to give way.
    const here = index(me.x, me.y), salt = hash(`${id}:${g.round}`) % 7;
    let best = here, score = -Infinity;
    for (let i = 0; i < g.tiles.length; i++) {
      if (g.tiles[i] !== "1" || i === here) continue;
      const x = i % FL.cols + .5, y = Math.floor(i / FL.cols) + .5, d = dist(me.x, me.y, x, y);
      const crowd = Object.values(g.runners).filter(o => o.alive && o.id !== id && dist(o.x, o.y, x, y) < 1.2).length;
      const value = -d + ring(i) * .6 - crowd * 2 + ((i * 7 + salt) % 5) * .05;
      if (d < 3.2 && value > score) { best = i; score = value; }
    }
    const tx = best % FL.cols + .5, ty = Math.floor(best / FL.cols) + .5, dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1;
    const crumbling = g.tiles[here] === "2" && (g.timers[here] ?? Infinity) - s.time < 250;
    const gapAhead = g.tiles[index(clamp(me.x + dx / d * .7, 0, FL.cols - .01), clamp(me.y + dy / d * .7, 0, FL.rows - .01))] !== "1";
    return { x: dx / d, y: dy / d, pressA: s.time >= me.jumpReady && grounded(s, me) && (crumbling || gapAhead && d > .8) };
  }
};
