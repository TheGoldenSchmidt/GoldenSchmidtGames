import { blinkOpen, blinkWarn, boxAt, course, COURSE_IDS, gooAt, sweeperAngle, windAt, type Box, type Course, type CourseId } from "./parcoursCourses";
import { emit, hash, inputOfPlayer, presence, rank, shuffled, randomInt, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Hindernis-Parcours – a gameshow obstacle race that every racer runs
 * themselves (no auto-run). Racers are upright cylinders moving through the
 * fixed course boxes of `parcoursCourses.ts`: run and steer with the stick,
 * jump, dive forward, hold on (ledges and other racers) and duck under high
 * bars. Falling returns a racer to the last checkpoint. Order of arrival
 * decides; without arrival the progress counts. Coordinates: x sideways,
 * y up, z forward (metres). Stick input arrives as field direction
 * (x right, y towards the camera on the overview), so forward is −y.
 */
export const PC = {
  radius: .35, height: 1.6, duckHeight: .9,
  run: 6.4, duckSpeed: 2.8, groundControl: 16, airControl: 4, diveControl: .7,
  gravity: 26, jump: 9, coyote: 120, buffer: 160, step: .32,
  dive: 9.6, diveUp: 4.2, airDiveUp: 2.6, proneMs: 450,
  hangMin: .9, hangMax: 2.15, hangReach: .45, hangDrop: 1.55, hangMaxMs: 4000,
  grabRange: 1.05, tether: 1.1, grabSlow: .45, grabSelf: .6, grabMs: 2000, grabCooldown: 1500,
  knock: 8.5, knockUp: 4.5, stunMs: 650, hitGuard: 800,
  /** Contact distance between a spinning bar's centre line and a racer (bar half thickness + slim body). */
  barReach: .48,
  /** Extra speed away from the bar's axis when hit (flung outwards). */
  fling: 3,
  /**
   * A moving bar first only carries the racer for this long: a jump or duck
   * in this window still escapes. It hides the delay between seeing the bar
   * on the phone and the press reaching the authority.
   */
  barGrace: 140,
  /** Pull-up from hanging onto the top. */
  climbMs: 620,
  /** Moving boxes faster than this (m/s, towards the racer) shove instead of only blocking. */
  shoveSpeed: 1.2, shoveStunMs: 320,
  respawnMs: 1100, finishGrace: 20000, maxMs: 120000, substeps: 3,
  tiltGain: .3, tiltMax: .5, tiltRate: 5.5, tiltSlide: .8
} as const;

export type Pose = "run" | "air" | "dive" | "prone" | "hang" | "climb" | "stun" | "done" | "out";
export interface Racer {
  id: string; x: number; y: number; z: number; vx: number; vy: number; vz: number;
  /** Facing (radians): 0 = forward along the course, positive towards +x. */
  face: number;
  pose: Pose; grounded: boolean;
  /** Index of the box the racer stands on (−1 = none). */
  ground: number;
  duck: boolean;
  /** End of the current prone or stun phase. */
  until: number;
  /** Time of the last jump/dive request (buffered for a moment). */
  jumpAt: number; diveAt: number; airDive: boolean; lastGround: number;
  hang?: { box: number; nx: number; nz: number; since: number };
  /** Racer this one holds on to. */
  grab?: string; grabSince: number; grabReady: number;
  checkpoint: number; best: number; falls: number; respawnAt: number; hitUntil: number;
  /** Height of the last ground stood on (pushing into a wall only grabs edges above it). */
  standY?: number;
  /** First and latest moment of the current contact with a moving bar (see `PC.barGrace`). */
  barTouch?: number; barLast?: number;
  finishAt?: number; outAt?: number;
}
export interface ParcoursGame {
  course: CourseId;
  racers: Record<string, Racer>;
  /** Arrival order. */
  order: string[];
  /** Public door state per panel: "1" = broken open, "2" = tried and solid. */
  doors: string;
  /** Public hidden-path state per tile: "0" unknown, "1" carries, "2" gave way. */
  tiles: string;
  /** Seesaw angles (positive = +x side down). */
  tilt: number[];
  firstFinish?: number;
  /** Secrets of the authority (removed from every view): which doors break, which tiles carry. */
  secretDoors?: string; secretTiles?: string;
}

const R = PC.radius;
const height = (r: Racer) => r.duck ? PC.duckHeight : PC.height;
/** Height of a box's walking surface at x (seesaws tilt). */
export function surfaceAt(b: Box, bb: { x0: number; x1: number; y1: number }, g: Pick<ParcoursGame, "tilt">, x: number) {
  if (b.seesaw === undefined) return bb.y1;
  const cx = (bb.x0 + bb.x1) / 2, dx = Math.max(bb.x0, Math.min(bb.x1, x)) - cx;
  return bb.y1 - Math.tan(g.tilt[b.seesaw] ?? 0) * dx;
}
/** Whether a box blocks racers at time `t`. Secret parts count as solid where the secret is unknown (bots, devices). */
export function solid(b: Box, g: ParcoursGame, t: number) {
  if (b.blink && blinkOpen(b, t)) return false;
  if (b.door !== undefined) return g.doors[b.door] !== "1";
  if (b.tile !== undefined && b.look !== "tile") return g.secretTiles ? g.secretTiles[b.tile] === "1" : g.tiles[b.tile] !== "2";
  if (b.tile !== undefined) return g.secretTiles ? g.secretTiles[b.tile] === "1" : g.tiles[b.tile] !== "2";
  return true;
}

function respawn(c: Course, r: Racer, slot: number, t: number) {
  const cp = c.checkpoints[r.checkpoint];
  // Side by side within three metres, so every checkpoint platform holds all six; finals start on a circle.
  const a = .5 + (slot % 6) * Math.PI / 3, x = c.elimination ? Math.cos(a) * 3.5 : (cp.x ?? 0) -1.5 + (slot % 6) * .6, z = c.elimination ? cp.z + Math.sin(a) * 3.5 : cp.z;
  Object.assign(r, { x, y: cp.y + .05, z, face: c.elimination ? Math.atan2(-x, cp.z - z) : 0, vx: 0, vy: 0, vz: 0, pose: "run", grounded: false, ground: -1, duck: false, hang: undefined, grab: undefined, respawnAt: 0, airDive: false, until: 0, lastGround: t });
}

function moveRacer(s: MatchState<ParcoursGame>, c: Course, p: MatchPlayer, r: Racer, slot: number, held: boolean, h: number, t: number) {
  const g = s.game;
  if (r.pose === "done" || r.pose === "out") return;
  if (r.respawnAt) { if (t >= r.respawnAt) respawn(c, r, slot, t); else return; }
  const input = inputOfPlayer(s, p), mx = input.x, mz = -input.y, mag = Math.min(1, Math.hypot(mx, mz)), grabHeld = input.ha;

  // Pulling up: first up the wall, then onto the top – a short movement, not a jump.
  if (r.pose === "climb" && r.hang) {
    const b = c.boxes[r.hang.box], bb = boxAt(b, t), { nx, nz } = r.hang, k = (t - r.hang.since) / PC.climbMs;
    if (!solid(b, g, t)) { Object.assign(r, { pose: "air", vx: nx * 1.2, vz: nz * 1.2, vy: 0, hang: undefined }); return; }
    const low = bb.y1 - PC.hangDrop, edge = (out: number) => { if (nz) r.z = nz < 0 ? bb.z0 + out : bb.z1 - out; else r.x = nx < 0 ? bb.x0 + out : bb.x1 - out; };
    r.vx = r.vy = r.vz = 0;
    if (k < .7) { r.y = low + (bb.y1 - low) * (k / .7); edge(-R); }
    else if (k < 1) { r.y = bb.y1; edge(-R + (2 * R + .1) * (k - .7) / .3); }
    else {
      Object.assign(r, { pose: "run", y: bb.y1, grounded: true, ground: r.hang.box, lastGround: t, hang: undefined, jumpAt: -1e9 });
      edge(R + .1);
    }
    return;
  }
  // Hanging on a ledge: hold on (button or stick into the wall), pull up (jump or stick towards the wall) or let go.
  if (r.pose === "hang" && r.hang) {
    const b = c.boxes[r.hang.box], bb = boxAt(b, t), { nx, nz } = r.hang, into = mx * -nx + mz * -nz > .3;
    if ((!grabHeld && !into) || t - r.hang.since > PC.hangMaxMs || !solid(b, g, t)) {
      Object.assign(r, { pose: "air", vx: nx * 1.2, vz: nz * 1.2, vy: 0, hang: undefined });
    } else if (t - r.jumpAt <= PC.buffer || into) {
      r.pose = "climb"; r.hang = { ...r.hang, since: t }; r.jumpAt = -1e9;
      emit(s, "climb", "", [r.id]);
    } else {
      r.y = bb.y1 - PC.hangDrop; r.vx = r.vy = r.vz = 0;
      if (nz) r.z = nz < 0 ? bb.z0 - R : bb.z1 + R; else r.x = nx < 0 ? bb.x0 - R : bb.x1 + R;
    }
    return;
  }
  if ((r.pose === "prone" || r.pose === "stun") && t >= r.until) r.pose = r.grounded ? "run" : "air";

  const control = r.pose === "run" || r.pose === "air";
  r.duck = !!input.hb && r.grounded && r.pose === "run";
  if (control) {
    const speed = (r.duck ? PC.duckSpeed : PC.run) * (held ? PC.grabSlow : 1) * (r.grab ? PC.grabSelf : 1);
    const k = 1 - Math.exp(-(r.grounded ? PC.groundControl : PC.airControl) * h);
    r.vx += (mx * speed - r.vx) * k; r.vz += (mz * speed - r.vz) * k;
    if (mag > .2) r.face = Math.atan2(mx, mz);
    // Buffered jump (with a little grace after leaving an edge).
    if (t - r.jumpAt <= PC.buffer && r.pose === "run" && (r.grounded || t - r.lastGround <= PC.coyote) && !r.duck) {
      r.vy = PC.jump; r.grounded = false; r.ground = -1; r.pose = "air"; r.jumpAt = -1e9; r.lastGround = -1e9;
      emit(s, "jump", "", [r.id]);
    }
    // Dive: a flat lunge forward, once per jump; afterwards a moment on the belly.
    if (t - r.diveAt <= PC.buffer && !r.airDive) {
      const ground = r.grounded;
      Object.assign(r, { pose: "dive", vx: Math.sin(r.face) * PC.dive, vz: Math.cos(r.face) * PC.dive, vy: ground ? PC.diveUp : Math.max(r.vy, PC.airDiveUp), grounded: false, ground: -1, airDive: true, diveAt: -1e9, duck: false, grab: undefined });
      emit(s, "dive", "", [r.id]);
    }
  } else if (r.pose === "dive") {
    const k = 1 - Math.exp(-PC.diveControl * h);
    r.vx += (mx * PC.dive - r.vx) * k * .3; r.vz += (mz * PC.dive - r.vz) * k * .3;
  } else if (r.grounded) {
    // Prone or stunned on the ground: friction only.
    const k = Math.exp(-6 * h); r.vx *= k; r.vz *= k;
  }

  // Carried by the ground: moving boxes, conveyor belts, tilting seesaws.
  if (r.grounded && r.ground >= 0) {
    const b = c.boxes[r.ground];
    if (b.move) { const a = boxAt(b, t - h * 1000), n = boxAt(b, t); r.x += n.x0 - a.x0; r.y += n.y1 - a.y1; r.z += n.z0 - a.z0; }
    if (b.belt) r.z += b.belt * h;
    if (b.seesaw !== undefined) r.vx += Math.sin(g.tilt[b.seesaw]) * PC.gravity * PC.tiltSlide * h;
  }
  // Wind drifts racers (a bit more in the air).
  if (c.winds.length) { const w = windAt(c, r.x, r.y + .8, r.z, t), k = r.grounded ? 1 : 1.3; r.x += w.vx * k * h; r.z += w.vz * k * h; }
  r.vy -= PC.gravity * h;
  const prevY = r.y, prevX = r.x, prevZ = r.z;
  r.x += r.vx * h; r.y += r.vy * h; r.z += r.vz * h;

  // Collisions with the course boxes.
  const wasGrounded = r.grounded, top = r.y + height(r);
  r.grounded = false;
  let wall = { box: -1, nx: 0, nz: 0 };
  c.boxes.forEach((b, i) => {
    // Cheap reject by the static z range first (boxes move by at most 4 m, never along z here).
    if (b.z1 + 4 < r.z - R || b.z0 - 4 > r.z + R) return;
    const bb = boxAt(b, t);
    if (bb.x1 < r.x - R || bb.x0 > r.x + R || bb.z1 < r.z - R || bb.z0 > r.z + R || bb.y0 > r.y + height(r)) return;
    const surface = surfaceAt(b, bb, g, r.x);
    if (surface < r.y - .001) return;
    if (!solid(b, g, t)) {
      // A hidden-path tile that does not carry gives way under the racer.
      if (b.tile !== undefined && g.tiles[b.tile] === "0" && prevY >= surface - .3 && r.y < surface) { g.tiles = g.tiles.slice(0, b.tile) + "2" + g.tiles.slice(b.tile + 1); emit(s, "tile", b.look === "tile" ? "Geisterplatte!" : "Falltür!", [r.id]); }
      return;
    }
    // Landing on top (also small steps and slopes).
    // Landing needs the feet above the top a sub-step ago; walking up steps needs ground contact.
    if (r.vy <= .01 && (prevY >= surface - .05 || (wasGrounded && surface - r.y <= PC.step))) {
      r.y = surface; r.vy = 0; r.grounded = true; r.ground = i; r.lastGround = t; r.standY = surface;
      if (b.tile !== undefined && g.tiles[b.tile] === "0") g.tiles = g.tiles.slice(0, b.tile) + "1" + g.tiles.slice(b.tile + 1);
      return;
    }
    // Head against the underside.
    if (r.vy > 0 && prevY + height(r) <= bb.y0 + .08) { r.y = bb.y0 - height(r); r.vy = 0; return; }
    if (top <= bb.y0 + .02) return;
    // Side contact: real doors break, solid ones are marked as tried, everything else pushes the racer out.
    if (b.door !== undefined && g.secretDoors) {
      if (g.secretDoors[b.door] === "1") {
        g.doors = g.doors.slice(0, b.door) + "1" + g.doors.slice(b.door + 1);
        emit(s, "door", "Tür auf!", [r.id]);
        return;
      }
      if (g.doors[b.door] === "0") { g.doors = g.doors.slice(0, b.door) + "2" + g.doors.slice(b.door + 1); emit(s, "solid", "Massiv!", [r.id]); }
    }
    // The racer is round: beside a corner it slides around it instead of snagging on flush boxes.
    const cx = Math.max(bb.x0, Math.min(bb.x1, r.x)), cz = Math.max(bb.z0, Math.min(bb.z1, r.z)), ex = r.x - cx, ez = r.z - cz, gap = Math.hypot(ex, ez);
    if (gap >= R) return;
    if (gap > 1e-6) {
      const nx = ex / gap, nz = ez / gap, into = r.vx * nx + r.vz * nz;
      r.x = cx + nx * R; r.z = cz + nz * R;
      if (into < 0) { r.vx -= into * nx; r.vz -= into * nz; }
      wall = Math.abs(nx) > Math.abs(nz) ? { box: i, nx: Math.sign(nx), nz: 0 } : { box: i, nx: 0, nz: Math.sign(nz) };
    } else {
      // Centre inside the box (fast or moving parts): out along the axis the racer came from, else the smaller overlap.
      const ox = Math.min(r.x + R - bb.x0, bb.x1 - (r.x - R)), oz = Math.min(r.z + R - bb.z0, bb.z1 - (r.z - R));
      const mid = { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 };
      const fromZ = prevZ <= bb.z0 || prevZ >= bb.z1, fromX = prevX <= bb.x0 || prevX >= bb.x1;
      if (fromX && !fromZ || (fromX === fromZ && ox < oz)) { const nx = r.x < mid.x ? -1 : 1; r.x = nx < 0 ? bb.x0 - R : bb.x1 + R; if (r.vx * nx < 0) r.vx = 0; wall = { box: i, nx, nz: 0 }; }
      else { const nz = r.z < mid.z ? -1 : 1; r.z = nz < 0 ? bb.z0 - R : bb.z1 + R; if (r.vz * nz < 0) r.vz = 0; wall = { box: i, nx: 0, nz }; }
    }
    // A pusher or roller running into the racer shoves it away instead of only blocking it.
    const push = b.move ? boxSpeed(b, t) : 0, along = wall.nx * (b.move?.axis === "x" ? push : 0) + wall.nz * (b.move?.axis === "z" ? push : 0);
    if (along > PC.shoveSpeed && r.pose !== "stun" && t >= r.hitUntil) {
      const k = Math.max(3.5, Math.min(6, along * .8));
      Object.assign(r, { vx: wall.nx * k, vz: wall.nz * k, vy: 2, pose: "stun", until: t + PC.shoveStunMs, hitUntil: t + PC.hitGuard, grounded: false, ground: -1, grab: undefined, duck: false });
      emit(s, "shove", "Weggeschoben!", [r.id]);
    }
  });
  if (r.grounded) {
    r.airDive = false;
    if (r.pose === "dive") { r.pose = "prone"; r.until = t + PC.proneMs; emit(s, "land", "", [r.id]); }
    else if (r.pose === "air") r.pose = "run";
  } else if (r.pose === "run") r.pose = "air";

  // Holding on to a ledge: falling past a wall whose edge is within reach, holding on or pushing into the wall.
  if (!r.grounded && r.vy <= .5 && (r.pose === "air" || r.pose === "dive")) {
    const ledge = ledgeFor(c, g, r, t, wall);
    const up = ledge && boxAt(c.boxes[ledge.box], t).y1 > (r.standY ?? r.y) + PC.step + .3;
    if (ledge && (grabHeld || (up && mx * -ledge.nx + mz * -ledge.nz > .5))) { Object.assign(r, { pose: "hang", hang: { ...ledge, since: t }, vx: 0, vy: 0, vz: 0, airDive: false }); emit(s, "grab", "Festgehalten!", [r.id]); }
  }
}

/** A wall edge the racer can hold on to: top between hip and above the head, racer right at its side. */
function ledgeFor(c: Course, g: ParcoursGame, r: Racer, t: number, touched: { box: number; nx: number; nz: number }) {
  const candidates = touched.box >= 0 ? [touched.box, ...c.boxes.keys()] : [...c.boxes.keys()];
  for (const i of candidates) {
    const b = c.boxes[i];
    // Walls, door posts and doors are not for climbing (no way round the doors over the top).
    if (b.seesaw !== undefined || b.tile !== undefined || b.door !== undefined || b.look === "wall" || b.move || !solid(b, g, t)) continue;
    const bb = boxAt(b, t), rise = bb.y1 - r.y;
    if (rise < PC.hangMin || rise > PC.hangMax) continue;
    const reach = R + PC.hangReach;
    if (r.x > bb.x0 && r.x < bb.x1) {
      if (r.z <= bb.z0 && bb.z0 - r.z <= reach) return { box: i, nx: 0, nz: -1 };
      if (r.z >= bb.z1 && r.z - bb.z1 <= reach) return { box: i, nx: 0, nz: 1 };
    }
    if (r.z > bb.z0 && r.z < bb.z1) {
      if (r.x <= bb.x0 && bb.x0 - r.x <= reach) return { box: i, nx: -1, nz: 0 };
      if (r.x >= bb.x1 && r.x - bb.x1 <= reach) return { box: i, nx: 1, nz: 0 };
    }
  }
  return undefined;
}

/** Speed of a moving box along its axis at time `t` (m/s). */
function boxSpeed(b: Box, t: number) {
  const m = b.move;
  return m ? m.amp * Math.cos(2 * Math.PI * t / m.period + m.phase) * 2 * Math.PI * 1000 / m.period : 0;
}

/**
 * Spinning bars are solid: they knock racers away unless they jump over low
 * ones or duck under high ones. A hit flings the racer ahead of the bar and
 * outwards; while it is still knocked the bar keeps pushing it (never passes
 * through). Resting bars only block.
 */
function sweep(s: MatchState<ParcoursGame>, c: Course, r: Racer, t: number) {
  if (r.pose === "hang" || r.pose === "climb") return;
  for (const sw of c.sweepers) {
    if (Math.abs(r.z - sw.z) > sw.length + 1 || Math.abs(r.x - sw.x) > sw.length + 1) continue;
    if (r.y >= sw.y1 || r.y + height(r) <= sw.y0) continue;
    const a = sweeperAngle(sw, t), dx = Math.cos(a), dz = Math.sin(a);
    const along = (r.x - sw.x) * dx + (r.z - sw.z) * dz, u = Math.max(-sw.length, Math.min(sw.length, along));
    const px = sw.x + dx * u, pz = sw.z + dz * u, ox = r.x - px, oz = r.z - pz, d = Math.hypot(ox, oz);
    if (d > PC.barReach) continue;
    const omega = t >= (sw.from ?? 0) ? sw.speed : 0;
    // Velocity of the bar at the contact point (perpendicular to the bar).
    const bvx = -dz * u * omega, bvz = dx * u * omega, bv = Math.hypot(bvx, bvz);
    // Push direction: ahead of the bar where it moves, otherwise straight away from it.
    const beyond = Math.abs(along) > sw.length;
    const [lx, lz] = !beyond && bv > .3 ? [bvx / bv, bvz / bv] : d > 1e-6 ? [ox / d, oz / d] : [-dz, dx];
    r.x = px + lx * (PC.barReach + .01); r.z = pz + lz * (PC.barReach + .01);
    if (bv <= .3) { const into = r.vx * lx + r.vz * lz; if (into < 0) { r.vx -= into * lx; r.vz -= into * lz; } continue; }
    const k = c.knock ?? 1, rx = r.x - sw.x, rz = r.z - sw.z, rn = Math.hypot(rx, rz) || 1;
    // One contact lasts while the bar keeps touching (being carried loosens it for a moment).
    if (r.barTouch === undefined || t - (r.barLast ?? -1e9) > 250) r.barTouch = t;
    r.barLast = t;
    if (t >= r.hitUntil && t - r.barTouch >= PC.barGrace) {
      const speed = Math.max(PC.knock * k, bv * 1.3);
      Object.assign(r, { vx: lx * speed + rx / rn * PC.fling * k, vz: lz * speed + rz / rn * PC.fling * k, vy: PC.knockUp * Math.max(.6, k), pose: "stun", until: t + PC.stunMs, hitUntil: t + PC.hitGuard, grounded: false, ground: -1, grab: undefined, duck: false, barTouch: undefined, barLast: undefined });
      emit(s, "hit", "Umgehauen!", [r.id]);
      return;
    }
    // Just touched (a jump or duck still escapes) or already knocked: the bar carries the racer in front of it.
    const ahead = r.vx * lx + r.vz * lz, want = bv * 1.15;
    if (ahead < want) { r.vx += lx * (want - ahead); r.vz += lz * (want - ahead); }
  }
}

function startGame(s: MatchState<ParcoursGame>, id: CourseId): ParcoursGame {
  const c = course(id), lanes = c.laneRows ?? [];
  const doorCount = c.doorRows.reduce((n, row) => n + row.doors.length, 0) + lanes.reduce((n, row) => n + row.lanes.length * 2, 0);
  const tileCount = c.tileRows.reduce((n, row) => n + row.tiles.length, 0) + lanes.reduce((n, row) => n + row.lanes.length, 0);
  const secretDoors = Array<string>(doorCount).fill("0");
  for (const row of c.doorRows) for (const door of shuffled(s, row.doors).slice(0, row.real)) secretDoors[door] = "1";
  const secretTiles = Array<string>(tileCount).fill("0");
  let col = randomInt(s, 0, 4);
  for (const row of c.tileRows) { secretTiles[row.tiles[col]] = "1"; col = Math.max(0, Math.min(4, col + randomInt(s, -1, 1))); }
  // Lanes: some lead on, some end at a solid exit, some drop through the floor, the rest stay shut.
  for (const row of lanes) shuffled(s, row.lanes).forEach((lane, i) => {
    const through = i < row.through, dead = !through && i < row.through + row.dead, trap = !through && !dead && i < row.through + row.dead + row.trap;
    secretDoors[lane.front] = through || dead || trap ? "1" : "0";
    secretDoors[lane.exit] = through ? "1" : "0";
    secretTiles[lane.floor] = trap ? "0" : "1";
  });
  const g: ParcoursGame = { course: id, racers: {}, order: [], doors: "0".repeat(doorCount), tiles: "0".repeat(tileCount), tilt: Array(c.seesaws).fill(0), secretDoors: secretDoors.join(""), secretTiles: secretTiles.join("") };
  s.players.forEach((p, i) => {
    const r: Racer = { id: p.id, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: 0, pose: "run", grounded: true, ground: -1, duck: false, until: 0, jumpAt: -1e9, diveAt: -1e9, airDive: false, lastGround: 0, grabSince: 0, grabReady: 0, checkpoint: 0, best: 0, falls: 0, respawnAt: 0, hitUntil: 0 };
    respawn(c, r, i, 0); r.y = c.checkpoints[0].y; g.racers[p.id] = r;
  });
  return g;
}

const FINAL_INSTRUCTION = "Stick zum Laufen (oben = von der Kamera weg), Springen über den niedrigen Balken, Ducken unter dem hohen, Hechten und Festhalten wie im Parcours. Wer fällt, scheidet aus. Wer zuletzt steht, gewinnt; nach 90 Sekunden gewinnen alle, die noch stehen.";
const INSTRUCTION = "Lauf selbst durch den Parcours: Stick zum Laufen und Lenken (oben = von der Kamera weg). Springen über Lücken und niedrige Balken, Hechten für einen weiten Satz nach vorn, Festhalten (halten) an anderen, um sie zu bremsen, Ducken (halten) unter hohen Balken durch. An hohe Kanten springst du und drückst den Stick zur Wand: Du hältst dich fest und kletterst hoch. Wer fällt, startet am letzten Kontrollpunkt. Die Reihenfolge im Ziel entscheidet, sonst der Fortschritt.";
const GOALS: Record<CourseId, { icon: string; action: string; extra: string }> = {
  proberaum:{icon:"⌸",action:"Frei ausprobieren",extra:"Alle Hindernisse auf einer Übungsinsel."},
  tuerenlotto: { icon: "▥", action: "Welche Tür geht auf?", extra: "Vier Reihen mit je sechs Türen: Nur manche brechen auf, die anderen sind massiv. Hinter manchen offenen Türen wartet ein Gang mit massivem Ausgang (Sackgasse) oder eine Falltür. Dazwischen Schieber, ein Drehbalken und ein Graben." },
  kreiselkurs: { icon: "✣", action: "Über und unter Balken", extra: "Drehende Balken in allen Varianten: über niedrige springen, unter hohen ducken, am Kreuz beides. Dazu wandernde Inseln, zwei flinke Wippen und am Ende ein Rührwerk aus schnellen Kurzbalken. Wer getroffen wird, fliegt nach vorn und außen weg." },
  wippenwerk: { icon: "⚖", action: "Balance und Kanten", extra: "Wippen neigen sich unter Gewicht, rollende Walzen musst du überspringen, zum Schluss eine Wand zum Festhalten und Hochziehen." },
  glibberflut: { icon: "♒", action: "Nach oben, schnell!", extra: "Langer Aufstieg über Treppen, Förderbänder gegen die Laufrichtung, fünf Kanten, rollende Walzen, schmale Stege und Fallklappen auf dem Dach, während von unten Glibber steigt – gegen Ende immer schneller. Wer erwischt wird, scheidet aus." },
  geisterpfad: { icon: "◌", action: "Finde den Pfad", extra: "Nur ein unsichtbarer Pfad aus Platten trägt; was einmal betreten wurde, bleibt für alle sichtbar." },
  fallklappen: { icon: "▦", action: "Achte aufs Warnlicht", extra: "Vier Klappenfelder über dem Abgrund, jedes schwerer: erst jede Klappe im eigenen Takt, dann schneller, dann ein Schachbrett, auf dem Nachbarn sich abwechseln, zuletzt ein schmaler Steg aus flinken Klappen mit Lücken. Kurz vor dem Öffnen glüht eine Klappe orange." },
  windkanal: { icon: "≋", action: "Gegen den Wind", extra: "Schmale Stege im wechselnden Seitenwind, Trittsteine im Dauerwind, eine Böenbrücke, wandernde Inseln im Gegenwind und zum Schluss eine schmale Rampe mit Gegenwind und Seitenböen." },
  kletterwand: { icon: "⌸", action: "Halt dich fest", extra: "Vier Stufen, jede zu hoch zum Springen: Spring an die Kante und drück den Stick zur Wand (oder halte Festhalten), dann kletterst du hoch. Die Griffblöcke verschwinden zwischendurch – wähle einen, der bleibt." },
  standhaft: { icon: "♛", action: "Bleib stehen", extra: "Finale auf Klappen unter zwei Drehbalken: Erst öffnet sich der äußere Ring, später auch die Mitte." }
};

/** One match module per run; all share the engine above. */
export function parcoursModule(id: CourseId): MatchModule<ParcoursGame> {
  const c = course(id), goal = GOALS[id];
  return {
    id,
    meta: {
      name: c.name, seconds: (c.limitMs ?? PC.maxMs) / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
      instruction: `${goal.extra} ${c.elimination ? FINAL_INSTRUCTION : INSTRUCTION}`,
      controls: "Stick laufen · Springen · Hechten · Festhalten (halten) · Ducken (halten).",
      look: { icon: goal.icon, action: goal.action, hint: "Stick · springen · hechten · festhalten · ducken", goal: c.elimination ? "Als Letzte stehen" : "Als Erste ins Ziel" }
    },
    create(s) { s.game = startGame(s, id); return s.game; },
    step(s, dt) {
      const g = s.game, h = dt / PC.substeps, slots = new Map(s.players.map((p, i) => [p.id, i]));
      for (let k = 1; k <= PC.substeps; k++) {
        const t = s.time - dt * 1000 + k * h * 1000;
        // Who is being held this sub-step (slowed down).
        const held = new Set(Object.values(g.racers).filter(r => r.grab).map(r => r.grab!));
        for (const p of s.players) if (!p.gone) moveRacer(s, c, p, g.racers[p.id], slots.get(p.id)!, held.has(p.id), h, t);
        for (const p of s.players) { const r = g.racers[p.id]; if (!p.gone && r.pose !== "done" && r.pose !== "out" && !r.respawnAt) sweep(s, c, r, t); }
        // Holding on: the held racer cannot get further away than an arm's length (both are pulled).
        for (const r of Object.values(g.racers)) {
          const o = r.grab ? g.racers[r.grab] : undefined;
          if (!o || o.respawnAt || o.pose === "hang") continue;
          const dx = o.x - r.x, dz = o.z - r.z, d = Math.hypot(dx, dz), slack = d - PC.tether;
          if (slack <= 0) continue;
          o.x -= dx / d * slack * .75; o.z -= dz / d * slack * .75; r.x += dx / d * slack * .25; r.z += dz / d * slack * .25;
        }
        // Racers bump into each other (same height band only).
        const live = s.players.map(p => g.racers[p.id]).filter(r => !s.players.find(q => q.id === r.id)!.gone && !r.respawnAt && r.pose !== "hang" && r.pose !== "out");
        for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
          const a = live[i], b = live[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d >= R * 2 || Math.abs(a.y - b.y) > 1.2 || a.pose === "done" || b.pose === "done") continue;
          const n = d || 1, push = (R * 2 - d) / 2, ux = d ? dx / n : 1, uz = d ? dz / n : 0;
          a.x -= ux * push; a.z -= uz * push; b.x += ux * push; b.z += uz * push;
        }
      }
      const t = s.time;
      for (const p of s.players) {
        const r = g.racers[p.id];
        if (p.gone || r.pose === "done" || r.pose === "out") continue;
        // Holding on to someone: in front, close, limited time.
        const input = inputOfPlayer(s, p);
        if (r.grab) {
          const o = g.racers[r.grab];
          if (!input.ha || !o || t - r.grabSince > PC.grabMs || Math.hypot(o.x - r.x, o.z - r.z) > 1.6 || o.pose === "done" || r.pose !== "run") { r.grab = undefined; r.grabReady = t + PC.grabCooldown; }
        } else if (input.ha && r.pose === "run" && r.grounded && t >= r.grabReady) {
          const fx = Math.sin(r.face), fz = Math.cos(r.face);
          const target = Object.values(g.racers).find(o => o.id !== r.id && o.pose !== "done" && o.pose !== "out" && !o.respawnAt && Math.abs(o.y - r.y) < 1 && Math.hypot(o.x - r.x, o.z - r.z) <= PC.grabRange && ((o.x - r.x) * fx + (o.z - r.z) * fz) > 0);
          if (target) { r.grab = target.id; r.grabSince = t; emit(s, "hold", "Erwischt!", [target.id, r.id]); }
        }
        // Falling, goo, checkpoints, progress, arrival.
        if (!r.respawnAt && r.y < c.killY) {
          r.falls++;
          // In a final a fall is the end; elsewhere back to the last checkpoint.
          if (c.elimination) { r.pose = "out"; r.outAt = t; emit(s, "out", "Raus!", [r.id]); }
          else { r.respawnAt = t + PC.respawnMs; r.pose = "air"; emit(s, "fall", "Abgestürzt!", [r.id]); }
          continue;
        }
        if (c.practice && !r.respawnAt && c.goo && r.y < gooAt(c,t)-.1) { r.falls++; r.respawnAt=t+PC.respawnMs; r.pose="air"; emit(s,"fall","Zurück zur Station",[r.id]); continue; }
        if (!c.practice && c.goo && r.y < gooAt(c, t) - .1) { r.pose = "out"; r.outAt = t; r.respawnAt = 0; emit(s, "out", "Vom Glibber erwischt!", [r.id]); continue; }
        if (r.respawnAt) continue;
        if (r.grounded && !c.practice) while (r.checkpoint + 1 < c.checkpoints.length && r.z >= c.checkpoints[r.checkpoint + 1].z) r.checkpoint++;
        r.best = Math.max(r.best, Math.min(c.finishZ, r.z));
        if (!c.practice && r.z >= c.finishZ && r.y >= c.finishY - .5) {
          Object.assign(r, { pose: "done", finishAt: t, vx: 0, vy: 0, vz: 0, grab: undefined, best: c.finishZ });
          g.order.push(r.id); g.firstFinish ??= t;
          emit(s, "finish", g.order.length === 1 ? "Erste im Ziel!" : `Im Ziel – Platz ${g.order.length}!`, [r.id]);
        }
      }
      // Seesaws lean towards the side with more weight on it.
      g.tilt = g.tilt.map((angle, i) => {
        const box = c.boxes.find(b => b.seesaw === i)!, cx = (box.x0 + box.x1) / 2;
        const load = Object.values(g.racers).filter(r => r.grounded && c.boxes[r.ground]?.seesaw === i).reduce((n, r) => n + (r.x - cx), 0);
        const target = Math.max(-PC.tiltMax, Math.min(PC.tiltMax, load * PC.tiltGain));
        return angle + (target - angle) * (1 - Math.exp(-PC.tiltRate * dt));
      });
      const active = s.players.filter(p => !p.gone).map(p => g.racers[p.id]);
      const standing = active.filter(r => r.pose !== "done" && r.pose !== "out").length;
      if (!c.practice && (standing === 0 || (c.elimination && standing <= 1 && s.players.length > 1) || (g.firstFinish !== undefined && t >= g.firstFinish + PC.finishGrace) || t >= (c.limitMs ?? PC.maxMs))) {
        s.done = true;
        if (c.elimination) emit(s, "finale", standing === 1 ? "Steht als Letzte!" : "Zeit um – alle Stehenden gewinnen", active.filter(r => r.pose !== "out").map(r => r.id));
      }
    },
    press(s, p, kind, at) {
      const r = s.game.racers[p.id];
      if (!r || p.gone) return;
      if (kind === "a") r.jumpAt = at; else if (kind === "b") r.diveAt = at;
    },
    remove(s, id) { const r = s.game.racers[id]; if (r && r.pose !== "done") { r.pose = "out"; r.outAt = s.time; } },
    standings(s) {
      const g = s.game;
      // Finals: still standing first, then who fell later.
      if (c.elimination) return rank(s.players.map(p => {
        const r = g.racers[p.id], survived = Math.round((r.outAt ?? s.time) / 1000);
        return { id: p.id, score: survived, detail: r.outAt === undefined ? "steht noch" : `${survived} s gestanden`, keys: [presence(p), r.outAt === undefined ? 1 : 0, r.outAt ?? 0] };
      }));
      return rank(s.players.map(p => {
        const r = g.racers[p.id], place = g.order.indexOf(p.id), done = place >= 0;
        return { id: p.id, score: Math.round(r.best), detail: done ? `im Ziel als ${place + 1}.` : `${Math.round(r.best)} m · ${r.falls}× gefallen`,
          keys: [presence(p), done ? 1 : 0, done ? -place : 0, r.pose === "out" ? 0 : 1, Math.round(r.best * 10)] };
      }));
    },
    finish(s) { s.done = true; },
    view(s) { delete s.game.secretDoors; delete s.game.secretTiles; },
    bot(s, botId) { return parcoursBot(s, c, botId); }
  };
}

/** Bots: run forward, pick doors, tiles and holds, avoid opening trapdoors, lean into wind, jump gaps and low bars, duck high bars, climb ledges. */
function parcoursBot(s: MatchState<ParcoursGame>, c: Course, id: string) {
  const g = s.game, r = g.racers[id], t = s.time;
  if (!r || r.pose === "done" || r.pose === "out" || r.respawnAt) return {};
  const salt = hash(`${id}:${Math.floor(t / 1600)}`);
  // Is (x, z) on a box that will still carry in `soon` ms (and is not warning)?
  const safeAt = (x: number, z: number, soon = 600) => c.boxes.some(b => {
    const bb = boxAt(b, t);
    return x >= bb.x0 + .15 && x <= bb.x1 - .15 && z >= bb.z0 && z <= bb.z1 && bb.y1 <= r.y + .4 && bb.y1 >= r.y - 1.2 && solid(b, g, t) && solid(b, g, t + soon) && !blinkWarn(b, t);
  });
  let tx = Math.max(-3.5, Math.min(3.5, ((hash(id) % 7) - 3) * .9)), mz = 1;
  if (c.elimination) {
    // Final: head for the safest plate near the middle; stay put while it holds.
    let best = { x: r.x, z: r.z, score: -Infinity };
    for (const b of c.boxes) {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (!solid(b, g, t) || !solid(b, g, t + 1200) || blinkWarn(b, t)) continue;
      const score = -Math.hypot(cx - r.x, cz - r.z) * .6 - Math.hypot(cx, cz - 5) * .3 + (salt % 5) * .01;
      if (score > best.score) best = { x: cx, z: cz, score };
    }
    const dx = best.x - r.x, dz = best.z - r.z, d = Math.hypot(dx, dz);
    const sweepers = sweeperDanger(c, r, t);
    return { x: d > .3 ? dx / d : 0, y: d > .3 ? -dz / d : 0, pressA: sweepers.jump && r.grounded, hb: sweepers.duck };
  }
  // Doors ahead: an opened one, otherwise a guess among the untried ones that changes now and then.
  const row = c.doorRows.find(dr => dr.z > r.z - .5 && dr.z - r.z < 7);
  if (row) {
    const open = row.doors.findIndex(d => g.doors[d] === "1"), untried = row.doors.map((_, i) => i).filter(i => g.doors[row.doors[i]] !== "2");
    tx = row.xs[open >= 0 ? open : untried[salt % Math.max(1, untried.length)] ?? 0];
  }
  // Lanes: back out of a dead end, otherwise prefer lanes known to lead on, then open ones, then untried doors.
  const lanes = (c.laneRows ?? []).find(lr => lr.exitZ + .5 > r.z - .3 && lr.z - r.z < 7);
  if (lanes) {
    const pitch = Math.abs(lanes.lanes[1].x - lanes.lanes[0].x), here = lanes.lanes.find(l => Math.abs(l.x - r.x) < pitch / 2);
    if (here && r.z > lanes.z + .2 && r.z < lanes.exitZ + .3) { tx = here.x; if (g.doors[here.exit] === "2") mz = -1; }
    else {
      const worth = (l: typeof lanes.lanes[number]) => g.tiles[l.floor] === "2" || g.doors[l.front] === "2" || g.doors[l.exit] === "2" ? 0 : g.doors[l.exit] === "1" ? 3 : g.doors[l.front] === "1" ? 2 : 1;
      const best = Math.max(...lanes.lanes.map(worth)), picks = lanes.lanes.filter(l => worth(l) === best);
      tx = picks[salt % picks.length].x;
    }
  }
  // Hidden path: a tile known to carry, otherwise a guess that is not known to fail.
  const tiles = c.tileRows.find(tr => tr.z + 1.8 > r.z + .2 && tr.z - r.z < 2.5);
  if (tiles) { const safe = tiles.tiles.find(i => g.tiles[i] === "1"), maybe = tiles.tiles.filter(i => g.tiles[i] !== "2"); const pick = safe ?? maybe[salt % Math.max(1, maybe.length)] ?? tiles.tiles[2]; tx = -3.6 + 1.8 * tiles.tiles.indexOf(pick); }
  // Seesaws and narrow walkways: stay on the boxes ahead.
  if (c.boxes.some(b => b.seesaw !== undefined && r.z > b.z0 - 1 && r.z < b.z1)) tx = 0;
  // Stay on the box underfoot (narrow walkways), then aim for the next one ahead.
  const under = r.grounded && r.ground >= 0 ? c.boxes[r.ground] : undefined;
  if (under && under.x1 - under.x0 < 9) tx = Math.max(under.x0 + .6, Math.min(under.x1 - .6, tx));
  // In the air the bot keeps aiming at boxes at the height it jumped from (not at what it flies over).
  const base = r.grounded ? r.y : Math.min(r.y, r.standY ?? r.y);
  const ahead = c.boxes.filter(b => b.z0 >= r.z - .1 && b.z0 < r.z + 3 && b.y1 <= base + .4 && b.y1 >= base - .6 && b.look !== "wall" && b.door === undefined);
  ahead.sort((a, b) => a.z0 - b.z0 || Math.abs((a.x0 + a.x1) / 2 - r.x) - Math.abs((b.x0 + b.x1) / 2 - r.x));
  if (ahead.length && !ahead.some(b => tx >= b.x0 + .3 && tx <= b.x1 - .3)) { const b = ahead[0]; tx = (b.x0 + b.x1) / 2; }
  // Moving island ahead across a gap: wait at the edge until it will be in front, then aim where it will be.
  const island = ahead.find(b => b.move && b.move.axis === "x" && b.z0 > r.z);
  if (island && r.grounded && island.z0 - r.z < 2.6) {
    const soon = boxAt(island, t + 500), lead = (soon.x0 + soon.x1) / 2;
    if (r.x > soon.x0 + .5 && r.x < soon.x1 - .5) tx = lead; else { tx = r.x; mz = 0; }
  }
  // Holds: the block of the next level that is there and stays.
  const holds = c.boxes.filter(b => b.look === "hold" && b.z0 > r.z - .2 && b.z0 - r.z < 3 && b.y1 > r.y + .5);
  if (holds.length) { const ok = holds.filter(b => solid(b, g, t) && solid(b, g, t + 1500) && !blinkWarn(b, t)); const pick = (ok.length ? ok : holds).sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - r.x) - Math.abs((b.x0 + b.x1) / 2 - r.x))[0]; tx = (pick.x0 + pick.x1) / 2; }
  // Trapdoors: wait while the plate ahead is warning or open.
  // (Only a trapdoor right ahead that is warning, open or about to open makes a bot wait.)
  const trapAhead = c.boxes.find(b => { if (b.look !== "trap") return false; const z = r.z + 1.8; return tx >= b.x0 && tx <= b.x1 && z >= b.z0 && z <= b.z1; });
  if (trapAhead && r.grounded && (!solid(trapAhead, g, t) || !solid(trapAhead, g, t + 700) || blinkWarn(trapAhead, t))) mz = safeAt(r.x, r.z, 300) ? 0 : 1;
  // Steer towards the target lane and against the wind (velocity wanted, as a share of running speed).
  const wind = windAt(c, r.x, r.y + .8, r.z, t);
  const wantX = Math.max(-PC.run, Math.min(PC.run, (tx - r.x) * 3 - wind.vx)), wantZ = mz * PC.run * .8 - wind.vz;
  const n = Math.max(PC.run, Math.hypot(wantX, wantZ));
  const dx = wantX / n, fz = wantZ / n;
  // Look ahead: no ground → jump; bars; wall with an edge → jump and hold.
  const groundAhead = (step: number) => c.boxes.some(b => { if (!solid(b, g, t)) return false; const bb = boxAt(b, t); const x = r.x, z = r.z + step; return x >= bb.x0 - .1 && x <= bb.x1 + .1 && z >= bb.z0 && z <= bb.z1 && bb.y1 <= r.y + .4 && bb.y1 >= r.y - 1.2; });
  const sweepers = sweeperDanger(c, r, t);
  let jump = fz > .1 && r.grounded && (!groundAhead(.9) || !groundAhead(1.4)) || sweepers.jump && r.grounded;
  const wall = c.boxes.find(b => { if (!solid(b, g, t) || b.door !== undefined) return false; const bb = boxAt(b, t); return r.x > bb.x0 && r.x < bb.x1 && bb.z0 - r.z > 0 && bb.z0 - r.z < 1.2 && bb.y1 - r.y > PC.step && bb.y1 - r.y <= PC.hangMax; });
  if (wall && boxAt(wall, t).y1 - r.y > .5) jump = r.grounded;
  // Rollers close by: hop over them.
  if (c.boxes.some(b => b.look === "roller" && (() => { const bb = boxAt(b, t + 200); return r.z + 1.3 > bb.z0 && r.z < bb.z1 + .2 && r.x + 1 > bb.x0 && r.x - 1 < bb.x1; })())) jump = r.grounded;
  return { x: dx, y: -fz, pressA: jump && !sweepers.duck, hb: sweepers.duck, ha: !!wall || r.pose === "hang" || holds.length > 0 };
}

/** Spinning bars that will reach the racer shortly: jump over low ones, duck under high ones. */
function sweeperDanger(c: Course, r: Racer, t: number) {
  let jump = false, duck = false;
  for (const sw of c.sweepers) {
    if (Math.hypot(r.x - sw.x, r.z - sw.z) > sw.length + .8) continue;
    const a = sweeperAngle(sw, t + 250), dx = Math.cos(a), dz = Math.sin(a), u = Math.max(-sw.length, Math.min(sw.length, (r.x - sw.x) * dx + (r.z - sw.z) * dz));
    if (Math.hypot(r.x - sw.x - dx * u, r.z - sw.z - dz * u) > 1.1) continue;
    if (sw.y1 <= .8) jump = true; else duck = true;
  }
  return { jump, duck };
}

export const PARCOURS_IDS = COURSE_IDS;

/**
 * Racer a device shows: its own while it is still racing; afterwards (or as a
 * spectator) the racer in player slot `slot` if still racing, else the leader.
 */
export function shownRacer(g: ParcoursGame, players: readonly { id: string }[], viewer: string, slot?: number) {
  const own = g.racers[viewer];
  if (own && own.pose !== "done" && own.pose !== "out") return own;
  const racing = players.map(p => g.racers[p.id]).filter(r => r && r.pose !== "done" && r.pose !== "out");
  const chosen = slot !== undefined ? g.racers[players[slot]?.id ?? ""] : undefined;
  if (chosen && racing.includes(chosen)) return chosen;
  return [...racing].sort((a, b) => b.best - a.best)[0] ?? own ?? Object.values(g.racers)[0];
}
export { FINAL_IDS } from "./parcoursCourses";
