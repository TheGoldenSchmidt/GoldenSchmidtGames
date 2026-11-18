import { pointInRect, type Rect } from "./geometry";
import { emit, hash, presence, rank, random, shuffled, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Arrow Masters – everyone aims for 10 s (the aim stays private), then all
 * prepared arrows fly at once. World units: x 0…20 to the right, y 0…14 up.
 */
export const AM = {
  width: 20, height: 14, gravity: 9.8, maxSpeed: 16, minPower: .2,
  aimMs: 10000, flightMs: 4000, resultMs: 2600, rounds: 5, hp: 3, wind: 3,
  hitPoints: 2, defeatBonus: 1, targetPoints: 1, substeps: 8,
  bodyW: .7, bodyH: 1.3, targetR: .55,
  /** Fan of the triple shot (radians between arrows), speed factor and damage of the heavy arrow. */
  tripleSpread: .09, heavySpeed: .92, heavyDamage: 2
} as const;
/**
 * Arrow kinds: the normal arrow, a triple shot (three arrows in a narrow fan)
 * and a heavy arrow (wind cannot push it, a hit costs two health points).
 * Triple and heavy can be used once per match each.
 */
export type ArrowKind = "normal" | "triple" | "heavy";
export const ARROW_KINDS: readonly ArrowKind[] = ["normal", "triple", "heavy"];
export interface Archer {
  id: string; x: number; y: number; hp: number; down: boolean; aim?: { angle: number; power: number };
  /** Kind chosen for this round (secret until the arrows fly). */
  kind?: ArrowKind;
  /** Special arrows still available in this match. */
  specials?: { triple: number; heavy: number };
}
export interface Arrow { owner: string; x: number; y: number; vx: number; vy: number; done: boolean; hit?: string; best: number; kind?: ArrowKind }
export interface ArrowGame {
  round: number;
  phase: "aim" | "flight" | "result" | "done";
  phaseStart: number;
  tiebreak?: string[];
  wind: number;
  archers: Record<string, Archer>;
  arrows: Arrow[];
  targets: { x: number; y: number }[];
  obstacles: Rect[];
  points: Record<string, number>;
  /** Tiebreak: closest approach to the bullseye per player. */
  precision: Record<string, number>;
  winner?: string;
  log: { round: number; hits: { from: string; to: string }[] }[];
}
const BOT_AIMS = new Map<string, { ax: number; ay: number }>();
/** Standing spots; every round the archers are dealt a new random set of them. */
export const SLOTS = [[1.6, 2.5], [18.4, 2.5], [1.6, 7.2], [18.4, 7.2], [5.2, 11], [14.8, 11], [6, 1.2], [14, 1.2], [10, 12.6]] as const;
const OBSTACLES: Rect[] = [{ x0: 9.4, x1: 10.6, y0: 0, y1: 4.6 }, { x0: 6.2, x1: 7.4, y0: 6.6, y1: 7.3 }, { x0: 12.6, x1: 13.8, y0: 6.6, y1: 7.3 }];
const bodyRect = (a: Archer): Rect => ({ x0: a.x - AM.bodyW / 2, x1: a.x + AM.bodyW / 2, y0: a.y, y1: a.y + AM.bodyH });
export const launch = (a: Archer) => ({ x: a.x, y: a.y + AM.bodyH * .7 });

function startRound(s: MatchState<ArrowGame>, tiebreak?: string[]) {
  const g = s.game;
  g.round++; g.phase = "aim"; g.phaseStart = s.time; g.arrows = [];
  g.wind = Math.round((random(s) * 2 - 1) * AM.wind * 10) / 10;
  if (tiebreak) { g.tiebreak = tiebreak; g.targets = [{ x: 10, y: 9.2 }]; g.wind = 0; }
  else g.targets = [{ x: 7 + random(s) * 6, y: 8.5 + random(s) * 3 }, { x: 4 + random(s) * 12, y: 4.8 + random(s) * 1.4 }];
  // New positions after every shot: a fresh deterministic deal of the spots.
  const spots = shuffled(s, SLOTS.map((_, i) => i));
  s.players.forEach((p, i) => { const a = g.archers[p.id], [x, y] = SLOTS[spots[i]]; Object.assign(a, { x, y }); });
  for (const a of Object.values(g.archers)) { a.aim = undefined; a.down = false; a.hp = AM.hp; a.kind = "normal"; }
  emit(s, "round", tiebreak ? "Präzisions-Stechen!" : `Runde ${g.round} von ${AM.rounds}: neue Plätze, zielen!`, []);
}

function fire(s: MatchState<ArrowGame>) {
  const g = s.game;
  g.phase = "flight"; g.phaseStart = s.time;
  for (const p of s.players) {
    const a = g.archers[p.id];
    if (!a.aim || p.gone || (g.tiebreak && !g.tiebreak.includes(p.id))) continue;
    // Special arrows are spent when they fly; the precision tiebreak always uses the normal arrow.
    const kind: ArrowKind = !g.tiebreak && a.kind && a.kind !== "normal" && (a.specials?.[a.kind] ?? 0) > 0 ? a.kind : "normal";
    if (kind !== "normal") a.specials![kind]--;
    const speed = AM.maxSpeed * a.aim.power * (kind === "heavy" ? AM.heavySpeed : 1), start = launch(a);
    for (const turn of kind === "triple" ? [-AM.tripleSpread, 0, AM.tripleSpread] : [0]) {
      const angle = a.aim.angle + turn;
      g.arrows.push({ owner: p.id, x: start.x, y: start.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, done: false, best: Infinity, ...(kind !== "normal" ? { kind } : {}) });
    }
  }
  emit(s, "fire", g.arrows.length ? "Pfeile los!" : "Niemand hat gezielt", []);
}

function fly(s: MatchState<ArrowGame>, dt: number) {
  const g = s.game, hits: [Arrow, Archer][] = [];
  for (let k = 0; k < AM.substeps; k++) {
    const h = dt / AM.substeps;
    for (const arrow of g.arrows) {
      if (arrow.done) continue;
      // The heavy arrow is not pushed by the wind.
      if (arrow.kind !== "heavy") arrow.vx += g.wind * h;
      arrow.vy -= AM.gravity * h;
      arrow.x += arrow.vx * h; arrow.y += arrow.vy * h;
      if (g.tiebreak) { const t = g.targets[0]; arrow.best = Math.min(arrow.best, Math.hypot(arrow.x - t.x, arrow.y - t.y)); }
      if (arrow.y <= 0 || arrow.x < -1 || arrow.x > AM.width + 1 || arrow.y > AM.height + 6 || OBSTACLES.some(o => pointInRect(arrow.x, arrow.y, o))) { arrow.done = true; continue; }
      if (g.tiebreak) continue;
      const target = g.targets.find(t => Math.hypot(arrow.x - t.x, arrow.y - t.y) < AM.targetR);
      if (target) { arrow.done = true; arrow.hit = "target"; g.points[arrow.owner] += AM.targetPoints; emit(s, "target", "Zielscheibe! +1", [arrow.owner]); continue; }
      // Arrows leave their own archer first; any later contact counts, including self-hits.
      const victim = Object.values(g.archers).find(a => !a.down && pointInRect(arrow.x, arrow.y, bodyRect(a)) && !(a.id === arrow.owner && s.time - g.phaseStart < 300));
      if (victim) { arrow.done = true; arrow.hit = victim.id; hits.push([arrow, victim]); }
    }
  }
  // Damage after the whole step: simultaneous hits on the same archer all count.
  for (const [arrow, victim] of hits) {
    victim.hp -= arrow.kind === "heavy" ? AM.heavyDamage : 1;
    const self = arrow.owner === victim.id;
    if (!self) g.points[arrow.owner] += AM.hitPoints;
    g.log.at(-1)?.hits.push({ from: arrow.owner, to: victim.id });
    emit(s, "hit", self ? "Eigentreffer!" : "Treffer! +2", [victim.id, arrow.owner]);
    if (victim.hp <= 0 && !victim.down) {
      victim.down = true;
      if (!self) g.points[arrow.owner] += AM.defeatBonus;
      emit(s, "down", self ? "Selbst besiegt" : "Besiegt! +1", [victim.id, arrow.owner]);
    }
  }
}

function afterRound(s: MatchState<ArrowGame>) {
  const g = s.game;
  if (g.tiebreak) {
    const best = Math.min(...g.tiebreak.map(id => g.precision[id] = g.arrows.find(a => a.owner === id)?.best ?? Infinity));
    const winners = g.tiebreak.filter(id => g.precision[id] === best);
    if (winners.length === 1 && Number.isFinite(best)) g.winner = winners[0];
    g.phase = "done"; s.done = true; return;
  }
  if (g.round < AM.rounds && s.players.filter(p => !p.gone).length > 1) { g.log.push({ round: g.round + 1, hits: [] }); startRound(s); return; }
  const active = s.players.filter(p => !p.gone).map(p => p.id), top = Math.max(...active.map(id => g.points[id])), tied = active.filter(id => g.points[id] === top);
  if (tied.length > 1) { startRound(s, tied); return; }
  g.winner = tied[0]; g.phase = "done"; s.done = true;
}

/** Ballistic preview used by bots and the aiming line. */
export function trajectory(from: { x: number; y: number }, angle: number, power: number, wind: number, seconds: number, steps = 30) {
  const v = AM.maxSpeed * power, points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) { const t = seconds * i / steps; points.push([from.x + Math.cos(angle) * v * t + wind * t * t / 2, from.y + Math.sin(angle) * v * t - AM.gravity * t * t / 2]); }
  return points;
}

export const arrowMasters: MatchModule<ArrowGame> = {
  id: "arrows",
  meta: {
    name: "Arrow Masters", seconds: (AM.rounds + 1) * (AM.aimMs + AM.flightMs + AM.resultMs) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 10,
    instruction: "Ziehe auf der Zielfläche wie an einer Bogensehne: Richtung und Länge bestimmen Winkel und Stärke. Nach 10 Sekunden fliegen alle Pfeile gleichzeitig, der Wind wechselt jede Runde. Gegnertreffer +2, Besiegen +1, Zielscheiben +1. Je einmal pro Partie wählst du vor dem Schuss einen Dreifachpfeil (drei Pfeile im Fächer) oder einen schweren Pfeil (fliegt unbeirrt vom Wind, ein Treffer kostet zwei Trefferpunkte). Jeder hat 3 Trefferpunkte pro Runde und steht jede Runde an einem neuen Platz. Fünf Runden; bei Gleichstand entscheidet ein Präzisionsschuss auf die Scheibe.",
    controls: "Ziehen = spannen und zielen · der Schuss löst automatisch aus.",
    look: { icon: "➶", action: "Spannen, zielen, treffen", hint: "Ziehen zum Zielen · Schuss nach 10 s", goal: "Die meisten Punkte nach 5 Runden" }
  },
  create(s) {
    s.game = { round: 0, phase: "aim", phaseStart: 0, wind: 0, archers: {}, arrows: [], targets: [], obstacles: OBSTACLES, points: Object.fromEntries(s.players.map(p => [p.id, 0])), precision: {}, log: [{ round: 1, hits: [] }] };
    s.players.forEach((p, i) => { const [x, y] = SLOTS[i]; s.game.archers[p.id] = { id: p.id, x, y, hp: AM.hp, down: false, kind: "normal", specials: { triple: 1, heavy: 1 } }; });
    startRound(s);
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    // Aim from the latest held drag; a released drag keeps the last aim.
    if (g.phase === "aim") {
      for (const p of s.players) {
        const a = g.archers[p.id], input = s.time <= p.inputUntil ? p.input : undefined;
        if (!input || p.gone || a.down) continue;
        const length = Math.hypot(input.ax, input.ay);
        if (length > AM.minPower * .75) a.aim = { angle: Math.atan2(input.ay, -input.ax), power: Math.max(AM.minPower, Math.min(1, length)) };
      }
      if (s.time - g.phaseStart >= AM.aimMs) fire(s);
      return;
    }
    if (g.phase === "flight") {
      fly(s, dt);
      if (g.arrows.every(a => a.done) || s.time - g.phaseStart >= AM.flightMs) { g.phase = "result"; g.phaseStart = s.time; }
      return;
    }
    if (g.phase === "result" && s.time - g.phaseStart >= AM.resultMs) afterRound(s);
  },
  // Aiming uses the held drag; a command chooses the arrow kind for this round (0 normal, 1 triple, 2 heavy).
  press(s, p, kind, _at, value) {
    const g = s.game, a = g.archers[p.id], wanted = ARROW_KINDS[value];
    if (kind !== "n" || g.phase !== "aim" || !a || a.down || !wanted || g.tiebreak) return;
    if (wanted === "normal" || (a.specials?.[wanted] ?? 0) > 0) a.kind = wanted;
  },
  remove(s, id) { const a = s.game.archers[id]; if (a) a.aim = undefined; },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.points[p.id], detail: g.winner === p.id && g.tiebreak ? "Präzisions-Stechen gewonnen" : `${g.log.reduce((n, r) => n + r.hits.filter(h => h.from === p.id && h.to !== p.id).length, 0)} Treffer`,
      keys: [presence(p), g.points[p.id], g.winner === p.id ? 1 : 0] })));
  },
  finish(s) { s.game.phase = "done"; },
  view(s, viewer) {
    // Aims stay secret until the arrows fly.
    if (s.game.phase === "aim") for (const a of Object.values(s.game.archers)) if (a.id !== viewer) { delete a.aim; delete a.kind; }
  },
  bot(s, id) {
    const g = s.game, me = g.archers[id];
    if (g.phase !== "aim" || !me || me.down || (g.tiebreak && !g.tiebreak.includes(id))) return {};
    const goals = g.tiebreak ? g.targets : Object.values(g.archers).filter(a => a.id !== id && !a.down).map(a => ({ x: a.x, y: a.y + AM.bodyH / 2 }));
    if (!goals.length) return {};
    const goal = goals[hash(`${id}:${g.round}`) % goals.length], from = launch(me);
    // The search depends only on these values, so its result is cached per round (deterministic).
    const key = `${s.seed}:${id}:${g.round}:${g.wind}:${goal.x}:${goal.y}`;
    const cached = BOT_AIMS.get(key);
    if (cached) return cached;
    // Coarse search over angle and power for the closest approach, with a small per-bot error.
    let best = { angle: Math.PI / 4, power: .7, miss: Infinity };
    for (let ai = 0; ai < 36; ai++) for (let pi = 0; pi < 12; pi++) {
      const angle = (ai / 36) * Math.PI, power = .3 + pi * .06;
      const miss = Math.min(...trajectory(from, angle, power, g.wind, 2.5, 50).filter(([, y]) => y > 0).map(([x, y]) => Math.hypot(x - goal.x, y - goal.y)));
      if (miss < best.miss) best = { angle, power, miss };
    }
    const error = ((hash(`${id}:${g.round}:e`) % 100) / 100 - .5) * .12;
    const angle = best.angle + error, power = Math.min(1, best.power);
    // Express the aim as a drag vector: pulling opposite to the shot direction.
    // Specials: the heavy arrow in strong wind, the triple shot in the second half.
    const special = me.specials?.heavy && Math.abs(g.wind) > 2 ? 2 : me.specials?.triple && g.round >= 3 ? 1 : 0;
    const intent = { ax: -Math.cos(angle) * power, ay: Math.sin(angle) * power, ...(special && !g.tiebreak ? { command: special } : {}) };
    if (BOT_AIMS.size > 500) BOT_AIMS.clear();
    BOT_AIMS.set(key, intent);
    return intent;
  }
};
