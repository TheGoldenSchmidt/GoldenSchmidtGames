import * as T from "three";
import type { Fighter, RingGame } from "../../shared/matches/ringCore";
import { BUMPER } from "../../shared/matches/bumperMayhem";
import type { MatchWorld, MatchWorldFrame } from "../matches/client";
import { Debris, frameBox, Impact } from "./matchScene";
import { riggedFigure, riggedIdFor, type CharacterKit, type RiggedFigure } from "./riggedFigure";
import { PLAYER_COLORS, SceneKit } from "./sceneKit";

/**
 * Bumper Mayhem in 2.5D: a night-time bumper-car rink with a glowing edge
 * that shrinks with the rules, turning gold posts and one car per player with
 * the chosen figure at the wheel. Every car carries the typical current pole
 * with a spark on top that flares during the turbo. Pure presentation of the
 * authoritative view (positions, headings, edge, events).
 */
const START_RADIUS = 6, TILT = 46 * Math.PI / 180, FIGURE_H = 1.45, CAR_TOP = 1.7;
const COLOR = { night: 0x14102e, rink: 0x2a2160, grid: 0x3b2f80, outside: 0x1d1748, rim: 0x0d0a22, edge: 0xff86c8, post: 0xffe44e, ink: 0x24133f, spark: 0xfff3a0, own: 0xffe44e, life: 0xff86c8, star: 0xffe44e, shield: 0x57e4cb, turbo: 0xffa04a } as const;
/** 2D heading (x right, y down on screen = +z) → rotation of a model facing +Z. */
const yawOf = (heading: number) => Math.atan2(Math.cos(heading), Math.sin(heading));

interface Car {
  /** `bumpAt`: last collision, for a short squash of the car. */
  bumpAt: number;
  group: T.Group; body: T.Mesh; fig: RiggedFigure; spark: T.Mesh; flame: T.Mesh; lives: T.Mesh[]; marker?: T.Mesh; ring: T.Mesh; shield: T.Mesh; stars: T.Mesh[];
  wasOut: boolean; outAt: number; outFrom: T.Vector3; outVel: T.Vector3; backAt: number; cheered: boolean;
}

/** Grid texture for the rink floor (drawn once). */
function gridTexture() {
  const size = 128, canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2a2160"; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#3b2f80"; ctx.lineWidth = 4; ctx.strokeRect(0, 0, size, size);
  const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}

export function createBumperWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, chars: CharacterKit): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.night); kit.scene.fog = new T.Fog(COLOR.night, 28, 60);
  kit.camera.fov = 30; kit.camera.near = .5; kit.camera.updateProjectionMatrix();

  // Rink: dark rim, darker outside floor, the playable disc with a grid (shrinks with the rules), glowing edge.
  kit.cylinder(world, COLOR.rim, 0, -.45, 0, START_RADIUS + 1.2, .9);
  kit.cylinder(world, COLOR.outside, 0, -.06, 0, START_RADIUS + 1, .06).castShadow = false;
  const grid = gridTexture(), floorMat = new T.MeshStandardMaterial({ map: grid, roughness: .55, metalness: .1 });
  const disc = new T.Mesh(new T.CylinderGeometry(1, 1, .04, 64), floorMat); disc.position.y = -.01; disc.receiveShadow = true; world.add(disc);
  const edge = new T.Mesh(new T.TorusGeometry(START_RADIUS, .07, 8, 96), new T.MeshStandardMaterial({ color: COLOR.edge, emissive: COLOR.edge, emissiveIntensity: .8 }));
  edge.rotation.x = Math.PI / 2; edge.position.y = .06; world.add(edge);
  // Rubber wall around the hall (decoration, outside the play area).
  const wall = new T.Mesh(new T.TorusGeometry(START_RADIUS + 1.15, .16, 8, 96), new T.MeshStandardMaterial({ color: COLOR.ink, roughness: .9 }));
  wall.rotation.x = Math.PI / 2; wall.position.y = .12; world.add(wall);
  const light = new T.PointLight(COLOR.edge, 6, 18, 1.6); light.position.set(0, 5, 0); world.add(light);

  // Turning posts.
  const posts = new Map<number, T.Group>();
  const postFor = (id: number) => {
    let group = posts.get(id);
    if (group) return group;
    group = new T.Group(); world.add(group);
    kit.cylinder(group, COLOR.post, 0, .5, 0, BUMPER.postRadius, 1).castShadow = true;
    const band = kit.mesh(group, new T.TorusGeometry(BUMPER.postRadius * .62, .07, 6, 24), COLOR.ink, 0, 1.01, 0); band.rotation.x = Math.PI / 2;
    kit.box(group, COLOR.ink, 0, .5, 0, BUMPER.postRadius * 2.05, .12, .12);
    posts.set(id, group); return group;
  };

  const impact = new Impact(world, kit), sparks = new Debris(world, 90, new T.MeshBasicMaterial({ color: COLOR.spark }));
  const cars = new Map<string, Car>();
  let lastSeq = 0, frame = 0, last = performance.now(), camPos: T.Vector3 | undefined, camTarget: T.Vector3 | undefined;

  const carFor = (id: string, style: number, viewer: string, chosen: string | undefined): Car => {
    let car = cars.get(id);
    if (car) return car;
    const color = PLAYER_COLORS[style % PLAYER_COLORS.length], own = id === viewer, group = new T.Group(); world.add(group);
    // Body in the player colour, a black rubber bumper all around, a seat and the current pole at the back.
    // Round like its collision body: the rubber ring marks exactly where cars touch.
    const body = kit.box(group, color, 0, .3, 0, .74, .34, .82); body.castShadow = true;
    kit.box(group, color, 0, .5, -.3, .7, .26, .24).castShadow = true;
    kit.mesh(group, new T.TorusGeometry(BUMPER.body - .06, .1, 8, 32), COLOR.ink, 0, .2, 0).rotation.x = Math.PI / 2;
    kit.box(group, COLOR.ink, 0, .48, -.2, .5, .12, .34);
    kit.cylinder(group, COLOR.ink, 0, .48 + (CAR_TOP - .48) / 2, -.36, .025, CAR_TOP - .48);
    const spark = kit.ball(group, COLOR.spark, 0, CAR_TOP, -.36, .07); spark.castShadow = false;
    spark.material = (spark.material as T.MeshStandardMaterial).clone(); (spark.material as T.MeshStandardMaterial).emissive = new T.Color(COLOR.spark);
    const flame = kit.cone(group, COLOR.turbo, 0, .32, -.62, .16, .45); flame.rotation.x = -Math.PI / 2; flame.castShadow = false;
    const fig = riggedFigure(chars, chosen, style, color, FIGURE_H); fig.group.position.set(0, .22, -.08); group.add(fig.group); fig.setLoop("drive");
    const lives = [0, 1, 2].map(i => kit.ball(group, COLOR.life, (i - 1) * .17, CAR_TOP + .3, 0, .07));
    const marker = own ? kit.cone(group, COLOR.own, 0, CAR_TOP + .65, 0, .17, .32) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    // A ring on the floor in the player colour; the own one is yellow and thicker.
    const ring = kit.mesh(world, new T.TorusGeometry(BUMPER.body + .14, own ? .06 : .04, 6, 32), own ? COLOR.own : color, 0, .04, 0); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    const shield = new T.Mesh(new T.SphereGeometry(BUMPER.body + .35, 20, 14), new T.MeshBasicMaterial({ color: COLOR.shield, transparent: true, opacity: .2, depthWrite: false }));
    shield.position.y = .6; group.add(shield);
    const stars = [0, 1, 2].map(() => kit.mesh(group, new T.OctahedronGeometry(.08), COLOR.star, 0, CAR_TOP - .3, 0));
    car = { bumpAt: -1e9, group, body, fig, spark, flame, lives, marker, ring, shield, stars, wasOut: false, outAt: -1e9, outFrom: new T.Vector3(), outVel: new T.Vector3(), backAt: -1e9, cheered: false };
    cars.set(id, car); return car;
  };

  // Jumps (restart on the start places) are not interpolated.
  const lerpPos = (f: Fighter, before: Fighter | undefined, alpha: number) => before && !before.out && Math.hypot(f.x - before.x, f.y - before.y) < 1.5 ? [before.x + (f.x - before.x) * alpha, before.y + (f.y - before.y) * alpha] as const : [f.x, f.y] as const;
  const lerpAngle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

  const animate = (time: number) => {
    const frameData = read(), s = frameData.cur, g = s.game as RingGame, prev = frameData.prev.game as RingGame, reduced = frameData.reduced;
    const dt = Math.min(.05, (time - last) / 1000); last = time;
    const radius = prev.radius + (g.radius - prev.radius) * frameData.alpha;
    disc.scale.set(radius, 1, radius); edge.scale.set(radius / START_RADIUS, radius / START_RADIUS, 1);
    grid.repeat.set(radius * 1.2, radius * 1.2); grid.offset.set(-radius * .6, -radius * .6);
    (edge.material as T.MeshStandardMaterial).emissiveIntensity = reduced ? .8 : .7 + Math.sin(time / 260) * .25;

    for (const o of g.obstacles) {
      const before = prev.obstacles?.find(p => p.id === o.id), x = before ? before.x + (o.x - before.x) * frameData.alpha : o.x, z = before ? before.y + (o.y - before.y) * frameData.alpha : o.y;
      const post = postFor(o.id); post.position.set(x, 0, z); post.rotation.y = -o.angle * 2;
    }

    // Events: turbo, strikes (sparks and shake), restart after a ring-out.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const car = cars.get(e.ids[0]), fighter = g.fighters[e.ids[0]];
      if (e.kind === "strike" && car && fighter) {
        car.fig.play("hitLight");
        for (const id of e.ids) { const c = cars.get(id); if (c) c.bumpAt = time; }
        if (!reduced) sparks.burst(fighter.x, .5, fighter.y, time, { count: 10, speed: 2.6, up: 2.6, size: .07, life: 450, color: COLOR.spark });
        impact.hit(fighter.x, fighter.y, time, reduced, .5);
      } else if (e.kind === "reset") for (const c of cars.values()) if (!c.wasOut) c.backAt = time;
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    for (const p of s.players) {
      const fighter = g.fighters[p.id];
      if (!fighter) continue;
      const car = carFor(p.id, p.style, frameData.viewer, frameData.characters[p.id]), before = prev.fighters?.[p.id];
      const [x, z] = lerpPos(fighter, before, frameData.alpha);
      let height = 0;
      // Ring-out: the car keeps sliding outwards and drops off the rink; then it waits for the restart.
      if (fighter.out && !car.wasOut) {
        car.wasOut = true; car.outAt = time;
        const from = before ?? fighter; car.outFrom.set(from.x, 0, from.y); car.outVel.set(from.vx, 0, from.vy);
        if (car.outVel.length() < 2) car.outVel.setLength(2);
        car.fig.play("hit");
      } else if (!fighter.out && car.wasOut) { car.wasOut = false; car.backAt = time; }
      if (fighter.out) {
        const t = (time - car.outAt) / 1000;
        car.group.position.set(car.outFrom.x + car.outVel.x * t, -4.9 * t * t, car.outFrom.z + car.outVel.z * t);
        car.group.visible = t < 1.4;
      } else {
        // Restart: drop in from above.
        const k = reduced ? 1 : Math.min(1, (time - car.backAt) / 350);
        height = (1 - k) * (1 - k) * 2.4;
        car.group.position.set(x, height, z);
        car.group.visible = fighter.alive;
      }
      const heading = before && !fighter.out && Math.hypot(fighter.x - before.x, fighter.y - before.y) < 1.5 ? lerpAngle(before.heading, fighter.heading, frameData.alpha) : fighter.heading;
      car.group.rotation.y = yawOf(heading);
      // Collision: the rubber cars squash for a moment (not with reduced motion).
      const squash = reduced ? 0 : Math.max(0, 1 - (time - car.bumpAt) / 220), wobble = Math.sin(squash * Math.PI) * squash;
      car.group.scale.set(1 + wobble * .14, 1 - wobble * .12, 1 + wobble * .14);
      const turbo = s.time < fighter.actionUntil, stunned = !fighter.out && s.time < fighter.stunUntil;
      // The spark on the pole flares with the turbo (steady with reduced motion).
      const flare = turbo ? (reduced ? 1.6 : 1.3 + Math.abs(Math.sin(time / 45)) * .9) : 1;
      car.spark.scale.setScalar(.07 * flare); (car.spark.material as T.MeshStandardMaterial).emissiveIntensity = turbo ? 2.2 : .6;
      car.flame.visible = turbo && !fighter.out; car.flame.scale.set(.16, reduced ? .45 : .35 + Math.abs(Math.sin(time / 60)) * .2, .16);
      // Leaning into the steering: the figure tilts a little in turns.
      car.fig.group.rotation.z = reduced || !before ? 0 : Math.max(-.25, Math.min(.25, Math.atan2(Math.sin(fighter.heading - before.heading), Math.cos(fighter.heading - before.heading)) * 2));
      car.fig.update(dt);
      car.shield.visible = !fighter.out && s.time < fighter.shieldUntil;
      car.lives.forEach((m, i) => { m.visible = fighter.alive && i < fighter.lives; });
      car.stars.forEach((star, i) => { star.visible = stunned && !reduced; const a = time / 160 + i * Math.PI * 2 / 3; star.position.set(Math.cos(a) * .32, CAR_TOP - .3, Math.sin(a) * .32); });
      if (car.marker) car.marker.position.y = CAR_TOP + .65 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1);
      car.ring.visible = !fighter.out && fighter.alive; car.ring.position.set(x, .04 + height, z);
      if (s.done && g.winner === p.id && !car.cheered) { car.cheered = true; car.fig.play("cheer"); }
    }

    // Fighting-game camera: frame every car still on the rink (plus margin), never wider than the rink.
    const inRing = s.players.map(p => g.fighters[p.id]).filter(f => f?.alive && !f.out);
    const pad = 2.6, limit = Math.max(radius, 3) + .8;
    const xs = inRing.length ? inRing.map(f => f.x) : [0], zs = inRing.length ? inRing.map(f => f.y) : [0];
    let x0 = Math.max(-limit, Math.min(...xs) - pad), x1 = Math.min(limit, Math.max(...xs) + pad), z0 = Math.max(-limit, Math.min(...zs) - pad), z1 = Math.min(limit, Math.max(...zs) + pad);
    const minHalf = 3.6;
    if (x1 - x0 < minHalf * 2) { const c = (x0 + x1) / 2; x0 = c - minHalf; x1 = c + minHalf; }
    if (z1 - z0 < minHalf * 2) { const c = (z0 + z1) / 2; z0 = c - minHalf; z1 = c + minHalf; }
    const shot = frameBox(kit, x0, x1, z0, z1, CAR_TOP, TILT);
    const glide = reduced || !camPos ? 1 : 1 - Math.exp(-dt * 3);
    camPos = (camPos ?? shot.position.clone()).lerp(shot.position, glide); camTarget = (camTarget ?? shot.target.clone()).lerp(shot.target, glide);
    kit.camera.position.copy(camPos); kit.camera.lookAt(camTarget);
    sparks.update(time);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries(s.players.filter(p => cars.has(p.id)).map(p => [p.id, riggedIdFor(frameData.characters[p.id], p.style)])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); for (const c of cars.values()) { c.fig.dispose(); (c.spark.material as T.Material).dispose(); } grid.dispose(); floorMat.dispose(); kit.dispose(); } };
}
