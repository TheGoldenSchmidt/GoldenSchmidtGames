import * as T from "three";
import { SB, SNOW_TREES, SNOW_WALLS, throwTarget, type SnowGame, type Snowballer } from "../../shared/matches/snowball";
import { followCamera, headingOf, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "../matches/client";
import { ballArc } from "../matches/games/snowball";
import { ChaseCamera, Debris, fittedFigure, fitTiltedCamera, Impact } from "./matchScene";
import { PLAYER_COLORS, SceneKit, type Character } from "./sceneKit";

/**
 * Schneeballschlacht in 3D: a small winter arena with snow walls, pines and
 * snow piles; the chosen figures run, form and throw, flying balls follow an
 * arc (presentation; the rules fly flat) and a hit player turns into a
 * snowman after the third hit. A chase camera follows the own figure; out or
 * watching, the whole arena is shown from above. Pure presentation.
 */
const HALF = SB.size / 2, WALL_H = 1.05, TILT = 58 * Math.PI / 180;
const wx = (x: number) => x - HALF, wz = (y: number) => y - HALF;
const COLOR = { sky: 0xbfe0f7, ground: 0xf4f9ff, drift: 0xdceaf8, wall: 0xe4f0fb, cap: 0xffffff, pine: 0x2f7a5a, trunk: 0x6b4a2f, ball: 0xffffff, shadow: 0x5a7fa8, frost: 0x57a6e4, own: 0xffe44e, carrot: 0xff8a3d, coal: 0x24133f, aim: 0x24306b } as const;

interface Player { fig: Character; top: number; balls: T.Mesh[]; frost: T.Mesh[]; marker?: T.Mesh; ring: T.Mesh; snowman: T.Group; outAt?: number; aimAt: number }

export function createSnowWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.sky); kit.scene.fog = new T.Fog(COLOR.sky, 14, 34);
  kit.camera.fov = 56; kit.camera.near = .05; kit.camera.updateProjectionMatrix();
  const chaseCam = new ChaseCamera(kit, 4.6, 4.2, 3, .5), target = new T.Vector3();

  // Snowfield with soft drifts, a low snow bank around the arena.
  const ground = new T.Mesh(new T.PlaneGeometry(SB.size + 30, SB.size + 30), new T.MeshStandardMaterial({ color: COLOR.ground, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  for (let i = 0; i < 26; i++) { const drift = kit.ball(world, COLOR.drift, wx((i * 7.7) % SB.size), -.12, wz((i * 4.9 + 3) % SB.size), .9 + (i % 4) * .3, .22, .7 + (i % 3) * .3); drift.castShadow = false; }
  for (const [x, z, sx, sz] of [[0, -HALF - .4, SB.size + 1.6, .8], [0, HALF + .4, SB.size + 1.6, .8], [-HALF - .4, 0, .8, SB.size], [HALF + .4, 0, .8, SB.size]]) kit.box(world, COLOR.wall, x, .3, z, sx, .6, sz);
  // Snow walls exactly as large as the rules' rectangles, with a bright rounded cap.
  for (const r of SNOW_WALLS) {
    const cx = wx((r.x0 + r.x1) / 2), cz = wz((r.y0 + r.y1) / 2), sx = r.x1 - r.x0, sz = r.y1 - r.y0;
    kit.box(world, COLOR.wall, cx, WALL_H / 2, cz, sx, WALL_H, sz);
    kit.ball(world, COLOR.cap, cx, WALL_H, cz, sx / 2 + .04, .14, sz / 2 + .04);
  }
  // Pines: trunk, three snowy tiers.
  for (const t of SNOW_TREES) {
    kit.cylinder(world, COLOR.trunk, wx(t.x), .35, wz(t.y), .14, .7);
    [[.9, 1.1, 1.0], [.72, 1.65, .9], [.5, 2.15, .75]].forEach(([r, y, h]) => { kit.cone(world, COLOR.pine, wx(t.x), y, wz(t.y), r, h); kit.cone(world, COLOR.cap, wx(t.x), y + h * .32, wz(t.y), r * .45, h * .36); });
  }
  // Snow piles: mounds that shrink while they refill.
  const piles = new Map<number, T.Mesh>();
  // Flying balls and their shadows (instanced), a short white burst on every splat or hit.
  const ballMesh = new T.InstancedMesh(new T.SphereGeometry(1, 12, 8), new T.MeshStandardMaterial({ color: COLOR.ball, roughness: .6 }), 64);
  const shadowMesh = new T.InstancedMesh(new T.CircleGeometry(1, 16), new T.MeshBasicMaterial({ color: COLOR.shadow, transparent: true, opacity: .3, depthWrite: false }), 64);
  for (const mesh of [ballMesh, shadowMesh]) { mesh.count = 0; mesh.frustumCulled = false; world.add(mesh); }
  ballMesh.castShadow = true;
  const dummy = new T.Object3D(), puff = new Debris(world, 120, new T.MeshStandardMaterial({ color: COLOR.ball, roughness: .7 })), impact = new Impact(world, kit);
  // Aim guide for the own throw: dotted line on the snow up to the range or the first wall.
  const guide = new T.InstancedMesh(new T.CircleGeometry(.08, 10), new T.MeshBasicMaterial({ color: COLOR.aim, transparent: true, opacity: .55, depthWrite: false }), 24);
  guide.frustumCulled = false; guide.count = 0; world.add(guide);
  // Lock-on: a pulsing ring with four ticks under the opponent the own throw would go to.
  const lock = new T.Group(); lock.visible = false; world.add(lock);
  const lockRing = kit.mesh(lock, new T.TorusGeometry(.62, .05, 6, 32), COLOR.own, 0, .05, 0); lockRing.rotation.x = Math.PI / 2; lockRing.castShadow = false;
  for (let i = 0; i < 4; i++) { const tick = kit.box(lock, COLOR.own, Math.cos(i * Math.PI / 2) * .82, .05, Math.sin(i * Math.PI / 2) * .82, .22, .04, .07); tick.rotation.y = -i * Math.PI / 2; tick.castShadow = false; }

  const players = new Map<string, Player>();
  const playerFor = (id: string, style: number, selected: string | undefined, viewer: string): Player => {
    let p = players.get(id);
    if (p) return p;
    const color = PLAYER_COLORS[style % PLAYER_COLORS.length];
    const { fig, top } = fittedFigure(kit, world, style, selected, .38, 1.2);
    const balls = [0, 1].map(i => kit.ball(fig.group, COLOR.ball, (i - .5) * .22, top + .2, 0, .08));
    const frost = Array.from({ length: SB.hitsOut }, (_, i) => kit.box(fig.group, COLOR.frost, (i - 1) * .16, top + .42, 0, .11, .11, .11));
    const marker = id === viewer ? kit.cone(fig.group, COLOR.own, 0, top + .75, 0, .16, .3) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    const ring = kit.mesh(world, new T.TorusGeometry(.48, .04, 6, 28), id === viewer ? COLOR.own : color, 0, .03, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    // Snowman shown once the player is out: three balls, coal eyes, a carrot and a hat in the player colour.
    const snowman = new T.Group(); snowman.visible = false; world.add(snowman);
    kit.ball(snowman, COLOR.ball, 0, .38, 0, .42); kit.ball(snowman, COLOR.ball, 0, .95, 0, .3); kit.ball(snowman, COLOR.ball, 0, 1.37, 0, .22);
    for (const side of [-1, 1]) kit.ball(snowman, COLOR.coal, side * .08, 1.42, .19, .03);
    const nose = kit.cone(snowman, COLOR.carrot, 0, 1.36, .3, .045, .22); nose.rotation.x = Math.PI / 2;
    kit.cylinder(snowman, color, 0, 1.62, 0, .2, .04); kit.cylinder(snowman, color, 0, 1.75, 0, .13, .26);
    p = { fig, top, balls, frost, marker, ring, snowman, aimAt: -1e9 }; players.set(id, p); return p;
  };

  /** Balls seen in flight; when one disappears it bursts where it was last drawn. */
  const flying = new Map<number, { x: number; y: number; h: number }>();
  let lastSeq = 0, frame = 0, aspect = 0, lastFrame = performance.now(), chasing = false, camFresh = true;
  const pose = (me: Snowballer, before: Snowballer | undefined, alpha: number) => before && Math.hypot(before.x - me.x, before.y - me.y) < 2 ? [before.x + (me.x - before.x) * alpha, before.y + (me.y - before.y) * alpha] as const : [me.x, me.y] as const;

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as SnowGame, prev = f.prev.game as SnowGame, reduced = f.reduced, dt = Math.max(0, Math.min(.05, (time - lastFrame) / 1000));
    lastFrame = time;
    const local = f.local as ChaseLocal, mine = g.players[f.viewer];
    const chase = !!mine && mine.outAt === undefined;
    if (chase !== chasing) { chasing = chase; aspect = 0; camFresh = true; chaseCam.reset(); kit.camera.fov = chase ? 56 : 32; kit.camera.updateProjectionMatrix(); if (!chase) delete local.camYaw; }
    if (!chase && kit.camera.aspect !== aspect) { aspect = kit.camera.aspect; fitTiltedCamera(kit, HALF + .6, HALF + .6, 2.4, TILT); }

    // Events: throws, hits, freezing, splats.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const who = players.get(e.ids[0]), at = g.players[e.ids[0]] ?? prev.players?.[e.ids[0]];
      if (e.kind === "throw" && who) who.fig.act?.("attack", time);
      else if ((e.kind === "hit" || e.kind === "frozen") && who && at) {
        who.fig.act?.("hit", time);
        if (!reduced) puff.burst(wx(at.x), .9, wz(at.y), time, { count: 10, speed: 1.8, up: 2.4, size: .1, life: 600, color: COLOR.ball });
        impact.hit(wx(at.x), wz(at.y), time, reduced, .4);
        if (e.kind === "frozen") who.outAt = time;
      }
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    for (const pile of g.piles) {
      let mound = piles.get(pile.id);
      if (!mound) { mound = kit.ball(world, COLOR.ball, wx(pile.x), 0, wz(pile.y), SB.pileRadius, .45, SB.pileRadius); piles.set(pile.id, mound); }
      const ready = f.simTime >= pile.readyAt, k = ready ? 1 : .35;
      mound.scale.set(SB.pileRadius * k, .45 * k, SB.pileRadius * k);
    }

    const aiming = Math.hypot(f.input.ax, f.input.ay) > .2;
    for (const p of s.players) {
      const me = g.players[p.id];
      if (!me) continue;
      const view = playerFor(p.id, p.style, f.characters[p.id], f.viewer), [x, y] = pose(me, prev.players?.[p.id], f.alpha);
      const out = me.outAt !== undefined;
      view.fig.group.visible = !out; view.ring.visible = !out;
      view.snowman.visible = out;
      if (out) {
        // The snowman grows out of the snow where the player stood.
        const k = reduced || view.outAt === undefined ? 1 : Math.min(1, (time - view.outAt) / 450);
        view.snowman.position.set(wx(x), 0, wz(y)); view.snowman.scale.setScalar(.2 + .8 * k);
        view.snowman.rotation.y = Math.atan2(me.fx, me.fy);
        continue;
      }
      view.outAt = undefined;
      const before = prev.players?.[p.id], speed = before ? Math.hypot(me.x - before.x, me.y - before.y) / Math.max(.001, (s.time - f.prev.time) / 1000) : 0;
      const heading = p.id === f.viewer && aiming ? Math.atan2(f.input.ax, f.input.ay) : Math.atan2(me.fx, me.fy);
      view.fig.group.position.set(wx(x), 0, wz(y));
      view.fig.pose(heading, speed, time, 0, me.form > 0 && !reduced && Math.floor(time / 220) % 2 === 0, reduced);
      view.balls.forEach((m, i) => { m.visible = i < me.balls; });
      view.frost.forEach((m, i) => { m.visible = i < me.hits; });
      if (view.marker) { view.marker.visible = !chase; view.marker.position.y = view.top + .75 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1); }
      view.ring.position.set(wx(x), .03, wz(y));
      // A short blink after a hit (protection time).
      if (s.time - me.hitAt < SB.hitGrace && !reduced) view.fig.group.visible = Math.floor(time / 90) % 2 === 0;
    }

    // Flying balls on their arc, with shadows on the snow.
    let n = 0;
    for (const b of g.balls) {
      const before = prev.balls?.find(q => q.id === b.id), x = before ? before.x + (b.x - before.x) * f.alpha : b.x, y = before ? before.y + (b.y - before.y) * f.alpha : b.y;
      const height = ballArc(Math.hypot(x - b.sx, y - b.sy));
      dummy.position.set(wx(x), height, wz(y)); dummy.scale.setScalar(SB.ballRadius); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); ballMesh.setMatrixAt(n, dummy.matrix);
      dummy.position.set(wx(x), .02, wz(y)); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(SB.ballRadius * 1.1); dummy.updateMatrix(); shadowMesh.setMatrixAt(n, dummy.matrix);
      n++; flying.set(b.id, { x, y, h: height });
    }
    for (const [id, b] of flying) if (!g.balls.some(q => q.id === id)) {
      if (!reduced) puff.burst(wx(b.x), b.h, wz(b.y), time, { count: 5, speed: 1.2, up: 1.6, size: .07, life: 380, color: COLOR.ball });
      flying.delete(id);
    }
    ballMesh.count = n; shadowMesh.count = n; ballMesh.instanceMatrix.needsUpdate = true; shadowMesh.instanceMatrix.needsUpdate = true;

    // Lock-on: the opponent a throw would go to now (aimed: near the aim).
    const ready = mine && mine.outAt === undefined && mine.balls > 0 && !s.done;
    // Not aiming: what a tap would hit, the nearest opponent in view of the camera.
    const aimLen = Math.hypot(f.input.ax, f.input.ay);
    const locked = !ready ? undefined : aiming ? throwTarget(g, mine, f.input.ax / aimLen, f.input.ay / aimLen)
      : chase ? throwTarget(g, mine, Math.sin(chaseCam.yaw), -Math.cos(chaseCam.yaw), SB.tapCone) : throwTarget(g, mine);
    lock.visible = !!locked;
    if (locked) {
      const [lx, ly] = pose(locked, prev.players?.[locked.id], f.alpha);
      lock.position.set(wx(lx), 0, wz(ly)); lock.rotation.y = reduced ? 0 : time / 600; lock.scale.setScalar(reduced ? 1 : 1 + Math.sin(time / 160) * .06);
    }
    host.dataset.lock = locked?.id ?? "";
    // Own aim guide: dots in the throw direction up to the range (direction only, flat like the rules); towards the locked opponent.
    let dots = 0;
    if (chase && mine && aiming && mine.balls > 0 && !s.done) {
      const [mx, my] = pose(mine, prev.players?.[f.viewer], f.alpha), a = locked ? Math.atan2(locked.y - mine.y, locked.x - mine.x) : Math.atan2(f.input.ay, f.input.ax);
      for (let d = .8; d < SB.range && dots < 24; d += .55) {
        const px = mx + Math.cos(a) * d, py = my + Math.sin(a) * d;
        if (px < 0 || py < 0 || px > SB.size || py > SB.size || SNOW_WALLS.some(r => px > r.x0 && px < r.x1 && py > r.y0 && py < r.y1) || SNOW_TREES.some(t => Math.hypot(px - t.x, py - t.y) < t.r)) break;
        dummy.position.set(wx(px), .03, wz(py)); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); guide.setMatrixAt(dots++, dummy.matrix);
      }
    }
    guide.count = dots; guide.instanceMatrix.needsUpdate = true;
    host.dataset.aim = dots ? "on" : "off";

    puff.update(time);
    if (chase && mine) {
      const [mx, my] = pose(mine, prev.players?.[f.viewer], f.alpha);
      target.set(wx(mx), 0, wz(my));
      takeCameraTurn(local, d => chaseCam.turn(d));
      chaseCam.tune(local);
      chaseCam.update(target, camFresh ? headingOf(mine.fx, mine.fy) : undefined, dt, reduced, 1.4);
      camFresh = false;
      followCamera(local, f.input, chaseCam.yaw);
    }
    host.dataset.camera = chase ? "chase" : "overview";
    if (chase) host.dataset.yaw = chaseCam.yaw.toFixed(3); else delete host.dataset.yaw;
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...players].map(([id, p]) => [id, p.fig.group.userData.characterId])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); kit.dispose(); } };
}
