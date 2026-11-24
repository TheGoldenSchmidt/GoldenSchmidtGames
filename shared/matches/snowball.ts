import { clamp, dist, pushCircleOut, segmentHitsRect, type Rect } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Schneeballschlacht – a small snowy arena with walls and pine trees. Players
 * carry at most two snowballs: a tap on the form button forms balls while they
 * stand still (up to two), or they pick one up from a snow pile. Throws lock
 * onto an opponent near the aimed direction; a throw without aim goes to the
 * nearest opponent in clear sight. Every hit makes the hit
 * player 10 % slower; the third hit freezes them as a snowman (out). The last
 * one standing wins. Balls fly flat in the rules (the arc is presentation);
 * walls and trees stop them. World units: x right, y down, arena 0…size.
 */
export const SB = {
  size: 22, radius: .42, speed: 4.4, slowPerHit: .1, hitsOut: 3, maxBalls: 2,
  formMs: 1000, throwGap: 450, ballSpeed: 15, range: 12, ballRadius: .2, hitGrace: 500,
  pileRespawn: 6000, pileRadius: .7, maxMs: 120000, substeps: 2,
  /** A throw without aim in its own packet uses the aim seen this recently. */
  aimMemory: 800,
  /** Aim assist: an opponent in clear sight within this angle (radians) of the aim draws the throw, leading its run. */
  assist: .38,
  /** A tap on a device with a chase camera throws at the nearest opponent within this angle of the view (one it can see). */
  tapCone: 1.15
} as const;

export interface Snowballer {
  id: string; x: number; y: number; fx: number; fy: number;
  balls: number; hits: number; dealt: number;
  /** Forming a ball: progress in ms while standing still (after a tap on the button, or while holding it). */
  form: number;
  /** Tapped "form": forms whenever standing still until two balls are carried; running pauses it, a throw or a hit stops it. */
  forming?: boolean;
  lastThrow: number; hitAt: number; outAt?: number;
  /** Last aim direction seen while aiming, and when (a throw may arrive in a packet without it). */
  aimX?: number; aimY?: number; aimAt?: number;
}
export interface Snowball { id: number; owner: string; x: number; y: number; vx: number; vy: number; born: number; sx: number; sy: number }
export interface Pile { id: number; x: number; y: number; readyAt: number }
export interface SnowGame { players: Record<string, Snowballer>; balls: Snowball[]; piles: Pile[]; nextId: number; winner?: string; decided: boolean }

/** Snow walls (boxes) and trees (circles), point-symmetric around the centre so every start is equal. */
const half = SB.size / 2;
const mirror = (r: Rect): Rect => ({ x0: SB.size - r.x1, x1: SB.size - r.x0, y0: SB.size - r.y1, y1: SB.size - r.y0 });
const WALL_HALF: Rect[] = [
  { x0: 4.5, x1: 8, y0: 5.4, y1: 6.2 }, { x0: 13.8, x1: 14.6, y0: 3.5, y1: 7 }, { x0: 3.2, x1: 4, y0: 10, y1: 13.5 }, { x0: 9.6, x1: 12.4, y0: 9.6, y1: 10.4 }
];
export const SNOW_WALLS: readonly Rect[] = [...WALL_HALF, ...WALL_HALF.map(mirror)];
const TREE_HALF: [number, number][] = [[6.2, 2.3], [10.5, 5.2], [18.6, 4.6], [9.4, 13.4]];
export const SNOW_TREES: readonly { x: number; y: number; r: number }[] = [...TREE_HALF, ...TREE_HALF.map(([x, y]) => [SB.size - x, SB.size - y] as [number, number])].map(([x, y]) => ({ x, y, r: .55 }));
const PILES: [number, number][] = [[half, 3.2], [half, SB.size - 3.2], [3.4, half + 3], [SB.size - 3.4, half - 3], [half - 4.5, half + 4.5], [half + 4.5, half - 4.5]];
const SPAWNS: [number, number][] = [[1.6, 1.6], [SB.size - 1.6, SB.size - 1.6], [SB.size - 1.6, 1.6], [1.6, SB.size - 1.6], [half, 1.4], [half, SB.size - 1.4]];

const slowFactor = (p: Snowballer) => 1 - SB.slowPerHit * p.hits;
/** Free flight between two points: no wall or tree in between. */
export function clearShot(ax: number, ay: number, bx: number, by: number) {
  if (SNOW_WALLS.some(w => segmentHitsRect(ax, ay, bx, by, w, SB.ballRadius * .5))) return false;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  return !SNOW_TREES.some(t => { const k = clamp(((t.x - ax) * dx + (t.y - ay) * dy) / len2, 0, 1); return dist(ax + dx * k, ay + dy * k, t.x, t.y) < t.r + SB.ballRadius; });
}
const blocked = (x: number, y: number) => x < 0 || y < 0 || x > SB.size || y > SB.size
  || SNOW_WALLS.some(w => x > w.x0 - SB.ballRadius && x < w.x1 + SB.ballRadius && y > w.y0 - SB.ballRadius && y < w.y1 + SB.ballRadius)
  || SNOW_TREES.some(t => dist(x, y, t.x, t.y) < t.r + SB.ballRadius);

/** A body of the player's size would overlap a wall, a tree or leave the arena here. */
const bodyBlocked = (x: number, y: number) => x < SB.radius || y < SB.radius || x > SB.size - SB.radius || y > SB.size - SB.radius
  || SNOW_WALLS.some(w => x > w.x0 - SB.radius && x < w.x1 + SB.radius && y > w.y0 - SB.radius && y < w.y1 + SB.radius)
  || SNOW_TREES.some(t => dist(x, y, t.x, t.y) < t.r + SB.radius);
/** Bot steering: the wanted direction, or the nearest turned one that is free for a short way. */
function steerAround(me: Snowballer, dx: number, dy: number, side: number): [number, number] {
  const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
  for (const turn of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5]) {
    const t = turn * side, c = Math.cos(t), sn = Math.sin(t), x = dx * c - dy * sn, y = dx * sn + dy * c;
    if (!bodyBlocked(me.x + x * .7, me.y + y * .7) && !bodyBlocked(me.x + x * 1.4, me.y + y * 1.4)) return [x, y];
  }
  return [dx, dy];
}

function move(s: MatchState<SnowGame>, p: MatchPlayer, me: Snowballer, h: number) {
  const input = inputOfPlayer(s, p), stick = Math.hypot(input.x, input.y), aim = Math.hypot(input.ax, input.ay);
  if (aim > .2) { me.aimX = input.ax / aim; me.aimY = input.ay / aim; me.aimAt = s.time; }
  if (stick > .15) {
    const speed = SB.speed * slowFactor(me) * Math.min(1, stick);
    me.x += input.x / stick * speed * h; me.y += input.y / stick * speed * h;
    me.fx = input.x / stick; me.fy = input.y / stick;
  }
  // Forming needs standing still, after a tap on the button (or while holding it).
  if (me.balls >= SB.maxBalls) me.forming = false;
  if ((input.hb || me.forming) && stick <= .15 && me.balls < SB.maxBalls) {
    me.form += h * 1000;
    if (me.form >= SB.formMs) { me.balls++; me.form = 0; if (me.balls >= SB.maxBalls) me.forming = false; emit(s, "formed", "Schneeball geformt!", [me.id]); }
  } else me.form = 0;
  me.x = clamp(me.x, SB.radius, SB.size - SB.radius); me.y = clamp(me.y, SB.radius, SB.size - SB.radius);
  for (const w of SNOW_WALLS) pushCircleOut(me, SB.radius, w);
  for (const t of SNOW_TREES) {
    const d = dist(me.x, me.y, t.x, t.y), min = SB.radius + t.r;
    if (d < min && d > 1e-6) { me.x = t.x + (me.x - t.x) / d * min; me.y = t.y + (me.y - t.y) / d * min; }
  }
}

/**
 * Opponent a throw from `me` locks onto: in clear sight and range, and – with an
 * aim (dx, dy) – within `cone` of it (closest angle first, or the nearest one
 * for a wide cone); without an aim the nearest one. Shared with the devices,
 * which mark it and use the view direction for a tap.
 */
export function throwTarget(g: SnowGame, me: Snowballer, dx?: number, dy?: number, cone: number = SB.assist) {
  let best: Snowballer | undefined, score = Infinity;
  for (const o of Object.values(g.players)) {
    if (o.id === me.id || o.outAt !== undefined) continue;
    const ox = o.x - me.x, oy = o.y - me.y, d = Math.hypot(ox, oy);
    if (d < .01 || d > SB.range - .5 || !clearShot(me.x, me.y, o.x, o.y)) continue;
    let k = d;
    if (dx !== undefined && dy !== undefined) {
      const off = Math.abs(Math.atan2(dx * oy - dy * ox, dx * ox + dy * oy));
      if (off > cone) continue;
      k = cone > SB.assist ? d : off * 10 + d * .05;
    }
    if (k < score) { score = k; best = o; }
  }
  return best;
}

function flyBalls(s: MatchState<SnowGame>, h: number) {
  const g = s.game, gone = new Set<number>();
  for (const b of g.balls) {
    b.x += b.vx * h; b.y += b.vy * h;
    if (dist(b.x, b.y, b.sx, b.sy) > SB.range || blocked(b.x, b.y)) { gone.add(b.id); emit(s, "splat", "", []); continue; }
    for (const p of s.players) {
      const t = g.players[p.id];
      if (p.gone || t.outAt !== undefined || t.id === b.owner || s.time - t.hitAt < SB.hitGrace || dist(t.x, t.y, b.x, b.y) > SB.radius + SB.ballRadius) continue;
      gone.add(b.id); t.hits++; t.hitAt = s.time; t.form = 0; t.forming = false;
      const thrower = g.players[b.owner]; if (thrower) thrower.dealt++;
      if (t.hits >= SB.hitsOut) { t.outAt = s.time; t.balls = 0; emit(s, "frozen", "Zum Schneemann erstarrt!", [t.id, b.owner]); }
      else emit(s, "hit", `Treffer! ${Math.round(SB.slowPerHit * t.hits * 100)} % langsamer`, [t.id, b.owner]);
      break;
    }
  }
  if (gone.size) g.balls = g.balls.filter(b => !gone.has(b.id));
}

export const snowball: MatchModule<SnowGame> = {
  id: "snowball",
  meta: {
    name: "Schneeballschlacht", seconds: SB.maxMs / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Forme Schneebälle und triff die anderen – nach drei Treffern bist du ein Schneemann. Wer zuletzt übrig ist, gewinnt.",
    rules: "Schneeballschlacht in einer kleinen Winterarena. Du trägst höchstens zwei Schneebälle: Tippe „Formen“ und bleib kurz stehen, oder lauf über einen Schneehaufen. Tippe rechts, um auf den nächsten Gegner in Sicht zu werfen, oder ziehe zum Zielen und lass los; der Wurf rastet auf einen Gegner nahe der Zielrichtung ein (markiert). Mauern und Bäume halten Bälle auf. Jeder Treffer macht dich 10 % langsamer, nach drei Treffern bist du ein Schneemann und raus. Wer zuletzt übrig ist, gewinnt; nach zwei Minuten gewinnt, wer am wenigsten getroffen wurde.",
    controls: "Links laufen (Kamera-Richtung) · rechts tippen = Wurf auf den Nächsten, ziehen = zielen · „Formen“ tippen und stehen bleiben.",
    look: { icon: "❄", action: "Formen, zielen, treffen", hint: "Stick laufen · rechts tippen oder ziehen · Formen tippen", goal: "Als Letzter kein Schneemann" }
  },
  create(s) {
    const g: SnowGame = { players: {}, balls: [], piles: PILES.map(([x, y], i) => ({ id: i + 1, x, y, readyAt: 0 })), nextId: 100, decided: false };
    s.players.forEach((p, i) => {
      const [x, y] = SPAWNS[i % SPAWNS.length], fx = half - x, fy = half - y, n = Math.hypot(fx, fy) || 1;
      g.players[p.id] = { id: p.id, x, y, fx: fx / n, fy: fy / n, balls: 1, hits: 0, dealt: 0, form: 0, lastThrow: -1e9, hitAt: -1e9 };
    });
    s.game = g;
    return g;
  },
  step(s, dt) {
    const g = s.game, h = dt / SB.substeps;
    for (let k = 0; k < SB.substeps; k++) {
      for (const p of s.players) { const me = g.players[p.id]; if (!p.gone && me.outAt === undefined) move(s, p, me, h); }
      const alive = s.players.filter(p => !p.gone && g.players[p.id].outAt === undefined).map(p => g.players[p.id]);
      for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j], d = dist(a.x, a.y, b.x, b.y), min = SB.radius * 2;
        if (d >= min || d < 1e-6) continue;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      }
      flyBalls(s, h);
    }
    for (const pile of g.piles) {
      if (s.time < pile.readyAt) continue;
      const taker = s.players.map(p => g.players[p.id]).find(me => me.outAt === undefined && me.balls < SB.maxBalls && dist(me.x, me.y, pile.x, pile.y) < SB.pileRadius + SB.radius);
      if (taker) { taker.balls++; pile.readyAt = s.time + SB.pileRespawn; emit(s, "pickup", "Schneeball aufgehoben!", [taker.id]); }
    }
    const standing = s.players.filter(p => !p.gone && g.players[p.id].outAt === undefined);
    if (standing.length <= 1) { g.winner = standing[0]?.id; g.decided = true; s.done = true; }
    else if (s.time >= SB.maxMs) { g.decided = true; s.done = true; }
  },
  press(s, p, kind) {
    const me = s.game.players[p.id];
    if (!me || p.gone || me.outAt !== undefined) return;
    if (kind === "b") { if (me.balls < SB.maxBalls) me.forming = true; return; }
    if (kind !== "a" || me.balls <= 0 || s.time - me.lastThrow < SB.throwGap) return;
    // Direction from the aim of the same packet, else the aim seen just before (the release
    // packet may carry none); it locks onto an opponent near it. Without any aim: the nearest
    // opponent in clear sight, else along the facing.
    const aim = Math.hypot(p.input.ax, p.input.ay), recent = me.aimAt !== undefined && s.time - me.aimAt <= SB.aimMemory;
    const ax = aim > .2 ? p.input.ax / aim : recent ? me.aimX : undefined, ay = aim > .2 ? p.input.ay / aim : recent ? me.aimY : undefined;
    me.aimAt = undefined;
    const target = throwTarget(s.game, me, ax, ay);
    let dx = ax ?? me.fx, dy = ay ?? me.fy;
    if (target) {
      // Lead a running target by its stick for the ball's flight time.
      const tp = s.players.find(q => q.id === target.id), run = tp ? inputOfPlayer(s, tp) : undefined, stick = run ? Math.hypot(run.x, run.y) : 0;
      const v = stick > .15 ? SB.speed * slowFactor(target) * Math.min(1, stick) / stick : 0, fly = dist(me.x, me.y, target.x, target.y) / SB.ballSpeed;
      const lx = target.x + (run?.x ?? 0) * v * fly - me.x, ly = target.y + (run?.y ?? 0) * v * fly - me.y, n = Math.hypot(lx, ly) || 1;
      dx = lx / n; dy = ly / n;
    }
    me.fx = dx; me.fy = dy; me.balls--; me.lastThrow = s.time; me.form = 0; me.forming = false;
    const x = me.x + dx * (SB.radius + .1), y = me.y + dy * (SB.radius + .1);
    s.game.balls.push({ id: s.game.nextId++, owner: me.id, x, y, vx: dx * SB.ballSpeed, vy: dy * SB.ballSpeed, born: s.time, sx: x, sy: y });
    emit(s, "throw", "", [me.id]);
  },
  remove(s, id) { const me = s.game.players[id]; if (me && me.outAt === undefined) me.outAt = s.time; },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => {
      const me = g.players[p.id], out = me.outAt !== undefined;
      return { id: p.id, score: me.dealt, detail: `${out ? "Schneemann" : g.winner === p.id ? "Letzter im Schnee" : "steht noch"} · ${me.hits}/${SB.hitsOut} getroffen · ${me.dealt} Treffer`,
        keys: [presence(p), out ? 0 : 1, out ? me.outAt! : 0, -me.hits, me.dealt] };
    }));
  },
  finish(s) { s.game.decided = true; },
  bot(s, id) {
    const g = s.game, me = g.players[id];
    if (!me || me.outAt !== undefined) return {};
    const others = Object.values(g.players).filter(o => o.id !== id && o.outAt === undefined).sort((a, b) => dist(a.x, a.y, me.x, me.y) - dist(b.x, b.y, me.x, me.y));
    const salt = hash(`${id}:${Math.floor(s.time / 900)}`), side = hash(`${id}:${Math.floor(s.time / 4000)}`) % 2 ? 1 : -1;
    if (me.balls === 0) {
      // Nearest ready pile if close, otherwise stand and form.
      const pile = g.piles.filter(q => s.time >= q.readyAt).sort((a, b) => dist(a.x, a.y, me.x, me.y) - dist(b.x, b.y, me.x, me.y))[0];
      if (pile && dist(pile.x, pile.y, me.x, me.y) < 5) { const [x, y] = steerAround(me, pile.x - me.x, pile.y - me.y, side); return { x, y }; }
      return { hb: true };
    }
    const target = others.find(o => clearShot(me.x, me.y, o.x, o.y) && dist(o.x, o.y, me.x, me.y) < SB.range * .75) ?? others[0];
    if (!target) return {};
    const d = dist(target.x, target.y, me.x, me.y) || 1;
    if (clearShot(me.x, me.y, target.x, target.y) && d < SB.range * .75) {
      // Aim with a small error; throw every now and then, otherwise sidestep.
      // Wide enough that the aim assist does not catch every throw.
      const err = ((salt % 100) / 100 - .5), a = Math.atan2(target.y - me.y, target.x - me.x) + err;
      const ready = s.time - me.lastThrow > SB.throwGap + 1200 && salt % 4 === 0;
      const [x, y] = steerAround(me, -Math.sin(a) * side, Math.cos(a) * side, side);
      return { x: x * .6, y: y * .6, ax: Math.cos(a), ay: Math.sin(a), pressA: ready };
    }
    // Close in around walls and trees.
    const [x, y] = steerAround(me, (target.x - me.x) / d + (salt % 2 ? .3 : -.3), (target.y - me.y) / d, side);
    return { x, y };
  }
};
