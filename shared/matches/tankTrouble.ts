import { clamp, dist, pointInRect, pushCircleOut, segmentHitsRect, separateCircles, type Rect } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Tank Trouble – Panzerchaos. Top-down maze with thin walls between cells.
 * Fixed walls reflect bullets (at most twice), destructible walls absorb the
 * bullet and lose one of two hit points. Walls are encoded as digit strings
 * per cell edge to keep snapshots small.
 */
export const TT = {
  cols: 7, rows: 11, cell: 1.6, wall: .09,
  tank: .42, speed: 3, hp: 3,
  bullet: .09, bulletSpeed: 6.5, bulletLife: 5000, bounces: 2, cooldown: 450, maxBullets: 2, ownerGrace: 220,
  respawn: 2000, spawnShield: 1500,
  powerEvery: 9000, maxPowers: 2, powerMs: 8000, shieldMs: 6000, rapidCooldown: 180, rapidBullets: 4, tripleSpread: .22,
  killsToWin: 7, regular: 90000, overtime: 30000, substeps: 4
} as const;
export type TankPower = "rapid" | "triple" | "shield";
export interface Tank { id: string; x: number; y: number; angle: number; aim: number; hp: number; alive: boolean; respawnAt: number; shieldUntil: number; lastShot: number; power?: { kind: TankPower; until: number } }
export interface Bullet { id: number; owner: string; x: number; y: number; vx: number; vy: number; bounces: number; born: number; extra: boolean }
export interface TankGame {
  /** Edge states: 0 open, 1 fixed, 2 destructible, 3 cracked. */
  h: string; v: string;
  tanks: Record<string, Tank>;
  bullets: Bullet[];
  nextBullet: number;
  powers: { id: number; kind: TankPower; x: number; y: number }[];
  nextPower: number;
  kills: Record<string, number>;
  deaths: Record<string, number>;
  overtime?: string[];
  winner?: string;
}
const W = TT.cols * TT.cell, H = TT.rows * TT.cell;
export const TANK_FIELD = { width: W, height: H };
const hIndex = (c: number, r: number) => c + r * TT.cols, vIndex = (c: number, r: number) => c + r * (TT.cols + 1);

/** Rectangles of all closed edges with their kind and position in the strings. */
export function wallRects(g: Pick<TankGame, "h" | "v">) {
  const out: (Rect & { kind: number; axis: "h" | "v"; index: number })[] = [];
  for (let r = 0; r <= TT.rows; r++) for (let c = 0; c < TT.cols; c++) {
    const kind = Number(g.h[hIndex(c, r)]);
    if (kind) out.push({ x0: c * TT.cell - TT.wall, x1: (c + 1) * TT.cell + TT.wall, y0: r * TT.cell - TT.wall, y1: r * TT.cell + TT.wall, kind, axis: "h", index: hIndex(c, r) });
  }
  for (let r = 0; r < TT.rows; r++) for (let c = 0; c <= TT.cols; c++) {
    const kind = Number(g.v[vIndex(c, r)]);
    if (kind) out.push({ x0: c * TT.cell - TT.wall, x1: c * TT.cell + TT.wall, y0: r * TT.cell - TT.wall, y1: (r + 1) * TT.cell + TT.wall, kind, axis: "v", index: vIndex(c, r) });
  }
  return out;
}

function generateMaze(s: MatchState) {
  const h = Array<number>((TT.rows + 1) * TT.cols).fill(1), v = Array<number>(TT.rows * (TT.cols + 1)).fill(1);
  // Spanning tree by randomized depth-first search, then extra openings for loops.
  const seen = new Set<number>(), stack = [[0, 0]];
  seen.add(0);
  while (stack.length) {
    const [c, r] = stack.at(-1)!;
    const options = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dc, dr]) => [c + dc, r + dr, dc, dr] as const)
      .filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < TT.cols && nr < TT.rows && !seen.has(nc + nr * TT.cols));
    if (!options.length) { stack.pop(); continue; }
    const [nc, nr, dc, dr] = options[Math.floor(random(s) * options.length)];
    if (dc) v[vIndex(Math.max(c, nc), r)] = 0; else h[hIndex(c, Math.max(r, nr))] = 0;
    seen.add(nc + nr * TT.cols); stack.push([nc, nr]);
  }
  const inner = (axis: "h" | "v", i: number) => axis === "h" ? Math.floor(i / TT.cols) > 0 && Math.floor(i / TT.cols) < TT.rows : i % (TT.cols + 1) > 0 && i % (TT.cols + 1) < TT.cols;
  for (const [axis, list] of [["h", h], ["v", v]] as const) list.forEach((kind, i) => {
    if (!kind || !inner(axis, i)) return;
    const roll = random(s);
    if (roll < .38) list[i] = 0; else if (roll < .62) list[i] = 2;
  });
  return { h: h.join(""), v: v.join("") };
}

const SPAWNS = [[0, 0], [6, 10], [6, 0], [0, 10], [0, 5], [6, 5]].map(([c, r]) => ({ x: (c + .5) * TT.cell, y: (r + .5) * TT.cell }));

function spawn(s: MatchState<TankGame>, tank: Tank) {
  const enemies = Object.values(s.game.tanks).filter(t => t.id !== tank.id && t.alive);
  // Farthest spawn from all living opponents; ties keep the first in the fixed list.
  let best = SPAWNS[0], score = -1;
  for (const point of SPAWNS) {
    const nearest = enemies.length ? Math.min(...enemies.map(e => dist(e.x, e.y, point.x, point.y))) : 99;
    if (nearest > score + 1e-9) { best = point; score = nearest; }
  }
  Object.assign(tank, { x: best.x, y: best.y, hp: TT.hp, alive: true, shieldUntil: s.time + TT.spawnShield });
}

function destroy(s: MatchState<TankGame>, tank: Tank, by: string) {
  const g = s.game;
  tank.alive = false; tank.hp = 0; tank.respawnAt = s.time + TT.respawn; tank.power = undefined;
  g.deaths[tank.id]++;
  if (by !== tank.id) {
    g.kills[by]++;
    emit(s, "dead", "Abschuss!", [tank.id, by]);
    if (g.overtime?.includes(by) && !g.winner) { g.winner = by; s.done = true; }
    else if (g.kills[by] >= TT.killsToWin && !g.winner) { g.winner = by; s.done = true; }
  } else emit(s, "dead", "Eigentreffer!", [tank.id]);
}

function fire(s: MatchState<TankGame>, tank: Tank) {
  const g = s.game, power = tank.power && tank.power.until > s.time ? tank.power.kind : undefined;
  const cooldown = power === "rapid" ? TT.rapidCooldown : TT.cooldown, limit = power === "rapid" ? TT.rapidBullets : TT.maxBullets;
  const own = g.bullets.filter(b => b.owner === tank.id && !b.extra).length;
  if (!tank.alive || s.time - tank.lastShot < cooldown || own >= limit) return;
  tank.lastShot = s.time;
  const angles = power === "triple" ? [-TT.tripleSpread, 0, TT.tripleSpread] : [0];
  for (const [i, spread] of angles.entries()) {
    const a = tank.aim + spread, muzzle = TT.tank + TT.bullet + .02;
    g.bullets.push({ id: g.nextBullet++, owner: tank.id, x: tank.x + Math.cos(a) * muzzle, y: tank.y + Math.sin(a) * muzzle, vx: Math.cos(a) * TT.bulletSpeed, vy: Math.sin(a) * TT.bulletSpeed, bounces: 0, born: s.time, extra: i > 0 });
  }
  emit(s, "shot", "", [tank.id]);
}

function moveBullets(s: MatchState<TankGame>, dt: number) {
  const g = s.game;
  let walls = wallRects(g);
  for (const bullet of [...g.bullets]) {
    const px = bullet.x, py = bullet.y;
    bullet.x += bullet.vx * dt; bullet.y += bullet.vy * dt;
    const wall = walls.find(w => pointInRect(bullet.x, bullet.y, w, TT.bullet));
    if (wall) {
      if (wall.kind >= 2) {
        // Destructible walls absorb the shot and crack, then open a new path.
        const list = (wall.axis === "h" ? g.h : g.v).split("");
        list[wall.index] = wall.kind === 2 ? "3" : "0";
        if (wall.axis === "h") g.h = list.join(""); else g.v = list.join("");
        walls = wallRects(g);
        g.bullets = g.bullets.filter(b => b !== bullet);
        emit(s, wall.kind === 2 ? "crack" : "break", "", []);
        continue;
      }
      if (++bullet.bounces > TT.bounces) { g.bullets = g.bullets.filter(b => b !== bullet); continue; }
      const outsideX = px < wall.x0 - TT.bullet || px > wall.x1 + TT.bullet, outsideY = py < wall.y0 - TT.bullet || py > wall.y1 + TT.bullet;
      if (outsideX || !outsideY) bullet.vx = -bullet.vx;
      if (outsideY || !outsideX) bullet.vy = -bullet.vy;
      bullet.x = px; bullet.y = py;
      emit(s, "bounce", "", []);
    }
    if (s.time - bullet.born > TT.bulletLife) g.bullets = g.bullets.filter(b => b !== bullet);
  }
  // Hits after all bullets moved: simultaneous hits in one sub-step all count.
  const hits: [Bullet, Tank][] = [];
  for (const bullet of g.bullets) for (const tank of Object.values(g.tanks)) {
    if (!tank.alive || dist(bullet.x, bullet.y, tank.x, tank.y) > TT.tank + TT.bullet) continue;
    if (bullet.owner === tank.id && s.time - bullet.born < TT.ownerGrace) continue;
    if (!hits.some(([b]) => b === bullet)) hits.push([bullet, tank]);
  }
  for (const [bullet, tank] of hits) {
    g.bullets = g.bullets.filter(b => b !== bullet);
    if (!tank.alive) continue;
    if (s.time < tank.shieldUntil || tank.power?.kind === "shield" && tank.power.until > s.time) { emit(s, "block", "Schild hält!", [tank.id]); continue; }
    tank.hp--;
    emit(s, "hit", bullet.owner === tank.id ? "Eigener Abpraller!" : "Treffer!", [tank.id, bullet.owner]);
    if (tank.hp <= 0) destroy(s, tank, bullet.owner);
  }
}

export const tankTrouble: MatchModule<TankGame> = {
  id: "tanks",
  meta: {
    name: "Tank Trouble", seconds: (TT.regular + TT.overtime) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 10,
    instruction: "Fahre mit dem Stick links. Ziehe rechts zum Zielen und lass los, um zu schießen; kurz tippen schießt geradeaus. Kugeln prallen zweimal von festen Mauern ab, Ziegelmauern gehen nach zwei Treffern kaputt. Jeder Panzer hat 3 Treffer. Wer zuerst 7 Abschüsse hat oder nach 90 Sekunden die meisten, gewinnt. Eigentreffer zählen nicht als Abschuss.",
    controls: "Links fahren · rechts ziehen, loslassen zum Schießen.",
    look: { icon: "⛭", action: "Trickschüsse im Labyrinth", hint: "Stick fahren · rechts zielen und loslassen", goal: "7 Abschüsse oder die meisten nach 90 s" }
  },
  create(s) {
    const maze = generateMaze(s);
    s.game = { ...maze, tanks: {}, bullets: [], nextBullet: 1, powers: [], nextPower: TT.powerEvery,
      kills: Object.fromEntries(s.players.map(p => [p.id, 0])), deaths: Object.fromEntries(s.players.map(p => [p.id, 0])) };
    s.players.forEach((p, i) => {
      const point = SPAWNS[i % SPAWNS.length], aim = Math.atan2(H / 2 - point.y, W / 2 - point.x);
      s.game.tanks[p.id] = { id: p.id, x: point.x, y: point.y, angle: aim, aim, hp: TT.hp, alive: true, respawnAt: 0, shieldUntil: TT.spawnShield, lastShot: -9999 };
    });
    return s.game;
  },
  step(s, dt) {
    const g = s.game, walls = wallRects(g);
    for (const p of s.players) {
      const tank = g.tanks[p.id];
      if (!tank.alive) { if (!p.gone && s.time >= tank.respawnAt) spawn(s, tank); continue; }
      if (tank.power && tank.power.until <= s.time) tank.power = undefined;
      const input = inputOfPlayer(s, p);
      if (Math.hypot(input.ax, input.ay) > .25) tank.aim = Math.atan2(input.ay, input.ax);
      const speed = Math.hypot(input.x, input.y);
      if (speed > .08) {
        tank.angle = Math.atan2(input.y, input.x);
        tank.x += input.x * TT.speed * dt; tank.y += input.y * TT.speed * dt;
      }
      for (let i = 0; i < 2; i++) for (const wall of walls) pushCircleOut(tank, TT.tank, wall);
      tank.x = clamp(tank.x, TT.tank, W - TT.tank); tank.y = clamp(tank.y, TT.tank, H - TT.tank);
    }
    const alive = s.players.map(p => g.tanks[p.id]).filter(t => t.alive);
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) separateCircles(alive[i], alive[j], TT.tank, TT.tank, i + j);
    for (let i = 0; i < TT.substeps && !s.done; i++) moveBullets(s, dt / TT.substeps);
    for (const tank of alive) {
      const power = g.powers.find(pw => tank.alive && dist(pw.x, pw.y, tank.x, tank.y) < TT.tank + .35);
      if (power) { tank.power = { kind: power.kind, until: s.time + (power.kind === "shield" ? TT.shieldMs : TT.powerMs) }; g.powers = g.powers.filter(pw => pw !== power); emit(s, "power", power.kind === "rapid" ? "Schnellschuss!" : power.kind === "triple" ? "Dreifachschuss!" : "Schutzschild!", [tank.id]); }
    }
    if (s.time >= g.nextPower) {
      g.nextPower = s.time + TT.powerEvery;
      if (g.powers.length < TT.maxPowers) {
        const kinds: TankPower[] = ["rapid", "triple", "shield"];
        const c = Math.floor(random(s) * TT.cols), r = 2 + Math.floor(random(s) * (TT.rows - 4));
        g.powers.push({ id: g.nextBullet++, kind: kinds[Math.floor(random(s) * 3)], x: (c + .5) * TT.cell, y: (r + .5) * TT.cell });
      }
    }
    if (!s.done && !g.overtime && s.time >= TT.regular) {
      const active = s.players.filter(p => !p.gone), best = Math.max(...active.map(p => g.kills[p.id]));
      const top = active.filter(p => g.kills[p.id] === best), fewest = Math.min(...top.map(p => g.deaths[p.id]));
      const leaders = top.filter(p => g.deaths[p.id] === fewest);
      if (leaders.length === 1) { g.winner = leaders[0].id; s.done = true; }
      else { g.overtime = leaders.map(p => p.id); emit(s, "overtime", "Stechen! Der nächste Abschuss entscheidet.", g.overtime); }
    }
  },
  press(s, p: MatchPlayer, kind) {
    if (kind !== "a") return;
    const tank = s.game.tanks[p.id];
    if (Math.hypot(p.input.ax, p.input.ay) > .25) tank.aim = Math.atan2(p.input.ay, p.input.ax);
    fire(s, tank);
  },
  remove(s, id) { const tank = s.game.tanks[id]; tank.alive = false; s.game.bullets = s.game.bullets.filter(b => b.owner !== id); },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.kills[p.id], detail: `${g.kills[p.id]} Abschüsse · ${g.deaths[p.id]}× zerstört`,
      keys: [presence(p), g.winner === p.id ? 1 : 0, g.kills[p.id], -g.deaths[p.id]] })));
  },
  bot(s, id) {
    const g = s.game, me = g.tanks[id];
    if (!me?.alive) return {};
    const walls = wallRects(g), enemies = Object.values(g.tanks).filter(t => t.alive && t.id !== id);
    if (!enemies.length) return {};
    const target = enemies.sort((a, b) => dist(a.x, a.y, me.x, me.y) - dist(b.x, b.y, me.x, me.y))[0];
    const clear = !walls.some(w => segmentHitsRect(me.x, me.y, target.x, target.y, w, TT.bullet));
    // Path through the maze by breadth-first search over open cell edges.
    const cell = (x: number, y: number) => [clamp(Math.floor(x / TT.cell), 0, TT.cols - 1), clamp(Math.floor(y / TT.cell), 0, TT.rows - 1)] as const;
    const [sc, sr] = cell(me.x, me.y), [tc, tr] = cell(target.x, target.y), from = new Map<number, number>([[sc + sr * TT.cols, -1]]), queue = [[sc, sr]];
    while (queue.length) {
      const [c, r] = queue.shift()!;
      if (c === tc && r === tr) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, k = nc + nr * TT.cols;
        if (nc < 0 || nr < 0 || nc >= TT.cols || nr >= TT.rows || from.has(k)) continue;
        const edge = dc ? g.v[vIndex(Math.max(c, nc), r)] : g.h[hIndex(c, Math.max(r, nr))];
        if (edge !== "0") continue;
        from.set(k, c + r * TT.cols); queue.push([nc, nr]);
      }
    }
    let step = tc + tr * TT.cols;
    while (from.has(step) && from.get(step)! !== sc + sr * TT.cols && from.get(step)! >= 0) step = from.get(step)!;
    const wx = from.has(step) ? (step % TT.cols + .5) * TT.cell : target.x, wy = from.has(step) ? (Math.floor(step / TT.cols) + .5) * TT.cell : target.y;
    const dx = wx - me.x, dy = wy - me.y, d = Math.hypot(dx, dy) || 1;
    const jitter = ((hash(`${id}:${Math.floor(s.time / 700)}`) % 100) / 100 - .5) * .3;
    const aim = Math.atan2(target.y - me.y, target.x - me.x) + jitter;
    const ready = s.time - me.lastShot >= TT.cooldown;
    return { x: clear && dist(me.x, me.y, target.x, target.y) < 4 ? 0 : dx / d, y: clear && dist(me.x, me.y, target.x, target.y) < 4 ? 0 : dy / d, ax: Math.cos(aim), ay: Math.sin(aim), pressA: clear && ready };
  }
};
