import { boxAt, course, COURSE_IDS, gooAt, sweeperAngle, type Box, type Course, type CourseId } from "./parcoursCourses";
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
  knock: 8.5, knockUp: 4.5, stunMs: 650, hitGuard: 800, barRadius: .22,
  respawnMs: 1100, finishGrace: 20000, maxMs: 120000, substeps: 3,
  tiltGain: .16, tiltMax: .42, tiltRate: 2, tiltSlide: .55
} as const;

export type Pose = "run" | "air" | "dive" | "prone" | "hang" | "stun" | "done" | "out";
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
  finishAt?: number; outAt?: number;
}
export interface ParcoursGame {
  course: CourseId;
  racers: Record<string, Racer>;
  /** Arrival order. */
  order: string[];
  /** Public door state per panel: "1" = broken open. */
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
/** Whether a box blocks racers. Secret parts count as solid where the secret is unknown (bots, devices). */
export function solid(b: Box, g: ParcoursGame) {
  if (b.door !== undefined) return g.doors[b.door] !== "1";
  if (b.tile !== undefined) return g.secretTiles ? g.secretTiles[b.tile] === "1" : g.tiles[b.tile] !== "2";
  return true;
}

function respawn(c: Course, r: Racer, slot: number, t: number) {
  const cp = c.checkpoints[r.checkpoint];
  // Side by side within three metres, so every checkpoint platform holds all six.
  Object.assign(r, { x: -1.5 + (slot % 6) * .6, y: cp.y + .05, z: cp.z, vx: 0, vy: 0, vz: 0, face: 0, pose: "run", grounded: false, ground: -1, duck: false, hang: undefined, grab: undefined, respawnAt: 0, airDive: false, until: 0, lastGround: t });
}

function moveRacer(s: MatchState<ParcoursGame>, c: Course, p: MatchPlayer, r: Racer, slot: number, held: boolean, h: number, t: number) {
  const g = s.game;
  if (r.pose === "done" || r.pose === "out") return;
  if (r.respawnAt) { if (t >= r.respawnAt) respawn(c, r, slot, t); else return; }
  const input = inputOfPlayer(s, p), mx = input.x, mz = -input.y, mag = Math.min(1, Math.hypot(mx, mz)), grabHeld = input.ha;

  // Hanging on a ledge: hold on, pull up (jump or stick towards the wall) or let go.
  if (r.pose === "hang" && r.hang) {
    const b = c.boxes[r.hang.box], bb = boxAt(b, t), { nx, nz } = r.hang;
    if (!grabHeld || t - r.hang.since > PC.hangMaxMs) {
      Object.assign(r, { pose: "air", vx: nx * 1.2, vz: nz * 1.2, vy: 0, hang: undefined });
    } else if (t - r.jumpAt <= PC.buffer || mx * -nx + mz * -nz > .3) {
      // Pull up onto the top, one step away from the edge.
      Object.assign(r, { pose: "run", y: bb.y1, vx: 0, vy: 0, vz: 0, grounded: true, ground: r.hang.box, lastGround: t, hang: undefined, jumpAt: -1e9 });
      if (nz) r.z = nz < 0 ? bb.z0 + R + .1 : bb.z1 - R - .1; else r.x = nx < 0 ? bb.x0 + R + .1 : bb.x1 - R - .1;
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
  r.vy -= PC.gravity * h;
  const prevY = r.y;
  r.x += r.vx * h; r.y += r.vy * h; r.z += r.vz * h;

  // Collisions with the course boxes.
  const wasGrounded = r.grounded, top = r.y + height(r);
  r.grounded = false;
  let wall: { box: number; nx: number; nz: number } | undefined;
  c.boxes.forEach((b, i) => {
    // Cheap reject by the static z range first (boxes move by at most 4 m, never along z here).
    if (b.z1 + 4 < r.z - R || b.z0 - 4 > r.z + R) return;
    const bb = boxAt(b, t);
    if (bb.x1 < r.x - R || bb.x0 > r.x + R || bb.z1 < r.z - R || bb.z0 > r.z + R || bb.y0 > r.y + height(r)) return;
    const surface = surfaceAt(b, bb, g, r.x);
    if (surface < r.y - .001) return;
    if (!solid(b, g)) {
      // A hidden-path tile that does not carry gives way under the racer.
      if (b.tile !== undefined && g.tiles[b.tile] === "0" && prevY >= surface - .3 && r.y < surface) { g.tiles = g.tiles.slice(0, b.tile) + "2" + g.tiles.slice(b.tile + 1); emit(s, "tile", "Geisterplatte!", [r.id]); }
      return;
    }
    // Landing on top (also small steps and slopes).
    if (r.vy <= .01 && (prevY >= surface - .25 || (wasGrounded && surface - r.y <= PC.step))) {
      r.y = surface; r.vy = 0; r.grounded = true; r.ground = i; r.lastGround = t;
      if (b.tile !== undefined && g.tiles[b.tile] === "0") g.tiles = g.tiles.slice(0, b.tile) + "1" + g.tiles.slice(b.tile + 1);
      return;
    }
    // Head against the underside.
    if (r.vy > 0 && prevY + height(r) <= bb.y0 + .08) { r.y = bb.y0 - height(r); r.vy = 0; return; }
    if (top <= bb.y0 + .02) return;
    // Side contact: real doors break, everything else pushes the racer out.
    if (b.door !== undefined && g.secretDoors?.[b.door] === "1") {
      g.doors = g.doors.slice(0, b.door) + "1" + g.doors.slice(b.door + 1);
      emit(s, "door", "Tür auf!", [r.id]);
      return;
    }
    const ox = Math.min(r.x + R - bb.x0, bb.x1 - (r.x - R)), oz = Math.min(r.z + R - bb.z0, bb.z1 - (r.z - R));
    const mid = { x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2 };
    if (ox < oz) { const nx = r.x < mid.x ? -1 : 1; r.x = nx < 0 ? bb.x0 - R : bb.x1 + R; if (r.vx * nx < 0) r.vx = 0; wall = { box: i, nx, nz: 0 }; }
    else { const nz = r.z < mid.z ? -1 : 1; r.z = nz < 0 ? bb.z0 - R : bb.z1 + R; if (r.vz * nz < 0) r.vz = 0; wall = { box: i, nx: 0, nz }; }
  });
  if (r.grounded) {
    r.airDive = false;
    if (r.pose === "dive") { r.pose = "prone"; r.until = t + PC.proneMs; emit(s, "land", "", [r.id]); }
    else if (r.pose === "air") r.pose = "run";
  } else if (r.pose === "run") r.pose = "air";

  // Holding on to a ledge: falling past a wall whose edge is within reach.
  if (grabHeld && !r.grounded && r.vy <= .5 && (r.pose === "air" || r.pose === "dive")) {
    const ledge = ledgeFor(c, g, r, t, wall);
    if (ledge) { Object.assign(r, { pose: "hang", hang: { ...ledge, since: t }, vx: 0, vy: 0, vz: 0, airDive: false }); emit(s, "grab", "Festgehalten!", [r.id]); }
  }
}

/** A wall edge the racer can hold on to: top between hip and above the head, racer right at its side. */
function ledgeFor(c: Course, g: ParcoursGame, r: Racer, t: number, touched?: { box: number; nx: number; nz: number }) {
  const candidates = touched ? [touched.box, ...c.boxes.keys()] : [...c.boxes.keys()];
  for (const i of candidates) {
    const b = c.boxes[i];
    if (b.seesaw !== undefined || b.tile !== undefined || !solid(b, g)) continue;
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

/** Spinning bars knock racers away unless they jump over low ones or duck under high ones. */
function sweep(s: MatchState<ParcoursGame>, c: Course, r: Racer, t: number) {
  if (t < r.hitUntil || r.pose === "hang") return;
  for (const sw of c.sweepers) {
    if (Math.abs(r.z - sw.z) > sw.length + 1) continue;
    const a = sweeperAngle(sw, t), dx = Math.cos(a), dz = Math.sin(a);
    const u = Math.max(-sw.length, Math.min(sw.length, (r.x - sw.x) * dx + (r.z - sw.z) * dz));
    const px = sw.x + dx * u, pz = sw.z + dz * u;
    if (Math.hypot(r.x - px, r.z - pz) > R + PC.barRadius) continue;
    if (r.y >= sw.y1 || r.y + height(r) <= sw.y0) continue;
    // Pushed along the bar's motion at the contact point.
    const vx = -dz * u * sw.speed, vz = dx * u * sw.speed, n = Math.hypot(vx, vz);
    // Near the axis the bar barely moves: push straight away from it instead.
    const ax = r.x - px, az = r.z - pz, an = Math.hypot(ax, az) || 1;
    const [kx, kz] = n > .2 ? [vx / n, vz / n] : [ax / an || 1, az / an];
    Object.assign(r, { vx: kx * PC.knock, vz: kz * PC.knock, vy: PC.knockUp, pose: "stun", until: t + PC.stunMs, hitUntil: t + PC.hitGuard, grounded: false, ground: -1, grab: undefined, duck: false });
    emit(s, "hit", "Umgehauen!", [r.id]);
    return;
  }
}

function startGame(s: MatchState<ParcoursGame>, id: CourseId): ParcoursGame {
  const c = course(id), doorCount = c.doorRows.reduce((n, row) => n + row.doors.length, 0), tileCount = c.tileRows.reduce((n, row) => n + row.tiles.length, 0);
  const secretDoors = Array<string>(doorCount).fill("0");
  for (const row of c.doorRows) for (const door of shuffled(s, row.doors).slice(0, row.real)) secretDoors[door] = "1";
  const secretTiles = Array<string>(tileCount).fill("0");
  let col = randomInt(s, 0, 4);
  for (const row of c.tileRows) { secretTiles[row.tiles[col]] = "1"; col = Math.max(0, Math.min(4, col + randomInt(s, -1, 1))); }
  const g: ParcoursGame = { course: id, racers: {}, order: [], doors: "0".repeat(doorCount), tiles: "0".repeat(tileCount), tilt: Array(c.seesaws).fill(0), secretDoors: secretDoors.join(""), secretTiles: secretTiles.join("") };
  s.players.forEach((p, i) => {
    const r: Racer = { id: p.id, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, face: 0, pose: "run", grounded: true, ground: -1, duck: false, until: 0, jumpAt: -1e9, diveAt: -1e9, airDive: false, lastGround: 0, grabSince: 0, grabReady: 0, checkpoint: 0, best: 0, falls: 0, respawnAt: 0, hitUntil: 0 };
    respawn(c, r, i, 0); r.y = c.checkpoints[0].y; g.racers[p.id] = r;
  });
  return g;
}

const INSTRUCTION = "Lauf selbst durch den Parcours: Stick zum Laufen und Lenken (oben = von der Kamera weg). Springen über Lücken und niedrige Balken, Hechten für einen weiten Satz nach vorn, Festhalten (halten) an Kanten zum Hochziehen oder an anderen, um sie zu bremsen, Ducken (halten) unter hohen Balken durch. Wer fällt, startet am letzten Kontrollpunkt. Die Reihenfolge im Ziel entscheidet, sonst der Fortschritt.";
const GOALS: Record<CourseId, { icon: string; action: string; extra: string }> = {
  tuerenlotto: { icon: "▥", action: "Welche Tür geht auf?", extra: "Drei Türreihen: Nur manche Türen brechen auf, die anderen sind massiv. Dazwischen Schieber und ein Graben." },
  kreiselkurs: { icon: "✣", action: "Über und unter Balken", extra: "Drehende Balken: über niedrige springen, unter hohen ducken. Dazwischen wandernde Inseln über dem Abgrund." },
  wippenwerk: { icon: "⚖", action: "Balance und Kanten", extra: "Wippen neigen sich unter Gewicht, rollende Walzen musst du überspringen, zum Schluss eine Wand zum Festhalten und Hochziehen." },
  glibberflut: { icon: "♒", action: "Nach oben, schnell!", extra: "Aufstieg über Treppen, Förderbänder gegen die Laufrichtung und Kanten, während von unten Glibber steigt. Wer erwischt wird, scheidet aus." },
  geisterpfad: { icon: "◌", action: "Finde den Pfad", extra: "Nur ein unsichtbarer Pfad aus Platten trägt; was einmal betreten wurde, bleibt für alle sichtbar." }
};

/** One match module per run; all share the engine above. */
export function parcoursModule(id: CourseId): MatchModule<ParcoursGame> {
  const c = course(id), goal = GOALS[id];
  return {
    id,
    meta: {
      name: c.name, seconds: PC.maxMs / 1000 + 2, players: [2, 3, 4, 5, 6], hz: 20,
      instruction: `${goal.extra} ${INSTRUCTION}`,
      controls: "Stick laufen · Springen · Hechten · Festhalten (halten) · Ducken (halten).",
      look: { icon: goal.icon, action: goal.action, hint: "Stick · springen · hechten · festhalten · ducken", goal: "Als Erste ins Ziel" }
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
        if (!r.respawnAt && r.y < c.killY) { r.falls++; r.respawnAt = t + PC.respawnMs; r.pose = "air"; emit(s, "fall", "Abgestürzt!", [r.id]); continue; }
        if (c.goo && r.y < gooAt(c, t) - .1) { r.pose = "out"; r.outAt = t; r.respawnAt = 0; emit(s, "out", "Vom Glibber erwischt!", [r.id]); continue; }
        if (r.respawnAt) continue;
        if (r.grounded) while (r.checkpoint + 1 < c.checkpoints.length && r.z >= c.checkpoints[r.checkpoint + 1].z) r.checkpoint++;
        r.best = Math.max(r.best, Math.min(c.finishZ, r.z));
        if (r.z >= c.finishZ && r.y >= c.finishY - .5) {
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
      if (active.every(r => r.pose === "done" || r.pose === "out") || (g.firstFinish !== undefined && t >= g.firstFinish + PC.finishGrace) || t >= PC.maxMs) s.done = true;
    },
    press(s, p, kind, at) {
      const r = s.game.racers[p.id];
      if (!r || p.gone) return;
      if (kind === "a") r.jumpAt = at; else if (kind === "b") r.diveAt = at;
    },
    remove(s, id) { const r = s.game.racers[id]; if (r && r.pose !== "done") { r.pose = "out"; r.outAt = s.time; } },
    standings(s) {
      const g = s.game;
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

/** Bots: run forward, pick doors and tiles, jump gaps and low bars, duck high bars, climb ledges. */
function parcoursBot(s: MatchState<ParcoursGame>, c: Course, id: string) {
  const g = s.game, r = g.racers[id], t = s.time;
  if (!r || r.pose === "done" || r.pose === "out" || r.respawnAt) return {};
  const salt = hash(`${id}:${Math.floor(t / 1600)}`);
  let tx = Math.max(-3.5, Math.min(3.5, ((hash(id) % 7) - 3) * .9));
  // Doors ahead: an opened one, otherwise a guess that changes now and then.
  const row = c.doorRows.find(dr => dr.z > r.z - .5 && dr.z - r.z < 7);
  if (row) { const open = row.doors.find(d => g.doors[d] === "1"); tx = -4 + 2 * row.doors.indexOf(open ?? row.doors[salt % 5]); }
  // Hidden path: a tile known to carry, otherwise a guess that is not known to fail.
  const tiles = c.tileRows.find(tr => tr.z + 1.8 > r.z + .2 && tr.z - r.z < 2.5);
  if (tiles) { const safe = tiles.tiles.find(i => g.tiles[i] === "1"), maybe = tiles.tiles.filter(i => g.tiles[i] !== "2"); const pick = safe ?? maybe[salt % Math.max(1, maybe.length)] ?? tiles.tiles[2]; tx = -3.6 + 1.8 * tiles.tiles.indexOf(pick); }
  // Seesaws: stay near the middle.
  if (c.boxes.some(b => b.seesaw !== undefined && r.z > b.z0 - 1 && r.z < b.z1)) tx = 0;
  // In front of a closed door with another door in mind: step back and sideways first.
  const blockedDoor = row && Math.abs(tx - r.x) > .4 && row.z - r.z < .9;
  const dx = tx - r.x, mz = r.pose === "hang" ? 1 : blockedDoor ? -.3 : Math.abs(dx) > 1.2 && row ? .35 : 1, n = Math.hypot(dx * .8, mz);
  // Look ahead: no ground → jump; low bar → jump; high bar → duck; wall with an edge → jump and hold.
  const groundAhead = (ahead: number) => c.boxes.some(b => { if (!solid(b, g)) return false; const bb = boxAt(b, t); const x = r.x, z = r.z + ahead; return x >= bb.x0 - .1 && x <= bb.x1 + .1 && z >= bb.z0 && z <= bb.z1 && bb.y1 <= r.y + .4 && bb.y1 >= r.y - 1.2; });
  let jump = r.grounded && (!groundAhead(.9) || !groundAhead(1.4));
  let duck = false;
  for (const sw of c.sweepers) {
    if (Math.abs(sw.z - r.z) > sw.length + .8 || Math.hypot(r.x - sw.x, r.z - sw.z) > sw.length + .8) continue;
    const a = sweeperAngle(sw, t + 250), dxs = Math.cos(a), dzs = Math.sin(a), u = Math.max(-sw.length, Math.min(sw.length, (r.x - sw.x) * dxs + (r.z - sw.z) * dzs));
    if (Math.hypot(r.x - sw.x - dxs * u, r.z - sw.z - dzs * u) > 1.1) continue;
    if (sw.y1 <= .8) jump = r.grounded; else duck = true;
  }
  const wall = c.boxes.find(b => { if (!solid(b, g) || b.door !== undefined) return false; const bb = boxAt(b, t); return r.x > bb.x0 && r.x < bb.x1 && bb.z0 - r.z > 0 && bb.z0 - r.z < 1.2 && bb.y1 - r.y > PC.step && bb.y1 - r.y <= PC.hangMax; });
  if (wall && boxAt(wall, t).y1 - r.y > .5) jump = r.grounded;
  // Pushers and rollers close by: hop over low ones.
  const pusher = c.boxes.find(b => (b.look === "roller") && (() => { const bb = boxAt(b, t + 200); return r.z + 1.3 > bb.z0 && r.z < bb.z1 + .2 && r.x + 1 > bb.x0 && r.x - 1 < bb.x1; })());
  if (pusher) jump = r.grounded;
  return { x: dx * .8 / n, y: -mz / n, pressA: jump && !duck, hb: duck, ha: !!wall || r.pose === "hang" };
}

export const PARCOURS_IDS = COURSE_IDS;
