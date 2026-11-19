import { clamp, dist, wrapAngle } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Neon Racer – top-down race on a neon circuit. Every car has a steering
 * wheel (stick `x`), gas (`ha`) and brake (`hb`); a tap (`a`) uses the item
 * from the last item box: boost, gun (three shots), homing missile or shield.
 * The track is a closed centre line with walls on both sides; the race
 * position is the distance driven along that line. World units: x right,
 * y down, a car is about 1.8 long.
 */
export const NR = {
  laps: 3, halfWidth: 3.4, car: .62,
  accel: 11, maxSpeed: 17, reverse: 5, brake: 24, coast: .9, turn: 2.6, grip: 6,
  wallKeep: .45, wallTurn: .35,
  boostSpeed: 25, boostAccel: 32, boostMs: 1500,
  spinMs: 1000, missileSpinMs: 1500, spinRate: 10,
  shots: 3, shotSpeed: 32, shotMs: 1000, shotGap: 250,
  missileSpeed: 25, missileTurn: 3.4, missileMs: 6000, missileLock: 9,
  shieldMs: 5000, ownGrace: 350,
  boxRespawn: 3000, boxRadius: .8, boxRows: [.17, .42, .66, .87], boxLanes: [-1.9, 0, 1.9],
  finishGrace: 15000, maxMs: 150000, substeps: 3
} as const;

export type RacerItem = "boost" | "gun" | "missile" | "shield";
export const RACER_ITEMS: readonly RacerItem[] = ["boost", "gun", "missile", "shield"];
export interface Car {
  id: string; x: number; y: number; a: number; v: number;
  /** Sideways speed (slides after hard turns and hits). */
  side: number;
  /** Nearest centre-line sample and distance driven along the track (can be negative on the grid). */
  seg: number; prog: number;
  item?: RacerItem; ammo?: number; lastShot?: number;
  boostUntil: number; shieldUntil: number; spinUntil: number; wallAt: number;
  finishAt?: number;
}
export interface Shot { id: number; kind: "shot" | "missile"; owner: string; x: number; y: number; a: number; born: number; seg: number; target?: string }
export interface Box { id: number; x: number; y: number; readyAt: number }
export interface RacerGame { cars: Record<string, Car>; shots: Shot[]; boxes: Box[]; nextId: number; firstFinish?: number; decided: boolean }

/** Closed circuit (control points, y down), smoothed with Catmull-Rom splines. */
const POINTS: readonly [number, number][] = [
  [0, 0], [26, -2], [40, 6], [44, 22], [34, 32], [20, 30], [12, 40], [16, 54], [34, 58], [46, 70], [40, 86], [18, 90], [-4, 84], [-12, 66], [-6, 50], [-16, 36], [-18, 16], [-12, 4]
];
export interface Track { x: number[]; y: number[]; tx: number[]; ty: number[]; s: number[]; length: number; count: number }
function buildTrack(points: readonly [number, number][], spacing = 1): Track {
  const n = points.length, dense: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
    const steps = Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 4));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  // Resample to an even spacing so samples are about `spacing` apart.
  const x: number[] = [], y: number[] = [];
  let carry = 0;
  x.push(dense[0][0]); y.push(dense[0][1]);
  for (let i = 0; i < dense.length; i++) {
    const [ax, ay] = dense[i], [bx, by] = dense[(i + 1) % dense.length], len = Math.hypot(bx - ax, by - ay);
    let at = spacing - carry;
    while (at <= len) { x.push(ax + (bx - ax) * at / len); y.push(ay + (by - ay) * at / len); at += spacing; }
    carry = len - (at - spacing);
  }
  // The last sample may sit right before the first one: drop it.
  if (Math.hypot(x.at(-1)! - x[0], y.at(-1)! - y[0]) < spacing * .5) { x.pop(); y.pop(); }
  const count = x.length, tx: number[] = [], ty: number[] = [], s: number[] = [];
  let length = 0;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % count, k = (i - 1 + count) % count, dx = x[j] - x[k], dy = y[j] - y[k], d = Math.hypot(dx, dy) || 1;
    tx.push(dx / d); ty.push(dy / d); s.push(length);
    length += Math.hypot(x[j] - x[i], y[j] - y[i]);
  }
  return { x, y, tx, ty, s, length, count };
}
export const TRACK = buildTrack(POINTS);

/** Point on the centre line `s` along the track, shifted `off` to the right of the driving direction. */
export function trackPoint(s: number, off = 0) {
  const t = TRACK, along = ((s % t.length) + t.length) % t.length;
  let i = Math.min(t.count - 1, Math.floor(along / t.length * t.count));
  while (i > 0 && t.s[i] > along) i--;
  while (i < t.count - 1 && t.s[i + 1] <= along) i++;
  const j = (i + 1) % t.count, seg = (j ? t.s[j] : t.length) - t.s[i], k = seg ? (along - t.s[i]) / seg : 0;
  const x = t.x[i] + (t.x[j] - t.x[i]) * k, y = t.y[i] + (t.y[j] - t.y[i]) * k;
  // Right of the driving direction in a y-down field: (-ty, tx).
  return { x: x - t.ty[i] * off, y: y + t.tx[i] * off, a: Math.atan2(t.ty[i], t.tx[i]), i };
}

/**
 * Nearest centre-line position near the sample `hint` (searched ±12 samples,
 * so close parts of the circuit are never confused). Returns the sample, the
 * distance along the track and the signed sideways offset (right = positive).
 */
export function locate(x: number, y: number, hint: number) {
  const t = TRACK;
  let best = hint, bestD = Infinity;
  for (let k = -12; k <= 12; k++) {
    const i = ((hint + k) % t.count + t.count) % t.count, d = (t.x[i] - x) ** 2 + (t.y[i] - y) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  const i = best, along = (x - t.x[i]) * t.tx[i] + (y - t.y[i]) * t.ty[i], off = -(x - t.x[i]) * t.ty[i] + (y - t.y[i]) * t.tx[i];
  return { seg: i, s: t.s[i] + along, off };
}
/** Shortest signed difference of two track distances. */
const along = (d: number) => { const L = TRACK.length; return ((d % L) + L * 1.5) % L - L / 2; };

function grid(s: MatchState<RacerGame>) {
  const g = s.game;
  s.players.forEach((p, i) => {
    // Two cars per row behind the start line, rows 2.6 apart.
    const back = 3 + Math.floor(i / 2) * 2.6, off = i % 2 ? 1.5 : -1.5, at = trackPoint(-back, off);
    const near = locate(at.x, at.y, at.i);
    g.cars[p.id] = { id: p.id, x: at.x, y: at.y, a: at.a, v: 0, side: 0, seg: near.seg, prog: -back, boostUntil: 0, shieldUntil: 0, spinUntil: 0, wallAt: -1e9 };
  });
}

const placeOf = (g: RacerGame, id: string) => {
  const me = g.cars[id], cars = Object.values(g.cars);
  return 1 + cars.filter(c => c.id !== id && (c.finishAt !== undefined ? me.finishAt === undefined || c.finishAt < me.finishAt : me.finishAt === undefined && c.prog > me.prog)).length;
};

/** Item from a box: trailing cars get more boosts and missiles, leaders more shields. */
function drawItem(s: MatchState<RacerGame>, id: string): RacerItem {
  const count = s.players.length, behind = count > 1 ? (placeOf(s.game, id) - 1) / (count - 1) : .5;
  const weights: [RacerItem, number][] = [["boost", 2 + 2 * behind], ["gun", 2.2], ["missile", .4 + 2.6 * behind], ["shield", 2.2 - 1.4 * behind]];
  let roll = random(s) * weights.reduce((n, [, w]) => n + w, 0);
  for (const [item, w] of weights) { roll -= w; if (roll <= 0) return item; }
  return "boost";
}

function drive(s: MatchState<RacerGame>, p: MatchPlayer, c: Car, h: number) {
  const now = s.time, input = inputOfPlayer(s, p), done = c.finishAt !== undefined;
  const boost = now < c.boostUntil;
  if (now < c.spinUntil) {
    // Spinning: no grip and no control until the car catches itself.
    c.a = wrapAngle(c.a + NR.spinRate * h); c.v -= c.v * 2.2 * h;
  } else {
    const gas = done ? false : input.ha, brake = done ? c.v > 2 : input.hb, steer = done ? 0 : clamp(input.x, -1, 1);
    if (gas) c.v += (c.v < 0 ? NR.brake : boost ? NR.boostAccel : NR.accel) * h;
    else if (brake) c.v = c.v > .5 ? c.v - NR.brake * h : Math.max(-NR.reverse, c.v - NR.accel * .6 * h);
    else c.v -= c.v * NR.coast * h;
    if (boost) c.v = Math.max(c.v, NR.maxSpeed);
    const limit = boost ? NR.boostSpeed : NR.maxSpeed;
    if (c.v > limit) c.v = Math.max(limit, c.v - 20 * h);
    // Steering bites with speed and a little less at top speed; reversing turns the other way.
    const grip = clamp(Math.abs(c.v) / 5, 0, 1) * (1 - .3 * clamp(Math.abs(c.v) / NR.maxSpeed, 0, 1));
    const turn = steer * NR.turn * grip * Math.sign(c.v);
    c.a = wrapAngle(c.a + turn * h);
    // Hard turns at speed make the car slide outwards a little; tyres catch it again.
    c.side += (-turn * Math.abs(c.v) * .12 - c.side) * Math.min(1, NR.grip * h);
  }
  const ca = Math.cos(c.a), sa = Math.sin(c.a);
  c.x += (ca * c.v - sa * c.side) * h; c.y += (sa * c.v + ca * c.side) * h;
  const near = locate(c.x, c.y, c.seg), limit = NR.halfWidth - NR.car;
  // Progress grows by the distance moved along the centre line (wrapped at the start line).
  c.prog += along(near.s - (((c.prog % TRACK.length) + TRACK.length) % TRACK.length));
  c.seg = near.seg;
  if (Math.abs(near.off) > limit) {
    // Wall: back onto the track, speed lost by the angle of impact, nose turned along the wall.
    const push = Math.abs(near.off) - limit, sign = Math.sign(near.off), t = TRACK;
    c.x -= -t.ty[c.seg] * push * sign; c.y -= t.tx[c.seg] * push * sign;
    const dir = Math.atan2(t.ty[c.seg], t.tx[c.seg]), diff = wrapAngle(c.a - dir), facing = Math.abs(diff) < Math.PI / 2 ? dir : wrapAngle(dir + Math.PI);
    const impact = Math.abs(Math.sin(wrapAngle(c.a - facing)));
    c.v *= 1 - (1 - NR.wallKeep) * Math.min(1, impact * 1.6 + .15);
    c.a = wrapAngle(c.a - wrapAngle(c.a - facing) * NR.wallTurn); c.side *= .3;
    if (s.time - c.wallAt > 400) emit(s, "wall", "", [c.id]);
    c.wallAt = s.time;
  }
}

function fire(s: MatchState<RacerGame>, c: Car, kind: Shot["kind"]) {
  const g = s.game, nose = NR.car + .4, x = c.x + Math.cos(c.a) * nose, y = c.y + Math.sin(c.a) * nose;
  const shot: Shot = { id: g.nextId++, kind, owner: c.id, x, y, a: c.a, born: s.time, seg: c.seg };
  if (kind === "missile") {
    // Locks onto the next car ahead in the race (not the shooter's own position).
    const ahead = Object.values(g.cars).filter(o => o.id !== c.id && o.finishAt === undefined && o.prog > c.prog).sort((a, b) => a.prog - b.prog)[0];
    if (ahead) shot.target = ahead.id;
  }
  g.shots.push(shot);
  emit(s, kind === "missile" ? "missile" : "shot", kind === "missile" ? "Lenkrakete!" : "", [c.id]);
}

function moveShots(s: MatchState<RacerGame>, h: number) {
  const g = s.game, gone = new Set<number>();
  for (const shot of g.shots) {
    const life = shot.kind === "missile" ? NR.missileMs : NR.shotMs;
    if (s.time - shot.born > life) { gone.add(shot.id); continue; }
    if (shot.kind === "missile") {
      // Follows the track; close to its target it heads straight for it.
      const target = shot.target ? g.cars[shot.target] : undefined;
      let tx: number, ty: number;
      if (target && target.finishAt === undefined && dist(target.x, target.y, shot.x, shot.y) < NR.missileLock) { tx = target.x; ty = target.y; }
      else { const ahead = trackPoint(TRACK.s[shot.seg] + 6); tx = ahead.x; ty = ahead.y; }
      const want = Math.atan2(ty - shot.y, tx - shot.x), diff = wrapAngle(want - shot.a);
      shot.a = wrapAngle(shot.a + clamp(diff, -NR.missileTurn * h, NR.missileTurn * h));
    }
    const speed = shot.kind === "missile" ? NR.missileSpeed : NR.shotSpeed;
    shot.x += Math.cos(shot.a) * speed * h; shot.y += Math.sin(shot.a) * speed * h;
    const near = locate(shot.x, shot.y, shot.seg); shot.seg = near.seg;
    // Shots hit the walls; missiles fly above them.
    if (shot.kind === "shot" && Math.abs(near.off) > NR.halfWidth) { gone.add(shot.id); continue; }
    for (const c of Object.values(g.cars)) {
      if (c.finishAt !== undefined || (c.id === shot.owner && s.time - shot.born < NR.ownGrace) || dist(c.x, c.y, shot.x, shot.y) > NR.car + .35) continue;
      gone.add(shot.id);
      if (s.time < c.shieldUntil) { emit(s, "block", "Abgewehrt!", [c.id, shot.owner]); break; }
      c.spinUntil = s.time + (shot.kind === "missile" ? NR.missileSpinMs : NR.spinMs); c.v *= .3; c.boostUntil = 0;
      emit(s, "hit", shot.kind === "missile" ? "Rakete!" : "Getroffen!", [c.id, shot.owner]);
      break;
    }
  }
  if (gone.size) g.shots = g.shots.filter(shot => !gone.has(shot.id));
}

export const neonRacer: MatchModule<RacerGame> = {
  id: "racer",
  meta: {
    name: "Neon Racer", seconds: NR.maxMs / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Rennen auf der Neon-Strecke, drei Runden. Unten links lenkst du mit dem Lenkrad (drehen und halten), rechts gibst du Gas oder bremst – bremst du im Stand weiter, fährst du rückwärts. Fahr durch die leuchtenden Kisten: Turbo, Blaster (drei Schüsse geradeaus), Lenkrakete (verfolgt das Auto vor dir) oder Schild (fünf Sekunden geschützt). Tippe den Item-Knopf zum Einsetzen. Treffer lassen das Auto schleudern, Wände bremsen. Wer zuerst drei Runden schafft, gewinnt; danach bleiben den anderen 15 Sekunden.",
    controls: "Lenkrad drehen · Gas und Bremse halten · Item-Knopf tippen.",
    look: { icon: "⚑", action: "Drei Runden, alles erlaubt", hint: "Lenkrad · Gas/Bremse · Item", goal: "Zuerst drei Runden im Ziel" }
  },
  create(s) {
    s.game = { cars: {}, shots: [], boxes: [], nextId: 1, decided: false };
    grid(s);
    for (const row of NR.boxRows) for (const lane of NR.boxLanes) { const at = trackPoint(row * TRACK.length, lane); s.game.boxes.push({ id: s.game.nextId++, x: at.x, y: at.y, readyAt: 0 }); }
    return s.game;
  },
  step(s, dt) {
    const g = s.game, h = dt / NR.substeps;
    for (let k = 0; k < NR.substeps; k++) {
      for (const p of s.players) if (!p.gone) drive(s, p, g.cars[p.id], h);
      // Car contact: equal cars push apart and both lose a little speed.
      const cars = s.players.filter(p => !p.gone).map(p => g.cars[p.id]);
      for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j], d = dist(a.x, a.y, b.x, b.y), min = NR.car * 2;
        if (d >= min || d < 1e-6) continue;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        a.v *= .97; b.v *= .97;
      }
      moveShots(s, h);
    }
    for (const p of s.players) {
      const c = g.cars[p.id];
      if (p.gone || c.finishAt !== undefined) continue;
      if (c.prog >= NR.laps * TRACK.length) {
        c.finishAt = s.time; g.firstFinish ??= s.time; c.item = undefined;
        emit(s, "finish", placeOf(g, p.id) === 1 ? "Sieg!" : "Im Ziel!", [p.id]);
        continue;
      }
      for (const box of g.boxes) if (s.time >= box.readyAt && !c.item && dist(box.x, box.y, c.x, c.y) < NR.boxRadius + NR.car) {
        box.readyAt = s.time + NR.boxRespawn; c.item = drawItem(s, p.id); c.ammo = c.item === "gun" ? NR.shots : undefined;
        emit(s, "item", "", [p.id]);
      }
    }
    const racing = s.players.filter(p => !p.gone && g.cars[p.id].finishAt === undefined);
    if (!racing.length || (g.firstFinish !== undefined && s.time >= g.firstFinish + NR.finishGrace) || s.time >= NR.maxMs) { g.decided = true; s.done = true; }
  },
  press(s, p, kind) {
    const c = s.game.cars[p.id];
    if (kind !== "a" || !c?.item || c.finishAt !== undefined || p.gone || s.time < c.spinUntil) return;
    if (c.item === "boost") { c.boostUntil = s.time + NR.boostMs; c.item = undefined; emit(s, "boost", "Turbo!", [p.id]); }
    else if (c.item === "shield") { c.shieldUntil = s.time + NR.shieldMs; c.item = undefined; emit(s, "shield", "Schild!", [p.id]); }
    else if (c.item === "missile") { fire(s, c, "missile"); c.item = undefined; }
    else if (s.time - (c.lastShot ?? -1e9) >= NR.shotGap) {
      fire(s, c, "shot"); c.lastShot = s.time; c.ammo = (c.ammo ?? 1) - 1;
      if (c.ammo <= 0) { c.item = undefined; c.ammo = undefined; }
    }
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => {
      const c = g.cars[p.id], lap = Math.max(1, Math.min(NR.laps, Math.floor(c.prog / TRACK.length) + 1)), percent = Math.round(clamp(c.prog / (NR.laps * TRACK.length), 0, 1) * 100);
      return { id: p.id, score: percent, detail: c.finishAt !== undefined ? `Im Ziel nach ${(c.finishAt / 1000).toFixed(1)} s` : `Runde ${lap}/${NR.laps} · ${percent} %`,
        keys: [presence(p), c.finishAt !== undefined ? 1 : 0, c.finishAt !== undefined ? -c.finishAt : 0, Math.round(c.prog * 10)] };
    }));
  },
  finish(s) { s.game.decided = true; },
  bot(s, id) {
    const g = s.game, me = g.cars[id];
    if (!me || me.finishAt !== undefined) return {};
    // Pure pursuit along the centre line, each bot in its own lane; brake for sharp corners.
    const lane = ((hash(id) % 5) - 2) * .6, look = 4.5 + Math.abs(me.v) * .32, at = trackPoint(TRACK.s[me.seg] + look, lane);
    const diff = wrapAngle(Math.atan2(at.y - me.y, at.x - me.x) - me.a), wobble = ((hash(`${id}:${Math.floor(s.time / 700)}`) % 100) / 100 - .5) * .25;
    const steer = clamp(diff * 2.4 + wobble, -1, 1), corner = Math.abs(diff);
    const intent = { x: steer, y: 0, ha: !(corner > .7 && me.v > 9), hb: corner > 1.1 && me.v > 6, pressA: false };
    if (me.item && s.time >= me.spinUntil) {
      const ahead = Object.values(g.cars).filter(o => o.id !== id && o.finishAt === undefined && o.prog > me.prog && o.prog - me.prog < 30);
      const inLine = ahead.some(o => dist(o.x, o.y, me.x, me.y) < 14 && Math.abs(wrapAngle(Math.atan2(o.y - me.y, o.x - me.x) - me.a)) < .15);
      const roll = hash(`${id}:${Math.floor(s.time / 500)}`) % 4 === 0;
      intent.pressA = me.item === "boost" ? corner < .2 && roll : me.item === "shield" ? roll : me.item === "missile" ? ahead.length > 0 && roll : inLine;
    }
    return intent;
  }
};

/** Same race in landscape, steered by tilting the phone like a steering wheel (rules unchanged). */
export const neonRacerTilt: MatchModule<RacerGame> = {
  ...neonRacer,
  id: "racertilt",
  meta: {
    ...neonRacer.meta,
    name: "Neon Racer – Kippen",
    instruction: "Neon Racer im Querformat: Halte das Handy quer wie ein Lenkrad und kippe es nach links oder rechts zum Lenken. Rechter Daumen: Gas, linker Daumen: Bremse (im Stand rückwärts). Oben in der Mitte setzt du das Item aus den leuchtenden Kisten ein: Turbo, Blaster (drei Schüsse), Lenkrakete oder Schild. Ohne Bewegungssensor lenkst du mit den Pfeiltasten. Wer zuerst drei Runden schafft, gewinnt; danach bleiben den anderen 15 Sekunden.",
    controls: "Handy quer · kippen zum Lenken · rechts Gas, links Bremse · Item oben.",
    look: { icon: "↻", action: "Kippen statt Lenkrad", hint: "Quer halten · kippen · Gas/Bremse", goal: "Zuerst drei Runden im Ziel" }
  }
};
