import { PRACTICE_STATIONS } from "../../shared/matches/proberaumCourse";
import { PRACTICE_LOOPS, PRACTICE_SHOTS } from "../matches/practiceAnimations";
import * as T from "three";
import { blinkOpen, blinkWarn, boxAt, course, gooAt, sweeperAngle, type Box, type Look } from "../../shared/matches/parcoursCourses";
import { PC, shownRacer, type ParcoursGame } from "../../shared/matches/parcours";
import { followCamera, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "../matches/client";
import { ChaseCamera, Debris, frameBox, Impact } from "./matchScene";
import { sweeperYaw } from "./parcoursPose";
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
  ledge: 0xffb347, finish: 0xfff9ed, trap: 0xffe3a3, hold: 0xc98bff, warn: 0xff6a1f, shut: 0x4a2a5c, wind: 0xbfe6ff, ink: 0x24133f, goo: 0x8dff5a, bar: 0xff5f8f, post: 0xfff9ed, own: 0xffe44e, flag: 0x57e4cb
} as const;
const LOOK_COLOR: Record<Look, number> = { floor: COLOR.floor, wall: COLOR.wall, door: COLOR.door, pusher: COLOR.pusher, belt: COLOR.belt, step: COLOR.step, seesaw: COLOR.seesaw, tile: COLOR.tile, roller: COLOR.roller, ledge: COLOR.ledge, finish: COLOR.finish, trap: COLOR.trap, hold: COLOR.hold };

interface RacerView { fig: RiggedFigure; ring: T.Mesh; loop: string; air: boolean; pose: string; marker?: T.Mesh }

export function createParcoursWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, chars: CharacterKit): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.sky); kit.scene.fog = new T.Fog(COLOR.fog, 22, 60);
  kit.camera.fov = 58; kit.camera.near = .1; kit.camera.far = 120; kit.camera.updateProjectionMatrix();
  const first = read(), g0 = first.cur.game as ParcoursGame, c = course(g0.course);
  // The finals' overview uses a narrower lens (less distortion at the edges of the platform).
  if (c.elimination) { kit.camera.fov = 40; kit.camera.updateProjectionMatrix(); }
  const W = (x: number, y: number, z: number) => new T.Vector3(x, y, -z);
  if(c.practice){
    kit.scene.background=new T.Color(0x8ed8f4);kit.scene.fog=new T.Fog(0x8ed8f4,28,75);
    for(const [i,station] of PRACTICE_STATIONS.entries()){
      const sign=document.createElement("canvas");sign.width=512;sign.height=128;const ctx=sign.getContext("2d")!;
      ctx.fillStyle="#211c53";ctx.fillRect(0,0,512,128);ctx.fillStyle="#ffd777";ctx.font="bold 30px sans-serif";ctx.textAlign="center";ctx.fillText(station.name,256,76);
      const texture=new T.CanvasTexture(sign),sprite=new T.Sprite(new T.SpriteMaterial({map:texture}));sprite.position.copy(W(station.x+2.5,2.5,station.z+1));sprite.scale.set(2.4,.6,1);world.add(sprite);
      kit.cylinder(world,i%2?0x57e4cb:0xffd166,station.x,.015,-station.z,1.2,.03).castShadow=false;
    }
  }


  // Static boxes: one instanced mesh per look; moving, door, tile and seesaw boxes get their own meshes.
  const unit = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D();
  const statics = new Map<Look, Box[]>(), stripes: { mesh: T.Mesh; b: Box }[] = [];
  const dynamic: { b: Box; mesh: T.Object3D }[] = [], blinking: { b: Box; mesh: T.Mesh; base: T.Color }[] = [], doors = new Map<number, T.Mesh>(), tiles = new Map<number, T.Mesh>(), seesaws = new Map<number, T.Group>();
  for (const b of c.boxes) {
    if (b.move || b.blink || b.door !== undefined || b.tile !== undefined || b.seesaw !== undefined) continue;
    statics.set(b.look, [...(statics.get(b.look) ?? []), b]);
  }
  for (const [look, list] of statics) {
    const mesh = new T.InstancedMesh(unit, new T.MeshStandardMaterial({ color: c.practice&&look==="floor"?0x82b95d:LOOK_COLOR[look], roughness: .7 }), list.length);
    list.forEach((b, i) => { dummy.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); dummy.scale.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.castShadow = look !== "floor" && look !== "finish"; mesh.receiveShadow = true; world.add(mesh);
    // Belts: bright stripes that run with the belt.
    if (look === "belt") for (const b of list) for (let z = b.z0 + .4; z < b.z1; z += 1.2) stripes.push({ b, mesh: kit.box(world, COLOR.stripe, (b.x0 + b.x1) / 2, b.y1 + .01, -z, b.x1 - b.x0 - .2, .02, .25) });
  }
  // Chequered finish line and a gate.
  // Finals have no finish line; the course length follows the boxes.
  const end = Math.max(...c.boxes.map(b => b.z1));
  if (!c.elimination && !c.practice) {
    const half = c.width / 2;
    for (let k = 0; k < c.width; k++) kit.box(world, k % 2 ? COLOR.finish : COLOR.ink, -half + .5 + k, c.finishY + .02, -c.finishZ, 1, .02, .5);
    for (const side of [-1, 1]) kit.box(world, COLOR.post, side * (half + .2), c.finishY + 1.6, -c.finishZ, .3, 3.2, .3);
    kit.box(world, COLOR.door, 0, c.finishY + 3.3, -c.finishZ, c.width + .7, .4, .4);
  }
  // Checkpoint flags along the left edge.
  for (const cp of (c.practice?[]:c.checkpoints.slice(1))) { kit.cylinder(world, COLOR.post, -c.width / 2 - .3, cp.y + 1, -cp.z, .05, 2); kit.box(world, COLOR.flag, -c.width / 2, cp.y + 1.8, -cp.z, .55, .35, .03); }

  const meshFor = (b: Box) => { const m = kit.box(world, LOOK_COLOR[b.look], 0, 0, 0, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); m.castShadow = true; m.receiveShadow = true; return m; };
  c.boxes.forEach(b => {
    if (b.seesaw !== undefined) {
      // Pivot at the middle of the top; the plank tilts about the course axis.
      const pivot = new T.Group(); pivot.position.copy(W((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2)); world.add(pivot);
      const plank = kit.box(pivot, COLOR.seesaw, 0, -(b.y1 - b.y0) / 2, 0, b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0); plank.castShadow = true; plank.receiveShadow = true;
      kit.box(world, COLOR.ink, (b.x0 + b.x1) / 2, b.y0 - 1.5, -(b.z0 + b.z1) / 2, .4, 3, .4);
      seesaws.set(b.seesaw, pivot);
    } else if (b.door !== undefined) { const m = meshFor(b); m.material = (m.material as T.MeshStandardMaterial).clone(); m.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); doors.set(b.door, m); }
    else if (b.tile !== undefined) { const m = meshFor(b); m.material = (m.material as T.MeshStandardMaterial).clone(); m.userData.look = b.look; m.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); tiles.set(b.tile, m); }
    else if (b.blink) { const m = meshFor(b); m.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2)); m.material = (m.material as T.MeshStandardMaterial).clone(); blinking.push({ b, mesh: m, base: new T.Color(LOOK_COLOR[b.look]) }); }
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
  // Wind: fans on the side the wind comes from, arrows on the floor that light up while it blows.
  const fans = c.winds.map(w => {
    const along = Math.abs(w.vx) > Math.abs(w.vz), group = new T.Group(), y = Math.max(w.y0, 0) + 1.2;
    const x = along ? (w.vx > 0 ? (c.practice?w.x0-.6:-5.6) : (c.practice?w.x1+.6:5.6)) : (w.x0 + w.x1) / 2, z = along ? (w.z0 + w.z1) / 2 : (w.vz < 0 ? w.z1 + .6 : w.z0 - .6);
    group.position.copy(W(x, y + (along ? 0 : 1.2), z)); world.add(group);
    const rotor = new T.Group(); group.add(rotor);
    const ring = kit.mesh(group, new T.TorusGeometry(1, .08, 8, 28), COLOR.post, 0, 0, 0);
    for (let k = 0; k < 4; k++) { const blade = kit.box(rotor, COLOR.wind, 0, 0, 0, .18, 1.7, .05); blade.rotation.z = k * Math.PI / 4; }
    if (along) { group.rotation.y = Math.PI / 2; } void ring;
    const arrows = Array.from({ length: 3 }, (_, k) => {
      const ax = along ? (w.x0 + w.x1) / 2 + (k - 1) * 2.4 : (k - 1) * 1.2, az = along ? (w.z0 + w.z1) / 2 + (k - 1) * 1.6 : (w.z0 + w.z1) / 2 + (k - 1) * 2;
      const arrow = kit.cone(world, COLOR.wind, ax, (along ? 0 : y - 1.2) + .05, -az, .3, .6);
      arrow.rotation.set(Math.PI / 2, 0, along ? (w.vx > 0 ? -Math.PI / 2 : Math.PI / 2) : (w.vz < 0 ? Math.PI : 0));
      (arrow.material as T.MeshStandardMaterial) = (arrow.material as T.MeshStandardMaterial).clone();
      return arrow;
    });
    return { w, rotor, arrows };
  });
  // Rising goo.
  const goo = c.goo ? new T.Mesh(new T.PlaneGeometry(40, 120), new T.MeshStandardMaterial({ color: COLOR.goo, emissive: COLOR.goo, emissiveIntensity: .45, transparent: true, opacity: .82, roughness: .3 })) : undefined;
  if (goo) { goo.rotation.x = -Math.PI / 2; goo.position.z = -end / 2; world.add(goo); }
  // Floor of the studio far below.
  const deep = kit.box(world, 0x141a4d, 0, c.killY + 1, -end / 2, 80, .2, end + 60); deep.castShadow = false;

  const dust = new Debris(world, 80, new T.MeshStandardMaterial({ color: 0xfff9ed, roughness: 1 })), impact = new Impact(world, kit);
  const warnColor = new T.Color(COLOR.warn), views = new Map<string, RacerView>(), chaseCam = new ChaseCamera(kit, c.practice?6.2:4.4, c.practice?4:2.8, 2.6, .9), target = new T.Vector3();
  let lastPreview=0,lastTravel=-1;
  // Finals: a tilted overview of the whole platform, so bars from behind and the side are always in sight; a swipe orbits it.
  const arena = c.elimination ? { x0: Math.min(...c.boxes.map(b => b.x0)), x1: Math.max(...c.boxes.map(b => b.x1)), z0: Math.min(...c.boxes.map(b => b.z0)), z1: Math.max(...c.boxes.map(b => b.z1)) } : undefined;
  let arenaYaw = 0, arenaAspect = 0, arenaShot: { position: T.Vector3; target: T.Vector3 } | undefined;
  const up = new T.Vector3(0, 1, 0);
  let shownId = "", frame = 0, last = performance.now(), lastSeq = 0, fresh = true, respawning = false, doorState = "", tileState = "";

  const viewFor = (id: string, style: number, chosen: string | undefined, own: boolean): RacerView => {
    let v = views.get(id);
    if (v) return v;
    const fig = riggedFigure(chars, chosen, style, PLAYER_COLORS[style % PLAYER_COLORS.length], FIGURE_H);
    world.add(fig.group);
    const ring = kit.mesh(world, new T.TorusGeometry(.42, own ? .06 : .04, 6, 28), own ? COLOR.own : PLAYER_COLORS[style % PLAYER_COLORS.length], 0, 0, 0);
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    // In the finals' overview a yellow arrow above the own figure finds it at a glance.
    const marker = own && c.elimination ? kit.cone(world, COLOR.own, 0, 0, 0, .22, .42) : undefined;
    if (marker) { marker.rotation.x = Math.PI; marker.castShadow = false; }
    v = { fig, ring, loop: "", air: false, pose: "run", marker }; views.set(id, v); return v;
  };
  const loop = (v: RacerView, state: Parameters<RiggedFigure["setLoop"]>[0], speed?: number) => { if (v.loop !== state || speed !== undefined) { v.fig.setLoop(state, speed); v.loop = state; } };

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as ParcoursGame, prev = f.prev.game as ParcoursGame, reduced = f.reduced, dt = Math.min(.05, (time - last) / 1000);
    // Obstacles at the same moment as the (interpolated) racers, so what touches on screen touches in the rules.
    const t = f.prev.time + (s.time - f.prev.time) * f.alpha;
    last = time;
    // Moving parts follow the shared time functions.
    for (const { b, mesh } of dynamic) { const bb = boxAt(b, t); mesh.position.copy(W((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2)); }
    // (The sign matters: a mirrored bar would hit where none is drawn.)
    for (const { sw, pivot } of bars) pivot.rotation.y = sweeperYaw(sweeperAngle(sw, t));
    // Vanishing boxes: glow orange before they open (blinking unless motion is reduced), gone while open.
    for (const { b, mesh, base } of blinking) {
      const open = blinkOpen(b, t), warn = blinkWarn(b, t);
      mesh.visible = !open;
      const pulse = reduced ? 1 : .55 + .45 * Math.abs(Math.sin(time / 90));
      (mesh.material as T.MeshStandardMaterial).color.copy(base).lerp(warnColor, warn > 0 ? Math.min(1, .35 + warn * .65) * pulse : 0);
    }
    for (const { w, rotor, arrows } of fans) {
      const on = ((t / w.period + w.phase) % 1) < w.on;
      if (on && !reduced) rotor.rotation.z += dt * 14;
      for (const arrow of arrows) { const m = arrow.material as T.MeshStandardMaterial; m.color.setHex(on ? COLOR.warn : COLOR.wind); m.emissive.setHex(on ? 0x662200 : 0); }
    }
    for (const [i, pivot] of seesaws) { const before = prev.tilt?.[i] ?? 0, now = g.tilt[i] ?? 0; pivot.rotation.z = -(before + (now - before) * f.alpha); }
    if (goo) goo.position.y = Math.max(c.killY + 1.2, gooAt(c, t));
    // Belt stripes run with the belt (static with reduced motion).
    if (!reduced) for (const { mesh, b } of stripes) { const len = b.z1 - b.z0, along = -mesh.position.z - b.z0 + (b.belt ?? 0) * dt; mesh.position.z = -(b.z0 + ((along % len) + len) % len); }
    // Doors that broke burst; tiles show what is known.
    if (g.doors !== doorState) {
      [...g.doors].forEach((d, i) => {
        const m = doors.get(i); if (!m) return;
        if (d === "1" && m.visible) { m.visible = false; if (!reduced && doorState) dust.burst(m.position.x, m.position.y, m.position.z, time, { count: 10, speed: 2.4, up: 2.5, size: .16, color: COLOR.door }); }
        // Tried and solid: dark, so everyone knows this one stays shut.
        (m.material as T.MeshStandardMaterial).color.setHex(d === "2" ? COLOR.shut : COLOR.door);
      });
      doorState = g.doors;
    }
    if (g.tiles !== tileState) {
      [...g.tiles].forEach((state, i) => {
        const m = tiles.get(i); if (!m) return;
        m.visible = state !== "2";
        // Hidden-path plates show what is known; lane floors (trapdoors) look like any floor.
        if (m.userData.look === "tile") (m.material as T.MeshStandardMaterial).color.setHex(state === "1" ? COLOR.tileGood : COLOR.tile);
      });
      tileState = g.tiles;
    }
    // Events: animations and feedback.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const v = views.get(e.ids[0]), r = g.racers[e.ids[0]];
      if (!v) continue;
      // The take-off crouch is skipped (the jump already started) and played faster: a jump lasts only ~0.7 s.
      if (e.kind === "jump") v.fig.play("jumpStart", 1.6, .22);
      else if (e.kind === "dive") v.fig.play("dash", 1.3);
      else if (e.kind === "land") v.fig.play("land", 2.2, .1);
      else if (e.kind === "shove") v.fig.play("hitLight");
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
      if (v.marker) { v.marker.visible = !hidden; v.marker.position.set(x, y + FIGURE_H + .55 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .12), -z); }
      v.fig.group.position.set(x, y, -z); v.ring.position.set(x, y + .03, -z);
      // Hanging and climbing: facing the wall.
      const face = (r.pose === "hang" || r.pose === "climb") && r.hang ? Math.atan2(-r.hang.nx, -r.hang.nz) : r.face;
      v.fig.group.rotation.y = r.pose === "done" ? 0 : Math.PI - face;
      const speed = Math.hypot(r.vx, r.vz);
      // Touching down ends the jump animation at once; a slow landing gets a short knee bend.
      const airborne = !r.grounded && (r.pose === "air" || r.pose === "stun");
      if (v.air && r.grounded) { v.fig.stopShot(); if (speed < 2 && r.pose === "run") v.fig.play("land", 2.6, .1); }
      v.air = airborne;
      // The climb animation runs while the rules lift the racer up the wall.
      if (r.pose === "climb" && v.pose !== "climb") v.fig.stopShot();
      v.pose = r.pose;
      if(c.practice && p.id===f.viewer && f.local.practiceLoop!==undefined){
        loop(v,PRACTICE_LOOPS[f.local.practiceLoop]?.clip??"idle");
        if(f.local.practiceShotSeq && f.local.practiceShotSeq!==lastPreview){lastPreview=f.local.practiceShotSeq;v.fig.play(PRACTICE_SHOTS[f.local.practiceShot]?.clip??"cheer");}
      }
      else if (r.pose === "done") loop(v, "dance");
      else if (r.pose === "climb") loop(v, "climb", .67 / (PC.climbMs / 1000) * .9);
      else if (r.pose === "hang") loop(v, "hang");
      else if (r.grab) loop(v, "push");
      else if (r.pose === "dive" || r.pose === "prone") loop(v, "slide");
      else if (r.duck) loop(v, speed > .5 ? "crouchWalk" : "crouch", speed / 2);
      else if (!r.grounded) loop(v, "air");
      else if (speed > 4) loop(v, "sprint", speed / 6.4);
      else if (speed > .6) loop(v, "jog", speed / 3.5);
      else loop(v, "idle");
      v.fig.update(dt);
    }

    // Chase camera behind the own racer; after the finish, when out or as a spectator: the chosen or leading racer.
    const local = f.local as ChaseLocal & { watch?: number }, mine = shownRacer(g, s.players, f.viewer, local.watch), ownCam = mine?.id === f.viewer;
    if(c.practice && (f.local.practiceTravel??0)!==lastTravel){lastTravel=f.local.practiceTravel??0;chaseCam.reset();fresh=true;}
    if (mine && mine.id !== shownId) { shownId = mine.id; fresh = true; }
    host.dataset.watch = mine?.id ?? "";
    if (arena) {
      takeCameraTurn(local, d => { arenaYaw += d; });
      if (!arenaShot || kit.camera.aspect !== arenaAspect) { arenaAspect = kit.camera.aspect; arenaShot = frameBox(kit, arena.x0, arena.x1, -arena.z1, -arena.z0, 1.6, 54 * Math.PI / 180, 180); }
      const offset = arenaShot.position.clone().sub(arenaShot.target).applyAxisAngle(up, -arenaYaw);
      kit.camera.position.copy(arenaShot.target).add(offset); kit.camera.lookAt(arenaShot.target);
      // Stick up runs away from this camera, as with the chase camera.
      if (mine?.id === f.viewer) followCamera(local, f.input, arenaYaw);
      host.dataset.yaw = arenaYaw.toFixed(3);
    } else if (mine) {
      const before = prev.racers?.[mine.id], a = before && Math.hypot(before.x - mine.x, before.z - mine.z) < 3 ? f.alpha : 1;
      target.set(before ? before.x + (mine.x - before.x) * a : mine.x, before ? before.y + (mine.y - before.y) * a : mine.y, -(before ? before.z + (mine.z - before.z) * a : mine.z));
      // The camera looks along the start direction (and again after a respawn); afterwards only a swipe turns it.
      // Watching someone else, it follows that racer's heading.
      if (mine.respawnAt) respawning = true; else if (respawning) { respawning = false; fresh = true; }
      const moving = !ownCam && Math.hypot(mine.vx, mine.vz) > 1 && (mine.pose === "run" || mine.pose === "air");
      if (ownCam) takeCameraTurn(local, d => chaseCam.turn(d));
      chaseCam.tune(f.local as ChaseLocal);
      chaseCam.update(target, moving || fresh ? mine.face : undefined, dt, reduced, 1.4);
      fresh = false;
      if (ownCam) followCamera(local, f.input, chaseCam.yaw);
      host.dataset.yaw = chaseCam.yaw.toFixed(3);
    }
    host.dataset.camera = arena ? "arena" : "chase";
    dust.update(time);
    impact.update(time, reduced);
    kit.render();
    if(c.practice)host.dataset.ready="true";
    host.dataset.figures = JSON.stringify(Object.fromEntries([...views].map(([id, v]) => [id, v.fig.group.userData.characterId])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); for (const v of views.values()) v.fig.dispose(); unit.dispose(); kit.dispose(); } };
}
