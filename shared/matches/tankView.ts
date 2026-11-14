import { dist, segmentHitsRect } from "./geometry";
import { driveTowards, tankTrouble, TT, wallRects, type TankGame } from "./tankTrouble";
import { hash, type MatchModule, type MatchState } from "./types";

/**
 * Tank Trouble – Turmsicht: the same rules as Tank Trouble, but every device
 * only learns what its own tank can see. Opponents, their wrecks and bullets
 * are part of a viewer's snapshot only with a free line of sight (no wall of
 * any kind in between) and within `TV.sight`. The authority filters this, so
 * hidden tanks never reach the device – and bots play by the same view.
 */
export const TV = { sight: 6 } as const;

type Point = { x: number; y: number };
/** Free line of sight between two field points within the sight range. */
export function canSee(walls: ReturnType<typeof wallRects>, from: Point, to: Point) {
  return dist(from.x, from.y, to.x, to.y) <= TV.sight && !walls.some(w => segmentHitsRect(from.x, from.y, to.x, to.y, w));
}

export const tankView: MatchModule<TankGame> = {
  ...tankTrouble,
  id: "tankview",
  meta: {
    ...tankTrouble.meta,
    name: "Tank Trouble – Turmsicht",
    instruction: "Tank Trouble aus der Sicht deines Panzers: Die Kamera fährt hinter dir her, Gegner und Kugeln siehst du nur, wenn keine Mauer dazwischen ist (bis 6 Meter). Stick nach oben fährt dorthin, wohin die Kamera schaut. Ziehe rechts zum Zielen und lass los, um zu schießen. Kugeln prallen zweimal von festen Mauern ab, Ziegelmauern gehen nach zwei Treffern kaputt. Jeder Panzer hat 3 Treffer. Wer zuerst 7 Abschüsse hat oder nach 90 Sekunden die meisten, gewinnt.",
    controls: "Links fahren (Kamera-Richtung) · rechts ziehen, loslassen zum Schießen.",
    look: { icon: "◉", action: "Jagd im Labyrinth – ohne Überblick", hint: "Stick fahren · rechts zielen und loslassen", goal: "7 Abschüsse oder die meisten nach 90 s" }
  },
  view(s, viewer) {
    const g = s.game, me = g.tanks[viewer];
    // Spectators keep the full picture; players see from their tank (or its wreck).
    if (!me) return;
    const walls = wallRects(g);
    for (const id of Object.keys(g.tanks)) if (id !== viewer && !canSee(walls, me, g.tanks[id])) delete g.tanks[id];
    g.bullets = g.bullets.filter(b => b.owner === viewer || canSee(walls, me, b));
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
