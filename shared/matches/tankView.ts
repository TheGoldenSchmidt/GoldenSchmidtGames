import { dist, segmentHitsRect, type Rect } from "./geometry";
import { driveTowards, tankTrouble, TT, wallRects, type TankGame } from "./tankTrouble";
import { hash, type MatchModule, type MatchState } from "./types";

/**
 * Tank Trouble – Turmsicht: the same rules as Tank Trouble, but every device
 * only learns what its own tank can see. The sight is the area lit from the
 * centre of the own tank (or its wreck): straight rays up to `TV.sight` that
 * stop at the first wall of any kind. Opponents, their wrecks and bullets are
 * part of a viewer's snapshot as soon as any part of their outline lies in
 * that area. The device draws the same area as light, so a hidden tank is
 * always in the dark. The authority filters, so hidden tanks never reach the
 * device – and bots play by the same view.
 */
export const TV = { sight: 6, rays: 240 } as const;

type Point = { x: number; y: number };
const free = (walls: readonly Rect[], from: Point, x: number, y: number) => dist(from.x, from.y, x, y) <= TV.sight && !walls.some(w => segmentHitsRect(from.x, from.y, x, y, w));
/**
 * True if any part of a circle of `radius` around `to` is in sight of `from`:
 * its centre, the point nearest to `from` or one of the two edge points
 * across the line of sight.
 */
export function canSee(walls: readonly Rect[], from: Point, to: Point, radius = 0) {
  if (free(walls, from, to.x, to.y)) return true;
  const d = dist(from.x, from.y, to.x, to.y);
  if (radius <= 0 || d < 1e-6) return false;
  const k = radius * .9 / d, ux = (to.x - from.x) * k, uy = (to.y - from.y) * k;
  return free(walls, from, to.x - ux, to.y - uy) || free(walls, from, to.x - uy, to.y + ux) || free(walls, from, to.x + uy, to.y - ux);
}

/** Distance along a ray from (x, y) in direction `a` to the first wall, at most `max` (slab test per wall). */
export function rayDistance(walls: readonly Rect[], x: number, y: number, a: number, max: number = TV.sight) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = max;
  for (const w of walls) {
    let t0 = 0, t1 = best, hit = true;
    for (const [d, o, lo, hi] of [[dx, x, w.x0, w.x1], [dy, y, w.y0, w.y1]] as const) {
      if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) { hit = false; break; } continue; }
      let ta = (lo - o) / d, tb = (hi - o) / d;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) { hit = false; break; }
    }
    if (hit) best = t0;
  }
  return best;
}

/** Outline of the lit area around a point: `TV.rays` ray lengths, ray i points at angle 2πi/rays. */
export function sightPolygon(walls: readonly Rect[], x: number, y: number) {
  return Array.from({ length: TV.rays }, (_, i) => rayDistance(walls, x, y, i / TV.rays * Math.PI * 2));
}

export const tankView: MatchModule<TankGame> = {
  ...tankTrouble,
  id: "tankview",
  meta: {
    ...tankTrouble.meta,
    name: "Tank Trouble – Turmsicht",
    instruction: "Tank Trouble aus der Panzerluke: Du siehst nur, was dein Scheinwerfer erfasst. Die meisten Abschüsse gewinnen (höchstens 7).",
    rules: "Tank Trouble aus der Sicht deines Panzers: Die Kamera fährt hinter dir her. Dein Panzer leuchtet den Bereich aus, den er bis 6 Meter ohne Mauer dazwischen sieht. Gegner und Kugeln erscheinen nur im hellen Bereich; wer daraus verschwindet, hinterlässt kurz eine Markierung „zuletzt gesehen“. Stick nach oben fährt dorthin, wohin die Kamera schaut. Ziehe rechts zum Zielen und lass los, um zu schießen. Kugeln prallen zweimal von festen Mauern ab, Ziegelmauern gehen nach zwei Treffern kaputt. Jeder Panzer hat 3 Treffer. Wer zuerst 7 Abschüsse hat oder nach 90 Sekunden die meisten, gewinnt.",
    controls: "Links fahren (Kamera-Richtung) · rechts ziehen, loslassen zum Schießen.",
    look: { icon: "◉", action: "Jagd im Labyrinth – ohne Überblick", hint: "Stick fahren · rechts zielen und loslassen", goal: "7 Abschüsse oder die meisten nach 90 s" }
  },
  view(s, viewer) {
    const g = s.game, me = g.tanks[viewer];
    // Spectators keep the full picture; players see from their tank (or its wreck).
    if (!me) return;
    const walls = wallRects(g);
    for (const id of Object.keys(g.tanks)) if (id !== viewer && !canSee(walls, me, g.tanks[id], TT.tank)) delete g.tanks[id];
    g.bullets = g.bullets.filter(b => b.owner === viewer || canSee(walls, me, b, TT.bullet));
  },
  bot(s: MatchState<TankGame>, id) {
    const g = s.game, me = g.tanks[id];
    if (!me?.alive) return {};
    if (Object.values(g.tanks).some(t => t.alive && t.id !== id)) return tankTrouble.bot(s, id);
    // Nobody in sight: patrol towards a cell that changes every few seconds.
    const turn = hash(`${id}:${Math.floor(s.time / 5000)}`), c = turn % TT.cols, r = Math.floor(turn / TT.cols) % TT.rows;
    const { x, y } = driveTowards(g, me, (c + .5) * TT.cell, (r + .5) * TT.cell);
    return { x, y, ax: x, ay: y };
  }
};
