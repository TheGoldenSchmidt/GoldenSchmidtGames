import { emit, hash, inputOfPlayer, presence, rank, type MatchModule, type MatchState } from "./types";

/**
 * Light Trails – Neon Survival. Gliders drive at a constant speed and steer
 * continuously (no grid, no 90° steps): the stick points where to go, the
 * hold buttons turn left or right at the full turning rate. Every glider
 * leaves a permanent light trail; touching a wall, any trail or another
 * glider ends the round for it. All moves of a step are resolved together,
 * so simultaneous crashes share the same rank. Field units: x right, y down;
 * heading 0 points up.
 *
 * Trails are stored as polyline points (a new point whenever the heading
 * changed noticeably); the public view sends them as a compact string
 * (`encodeTrail`), so snapshots stay small.
 */
export const LT = {
  w: 30, h: 48,
  /** Units per second; identical for everyone. */
  speed: 7,
  /** Maximum turning rate in radians per second (turning circle ≈ 2.1 units). */
  turn: 3.3,
  /** Glider head radius and half the trail width (contact at their sum). */
  radius: .28, trail: .14,
  /** A new trail point after this heading change (radians) or this distance. */
  pointAngle: .1, pointDist: 6,
  /** Own trail just behind the head never counts (path length). */
  ownGrace: .9,
  shrinkAfter: 14000, shrinkRate: .55, minInner: 9,
  roundMax: 45000, pause: 2800, rounds: 3, survivorBonus: 3
} as const;
export interface Rider {
  id: string; x: number; y: number;
  /** Heading in radians: 0 = up, positive = clockwise. */
  a: number;
  alive: boolean; diedAt?: number;
  /** Trail points as flat x, y pairs (authority); the head is not part of it. */
  pts: number[];
  /** Heading at the last stored point. */
  lastA: number;
}
export interface TrailsGame {
  round: number;
  phase: "play" | "pause" | "done";
  roundStart: number;
  /** Width of the closed border ring (units). */
  border: number;
  riders: Record<string, Rider>;
  points: Record<string, number>;
  history: { points: Record<string, number>; survivor?: string }[];
  /** Public view only: encoded trail per rider (`pts` are removed there). */
  trails?: Record<string, string>;
}

const Q = .05;
/** Two base-36 characters per coordinate (0.05 units, up to 64 units). */
export function encodeTrail(pts: readonly number[]) { let out = ""; for (const v of pts) out += Math.max(0, Math.min(1295, Math.round(v / Q))).toString(36).padStart(2, "0"); return out; }
export function decodeTrail(text: string, from = 0, into: number[] = []) { for (let i = from - from % 2; i + 1 < text.length; i += 2) into.push(parseInt(text.slice(i, i + 2), 36) * Q); return into; }
/** Trail points of a rider from the authority state or a public view. */
export function trailOf(g: TrailsGame, r: Rider) { return r.pts ?? decodeTrail(g.trails?.[r.id] ?? ""); }

export const inner = (g: Pick<TrailsGame, "border">) => ({ x0: g.border, y0: g.border, x1: LT.w - g.border, y1: LT.h - g.border });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dir = (a: number) => [Math.sin(a), -Math.cos(a)] as const;
/** Distance from point (px, py) to the segment (ax, ay)–(bx, by). */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy, t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

/** Fair spawns: evenly spaced on an inset ring, all heading clockwise along it. */
function spawns(count: number, rotate: number) {
  const x0 = 5, y0 = 6, x1 = LT.w - 5, y1 = LT.h - 6, w = x1 - x0, h = y1 - y0, length = 2 * (w + h);
  return Array.from({ length: count }, (_, i) => {
    let d = ((((i + rotate) % count) + count) % count + .5) * length / count % length;
    if (d < w) return { x: x0 + d, y: y0, a: Math.PI / 2 };
    d -= w; if (d < h) return { x: x1, y: y0 + d, a: Math.PI };
    d -= h; if (d < w) return { x: x1 - d, y: y1, a: -Math.PI / 2 };
    d -= w; return { x: x0, y: y1 - d, a: 0 };
  });
}

function startRound(s: MatchState<TrailsGame>) {
  const g = s.game, ids = s.players.map(p => p.id), places = spawns(ids.length, g.round);
  g.round++; g.phase = "play"; g.roundStart = s.time; g.border = 0;
  g.riders = Object.fromEntries(ids.map((id, i) => {
    const gone = s.players[i].gone, { x, y, a } = places[i];
    return [id, { id, x, y, a, alive: !gone, ...(gone ? { diedAt: -1 } : {}), pts: [x, y], lastA: a }];
  }));
  emit(s, "round", `Durchgang ${g.round} von ${LT.rounds}`, []);
}

function endRound(s: MatchState<TrailsGame>) {
  const g = s.game, riders = Object.values(g.riders), alive = riders.filter(r => r.alive);
  const points: Record<string, number> = {};
  // +1 for every opponent eliminated strictly earlier; simultaneous crashes do not count against each other.
  for (const r of riders) {
    const mine = r.alive ? Infinity : r.diedAt!;
    points[r.id] = riders.filter(o => o.id !== r.id && !o.alive && o.diedAt! < mine).length;
  }
  const survivor = alive.length === 1 && riders.length > 1 ? alive[0].id : undefined;
  if (survivor) points[survivor] += LT.survivorBonus;
  for (const [id, n] of Object.entries(points)) g.points[id] += n;
  g.history.push({ points, ...(survivor ? { survivor } : {}) });
  g.phase = "pause"; g.roundStart = s.time;
  emit(s, "result", survivor ? "Letzter Überlebender: +3" : "Durchgang vorbei", survivor ? [survivor] : []);
}

/**
 * Whether the head of `r` touches a trail: all segments of every trail plus
 * the live segment (last point → head) of the others; the own trail only
 * further back than `ownGrace` along the path.
 */
export function hitsTrail(g: TrailsGame, r: Rider, pts: (o: Rider) => readonly number[]) {
  const reach = LT.radius + LT.trail;
  for (const o of Object.values(g.riders)) {
    const p = pts(o), own = o.id === r.id;
    let end = p.length - 2;
    if (own) {
      // Skip the newest segments until the path behind the head is long enough.
      let path = Math.hypot(r.x - p[end], r.y - p[end + 1]);
      while (end >= 2 && path < LT.ownGrace) { path += Math.hypot(p[end] - p[end - 2], p[end + 1] - p[end - 1]); end -= 2; }
    } else if (segmentDistance(r.x, r.y, p[end], p[end + 1], o.x, o.y) < reach) return true;
    for (let i = 0; i + 2 <= end; i += 2) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
      if (Math.min(ax, bx) - reach > r.x || Math.max(ax, bx) + reach < r.x || Math.min(ay, by) - reach > r.y || Math.max(ay, by) + reach < r.y) continue;
      if (segmentDistance(r.x, r.y, ax, ay, bx, by) < reach) return true;
    }
  }
  return false;
}

function moveAll(s: MatchState<TrailsGame>, dt: number) {
  const g = s.game, alive = s.players.map(p => g.riders[p.id]).filter(r => r?.alive);
  for (const r of alive) {
    const p = s.players.find(q => q.id === r.id)!, input = inputOfPlayer(s, p), limit = LT.turn * dt;
    // Hold buttons turn at the full rate; otherwise the stick points where to go.
    let turn = 0;
    if (input.ha !== input.hb) turn = input.ha ? -limit : limit;
    else if (Math.hypot(input.x, input.y) > .3) turn = Math.max(-limit, Math.min(limit, wrap(Math.atan2(input.x, -input.y) - r.a)));
    r.a = wrap(r.a + turn);
    const [dx, dy] = dir(r.a);
    r.x += dx * LT.speed * dt; r.y += dy * LT.speed * dt;
    const lx = r.pts[r.pts.length - 2], ly = r.pts[r.pts.length - 1];
    if (Math.abs(wrap(r.a - r.lastA)) >= LT.pointAngle || Math.hypot(r.x - lx, r.y - ly) >= LT.pointDist) { r.pts.push(Math.round(r.x * 100) / 100, Math.round(r.y * 100) / 100); r.lastA = r.a; }
  }
  const box = inner(g), crashed = alive.filter(r =>
    r.x - LT.radius < box.x0 || r.y - LT.radius < box.y0 || r.x + LT.radius > box.x1 || r.y + LT.radius > box.y1 ||
    alive.some(o => o !== r && Math.hypot(o.x - r.x, o.y - r.y) < LT.radius * 2) || hitsTrail(g, r, o => o.pts));
  for (const r of crashed) { r.alive = false; r.diedAt = s.time; }
  if (crashed.length) emit(s, "out", crashed.length > 1 ? "Gleichzeitiger Crash!" : "Crash!", crashed.map(r => r.id));
}

export const lightTrails: MatchModule<TrailsGame> = {
  id: "trails",
  meta: {
    name: "Light Trails", seconds: 3 * (LT.roundMax + LT.pause) / 1000 + 5, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Dein Gleiter fährt von selbst und zieht eine tödliche Lichtspur. Du lenkst stufenlos: Der Stick zeigt, wohin du fahren willst, ⟲ und ⟳ (halten) lenken voll nach links oder rechts. Wand, eigene oder fremde Spur bedeuten das Aus. Ab Sekunde 14 schrumpft die Arena. Pro Durchgang gibt es +1 für jeden Gegner, der vor dir ausscheidet, und +3 als letzte Person im Spiel. Drei Durchgänge.",
    controls: "Stick: Richtung · ⟲/⟳ halten: voll einlenken.",
    look: { icon: "⌁", action: "Überlebe im Neon-Feld", hint: "Stick lenkt · ⟲/⟳ halten", goal: "Am längsten überleben · 3 Durchgänge" }
  },
  create(s) {
    s.game = { round: 0, phase: "play", roundStart: 0, border: 0, riders: {}, points: Object.fromEntries(s.players.map(p => [p.id, 0])), history: [] };
    startRound(s);
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    if (g.phase === "pause") {
      if (s.time - g.roundStart >= LT.pause) {
        if (g.round >= LT.rounds || s.players.filter(p => !p.gone).length < 2) { g.phase = "done"; s.done = true; } else startRound(s);
      }
      return;
    }
    if (g.phase !== "play") return;
    const roundTime = s.time - g.roundStart;
    g.border = Math.round(Math.min((LT.w - LT.minInner) / 2, Math.max(0, (roundTime - LT.shrinkAfter) / 1000 * LT.shrinkRate)) * 100) / 100;
    if (g.border > 0 && roundTime - dt * 1000 < LT.shrinkAfter) emit(s, "shrink", "Die Arena schrumpft!", []);
    moveAll(s, dt);
    if (Object.values(g.riders).filter(r => r.alive).length <= 1 || roundTime >= LT.roundMax) endRound(s);
  },
  remove(s, id) {
    const rider = s.game.riders[id];
    if (rider?.alive) { rider.alive = false; rider.diedAt = s.time; }
    if (s.game.phase === "play" && Object.values(s.game.riders).filter(r => r.alive).length <= 1) endRound(s);
  },
  standings(s) {
    return rank(s.players.map(p => ({ id: p.id, score: s.game.points[p.id], keys: [presence(p), s.game.points[p.id]],
      detail: `${s.game.history.filter(h => h.survivor === p.id).length}× letzte Person` })));
  },
  finish(s) { if (s.game.phase === "play") endRound(s); s.game.phase = "done"; },
  publicGame(s) {
    // Trails travel as compact strings; the authority keeps the numbers.
    const g = s.game;
    return { ...g, history: structuredClone(g.history), points: { ...g.points },
      riders: Object.fromEntries(Object.entries(g.riders).map(([id, r]) => { const { pts: _pts, ...rest } = r; return [id, rest as Rider]; })),
      trails: Object.fromEntries(Object.entries(g.riders).map(([id, r]) => [id, encodeTrail(r.pts)])) };
  },
  bot(s, id) {
    const g = s.game, me = g.riders[id];
    if (g.phase !== "play" || !me?.alive) return {};
    // Occupancy of the field in half-unit cells (walls and every trail), then look ahead along a few turning rates.
    const cell = .5, cols = Math.ceil(LT.w / cell), rows = Math.ceil(LT.h / cell), grid = new Uint8Array(cols * rows);
    const mark = (x: number, y: number) => { const c = Math.floor(x / cell), r = Math.floor(y / cell); if (c >= 0 && r >= 0 && c < cols && r < rows) grid[r * cols + c] = 1; };
    for (const o of Object.values(g.riders)) {
      const p = [...trailOf(g, o), o.x, o.y], own = o.id === id;
      // The own newest stretch is left out (the glider sits on it).
      let end = p.length - 2, path = 0;
      if (own) while (end >= 2 && path < 1.4) { path += Math.hypot(p[end] - p[end - 2], p[end + 1] - p[end - 1]); end -= 2; }
      for (let i = 0; i + 2 <= end; i += 2) {
        const steps = Math.ceil(Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) / .2);
        for (let k = 0; k <= steps; k++) mark(p[i] + (p[i + 2] - p[i]) * k / steps, p[i + 1] + (p[i + 3] - p[i + 1]) * k / steps);
      }
    }
    const roundTime = s.time - g.roundStart, roll = hash(`${id}:${g.round}:${Math.floor(s.time / 700)}`);
    const free = (t: number) => {
      let a = me.a, x = me.x, y = me.y;
      for (let k = 1; k <= 44; k++) {
        a += t * LT.turn * .05; x += Math.sin(a) * LT.speed * .05; y -= Math.cos(a) * LT.speed * .05;
        const border = Math.min((LT.w - LT.minInner) / 2, Math.max(0, (roundTime + k * 50 - LT.shrinkAfter) / 1000 * LT.shrinkRate)) + .45;
        if (x < border || y < border || x > LT.w - border || y > LT.h - border || grid[Math.floor(y / cell) * cols + Math.floor(x / cell)]) return k;
      }
      return 45;
    };
    // Deterministic per-bot variation keeps identical bots from mirroring each other into head-on crashes.
    const options = [-1, -.5, 0, .5, 1].map((t, i) => ({ t, score: free(t) + (t === 0 ? 3 : 0) + (roll % 5 === i ? 2 : 0) }));
    const best = options.sort((a, b) => b.score - a.score)[0], target = me.a + best.t * LT.turn * .05;
    return { x: Math.sin(target), y: -Math.cos(target) };
  }
};
