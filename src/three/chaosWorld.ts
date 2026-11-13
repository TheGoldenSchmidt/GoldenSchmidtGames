import * as T from "three";
import { CR, courseLayout, hammerLow, platformY, wallClosed, type RunGame } from "../../shared/matches/chaosRun";
import type { MatchWorld, MatchWorldFrame } from "../matches/client";
import { Debris, Impact } from "./matchScene";
import { LOOKS, riggedFigure, type CharacterKit, type RiggedFigure } from "./riggedFigure";
import { PLAYER_COLORS, SceneKit } from "./sceneKit";

/**
 * Chaos Run in 2.5D: a gameshow obstacle course seen from behind and above the
 * own runner (chase camera). Every runner has an own lane – the rules simulate
 * runners independently, and bridges collapse per runner – while obstacles span
 * all lanes. Course x maps to world x, lanes to z, height to y.
 */
const LANE = 1.35, FIGURE_H = 1.55, TILE = .98;
const COLOR = { sky: 0x3b1d64, haze: 0x8a4fb8, floor: 0x57e4cb, floorSide: 0x2f8f80, bridge: 0xe0a35a, bridgeWarn: 0xc98b4a, platform: 0xffe44e, log: 0xb23a48, wall: 0x6544e8, beam: 0xffe44e, stripe: 0x24133f, flag: 0x57e4cb, pole: 0xfff9ed, own: 0xffe44e, rope: 0xfff9ed } as const;
const WALL_H = 1.7, BEAM_BOTTOM = .85, BEAM_TOP = 1.6, LOG_PIVOT = 3.6;

interface View { fig: RiggedFigure; ring: T.Mesh; marker?: T.Mesh; lane: number; air: boolean; sliding: boolean; fallen: boolean; fallAt: number; fallFrom: T.Vector3; done: boolean; bridges: Map<string, T.Mesh> }

export function createChaosWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, chars: CharacterKit): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.sky); kit.scene.fog = new T.Fog(COLOR.sky, 16, 42);
  kit.camera.fov = 52; kit.camera.near = .1; kit.camera.far = 80; kit.camera.updateProjectionMatrix();
  const first = read(), g0 = first.cur.game as RunGame, layout = courseLayout(g0.course), lanes = Math.max(1, g0.order.length);
  const laneZ = (i: number) => (i - (lanes - 1) / 2) * LANE, width = lanes * LANE + .8, end = g0.length + 6;

  // Floor: solid stretches between the gaps, spanning every lane.
  const solid: [number, number][] = [[-6, end]];
  for (const [a, b] of layout.gaps) for (let i = solid.length - 1; i >= 0; i--) {
    const [s0, s1] = solid[i]; if (b <= s0 || a >= s1) continue;
    solid.splice(i, 1, ...([[s0, a], [b, s1]] as [number, number][]).filter(([x0, x1]) => x1 > x0));
  }
  for (const [a, b] of solid) {
    kit.box(world, COLOR.floor, (a + b) / 2, -.15, 0, b - a, .3, width).castShadow = false;
    kit.box(world, COLOR.floorSide, (a + b) / 2, -1.6, 0, b - a, 2.6, width - .1).castShadow = false;
  }
  // Lane lines and gameshow spotlights along the course.
  for (let i = 1; i < lanes; i++) kit.box(world, 0xfff9ed, end / 2 - 3, .01, (laneZ(i - 1) + laneZ(i)) / 2, end + 6, .01, .04).castShadow = false;
  for (let x = 0; x < end; x += 12) for (const side of [-1, 1]) {
    kit.cylinder(world, COLOR.pole, x, 1.5, side * (width / 2 + 1.2), .08, 3);
    kit.ball(world, side > 0 ? 0xff86c8 : 0x57e4cb, x, 3.1, side * (width / 2 + 1.2), .22);
  }
  // Checkpoint flags at every module start, a chequered finish arch.
  for (const m of g0.course) { kit.cylinder(world, COLOR.pole, m.x0, 1, -width / 2 - .25, .05, 2); kit.box(world, COLOR.flag, m.x0 + .3, 1.8, -width / 2 - .25, .6, .35, .03); }
  for (const side of [-1, 1]) kit.box(world, COLOR.pole, g0.length, 1.4, side * (width / 2 + .2), .25, 2.8, .25);
  for (let k = 0; k < 10; k++) kit.box(world, k % 2 ? 0xfff9ed : COLOR.stripe, g0.length, 2.95, -width / 2 + (k + .5) * width / 10, .25, .3, width / 10);

  // Moving obstacles.
  const platforms = layout.platforms.map(pl => ({ pl, mesh: kit.box(world, COLOR.platform, (pl.x0 + pl.x1) / 2, 0, 0, pl.x1 - pl.x0, .25, width - .2) }));
  const walls = layout.walls.map(w => ({ w, mesh: kit.box(world, COLOR.wall, w.x, 0, 0, .5, 1, width - .2) }));
  for (const [b0, b1] of layout.beams) {
    kit.box(world, COLOR.beam, (b0 + b1) / 2, (BEAM_BOTTOM + BEAM_TOP) / 2, 0, b1 - b0, BEAM_TOP - BEAM_BOTTOM, width);
    for (let x = b0 + .25; x < b1; x += .5) kit.box(world, COLOR.stripe, x, (BEAM_BOTTOM + BEAM_TOP) / 2, width / 2 + .01, .22, BEAM_TOP - BEAM_BOTTOM, .02);
  }
  // The "hammer": a log on two ropes that swings low through every lane.
  const logs = layout.hammers.map(h => {
    const pivot = new T.Group(); pivot.position.set(h.x, LOG_PIVOT, 0); world.add(pivot);
    for (const side of [-1, 1]) kit.box(pivot, COLOR.rope, 0, -(LOG_PIVOT - .55) / 2, side * (width / 2 - .3), .05, LOG_PIVOT - .55, .05);
    const log = kit.cylinder(pivot, COLOR.log, 0, -(LOG_PIVOT - .55), 0, .32, width - .2); log.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) kit.box(world, COLOR.pole, h.x, LOG_PIVOT / 2, side * (width / 2 + .15), .2, LOG_PIVOT, .2);
    kit.box(world, COLOR.pole, h.x, LOG_PIVOT + .1, 0, .2, .2, width + .5);
    return { h, pivot };
  });

  const impact = new Impact(world, kit), dust = new Debris(world, 60, new T.MeshStandardMaterial({ color: 0xfff9ed, roughness: 1 }));
  const views = new Map<string, View>();
  let lastSeq = 0, frame = 0, last = performance.now(), camX: number | undefined;

  const viewFor = (id: string, style: number, viewer: string): View => {
    let v = views.get(id);
    if (v) return v;
    const lane = Math.max(0, g0.order.indexOf(id)), fig = riggedFigure(chars, style, PLAYER_COLORS[style % PLAYER_COLORS.length], FIGURE_H);
    world.add(fig.group);
    const own = id === viewer, ring = kit.mesh(world, new T.TorusGeometry(.42, own ? .06 : .04, 6, 28), own ? COLOR.own : PLAYER_COLORS[style % PLAYER_COLORS.length], 0, .02, laneZ(lane));
    ring.rotation.x = Math.PI / 2; ring.castShadow = false;
    const marker = own ? kit.cone(fig.group, COLOR.own, 0, FIGURE_H + .45, 0, .16, .3) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    // Bridges belong to each runner's own lane (they collapse per runner).
    const bridges = new Map<string, T.Mesh>();
    for (const [b0, b1] of layout.bridges) for (let x = b0; x < b1; x++) {
      const tile = kit.box(world, COLOR.bridge, x + .5, -.1, laneZ(lane), TILE, .2, LANE - .1);
      tile.material = new T.MeshStandardMaterial({ color: COLOR.bridge, roughness: .8 }); // own material: tiles warn individually
      bridges.set(`${b0}:${Math.floor(x - b0)}`, tile);
    }
    v = { fig, ring, marker, lane, air: false, sliding: false, fallen: false, fallAt: 0, fallFrom: new T.Vector3(), done: false, bridges };
    views.set(id, v); return v;
  };

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as RunGame, prev = f.prev.game as RunGame, reduced = f.reduced, t = f.simTime;
    const dt = Math.min(.05, (time - last) / 1000); last = time;

    // Obstacles follow the shared timing functions of the rules.
    for (const { pl, mesh } of platforms) mesh.position.y = platformY(pl.phase, t) - .125;
    for (const { w, mesh } of walls) { const h = wallClosed(w.phase, t) ? WALL_H : .25; mesh.scale.y = h; mesh.position.y = h / 2; }
    for (const { h, pivot } of logs) {
      // Swing: lowest (through the lanes) in the middle of the low window, high otherwise.
      const phase = ((t / CR.hammerPeriod + h.phase) % 1 + 1) % 1, low = hammerLow(h.phase, t);
      pivot.rotation.z = low ? Math.sin((phase / .4 - .5) * Math.PI) * .35 : Math.sin(((phase - .4) / .6) * Math.PI) * 1.25 * (phase < .7 ? 1 : -1);
    }

    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const v = views.get(e.ids[0]), runner = g.runners[e.ids[0]];
      if (!v) continue;
      if (e.kind === "jump") v.fig.play("jumpStart");
      else if (e.kind === "slide") v.fig.play("slideStart");
      else if (e.kind === "hit" && runner) { v.fig.play("hit"); if (!reduced) dust.burst(runner.x, .4, laneZ(v.lane), time, { count: 6, speed: 1.5, up: 2.2, size: .08, life: 500 }); if (e.ids[0] === f.viewer) impact.hit(runner.x, laneZ(v.lane), time, reduced, .4); }
      else if (e.kind === "finish") v.fig.setLoop("dance");
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    let ownX = 0;
    for (const p of s.players) {
      const r = g.runners[p.id];
      if (!r) continue;
      const v = viewFor(p.id, p.style, f.viewer), before = prev.runners?.[p.id], own = p.id === f.viewer;
      // Own runner is extrapolated a little for smooth scrolling; the others are interpolated.
      const ahead = own && !r.fallen && r.finishAt === undefined && !reduced ? r.vx * Math.min(.12, (t - s.time) / 1000) : 0;
      const x = own ? r.x + ahead : before && !before.fallen ? before.x + (r.x - before.x) * f.alpha : r.x;
      const y = before && !own && !before.fallen ? before.y + (r.y - before.y) * f.alpha : r.y;
      if (own) ownX = x;
      // Bridge tiles of this lane.
      for (const [b0] of layout.bridges) for (const [key, tile] of v.bridges) {
        if (!key.startsWith(`${b0}:`)) continue;
        const collapse = r.bridge[key.slice(key.indexOf(":") + 1)];
        const gone = collapse !== undefined && t >= collapse, k = gone ? Math.min(1, (t - collapse!) / 500) : 0;
        tile.visible = k < 1; tile.position.y = -.1 - k * k * 3; (tile.material as T.MeshStandardMaterial).color.set(collapse !== undefined ? COLOR.bridgeWarn : COLOR.bridge);
      }
      // States and animations.
      if (r.fallen && !v.fallen) { v.fallen = true; v.fallAt = time; v.fallFrom.set(x, y, laneZ(v.lane)); v.fig.setLoop("air"); }
      if (!r.fallen && v.fallen) { v.fallen = false; v.fig.setLoop("sprint"); v.fig.play("land"); }
      if (r.fallen) {
        const k = (time - v.fallAt) / 1000;
        v.fig.group.position.set(v.fallFrom.x + 2 * k, v.fallFrom.y - 6 * k * k, v.fallFrom.z); v.fig.group.visible = k < .9; v.ring.visible = false;
      } else {
        v.fig.group.visible = true; v.ring.visible = r.finishAt === undefined;
        v.fig.group.position.set(x, y, laneZ(v.lane)); v.ring.position.set(x, .02, laneZ(v.lane));
        const sliding = s.time < r.slideUntil;
        if (r.finishAt !== undefined) { if (!v.done) { v.done = true; v.fig.setLoop("dance"); } }
        else if (sliding) { if (!v.sliding) v.fig.setLoop("slide"); }
        else if (!r.grounded) { if (!v.air) v.fig.setLoop("air"); }
        else { if (v.air) v.fig.play("land"); v.fig.setLoop("sprint", r.vx / CR.speed * 1.1); }
        v.air = !r.grounded && !sliding; v.sliding = sliding;
      }
      v.fig.group.rotation.y = r.finishAt !== undefined ? 0 : Math.PI / 2; // run towards +x; face the camera when done
      v.fig.update(dt);
      if (v.marker) v.marker.position.y = FIGURE_H + .45 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .08);
    }

    // Chase camera behind and above the own runner, looking down the course.
    const me = g.runners[f.viewer] ?? Object.values(g.runners)[0], meLane = views.get(me.id)?.lane ?? 0;
    const targetX = me === g.runners[f.viewer] ? ownX : me.x;
    camX = reduced || camX === undefined ? targetX : camX + (targetX - camX) * (1 - Math.exp(-dt * 8));
    // More lanes: a little further back and higher, so the neighbouring lanes stay in view.
    // The own lane sits near the middle of the picture; neighbours to the sides.
    const z = laneZ(meLane) * .85, wide = Math.max(0, lanes - 2) * .3;
    kit.camera.position.set(camX - 5.2 - wide, 3.6 + wide, z + 1.6); kit.camera.lookAt(camX + 4.5, .6, z);
    dust.update(time);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries(s.players.filter(p => views.has(p.id)).map(p => { const look = LOOKS[p.style % LOOKS.length]; return [p.id, `${look.body}-${look.skin}-${look.hair}`]; })));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); for (const v of views.values()) v.fig.dispose(); kit.dispose(); } };
}

