import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Bomb Arena – Explosive Maze. Cell-based movement with smooth interpolation,
 * bombs with fixed fuses, cross-shaped flames, chain reactions and a spiral
 * that closes the arena. Cells are a digit string: 0 floor, 1 fixed wall,
 * 2 crate (destructible), 3 closing wall.
 */
export const BA = {
  cols: 11, rows: 15,
  fuse: 2000, flameMs: 500, range: 2, moveMs: 260, minMoveMs: 160, speedStep: 30,
  lives: 2, invulnMs: 1500, roundMax: 40000, shrinkAfter: 25000, shrinkEvery: 350,
  pause: 2800, rounds: 2, knockout: 2, roundWin: 3, dropChance: .32, crateFill: .62,
  suddenMax: 30000, suddenShrink: 8000, kickStepMs: 90
} as const;
export type BombPower = "range" | "bomb" | "speed" | "kick";
export interface Bomber { id: string; cx: number; cy: number; tx: number; ty: number; progress: number; dir: number; lives: number; alive: boolean; invulnUntil: number; maxBombs: number; range: number; speed: number; kick: boolean; hitGroups: number[]; knockedAt?: number }
export interface Bomb { id: number; x: number; y: number; owner: string; at: number; range: number; group?: number; passFor: string[]; slide?: { dx: number; dy: number; next: number } }
export interface Flame { x: number; y: number; until: number; group: number; owner: string; center: boolean }
export interface BombGame {
  round: number;
  phase: "play" | "pause" | "done";
  sudden: boolean;
  roundStart: number;
  cells: string;
  bombers: Record<string, Bomber>;
  bombs: Bomb[];
  flames: Flame[];
  items: { x: number; y: number; kind: BombPower }[];
  nextId: number;
  shrunk: number;
  points: Record<string, number>;
  suddenWinner?: string;
  history: { points: Record<string, number>; winners: string[]; sudden: boolean }[];
  roundPoints: Record<string, number>;
}
export const DIR4: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SPAWNS = [[1, 1], [9, 13], [9, 1], [1, 13], [1, 7], [9, 7]] as const;
const at = (g: BombGame, x: number, y: number) => x < 0 || y < 0 || x >= BA.cols || y >= BA.rows ? "1" : g.cells[y * BA.cols + x];
const setCell = (g: BombGame, x: number, y: number, v: string) => { const i = y * BA.cols + x; g.cells = g.cells.slice(0, i) + v + g.cells.slice(i + 1); };
/** The cell a bomber occupies for bombs, flames and items. */
export const cellOf = (b: Bomber) => b.progress < .5 ? [b.cx, b.cy] as const : [b.tx, b.ty] as const;

/** Spiral order of the inner cells, from the outside in. */
export function spiral() {
  const out: [number, number][] = [];
  let x0 = 1, y0 = 1, x1 = BA.cols - 2, y1 = BA.rows - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
}
const SPIRAL = spiral();

function buildArena(s: MatchState<BombGame>, crates: boolean) {
  let cells = "";
  for (let y = 0; y < BA.rows; y++) for (let x = 0; x < BA.cols; x++) {
    const border = x === 0 || y === 0 || x === BA.cols - 1 || y === BA.rows - 1, pillar = x % 2 === 0 && y % 2 === 0;
    // Spawn corners stay free: the spawn cell and its two neighbours along the walls.
    const safe = SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 1 || (sx === x && Math.abs(sy - y) <= 2) || (sy === y && Math.abs(sx - x) <= 2));
    cells += border || pillar ? "1" : crates && !safe && random(s) < BA.crateFill ? "2" : "0";
  }
  return cells;
}

function startRound(s: MatchState<BombGame>, sudden: boolean, ids: string[]) {
  const g = s.game;
  g.round++; g.sudden = sudden; g.phase = "play"; g.roundStart = s.time; g.shrunk = 0;
  g.cells = buildArena(s, !sudden); g.bombs = []; g.flames = []; g.items = []; g.roundPoints = {};
  g.bombers = Object.fromEntries(s.players.map((p, i) => {
    const [x, y] = SPAWNS[i % SPAWNS.length], playing = ids.includes(p.id) && !p.gone;
    return [p.id, { id: p.id, cx: x, cy: y, tx: x, ty: y, progress: 0, dir: 2, lives: sudden ? 1 : BA.lives, alive: playing, invulnUntil: s.time + 800, maxBombs: 1, range: BA.range, speed: 0, kick: false, hitGroups: [] }];
  }));
  emit(s, "round", sudden ? "Sudden Death!" : `Durchgang ${g.round} von ${BA.rounds}`, ids);
}

function award(g: BombGame, id: string, points: number) {
  g.points[id] = Math.round((g.points[id] + points) * 100) / 100;
  g.roundPoints[id] = Math.round(((g.roundPoints[id] ?? 0) + points) * 100) / 100;
}

function endRound(s: MatchState<BombGame>) {
  const g = s.game, alive = Object.values(g.bombers).filter(b => b.alive);
  let winners: string[] = [];
  if (alive.length === 1) winners = [alive[0].id];
  else if (alive.length > 1) {
    // Time is up: most remaining lives win; ties share the round bonus.
    const best = Math.max(...alive.map(b => b.lives));
    winners = alive.filter(b => b.lives === best).map(b => b.id);
  }
  if (g.sudden) { if (winners.length === 1) g.suddenWinner = winners[0]; }
  else for (const id of winners) award(g, id, BA.roundWin / winners.length);
  g.history.push({ points: { ...g.roundPoints }, winners, sudden: g.sudden });
  g.phase = "pause"; g.roundStart = s.time;
  emit(s, "result", winners.length === 1 ? "Durchgang gewonnen!" : winners.length ? "Geteilter Sieg" : "Niemand übrig", winners);
}

function hit(s: MatchState<BombGame>, b: Bomber, by: string | undefined) {
  const g = s.game;
  b.lives--;
  if (b.lives > 0) {
    // Safe respawn: the spawn farthest from bombs and flames.
    const danger = (x: number, y: number) => Math.min(99, ...g.bombs.map(o => Math.abs(o.x - x) + Math.abs(o.y - y)), ...g.flames.map(f => Math.abs(f.x - x) + Math.abs(f.y - y)));
    const options = SPAWNS.filter(([x, y]) => at(g, x, y) === "0" && !Object.values(g.bombers).some(o => o.id !== b.id && o.alive && ((o.cx === x && o.cy === y) || (o.tx === x && o.ty === y))));
    const [x, y] = options.length ? [...options].sort((a, c) => danger(c[0], c[1]) - danger(a[0], a[1]))[0] : [b.cx, b.cy];
    Object.assign(b, { cx: x, cy: y, tx: x, ty: y, progress: 0, invulnUntil: s.time + BA.invulnMs });
    emit(s, "hit", "Getroffen! Sicherer Neustart", [b.id]);
    return;
  }
  b.alive = false; b.knockedAt = s.time;
  // Only an opponent's bomb scores; own bombs and the closing arena give nothing.
  if (by && by !== b.id && !g.sudden) award(g, by, BA.knockout);
  emit(s, "out", by && by !== b.id ? "K.o.!" : "Ausgeschieden", by && by !== b.id ? [b.id, by] : [b.id]);
}

function explode(s: MatchState<BombGame>, first: Bomb) {
  const g = s.game, group = first.group ?? g.nextId++, queue = [first];
  first.group = group;
  const broken: [number, number][] = [];
  while (queue.length) {
    const bomb = queue.shift()!;
    g.bombs = g.bombs.filter(o => o !== bomb);
    g.flames.push({ x: bomb.x, y: bomb.y, until: s.time + BA.flameMs, group, owner: bomb.owner, center: true });
    for (const [dx, dy] of DIR4) for (let k = 1; k <= bomb.range; k++) {
      const x = bomb.x + dx * k, y = bomb.y + dy * k, cell = at(g, x, y);
      if (cell === "1" || cell === "3") break;
      g.flames.push({ x, y, until: s.time + BA.flameMs, group, owner: bomb.owner, center: false });
      if (cell === "2") { broken.push([x, y]); break; }
      // Chain reaction: the other bomb detonates now as part of the same explosion.
      const other = g.bombs.find(o => o.x === x && o.y === y && !queue.includes(o));
      if (other) { other.group = group; queue.push(other); break; }
    }
  }
  for (const [x, y] of broken) if (at(g, x, y) === "2") {
    setCell(g, x, y, "0");
    if (random(s) < BA.dropChance) { const kinds: BombPower[] = ["range", "bomb", "speed", "kick"]; g.items.push({ x, y, kind: kinds[Math.floor(random(s) * 4)] }); }
  }
  emit(s, "boom", "", []);
}

function moveBomber(s: MatchState<BombGame>, p: MatchPlayer, b: Bomber, dt: number) {
  const g = s.game, input = inputOfPlayer(s, p), moveMs = Math.max(BA.minMoveMs, BA.moveMs - b.speed * BA.speedStep);
  const wanted: number = Math.hypot(input.x, input.y) < .35 ? -1 : Math.abs(input.x) > Math.abs(input.y) ? (input.x > 0 ? 1 : 3) : (input.y > 0 ? 2 : 0);
  // Bombs and other players block the way (you can be boxed in); a fresh own bomb can be left.
  const occupied = (x: number, y: number) => Object.values(g.bombers).some(o => o.id !== b.id && o.alive && ((o.cx === x && o.cy === y) || (o.tx === x && o.ty === y)));
  const free = (x: number, y: number) => at(g, x, y) === "0" && !g.bombs.some(o => o.x === x && o.y === y && !o.passFor.includes(b.id)) && !occupied(x, y);
  let budget = dt * 1000 / moveMs;
  for (let guard = 0; guard < 3 && budget > 1e-9; guard++) {
    const moving = b.tx !== b.cx || b.ty !== b.cy;
    if (moving && wanted >= 0 && wanted === (b.dir + 2) % 4) {
      // Turning back mid-step is allowed and keeps the position continuous.
      [b.cx, b.tx, b.cy, b.ty] = [b.tx, b.cx, b.ty, b.cy]; b.progress = 1 - b.progress; b.dir = wanted;
    }
    if (b.tx !== b.cx || b.ty !== b.cy) {
      const step = Math.min(budget, 1 - b.progress);
      b.progress += step; budget -= step;
      if (b.progress >= 1 - 1e-9) {
        b.cx = b.tx; b.cy = b.ty; b.progress = 0;
        const item = g.items.find(i => i.x === b.cx && i.y === b.cy);
        if (item) {
          g.items = g.items.filter(i => i !== item);
          if (item.kind === "range") b.range++; else if (item.kind === "bomb") b.maxBombs++; else if (item.kind === "speed") b.speed = Math.min(3, b.speed + 1); else b.kick = true;
          emit(s, "power", item.kind === "range" ? "Mehr Reichweite!" : item.kind === "bomb" ? "Extra-Bombe!" : item.kind === "speed" ? "Schneller!" : "Bombenkick!", [b.id]);
        }
      }
      continue;
    }
    if (wanted < 0) break;
    b.dir = wanted;
    const nx = b.cx + DIR4[wanted][0], ny = b.cy + DIR4[wanted][1];
    if (free(nx, ny)) { b.tx = nx; b.ty = ny; continue; }
    const bomb = g.bombs.find(o => o.x === nx && o.y === ny);
    if (bomb && b.kick && !bomb.slide) { bomb.slide = { dx: DIR4[wanted][0], dy: DIR4[wanted][1], next: s.time + BA.kickStepMs }; emit(s, "kick", "", [b.id]); }
    break;
  }
  for (const bomb of g.bombs) if (bomb.passFor.includes(b.id)) { const [x, y] = cellOf(b); if (x !== bomb.x || y !== bomb.y) bomb.passFor = bomb.passFor.filter(id => id !== b.id); }
}

export const bombArena: MatchModule<BombGame> = {
  id: "bombs",
  meta: {
    name: "Bomb Arena", seconds: (BA.rounds * (BA.roundMax + BA.pause) + BA.suddenMax + BA.pause) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Lauf mit dem Stick durch die Bombenfabrik und lege mit dem Knopf Bomben. Nach 2 Sekunden explodieren sie kreuzförmig, sprengen Kisten und zünden andere Bomben. Bomben und andere Spieler versperren den Weg – wer nicht aufpasst, wird eingesperrt. Du hast 2 Leben pro Durchgang. Ein gegnerischer K.o. bringt +2, der Durchgangssieg +3. Ab Sekunde 25 schließt sich die Arena. Zwei Durchgänge; bei Gleichstand entscheidet Sudden Death.",
    controls: "Stick: laufen · Knopf: Bombe legen.",
    look: { icon: "✹", action: "Sprenge dir den Weg frei", hint: "Stick laufen · Knopf Bombe", goal: "K.o. +2 · Durchgangssieg +3" }
  },
  create(s) {
    s.game = { round: 0, phase: "play", sudden: false, roundStart: 0, cells: "", bombers: {}, bombs: [], flames: [], items: [], nextId: 1, shrunk: 0,
      points: Object.fromEntries(s.players.map(p => [p.id, 0])), history: [], roundPoints: {} };
    startRound(s, false, s.players.map(p => p.id));
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    if (g.phase === "pause") {
      if (s.time - g.roundStart < BA.pause) return;
      const active = s.players.filter(p => !p.gone).map(p => p.id);
      if (g.round < BA.rounds && active.length > 1) { startRound(s, false, active); return; }
      const best = Math.max(...active.map(id => g.points[id])), tied = active.filter(id => g.points[id] === best);
      if (!g.sudden && tied.length > 1) { startRound(s, true, tied); return; }
      g.phase = "done"; s.done = true; return;
    }
    if (g.phase !== "play") return;
    const roundTime = s.time - g.roundStart;
    for (const p of s.players) { const b = g.bombers[p.id]; if (b?.alive && !p.gone) moveBomber(s, p, b, dt); }
    // Kicked bombs slide one cell at a time until something blocks them.
    for (const bomb of g.bombs) if (bomb.slide && s.time >= bomb.slide.next) {
      const nx = bomb.x + bomb.slide.dx, ny = bomb.y + bomb.slide.dy;
      const blocked = at(g, nx, ny) !== "0" || g.bombs.some(o => o.x === nx && o.y === ny) || g.items.some(i => i.x === nx && i.y === ny) || Object.values(g.bombers).some(b => b.alive && cellOf(b)[0] === nx && cellOf(b)[1] === ny);
      if (blocked) bomb.slide = undefined; else { bomb.x = nx; bomb.y = ny; bomb.slide.next = s.time + BA.kickStepMs; }
    }
    for (let guard = 0; guard < 20; guard++) { const due = g.bombs.find(b => b.at <= s.time); if (!due) break; explode(s, due); }
    g.flames = g.flames.filter(f => f.until > s.time);
    // One damage per explosion group and player, checked after all detonations of this step.
    for (const b of Object.values(g.bombers)) {
      if (!b.alive || s.time < b.invulnUntil) continue;
      const [x, y] = cellOf(b), flame = g.flames.find(f => f.x === x && f.y === y && !b.hitGroups.includes(f.group));
      if (flame) { b.hitGroups.push(flame.group); hit(s, b, flame.owner); }
    }
    const closeAfter = g.sudden ? BA.suddenShrink : BA.shrinkAfter;
    const target = roundTime < closeAfter ? 0 : Math.min(SPIRAL.length - 9, Math.floor((roundTime - closeAfter) / BA.shrinkEvery) + 1);
    while (g.shrunk < target) {
      const [x, y] = SPIRAL[g.shrunk++];
      setCell(g, x, y, "3");
      g.bombs = g.bombs.filter(b => b.x !== x || b.y !== y); g.items = g.items.filter(i => i.x !== x || i.y !== y);
      for (const b of Object.values(g.bombers)) if (b.alive && cellOf(b)[0] === x && cellOf(b)[1] === y) { b.invulnUntil = 0; hit(s, b, undefined); }
      if (g.shrunk === 1) emit(s, "shrink", "Die Arena schließt sich!", []);
    }
    const alive = Object.values(g.bombers).filter(b => b.alive);
    if (alive.length <= 1 || roundTime >= (g.sudden ? BA.suddenMax : BA.roundMax)) endRound(s);
  },
  press(s, p, kind) {
    const g = s.game, b = g.bombers[p.id];
    if (kind !== "a" || g.phase !== "play" || !b?.alive) return;
    const [x, y] = cellOf(b);
    if (g.bombs.some(o => o.x === x && o.y === y) || g.bombs.filter(o => o.owner === p.id).length >= b.maxBombs) return;
    const here = Object.values(g.bombers).filter(o => o.alive && cellOf(o)[0] === x && cellOf(o)[1] === y).map(o => o.id);
    g.bombs.push({ id: g.nextId++, x, y, owner: p.id, at: s.time + BA.fuse, range: b.range, passFor: here });
    emit(s, "bomb", "", [p.id]);
  },
  remove(s, id) {
    const b = s.game.bombers[id];
    if (b?.alive) { b.alive = false; b.knockedAt = s.time; }
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id], detail: g.suddenWinner === p.id ? "Sudden Death gewonnen" : `${g.history.filter(h => h.winners.includes(p.id) && !h.sudden).length} Durchgangssiege`,
      keys: [presence(p), g.points[p.id], g.suddenWinner === p.id ? 1 : 0] })));
  },
  finish(s) { if (s.game.phase === "play") endRound(s); s.game.phase = "done"; },
  bot(s, id) {
    const g = s.game, me = g.bombers[id];
    if (g.phase !== "play" || !me?.alive) return {};
    const [x, y] = cellOf(me);
    // Danger: active flames and every cell a bomb will reach (fixed walls and crates stop flames).
    const danger = new Set<number>();
    const mark = (bx: number, by: number, range: number) => { danger.add(by * BA.cols + bx); for (const [dx, dy] of DIR4) for (let k = 1; k <= range; k++) { const cx = bx + dx * k, cy = by + dy * k, c = at(g, cx, cy); if (c !== "0") break; danger.add(cy * BA.cols + cx); } };
    for (const f of g.flames) danger.add(f.y * BA.cols + f.x);
    for (const bomb of g.bombs) mark(bomb.x, bomb.y, bomb.range);
    const walk = (fx: number, fy: number, goal: (cx: number, cy: number) => boolean, avoid: Set<number>) => {
      const from = new Map<number, number>([[fy * BA.cols + fx, -1]]), queue = [[fx, fy]];
      while (queue.length) {
        const [cx, cy] = queue.shift()!;
        if (goal(cx, cy)) {
          // Walk back to the first step after the start cell.
          const start = fy * BA.cols + fx;
          let k = cy * BA.cols + cx;
          if (k === start) return -1;
          while (from.get(k) !== start) k = from.get(k)!;
          return DIR4.findIndex(([dx, dy]) => fx + dx === k % BA.cols && fy + dy === Math.floor(k / BA.cols));
        }
        for (const [dx, dy] of DIR4) { const nx = cx + dx, ny = cy + dy, k = ny * BA.cols + nx; if (from.has(k) || at(g, nx, ny) !== "0" || g.bombs.some(o => o.x === nx && o.y === ny) || g.flames.some(f => f.x === nx && f.y === ny)) continue; from.set(k, cy * BA.cols + cx); queue.push([nx, ny]); }
      }
      return -2;
    };
    const go = (d: number) => d >= 0 ? { x: DIR4[d][0], y: DIR4[d][1] } : {};
    if (danger.has(y * BA.cols + x)) return go(walk(x, y, (cx, cy) => !danger.has(cy * BA.cols + cx), danger));
    if (me.tx !== me.cx || me.ty !== me.cy) return go(me.dir);
    // Place a bomb next to a crate or an opponent if an escape cell stays reachable.
    const enemyNear = Object.values(g.bombers).some(o => o.alive && o.id !== id && Math.abs(cellOf(o)[0] - x) + Math.abs(cellOf(o)[1] - y) <= 2);
    const crateNear = DIR4.some(([dx, dy]) => at(g, x + dx, y + dy) === "2");
    const mine = g.bombs.filter(o => o.owner === id).length;
    if ((enemyNear || crateNear) && mine < me.maxBombs && hash(`${id}:${Math.floor(s.time / 600)}`) % 3 !== 0) {
      const future = new Set(danger); mark(x, y, me.range);
      const escape = new Set(future); for (const [dx, dy] of DIR4) for (let k = 0; k <= me.range; k++) { const cx = x + dx * k, cy = y + dy * k; if (at(g, cx, cy) !== "0") break; escape.add(cy * BA.cols + cx); }
      if (walk(x, y, (cx, cy) => !escape.has(cy * BA.cols + cx), escape) >= 0) return { pressA: true };
    }
    const target = (cx: number, cy: number) => g.items.some(i => i.x === cx && i.y === cy) || DIR4.some(([dx, dy]) => at(g, cx + dx, cy + dy) === "2") || Object.values(g.bombers).some(o => o.alive && o.id !== id && cellOf(o)[0] === cx && cellOf(o)[1] === cy);
    const d = walk(x, y, (cx, cy) => (cx !== x || cy !== y) && target(cx, cy) && !danger.has(cy * BA.cols + cx), danger);
    return d >= 0 && !danger.has((y + DIR4[d][1]) * BA.cols + x + DIR4[d][0]) ? go(d) : {};
  }
};
