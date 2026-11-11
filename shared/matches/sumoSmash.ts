import { bounce, ringModule, type Fighter } from "./ringCore";

/** Sumo Smash – free movement, a forward dash with 3 s cooldown and strong knockback. */
export const SUMO = { body: .5, speed: 3.2, accel: .22, dash: 8.5, dashMs: 220, knock: 9, cooldown: 3000 } as const;
const dashing = (f: Fighter, now: number) => now < f.actionUntil;

export const sumoSmash = ringModule({
  id: "sumo", name: "Sumo Smash",
  instruction: "Bewege deinen Sumo mit dem Stick. Der Stoß-Knopf schiebt dich nach vorn; wer getroffen wird, fliegt zurück. Danach braucht der Stoß 3 Sekunden. Wer aus dem Ring fällt, verliert eines von 3 Leben; wer den Ring-Out verursacht, bekommt +2. Ab Sekunde 40 schrumpft der Ring. Letzter im Ring gewinnt, nach 75 Sekunden zählen Leben, dann Ring-Outs.",
  controls: "Stick: bewegen · Knopf: Stoß nach vorn.",
  look: { icon: "◍", action: "Schieb sie vom Podest", hint: "Stick bewegen · Knopf Stoß", goal: "Als Letzter im Ring stehen" },
  radius: 5.5, minRadius: 3.2, shrinkFrom: 40000, shrinkTo: 75000,
  body: SUMO.body, lives: 3, respawn: 2000, shield: 1500, credit: 3000,
  regular: 75000, suddenMax: 20000, suddenRadius: 3, actionCooldown: SUMO.cooldown,
  drive(f, input, dt, now) {
    if (Math.hypot(input.x, input.y) > .1) f.heading = Math.atan2(input.y, input.x);
    if (dashing(f, now)) return;
    f.vx += (input.x * SUMO.speed - f.vx) * SUMO.accel; f.vy += (input.y * SUMO.speed - f.vy) * SUMO.accel;
    void dt;
  },
  action(f, now) { f.vx = Math.cos(f.heading) * SUMO.dash; f.vy = Math.sin(f.heading) * SUMO.dash; f.actionUntil = now + SUMO.dashMs; },
  collide(a, b, now) {
    const shieldA = now < a.shieldUntil, shieldB = now < b.shieldUntil;
    const { nx, ny } = bounce(a, b, SUMO.body, .4, now, shieldA, shieldB);
    // A dash into the opponent turns into a knockback impulse along the contact normal.
    for (const [hitter, victim, sign] of [[a, b, 1], [b, a, -1]] as const) {
      if (!dashing(hitter, now) || (victim === b ? shieldB : shieldA)) continue;
      const toward = (hitter.vx * nx + hitter.vy * ny) * sign;
      if (toward <= .5) continue;
      victim.vx = nx * sign * SUMO.knock; victim.vy = ny * sign * SUMO.knock;
      hitter.vx *= .25; hitter.vy *= .25; hitter.actionUntil = now;
      victim.lastHitBy = hitter.id; victim.lastHitAt = now;
      return victim;
    }
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
});
