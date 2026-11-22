import type { Box, Sweeper, Wind } from "./parcoursCourses";

/**
 * Quarter turns in the plan for courses that wind (serpentines). A stretch is
 * built in its own frame – forward is +z, sideways x, as in every straight
 * course – and turned into place: `k` = 0 keeps +z, 1 turns forward to +x,
 * 2 to −z, 3 to −x. The same turns bring the world back into a stretch's frame
 * for the bots. Turns keep the handedness, so spinning bars keep their sense.
 */
export type Quarter = 0 | 1 | 2 | 3;
const norm = (k: number) => (((k % 4) + 4) % 4) as Quarter;
/** One quarter turn: local (x, z) → (z, −x). */
function turn1(x: number, z: number): [number, number] { return [z, -x]; }
export function turnPoint(x: number, z: number, k: number): [number, number] {
  let p: [number, number] = [x, z];
  for (let i = 0; i < norm(k); i++) p = turn1(p[0], p[1]);
  return p;
}
/** Facing (0 = +z, positive towards +x) after `k` quarter turns. */
export const turnFace = (face: number, k: number) => face + norm(k) * Math.PI / 2;
/** Heading of a stretch as quarter turns from +z. */
export function quarterOf(dx: number, dz: number): Quarter {
  if (Math.abs(dz) >= Math.abs(dx)) return dz >= 0 ? 0 : 2;
  return dx > 0 ? 1 : 3;
}

export function turnBox(b: Box, k: number, ox = 0, oz = 0): Box {
  const q = norm(k);
  if (!q && !ox && !oz) return b;
  const [ax, az] = turnPoint(b.x0, b.z0, q), [bx, bz] = turnPoint(b.x1, b.z1, q);
  const out: Box = { ...b, x0: Math.min(ax, bx) + ox, x1: Math.max(ax, bx) + ox, z0: Math.min(az, bz) + oz, z1: Math.max(az, bz) + oz };
  if (b.move && b.move.axis !== "y") {
    const [mx, mz] = turnPoint(b.move.axis === "x" ? b.move.amp : 0, b.move.axis === "z" ? b.move.amp : 0, q);
    out.move = Math.abs(mx) > Math.abs(mz) ? { ...b.move, axis: "x", amp: mx } : { ...b.move, axis: "z", amp: mz };
  }
  if (b.belt || b.beltX) {
    const [vx, vz] = turnPoint(b.beltX ?? 0, b.belt ?? 0, q);
    out.belt = Math.abs(vz) > 1e-9 ? vz : undefined; out.beltX = Math.abs(vx) > 1e-9 ? vx : undefined;
  }
  return out;
}
export function turnSweeper(sw: Sweeper, k: number, ox = 0, oz = 0): Sweeper {
  const [x, z] = turnPoint(sw.x, sw.z, k);
  return { ...sw, x: x + ox, z: z + oz, phase: sw.phase - norm(k) * Math.PI / 2 };
}
export function turnWind(w: Wind, k: number, ox = 0, oz = 0): Wind {
  const [ax, az] = turnPoint(w.x0, w.z0, k), [bx, bz] = turnPoint(w.x1, w.z1, k), [vx, vz] = turnPoint(w.vx, w.vz, k);
  return { ...w, x0: Math.min(ax, bx) + ox, x1: Math.max(ax, bx) + ox, z0: Math.min(az, bz) + oz, z1: Math.max(az, bz) + oz, vx, vz };
}
