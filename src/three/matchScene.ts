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
  /** Call once per frame after the camera is placed. */
  update(time: number, reduced: boolean) {
    this.light.intensity = reduced ? 0 : Math.max(0, 1 - (time - this.flashAt) / 260) * 9;
    const camera = this.kit.camera;
    if (time < this.shakeUntil) camera.position.x = Math.sin(time * .09) * (this.shakeUntil - time) / 260 * .08;
    else if (camera.position.x !== 0) camera.position.x = 0;
  }
}
