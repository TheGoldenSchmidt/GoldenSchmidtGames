import { bounce, ringModule, type Fighter, type RingRules } from "./ringCore";

/** Sumo Smash – free movement, a forward dash with 3 s cooldown and strong knockback. */
/**
 * knock: speed of a dash victim; stunMs: time the victim slides without control
 * (friction slide per 50-ms step); bump: restitution of ordinary body contact.
 */
export const SUMO = { body: .5, speed: 3.4, accel: .22, dash: 9.5, dashMs: 240, knock: 12.5, stunMs: 520, slide: .94, bump: 1, bumpStunMs: 180, cooldown: 2500 } as const;
const dashing = (f: Fighter, now: number) => now < f.actionUntil;
/** Two dashes this close in speed count as equally strong. */
const CLASH_TIE = .25;

/** The Sumo rules (exported for the rule tests); the module wraps them with the ring core. */
export const sumoRules: RingRules = {
  id: "sumo", name: "Sumo Smash",
  instruction: "Schubs die anderen mit deinem Stoß aus dem Ring. Jeder hat 3 Leben, der Ring wird kleiner – wer zuletzt drin steht, gewinnt.",
  rules: "Bewege deinen Sumo mit dem Stick. Der Stoß-Knopf schiebt dich nach vorn; wer getroffen wird, fliegt zurück. Danach braucht der Stoß 2,5 Sekunden. Wer aus dem Ring fällt, verliert eines von 3 Leben; wer den Ring-Out verursacht, bekommt +2. Im Duell zu zweit stellen sich danach beide wieder auf ihre Startplätze, sonst kehrt nur die herausgefallene Person zurück. Ab Sekunde 40 schrumpft der Ring. Letzter im Ring gewinnt, nach 75 Sekunden zählen Leben, dann Ring-Outs.",
  controls: "Stick: bewegen · Knopf: Stoß nach vorn.",
  look: { icon: "◍", action: "Schieb sie vom Podest", hint: "Stick bewegen · Knopf Stoß", goal: "Als Letzter im Ring stehen" },
  radius: 5.5, minRadius: 3.2, shrinkFrom: 40000, shrinkTo: 75000,
  body: SUMO.body, lives: 3, respawn: 2000, restart: "duel", shield: 1500, credit: 3000,
  regular: 75000, suddenMax: 20000, suddenRadius: 3, actionCooldown: SUMO.cooldown,
  drive(f, input, dt, now) {
    if (Math.hypot(input.x, input.y) > .1) f.heading = Math.atan2(input.y, input.x);
    if (dashing(f, now)) return;
    // Knocked back: no control, the body slides out with little friction.
    if (now < f.stunUntil) { f.vx *= SUMO.slide; f.vy *= SUMO.slide; return; }
    f.vx += (input.x * SUMO.speed - f.vx) * SUMO.accel; f.vy += (input.y * SUMO.speed - f.vy) * SUMO.accel;
    void dt;
  },
  action(f, now) { f.vx = Math.cos(f.heading) * SUMO.dash; f.vy = Math.sin(f.heading) * SUMO.dash; f.actionUntil = now + SUMO.dashMs; },
  collide(a, b, now) {
    const shieldA = now < a.shieldUntil, shieldB = now < b.shieldUntil;
    let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 1e-9) { dx = 1; dy = 0; d = 1; }
    const nx = dx / d, ny = dy / d;
    // A dash into the opponent (checked before any momentum exchange) becomes a knockback along the contact normal.
    // Head-on clash of two dashes: the faster one wins; equally fast dashes knock both back, so the
    // order of the player list never decides.
    const strikes = ([[a, b, 1], [b, a, -1]] as const).filter(([hitter, victim, sign]) => dashing(hitter, now)
      && !(victim === b ? shieldB : shieldA) && !(hitter === a ? shieldA : shieldB) && (hitter.vx * nx + hitter.vy * ny) * sign > .5);
    if (strikes.length === 2) {
      const speedA = a.vx * nx + a.vy * ny, speedB = -(b.vx * nx + b.vy * ny);
      if (Math.abs(speedA - speedB) < CLASH_TIE) {
        bounce(a, b, SUMO.body, 0, now, true, true);
        for (const [f, sign] of [[a, -1], [b, 1]] as const) { f.vx = nx * sign * SUMO.knock * .6; f.vy = ny * sign * SUMO.knock * .6; f.stunUntil = now + SUMO.stunMs; f.actionUntil = now; }
        return undefined;
      }
      strikes.splice(speedA > speedB ? 1 : 0, 1);
    }
    for (const [hitter, victim, sign] of strikes) {
      bounce(a, b, SUMO.body, 0, now, true, true); // only separate the bodies
      victim.vx = nx * sign * SUMO.knock; victim.vy = ny * sign * SUMO.knock; victim.stunUntil = now + SUMO.stunMs;
      hitter.vx *= .15; hitter.vy *= .15; hitter.actionUntil = now;
      victim.lastHitBy = hitter.id; victim.lastHitAt = now;
      return victim;
    }
    const { closing } = bounce(a, b, SUMO.body, SUMO.bump, now, shieldA, shieldB);
    // Even ordinary shoves take control away for a moment, so contact feels like a bump.
    if (closing > 1.5) { if (!shieldA) a.stunUntil = Math.max(a.stunUntil, now + SUMO.bumpStunMs); if (!shieldB) b.stunUntil = Math.max(b.stunUntil, now + SUMO.bumpStunMs); }
    return undefined;
  },
  bot(s, me) {
    const g = s.game, others = Object.values(g.fighters).filter(f => f.alive && !f.out && f.id !== me.id);
    const r = Math.hypot(me.x, me.y);
    if (r > g.radius - 1.1 || !others.length) return { x: -me.x / (r || 1), y: -me.y / (r || 1), act: false };
    const target = others.sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy) || 1;
    const facing = Math.cos(Math.atan2(dy, dx) - me.heading);
    return { x: dx / d, y: dy / d, act: d < 2.2 && facing > .9 && s.time - me.actionAt >= SUMO.cooldown };
  }
};
export const sumoSmash = ringModule(sumoRules);
