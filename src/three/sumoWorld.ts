import * as T from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Fighter, RingGame } from "../../shared/matches/ringCore";
import { SUMO } from "../../shared/matches/sumoSmash";
import type { MatchWorld, MatchWorldFrame } from "../matches/client";
import { Debris, frameBox, Impact } from "./matchScene";
import { riggedFigure, type RiggedFigure } from "./riggedFigure";
import { PLAYER_COLORS, SceneKit } from "./sceneKit";

/**
 * Sumo Smash in 2.5D with rigged, animated figures: a clay ring (dohyo)
 * floating above the clouds, a rope edge that shrinks with the rules, figures
 * that walk, dash, get hit, fly off the platform and drop back in.
 * Pure presentation of the authoritative view (positions, ring, events).
 */
const START_RADIUS = 5.5, TILT = 40 * Math.PI / 180, FIGURE_H = 2.5;
const COLOR = { sky: 0x8fd3ff, cloud: 0xffffff, base: 0x6d4c41, clay: 0xe9d7a8, outside: 0xc9b48a, rope: 0xb23a48, line: 0xfff9ed, shield: 0x57e4cb, own: 0xffe44e, life: 0xff86c8, star: 0xffe44e } as const;
/** 2D heading (x right, y down on screen = +z) → rotation of a figure facing +Z. */
const yawOf = (heading: number) => Math.atan2(Math.cos(heading), Math.sin(heading));

interface View { fig: RiggedFigure; lives: T.Mesh[]; marker?: T.Mesh; ring?: T.Mesh; shield: T.Mesh; stars: T.Mesh[]; wasOut: boolean; outAt: number; outFrom: T.Vector3; outVel: T.Vector3; backAt: number; cheered: boolean }

export function createSumoWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, gltf: GLTF): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.sky); kit.scene.fog = new T.Fog(COLOR.sky, 30, 70);
  kit.camera.fov = 30; kit.camera.updateProjectionMatrix();

  // Clouds below and around the floating ring.
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, r = 8 + (i % 4) * 1.6;
    const cloud = kit.ball(world, COLOR.cloud, Math.cos(a) * r, -3.2 - (i % 3) * .6, Math.sin(a) * r, 1.6 + (i % 3) * .4, .55, 1.2 + (i % 2) * .5);
    cloud.castShadow = false;
  }
  // Dohyo: wooden base, clay top, the playable disc lighter than the shrinking outside.
  kit.cylinder(world, COLOR.base, 0, -.55, 0, START_RADIUS + .7, 1.1);
  kit.cylinder(world, COLOR.outside, 0, -.03, 0, START_RADIUS + .55, .06).castShadow = false;
  const disc = kit.cylinder(world, COLOR.clay, 0, 0, 0, 1, .04); disc.castShadow = false; disc.scale.set(START_RADIUS, .04, START_RADIUS);
  const rope = kit.mesh(world, new T.TorusGeometry(1, .02, 8, 96), COLOR.rope, 0, .05, 0); rope.rotation.x = Math.PI / 2; rope.castShadow = false;
  for (const side of [-1, 1]) kit.box(world, COLOR.line, side * .6, .03, 0, .08, .02, 1.1).castShadow = false;

  const impact = new Impact(world, kit), dust = new Debris(world, 80, new T.MeshStandardMaterial({ color: COLOR.clay, roughness: 1 }));
  const views = new Map<string, View>();
  let lastSeq = 0, frame = 0, last = performance.now(), camPos: T.Vector3 | undefined, camTarget: T.Vector3 | undefined;

  const viewFor = (id: string, style: number, viewer: string): View => {
    let v = views.get(id);
    if (v) return v;
    const fig = riggedFigure(gltf, PLAYER_COLORS[style % PLAYER_COLORS.length], FIGURE_H); world.add(fig.group);
    const lives = [0, 1, 2].map(i => kit.ball(fig.group, COLOR.life, (i - 1) * .17, FIGURE_H + .22, 0, .07));
    const marker = id === viewer ? kit.cone(fig.group, COLOR.own, 0, FIGURE_H + .55, 0, .17, .32) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    const ring = id === viewer ? kit.mesh(world, new T.TorusGeometry(SUMO.body + .08, .045, 6, 32), COLOR.own, 0, .04, 0) : undefined;
    if (ring) { ring.rotation.x = Math.PI / 2; ring.castShadow = false; }
    const shield = new T.Mesh(new T.SphereGeometry(SUMO.body + .25, 20, 14), new T.MeshBasicMaterial({ color: COLOR.shield, transparent: true, opacity: .2, depthWrite: false }));
    shield.position.y = FIGURE_H / 2; fig.group.add(shield);
    const stars = [0, 1, 2].map(() => kit.mesh(fig.group, new T.OctahedronGeometry(.08), COLOR.star, 0, FIGURE_H + .05, 0));
    v = { fig, lives, marker, ring, shield, stars, wasOut: false, outAt: -1e9, outFrom: new T.Vector3(), outVel: new T.Vector3(), backAt: -1e9, cheered: false };
    views.set(id, v); return v;
  };

  const lerpPos = (f: Fighter, before: Fighter | undefined, alpha: number) => before && !before.out ? [before.x + (f.x - before.x) * alpha, before.y + (f.y - before.y) * alpha] as const : [f.x, f.y] as const;

  const animate = (time: number) => {
    const frameData = read(), s = frameData.cur, g = s.game as RingGame, prev = frameData.prev.game as RingGame, reduced = frameData.reduced;
    const dt = Math.min(.05, (time - last) / 1000); last = time;
    const radius = prev.radius + (g.radius - prev.radius) * frameData.alpha;
    disc.scale.set(radius, .04, radius); rope.scale.set(radius, radius, 1);

    // Events: dashes, strikes (hit animation, dust, shake), ring-outs.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const v = views.get(e.ids[0]), fighter = g.fighters[e.ids[0]];
      if (e.kind === "action") v?.fig.play("dash");
      else if (e.kind === "strike" && v && fighter) {
        v.fig.play("hit");
        if (!reduced) dust.burst(fighter.x, .2, fighter.y, time, { count: 8, speed: 1.8, up: 2.4, size: .1, life: 600 });
        impact.hit(fighter.x, fighter.y, time, reduced, .5);
      }
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    for (const p of s.players) {
      const fighter = g.fighters[p.id];
      if (!fighter) continue;
      const v = viewFor(p.id, p.style, frameData.viewer), before = prev.fighters?.[p.id];
      const [x, y] = lerpPos(fighter, before, frameData.alpha);
      let height = 0;
      // Ring-out: keep flying outwards and drop below the platform; then wait for the respawn.
      if (fighter.out && !v.wasOut) {
        v.wasOut = true; v.outAt = time;
        const from = before ?? fighter; v.outFrom.set(from.x, 0, from.y); v.outVel.set(from.vx, 0, from.vy);
        if (v.outVel.length() < 2) v.outVel.setLength(2);
        v.fig.setLoop("fall");
      } else if (!fighter.out && v.wasOut) { v.wasOut = false; v.backAt = time; v.fig.setLoop("idle"); v.fig.play("land"); }
      if (fighter.out) {
        const t = (time - v.outAt) / 1000;
        v.fig.group.position.set(v.outFrom.x + v.outVel.x * t, -4.9 * t * t, v.outFrom.z + v.outVel.z * t);
        v.fig.group.visible = fighter.alive ? t < 1.4 : t < 1.4;
      } else {
        // Respawn: drop in from above.
        const k = reduced ? 1 : Math.min(1, (time - v.backAt) / 350);
        height = (1 - k) * (1 - k) * 2.6;
        v.fig.group.position.set(x, height, y);
        v.fig.group.visible = fighter.alive;
        const speed = Math.hypot(fighter.vx, fighter.vy), stunned = s.time < fighter.stunUntil;
        v.fig.setLoop(speed > .45 && !stunned ? "move" : "idle", speed / 2.4);
      }
      v.fig.group.rotation.y = yawOf(fighter.heading);
      v.fig.update(dt);
      v.shield.visible = !fighter.out && s.time < fighter.shieldUntil;
      v.lives.forEach((m, i) => { m.visible = fighter.alive && i < fighter.lives; });
      const stunned = !fighter.out && s.time < fighter.stunUntil && !reduced;
      v.stars.forEach((star, i) => { star.visible = stunned; const a = time / 160 + i * Math.PI * 2 / 3; star.position.set(Math.cos(a) * .32, FIGURE_H + .05, Math.sin(a) * .32); });
      if (v.marker) v.marker.position.y = FIGURE_H + .55 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1);
      if (v.ring) { v.ring.visible = !fighter.out && fighter.alive; v.ring.position.set(x, .04 + height, y); }
      // The winner cheers once the match is decided.
      if (s.done && g.winner === p.id && !v.cheered) { v.cheered = true; v.fig.play("cheer"); }
    }

    // Fighting-game camera: frame every fighter still in the ring (plus margin), never wider than the ring.
    const inRing = s.players.map(p => g.fighters[p.id]).filter(f => f?.alive && !f.out);
    const pad = 2.6, limit = Math.max(radius, 3) + .8;
    const xs = inRing.length ? inRing.map(f => f.x) : [0], zs = inRing.length ? inRing.map(f => f.y) : [0];
    let x0 = Math.max(-limit, Math.min(...xs) - pad), x1 = Math.min(limit, Math.max(...xs) + pad), z0 = Math.max(-limit, Math.min(...zs) - pad), z1 = Math.min(limit, Math.max(...zs) + pad);
    const minHalf = 3.4;
    if (x1 - x0 < minHalf * 2) { const c = (x0 + x1) / 2; x0 = c - minHalf; x1 = c + minHalf; }
    if (z1 - z0 < minHalf * 2) { const c = (z0 + z1) / 2; z0 = c - minHalf; z1 = c + minHalf; }
    const shot = frameBox(kit, x0, x1, z0, z1, FIGURE_H, TILT);
    const glide = reduced || !camPos ? 1 : 1 - Math.exp(-dt * 3);
    camPos = (camPos ?? shot.position.clone()).lerp(shot.position, glide); camTarget = (camTarget ?? shot.target.clone()).lerp(shot.target, glide);
    kit.camera.position.copy(camPos); kit.camera.lookAt(camTarget);
    dust.update(time);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...views.keys()].map(id => [id, "mannequin"])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); for (const v of views.values()) v.fig.dispose(); kit.dispose(); } };
}
