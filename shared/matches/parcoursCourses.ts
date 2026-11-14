/**
 * Hindernis-Parcours: fixed course geometry per run. Everything here is pure
 * data shared by the authority, bots and rendering; random parts (which doors
 * break, which tiles carry) are drawn at match start and stay secret in the
 * state. Coordinates: x sideways, y up, z forward along the course (metres).
 */
export interface Motion { axis: "x" | "y" | "z"; amp: number; period: number; phase: number }
export type Look = "floor" | "wall" | "door" | "pusher" | "belt" | "step" | "seesaw" | "tile" | "roller" | "ledge" | "finish";
export interface Box {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  look: Look;
  /** Conveyor speed along z (negative = backwards). */
  belt?: number;
  /** Oscillating movement (kinematic: pushes and carries racers). */
  move?: Motion;
  /** Index of a door panel (breaks only if it is one of the real doors). */
  door?: number;
  /** Index of a hidden-path tile (carries only if it is on the path). */
  tile?: number;
  /** Index of a seesaw (tilts left/right under weight). */
  seesaw?: number;
}
/** Bar rotating about a vertical axis; `y0…y1` is its height band. */
export interface Sweeper { x: number; z: number; y0: number; y1: number; length: number; speed: number; phase: number }
export interface DoorRow { z: number; doors: number[]; real: number }
export interface TileRow { z: number; tiles: number[] }
export interface Course {
  id: string; name: string; width: number; finishZ: number; finishY: number; killY: number;
  boxes: Box[]; sweepers: Sweeper[];
  /** Respawn lines (z, floor height y); racers return to the last one they passed. */
  checkpoints: { z: number; y: number }[];
  doorRows: DoorRow[]; tileRows: TileRow[]; seesaws: number;
  /** Rising goo: height at match time t (ms) is start + rate · max(0, t − delay)/1000. */
  goo?: { start: number; rate: number; delay: number };
}

const floor = (z0: number, z1: number, y = 0, x0 = -5, x1 = 5, look: Look = "floor"): Box => ({ x0, x1, y0: y - 1, y1: y, z0, z1, look });
/** Stairs from height `from` to `to` between z0 and z1 (steps a racer walks up). */
function stairs(z0: number, z1: number, from: number, to: number, x0 = -5, x1 = 5): Box[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / .3)), depth = (z1 - z0) / steps;
  return Array.from({ length: steps }, (_, i) => ({ x0, x1, y0: from - 1, y1: from + (to - from) * (i + 1) / steps, z0: z0 + i * depth, z1: z0 + (i + 1) * depth, look: "step" as Look }));
}
/** A wall across the course with five door panels; `real` of them break open. */
function doorRow(boxes: Box[], rows: DoorRow[], z: number, real: number, first: number, y = 0) {
  const doors: number[] = [];
  for (let i = 0; i < 5; i++) {
    const cx = -4 + i * 2;
    boxes.push({ x0: cx - .8, x1: cx + .8, y0: y, y1: y + 2.4, z0: z, z1: z + .4, look: "door", door: first + i });
    doors.push(first + i);
    // Posts flush with the doors: no niche to get stuck in when moving along the row.
    if (i < 4) boxes.push({ x0: cx + .8, x1: cx + 1.2, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" });
  }
  boxes.push({ x0: -5.4, x1: -4.8, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" }, { x0: 4.8, x1: 5.4, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" });
  rows.push({ z, doors, real });
}

function tuerenlotto(): Course {
  const boxes: Box[] = [floor(-2, 44)], doorRows: DoorRow[] = [];
  doorRow(boxes, doorRows, 9, 3, 0);
  // Pushers sweep across between the first two rows.
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: 13, z1: 14.2, look: "pusher", move: { axis: "x", amp: 3.4, period: 2600, phase: 0 } });
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: 17, z1: 18.2, look: "pusher", move: { axis: "x", amp: 3.4, period: 2200, phase: Math.PI } });
  doorRow(boxes, doorRows, 22, 2, 5);
  // A trench to jump (or dive) over.
  boxes[0] = floor(-2, 27.5); boxes.push(floor(29.2, 52));
  doorRow(boxes, doorRows, 34, 2, 10);
  boxes.push(...stairs(39, 43, 0, 1.2), floor(43, 52, 1.2, -5, 5, "finish"));
  return { id: "tuerenlotto", name: "Türenlotto", width: 10, finishZ: 48, finishY: 1.2, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 12, y: 0 }, { z: 25, y: 0 }, { z: 30.5, y: 0 }], doorRows, tileRows: [], seesaws: 0 };
}

function kreiselkurs(): Course {
  const boxes: Box[] = [floor(-2, 26.5), floor(36, 54)];
  // Moving islands over the gap.
  for (const [z0, z1, phase] of [[27.2, 29.4, 0], [30.2, 32.4, 2], [33.2, 35.4, 4]] as const) boxes.push({ x0: -1.6, x1: 1.6, y0: -1, y1: 0, z0, z1, look: "floor", move: { axis: "x", amp: 2.6, period: 3200, phase } });
  boxes.push(...stairs(48, 50, 0, .6), floor(50, 56, .6, -5, 5, "finish"));
  const sweepers: Sweeper[] = [
    // Low bars: jump over them.
    { x: 0, z: 10, y0: .15, y1: .6, length: 4.6, speed: 1.7, phase: 0 },
    // High bars: duck under them.
    { x: 0, z: 19, y0: 1, y1: 1.4, length: 4.6, speed: -1.4, phase: .8 },
    // Pair: one low, one high, turning against each other.
    { x: -2.4, z: 42, y0: .15, y1: .6, length: 2.5, speed: 2.1, phase: 0 },
    { x: 2.4, z: 42, y0: 1, y1: 1.4, length: 2.5, speed: -2.1, phase: 1.6 }
  ];
  return { id: "kreiselkurs", name: "Kreiselkurs", width: 10, finishZ: 54, finishY: .6, killY: -8, boxes, sweepers, checkpoints: [{ z: 1, y: 0 }, { z: 15, y: 0 }, { z: 24, y: 0 }, { z: 37, y: 0 }], doorRows: [], tileRows: [], seesaws: 0 };
}

function wippenwerk(): Course {
  const boxes: Box[] = [floor(-2, 6.4)];
  // Three seesaws over the void; their tilt follows the weight on each side.
  [[7, 13], [14, 20], [21, 27]].forEach(([z0, z1], i) => boxes.push({ x0: -2.6, x1: 2.6, y0: -.5, y1: 0, z0, z1, look: "seesaw", seesaw: i }));
  boxes.push(floor(27.8, 38.3));
  // Rolling logs across the floor: jump over them.
  for (const [z, phase, period] of [[30.5, 0, 2600], [33.5, 2.1, 2100], [36.5, 4, 2900]] as const) boxes.push({ x0: -.9, x1: .9, y0: 0, y1: .55, z0: z, z1: z + .7, look: "roller", move: { axis: "x", amp: 4, period, phase } });
  // A wall too high to jump: hold on to its edge and pull up.
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 1.85, z0: 38.3, z1: 46, look: "ledge" }, floor(46, 52, 1.85, -5, 5, "finish"));
  return { id: "wippenwerk", name: "Wippenwerk", width: 10, finishZ: 49, finishY: 1.85, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 28.5, y: 0 }, { z: 39, y: 1.85 }], doorRows: [], tileRows: [], seesaws: 3 };
}

function glibberflut(): Course {
  const boxes: Box[] = [floor(-2, 6), ...stairs(6, 11, 0, 1.5)];
  boxes.push({ ...floor(11, 19, 1.5), look: "belt", belt: -3.4 });
  // Ledge up to the next level.
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 3.2, z0: 19, z1: 27, look: "ledge" });
  boxes.push({ x0: -1.1, x1: 1.1, y0: 3.2, y1: 4.4, z0: 21.5, z1: 22.7, look: "pusher", move: { axis: "x", amp: 3.5, period: 2400, phase: 0 } });
  boxes.push({ x0: -1.1, x1: 1.1, y0: 3.2, y1: 4.4, z0: 24.5, z1: 25.7, look: "pusher", move: { axis: "x", amp: 3.5, period: 2000, phase: 2 } });
  boxes.push(...stairs(27, 31, 3.2, 4.7));
  for (const [z0, z1] of [[31, 33], [34.1, 36.1], [37.2, 39.2]]) boxes.push(floor(z0, z1, 4.7, -3, 3));
  boxes.push({ ...floor(40.3, 48, 4.7), look: "belt", belt: -3.8 }, ...stairs(48, 53, 4.7, 6.2));
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 7.9, z0: 53, z1: 60, look: "ledge" });
  boxes[boxes.length - 1] = { ...boxes[boxes.length - 1], look: "finish" };
  return { id: "glibberflut", name: "Glibberflut", width: 10, finishZ: 57, finishY: 7.9, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 20, y: 3.2 }, { z: 31.5, y: 4.7 }, { z: 49, y: 5 }], doorRows: [], tileRows: [], seesaws: 0, goo: { start: -1.4, rate: .28, delay: 4000 } };
}

function geisterpfad(): Course {
  const boxes: Box[] = [floor(-2, 6.6)], tileRows: TileRow[] = [];
  // Seven rows of five tiles over the void; only one path of tiles carries.
  for (let row = 0; row < 7; row++) {
    const z = 7 + row * 2, tiles: number[] = [];
    for (let col = 0; col < 5; col++) { const x = -3.6 + col * 1.8, index = row * 5 + col; boxes.push({ x0: x - .8, x1: x + .8, y0: -.4, y1: 0, z0: z, z1: z + 1.8, look: "tile", tile: index }); tiles.push(index); }
    tileRows.push({ z, tiles });
  }
  boxes.push(floor(21.2, 40));
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: 30, z1: 31.2, look: "pusher", move: { axis: "x", amp: 3.4, period: 2300, phase: 1 } });
  boxes.push(...stairs(36, 38, 0, .6), floor(38, 44, .6, -5, 5, "finish"));
  return { id: "geisterpfad", name: "Geisterpfad", width: 10, finishZ: 42, finishY: .6, killY: -8, boxes,
    sweepers: [{ x: 0, z: 25.5, y0: .15, y1: .6, length: 4.6, speed: 1.5, phase: 0 }],
    checkpoints: [{ z: 1, y: 0 }, { z: 22, y: 0 }], doorRows: [], tileRows, seesaws: 0 };
}

export const COURSE_IDS = ["tuerenlotto", "kreiselkurs", "wippenwerk", "glibberflut", "geisterpfad"] as const;
export type CourseId = typeof COURSE_IDS[number];
const BUILDERS: Record<CourseId, () => Course> = { tuerenlotto, kreiselkurs, wippenwerk, glibberflut, geisterpfad };
const cache = new Map<CourseId, Course>();
/** The (immutable, cached) course of a run. */
export function course(id: CourseId): Course {
  let c = cache.get(id);
  if (!c) { c = BUILDERS[id](); cache.set(id, c); }
  return c;
}

/** Offset of a moving box at match time `t` (ms). */
export function offsetAt(m: Motion | undefined, t: number) { return m ? m.amp * Math.sin(2 * Math.PI * t / m.period + m.phase) : 0; }
/** World bounds of a box at time `t` (moving boxes shifted along their axis). */
export function boxAt(b: Box, t: number) {
  const d = offsetAt(b.move, t), m = b.move?.axis;
  return { x0: b.x0 + (m === "x" ? d : 0), x1: b.x1 + (m === "x" ? d : 0), y0: b.y0 + (m === "y" ? d : 0), y1: b.y1 + (m === "y" ? d : 0), z0: b.z0 + (m === "z" ? d : 0), z1: b.z1 + (m === "z" ? d : 0) };
}
/** Angle of a sweeper bar at time `t` (ms). */
export const sweeperAngle = (sw: Sweeper, t: number) => sw.phase + sw.speed * t / 1000;
/** Goo height at time `t` (ms), or −Infinity without goo. */
export const gooAt = (c: Course, t: number) => c.goo ? c.goo.start + c.goo.rate * Math.max(0, t - c.goo.delay) / 1000 : -Infinity;
