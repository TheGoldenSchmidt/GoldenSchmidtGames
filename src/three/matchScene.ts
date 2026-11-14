import * as T from "three";
import { character, type Character, type SceneKit } from "./sceneKit";

/**
 * Shared building blocks for the 2.5D match worlds (Bomb Arena, Tank Trouble):
 * camera fitting, figure sizing, debris bursts and the explosion flash/shake.
 * Presentation only – nothing here touches rules or timing.
 */

/**
 * Tilted camera at the closest distance (and matching aim point) at which a
 * field of `halfW × halfD` with blocks up to `top` stays on screen. A strip of
 * `reservePx` at the bottom stays free for the touch controls (stick, buttons),
 * so no thumb covers a part of the field – also on small phones.
 */
export function fitTiltedCamera(kit: SceneKit, halfW: number, halfD: number, top: number, tilt: number, reservePx = 132) {
  const height = kit.host.getBoundingClientRect().height || 600, bottom = Math.min(-.2, -1 + 2 * reservePx / height + .02);
  const corners = [-1, 1].flatMap(sx => [-1, 1].flatMap(sz => [0, top].map(y => new T.Vector3(sx * halfW, y, sz * halfD))));
  const place = (d: number, aim: number) => { kit.camera.position.set(0, Math.sin(tilt) * d, Math.cos(tilt) * d + aim); kit.camera.lookAt(0, 0, aim); kit.camera.updateMatrixWorld(); };
  for (let d = 12; d < 160; d += .25) for (let aim = -2; aim <= 12; aim += .2) {
    place(d, aim);
    if (corners.every(c => { const p = c.clone().project(kit.camera); return Math.abs(p.x) < .97 && p.y < .95 && p.y > bottom; })) return;
  }
}

/** A chosen figure scaled to fit a footprint radius and a height; returns the figure and its top. */
export function fittedFigure(kit: SceneKit, parent: T.Object3D, style: number, selected: string | undefined, radius: number, height: number, ring = true): { fig: Character; top: number } {
  const fig = character(kit, parent, style, undefined, selected), body = fig.group.children[0];
  if (!ring) fig.group.children.slice(1).forEach(child => { child.visible = false; });
  const size = new T.Box3().setFromObject(body, true).getSize(new T.Vector3());
  const fit = Math.min(1.6, radius / Math.max(.01, Math.hypot(size.x, size.z) / 2), height / Math.max(.01, size.y));
  body.scale.multiplyScalar(fit);
  return { fig, top: size.y * fit };
}

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; spin: number; size: number; life: number; color: T.Color }
/** Small flying boxes for bursting crates, walls and tanks (skipped with reduced motion). */
export class Debris {
  readonly mesh: T.InstancedMesh;
  private parts: Particle[] = [];
  private dummy = new T.Object3D();
  constructor(parent: T.Object3D, private max: number, material: T.Material) {
    this.mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), material, max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = true; parent.add(this.mesh);
  }
  burst(x: number, y: number, z: number, time: number, o: { count?: number; speed?: number; up?: number; size?: number; life?: number; color?: number } = {}) {
    const count = o.count ?? 6, color = new T.Color(o.color ?? 0xffffff);
    for (let n = 0; n < count && this.parts.length < this.max; n++) {
      const a = n / count * Math.PI * 2 + x * 3 + z, speed = (o.speed ?? 2.2) * (.7 + (n % 3) * .2);
      this.parts.push({ x, y, z, vx: Math.cos(a) * speed, vy: (o.up ?? 3) + (n % 3), vz: Math.sin(a) * speed, born: time, spin: n + 1, size: o.size ?? .18, life: o.life ?? 700, color });
    }
  }
  update(time: number) {
    let i = 0;
    this.parts = this.parts.filter(p => time - p.born < p.life);
    for (const p of this.parts) {
      const age = (time - p.born) / 1000;
      this.dummy.position.set(p.x + p.vx * age, Math.max(.05, p.y + p.vy * age - 9 * age * age), p.z + p.vz * age);
      this.dummy.rotation.set(age * p.spin * 6, age * p.spin * 4, 0);
      this.dummy.scale.setScalar(p.size * (1 - age * 1000 / p.life * .8)); this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix); this.mesh.setColorAt(i, p.color); i++;
    }
    this.mesh.count = i; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** One reusable point light for explosion flashes plus a short camera shake. */
export class Impact {
  private light = new T.PointLight(0xffa04a, 0, 7, 1.6);
  private flashAt = -1e9;
  private shakeUntil = 0;
  constructor(parent: T.Object3D, private kit: SceneKit) { this.light.position.set(0, 1.2, 0); parent.add(this.light); }
  hit(x: number, z: number, time: number, reduced: boolean, strength = 1) {
    if (reduced) return;
    this.flashAt = time; this.light.position.set(x, 1.2, z); this.light.intensity = 9 * strength;
    this.shakeUntil = time + 260 * strength;
  }
  private base = 0;
  private written = Number.NaN;
  /**
   * Call once per frame after the camera is placed. The shake is an offset on
   * top of wherever the scene put the camera: moving (chase, framing) cameras
   * set a new position every frame, fixed ones keep theirs.
   */
  update(time: number, reduced: boolean) {
    this.light.intensity = reduced ? 0 : Math.max(0, 1 - (time - this.flashAt) / 260) * 9;
    const camera = this.kit.camera;
    if (camera.position.x !== this.written) this.base = camera.position.x;
    const offset = !reduced && time < this.shakeUntil ? Math.sin(time * .09) * (this.shakeUntil - time) / 260 * .08 : 0;
    camera.position.x = this.base + offset; this.written = camera.position.x;
  }
}

/**
 * Camera placement that frames the box [x0, x1] × [z0, z1] (blocks up to `top`)
 * from the given tilt, as close as possible, leaving `reservePx` at the bottom
 * for the touch controls. Returns position and look-at target without moving
 * the camera, so callers can glide towards it.
 */
export function frameBox(kit: SceneKit, x0: number, x1: number, z0: number, z1: number, top: number, tilt: number, reservePx = 132) {
  const height = kit.host.getBoundingClientRect().height || 600, bottom = Math.min(-.2, -1 + 2 * reservePx / height + .02), upper = .9, mid = (upper + bottom) / 2;
  const camera = kit.camera.clone(), corners = [x0, x1].flatMap(x => [z0, z1].flatMap(z => [0, top].map(y => new T.Vector3(x, y, z))));
  const target = new T.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2), pos = new T.Vector3();
  const place = (d: number) => { pos.set(target.x, Math.sin(tilt) * d, target.z + Math.cos(tilt) * d); camera.position.copy(pos); camera.lookAt(target); camera.updateMatrixWorld(); };
  const project = () => corners.map(c => c.clone().project(camera));
  const fits = (d: number) => { place(d); return project().every(p => Math.abs(p.x) < .95 && p.y < upper && p.y > bottom); };
  let d = 0;
  for (let pass = 0; pass < 3; pass++) {
    let lo = 4, hi = 200;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
    d = hi; place(d);
    // Shift the aim so the framed box sits in the middle of the free area above the controls.
    const ys = project().map(p => p.y), centre = (Math.max(...ys) + Math.min(...ys)) / 2;
    target.z -= (centre - mid) * d * .35;
  }
  place(d);
  return { position: pos.clone(), target: target.clone() };
}

/** Shortest signed difference between two angles. */
export const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/**
 * Third-person camera behind the own figure. `yaw` is the heading the camera
 * looks along (0 = towards −z, which is "up" on the overview fields). Position
 * and heading glide with time-based damping, so 60 Hz and 120 Hz screens feel
 * the same; with reduced motion the camera follows without lag.
 */
export class ChaseCamera {
  yaw = 0;
  private ready = false;
  private eye = new T.Vector3();
  private aim = new T.Vector3();
  constructor(private kit: SceneKit, public distance = 4.4, public height = 3, public lookAhead = 1.6, public lookHeight = .7) {}
  /** Forget the previous position (e.g. after switching camera modes). */
  reset() { this.ready = false; }
  /**
   * Moves the camera behind `target`. `wantedYaw` (if given) is the heading to
   * turn towards at `turnRate` per second; `snap` jumps there at once.
   */
  update(target: T.Vector3, wantedYaw: number | undefined, dt: number, reduced: boolean, turnRate = 1.6) {
    if (!this.ready && wantedYaw !== undefined) this.yaw = wantedYaw;
    else if (wantedYaw !== undefined) this.yaw += angleDelta(this.yaw, wantedYaw) * (reduced ? 1 : 1 - Math.exp(-dt * turnRate));
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const eye = new T.Vector3(target.x - fx * this.distance, target.y + this.height, target.z - fz * this.distance);
    const aim = new T.Vector3(target.x + fx * this.lookAhead, target.y + this.lookHeight, target.z + fz * this.lookAhead);
    const k = !this.ready || reduced ? 1 : 1 - Math.exp(-dt * 9);
    this.eye.lerp(eye, k); this.aim.lerp(aim, k);
    if (!this.ready) { this.eye.copy(eye); this.aim.copy(aim); this.ready = true; }
    this.kit.camera.position.copy(this.eye); this.kit.camera.lookAt(this.aim);
  }
}
