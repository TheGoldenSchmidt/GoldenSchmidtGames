import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchState } from "./types";

/**
 * Tower Tumble – players take turns dropping blocks onto one shared tower.
 * Physics model: blocks fall straight down under gravity and land on the
 * highest surface below them. Stability follows static equilibrium: a block
 * stays if the common centre of mass of itself and everything it carries
 * lies within its contact span on the blocks below. Unstable blocks topple
 * together with their load; checks repeat until the tower is at rest.
 */
export const TW = {
  width: 10, baseX0: 3, baseX1: 7, spawnGap: 3.2, gravity: 30, aimMs: 5000, settleMs: 900, resultMs: 1300,
  placements: 3, recordStep: .5, collapsePenalty: 2, margin: .02, contact: .05, maxMs: 230000
} as const;
export interface Part { dx: number; dy: number; w: number; h: number }
export interface Shape { kind: string; parts: Part[]; w: number; h: number }
export interface Block { id: number; owner: string; kind: string; parts: Part[]; x: number; y: number; w: number; h: number }
export interface TowerGame {
  turns: string[];
  turn: number;
  phase: "aim" | "drop" | "settle" | "result" | "done";
  phaseStart: number;
  current?: { shape: Shape; x: number; y: number; vy: number; owner: string };
  blocks: Block[];
  falling: { block: Block; at: number }[];
  nextId: number;
  record: number;
  points: Record<string, number>;
  bestGain: Record<string, number>;
  last?: { owner: string; outcome: "stable" | "slip" | "collapse"; gain: number; bonus: boolean };
  tiebreak?: string[];
  tiebreakGain: Record<string, number>;
  winner?: string;
}
const SHAPES: Shape[] = [
  { kind: "square", parts: [{ dx: 0, dy: 0, w: 1, h: 1 }], w: 1, h: 1 },
  { kind: "plank", parts: [{ dx: 0, dy: 0, w: 3, h: .5 }], w: 3, h: .5 },
  { kind: "pillar", parts: [{ dx: 0, dy: 0, w: .8, h: 1.6 }], w: .8, h: 1.6 },
  { kind: "wide", parts: [{ dx: 0, dy: 0, w: 2, h: 1 }], w: 2, h: 1 },
  { kind: "small", parts: [{ dx: 0, dy: 0, w: .7, h: .7 }], w: .7, h: .7 },
  { kind: "ell", parts: [{ dx: 0, dy: 0, w: .6, h: 1.2 }, { dx: .6, dy: 0, w: 1.4, h: .5 }], w: 2, h: 1.2 },
  { kind: "tee", parts: [{ dx: .8, dy: 0, w: .6, h: .7 }, { dx: 0, dy: .7, w: 2.2, h: .5 }], w: 2.2, h: 1.2 }
];
const area = (p: Part) => p.w * p.h;
const top = (g: TowerGame) => Math.max(0, ...g.blocks.map(b => b.y + b.h));
const base = { x0: TW.baseX0, x1: TW.baseX1 };

/** Highest landing height for a shape whose left edge is at x. */
export function landingY(blocks: Block[], shape: { parts: Part[] }, x: number) {
  let y = -Infinity;
  for (const part of shape.parts) {
    const x0 = x + part.dx, x1 = x0 + part.w;
    let floor = x1 > base.x0 + 1e-9 && x0 < base.x1 - 1e-9 ? 0 : -Infinity;
    for (const b of blocks) for (const q of b.parts) {
      const qx0 = b.x + q.dx, qx1 = qx0 + q.w;
      if (x1 > qx0 + 1e-9 && x0 < qx1 - 1e-9) floor = Math.max(floor, b.y + q.dy + q.h);
    }
    y = Math.max(y, floor - part.dy);
  }
  return y;
}

/** Contact spans of a block's bottom faces, grouped by supporter (another block or the base). */
function supports(blocks: Block[], b: Block) {
  const spans = new Map<Block | "base", [number, number]>();
  const add = (key: Block | "base", a: number, c: number) => { const old = spans.get(key); spans.set(key, old ? [Math.min(old[0], a), Math.max(old[1], c)] : [a, c]); };
  for (const part of b.parts) {
    const bottom = b.y + part.dy, x0 = b.x + part.dx, x1 = x0 + part.w;
    if (Math.abs(bottom) < 1e-6) { const a = Math.max(x0, base.x0), c = Math.min(x1, base.x1); if (c - a > TW.contact) add("base", a, c); }
    for (const o of blocks) if (o !== b) for (const q of o.parts) {
      if (Math.abs(o.y + q.dy + q.h - bottom) > 1e-6) continue;
      const a = Math.max(x0, o.x + q.dx), c = Math.min(x1, o.x + q.dx + q.w);
      if (c - a > TW.contact) add(o, a, c);
    }
  }
  return spans;
}

/**
 * Static check from the top down: each block carries its own weight plus the
 * forces of the blocks resting on it, applied at their contact areas. It is
 * stable if the resultant lies within its own support span. A block on two
 * or more supporters passes its load on by the lever rule between the
 * outermost contacts.
 */
function unstableBlocks(blocks: Block[]) {
  const forces = new Map<Block, { f: number; x: number }[]>(blocks.map(b => [b, []]));
  const unstable: Block[] = [];
  const order = [...blocks].sort((a, b) => (b.y - a.y) || (b.id - a.id));
  for (const b of order) {
    const mass = b.parts.reduce((n, p) => n + area(p), 0), cx = b.parts.reduce((n, p) => n + area(p) * (b.x + p.dx + p.w / 2), 0) / mass;
    const incoming = forces.get(b)!, load = mass + incoming.reduce((n, f) => n + f.f, 0);
    const rx = (mass * cx + incoming.reduce((n, f) => n + f.f * f.x, 0)) / load;
    const spans = [...supports(blocks, b).entries()];
    if (!spans.length) { unstable.push(b); continue; }
    const lo = Math.min(...spans.map(([, s]) => s[0])), hi = Math.max(...spans.map(([, s]) => s[1]));
    // A tipping block still presses on the edge it tips over, so it can drag its supporter along.
    if (rx < lo - TW.margin || rx > hi + TW.margin) unstable.push(b);
    if (spans.length === 1) { const [key, [a, c]] = spans[0]; if (key !== "base") forces.get(key)!.push({ f: load, x: Math.max(a, Math.min(c, rx)) }); continue; }
    const centres = spans.map(([key, [a, c]]) => ({ key, x: (a + c) / 2, a, c })).sort((p, q) => p.x - q.x);
    const left = centres[0], right = centres.at(-1)!;
    const toRight = right.x - left.x < 1e-9 ? .5 : Math.max(0, Math.min(1, (rx - left.x) / (right.x - left.x)));
    for (const [side, share] of [[left, 1 - toRight], [right, toRight]] as const) if (side.key !== "base" && share > 0) forces.get(side.key)!.push({ f: load * share, x: side.x });
  }
  return unstable;
}

/** Everything resting on a block, directly or indirectly. */
function carried(blocks: Block[], b: Block, seen = new Set<Block>()): Block[] {
  if (seen.has(b)) return [];
  seen.add(b);
  return [b, ...blocks.filter(o => o !== b && supports(blocks, o).has(b)).flatMap(o => carried(blocks, o, seen))];
}

/** Removes toppling blocks until the tower is in static equilibrium. Returns the blocks that fell. */
export function settle(blocks: Block[]) {
  let standing = [...blocks];
  const fallen: Block[] = [];
  for (let guard = 0; guard < 50; guard++) {
    const unstable = unstableBlocks(standing);
    if (!unstable.length) break;
    // The lowest unstable block topples first, taking its load with it.
    const lowest = unstable.sort((a, b) => a.y - b.y || a.id - b.id)[0], group = new Set(carried(standing, lowest));
    for (const b of group) fallen.push(b);
    standing = standing.filter(b => !group.has(b));
  }
  return { standing, fallen };
}

function shapeFor(s: MatchState<TowerGame>) { return SHAPES[Math.floor(random(s) * SHAPES.length)]; }

function startTurn(s: MatchState<TowerGame>) {
  const g = s.game, owner = g.tiebreak ? g.tiebreak[g.turn] : g.turns[g.turn], shape = shapeFor(s);
  g.current = { shape, x: (TW.width - shape.w) / 2, y: top(g) + TW.spawnGap, vy: 0, owner };
  g.phase = "aim"; g.phaseStart = s.time;
  emit(s, "turn", "Dein Baustein!", [owner]);
}

function evaluate(s: MatchState<TowerGame>) {
  const g = s.game, current = g.current!, before = top(g);
  const block: Block = { id: g.nextId++, owner: current.owner, kind: current.shape.kind, parts: current.shape.parts, x: current.x, y: current.y, w: current.shape.w, h: current.shape.h };
  const { standing, fallen } = settle([...g.blocks, block]);
  const others = fallen.filter(b => b !== block);
  g.falling = fallen.map(b => ({ block: b, at: s.time }));
  g.current = undefined;
  if (others.length) {
    // Significant collapse caused by this placement: penalty and a fresh tower.
    if (!g.tiebreak) g.points[block.owner] -= TW.collapsePenalty; else g.tiebreakGain[block.owner] = -1;
    // The whole tower comes down for the animation; the next block starts a new tower.
    g.falling = [...standing, ...fallen].map(b => ({ block: b, at: s.time }));
    g.blocks = [];
    g.last = { owner: block.owner, outcome: "collapse", gain: 0, bonus: false };
    emit(s, "collapse", "Einsturz! −2", [block.owner]);
  } else if (fallen.includes(block)) {
    g.blocks = standing;
    g.last = { owner: block.owner, outcome: "slip", gain: 0, bonus: false };
    if (g.tiebreak) g.tiebreakGain[block.owner] = 0;
    emit(s, "slip", "Abgerutscht – kein Punkt", [block.owner]);
  } else {
    g.blocks = standing;
    const height = top(g), gain = Math.max(0, height - before), bonus = height >= g.record + TW.recordStep;
    if (bonus) g.record = height;
    if (g.tiebreak) g.tiebreakGain[block.owner] = gain;
    else { g.points[block.owner] += 1 + (bonus ? 1 : 0); g.bestGain[block.owner] = Math.max(g.bestGain[block.owner], gain); }
    g.last = { owner: block.owner, outcome: "stable", gain, bonus };
    emit(s, bonus ? "record" : "stable", bonus ? "Neue Rekordhöhe! +2" : "Steht! +1", [block.owner]);
  }
  g.phase = "result"; g.phaseStart = s.time;
}

function next(s: MatchState<TowerGame>) {
  const g = s.game;
  g.turn++;
  const active = (id: string) => !s.players.find(p => p.id === id)?.gone;
  const list = g.tiebreak ?? g.turns;
  while (g.turn < list.length && !active(list[g.turn])) g.turn++;
  if (g.turn < list.length) { startTurn(s); return; }
  if (g.tiebreak) {
    const best = Math.max(...g.tiebreak.map(id => g.tiebreakGain[id] ?? -1)), top2 = g.tiebreak.filter(id => (g.tiebreakGain[id] ?? -1) === best);
    if (top2.length === 1 && best > 0) g.winner = top2[0];
    g.phase = "done"; s.done = true; return;
  }
  const ids = s.players.filter(p => !p.gone).map(p => p.id);
  const most = Math.max(...ids.map(id => g.points[id])), tied = ids.filter(id => g.points[id] === most);
  const gain = Math.max(...tied.map(id => g.bestGain[id])), still = tied.filter(id => g.bestGain[id] === gain);
  if (still.length > 1) { g.tiebreak = still; g.turn = 0; startTurn(s); emit(s, "tiebreak", "Stechrunde!", still); return; }
  g.phase = "done"; s.done = true;
}

export const towerTumble: MatchModule<TowerGame> = {
  id: "tower",
  meta: {
    name: "Tower Tumble", seconds: TW.maxMs / 1000, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Ihr baut abwechselnd an einem gemeinsamen Turm. Schiebe deinen Baustein mit dem Finger waagrecht und lass los, um ihn fallen zu lassen (nach 5 Sekunden fällt er von selbst). Steht er stabil: +1. Deutlich neue Rekordhöhe: +1 extra. Reißt deine Platzierung andere Steine mit: −2 und ein neuer Turm beginnt. Jeder setzt 3 Steine.",
    controls: "Waagrecht ziehen · loslassen zum Fallenlassen.",
    look: { icon: "▦", action: "Bau höher, ohne alles umzuwerfen", hint: "Ziehen und loslassen", goal: "Die meisten Punkte nach 3 Steinen" }
  },
  create(s) {
    const ids = s.players.map(p => p.id), turns: string[] = [];
    // Order rotates between passes: pass k starts with player k.
    for (let pass = 0; pass < TW.placements; pass++) for (let i = 0; i < ids.length; i++) turns.push(ids[(i + pass) % ids.length]);
    s.game = { turns, turn: 0, phase: "aim", phaseStart: 0, blocks: [], falling: [], nextId: 1, record: 0, points: Object.fromEntries(ids.map(id => [id, 0])), bestGain: Object.fromEntries(ids.map(id => [id, 0])), tiebreakGain: {} };
    startTurn(s);
    return s.game;
  },
  step(s, dt) {
    const g = s.game, current = g.current;
    if (g.phase === "aim" && current) {
      const p = s.players.find(q => q.id === current.owner)!, input = inputOfPlayer(s, p);
      if (s.time <= p.inputUntil && !p.gone) current.x = Math.max(0, Math.min(TW.width - current.shape.w, (input.x + 1) / 2 * (TW.width - current.shape.w)));
      if (s.time - g.phaseStart >= TW.aimMs || p.gone) { g.phase = "drop"; g.phaseStart = s.time; emit(s, "drop", "", [current.owner]); }
      return;
    }
    if (g.phase === "drop" && current) {
      const floor = landingY(g.blocks, current.shape, current.x);
      current.vy -= TW.gravity * dt; current.y += current.vy * dt;
      // Nothing below: the block falls past the tower and counts as slipped.
      if (!Number.isFinite(floor)) { if (current.y < -4) evaluate(s); }
      else if (current.y <= floor) { current.y = floor; g.phase = "settle"; g.phaseStart = s.time; emit(s, "land", "", [current.owner]); }
      return;
    }
    if (g.phase === "settle" && s.time - g.phaseStart >= TW.settleMs) { evaluate(s); return; }
    if (g.phase === "result" && s.time - g.phaseStart >= TW.resultMs) { g.falling = []; next(s); }
  },
  press(s, p, kind) {
    const g = s.game;
    if (kind !== "a" || g.phase !== "aim" || g.current?.owner !== p.id) return;
    // Releasing the finger drops the block at the latest position.
    g.current.x = Math.max(0, Math.min(TW.width - g.current.shape.w, (p.input.x + 1) / 2 * (TW.width - g.current.shape.w)));
    g.phase = "drop"; g.phaseStart = s.time;
    emit(s, "drop", "", [p.id]);
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id], detail: g.winner === p.id ? "Stechrunde gewonnen" : `Bester Höhenbeitrag ${g.bestGain[p.id].toFixed(1)} m`,
      keys: [presence(p), g.points[p.id], Math.round(g.bestGain[p.id] * 100), g.winner === p.id ? 1 : 0] })));
  },
  finish(s) { s.game.phase = "done"; },
  bot(s, id) {
    const g = s.game, current = g.current;
    if (g.phase !== "aim" || current?.owner !== id) return {};
    // Try positions and prefer stable, high placements; vary a little per bot.
    let bestX = (TW.width - current.shape.w) / 2, bestScore = -Infinity;
    for (let i = 0; i <= 40; i++) {
      const x = i / 40 * (TW.width - current.shape.w), y = landingY(g.blocks, current.shape, x);
      if (!Number.isFinite(y)) continue;
      const block = { id: -1, owner: id, kind: current.shape.kind, parts: current.shape.parts, x, y, w: current.shape.w, h: current.shape.h };
      const { fallen } = settle([...g.blocks, block]);
      const score = fallen.length ? -10 - fallen.length : y + current.shape.h - Math.abs(x + current.shape.w / 2 - TW.width / 2) * .15 + (hash(`${id}:${g.turn}:${i}`) % 10) * .01;
      if (score > bestScore) { bestScore = score; bestX = x; }
    }
    const target = bestX / (TW.width - current.shape.w) * 2 - 1, here = current.x / (TW.width - current.shape.w) * 2 - 1;
    const ready = s.time - g.phaseStart > 900 && Math.abs(here - target) < .02;
    return { x: target, pressA: ready };
  }
};
