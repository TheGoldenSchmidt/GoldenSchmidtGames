import * as T from "three";
import { TANK_FIELD, TT, wallRects, type TankGame, type TankPower } from "../../shared/matches/tankTrouble";
import { sightPolygon, TV } from "../../shared/matches/tankView";
import { followCamera, headingOf, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "../matches/client";
import { ChaseCamera, Debris, fittedFigure, fitTiltedCamera, Impact } from "./matchScene";
import { PLAYER_COLORS, SceneKit, type Character } from "./sceneKit";

/**
 * Tank Trouble in 2.5D: sandy maze with walls exactly as thick as the rules,
 * tanks with the players' figures in the hatch, glowing bullets with tracer
 * trails and an aiming laser up to the first wall while the own tank aims.
 * Pure presentation of the authoritative view.
 *
 * With `chase` (Tank Trouble – Turmsicht) the camera follows behind and above
 * the own tank, walls stand taller and fog fades out the distance. The floor
 * outside the own sight (the same rays the authority uses) lies in darkness,
 * so tanks missing from the view are always in the dark; a tank that leaves
 * the light leaves a fading "last seen" ring.
 */
const W = TANK_FIELD.width, H = TANK_FIELD.height;
const wx = (x: number) => x - W / 2, wz = (y: number) => y - H / 2;
const WALL_LOW = .5, TILT = 62 * Math.PI / 180, BULLET_Y = .32, TRAIL = 7;
const COLOR = { night: 0x2c2a1e, base: 0x3b3524, sandA: 0xd3c597, sandB: 0xc9b98a, wall: 0x3b3550, brick: 0xb4553a, cracked: 0x7d3b2a, tread: 0x24133f, bullet: 0x24133f, tracer: 0xffb52e, laser: 0xe3263b, shield: 0x57e4cb, pad: 0x6544e8, own: 0xffe44e, hp: 0xffe44e, wreck: 0x3a3330 } as const;
const POWER_ICON: Record<TankPower, string> = { rapid: "⚡", triple: "⋔", shield: "⛨" };
/** 2D field angle (x right, y down) → rotation about the vertical axis (x right, z towards the camera). */
const yaw = (a: number) => -a;

interface TankView { body: T.Group; turret: T.Group; hud: T.Group; shield: T.Mesh; pips: T.Mesh[]; marker?: T.Mesh; wreck: T.Mesh; driver: Character; color: number; recoilAt: number }

export function createTankWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, options: { chase?: boolean } = {}): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group(), chase = !!options.chase;
  kit.scene.add(world);
  // In the chase view walls hide what lies behind them, and fog ends the view at the sight range.
  const WALL_H = chase ? 1.15 : WALL_LOW;
  kit.scene.background = new T.Color(COLOR.night); kit.scene.fog = chase ? new T.Fog(COLOR.night, 5.5, 11) : null;
  kit.camera.fov = chase ? 58 : 26; kit.camera.near = chase ? .05 : kit.camera.near; kit.camera.updateProjectionMatrix();
  // Behind and above the own tank, high enough to look over the walls into the own corridor.
  const chaseCam = new ChaseCamera(kit, 2.6, 3.6, 1.7, 0), target = new T.Vector3();
  const box = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D();

  // Sand floor in the 2D checker and a dark plinth.
  kit.box(world, COLOR.base, 0, -.35, 0, W + 1, .5, H + 1).castShadow = false;
  const tiles = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: .95 }), TT.cols * TT.rows);
  for (let r = 0, i = 0; r < TT.rows; r++) for (let c = 0; c < TT.cols; c++, i++) {
    dummy.position.set(wx((c + .5) * TT.cell), -.05, wz((r + .5) * TT.cell)); dummy.scale.set(TT.cell, .1, TT.cell); dummy.updateMatrix();
    tiles.setMatrixAt(i, dummy.matrix); tiles.setColorAt(i, new T.Color((r + c) % 2 ? COLOR.sandB : COLOR.sandA));
  }
  tiles.receiveShadow = true; world.add(tiles);

  // Walls by kind; rebuilt when the edge strings change. Thickness is exactly the rules' wall.
  const wallSets = { 1: COLOR.wall, 2: COLOR.brick, 3: COLOR.cracked } as const;
  const wallMesh = (color: number) => {
    const mesh = new T.InstancedMesh(box, new T.MeshStandardMaterial({ color, roughness: .8 }), 200);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0; world.add(mesh); return mesh;
  };
  const walls: Record<1 | 2 | 3, T.InstancedMesh> = { 1: wallMesh(wallSets[1]), 2: wallMesh(wallSets[2]), 3: wallMesh(wallSets[3]) };
  // Light top edge so walls read as walls from above.
  const caps = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: .7 }), 600); caps.count = 0; world.add(caps);
  const capColor = { 1: new T.Color(0xfff9ed), 2: new T.Color(0xf09a6a), 3: new T.Color(0xc0704f) } as const;

  // Bullets glow; tracer trails are instanced dots that shrink.
  const bulletMat = new T.MeshBasicMaterial({ color: COLOR.bullet });
  const bullets = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), bulletMat, 64), trails = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshBasicMaterial({ color: COLOR.tracer, transparent: true, opacity: .75, depthWrite: false }), 64 * TRAIL);
  for (const mesh of [bullets, trails]) { mesh.count = 0; mesh.frustumCulled = false; world.add(mesh); }
  const history = new Map<number, [number, number][]>();

  // Aiming laser for the own tank (only while aiming).
  const laser = new T.Mesh(box, new T.MeshBasicMaterial({ color: COLOR.laser, transparent: true, opacity: .75, depthWrite: false })); laser.visible = false; world.add(laser);

  // Turmsicht: darkness from the edge of the lit sight polygon outwards (one quad per ray, no triangulation).
  const ghostMat = new Map<string, T.MeshBasicMaterial>(), ghosts = new Map<string, T.Group>(), lastSeen = new Map<string, { x: number; y: number; at: number }>();
  let dark: T.Mesh | undefined, darkAt = "";
  if (chase) {
    const geometry = new T.BufferGeometry(), index: number[] = [];
    geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(TV.rays * 2 * 3), 3));
    for (let i = 0; i < TV.rays; i++) { const a = i * 2, b = ((i + 1) % TV.rays) * 2; index.push(a, a + 1, b, b, a + 1, b + 1); }
    geometry.setIndex(index);
    dark = new T.Mesh(geometry, new T.MeshBasicMaterial({ color: COLOR.night, transparent: true, opacity: .66, depthWrite: false, side: T.DoubleSide }));
    dark.frustumCulled = false; dark.renderOrder = 1; world.add(dark);
  }
  const updateDark = (g: TankGame, x: number, y: number) => {
    const key = `${x.toFixed(2)},${y.toFixed(2)},${edges}`;
    if (!dark || key === darkAt) return;
    darkAt = key;
    const ring = sightPolygon(wallRects(g), x, y), pos = dark.geometry.getAttribute("position") as T.BufferAttribute;
    ring.forEach((d, i) => {
      const a = i / TV.rays * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      pos.setXYZ(i * 2, wx(x + c * d), .012, wz(y + sn * d));
      pos.setXYZ(i * 2 + 1, wx(x + c * 40), .012, wz(y + sn * 40));
    });
    pos.needsUpdate = true;
  };
  const ghostFor = (id: string, color: number) => {
    let group = ghosts.get(id);
    if (group) return group;
    const material = new T.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false });
    group = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(.45, .05, 6, 28), material); ring.rotation.x = Math.PI / 2; ring.position.y = .06; group.add(ring);
    const mark = new T.Mesh(new T.ConeGeometry(.12, .26, 10), material); mark.rotation.x = Math.PI; mark.position.y = .7; group.add(mark);
    group.visible = false; world.add(group); ghosts.set(id, group); ghostMat.set(id, material);
    return group;
  };

  const impact = new Impact(world, kit);
  const debris = new Debris(world, 120, new T.MeshStandardMaterial({ roughness: .8 }));
  const tanks = new Map<string, TankView>(), powers = new Map<number, T.Group>();
  let edges = "", lastSeq = 0, frame = 0, aspect = 0, lastFrame = performance.now(), camFresh = true, wasAlive = false;

  const rebuildWalls = (g: TankGame, time: number, reduced: boolean) => {
    const before = edges ? new Map(wallRects(JSON.parse(edges) as Pick<TankGame, "h" | "v">).map(r => [`${r.axis}${r.index}`, r])) : undefined;
    const counts = { 1: 0, 2: 0, 3: 0 };
    let capCount = 0;
    const rects = wallRects(g);
    for (const r of rects) {
      const kind = r.kind as 1 | 2 | 3, cx = wx((r.x0 + r.x1) / 2), cz = wz((r.y0 + r.y1) / 2), sx = r.x1 - r.x0, sz = r.y1 - r.y0;
      dummy.position.set(cx, WALL_H / 2, cz); dummy.scale.set(sx, WALL_H, sz); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      walls[kind].setMatrixAt(counts[kind]++, dummy.matrix);
      dummy.position.set(cx, WALL_H + .015, cz); dummy.scale.set(sx, .03, sz); dummy.updateMatrix(); caps.setColorAt(capCount, capColor[kind]); caps.setMatrixAt(capCount++, dummy.matrix);
      const old = before?.get(`${r.axis}${r.index}`);
      // A brick wall that cracks throws a few chips.
      if (old && old.kind === 2 && kind === 3 && !reduced) debris.burst(cx, WALL_H / 2, cz, time, { count: 4, speed: 1.4, up: 2, size: .1, color: COLOR.brick });
      before?.delete(`${r.axis}${r.index}`);
    }
    // Walls that disappeared burst apart.
    if (before && !reduced) for (const r of before.values()) debris.burst(wx((r.x0 + r.x1) / 2), WALL_H / 2, wz((r.y0 + r.y1) / 2), time, { count: 8, speed: 2.2, size: .14, color: COLOR.cracked });
    for (const kind of [1, 2, 3] as const) { walls[kind].count = counts[kind]; walls[kind].instanceMatrix.needsUpdate = true; }
    caps.count = capCount; caps.instanceMatrix.needsUpdate = true; if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    edges = JSON.stringify({ h: g.h, v: g.v });
  };

  const tankFor = (id: string, style: number, selected: string | undefined, viewer: string): TankView => {
    let t = tanks.get(id);
    if (t) return t;
    const color = PLAYER_COLORS[style % PLAYER_COLORS.length];
    const body = new T.Group(); world.add(body);
    for (const side of [-1, 1]) kit.box(body, COLOR.tread, 0, .1, side * .28, .84, .2, .17);
    kit.box(body, color, 0, .24, 0, .7, .2, .46);
    kit.box(body, 0xfff9ed, .3, .3, 0, .06, .06, .3);
    const turret = new T.Group(); turret.position.y = .34; body.add(turret);
    kit.cylinder(turret, color, 0, .06, 0, .19, .14);
    kit.box(turret, COLOR.tread, .32, .07, 0, .42, .08, .08).name = "barrel";
    // The player's figure peeks out of the hatch and turns with the turret.
    const { fig: driver } = fittedFigure(kit, turret, style, selected, .14, .42, false);
    driver.group.position.set(-.04, .1, 0);
    const shield = new T.Mesh(new T.SphereGeometry(.62, 20, 14), new T.MeshBasicMaterial({ color: COLOR.shield, transparent: true, opacity: .22, depthWrite: false })); shield.position.y = .3; body.add(shield);
    const hud = new T.Group(); world.add(hud);
    const pips = Array.from({ length: TT.hp }, (_, i) => kit.box(hud, COLOR.hp, (i - (TT.hp - 1) / 2) * .17, 1.02, 0, .12, .06, .06));
    const marker = id === viewer ? kit.cone(hud, COLOR.own, 0, 1.35, 0, .17, .32) : undefined;
    if (marker) {
      marker.rotation.x = Math.PI;
      // A yellow ring on the ground marks the own tank, like the dashed ring in 2D.
      const ring = kit.mesh(hud, new T.TorusGeometry(.6, .05, 6, 32), COLOR.own, 0, .04, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    }
    const wreck = kit.box(world, COLOR.wreck, 0, .08, 0, .7, .16, .5); wreck.visible = false;
    t = { body, turret, hud, shield, pips, marker, wreck, driver, color, recoilAt: -1e9 }; tanks.set(id, t); return t;
  };

  /** Distance along a ray from (x, y) until the first wall (field units). */
  const rayToWall = (g: TankGame, x: number, y: number, a: number, max = 9) => {
    const rects = wallRects(g), dx = Math.cos(a), dy = Math.sin(a);
    for (let d = 0; d < max; d += .04) {
      const px = x + dx * d, py = y + dy * d;
      if (px < 0 || py < 0 || px > W || py > H || rects.some(r => px >= r.x0 && px <= r.x1 && py >= r.y0 && py <= r.y1)) return d;
    }
    return max;
  };

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as TankGame, prev = f.prev.game as TankGame, reduced = f.reduced;
    if (!chase && kit.camera.aspect !== aspect) { aspect = kit.camera.aspect; fitTiltedCamera(kit, W / 2 + .1, H / 2 + .1, WALL_H, TILT); }
    if (JSON.stringify({ h: g.h, v: g.v }) !== edges) rebuildWalls(g, time, reduced);

    // Events: shots (recoil, figure animation), hits (sparks), destroyed tanks (burst, flash, shake).
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const t = tanks.get(e.ids[0]), tank = g.tanks[e.ids[0]] ?? prev.tanks?.[e.ids[0]];
      if (e.kind === "dead") lastSeen.delete(e.ids[0]);
      if (e.kind === "shot" && t) { t.recoilAt = time; t.driver.act?.("attack", time); }
      else if (e.kind === "hit" && t && tank) { t.driver.act?.("hit", time); if (!reduced) debris.burst(wx(tank.x), .4, wz(tank.y), time, { count: 5, speed: 1.6, up: 2.2, size: .08, life: 450, color: COLOR.tracer }); }
      else if (e.kind === "dead" && t) {
        const last = prev.tanks?.[e.ids[0]] ?? tank;
        if (last) { if (!reduced) debris.burst(wx(last.x), .35, wz(last.y), time, { count: 12, speed: 2.6, up: 3.4, size: .16, life: 900, color: t.color }); impact.hit(wx(last.x), wz(last.y), time, reduced, 1.2); }
      }
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    // Tanks: interpolated position, hull heading, turret aim (own aim follows the finger at once).
    const aiming = Math.hypot(f.input.ax, f.input.ay) > .25;
    for (const p of s.players) {
      const tank = g.tanks[p.id];
      // Out of sight (Turmsicht): the authority left this tank out of the view.
      if (!tank) {
        const hidden = tanks.get(p.id); if (hidden) hidden.body.visible = hidden.hud.visible = hidden.wreck.visible = false;
        // Left the light: a ring marks the last known spot and fades within 2 s.
        const seen = lastSeen.get(p.id), age = seen ? time - seen.at : Infinity;
        if (chase && seen && age < 2000) {
          const ghost = ghostFor(p.id, PLAYER_COLORS[p.style % PLAYER_COLORS.length]);
          ghost.visible = true; ghost.position.set(wx(seen.x), 0, wz(seen.y)); ghostMat.get(p.id)!.opacity = .6 * (1 - age / 2000);
        } else if (ghosts.has(p.id)) ghosts.get(p.id)!.visible = false;
        continue;
      }
      if (ghosts.has(p.id)) ghosts.get(p.id)!.visible = false;
      const t = tankFor(p.id, p.style, f.characters[p.id], f.viewer), before = prev.tanks?.[p.id];
      const smooth = before && before.alive && tank.alive ? f.alpha : 1;
      const x = before ? before.x + (tank.x - before.x) * smooth : tank.x, y = before ? before.y + (tank.y - before.y) * smooth : tank.y;
      t.body.visible = tank.alive; t.hud.visible = tank.alive;
      t.wreck.visible = !tank.alive; if (!tank.alive) { t.wreck.position.set(wx(x), .08, wz(y)); t.wreck.rotation.y = yaw(tank.angle); continue; }
      t.body.position.set(wx(x), 0, wz(y)); t.hud.position.set(wx(x), 0, wz(y));
      if (p.id !== f.viewer) lastSeen.set(p.id, { x, y, at: time });
      const blend = (a: number, b: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * smooth;
      const angle = before ? blend(before.angle, tank.angle) : tank.angle;
      const aim = p.id === f.viewer && aiming ? Math.atan2(f.input.ay, f.input.ax) : before ? blend(before.aim, tank.aim) : tank.aim;
      t.body.rotation.y = yaw(angle); t.turret.rotation.y = yaw(aim) - yaw(angle);
      const recoil = reduced ? 0 : Math.max(0, 1 - (time - t.recoilAt) / 160) * .1;
      (t.turret.getObjectByName("barrel") as T.Mesh).position.x = .32 - recoil;
      t.driver.pose(Math.PI / 2, 0, time, 0, false, reduced);
      t.shield.visible = s.time < tank.shieldUntil || tank.power?.kind === "shield" && tank.power.until > s.time;
      t.pips.forEach((pip, i) => { pip.visible = i < tank.hp; });
      if (t.marker) t.marker.position.y = 1.35 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1);
      // The own tank needs no marker when the camera sits right behind it.
      if (chase && p.id === f.viewer) t.hud.visible = false;
    }

    // Aiming laser up to the first wall (direction only, no bounce preview).
    const me = g.tanks[f.viewer];
    laser.visible = !!me?.alive && aiming && !s.done;
    if (laser.visible && me) {
      const a = Math.atan2(f.input.ay, f.input.ax), muzzle = TT.tank + .1, length = Math.max(0, rayToWall(g, me.x, me.y, a) - muzzle);
      const mid = muzzle + length / 2;
      laser.position.set(wx(me.x + Math.cos(a) * mid), BULLET_Y, wz(me.y + Math.sin(a) * mid));
      laser.scale.set(length, .03, .07); laser.rotation.set(0, yaw(a), 0);
    }

    // Bullets with tracer trails.
    let b = 0, tr = 0;
    const live = new Set<number>();
    for (const bullet of g.bullets) {
      live.add(bullet.id);
      const before = prev.bullets?.find(q => q.id === bullet.id), x = before ? before.x + (bullet.x - before.x) * f.alpha : bullet.x, y = before ? before.y + (bullet.y - before.y) * f.alpha : bullet.y;
      dummy.position.set(wx(x), BULLET_Y, wz(y)); dummy.scale.setScalar(.15); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bullets.setMatrixAt(b++, dummy.matrix);
      const trail = history.get(bullet.id) ?? []; history.set(bullet.id, trail);
      if (!reduced) { trail.push([x, y]); if (trail.length > TRAIL) trail.shift(); }
      trail.forEach(([tx, ty], i) => { dummy.position.set(wx(tx), BULLET_Y, wz(ty)); dummy.scale.setScalar(.12 * (i + 1) / trail.length); dummy.updateMatrix(); trails.setMatrixAt(tr++, dummy.matrix); });
    }
    for (const id of history.keys()) if (!live.has(id)) history.delete(id);
    bullets.count = b; trails.count = tr; bullets.instanceMatrix.needsUpdate = true; trails.instanceMatrix.needsUpdate = true;

    // Power-ups float on a pad.
    const livePowers = new Set<number>();
    for (const power of g.powers) {
      livePowers.add(power.id);
      let group = powers.get(power.id);
      if (!group) {
        group = new T.Group(); group.position.set(wx(power.x), 0, wz(power.y)); world.add(group);
        kit.cylinder(group, COLOR.pad, 0, .04, 0, .3, .06);
        const badge = kit.badge(group, POWER_ICON[power.kind], "#24133f", .55); badge.position.y = .45; badge.name = "badge";
        powers.set(power.id, group);
      }
      group.getObjectByName("badge")!.position.y = .45 + (reduced ? 0 : Math.sin(time / 260 + power.id) * .06);
    }
    for (const [id, group] of powers) if (!livePowers.has(id)) { world.remove(group); powers.delete(id); }

    debris.update(time);
    if (chase && me) {
      const before = prev.tanks?.[f.viewer], smooth = before && before.alive && me.alive ? f.alpha : 1;
      const mx = before ? before.x + (me.x - before.x) * smooth : me.x, my = before ? before.y + (me.y - before.y) * smooth : me.y;
      target.set(wx(mx), 0, wz(my));
      updateDark(g, mx, my);
      // The camera starts (and restarts after a respawn) behind the hull; afterwards only a swipe turns it,
      // so steering with the stick never swings the view.
      if (me.alive && !wasAlive) camFresh = true;
      wasAlive = me.alive;
      takeCameraTurn(f.local as ChaseLocal, d => chaseCam.turn(d));
      chaseCam.tune(f.local as ChaseLocal);
      chaseCam.update(target, camFresh ? headingOf(Math.cos(me.angle), Math.sin(me.angle)) : undefined, Math.min(.05, (time - lastFrame) / 1000), reduced, 2.2);
      camFresh = false;
      followCamera(f.local as ChaseLocal, f.input, chaseCam.yaw);
    }
    lastFrame = time;
    host.dataset.camera = chase ? "chase" : "overview";
    if (chase) host.dataset.yaw = chaseCam.yaw.toFixed(3);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...tanks].map(([id, t]) => [id, t.driver.group.userData.characterId])));
    host.dataset.laser = laser.visible ? "on" : "off";
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); box.dispose(); kit.dispose(); } };
}

