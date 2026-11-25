import { clamp, dist, separateCircles } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Floor is Lava – square temple tiles on three floors above the lava. Tile
 * states (digit string, floor after floor, top floor first): 0 gone for good,
 * 1 intact, 2 cracking, 3 gone but regenerating. Stepping on an intact tile
 * starts its 0.8 s crack timer. Whoever stands over a hole drops one floor;
 * only a hole in the bottom floor (or the edge) leads into the lava, and the
 * lava ends the round for that runner: there is no respawn.
 */
export const FL = {
  cols: 9, rows: 13, floors: 3, dropMs: 450, radius: .32, speed: 3.2, airSpeed: 1.4, inertia: .35,
  crackMs: 800, regenMs: 2500, regenShare: .35,
  jumpMs: 550, jumpCooldown: 3000,
  /** Protection at the start of a round: tiles do not crumble and the edge holds. */
  startGrace: 500,
  ringAt: [16000, 23000] as const, roundMax: 30000, pause: 2600, rounds: 3, winBonus: 3,
  tiebreakMax: 25000,
  /** Shove: short dash in facing direction; a hit victim slides without control. */
  shoveMs: 220, shoveSpeed: 6, shoveCooldown: 2500, knock: 6.5, slideMs: 350, slide: .92, pushCredit: 1500,
  /** Dive: a long flat lunge in facing direction (over two-tile gaps), then a moment on the belly. */
  diveMs: 480, diveSpeed: 6.6, proneMs: 450, diveCooldown: 3500
} as const;
export interface Runner {
  id: string; x: number; y: number;
  /** Floor index, 0 = top. While dropping this is already the floor below. */
  floor: number; dropUntil: number; vx: number; vy: number; alive: boolean; airUntil: number; jumpReady: number; invulnUntil: number; outAt?: number;
  /** Facing (unit vector) for the shove. */
  fx: number; fy: number;
  shoveUntil: number; shoveReady: number; slideUntil: number;
  /** Who shoved this runner last and when ("" = nobody). */
  pushedBy: string; pushedAt: number;
  /** Dive: airborne until `diveUntil`, then lying until `proneUntil`; next dive from `diveReady`. */
  diveUntil?: number; proneUntil?: number; diveReady?: number;
}
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
export const FLOOR_TILES = FL.cols * FL.rows;
const index = (x: number, y: number, floor = 0) => floor * FLOOR_TILES + Math.floor(y) * FL.cols + Math.floor(x);
const setTile = (g: LavaGame, i: number, v: string) => { g.tiles = g.tiles.slice(0, i) + v + g.tiles.slice(i + 1); };
export const grounded = (s: MatchState, r: Runner) => s.time >= r.airUntil;
/** Distance of a tile from the edge of its floor (0 = outer ring). */
export const ring = (i: number) => { const j = i % FLOOR_TILES, x = j % FL.cols, y = Math.floor(j / FL.cols); return Math.min(x, y, FL.cols - 1 - x, FL.rows - 1 - y); };
export const dropping = (s: MatchState, r: Runner) => s.time < r.dropUntil;

function startRound(s: MatchState<LavaGame>, ids: string[], tiebreak: boolean) {
  const g = s.game;
  g.round++; g.tiebreak = tiebreak; g.phase = "play"; g.roundStart = s.time; g.rings = 0; g.timers = {};
  g.tiles = "1".repeat(FLOOR_TILES * FL.floors);
  g.regen = Array.from({ length: FLOOR_TILES * FL.floors }, () => random(s) < FL.regenShare ? "1" : "0").join("");
  // Start positions on a ring around the centre, same distance for everyone.
  const placed = s.players.filter(p => ids.includes(p.id));
  g.runners = Object.fromEntries(s.players.map(p => {
    const i = placed.indexOf(p), a = (i / Math.max(1, placed.length)) * Math.PI * 2 + (g.round - 1) * .5;
    const x = FL.cols / 2 + Math.cos(a) * 2.6, y = FL.rows / 2 + Math.sin(a) * 3.6;
    return [p.id, { id: p.id, x, y, floor: 0, dropUntil: 0, vx: 0, vy: 0, alive: i >= 0 && !p.gone, airUntil: 0, jumpReady: s.time, invulnUntil: s.time + FL.startGrace,
      fx: -Math.cos(a), fy: -Math.sin(a), shoveUntil: 0, shoveReady: s.time, slideUntil: 0, pushedBy: "", pushedAt: -1e9 }];
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

/** Into the lava: out for this round (a recent shove is credited in the event; points still follow survival). */
function lava(s: MatchState<LavaGame>, r: Runner) {
  const by = r.pushedBy && s.time - r.pushedAt <= FL.pushCredit ? [r.id, r.pushedBy] : [r.id];
  Object.assign(r, { vx: 0, vy: 0, slideUntil: 0, shoveUntil: 0, diveUntil: 0, proneUntil: 0, airUntil: 0, dropUntil: 0, alive: false, outAt: s.time });
  emit(s, "out", by.length > 1 ? "Reingeschubst!" : "In die Lava!", by);
}
const outside = (r: Runner) => r.x < 0 || r.y < 0 || r.x > FL.cols || r.y > FL.rows;

export const floorIsLava: MatchModule<LavaGame> = {
  id: "lava",
  meta: {
    name: "Floor is Lava", seconds: (FL.rounds * (FL.roundMax + FL.pause) + FL.tiebreakMax + FL.pause) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Jede Platte zerbröselt unter dir! Spring, hechte und schubse dich über drei Etagen – wer am längsten nicht in die Lava fällt, gewinnt.",
    rules: "Drei Etagen über der Lava: Jede Platte, die du betrittst, zerbröselt nach 0,8 Sekunden. Stehst du über einem Loch, fällst du eine Etage tiefer – erst ein Loch in der untersten Etage führt in die Lava. Wer über den Rand läuft oder geschubst wird, fällt direkt in die Lava – wer in der Lava landet, ist für diesen Durchgang raus. Mit dem Schubser rempelst du andere auf bröselnde Platten (alle 2,5 Sekunden; wer springt, weicht aus). Platten mit leuchtender Rune kommen nach 2,5 Sekunden zurück. Mit dem Sprungknopf überspringst du kleine Lücken (alle 3 Sekunden), mit Hechten fliegst du flach über zwei Platten weit, liegst danach aber kurz am Boden (alle 3,5 Sekunden). Ab Sekunde 16 verschwindet auf allen Etagen der Rand. +1 für jede Person, die vor dir fällt, +3 für den Durchgangssieg. Drei Durchgänge.",
    controls: "Stick: laufen (oben = von der Kamera weg) · Knöpfe: springen, hechten und schubsen · oben rechts: Übersicht.",
    look: { icon: "♨", action: "Bleib in Bewegung, Etage für Etage", hint: "Stick laufen · springen · schubsen", goal: "Am längsten über der Lava bleiben" }
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
      const input = inputOfPlayer(s, p), speed = FL.speed * (grounded(s, r) ? 1 : FL.airSpeed), stick = Math.hypot(input.x, input.y);
      // A dive keeps its direction until the runner is up again.
      if (stick > .2 && s.time >= (r.proneUntil ?? 0)) { r.fx = input.x / stick; r.fy = input.y / stick; }
      if (s.time < (r.diveUntil ?? 0)) { r.vx = r.fx * FL.diveSpeed; r.vy = r.fy * FL.diveSpeed; }
      else if (s.time < (r.proneUntil ?? 0)) { r.vx *= .5; r.vy *= .5; }
      else if (s.time < r.slideUntil) { r.vx *= FL.slide; r.vy *= FL.slide; }
      else if (s.time < r.shoveUntil) { r.vx = r.fx * FL.shoveSpeed; r.vy = r.fy * FL.shoveSpeed; }
      else { r.vx += (input.x * speed - r.vx) * FL.inertia; r.vy += (input.y * speed - r.vy) * FL.inertia; }
      r.x += r.vx * dt; r.y += r.vy * dt;
      // There is no railing: only during the start protection the edge holds.
      if (s.time < r.invulnUntil) { r.x = clamp(r.x, FL.radius, FL.cols - FL.radius); r.y = clamp(r.y, FL.radius, FL.rows - FL.radius); }
    }
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], b = alive[j];
      // Only runners on the same floor and at the same height meet; a falling runner meets nobody.
      if (a.floor !== b.floor || dropping(s, a) || dropping(s, b) || grounded(s, a) !== grounded(s, b)) continue;
      // A shove that reaches someone on the same height sends them sliding (not while protected).
      if (dist(a.x, a.y, b.x, b.y) < FL.radius * 2 + .05) for (const [hitter, victim] of [[a, b], [b, a]] as const) {
        if (s.time >= hitter.shoveUntil || s.time < victim.invulnUntil || s.time < victim.slideUntil) continue;
        const d = dist(hitter.x, hitter.y, victim.x, victim.y) || 1, nx = (victim.x - hitter.x) / d, ny = (victim.y - hitter.y) / d;
        Object.assign(victim, { vx: nx * FL.knock, vy: ny * FL.knock, slideUntil: s.time + FL.slideMs, pushedBy: hitter.id, pushedAt: s.time });
        hitter.shoveUntil = s.time; hitter.vx *= .3; hitter.vy *= .3;
        emit(s, "shove", "Schubser!", [victim.id, hitter.id]);
        break;
      }
      separateCircles(a, b, FL.radius, FL.radius, i + j);
    }
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
      if (!grounded(s, r) || !r.alive) continue;
      // Off the edge: straight down past every floor into the lava.
      if (outside(r)) { lava(s, r); continue; }
      const i = index(r.x, r.y, r.floor), tile = g.tiles[i];
      if (tile === "1") { if (s.time >= r.invulnUntil) { setTile(g, i, "2"); g.timers[i] = s.time + FL.crackMs; } }
      else if ((tile === "0" || tile === "3") && s.time >= r.invulnUntil) {
        if (r.floor >= FL.floors - 1) lava(s, r);
        else {
          // Through the hole onto the floor below; airborne until the landing.
          r.floor++; r.dropUntil = r.airUntil = s.time + FL.dropMs; r.slideUntil = 0; r.shoveUntil = 0; r.diveUntil = 0; r.proneUntil = 0;
          emit(s, "drop", "Eine Etage tiefer!", [r.id]);
        }
      }
    }
    const left = Object.values(g.runners).filter(r => r.alive);
    if (left.length <= 1 || roundTime >= (g.tiebreak ? FL.tiebreakMax : FL.roundMax)) endRound(s);
  },
  press(s, p: MatchPlayer, kind, _at, value) {
    const g = s.game, r = g.runners[p.id];
    if (kind === "n") {
      // Command 1 = dive.
      if (value !== 1 || g.phase !== "play" || !r?.alive || s.time < (r.diveReady ?? 0) || !grounded(s, r) || s.time < r.slideUntil || s.time < (r.proneUntil ?? 0)) return;
      // The stick of the same packet sets the direction.
      const stick = Math.hypot(p.input.x, p.input.y);
      if (stick > .2) { r.fx = p.input.x / stick; r.fy = p.input.y / stick; }
      r.airUntil = r.diveUntil = s.time + FL.diveMs; r.proneUntil = s.time + FL.diveMs + FL.proneMs; r.diveReady = s.time + FL.diveCooldown; r.shoveUntil = 0;
      emit(s, "dive", "", [p.id]);
      return;
    }
    if (kind === "b") {
      if (g.phase !== "play" || !r?.alive || s.time < r.shoveReady || !grounded(s, r) || s.time < r.slideUntil || s.time < (r.proneUntil ?? 0)) return;
      r.shoveUntil = s.time + FL.shoveMs; r.shoveReady = s.time + FL.shoveCooldown;
      emit(s, "dash", "", [p.id]);
      return;
    }
    if (kind !== "a" || g.phase !== "play" || !r?.alive || s.time < r.jumpReady || !grounded(s, r) || s.time < (r.proneUntil ?? 0)) return;
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
    const here = index(me.x, me.y, me.floor), salt = hash(`${id}:${g.round}`) % 7, base = me.floor * FLOOR_TILES;
    let best = here, score = -Infinity;
    for (let i = base; i < base + FLOOR_TILES; i++) {
      if (g.tiles[i] !== "1" || i === here) continue;
      const j = i - base, x = j % FL.cols + .5, y = Math.floor(j / FL.cols) + .5, d = dist(me.x, me.y, x, y);
      const crowd = Object.values(g.runners).filter(o => o.alive && o.id !== id && o.floor === me.floor && dist(o.x, o.y, x, y) < 1.2).length;
      const value = -d + ring(i) * .6 - crowd * 2 + ((i * 7 + salt) % 5) * .05;
      if (d < 3.2 && value > score) { best = i; score = value; }
    }
    const tx = (best - base) % FL.cols + .5, ty = Math.floor((best - base) / FL.cols) + .5, dx = tx - me.x, dy = ty - me.y, d = Math.hypot(dx, dy) || 1;
    const crumbling = g.tiles[here] === "2" && (g.timers[here] ?? Infinity) - s.time < 250;
    const gapAhead = g.tiles[index(clamp(me.x + dx / d * .7, 0, FL.cols - .01), clamp(me.y + dy / d * .7, 0, FL.rows - .01), me.floor)] !== "1";
    // Shove a close opponent standing in front.
    const victim = Object.values(g.runners).find(o => o.alive && o.id !== id && o.floor === me.floor && dist(o.x, o.y, me.x, me.y) < 1.1 && ((o.x - me.x) * me.fx + (o.y - me.y) * me.fy) / (dist(o.x, o.y, me.x, me.y) || 1) > .7);
    const shove = !!victim && s.time >= me.shoveReady && grounded(s, me) && hash(`${id}:${Math.floor(s.time / 400)}`) % 3 === 0;
    const aim = shove && victim ? { x: victim.x - me.x, y: victim.y - me.y } : { x: dx / d, y: dy / d };
    const escape = grounded(s, me) && (crumbling || gapAhead && d > .8), jump = escape && s.time >= me.jumpReady;
    // Without a jump ready, a dive gets away from a crumbling tile.
    const dive = escape && !jump && s.time >= (me.diveReady ?? 0) && s.time >= (me.proneUntil ?? 0);
    return { x: aim.x, y: aim.y, pressA: jump, pressB: shove && !dive, ...(dive ? { command: 1 } : {}) };
  }
};
