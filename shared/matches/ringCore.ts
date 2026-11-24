import { dist } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, type MatchInput, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Shared ring-out engine for Sumo Smash and Bumper Mayhem: circular arena,
 * lives, respawn with protection, credited ring-outs, shrinking edge, the
 * 75-second decision and a sudden death between tied leaders.
 */
export interface Fighter {
  id: string; x: number; y: number; vx: number; vy: number; heading: number;
  lives: number; alive: boolean; out: boolean; respawnAt: number; shieldUntil: number;
  actionAt: number; actionUntil: number; lastHitBy?: string; lastHitAt: number;
  ringOuts: number; outAt?: number;
  /** After a hard hit the fighter slides without control until this time. */
  stunUntil: number;
  /** Bumper Mayhem: giant car (bigger, heavier) until this time. */
  bigUntil?: number;
}
/** Bumper Mayhem extras: item boxes on the rink and oil slicks. */
export type RingItemKind = "mega" | "oil" | "wave";
export interface RingItem { id: number; kind: RingItemKind; x: number; y: number }
export interface OilSlick { id: number; owner: string; x: number; y: number; until: number; armedAt: number }
export interface Obstacle { id: number; x: number; y: number; r: number; angle: number }
export interface RingGame {
  fighters: Record<string, Fighter>;
  radius: number;
  obstacles: Obstacle[];
  sudden?: { ids: string[]; start: number };
  winner?: string;
  decided: boolean;
  /** After a ring-out everyone freezes and returns to their start places at this time. */
  resetAt?: number;
  items?: RingItem[];
  slicks?: OilSlick[];
  nextItem?: number;
  nextId?: number;
}
export interface RingRules {
  id: string; name: string; instruction: string; rules: string; controls: string; look: MatchModule["meta"]["look"];
  radius: number; minRadius: number; shrinkFrom: number; shrinkTo: number;
  body: number; lives: number; respawn: number; shield: number; credit: number;
  regular: number; suddenMax: number; suddenRadius: number;
  actionCooldown: number;
  /**
   * After a ring-out: `all` sends everyone back to their start places,
   * `duel` does that only when two fighters are left (otherwise the fallen one
   * returns alone on a free spot).
   */
  restart: "all" | "duel";
  /** Moves one fighter for one step from its input. */
  drive(f: Fighter, input: MatchInput, dt: number, now: number): void;
  /** Starts the button action (dash or turbo). */
  action(f: Fighter, now: number): void;
  /** Body radius of one fighter (default `body`), e.g. for a giant car. */
  bodyOf?(f: Fighter, now: number): number;
  /** Extra rules each step after driving and before contacts (items, hazards); not during a restart pause. */
  extras?(s: MatchState<RingGame>, dt: number): void;
  /** Contact between two fighters: resolve overlap and apply impulses. Returns the victim of a hard strike. */
  collide(a: Fighter, b: Fighter, now: number): Fighter | undefined;
  obstacles?(s: MatchState<RingGame>): Obstacle[];
  moveObstacles?(g: RingGame, time: number): void;
  bot(s: MatchState<RingGame>, me: Fighter): { x: number; y: number; act: boolean };
}

const spawnPoint = (i: number, count: number, r: number) => { const a = (i / count) * Math.PI * 2 - Math.PI / 2; return { x: Math.cos(a) * r, y: Math.sin(a) * r, heading: a + Math.PI }; };
/** Start place of a seat: on a circle inside the current ring. */
const startPlace = (s: MatchState<RingGame>, rules: RingRules, seat: number) => spawnPoint(seat, s.players.length, Math.min(rules.radius * .55, s.game.radius * .6));

/** The fallen fighter alone returns on the free spot of a small circle farthest from everyone else. */
function respawn(s: MatchState<RingGame>, rules: RingRules, f: Fighter) {
  const g = s.game, others = Object.values(g.fighters).filter(o => o.alive && !o.out && o.id !== f.id);
  let best = { x: 0, y: 0, heading: 0 }, score = -1;
  for (let i = 0; i < 8; i++) {
    const p = spawnPoint(i, 8, Math.min(1.6, g.radius * .4)), d = others.length ? Math.min(...others.map(o => dist(o.x, o.y, p.x, p.y))) : 9;
    if (d > score + 1e-9) { best = p; score = d; }
  }
  Object.assign(f, { x: best.x, y: best.y, heading: best.heading, vx: 0, vy: 0, out: false, stunUntil: 0, shieldUntil: s.time + rules.shield, lastHitBy: undefined, lastHitAt: -9999, bigUntil: 0 });
}

/** Everyone still in the match back to their own start place, standing still, briefly protected. */
function resetAll(s: MatchState<RingGame>, rules: RingRules) {
  const g = s.game;
  g.resetAt = undefined;
  s.players.forEach((p, seat) => {
    const f = g.fighters[p.id];
    if (!f?.alive || p.gone) return;
    Object.assign(f, startPlace(s, rules, seat), { vx: 0, vy: 0, out: false, stunUntil: 0, actionUntil: 0, shieldUntil: s.time + rules.shield, lastHitBy: undefined, lastHitAt: -9999, bigUntil: 0 });
  });
  emit(s, "reset", "Alle zurück auf die Startplätze!", []);
}

function ringOut(s: MatchState<RingGame>, rules: RingRules, f: Fighter) {
  const g = s.game;
  f.out = true; f.lives--; f.respawnAt = s.time + rules.respawn; f.vx = 0; f.vy = 0;
  // A ring-out ends the exchange: everyone stops and starts again from the start places
  // (Sumo only in a one-on-one; with more fighters the fallen one returns alone).
  if (rules.restart === "all" || contenders(g).length === 2) g.resetAt ??= s.time + rules.respawn;
  const by = f.lastHitBy && s.time - f.lastHitAt <= rules.credit && g.fighters[f.lastHitBy] ? f.lastHitBy : undefined;
  if (by && by !== f.id) g.fighters[by].ringOuts++;
  if (f.lives <= 0) { f.alive = false; f.outAt = s.time; }
  emit(s, "out", by ? "Ring-Out! +2" : "Ring-Out!", by ? [f.id, by] : [f.id]);
}

function contenders(g: RingGame) { return Object.values(g.fighters).filter(f => f.alive); }

function decide(s: MatchState<RingGame>) {
  const g = s.game, alive = contenders(g);
  if (alive.length <= 1) { g.winner = alive[0]?.id; g.decided = true; s.done = true; return; }
  // Time is up: most lives, then most ring-outs; still tied → sudden death.
  const bestLives = Math.max(...alive.map(f => f.lives)), byLives = alive.filter(f => f.lives === bestLives);
  const bestOuts = Math.max(...byLives.map(f => f.ringOuts)), top = byLives.filter(f => f.ringOuts === bestOuts);
  if (top.length === 1) { g.winner = top[0].id; g.decided = true; s.done = true; return; }
  if (g.sudden) { g.decided = true; s.done = true; return; }
  g.sudden = { ids: top.map(f => f.id), start: s.time }; g.resetAt = undefined; g.items = []; g.slicks = [];
  for (const f of Object.values(g.fighters)) if (!top.includes(f)) { f.alive = false; f.outAt ??= s.time; f.out = true; }
  top.forEach((f, i) => { f.lives = 1; Object.assign(f, spawnPoint(i, top.length, 1.4), { vx: 0, vy: 0, out: false, stunUntil: 0, shieldUntil: s.time + 800, bigUntil: 0 }); });
  emit(s, "sudden", "Sudden Death!", top.map(f => f.id));
}

export function ringModule(rules: RingRules): MatchModule<RingGame> {
  return {
    id: rules.id,
    meta: { name: rules.name, seconds: (rules.regular + rules.suddenMax) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20, instruction: rules.instruction, rules: rules.rules, controls: rules.controls, look: rules.look },
    create(s) {
      const count = s.players.length;
      s.game = { fighters: {}, radius: rules.radius, obstacles: [], decided: false };
      s.players.forEach((p, i) => {
        const point = spawnPoint(i, count, rules.radius * .55);
        s.game.fighters[p.id] = { id: p.id, ...point, vx: 0, vy: 0, lives: rules.lives, alive: true, out: false, respawnAt: 0, shieldUntil: 600, actionAt: -99999, actionUntil: 0, lastHitAt: -9999, ringOuts: 0, stunUntil: 0 };
      });
      s.game.obstacles = rules.obstacles?.(s) ?? [];
      return s.game;
    },
    step(s, dt) {
      const g = s.game;
      // Edge: shrink linearly between the two times; sudden death uses a small fixed ring.
      g.radius = g.sudden ? rules.suddenRadius : s.time <= rules.shrinkFrom ? rules.radius : rules.radius - (rules.radius - rules.minRadius) * Math.min(1, (s.time - rules.shrinkFrom) / (rules.shrinkTo - rules.shrinkFrom));
      rules.moveObstacles?.(g, s.time);
      // After a ring-out everyone in the ring stops until the restart from the start places.
      if (g.resetAt !== undefined) {
        if (s.time < g.resetAt) {
          for (const f of Object.values(g.fighters)) if (f.alive && !f.out) { f.vx *= .6; f.vy *= .6; f.x += f.vx * dt; f.y += f.vy * dt; }
          if (g.sudden ? s.time - g.sudden.start >= rules.suddenMax : s.time >= rules.regular) decide(s);
          return;
        }
        resetAll(s, rules);
      }
      for (const p of s.players) {
        const f = g.fighters[p.id];
        if (!f.alive) continue;
        if (f.out) { if (s.time >= f.respawnAt && !p.gone) respawn(s, rules, f); continue; }
        rules.drive(f, inputOfPlayer(s, p), dt, s.time);
        f.x += f.vx * dt; f.y += f.vy * dt;
      }
      rules.extras?.(s, dt);
      const active = s.players.map(p => g.fighters[p.id]).filter(f => f.alive && !f.out);
      const body = (f: Fighter) => rules.bodyOf?.(f, s.time) ?? rules.body;
      for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (dist(a.x, a.y, b.x, b.y) >= body(a) + body(b)) continue;
        // Only hard strikes become events; ordinary contact happens every step.
        const victim = rules.collide(a, b, s.time);
        if (victim) emit(s, "strike", "", [victim.id, victim === a ? b.id : a.id]);
      }
      for (const f of active) for (const o of g.obstacles) {
        const d = dist(f.x, f.y, o.x, o.y), min = body(f) + o.r;
        if (d >= min || d < 1e-9) continue;
        const nx = (f.x - o.x) / d, ny = (f.y - o.y) / d, along = f.vx * nx + f.vy * ny;
        f.x = o.x + nx * min; f.y = o.y + ny * min;
        if (along < 0) { f.vx -= 1.8 * along * nx; f.vy -= 1.8 * along * ny; emit(s, "bump", "", [f.id]); }
      }
      for (const f of active) if (Math.hypot(f.x, f.y) > g.radius + body(f) * .4) ringOut(s, rules, f);
      if (contenders(g).length <= 1) { decide(s); return; }
      if (g.sudden ? s.time - g.sudden.start >= rules.suddenMax : !g.sudden && s.time >= rules.regular) decide(s);
    },
    press(s, p: MatchPlayer, kind) {
      const f = s.game.fighters[p.id];
      if (kind !== "a" || !f?.alive || f.out || s.game.resetAt !== undefined || s.time - f.actionAt < rules.actionCooldown) return;
      f.actionAt = s.time;
      rules.action(f, s.time);
      emit(s, "action", "", [p.id]);
    },
    remove(s, id) { const f = s.game.fighters[id]; if (f?.alive) { f.alive = false; f.out = true; f.outAt = s.time; } },
    standings(s) {
      const g = s.game;
      return rank(s.players.map(p => {
        const f = g.fighters[p.id];
        return { id: p.id, score: f.ringOuts * 2, detail: `${f.alive ? `${f.lives} Leben` : "ausgeschieden"} · ${f.ringOuts} Ring-Outs`,
          keys: [presence(p), g.winner === p.id ? 1 : 0, f.alive ? 1e9 : f.outAt ?? 0, f.lives, f.ringOuts] };
      }));
    },
    finish(s) { if (!s.game.decided) { s.game.decided = true; } },
    view() { /* everything is public */ },
    bot(s, id) {
      const f = s.game.fighters[id];
      if (!f?.alive || f.out || s.game.resetAt !== undefined) return {};
      const intent = rules.bot(s, f), jitter = (hash(`${id}:${Math.floor(s.time / 900)}`) % 100) / 100 - .5;
      return { x: Math.max(-1, Math.min(1, intent.x + jitter * .2)), y: Math.max(-1, Math.min(1, intent.y - jitter * .2)), pressA: intent.act };
    }
  };
}

/**
 * Resolves the overlap of two equal circles and exchanges momentum along the
 * contact normal. The body pushing harder is credited for a later ring-out.
 * Protected (freshly respawned) bodies neither receive nor give impulses.
 */
export function bounce(a: Fighter, b: Fighter, radius: number, restitution: number, now: number, protectedA: boolean, protectedB: boolean) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d < 1e-9) { dx = 1; dy = 0; d = 1; }
  const nx = dx / d, ny = dy / d, overlap = radius * 2 - d;
  a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2;
  const pushA = a.vx * nx + a.vy * ny, pushB = -(b.vx * nx + b.vy * ny), closing = pushA + pushB;
  if (closing <= 0 || protectedA || protectedB) return { nx, ny, closing: 0 };
  const j = closing * (1 + restitution) / 2;
  a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
  if (pushA > pushB) { b.lastHitBy = a.id; b.lastHitAt = now; } else { a.lastHitBy = b.id; a.lastHitAt = now; }
  return { nx, ny, closing };
}
