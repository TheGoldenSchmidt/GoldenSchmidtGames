import { proberaum } from "./proberaumCourse";
import { quarterOf, turnBox, turnSweeper, type Quarter } from "./parcoursFrame";
/**
 * Hindernis-Parcours: fixed course geometry per run. Everything here is pure
 * data shared by the authority, bots and rendering; random parts (which doors
 * break, which tiles carry) are drawn at match start and stay secret in the
 * state. Coordinates: x sideways, y up, z forward along the course (metres).
 */
export interface Motion { axis: "x" | "y" | "z"; amp: number; period: number; phase: number }
export type Look = "floor" | "wall" | "door" | "pusher" | "belt" | "step" | "seesaw" | "tile" | "roller" | "ledge" | "finish" | "trap" | "hold";
/**
 * Box that vanishes periodically (trapdoors, changing holds): gone while the
 * cycle position is below `open`; from `from` ms on (default 0). A warning
 * shows `BLINK_WARN` ms before it opens.
 */
export interface Blink { period: number; phase: number; open: number; from?: number }
/** Wind blowing racers inside a zone (m/s drift), on for the share `on` of each period. */
export interface Wind { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; vx: number; vz: number; period: number; phase: number; on: number }
export const BLINK_WARN = 900;
export interface Box {
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number;
  look: Look;
  /** Conveyor speed along z (negative = backwards). */
  belt?: number;
  /** Conveyor speed along x (belts on stretches that run sideways). */
  beltX?: number;
  /** Oscillating movement (kinematic: pushes and carries racers). */
  move?: Motion;
  /** Index of a door panel (breaks only if it is one of the real doors). */
  door?: number;
  /** Index of a hidden-path tile (carries only if it is on the path). */
  tile?: number;
  /** Index of a seesaw (tilts left/right under weight). */
  seesaw?: number;
  blink?: Blink;
}
/** Bar rotating about a vertical axis; `y0…y1` is its height band; it starts turning at `from` ms. */
export interface Sweeper { x: number; z: number; y0: number; y1: number; length: number; speed: number; phase: number; from?: number }
export interface DoorRow { z: number; doors: number[]; real: number; /** Door centres (x). */ xs: number[] }
/**
 * Doors with a lane behind each: the front door (real or solid), the lane floor
 * (carries or is a trapdoor) and an exit door (real or solid: a dead end).
 * `through` lanes lead on, `dead` lanes end at a solid exit, `trap` lanes drop
 * the racer; the remaining front doors stay shut.
 */
export interface LaneRow { z: number; exitZ: number; lanes: { front: number; exit: number; floor: number; x: number }[]; through: number; dead: number; trap: number }
export interface TileRow { z: number; tiles: number[] }
export interface Course {
  /** Local, untimed practice world; never part of the minigame pool. */
  practice?: boolean;
  id: string; name: string; width: number; finishZ: number; finishY: number; killY: number;
  boxes: Box[]; sweepers: Sweeper[];
  /** Respawn lines (z, floor height y); racers return to the last one they passed. */
  checkpoints: { z: number; y: number; x?:number }[];
  doorRows: DoorRow[]; tileRows: TileRow[]; seesaws: number;
  /** Door rows with lanes behind them (dead ends and trapdoors); their doors are part of the door count. */
  laneRows?: LaneRow[];
  /** Rising goo: height at match time t (ms) is start + rate · s + accel · s²/2 with s = max(0, t − delay)/1000. */
  goo?: { start: number; rate: number; delay: number; accel?: number };
  winds: Wind[];
  /** Final: no checkpoints, a fall eliminates; the last ones standing win. */
  elimination?: boolean;
  /** Time limit in ms (default 120 s). */
  limitMs?: number;
  /** Strength of knocks by spinning bars (1 = normal). */
  knock?: number;
  /**
   * Winding courses: the way in the plan as corner points (axis-aligned
   * stretches). Progress, checkpoints, respawn direction, bots and the camera
   * follow it; without it a course runs straight along +z.
   */
  route?: { x: number; z: number }[];
  /** Centre of the finish line across (default 0). */
  finishX?: number;
}

const floor = (z0: number, z1: number, y = 0, x0 = -5, x1 = 5, look: Look = "floor"): Box => ({ x0, x1, y0: y - 1, y1: y, z0, z1, look });
/** Stairs from height `from` to `to` between z0 and z1 (steps a racer walks up). */
function stairs(z0: number, z1: number, from: number, to: number, x0 = -5, x1 = 5): Box[] {
  const steps = Math.max(1, Math.ceil(Math.abs(to - from) / .3)), depth = (z1 - z0) / steps;
  return Array.from({ length: steps }, (_, i) => ({ x0, x1, y0: from - 1, y1: from + (to - from) * (i + 1) / steps, z0: z0 + i * depth, z1: z0 + (i + 1) * depth, look: "step" as Look }));
}
/**
 * A wall across the course from `x0` to `x1` with `count` door panels and posts
 * between them; door indices start at `first`. Returns the door centres.
 */
function doorWall(boxes: Box[], z: number, count: number, first: number, x0 = -5, x1 = 5, y = 0) {
  const pitch = (x1 - x0) / count, post = .4, xs: number[] = [], doors: number[] = [];
  for (let i = 0; i < count; i++) {
    const cx = x0 + pitch * (i + .5);
    boxes.push({ x0: cx - pitch / 2 + post / 2, x1: cx + pitch / 2 - post / 2, y0: y, y1: y + 2.4, z0: z, z1: z + .4, look: "door", door: first + i });
    xs.push(cx); doors.push(first + i);
    // Posts flush with the doors: no niche to get stuck in when moving along the row.
    if (i < count - 1) boxes.push({ x0: cx + pitch / 2 - post / 2, x1: cx + pitch / 2 + post / 2, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" });
  }
  boxes.push({ x0: x0 - .6, x1: x0 + post / 2, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" }, { x0: x1 - post / 2, x1: x1 + .6, y0: y, y1: y + 3, z0: z, z1: z + .4, look: "wall" });
  return { xs, doors };
}
/** A wall across the course with door panels; `real` of them break open. */
function doorRow(boxes: Box[], rows: DoorRow[], z: number, real: number, first: number, count = 5, x0 = -5, x1 = 5) {
  const { xs, doors } = doorWall(boxes, z, count, first, x0, x1);
  rows.push({ z, doors, real, xs });
  return first + count;
}
/**
 * Door row with a lane behind every door: front doors at `z`, lanes `depth`
 * metres long (walls between them, floor as secret tiles), exit doors at the
 * end. Uses `count` doors twice (front and exit) and `count` tiles.
 */
function laneRow(boxes: Box[], rows: LaneRow[], z: number, depth: number, count: number, firstDoor: number, firstTile: number, mix: { through: number; dead: number; trap: number }, x0 = -6, x1 = 6) {
  const front = doorWall(boxes, z, count, firstDoor, x0, x1), exitZ = z + .4 + depth, exit = doorWall(boxes, exitZ, count, firstDoor + count, x0, x1), pitch = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const cx = front.xs[i];
    // The lane floor looks like any floor; only the authority knows whether it carries.
    boxes.push({ x0: cx - pitch / 2, x1: cx + pitch / 2, y0: -.4, y1: 0, z0: z + .4, z1: exitZ, look: "floor", tile: firstTile + i });
    if (i < count - 1) boxes.push({ x0: cx + pitch / 2 - .2, x1: cx + pitch / 2 + .2, y0: 0, y1: 2.4, z0: z + .4, z1: exitZ, look: "wall" });
  }
  boxes.push({ x0: x0 - .6, x1: x0 + .2, y0: 0, y1: 2.4, z0: z + .4, z1: exitZ, look: "wall" }, { x0: x1 - .2, x1: x1 + .6, y0: 0, y1: 2.4, z0: z + .4, z1: exitZ, look: "wall" });
  rows.push({ z, exitZ, lanes: front.xs.map((x, i) => ({ front: front.doors[i], exit: exit.doors[i], floor: firstTile + i, x })), ...mix });
  return { door: firstDoor + 2 * count, tile: firstTile + count };
}

function tuerenlotto(): Course {
  const boxes: Box[] = [], doorRows: DoorRow[] = [], laneRows: LaneRow[] = [], W = 6;
  // Floors leave out the lanes (their floors are secret tiles) and a trench to jump.
  boxes.push(floor(-2, 20.4, 0, -W, W), floor(24.4, 30, 0, -W, W), floor(31.8, 48.4, 0, -W, W), floor(52.4, 58, 0, -W, W));
  let door = doorRow(boxes, doorRows, 8, 3, 0, 6, -W, W), tile = 0;
  // Pushers sweep across between the first rows.
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: 12, z1: 13.2, look: "pusher", move: { axis: "x", amp: 4.2, period: 2600, phase: 0 } });
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: 15.5, z1: 16.7, look: "pusher", move: { axis: "x", amp: 4.2, period: 2200, phase: Math.PI } });
  // Six lanes: two lead on, one is a dead end, one drops through a trapdoor, two front doors stay shut.
  ({ door, tile } = laneRow(boxes, laneRows, 20, 4, 6, door, tile, { through: 2, dead: 1, trap: 1 }, -W, W));
  door = doorRow(boxes, doorRows, 36, 2, door, 6, -W, W);
  // A low spinning bar between the rows.
  ({ door, tile } = laneRow(boxes, laneRows, 48, 4, 6, door, tile, { through: 1, dead: 2, trap: 1 }, -W, W));
  boxes.push(...stairs(58, 61, 0, 1.2, -W, W), floor(61, 68, 1.2, -W, W, "finish"));
  return { id: "tuerenlotto", name: "Türenlotto", width: 12, finishZ: 64, finishY: 1.2, killY: -8, boxes,
    sweepers: [{ x: 0, z: 42, y0: .15, y1: .6, length: 5.4, speed: 1.5, phase: 0 }],
    checkpoints: [{ z: 1, y: 0 }, { z: 14, y: 0 }, { z: 26, y: 0 }, { z: 33, y: 0 }, { z: 45.5, y: 0 }, { z: 54, y: 0 }], doorRows, laneRows, tileRows: [], seesaws: 0, winds: [] };
}

/** Spinning bars of every kind, moving islands, two seesaws and a stirring machine at the end. */
function kreiselkurs(): Course {
  // Every stretch over the void is longer than a jump with a dive (see the obstacle length test).
  const boxes: Box[] = [floor(-2, 30), floor(42.6, 44), floor(55.8, 75)];
  // Moving islands over the gap.
  for (const [z0, phase] of [[30.6, 0], [33.6, 2], [36.6, 4], [39.6, 6]] as const) boxes.push({ x0: -1.6, x1: 1.6, y0: -1, y1: 0, z0, z1: z0 + 2.2, look: "floor", move: { axis: "x", amp: 2.6, period: 3200, phase } });
  // Two quick seesaws over the void.
  [[44.2, 49.4], [49.8, 55.6]].forEach(([z0, z1], i) => boxes.push({ x0: -2.4, x1: 2.4, y0: -.5, y1: 0, z0, z1, look: "seesaw", seesaw: i }));
  boxes.push(...stairs(71, 73, 0, .6), floor(73, 79, .6, -5, 5, "finish"));
  const sweepers: Sweeper[] = [
    // One long low bar: jump.
    { x: 0, z: 9, y0: .15, y1: .6, length: 4.6, speed: 1.6, phase: 0 },
    // Twins turning against each other.
    { x: -2.5, z: 17, y0: .15, y1: .6, length: 2.3, speed: 2.2, phase: 0 },
    { x: 2.5, z: 17, y0: .15, y1: .6, length: 2.3, speed: -2.2, phase: 1.2 },
    // Cross: a low and a high bar on the same post at different speeds – jump or duck.
    { x: 0, z: 25, y0: .15, y1: .6, length: 4.6, speed: 1.3, phase: 0 },
    { x: 0, z: 25, y0: 1, y1: 1.4, length: 4.6, speed: -1, phase: 1.6 },
    // Stirring machine: three short fast bars side by side, then one high bar to duck under.
    { x: -3.3, z: 60.5, y0: .15, y1: .6, length: 1.5, speed: 3, phase: 0 },
    { x: 0, z: 60.5, y0: .15, y1: .6, length: 1.5, speed: -3, phase: .8 },
    { x: 3.3, z: 60.5, y0: .15, y1: .6, length: 1.5, speed: 3, phase: 1.6 },
    { x: 0, z: 66.5, y0: 1, y1: 1.4, length: 4.6, speed: 1.6, phase: 0 }
  ];
  return { id: "kreiselkurs", name: "Kreiselkurs", width: 10, finishZ: 76, finishY: .6, killY: -8, boxes, sweepers,
    checkpoints: [{ z: 1, y: 0 }, { z: 13, y: 0 }, { z: 21, y: 0 }, { z: 29, y: 0 }, { z: 43, y: 0 }, { z: 56.5, y: 0 }, { z: 63.5, y: 0 }], doorRows: [], tileRows: [], seesaws: 2, winds: [] };
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
  return { id: "wippenwerk", name: "Wippenwerk", width: 10, finishZ: 49, finishY: 1.85, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 28.5, y: 0 }, { z: 39, y: 1.85 }], doorRows: [], tileRows: [], seesaws: 3, winds: [] };
}

/** Trapdoor plates over the void in `rows` × `cols`; every plate opens on its own beat (`phase` per plate), warning first. */
function trapField(boxes: Box[], z0: number, rows: number, period: number, open: number, phase: (row: number, col: number) => number, y = 0, cols = 5, x0 = -5, x1 = 5) {
  const pitch = (x1 - x0) / cols;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = x0 + pitch * (col + .5);
    boxes.push({ x0: x - pitch / 2 + .05, x1: x + pitch / 2 - .05, y0: y - .4, y1: y, z0: z0 + row * 2, z1: z0 + row * 2 + 1.9, look: "trap", blink: { period, phase: phase(row, col), open } });
  }
  return z0 + rows * 2;
}

/** Builds a stretch in its own frame (forward +z, across x) and turns it into place at (ox, oz). */
function stretch(boxes: Box[], sweepers: Sweeper[], k: Quarter, ox: number, oz: number, build: (b: Box[], sw: Sweeper[]) => void) {
  const local: Box[] = [], bars: Sweeper[] = [];
  build(local, bars);
  boxes.push(...local.map(b => turnBox(b, k, ox, oz))); sweepers.push(...bars.map(sw => turnSweeper(sw, k, ox, oz)));
}

/**
 * Glibberflut: a climb in serpentines – seven stretches to and fro, ever
 * higher, with five edges to catch, while goo rises from below. Every
 * stretch over the void is longer than a jump with a dive.
 */
function glibberflut(): Course {
  const boxes: Box[] = [], sweepers: Sweeper[] = [], W = 3;
  const pusher = (z: number, y: number, amp: number, period: number, phase: number, half = 1): Box => ({ x0: -half, x1: half, y0: y, y1: y + 1.2, z0: z, z1: z + 1.1, look: "pusher", move: { axis: "x", amp, period, phase } });
  const roller = (z: number, y: number, period: number, phase: number, amp = 2.2): Box => ({ x0: -.8, x1: .8, y0: y, y1: y + .55, z0: z, z1: z + .7, look: "roller", move: { axis: "x", amp, period, phase } });
  const ledge = (z0: number, z1: number, top: number, look: Look = "ledge"): Box => ({ x0: -W, x1: W, y0: -1, y1: top, z0, z1, look });
  /** Low rails on both sides where pushers, logs and bars would shove racers off. */
  const rails = (z0: number, z1: number, y: number): Box[] => [-1, 1].map(side => ({ x0: side < 0 ? -W - .35 : W, x1: side < 0 ? -W : W + .35, y0: y, y1: y + .55, z0, z1, look: "wall" as Look }));
  /** Corner pad from z0 (6 m): walls at the far end and on the side away from the next stretch (`turn` −1 left, +1 right). */
  const corner = (z0: number, y: number, turn: -1 | 1): Box[] => [
    { x0: -W - .4, x1: W + .4, y0: y, y1: y + 1.3, z0: z0 + 6, z1: z0 + 6.4, look: "wall" },
    { x0: turn > 0 ? -W - .4 : W, x1: turn > 0 ? -W : W + .4, y0: y, y1: y + 1.3, z0, z1: z0 + 6, look: "wall" }
  ];
  // 1 (north): start, stairs, a belt running back with rolling logs, first corner (then right).
  stretch(boxes, sweepers, 0, 0, 0, b => {
    b.push(floor(-2, 3, 0, -W, W), ...stairs(3, 6, 0, 1.2, -W, W), { ...floor(6, 13, 1.2, -W, W), look: "belt", belt: -3 }, roller(8.2, 1.2, 2300, 0), roller(10.8, 1.2, 1900, 2.4), ...rails(6, 13, 1.2));
    b.push(floor(13, 19, 1.2, -W, W), ...corner(13, 1.2, 1));
  });
  // 2 (east): an edge to catch, a pusher on top, a belt running back under a second pusher, stairs, second corner (then left).
  stretch(boxes, sweepers, 1, W, 16, b => {
    b.push(ledge(0, 4, 3), { ...floor(4, 8, 3, -W, W), look: "belt", belt: -2.4 }, pusher(2.2, 3, 2, 2200, 0), pusher(5.6, 3, 2, 1800, 2), ...rails(.6, 8, 3), ...stairs(8, 11, 3, 4.2, -W, W));
    b.push(floor(11, 17, 4.2, -W, W), ...corner(11, 4.2, -1));
  });
  // 3 (north): a low spinning bar, then the corner on top of an edge (then left).
  stretch(boxes, sweepers, 0, 17, 19, (b, sw) => {
    b.push(floor(0, 7, 4.2, -W, W), ...rails(0, 7, 4.2), ledge(7, 13, 6), ...corner(7, 6, -1));
    sw.push({ x: 0, z: 3.5, y0: 4.35, y1: 4.8, length: 2.8, speed: 1.3, phase: 0 });
  });
  // 4 (west, long): drifting islands over the void, a cross of bars, stairs, corner (then right).
  stretch(boxes, sweepers, 3, 14, 29, (b, sw) => {
    b.push(floor(0, 2, 6, -W, W));
    for (const [z0, phase] of [[2.6, 0], [5.4, 1.6], [8.2, 3.2], [11, 4.8]] as const) b.push({ x0: -1.7, x1: 1.7, y0: 5, y1: 6, z0, z1: z0 + 2.4, look: "floor", move: { axis: "x", amp: 1.4, period: 3000, phase } });
    b.push(floor(14, 22, 6, -W, W), ...rails(14, 22, 6), ...stairs(22, 25, 6, 7.2, -W, W), floor(25, 31, 7.2, -W, W), ...corner(25, 7.2, 1));
    sw.push({ x: 0, z: 18, y0: 6.15, y1: 6.6, length: 2.8, speed: 1.4, phase: 0 }, { x: 0, z: 18, y0: 7, y1: 7.4, length: 2.8, speed: -1.1, phase: 1.6 });
  });
  // 5 (north): belt running back with a log, corner on top of an edge (then right).
  stretch(boxes, sweepers, 0, -14, 32, b => {
    b.push({ ...floor(0, 6, 7.2, -W, W), look: "belt", belt: -2.6 }, roller(2.8, 7.2, 2100, 1), ...rails(0, 6, 7.2), ledge(6, 12, 9), ...corner(6, 9, 1));
  });
  // 6 (east, long): trapdoors over the void, a rest, a narrow beam with two pushers, stairs, corner (then left).
  stretch(boxes, sweepers, 1, -11, 41, b => {
    b.push(floor(0, 1.5, 9, -W, W));
    trapField(b, 1.7, 6, 3400, .32, (row, col) => spread(row * 3 + col + 300), 9, 3, -W, W);
    b.push(floor(13.9, 17, 9, -W, W), floor(17, 29, 9, -.9, .9), pusher(20.5, 9, 1.5, 2600, 0, .5), pusher(24.5, 9, 1.5, 2300, 2.2, .5));
    b.push(...stairs(29, 32, 9, 10.2, -W, W), floor(32, 38, 10.2, -W, W), ...corner(32, 10.2, -1));
  });
  // 7 (north): two seesaws over the void, an edge, the last edge up to the finish.
  stretch(boxes, sweepers, 0, 24, 44, b => {
    b.push(floor(0, 3, 10.2, -W, W));
    [[3.2, 8.6], [9, 14.4]].forEach(([z0, z1], i) => b.push({ x0: -2.4, x1: 2.4, y0: 9.7, y1: 10.2, z0, z1, look: "seesaw", seesaw: i }));
    b.push(floor(14.6, 19, 10.2, -W, W), ledge(19, 23, 12), ledge(23, 31, 13.8, "finish"));
  });
  return { id: "glibberflut", name: "Glibberflut", width: 6, finishX: 24, finishZ: 71, finishY: 13.8, killY: -8, boxes, sweepers,
    route: [{ x: 0, z: 0 }, { x: 0, z: 16 }, { x: 17, z: 16 }, { x: 17, z: 29 }, { x: -14, z: 29 }, { x: -14, z: 41 }, { x: 24, z: 41 }, { x: 24, z: 71 }],
    checkpoints: [{ x: 0, z: 1, y: 0 }, { x: 0, z: 16, y: 1.2 }, { x: 17, z: 16, y: 4.2 }, { x: 17, z: 29, y: 6 }, { x: -1, z: 29, y: 6 }, { x: -14, z: 29, y: 7.2 }, { x: -14, z: 41, y: 9 }, { x: 4, z: 41, y: 9 }, { x: 24, z: 41, y: 10.2 }, { x: 24, z: 59.5, y: 10.2 }],
    doorRows: [], tileRows: [], seesaws: 2, winds: [], goo: { start: -1.4, rate: .2, delay: 3000, accel: .003 } };
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
    checkpoints: [{ z: 1, y: 0 }, { z: 22, y: 0 }], doorRows: [], tileRows, seesaws: 0, winds: [] };
}

/** Phase in [0, 1) from a small integer, spread like a hash (fixed, same for every match). */
const spread = (i: number) => ((Math.imul(i + 1, 2654435761) >>> 0) % 1000) / 1000;

function fallklappen(): Course {
  // Every field is longer than a jump with a dive: nobody skips a field in one go.
  const boxes: Box[] = [floor(-2, 6)], checkpoints = [{ z: 1, y: 0 }];
  const rest = (z0: number, length: number) => { boxes.push(floor(z0, z0 + length)); checkpoints.push({ z: z0 + .8, y: 0 }); return z0 + length; };
  // 1: every plate on its own slow beat.
  let z = trapField(boxes, 6.2, 6, 4200, .3, (row, col) => spread(row * 5 + col));
  z = rest(z + .2, 4.4);
  // 2: faster, open longer; a pusher sweeps the rest platform behind it.
  z = trapField(boxes, z + .2, 6, 3200, .38, (row, col) => spread(row * 5 + col + 40));
  boxes.push({ x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: z + 2.2, z1: z + 3.4, look: "pusher", move: { axis: "x", amp: 3.6, period: 2400, phase: 0 } });
  z = rest(z + .2, 4.8);
  // 3: checkerboard – neighbours take turns, hop diagonally onto the plates that just closed.
  z = trapField(boxes, z + .2, 6, 3000, .48, (row, col) => (row + col) % 2 ? .5 : 0);
  z = rest(z + .2, 4.4);
  // 4: a narrow plank of plates, fast and one after another, with a gap between each.
  const plank = z + .2;
  for (let i = 0; i < 6; i++) boxes.push({ x0: -.9, x1: .9, y0: -.4, y1: 0, z0: plank + i * 2.2, z1: plank + i * 2.2 + 1.7, look: "trap", blink: { period: 2600, phase: spread(i + 70), open: .3 } });
  z = plank + 6 * 2.2;
  boxes.push(floor(z + .2, z + 3), ...stairs(z + 3, z + 5, 0, .6), floor(z + 5, z + 11, .6, -5, 5, "finish"));
  return { id: "fallklappen", name: "Fallklappen", width: 10, finishZ: z + 8, finishY: .6, killY: -8, boxes, sweepers: [], checkpoints, doorRows: [], tileRows: [], seesaws: 0, winds: [] };
}

function windkanal(): Course {
  const boxes: Box[] = [floor(-2, 6)], winds: Wind[] = [];
  const gust = (z0: number, z1: number, vx: number, vz: number, period: number, phase: number, on: number, x0 = -6, x1 = 6) => winds.push({ x0, x1, y0: -2, y1: 18, z0, z1, vx, vz, period, phase, on });
  // Narrow walkways over the void; side winds switch direction.
  boxes.push(floor(6, 18, 0, -1.8, 1.8));
  gust(6, 12, 2.6, 0, 3000, 0, .55); gust(12, 18, -2.6, 0, 3000, .5, .55);
  boxes.push(floor(18, 22));
  // Stepping stones across a gap (longer than a jump with a dive) with a crosswind that never stops.
  for (const [z0, x] of [[23, -2], [25.4, 1], [27.8, -1], [30.2, 2], [32.6, .4]] as const) boxes.push(floor(z0, z0 + 1.6, 0, x - .9, x + .9));
  gust(22, 34.6, -1.8, 0, 1000, 0, 1);
  boxes.push(floor(34.6, 38.4));
  // Gust bridge: even narrower, short gusts from alternating sides.
  boxes.push(floor(38.4, 52.4, 0, -1.3, 1.3));
  gust(38.4, 43.1, 3, 0, 2000, 0, .5); gust(43.1, 47.7, -3, 0, 2000, .33, .5); gust(47.7, 52.4, 3, 0, 2000, .66, .5);
  boxes.push(floor(52.4, 56.4));
  // Drifting islands over the void against a steady headwind.
  for (const [z0, phase] of [[57, 0], [60, 1.5], [63, 3], [66, 4.5]] as const) boxes.push({ x0: -1.6, x1: 1.6, y0: -1, y1: 0, z0, z1: z0 + 2.4, look: "floor", move: { axis: "x", amp: 2.4, period: 3200, phase } });
  gust(56.4, 69, 0, -1.4, 1000, 0, 1);
  boxes.push(floor(69, 72.4));
  // Headwind ramp with side gusts at the top.
  boxes.push(...stairs(72.4, 80.4, 0, 2.4, -1.6, 1.6));
  gust(72.4, 80.4, 0, -3.4, 2600, 0, .6, -1.6, 1.6); gust(76.4, 80.4, 2.2, 0, 1800, .25, .45, -1.6, 1.6);
  boxes.push(floor(80.4, 86.4, 2.4, -5, 5, "finish"));
  return { id: "windkanal", name: "Windkanal", width: 10, finishZ: 83.4, finishY: 2.4, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 19, y: 0 }, { z: 35.4, y: 0 }, { z: 53.4, y: 0 }, { z: 69.8, y: 0 }], doorRows: [], tileRows: [], seesaws: 0, winds };
}

function kletterwand(): Course {
  const boxes: Box[] = [floor(-2, 10)];
  // Four levels of holds, each 1.7 m higher (too high to jump: hold on and pull up).
  // Every level has three blocks; each vanishes now and then, so pick one that stays.
  for (let level = 0; level < 4; level++) {
    const z0 = 10 + level * 2.6, y = 1.7 * (level + 1);
    [[-5, -1.75], [-1.65, 1.65], [1.75, 5]].forEach(([x0, x1], i) => boxes.push({ x0, x1, y0: -1, y1: y, z0, z1: z0 + 2.6, look: "hold", blink: { period: 5200 + i * 700, phase: spread(level * 3 + i + 90), open: .3 } }));
  }
  boxes.push(floor(20.4, 28, 6.8, -5, 5, "finish"));
  return { id: "kletterwand", name: "Kletterwand", width: 10, finishZ: 25, finishY: 6.8, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }], doorRows: [], tileRows: [], seesaws: 0, winds: [] };
}

/** Final: trapdoor plates under two spinning bars; the outer ring starts to open first. */
function standhaft(): Course {
  const boxes: Box[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    const x = -5 + col * 2.5, z = row * 2.5, ring = Math.min(row, col, 4 - row, 4 - col);
    boxes.push({ x0: x - 1.2, x1: x + 1.2, y0: -.4, y1: 0, z0: z - 1.2, z1: z + 1.2, look: "trap", blink: { period: 5000 - ring * 600, phase: spread(row * 5 + col + 200), open: .3, from: 12000 + ring * 12000 } });
  }
  return { id: "standhaft", name: "Standhaft", width: 12.5, finishZ: 1e9, finishY: 0, killY: -6, boxes,
    // Both bars rest between the start places and begin to turn after three seconds.
    sweepers: [{ x: 0, z: 5, y0: .15, y1: .6, length: 6.5, speed: 1, phase: .5 + Math.PI / 6, from: 3000 }, { x: 0, z: 5, y0: 1, y1: 1.4, length: 6.5, speed: -.7, phase: .5 + Math.PI / 2, from: 20000 }],
    checkpoints: [{ z: 5, y: 0 }], doorRows: [], tileRows: [], seesaws: 0, winds: [], elimination: true, limitMs: 90000, knock: .6 };
}

/** The obstacle runs (one entry in the random draw). */
export const COURSE_IDS = ["tuerenlotto", "kreiselkurs", "glibberflut", "geisterpfad", "fallklappen", "windkanal", "kletterwand"] as const;
/** Runs that are no longer drawn as obstacle run (Wippenwerk: its seesaws now are a part of Kreiselkurs); still playable directly. */
export const RETIRED_COURSE_IDS = ["wippenwerk"] as const;
/** Finals in the same engine (own entries in the draw). */
export const FINAL_IDS = ["standhaft"] as const;
export type CourseId = typeof COURSE_IDS[number] | typeof RETIRED_COURSE_IDS[number] | typeof FINAL_IDS[number] | "proberaum";
const BUILDERS: Record<CourseId, () => Course> = { proberaum, tuerenlotto, kreiselkurs, wippenwerk, glibberflut, geisterpfad, fallklappen, windkanal, kletterwand, standhaft };
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
export const sweeperAngle = (sw: Sweeper, t: number) => sw.phase + sw.speed * Math.max(0, t - (sw.from ?? 0)) / 1000;
/** Whether a vanishing box is gone at time `t` (ms). */
export function blinkOpen(b: Pick<Box, "blink">, t: number) {
  const k = b.blink;
  if (!k || t < (k.from ?? 0)) return false;
  return (((t - (k.from ?? 0)) / k.period + k.phase) % 1) < k.open;
}
/** Warning phase (0…1 rising) during the last `BLINK_WARN` ms before a vanishing box opens; 0 otherwise. */
export function blinkWarn(b: Pick<Box, "blink">, t: number) {
  const k = b.blink;
  if (!k || blinkOpen(b, t)) return 0;
  const from = k.from ?? 0, start = ((k.phase % 1) + 1) % 1;
  // Next opening: at `from` (if the cycle starts open) or when the cycle wraps to 0.
  const next = t < from ? from + (start < k.open ? 0 : (1 - start) * k.period) : t + (1 - (((t - from) / k.period + k.phase) % 1)) * k.period;
  const until = next - t;
  return until <= BLINK_WARN ? 1 - until / BLINK_WARN : 0;
}
/** Wind zone state at `t`: blowing, or about to start (warning 0…1 rising during the last `WIND_WARN` ms). */
export const WIND_WARN = 800;
export function windState(w: Wind, t: number) {
  const pos = ((t / w.period + w.phase) % 1 + 1) % 1, on = pos < w.on;
  if (on || w.on >= 1) return { on: true, warn: 0 };
  const until = (1 - pos) * w.period;
  return { on: false, warn: until <= WIND_WARN ? 1 - until / WIND_WARN : 0 };
}
/** Wind drift (m/s) at a point and time. */
export function windAt(c: Pick<Course, "winds">, x: number, y: number, z: number, t: number) {
  let vx = 0, vz = 0;
  for (const w of c.winds) if (x >= w.x0 && x <= w.x1 && y >= w.y0 && y <= w.y1 && z >= w.z0 && z <= w.z1 && ((t / w.period + w.phase) % 1) < w.on) { vx += w.vx; vz += w.vz; }
  return { vx, vz };
}
/** Goo height at time `t` (ms), or −Infinity without goo. */
export function gooAt(c: Course, t: number) {
  if (!c.goo) return -Infinity;
  const sec = Math.max(0, t - c.goo.delay) / 1000;
  return c.goo.start + c.goo.rate * sec + (c.goo.accel ?? 0) * sec * sec / 2;
}

/** Stretches of a winding course with their start progress (cached). */
const routes = new WeakMap<Course, { ax: number; az: number; dx: number; dz: number; length: number; from: number }[]>();
function stretches(c: Course) {
  let list = routes.get(c);
  if (!list) {
    let from = 0; list = [];
    const pts = c.route ?? [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const dx = pts[i + 1].x - pts[i].x, dz = pts[i + 1].z - pts[i].z, length = Math.hypot(dx, dz) || 1;
      list.push({ ax: pts[i].x, az: pts[i].z, dx: dx / length, dz: dz / length, length, from }); from += length;
    }
    routes.set(c, list);
  }
  return list;
}
/** Stretch of the route nearest to a point in the plan and the progress there (metres along the way). */
export function routeAt(c: Course, x: number, z: number) {
  let best = { index: 0, along: 0, gap: Infinity };
  stretches(c).forEach((st, index) => {
    const u = Math.max(0, Math.min(st.length, (x - st.ax) * st.dx + (z - st.az) * st.dz));
    const gap = Math.hypot(st.ax + st.dx * u - x, st.az + st.dz * u - z);
    if (gap < best.gap - 1e-6) best = { index, along: st.from + u, gap };
  });
  return best;
}
/** Progress along the course: along the route, else simply z. */
export const progressOf = (c: Course, x: number, z: number) => c.route ? routeAt(c, x, z).along : z;
/** Progress at the finish line (the length shown to the players). */
export const courseLength = (c: Course) => c.route ? progressOf(c, c.finishX ?? 0, c.finishZ) : c.finishZ;
/** Stretch `index` of a winding course: start point, direction and quarter turns from +z. */
export function routeStretch(c: Course, index: number) {
  const list = stretches(c), st = list[Math.max(0, Math.min(list.length - 1, index))];
  return { ...st, quarter: quarterOf(st.dx, st.dz), last: index >= list.length - 1 };
}
/** Heading (facing angle) of the way at progress `along`, looking `ahead` metres further. */
export function routeFace(c: Course, x: number, z: number, ahead = 0) {
  const list = stretches(c), at = routeAt(c, x, z).along + ahead;
  const st = list.find(q => at < q.from + q.length) ?? list[list.length - 1];
  return Math.atan2(st.dx, st.dz);
}
