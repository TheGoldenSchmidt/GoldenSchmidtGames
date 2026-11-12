import { emit, hash, presence, rank, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Light Trails – Neon Survival. Gliders move one cell per tick on a grid and
 * leave permanent trails. All moves of a tick are resolved together, so
 * simultaneous crashes share the same rank. Trails are stored as corner
 * lists; the authority rebuilds occupancy each tick (small state, no grid).
 */
export const LT = {
  cols: 21, rows: 33,
  /** Milliseconds per cell; identical for everyone. */
  moveMs: 150,
  shrinkAfter: 12000, shrinkEvery: 1500, minInner: 5,
  roundMax: 40000, pause: 2800, rounds: 3, survivorBonus: 3
} as const;
/** 0 up, 1 right, 2 down, 3 left (screen directions). */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export interface Rider { id: string; x: number; y: number; dir: number; alive: boolean; diedAt?: number; queue: number[]; path: [number, number][] }
export interface TrailsGame {
  round: number;
  phase: "play" | "pause" | "done";
  roundStart: number;
  /** Move counter inside the round; also the time key for simultaneous crashes. */
  move: number;
  border: number;
  riders: Record<string, Rider>;
  points: Record<string, number>;
  history: { points: Record<string, number>; survivor?: string }[];
}

const inner = (g: TrailsGame) => ({ x0: g.border, y0: g.border, x1: LT.cols - 1 - g.border, y1: LT.rows - 1 - g.border });
const key = (x: number, y: number) => y * LT.cols + x;

/** All blocked cells: shrunken border plus every trail including the heads. */
export function occupied(g: TrailsGame) {
  const cells = new Set<number>();
  for (const rider of Object.values(g.riders)) {
    const points = [...rider.path, [rider.x, rider.y] as [number, number]];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i], [bx, by] = points[Math.min(i + 1, points.length - 1)];
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= steps; k++) cells.add(key(ax + Math.sign(bx - ax) * k, ay + Math.sign(by - ay) * k));
    }
  }
  return cells;
}
export function blocked(g: TrailsGame, cells: Set<number>, x: number, y: number) {
  const box = inner(g);
  return x < box.x0 || y < box.y0 || x > box.x1 || y > box.y1 || cells.has(key(x, y));
}

/** Fair spawns: evenly spaced on an inset ring, all heading clockwise. */
function spawns(count: number, rotate: number) {
  const x0 = 3, y0 = 4, x1 = LT.cols - 4, y1 = LT.rows - 5, w = x1 - x0, h = y1 - y0, length = 2 * (w + h);
  return Array.from({ length: count }, (_, i) => {
    let d = Math.round((((i + rotate) % count + count) % count + .5) * length / count) % length;
    if (d < w) return { x: x0 + d, y: y0, dir: 1 };
    d -= w; if (d < h) return { x: x1, y: y0 + d, dir: 2 };
    d -= h; if (d < w) return { x: x1 - d, y: y1, dir: 3 };
    d -= w; return { x: x0, y: y1 - d, dir: 0 };
  });
}

function startRound(s: MatchState<TrailsGame>) {
  const g = s.game, ids = s.players.map(p => p.id), places = spawns(ids.length, g.round);
  g.round++; g.phase = "play"; g.roundStart = s.time; g.move = 0; g.border = 0;
  g.riders = Object.fromEntries(ids.map((id, i) => {
    const gone = s.players[i].gone;
    return [id, { id, ...places[i], alive: !gone, ...(gone ? { diedAt: -1 } : {}), queue: [], path: [[places[i].x, places[i].y]] }];
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

function turn(rider: Rider, command: number) {
  const base = rider.queue.at(-1) ?? rider.dir;
  const next = command < 4 ? command : command === 4 ? (base + 3) % 4 : (base + 1) % 4;
  // Only 90° turns: same direction and instant reversal are ignored.
  if (next === base || next === (base + 2) % 4) return;
  if (rider.queue.length < 2) rider.queue.push(next);
}

function moveAll(s: MatchState<TrailsGame>) {
  const g = s.game, cells = occupied(g), alive = Object.values(g.riders).filter(r => r.alive);
  g.move++;
  const targets = new Map<string, [number, number]>();
  for (const r of alive) {
    const next = r.queue.shift();
    if (next !== undefined) { r.path.push([r.x, r.y]); r.dir = next; }
    targets.set(r.id, [r.x + DIRS[r.dir][0], r.y + DIRS[r.dir][1]]);
  }
  const crashed = alive.filter(r => {
    const [x, y] = targets.get(r.id)!;
    return blocked(g, cells, x, y) || alive.some(o => o.id !== r.id && targets.get(o.id)![0] === x && targets.get(o.id)![1] === y);
  });
  for (const r of alive) if (!crashed.includes(r)) [r.x, r.y] = targets.get(r.id)!;
  for (const r of crashed) { r.alive = false; r.diedAt = g.move; }
  if (crashed.length) emit(s, "out", crashed.length > 1 ? "Gleichzeitiger Crash!" : "Crash!", crashed.map(r => r.id));
  // Shrinking: the new wall ring eliminates gliders standing on it in the same tick.
  const roundTime = s.time - g.roundStart, layers = roundTime < LT.shrinkAfter ? 0 : 1 + Math.floor((roundTime - LT.shrinkAfter) / LT.shrinkEvery);
  const maxBorder = Math.floor((LT.cols - LT.minInner) / 2);
  if (Math.min(layers, maxBorder) > g.border) {
    g.border = Math.min(layers, maxBorder);
    const box = inner(g), squeezed = alive.filter(r => r.alive && (r.x < box.x0 || r.y < box.y0 || r.x > box.x1 || r.y > box.y1));
    for (const r of squeezed) { r.alive = false; r.diedAt = g.move; }
    if (squeezed.length) emit(s, "out", "Von der Wand erwischt!", squeezed.map(r => r.id));
    else if (g.border === 1) emit(s, "shrink", "Die Arena schrumpft!", []);
  }
}

export const lightTrails: MatchModule<TrailsGame> = {
  id: "trails",
  meta: {
    name: "Light Trails", seconds: 3 * (LT.roundMax + LT.pause) / 1000 + 5, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Dein Gleiter fährt von selbst und zieht eine tödliche Lichtspur. Wische in eine Richtung oder tippe ⟲/⟳, um um 90 Grad abzubiegen. Wand, eigene oder fremde Spur bedeuten das Aus. Ab Sekunde 12 schrumpft die Arena. Pro Durchgang gibt es +1 für jeden Gegner, der vor dir ausscheidet, und +3 als letzte Person im Spiel. Drei Durchgänge.",
    controls: "Wischen oder ⟲/⟳ tippen zum Abbiegen.",
    look: { icon: "⌁", action: "Überlebe im Neon-Raster", hint: "Wischen oder ⟲/⟳ zum Abbiegen", goal: "Am längsten überleben · 3 Durchgänge" }
  },
  create(s) {
    s.game = { round: 0, phase: "play", roundStart: 0, move: 0, border: 0, riders: {}, points: Object.fromEntries(s.players.map(p => [p.id, 0])), history: [] };
    startRound(s);
    return s.game;
  },
  step(s) {
    const g = s.game;
    if (g.phase === "pause") {
      if (s.time - g.roundStart >= LT.pause) {
        if (g.round >= LT.rounds || s.players.filter(p => !p.gone).length < 2) { g.phase = "done"; s.done = true; } else startRound(s);
      }
      return;
    }
    if (g.phase !== "play") return;
    const roundTime = s.time - g.roundStart;
    while ((g.move + 1) * LT.moveMs <= roundTime && g.phase === "play") {
      moveAll(s);
      if (Object.values(g.riders).filter(r => r.alive).length <= 1) endRound(s);
    }
    if (g.phase === "play" && roundTime >= LT.roundMax) endRound(s);
  },
  press(s, p: MatchPlayer, kind, _at, value) {
    const rider = s.game.riders[p.id];
    if (kind !== "n" || s.game.phase !== "play" || !rider?.alive || !Number.isInteger(value) || value < 0 || value > 5) return;
    turn(rider, value);
  },
  remove(s, id) {
    const rider = s.game.riders[id];
    if (rider?.alive) { rider.alive = false; rider.diedAt = s.game.move; }
    if (s.game.phase === "play" && Object.values(s.game.riders).filter(r => r.alive).length <= 1) endRound(s);
  },
  standings(s) {
    return rank(s.players.map(p => ({ id: p.id, score: s.game.points[p.id], keys: [presence(p), s.game.points[p.id]],
      detail: `${s.game.history.filter(h => h.survivor === p.id).length}× letzte Person` })));
  },
  finish(s) { if (s.game.phase === "play") endRound(s); s.game.phase = "done"; },
  view(s, viewer) {
    // Other gliders' queued turns are not visible.
    for (const rider of Object.values(s.game.riders)) if (rider.id !== viewer) rider.queue = [];
  },
  bot(s, id) {
    const g = s.game, me = g.riders[id];
    if (g.phase !== "play" || !me?.alive || me.queue.length) return {};
    const cells = occupied(g);
    // Choose the direction with the most reachable space (bounded flood fill); small per-bot bias.
    const space = (x: number, y: number) => {
      if (blocked(g, cells, x, y)) return -1;
      const seen = new Set([key(x, y)]), stack = [[x, y]];
      while (stack.length && seen.size < 120) {
        const [cx, cy] = stack.pop()!;
        for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy, k = key(nx, ny); if (!seen.has(k) && !blocked(g, cells, nx, ny)) { seen.add(k); stack.push([nx, ny]); } }
      }
      return seen.size;
    };
    // Deterministic per-bot variation keeps identical bots from mirroring each other into head-on crashes.
    const roll = hash(`${id}:${g.round}:${g.move}`), wander = roll % 9 === 0 ? 1 + roll % 2 : 0;
    const options = [me.dir, (me.dir + 1) % 4, (me.dir + 3) % 4].map((dir, i) => ({ dir, score: space(me.x + DIRS[dir][0], me.y + DIRS[dir][1]) + (i === 0 ? 4 : 0) + (i === wander && i > 0 ? 25 : 0) }));
    const best = options.sort((a, b) => b.score - a.score)[0];
    return best.dir !== me.dir && best.score > options.find(o => o.dir === me.dir)!.score ? { command: best.dir } : {};
  }
};
