import { proberaum } from "./proberaumCourse";
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
  const boxes: Box[] = [floor(-2, 30), floor(39.6, 41), floor(52.8, 72)];
  // Moving islands over the gap.
  for (const [z0, z1, phase] of [[30.6, 32.8, 0], [33.6, 35.8, 2], [36.6, 38.8, 4]] as const) boxes.push({ x0: -1.6, x1: 1.6, y0: -1, y1: 0, z0, z1, look: "floor", move: { axis: "x", amp: 2.6, period: 3200, phase } });
  // Two quick seesaws over the void.
  [[41.2, 46.4], [46.8, 52.6]].forEach(([z0, z1], i) => boxes.push({ x0: -2.4, x1: 2.4, y0: -.5, y1: 0, z0, z1, look: "seesaw", seesaw: i }));
  boxes.push(...stairs(68, 70, 0, .6), floor(70, 76, .6, -5, 5, "finish"));
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
    { x: -3.3, z: 57.5, y0: .15, y1: .6, length: 1.5, speed: 3, phase: 0 },
    { x: 0, z: 57.5, y0: .15, y1: .6, length: 1.5, speed: -3, phase: .8 },
    { x: 3.3, z: 57.5, y0: .15, y1: .6, length: 1.5, speed: 3, phase: 1.6 },
    { x: 0, z: 63.5, y0: 1, y1: 1.4, length: 4.6, speed: 1.6, phase: 0 }
  ];
  return { id: "kreiselkurs", name: "Kreiselkurs", width: 10, finishZ: 73, finishY: .6, killY: -8, boxes, sweepers,
    checkpoints: [{ z: 1, y: 0 }, { z: 13, y: 0 }, { z: 21, y: 0 }, { z: 29, y: 0 }, { z: 40, y: 0 }, { z: 53.5, y: 0 }, { z: 60.5, y: 0 }], doorRows: [], tileRows: [], seesaws: 2, winds: [] };
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
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 7.9, z0: 53, z1: 62, look: "ledge" });
  // Upper deck: rolling logs, stairs, a narrow beam with a pusher, then the next wall.
  for (const [z, phase, period] of [[55.5, 0, 2400], [58.5, 2.2, 2000]] as const) boxes.push({ x0: -.9, x1: .9, y0: 7.9, y1: 8.45, z0: z, z1: z + .7, look: "roller", move: { axis: "x", amp: 4, period, phase } });
  boxes.push(...stairs(62, 66, 7.9, 9.1), floor(66, 74, 9.1, -1.1, 1.1), floor(74, 76, 9.1, -5, 5));
  boxes.push({ x0: -.6, x1: .6, y0: 9.1, y1: 10.3, z0: 69.5, z1: 70.5, look: "pusher", move: { axis: "x", amp: 1.6, period: 1800, phase: 0 } });
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 10.8, z0: 76, z1: 80, look: "ledge" });
  // Roof: trapdoors over the goo, a backward belt with rolling logs, a beam with a pusher and the last wall.
  trapField(boxes, 80, 3, 3400, .3, (row, col) => spread(row * 5 + col + 300), 10.8);
  boxes.push(floor(86, 89, 10.8), ...stairs(89, 92, 10.8, 12.3), { ...floor(92, 100, 12.3), look: "belt", belt: -3 });
  for (const [z, phase, period] of [[94.5, 1, 2200], [97.5, 3.2, 1900]] as const) boxes.push({ x0: -.9, x1: .9, y0: 12.3, y1: 12.85, z0: z, z1: z + .7, look: "roller", move: { axis: "x", amp: 4, period, phase } });
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 14.1, z0: 100, z1: 104, look: "ledge" }, floor(104, 112, 14.1, -1.2, 1.2));
  boxes.push({ x0: -.6, x1: .6, y0: 14.1, y1: 15.3, z0: 107.5, z1: 108.5, look: "pusher", move: { axis: "x", amp: 1.7, period: 1600, phase: 1 } });
  boxes.push({ x0: -5, x1: 5, y0: -1, y1: 15.9, z0: 112, z1: 120, look: "finish" });
  return { id: "glibberflut", name: "Glibberflut", width: 10, finishZ: 116, finishY: 15.9, killY: -8, boxes, sweepers: [],
    checkpoints: [{ z: 1, y: 0 }, { z: 20, y: 3.2 }, { z: 31.5, y: 4.7 }, { z: 49, y: 5 }, { z: 54, y: 7.9 }, { z: 66.5, y: 9.1 }, { z: 76.5, y: 10.8 }, { z: 86.5, y: 10.8 }, { z: 100.5, y: 14.1 }],
    doorRows: [], tileRows: [], seesaws: 0, winds: [], goo: { start: -1.4, rate: .28, delay: 3000, accel: .0095 } };
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
  const boxes: Box[] = [floor(-2, 6)];
  // 1: every plate on its own slow beat.
  let z = trapField(boxes, 6.2, 5, 4200, .3, (row, col) => spread(row * 5 + col));
  boxes.push(floor(z + .2, z + 4.6));
  // 2: faster, open longer; a pusher sweeps the rest platform behind it.
  z = trapField(boxes, z + 4.8, 6, 3200, .38, (row, col) => spread(row * 5 + col + 40));
  boxes.push(floor(z + .2, z + 5), { x0: -1.2, x1: 1.2, y0: 0, y1: 1.4, z0: z + 2, z1: z + 3.2, look: "pusher", move: { axis: "x", amp: 3.6, period: 2400, phase: 0 } });
  // 3: checkerboard – neighbours take turns, hop diagonally onto the plates that just closed.
  const checker = z + 5.2;
  z = trapField(boxes, checker, 5, 3000, .48, (row, col) => (row + col) % 2 ? .5 : 0);
  boxes.push(floor(z + .2, z + 4.6));
  // 4: a narrow plank of plates, fast and one after another, with a gap between each.
  const plank = z + 4.8;
  for (let i = 0; i < 6; i++) boxes.push({ x0: -.9, x1: .9, y0: -.4, y1: 0, z0: plank + i * 2.2, z1: plank + i * 2.2 + 1.7, look: "trap", blink: { period: 2600, phase: spread(i + 70), open: .3 } });
  z = plank + 6 * 2.2;
  boxes.push(floor(z + .2, z + 3), ...stairs(z + 3, z + 5, 0, .6), floor(z + 5, z + 11, .6, -5, 5, "finish"));
  return { id: "fallklappen", name: "Fallklappen", width: 10, finishZ: z + 8, finishY: .6, killY: -8, boxes, sweepers: [],
    checkpoints: [{ z: 1, y: 0 }, { z: 17, y: 0 }, { z: checker - 4, y: 0 }, { z: plank - 4, y: 0 }], doorRows: [], tileRows: [], seesaws: 0, winds: [] };
}

function windkanal(): Course {
  const boxes: Box[] = [floor(-2, 6)], winds: Wind[] = [];
  const gust = (z0: number, z1: number, vx: number, vz: number, period: number, phase: number, on: number, x0 = -6, x1 = 6) => winds.push({ x0, x1, y0: -2, y1: 18, z0, z1, vx, vz, period, phase, on });
  // Narrow walkways over the void; side winds switch direction.
  boxes.push(floor(6, 18, 0, -1.8, 1.8));
  gust(6, 12, 2.6, 0, 3000, 0, .55); gust(12, 18, -2.6, 0, 3000, .5, .55);
  boxes.push(floor(18, 22));
  // Stepping stones across a gap with a crosswind that never stops.
  for (const [z0, x] of [[23, -2], [25.4, 1], [27.8, -1], [30.2, 2]] as const) boxes.push(floor(z0, z0 + 1.6, 0, x - .9, x + .9));
  gust(22, 32, -1.8, 0, 1000, 0, 1);
  boxes.push(floor(32.2, 36));
  // Gust bridge: even narrower, short gusts from alternating sides.
  boxes.push(floor(36, 50, 0, -1.3, 1.3));
  gust(36, 40.7, 3, 0, 2000, 0, .5); gust(40.7, 45.3, -3, 0, 2000, .33, .5); gust(45.3, 50, 3, 0, 2000, .66, .5);
  boxes.push(floor(50, 54));
  // Drifting islands over the void against a steady headwind.
  for (const [z0, phase] of [[54.6, 0], [57.6, 1.5], [60.6, 3], [63.6, 4.5]] as const) boxes.push({ x0: -1.6, x1: 1.6, y0: -1, y1: 0, z0, z1: z0 + 2.4, look: "floor", move: { axis: "x", amp: 2.4, period: 3200, phase } });
  gust(54, 66.6, 0, -1.4, 1000, 0, 1);
  boxes.push(floor(66.6, 70));
  // Headwind ramp with side gusts at the top.
  boxes.push(...stairs(70, 78, 0, 2.4, -1.6, 1.6));
  gust(70, 78, 0, -3.4, 2600, 0, .6, -1.6, 1.6); gust(74, 78, 2.2, 0, 1800, .25, .45, -1.6, 1.6);
  boxes.push(floor(78, 84, 2.4, -5, 5, "finish"));
  return { id: "windkanal", name: "Windkanal", width: 10, finishZ: 81, finishY: 2.4, killY: -8, boxes, sweepers: [], checkpoints: [{ z: 1, y: 0 }, { z: 19, y: 0 }, { z: 33, y: 0 }, { z: 51, y: 0 }, { z: 67.5, y: 0 }], doorRows: [], tileRows: [], seesaws: 0, winds };
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
