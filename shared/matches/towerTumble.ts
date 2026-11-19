import { bodiesOverlap, stepBodies, type Fixture, type RigidBody, type WarmStart } from "./physics2d";
import { emit, hash, inputOfPlayer, presence, rank, shuffled, type MatchModule, type MatchState } from "./types";

/**
 * Tower Tumble – a tower race. Everyone builds at the same time on an own
 * narrow pedestal, with the same sequence of four-cell pieces. The falling
 * piece is steered (half-cell steps, quarter turns, fast drop); as soon as
 * it touches the tower it becomes a rigid body in a real physics simulation
 * (`physics2d.ts`), so pieces tip, slide and topple. The first tower that
 * stays above the finish line for two seconds wins; at the time limit the
 * height decides. World units: one cell = 1, pedestal top at y = 0.
 */
export const TW = {
  baseHalf: 2.5, baseDepth: 1.2, laneHalf: 6, goal: 16, holdMs: 2000,
  /** Survival: out after this many lost stones; falling gets faster over time (× `speedUp` at `survivalMs`). */
  lives: 3, survivalMs: 180000, speedUp: 1.8,
  fall: 2.2, fastFall: 12, move: 16, spawnGap: 7, spawnDelay: 300, lostY: -6,
  gravity: 18, substeps: 3, iterations: 12, friction: .9, bias: .2, slop: .01,
  sleepSpeed: .08, sleepMs: 400, settleSpeed: .5, regular: 120000
} as const;

const CELL = .5;
export type PieceKind = "I" | "O" | "T" | "L" | "J" | "S" | "Z";
export const PIECE_KINDS: readonly PieceKind[] = ["I", "O", "T", "L", "J", "S", "Z"];
const GRID: Record<PieceKind, [number, number][]> = {
  I: [[0, 0], [1, 0], [2, 0], [3, 0]], O: [[0, 0], [1, 0], [0, 1], [1, 1]], T: [[0, 0], [1, 0], [2, 0], [1, 1]],
  L: [[0, 0], [1, 0], [2, 0], [2, 1]], J: [[0, 0], [1, 0], [2, 0], [0, 1]], S: [[0, 0], [1, 0], [1, 1], [2, 1]], Z: [[1, 0], [2, 0], [0, 1], [1, 1]]
};
/**
 * Collision boxes per piece in grid cells (first cell, last cell): straight
 * runs of cells become one box, so an O is a single 2×2 box and an L a bar
 * plus one cell. Fewer boxes mean far fewer contacts for the solver.
 */
const RUNS: Record<PieceKind, [[number, number], [number, number]][]> = {
  I: [[[0, 0], [3, 0]]], O: [[[0, 0], [1, 1]]], T: [[[0, 0], [2, 0]], [[1, 1], [1, 1]]], L: [[[0, 0], [2, 0]], [[2, 1], [2, 1]]],
  J: [[[0, 0], [2, 0]], [[0, 1], [0, 1]]], S: [[[0, 0], [1, 0]], [[1, 1], [2, 1]]], Z: [[[1, 0], [2, 0]], [[0, 1], [1, 1]]]
};
const turn = (x: number, y: number, r: number): [number, number] => { for (let i = 0; i < r; i++) [x, y] = [y, -x]; return [x, y]; };
const shapes = new Map<string, { cells: [number, number][]; fixtures: Fixture[] }>();
/** Cells and merged collision boxes of a piece after `r` quarter turns, centred on the centre of mass (cached). */
function shape(kind: PieceKind, r: number) {
  const q = ((r % 4) + 4) % 4, key = kind + q;
  let found = shapes.get(key);
  if (found) return found;
  const raw = GRID[kind].map(([x, y]) => turn(x, y, q));
  const mx = raw.reduce((n, c) => n + c[0], 0) / raw.length, my = raw.reduce((n, c) => n + c[1], 0) / raw.length;
  const cells = raw.map(([x, y]) => [x - mx, y - my] as [number, number]);
  const fixtures = RUNS[kind].map(([from, to]) => {
    const [x0, y0] = turn(from[0], from[1], q), [x1, y1] = turn(to[0], to[1], q);
    return { x: (x0 + x1) / 2 - mx, y: (y0 + y1) / 2 - my, hw: Math.abs(x1 - x0) / 2 + CELL, hh: Math.abs(y1 - y0) / 2 + CELL };
  });
  found = { cells, fixtures }; shapes.set(key, found);
  return found;
}
/** Cell centres of a piece relative to its centre of mass, after `r` clockwise quarter turns. */
export function pieceCells(kind: PieceKind, r: number): [number, number][] { return shape(kind, r).cells; }
/** Merged collision boxes of a piece (shared, do not modify). */
export function pieceFixtures(kind: PieceKind, r: number): Fixture[] { return shape(kind, r).fixtures; }
/** Snaps a centre-of-mass x so that cell edges sit on the half-cell grid. */
export function snapX(kind: PieceKind, r: number, x: number) {
  const off = pieceCells(kind, r)[0][0] - .5;
  return Math.round((x + off) * 2) / 2 - off;
}

export interface TowerBody { id: number; k: PieceKind; r: number; x: number; y: number; a: number; vx: number; vy: number; w: number }
export interface FallingPiece { n: number; k: PieceKind; r: number; x: number; y: number; tx: number }
export interface Tower {
  bodies: TowerBody[];
  warm: WarmStart;
  piece?: FallingPiece;
  spawnAt: number;
  /** Index of the next piece in the shared sequence. */
  next: number;
  nextId: number;
  asleep: boolean;
  calm: number;
  height: number;
  best: number;
  placed: number;
  lost: number;
  holdSince?: number;
  finishedAt?: number;
  /** Survival: time of the third lost stone (out). */
  outAt?: number;
}
export interface TowerGame { sequence: PieceKind[]; towers: Record<string, Tower>; winner?: string; decided: boolean; survival?: boolean }
/** Packed body for the network view: [id, kind index, rotation, x, y, angle]. */
export type PackedBody = [number, number, number, number, number, number];
export interface TowerView extends Omit<Tower, "bodies" | "warm"> { packed: PackedBody[] }

const PEDESTAL: RigidBody = { id: -1, x: 0, y: -TW.baseDepth / 2, a: 0, vx: 0, vy: 0, w: 0, invMass: 0, invI: 0, fixtures: [{ x: 0, y: 0, hw: TW.baseHalf, hh: TW.baseDepth / 2 }] };

export function rigid(b: Pick<TowerBody, "id" | "k" | "r" | "x" | "y" | "a"> & Partial<TowerBody>, dynamic = true): RigidBody {
  const { cells, fixtures } = shape(b.k, b.r);
  // Unit squares: mass 1 each; inertia 1/6 per cell plus the parallel-axis term.
  const inertia = cells.reduce((n, [x, y]) => n + 1 / 6 + x * x + y * y, 0);
  return { id: b.id, x: b.x, y: b.y, a: b.a, vx: b.vx ?? 0, vy: b.vy ?? 0, w: b.w ?? 0, invMass: dynamic ? 1 / cells.length : 0, invI: dynamic ? 1 / inertia : 0, fixtures };
}
const pieceBody = (p: FallingPiece, y = p.y, x = p.x, r = p.r) => rigid({ id: -2, k: p.k, r, x, y, a: 0 }, false);
/** Rough reach of a piece from its centre of mass (I piece: 2 cells and a corner). */
const REACH = 2.25;
const blocked = (t: Tower, probe: RigidBody) => (probe.y < REACH && bodiesOverlap(probe, PEDESTAL, .002))
  || t.bodies.some(b => Math.abs(b.x - probe.x) < 2 * REACH && Math.abs(b.y - probe.y) < 2 * REACH && bodiesOverlap(probe, rigid(b, false), .002));
/** Highest point of any cell corner of a body. */
export function bodyTop(b: Pick<TowerBody, "k" | "r" | "x" | "y" | "a">) {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  let top = -Infinity;
  for (const [x, y] of pieceCells(b.k, b.r)) for (const [dx, dy] of [[-CELL, -CELL], [CELL, -CELL], [CELL, CELL], [-CELL, CELL]]) top = Math.max(top, b.y + s * (x + dx) + c * (y + dy));
  return top;
}

function kindAt(g: TowerGame, s: MatchState<TowerGame>, index: number) {
  // A shuffled bag of all seven kinds keeps the shared sequence fair.
  while (g.sequence.length <= index) g.sequence.push(...shuffled(s, PIECE_KINDS));
  return g.sequence[index];
}

function spawn(s: MatchState<TowerGame>, t: Tower) {
  const g = s.game, k = kindAt(g, s, t.next), top = Math.max(0, ...t.bodies.map(bodyTop));
  t.piece = { n: t.next, k, r: 0, x: snapX(k, 0, 0), y: top + TW.spawnGap, tx: snapX(k, 0, 0) };
  t.next++;
}

/** Normal fall speed; in Survival it grows steadily so mistakes become likely. */
const fallSpeed = (s: MatchState<TowerGame>) => s.game.survival ? TW.fall * (1 + (TW.speedUp - 1) * Math.min(1, s.time / TW.survivalMs)) : TW.fall;

/** Moves the falling piece for one sub-step; on contact it joins the simulation. */
function steer(s: MatchState<TowerGame>, id: string, t: Tower, fast: boolean, h: number) {
  const p = t.piece!;
  if (p.tx !== p.x) {
    const nx = p.x + Math.max(-TW.move * h, Math.min(TW.move * h, p.tx - p.x));
    if (!blocked(t, pieceBody(p, p.y, nx))) p.x = nx; else p.tx = p.x;
  }
  const speed = fast ? TW.fastFall : fallSpeed(s), ny = p.y - speed * h;
  if (!blocked(t, pieceBody(p, ny))) {
    p.y = ny;
    // Steered past the pedestal: the piece is lost and the next one comes.
    if (p.y < TW.lostY) { t.piece = undefined; t.lost++; t.spawnAt = s.time + TW.spawnDelay; emit(s, "lost", "Stein verloren!", [id]); }
    return;
  }
  // Find the first touching height between the old and new position.
  let free = p.y, hit = ny;
  for (let i = 0; i < 8; i++) { const mid = (free + hit) / 2; if (blocked(t, pieceBody(p, mid))) hit = mid; else free = mid; }
  t.bodies.push({ id: t.nextId++, k: p.k, r: p.r, x: p.x, y: free, a: 0, vx: 0, vy: -speed, w: 0 });
  t.piece = undefined; t.placed++; t.spawnAt = s.time + TW.spawnDelay; t.asleep = false; t.calm = 0;
}

function simulate(s: MatchState<TowerGame>, id: string, t: Tower, dt: number) {
  if (t.asleep) return;
  const bodies = t.bodies.map(b => rigid(b)), all = [PEDESTAL, ...bodies];
  for (let i = 0; i < TW.substeps; i++) t.warm = stepBodies(all, t.warm, dt / TW.substeps, TW);
  let fastest = 0;
  bodies.forEach((r, i) => { Object.assign(t.bodies[i], { x: r.x, y: r.y, a: r.a, vx: r.vx, vy: r.vy, w: r.w }); fastest = Math.max(fastest, Math.hypot(r.vx, r.vy), Math.abs(r.w)); });
  // Pieces that fell past the pedestal are gone.
  const kept = t.bodies.filter(b => b.y > TW.lostY);
  // Their warm-start entries simply expire: the next step keeps only current contacts.
  if (kept.length < t.bodies.length) {
    t.lost += t.bodies.length - kept.length; t.bodies = kept;
    emit(s, "lost", "Stein verloren!", [id]);
  }
  // A resting tower falls asleep: no more creeping, and no work for the solver.
  t.calm = fastest < TW.sleepSpeed ? t.calm + dt * 1000 : 0;
  if (t.calm >= TW.sleepMs) { t.asleep = true; for (const b of t.bodies) { b.vx = 0; b.vy = 0; b.w = 0; } }
}

function measure(s: MatchState<TowerGame>, id: string, t: Tower) {
  // Only resting pieces count towards the height; tumbling ones do not.
  const resting = t.bodies.filter(b => Math.hypot(b.vx, b.vy) < TW.settleSpeed && Math.abs(b.w) < TW.settleSpeed);
  t.height = Math.max(0, ...resting.map(bodyTop));
  t.best = Math.max(t.best, t.height);
  // Survival has no finish line.
  if (s.game.survival) return;
  if (t.height >= TW.goal) {
    if (t.holdSince === undefined) { t.holdSince = s.time; emit(s, "hold", "Über der Ziellinie – halten!", [id]); }
    else if (s.time - t.holdSince >= TW.holdMs && t.finishedAt === undefined) t.finishedAt = s.time;
  } else if (t.holdSince !== undefined) { t.holdSince = undefined; emit(s, "drop", "Wieder unter der Linie", [id]); }
}

const RACE_META: MatchModule["meta"] = {
    name: "Tower Tumble", seconds: TW.regular / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Turmrennen: Alle bauen gleichzeitig auf einem eigenen, schmalen Sockel und bekommen dieselben Steine. Mit ⇦ und ⇨ schiebst du den fallenden Stein um eine halbe Zelle (gedrückt halten: weiter), tippe ⟳ zum Drehen und halte ⇩ zum schnellen Fallen. Sobald ein Stein aufsetzt, gilt echte Physik: Steine kippen, rutschen und stürzen ab. Wer zuerst zwei Sekunden lang über der Ziellinie steht, gewinnt. Nach zwei Minuten entscheidet die Höhe.",
    controls: "⇦ ⇨ verschieben · ⟳ drehen · ⇩ halten: schnell fallen.",
    look: { icon: "▦", action: "Bau schneller als die anderen", hint: "⇦ ⇨ schieben · ⟳ drehen · ⇩ fallen", goal: "Zuerst über der Ziellinie" }
};
const SURVIVAL_META: MatchModule["meta"] = {
    name: "Tower Tumble – Survival", seconds: TW.survivalMs / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Turmbau ohne Ziellinie: Alle bauen gleichzeitig auf einem eigenen, schmalen Sockel und bekommen dieselben Steine. Mit ⇦ und ⇨ schiebst du den fallenden Stein (gedrückt halten: weiter), ⟳ dreht ihn, ⇩ gedrückt halten lässt ihn schnell fallen. Sobald ein Stein aufsetzt, gilt echte Physik. Baue immer weiter, ohne Steine zu verlieren: Fällt dein dritter Stein vom Turm, bist du raus. Die Steine fallen mit der Zeit immer schneller. Wer zuletzt noch baut, gewinnt; nach drei Minuten gewinnt der höchste Turm.",
    controls: "⇦ ⇨ verschieben · ⟳ drehen · ⇩ halten: schnell fallen · 3 verlorene Steine = raus.",
    look: { icon: "▥", action: "Bau weiter, verlier nichts", hint: "⇦ ⇨ schieben · ⟳ drehen · ⇩ fallen", goal: "Als Letzter ohne drei verlorene Steine" }
};

/**
 * Tower Tumble as a race to the finish line (`tower`) or as Survival
 * (`towersurvival`): no finish line, three lost stones and you are out,
 * the last builder wins, at the time limit the highest tower.
 */
function towerModule(survival: boolean): MatchModule<TowerGame> {
  const limit = survival ? TW.survivalMs : TW.regular;
  return {
  id: survival ? "towersurvival" : "tower",
  meta: survival ? SURVIVAL_META : RACE_META,
  create(s) {
    s.game = { sequence: [], towers: {}, decided: false, ...(survival ? { survival: true } : {}) };
    for (const p of s.players) s.game.towers[p.id] = { bodies: [], warm: [], spawnAt: 0, next: 0, nextId: 1, asleep: true, calm: 0, height: 0, best: 0, placed: 0, lost: 0 };
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    for (const p of s.players) {
      const t = g.towers[p.id];
      if (p.gone || t.outAt !== undefined) { t.piece = undefined; continue; }
      if (!t.piece && s.time >= t.spawnAt) spawn(s, t);
      const input = inputOfPlayer(s, p);
      for (let i = 0; i < TW.substeps && t.piece; i++) steer(s, p.id, t, input.ha, dt / TW.substeps);
    }
    for (const p of s.players) simulate(s, p.id, g.towers[p.id], dt);
    if (survival) {
      for (const p of s.players) {
        const t = g.towers[p.id];
        if (p.gone || t.outAt !== undefined) continue;
        measure(s, p.id, t);
        if (t.lost >= TW.lives) { t.outAt = s.time; t.piece = undefined; emit(s, "out", "Drei Steine verloren – raus!", [p.id]); }
      }
      const building = s.players.filter(p => !p.gone && g.towers[p.id].outAt === undefined);
      // The last builder wins at once; if the last ones drop out together they share the place.
      if (building.length <= 1) { g.winner = building[0]?.id; g.decided = true; s.done = true; if (building.length) emit(s, "finish", "Letzter Baumeister!", [building[0].id]); }
      else if (s.time >= limit) { g.decided = true; s.done = true; }
      return;
    }
    for (const p of s.players) if (!p.gone) measure(s, p.id, g.towers[p.id]);
    const finished = s.players.filter(p => !p.gone && g.towers[p.id].finishedAt !== undefined);
    if (finished.length) {
      g.winner = finished.length === 1 ? finished[0].id : undefined; g.decided = true; s.done = true;
      emit(s, "finish", "Ziel erreicht!", finished.map(p => p.id));
    } else if (s.time >= limit) { g.decided = true; s.done = true; }
  },
  press(s, p, kind, _at, value) {
    const t = s.game.towers[p.id], piece = t?.piece;
    if (!piece || p.gone || t.outAt !== undefined) return;
    // Arrow taps: one half cell to the left (-1) or right (+1) of the current target.
    if (kind === "n") {
      if (value !== -1 && value !== 1) return;
      piece.tx = snapX(piece.k, piece.r, Math.max(-TW.laneHalf, Math.min(TW.laneHalf, piece.tx + value * CELL)));
      return;
    }
    if (kind !== "a") return;
    // Quarter turn clockwise; if blocked, try small sideways nudges.
    const r = (piece.r + 1) % 4;
    for (const dx of [0, .5, -.5, 1, -1]) {
      const x = snapX(piece.k, r, piece.x + dx);
      if (!blocked(t, pieceBody(piece, piece.y, x, r))) { piece.r = r; piece.x = x; piece.tx = snapX(piece.k, r, piece.tx + dx); return; }
    }
  },
  remove(s, id) { const t = s.game.towers[id]; if (t) t.piece = undefined; },
  standings(s) {
    const g = s.game;
    if (survival) return rank(s.players.map(p => {
      const t = g.towers[p.id], out = t.outAt !== undefined;
      return { id: p.id, score: Math.round(t.best * 10) / 10, detail: `${out ? "raus" : g.winner === p.id ? "Letzter Baumeister" : "baut noch"} · ${t.best.toFixed(1)} m · ${t.lost}/${TW.lives} verloren`,
        // Still building beats out; later out beats earlier; then the height, then fewer lost stones.
        keys: [presence(p), out ? 0 : 1, out ? t.outAt! : 0, Math.round(t.height * 100), -t.lost] };
    }));
    return rank(s.players.map(p => {
      const t = g.towers[p.id], finished = t.finishedAt !== undefined;
      return { id: p.id, score: Math.round(t.height * 10) / 10, detail: `${finished ? "im Ziel" : `${t.height.toFixed(1)} m`} · ${t.placed} Steine · ${t.lost} verloren`,
        keys: [presence(p), finished ? 1 : 0, finished ? -t.finishedAt! : 0, Math.round(t.height * 100)] };
    }));
  },
  finish(s) { s.game.decided = true; },
  publicGame(s, viewer) {
    // Velocities and the solver's warm-start data stay with the authority; bodies travel packed.
    // Foreign towers are only thumbnails on this device, so centimetres are enough there.
    const g = s.game, coarse = (v: number) => Math.round(v * 100) / 100, towers: Record<string, TowerView> = {};
    for (const [id, t] of Object.entries(g.towers)) {
      const { bodies, warm, piece, ...rest } = t, own = id === viewer; void warm;
      towers[id] = { ...rest, ...(piece ? { piece: { ...piece } } : {}), packed: bodies.map(b => own ? [b.id, PIECE_KINDS.indexOf(b.k), b.r, b.x, b.y, b.a] : [b.id, PIECE_KINDS.indexOf(b.k), b.r, coarse(b.x), coarse(b.y), coarse(b.a)]) };
    }
    const upcoming = Math.max(...Object.values(g.towers).map(t => t.next)) + 1;
    return { sequence: g.sequence.slice(0, upcoming), towers: towers as unknown as Record<string, Tower>, decided: g.decided, ...(g.winner !== undefined ? { winner: g.winner } : {}), ...(g.survival ? { survival: true } : {}) };
  },
  bot(s, id) {
    const t = (s.game.towers as unknown as Record<string, TowerView>)[id], piece = t?.piece;
    if (!piece) return {};
    const plan = botPlan(t, piece, hash(`${id}:${piece.n}`), !!s.game.survival);
    const aligned = piece.r === plan.r && Math.abs(piece.x - plan.x) < .01;
    // One quarter turn at a time, roughly every 300 ms.
    const turn = piece.r !== plan.r && hash(`${id}:${Math.floor(s.time / 300)}`) % 2 === 0;
    // Bots wait a moment before dropping fast, so practice rounds keep a human pace.
    // In Survival a fast drop slams onto the tower: careful bots let the piece fall slowly.
    const settled = !s.game.survival && aligned && piece.y < Math.max(0, t.height) + TW.spawnGap - 1.5;
    // Like a person: one arrow tap per step towards the planned column.
    const step = Math.abs(piece.tx - plan.x) < .01 ? undefined : piece.tx < plan.x ? 1 : -1;
    return { ha: settled, pressA: turn, ...(step !== undefined ? { command: step } : {}) };
  }
};
}
export const towerTumble = towerModule(false);
export const towerSurvival = towerModule(true);

/** Column surface heights (half-cell columns) of a packed tower, for bots. */
export function surface(t: TowerView) {
  const cols = new Map<number, number>();
  for (let c = -TW.baseHalf * 2; c < TW.baseHalf * 2; c++) cols.set(c, 0);
  for (const [, ki, r, x, y, a] of t.packed) {
    const k = PIECE_KINDS[ki], co = Math.cos(a), si = Math.sin(a);
    for (const [cx, cy] of pieceCells(k, r)) {
      const wx = x + co * cx - si * cy, wy = y + si * cx + co * cy, top = wy + CELL;
      for (let c = Math.floor((wx - CELL) * 2 + .01); c < Math.ceil((wx + CELL) * 2 - .01); c++) cols.set(c, Math.max(cols.get(c) ?? -Infinity, top));
    }
  }
  return cols;
}

/** Approximate resting height (centre of mass) of a piece dropped straight down; undefined beside the tower. */
export function restingY(t: TowerView, k: PieceKind, r: number, x: number, cols = surface(t)) {
  let land = -Infinity;
  for (const [cx, cy] of pieceCells(k, r)) {
    let support = -Infinity;
    for (let c = Math.round((x + cx - CELL) * 2); c < Math.round((x + cx + CELL) * 2); c++) support = Math.max(support, cols.get(c) ?? -Infinity);
    land = Math.max(land, support - (cy - CELL));
  }
  return Number.isFinite(land) ? land : undefined;
}

/** Greedy placement: low, flat, centred and fully on the tower; in Survival much more careful than fast. */
function botPlan(t: TowerView, piece: FallingPiece, salt: number, careful = false) {
  const cols = surface(t);
  let best = { r: piece.r, x: piece.x, score: Infinity };
  for (let r = 0; r < 4; r++) {
    const cells = pieceCells(piece.k, r);
    for (let x = -TW.baseHalf; x <= TW.baseHalf; x += .5) {
      const px = snapX(piece.k, r, x), land = restingY(t, piece.k, r, px, cols);
      if (land === undefined) continue;
      // Cells hanging over a gap make the placement wobbly.
      let unsupported = 0;
      for (const [cx, cy] of cells) {
        let support = -Infinity;
        for (let c = Math.round((px + cx - CELL) * 2); c < Math.round((px + cx + CELL) * 2); c++) support = Math.max(support, cols.get(c) ?? -Infinity);
        const gap = land + cy - CELL - support;
        if (gap > .25) unsupported += Number.isFinite(gap) ? gap : 4;
      }
      const top = land + Math.max(...cells.map(([, cy]) => cy + CELL));
      // Cells beyond the pedestal edge tip the tower sooner or later.
      const overhang = cells.reduce((n, [cx]) => n + Math.max(0, Math.abs(px + cx) + CELL - TW.baseHalf + .25), 0);
      const score = careful
        ? top * .6 + unsupported * 8 + overhang * 6 + Math.abs(px) * .5 + ((salt + r * 7 + Math.round(px * 2)) % 10) * .01
        : top + unsupported * 1.5 + Math.abs(px) * .15 + ((salt + r * 7 + Math.round(px * 2)) % 10) * .01;
      if (score < best.score) best = { r, x: px, score };
    }
  }
  return best;
}
