import { bounce, ringModule, type Fighter, type RingGame, type RingItem, type RingItemKind, type RingRules } from "./ringCore";
import { dist, wrapAngle } from "./geometry";
import { emit, random, type MatchState } from "./types";

/** Bumper Mayhem – bumper cars with heading, inertia, top speed and a turbo. */
/**
 * restitution: bounciness of ordinary contact (bouncy rubber, feedback Nov. 2026: every
 * contact pushes both cars apart by at least `minBounce` m/s, `bounceGain` × closing speed);
 * kick: speed of the rammed car along the contact (× closing speed, turboKick
 * with turbo, capped by maxKnock); stunBase + stunMs per unit of closing speed
 * (capped by stunMax): spin-out without grip, sliding with `slide` per step; the rammer
 * rebounds with `rebound` × closing speed instead of stopping;
 * coast: rolling friction per step without throttle (cars come to rest instead
 * of drifting); overspeed: smooth slow-down per step above the speed limit.
 */
export const BUMPER = { body: .55, accel: 7, maxSpeed: 4.4, turboSpeed: 8, turboMs: 800, turn: 4.2, grip: .25, drag: .985, coast: .92, overspeed: .88, restitution: .95, kick: 1.3, turboKick: 1.75, maxKnock: 14, hitterKeeps: .25, stunBase: 220, stunMs: 55, stunMax: 700, slide: .93, spinRate: 6, hard: 2.5, cooldown: 4000, orbit: 2.8, postRadius: .6, spin: .6, minBounce: 2.6, bounceGain: .6, rebound: .35 } as const;
/**
 * Item boxes: one appears every `every` ms (from `first`), at most `max` on the
 * rink, collected by driving through. Mega: giant car (body × `megaScale`)
 * that knocks harder and barely moves when hit. Oil: a slick under the car
 * (armed after `oilArm`) spins out every other car that drives over it.
 * Wave: pushes nearby cars away at once. Knock-offs by an item are credited.
 */
export const ITEMS = { first: 4000, every: [6000, 9000] as const, max: 2, pick: .35, spread: .62,
  megaMs: 6000, megaScale: 1.45, megaKick: 1.5, megaTake: .45,
  oilMs: 8000, oilRadius: .85, oilArm: 900, oilStun: 650, oilSpin: 3,
  waveRadius: 2.8, waveKnock: 7.5, waveStun: 350 } as const;
const KINDS: RingItemKind[] = ["mega", "oil", "wave"];
const turbo = (f: Fighter, now: number) => now < f.actionUntil;
const big = (f: Fighter, now: number) => now < (f.bigUntil ?? 0);
const bodyOf = (f: Fighter, now: number) => BUMPER.body * (big(f, now) ? ITEMS.megaScale : 1);

/** Items and oil: spawn, pick-up and effects (deterministic, in seat order). */
function extras(s: MatchState<RingGame>) {
  const g = s.game, cars = s.players.map(p => g.fighters[p.id]).filter(f => f.alive && !f.out);
  g.items ??= []; g.slicks ??= []; g.nextId ??= 1; g.nextItem ??= ITEMS.first;
  g.slicks = g.slicks.filter(o => s.time < o.until);
  if (s.time >= g.nextItem && !g.sudden) {
    g.nextItem = s.time + ITEMS.every[0] + random(s) * (ITEMS.every[1] - ITEMS.every[0]);
    if (g.items.length < ITEMS.max) {
      const a = random(s) * Math.PI * 2, r = Math.sqrt(random(s)) * g.radius * ITEMS.spread;
      g.items.push({ id: g.nextId++, kind: KINDS[Math.floor(random(s) * KINDS.length)], x: Math.cos(a) * r, y: Math.sin(a) * r });
      emit(s, "item", "", []);
    }
  }
  for (const f of cars) {
    const item: RingItem | undefined = g.items.find(i => dist(i.x, i.y, f.x, f.y) < bodyOf(f, s.time) + ITEMS.pick);
    if (!item) continue;
    g.items = g.items.filter(i => i !== item);
    if (item.kind === "mega") { f.bigUntil = s.time + ITEMS.megaMs; emit(s, "mega", "Riesenauto!", [f.id]); }
    else if (item.kind === "oil") { g.slicks.push({ id: g.nextId++, owner: f.id, x: f.x, y: f.y, until: s.time + ITEMS.oilMs, armedAt: s.time + ITEMS.oilArm }); emit(s, "oil", "Ölfleck gelegt!", [f.id]); }
    else {
      for (const o of cars) {
        const d = dist(o.x, o.y, f.x, f.y);
        if (o === f || d > ITEMS.waveRadius || s.time < o.shieldUntil) continue;
        const nx = d > 1e-6 ? (o.x - f.x) / d : 1, ny = d > 1e-6 ? (o.y - f.y) / d : 0, k = ITEMS.waveKnock * (big(o, s.time) ? ITEMS.megaTake : 1) * (1 - d / ITEMS.waveRadius * .4);
        o.vx += nx * k; o.vy += ny * k; o.stunUntil = Math.max(o.stunUntil, s.time + ITEMS.waveStun); o.lastHitBy = f.id; o.lastHitAt = s.time;
      }
      emit(s, "wave", "Schockwelle!", [f.id]);
    }
  }
  // Oil: every other car that touches an armed slick spins out (the owner's own slick is harmless once).
  for (const f of cars) for (const o of g.slicks) {
    if (s.time < o.armedAt || s.time < f.stunUntil || s.time < f.shieldUntil || dist(o.x, o.y, f.x, f.y) > ITEMS.oilRadius + bodyOf(f, s.time) * .3) continue;
    if (o.owner === f.id) continue;
    f.stunUntil = s.time + ITEMS.oilStun; f.vx *= 1.1; f.vy *= 1.1;
    if (g.fighters[o.owner]) { f.lastHitBy = o.owner; f.lastHitAt = s.time; }
    emit(s, "slip", "Ausgerutscht!", [f.id, o.owner]);
  }
}

/** The Bumper rules (exported for the rule tests); the module wraps them with the ring core. */
export const BUMPER_RULES: RingRules = {
  id: "bumpercars", name: "Bumper Mayhem",
  instruction: "Ramm die anderen Autoscooter über den Rand, nutze Turbo und Item-Kisten. Jeder hat 3 Leben – wer zuletzt fährt, gewinnt.",
  rules: "Lenke dein Autoscooter-Fahrzeug mit dem Stick in die gewünschte Richtung, es beschleunigt von selbst. Der Turbo macht dich kurz viel schneller und deine Rammstöße härter (alle 4 Sekunden). Wer hart gerammt wird, schleudert ohne Kontrolle davon. Fahr durch Item-Kisten: Riesenauto (6 Sekunden groß und schwer), Ölfleck (andere schleudern darauf) oder Schockwelle (stößt alle in der Nähe weg). Ramme Gegner über den Rand: +2 pro Ring-Out. Das abgestürzte Auto kehrt allein zurück; sind nur noch zwei übrig, starten beide neu von ihren Startplätzen. Drehende Pfosten werfen alle zurück. Jeder hat 3 Leben, ab Sekunde 45 schrumpft die Arena. Letzter gewinnt, nach 75 Sekunden zählen Leben, dann Ring-Outs.",
  controls: "Stick: Fahrtrichtung · Knopf: Turbo.",
  look: { icon: "⛐", action: "Rammen erlaubt!", hint: "Stick lenken · Knopf Turbo · Item-Kisten einsammeln", goal: "Als Letzter auf der Fläche" },
  radius: 6, minRadius: 3.4, shrinkFrom: 45000, shrinkTo: 75000,
  body: BUMPER.body, lives: 3, respawn: 2000, restart: "duel", shield: 1500, credit: 3000,
  regular: 75000, suddenMax: 20000, suddenRadius: 3.4, actionCooldown: BUMPER.cooldown,
  drive(f, input, dt, now) {
    // Spun out after a hard hit: no grip, no throttle, the car spins and slides to a stop.
    if (now < f.stunUntil) { f.vx *= BUMPER.slide; f.vy *= BUMPER.slide; f.heading = wrapAngle(f.heading + BUMPER.spinRate * dt); return; }
    const throttle = Math.min(1, Math.hypot(input.x, input.y));
    if (throttle > .1) {
      const diff = wrapAngle(Math.atan2(input.y, input.x) - f.heading);
      f.heading = wrapAngle(f.heading + Math.max(-BUMPER.turn * dt, Math.min(BUMPER.turn * dt, diff)));
    }
    const hx = Math.cos(f.heading), hy = Math.sin(f.heading), boost = turbo(f, now);
    const push = (boost ? 1.6 : throttle) * BUMPER.accel * dt;
    f.vx += hx * push; f.vy += hy * push;
    // Tyres grip sideways, so cars slide only a little.
    const forward = f.vx * hx + f.vy * hy, side = -f.vx * hy + f.vy * hx;
    const keptSide = side * (1 - BUMPER.grip), drag = boost || throttle > .1 ? BUMPER.drag : BUMPER.coast;
    f.vx = (hx * forward - hy * keptSide) * drag; f.vy = (hy * forward + hx * keptSide) * drag;
    // Above the limit (after a knock or the turbo) the car slows down smoothly instead of stopping dead.
    const limit = boost ? BUMPER.turboSpeed : BUMPER.maxSpeed, speed = Math.hypot(f.vx, f.vy);
    if (speed > limit) { const k = Math.max(limit / speed, BUMPER.overspeed); f.vx *= k; f.vy *= k; }
  },
  action(f, now) { f.actionUntil = now + BUMPER.turboMs; },
  bodyOf,
  extras,
  collide(a, b, now) {
    const { nx, ny, closing } = bounce(a, b, (bodyOf(a, now) + bodyOf(b, now)) / 2, BUMPER.restitution, now, now < a.shieldUntil, now < b.shieldUntil);
    if (closing <= 0) return undefined;
    // Every contact bounces: both cars are pushed apart, a giant car takes less of it.
    const push = Math.max(BUMPER.minBounce, closing * BUMPER.bounceGain), takeA = big(a, now) ? ITEMS.megaTake : 1, takeB = big(b, now) ? ITEMS.megaTake : 1;
    a.vx -= nx * push * takeA * .5; a.vy -= ny * push * takeA * .5;
    b.vx += nx * push * takeB * .5; b.vy += ny * push * takeB * .5;
    if (closing <= BUMPER.hard) return undefined;
    // The rammer (who pushed harder) launches the other car along the contact and nearly stops itself.
    const victim = b.lastHitBy === a.id && b.lastHitAt === now ? b : a, hitter = victim === a ? b : a, sign = victim === b ? 1 : -1;
    // A giant car hits harder and takes less.
    const mass = (big(hitter, now) ? ITEMS.megaKick : 1) * (big(victim, now) ? ITEMS.megaTake : 1);
    const kick = Math.min(BUMPER.maxKnock, closing * BUMPER.kick * (turbo(hitter, now) ? BUMPER.turboKick : 1) * mass);
    const ux = nx * sign, uy = ny * sign, along = victim.vx * ux + victim.vy * uy;
    if (along < kick) { victim.vx += ux * (kick - along); victim.vy += uy * (kick - along); }
    if (!big(victim, now)) victim.stunUntil = now + Math.min(BUMPER.stunMax, BUMPER.stunBase + closing * BUMPER.stunMs);
    hitter.vx = hitter.vx * BUMPER.hitterKeeps - ux * closing * BUMPER.rebound; hitter.vy = hitter.vy * BUMPER.hitterKeeps - uy * closing * BUMPER.rebound;
    return victim;
  },
  obstacles: () => [0, 1].map(i => ({ id: i, x: Math.cos(i * Math.PI) * BUMPER.orbit, y: Math.sin(i * Math.PI) * BUMPER.orbit, r: BUMPER.postRadius, angle: i * Math.PI })),
  moveObstacles(g, time) {
    for (const o of g.obstacles) { o.angle = o.id * Math.PI + time / 1000 * BUMPER.spin; o.x = Math.cos(o.angle) * Math.min(BUMPER.orbit, g.radius - 1); o.y = Math.sin(o.angle) * Math.min(BUMPER.orbit, g.radius - 1); }
  },
  bot(s, me) {
    const g = s.game, others = Object.values(g.fighters).filter(f => f.alive && !f.out && f.id !== me.id);
    const r = Math.hypot(me.x, me.y);
    if (r > g.radius - 1.4 || !others.length) return { x: -me.x / (r || 1), y: -me.y / (r || 1), act: false };
    // A close item box first.
    const item = (g.items ?? []).find(i => dist(i.x, i.y, me.x, me.y) < 2.4);
    if (item) { const d = dist(item.x, item.y, me.x, me.y) || 1; return { x: (item.x - me.x) / d, y: (item.y - me.y) / d, act: false }; }
    const target = others.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy) || 1;
    const aligned = Math.cos(Math.atan2(dy, dx) - me.heading) > .92;
    return { x: dx / d, y: dy / d, act: aligned && d < 3 && s.time - me.actionAt >= BUMPER.cooldown };
  }
};
export const bumperMayhem = ringModule(BUMPER_RULES);
