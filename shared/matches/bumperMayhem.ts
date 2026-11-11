import { bounce, ringModule, type Fighter } from "./ringCore";
import { wrapAngle } from "./geometry";

/** Bumper Mayhem – bumper cars with heading, inertia, top speed and a turbo. */
export const BUMPER = { body: .55, accel: 7, maxSpeed: 4.2, turboSpeed: 7.5, turboMs: 800, turn: 4.2, grip: .25, drag: .985, restitution: 1.1, cooldown: 5000, orbit: 2.8, postRadius: .6, spin: .6 } as const;
const turbo = (f: Fighter, now: number) => now < f.actionUntil;

export const bumperMayhem = ringModule({
  id: "bumpercars", name: "Bumper Mayhem",
  instruction: "Lenke dein Autoscooter-Fahrzeug mit dem Stick in die gewünschte Richtung, es beschleunigt von selbst. Der Turbo macht dich kurz viel schneller (alle 5 Sekunden). Ramme Gegner über den Rand: +2 pro Ring-Out. Drehende Pfosten werfen alle zurück. Jeder hat 3 Leben, ab Sekunde 45 schrumpft die Arena. Letzter gewinnt, nach 75 Sekunden zählen Leben, dann Ring-Outs.",
  controls: "Stick: Fahrtrichtung · Knopf: Turbo.",
  look: { icon: "⛐", action: "Rammen erlaubt!", hint: "Stick lenken · Knopf Turbo", goal: "Als Letzter auf der Fläche" },
  radius: 6, minRadius: 3.4, shrinkFrom: 45000, shrinkTo: 75000,
  body: BUMPER.body, lives: 3, respawn: 2000, shield: 1500, credit: 3000,
  regular: 75000, suddenMax: 20000, suddenRadius: 3.4, actionCooldown: BUMPER.cooldown,
  drive(f, input, dt, now) {
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
    const keptSide = side * (1 - BUMPER.grip);
    f.vx = (hx * forward - hy * keptSide) * BUMPER.drag; f.vy = (hy * forward + hx * keptSide) * BUMPER.drag;
    const limit = boost ? BUMPER.turboSpeed : BUMPER.maxSpeed, speed = Math.hypot(f.vx, f.vy);
    if (speed > limit) { f.vx *= limit / speed; f.vy *= limit / speed; }
  },
  action(f, now) { f.actionUntil = now + BUMPER.turboMs; },
  collide(a, b, now) {
    const { closing } = bounce(a, b, BUMPER.body, BUMPER.restitution, now, now < a.shieldUntil, now < b.shieldUntil);
    return closing > 4 ? (b.lastHitBy === a.id && b.lastHitAt === now ? b : a) : undefined;
  },
  obstacles: () => [0, 1].map(i => ({ id: i, x: Math.cos(i * Math.PI) * BUMPER.orbit, y: Math.sin(i * Math.PI) * BUMPER.orbit, r: BUMPER.postRadius, angle: i * Math.PI })),
  moveObstacles(g, time) {
    for (const o of g.obstacles) { o.angle = o.id * Math.PI + time / 1000 * BUMPER.spin; o.x = Math.cos(o.angle) * Math.min(BUMPER.orbit, g.radius - 1); o.y = Math.sin(o.angle) * Math.min(BUMPER.orbit, g.radius - 1); }
  },
  bot(s, me) {
    const g = s.game, others = Object.values(g.fighters).filter(f => f.alive && !f.out && f.id !== me.id);
    const r = Math.hypot(me.x, me.y);
    if (r > g.radius - 1.4 || !others.length) return { x: -me.x / (r || 1), y: -me.y / (r || 1), act: false };
    const target = others.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy) || 1;
    const aligned = Math.cos(Math.atan2(dy, dx) - me.heading) > .92;
    return { x: dx / d, y: dy / d, act: aligned && d < 3 && s.time - me.actionAt >= BUMPER.cooldown };
  }
});
