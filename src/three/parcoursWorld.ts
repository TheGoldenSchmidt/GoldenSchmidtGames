import * as T from "three";
import { boxAt, course, gooAt, sweeperAngle, type Box, type Look } from "../../shared/matches/parcoursCourses";
import type { ParcoursGame } from "../../shared/matches/parcours";
import { followCamera, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "../matches/client";
import { ChaseCamera, Debris, Impact } from "./matchScene";
import { riggedFigure, type CharacterKit, type RiggedFigure } from "./riggedFigure";
import { PLAYER_COLORS, SceneKit } from "./sceneKit";

/**
 * Hindernis-Parcours in 3D: a candy-coloured gameshow studio at night. The
 * course boxes come from the shared course data, moving parts follow the same
 * time functions as the rules, secret parts only change when the authority
 * reveals them. A chase camera follows the own racer; the stick is relative
 * to it. World mapping: x = x, y = y, z = −z (forward runs away from the
 * camera, which looks towards −z at heading 0).
 */
const FIGURE_H = 1.6;
const COLOR = {
  sky: 0x1d2466, fog: 0x2b3790, floor: 0xffd166, side: 0xd9893c, wall: 0x6544e8, door: 0xff86c8, pusher: 0xe3263b,
  belt: 0x3a3f66, stripe: 0xfff9ed, step: 0xffe3a3, seesaw: 0x57e4cb, tile: 0xbfe6ff, tileGood: 0x7be38f, roller: 0xb23a48,
  ledge: 0xffb347, finish: 0xfff9ed, ink: 0x24133f, goo: 0x8dff5a, bar: 0xff5f8f, post: 0xfff9ed, own: 0xffe44e, flag: 0x57e4cb
} as const;
const LOOK_COLOR: Record<Look, number> = { floor: COLOR.floor, wall: COLOR.wall, door: COLOR.door, pusher: COLOR.pusher, belt: COLOR.belt, step: COLOR.step, seesaw: COLOR.seesaw, tile: COLOR.tile, roller: COLOR.roller, ledge: COLOR.ledge, finish: COLOR.finish };

interface RacerView { fig: RiggedFigure; ring: T.Mesh; loop: string }

export function createParcoursWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, chars: CharacterKit): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.sky); kit.scene.fog = new T.Fog(COLOR.fog, 22, 60);
  kit.camera.fov = 58; kit.camera.near = .1; kit.camera.far = 120; kit.camera.updateProjectionMatrix();
  const first = read(), g0 = first.cur.game as ParcoursGame, c = course(g0.course);
  const W = (x: number, y: number, z: number) => new T.Vector3(x, y, -z);

  // Static boxes: one instanced mesh per look; moving, door, tile and seesaw boxes get their own meshes.
  const unit = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D();
  const statics = new Map<Look, Box[]>(), stripes: { mesh: T.Mesh; b: Box }[] = [];
  const dynamic: { b: Box; mesh: T.Object3D }[] = [], doors = new Map<number, T.Mesh>(), tiles = new Map<number, T.Mesh>(), seesaws = new Map<number, T.Group>();
  for (const b of c.boxes) {
    if (b.move || b.door !== undefined || b.tile !== undefined || b.seesaw !== undefined) continue;
    statics.set(b.look, [...(statics.get(b.look) ?? []), b]);
  }
  for (const [look, list] of statics) {
    const mesh = new T.InstancedMesh(unit, new T.MeshStandardMaterial({ color: LOOK_COLOR[look], roughness: .7 }), list.length);
    list.forEach((b, i) => { dummy.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); dummy.scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.castShadow = look !== "floor" && look !== "finish"; mesh.receiveShadow = true; world.add(mesh);
    // Belts: bright stripes that run with the belt.
    if (look === "belt") for (const b of list) for (let z = b.z0 + .4; z < b.z1; z += 1.2) stripes.push({ b, mesh: kit.box(world, COLOR.stripe, (b.x0 + b.x1) / 2, b.y1 + .01, -z, b.x1 - b.x0 - .2, .02, .25) });
  }
  // Chequered finish line and a gate.
  for (let k = 0; k < 10; k++) kit.box(world, k % 2 ? COLOR.finish : COLOR.ink, -4.5 + k, c.finishY + .02, -c.finishZ, 1, .02, .5);
  for (const side of [-1, 1]) kit.box(world, COLOR.post, side * 5.2, c.finishY + 1.6, -c.finishZ, .3, 3.2, .3);
  kit.box(world, COLOR.door, 0, c.finishY + 3.3, -c.finishZ, 10.7, .4, .4);
  // Checkpoint flags along the left edge.
  for (const cp of c.checkpoints.slice(1)) { kit.cylinder(world, COLOR.post, -5.3, cp.y + 1, -cp.z, .05, 2); kit.box(world, COLOR.flag, -5, cp.y + 1.8, -cp.z, .55, .35, .03); }

  const meshFor = (b: Box) => { const m = kit.box(world, LOOK_COLOR[b.look], 0, 0, 0, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); m.castShadow = true; m.receiveShadow = true; return m; };
  c.boxes.forEach(b => {
    if (b.seesaw !== undefined) {
      // Pivot at the middle of the top; the plank tilts about the course axis.
      const pivot = new T.Group(); pivot.position.copy(W((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2)); world.add(pivot);
      const plank = kit.box(pivot, COLOR.seesaw, 0, -(b.y1 - b.y0) / 2, 0, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); plank.castShadow = true; plank.receiveShadow = true;
      kit.box(world, COLOR.ink, (b.x0 + b.x1) / 2, b.y0 - 1.5, -(b.z0 + b.z1) / 2, .4, 3, .4);
      seesaws.set(b.seesaw, pivot);
    } else if (b.door !== undefined) { const m = meshFor(b); m.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); doors.set(b.door, m); }
    else if (b.tile !== undefined) { const m = meshFor(b); m.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); tiles.set(b.tile, m); }
    else if (b.move) dynamic.push({ b, mesh: meshFor(b) });
  });
  // Spinning bars on a post.
  const bars = c.sweepers.map(sw => {
    const pivot = new T.Group(); pivot.position.copy(W(sw.x, (sw.y0 + sw.y1) / 2, sw.z)); world.add(pivot);
    // Low bars (jump) are pink, high bars (duck) yellow – the same code as in the 2D view.
    const bar = kit.box(pivot, sw.y1 <= .8 ? COLOR.bar : COLOR.own, 0, 0, 0, sw.length * 2, sw.y1 - sw.y0, .38); bar.castShadow = true;
    for (let k = -sw.length + .4; k < sw.length; k += .8) kit.box(pivot, COLOR.stripe, k, 0, 0, .18, sw.y1 - sw.y0 + .02, .4);
    kit.cylinder(world, COLOR.post, sw.x, sw.y1 / 2 + .3, -sw.z, .25, sw.y1 + .6);
    return { sw, pivot };
  });
  // Rising goo.
  const goo = c.goo ? new T.Mesh(new T.PlaneGeometry(40, 120), new T.MeshStandardMaterial({ color: COLOR.goo, emissive: COLOR.goo, emissiveIntensity: .45, transparent: true, opacity: .82, roughness: .3 })) : undefined;
  if (goo) { goo.rotation.x = -Math.PI / 2; goo.position.z = -c.finishZ / 2; world.add(goo); }
  // Floor of the studio far below.
  const deep = kit.box(world, 0x141a4d, 0, c.killY + 1, -c.finishZ / 2, 80, .2, c.finishZ + 60); deep.castShadow = false;

  const dust = new Debris(world, 80, new T.MeshStandardMaterial({ color: 0xfff9ed, roughness: 1 })), impact = new Impact(world, kit);
  const views = new Map<string, RacerView>(), chaseCam = new ChaseCamera(kit, 4.4, 2.8, 2.6, .9), target = new T.Vector3();
  let frame = 0, last = performance.now(), lastSeq = 0, fresh = true, doorState = "", tileState = "";

  const viewFor = (id: string, style: number, chosen: string | undefined, own: boolean): RacerView => {
    let v = views.get(id);
    if (v) return v;
    const fig = riggedFigure(chars, chosen, style, PLAYER_COLORS[style % PLAYER_COLORS.length], FIGURE_H);
    world.add(fig.group);
    const ring = kit.mesh(world, new T.TorusGeometry(.42, own ? .06 : .04, 6, 28), own ? COLOR.own : PLAYER_COLORS[style % PLAYER_COLORS.length], 0, 0, 0);
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    v = { fig, ring, loop: "" }; views.set(id, v); return v;
  };
  const loop = (v: RacerView, state: Parameters<RiggedFigure["setLoop"]>[0], speed?: number) => { if (v.loop !== state || speed !== undefined) { v.fig.setLoop(state, speed); v.loop = state; } };

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as ParcoursGame, prev = f.prev.game as ParcoursGame, reduced = f.reduced, dt = Math.min(.05, (time - last) / 1000), t = f.simTime;
    last = time;
    // Moving parts follow the shared time functions.
    for (const { b, mesh } of dynamic) { const bb = boxAt(b, t); mesh.position.copy(W((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2)); }
    for (const { sw, pivot } of bars) pivot.rotation.y = -sweeperAngle(sw, t);
    for (const [i, pivot] of seesaws) { const before = prev.tilt?.[i] ?? 0, now = g.tilt[i] ?? 0; pivot.rotation.z = -(before + (now - before) * f.alpha); }
    if (goo) goo.position.y = Math.max(c.killY + 1.2, gooAt(c, t));
    // Belt stripes run with the belt (static with reduced motion).
    if (!reduced) for (const { mesh, b } of stripes) { const len = b.z1 - b.z0, along = -mesh.position.z - b.z0 + (b.belt ?? 0) * dt; mesh.position.z = -(b.z0 + ((along % len) + len) % len); }
    // Doors that broke burst; tiles show what is known.
    if (g.doors !== doorState) {
      [...g.doors].forEach((d, i) => { const m = doors.get(i); if (!m) return; if (d === "1" && m.visible) { m.visible = false; if (!reduced && doorState) dust.burst(m.position.x, m.position.y, m.position.z, time, { count: 10, speed: 2.4, up: 2.5, size: .16, color: COLOR.door }); } });
      doorState = g.doors;
    }
    if (g.tiles !== tileState) {
      [...g.tiles].forEach((state, i) => { const m = tiles.get(i); if (!m) return; m.visible = state !== "2"; (m.material as T.MeshStandardMaterial).color.setHex(state === "1" ? COLOR.tileGood : COLOR.tile); });
      tileState = g.tiles;
    }
    // Events: animations and feedback.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const v = views.get(e.ids[0]), r = g.racers[e.ids[0]];
      if (!v) continue;
      if (e.kind === "jump") v.fig.play("jumpStart");
      else if (e.kind === "dive") v.fig.play("dash");
      else if (e.kind === "land") v.fig.play("land");
      else if (e.kind === "hit") { v.fig.play("hit"); if (r && !reduced) dust.burst(r.x, r.y + .8, -r.z, time, { count: 6, speed: 1.6, up: 2, size: .08, life: 450 }); if (e.ids[0] === f.viewer && r) impact.hit(r.x, -r.z, time, reduced, .5); }
      else if (e.kind === "door" && r && e.ids[0] === f.viewer) impact.hit(r.x, -r.z, time, reduced, .4);
      else if (e.kind === "finish") v.fig.play("cheer");
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    // Racers: interpolated, facing their direction, animation by pose.
    for (const p of s.players) {
      const r = g.racers[p.id];
      if (!r) continue;
      const v = viewFor(p.id, p.style, f.characters[p.id], p.id === f.viewer), before = prev.racers?.[p.id];
      const jump = before && Math.hypot(before.x - r.x, before.z - r.z) > 3, a = before && !jump ? f.alpha : 1;
      const x = before ? before.x + (r.x - before.x) * a : r.x, y = before ? before.y + (r.y - before.y) * a : r.y, z = before ? before.z + (r.z - before.z) * a : r.z;
      const hidden = !!r.respawnAt || r.pose === "out";
      v.fig.group.visible = !hidden; v.ring.visible = !hidden && r.grounded;
      v.fig.group.position.set(x, y, -z); v.ring.position.set(x, y + .03, -z);
      v.fig.group.rotation.y = r.pose === "done" ? 0 : Math.PI - r.face;
      const speed = Math.hypot(r.vx, r.vz);
      if (r.pose === "done") loop(v, "dance");
      else if (r.pose === "hang" || r.grab) loop(v, "push");
      else if (r.pose === "dive" || r.pose === "prone") loop(v, "slide");
      else if (r.duck) loop(v, "slide");
      else if (!r.grounded) loop(v, "air");
      else if (speed > 4) loop(v, "sprint", speed / 6.4);
      else if (speed > .6) loop(v, "jog", speed / 3.5);
      else loop(v, "idle");
      v.fig.update(dt);
    }

    // Chase camera behind the own racer (spectators follow the leader).
    const mine = g.racers[f.viewer] ?? Object.values(g.racers).sort((p, q) => q.best - p.best)[0];
    if (mine) {
      const before = prev.racers?.[mine.id], a = before && Math.hypot(before.x - mine.x, before.z - mine.z) < 3 ? f.alpha : 1;
      target.set(before ? before.x + (mine.x - before.x) * a : mine.x, before ? before.y + (mine.y - before.y) * a : mine.y, -(before ? before.z + (mine.z - before.z) * a : mine.z));
      const moving = Math.hypot(mine.vx, mine.vz) > 1 && (mine.pose === "run" || mine.pose === "air");
      chaseCam.update(target, moving || fresh ? mine.face : undefined, dt, reduced, 1.4);
      fresh = false;
      if (g.racers[f.viewer]) followCamera(f.local as ChaseLocal, f.input, chaseCam.yaw);
      host.dataset.yaw = chaseCam.yaw.toFixed(3);
    }
    host.dataset.camera = "chase";
    dust.update(time);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...views].map(([id, v]) => [id, v.fig.group.userData.characterId])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); for (const v of views.values()) v.fig.dispose(); unit.dispose(); kit.dispose(); } };
}
