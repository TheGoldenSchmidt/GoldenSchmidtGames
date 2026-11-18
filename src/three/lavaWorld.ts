import * as T from "three";
import { FL, FLOOR_TILES, ring, type LavaGame, type Runner } from "../../shared/matches/floorIsLava";
import { followCamera, headingOf, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "../matches/client";
import { ChaseCamera, Debris, fittedFigure, fitTiltedCamera, Impact } from "./matchScene";
import { SceneKit, type Character } from "./sceneKit";

/**
 * Floor is Lava in 2.5D: three floors of temple slabs stacked over glowing,
 * slowly rolling lava. Slabs tremble and heat up while they crumble, tip over
 * and sink; slabs with a rune rise again. Figures run, jump with a real arc,
 * shove, drop through holes to the floor below and sink into the lava.
 * Default view: a chase camera behind the own figure (stick relative to the
 * camera); the overview can be chosen per device and is used by spectators.
 * The camera glides down with the viewer's own floor; floors above it are
 * hidden so they never cover the action (figures up there stay visible). Pure presentation of the
 * authoritative view.
 */
const COLS = FL.cols, ROWS = FL.rows, TILES = FLOOR_TILES, FLOORS = FL.floors;
const wx = (x: number) => x - COLS / 2, wz = (y: number) => y - ROWS / 2;
const SLAB = .42, TILT = 62 * Math.PI / 180, EMBERS = 36, GAP = 2.4;
/** Height of a floor's walking surface (top floor at 0). */
const floorY = (floor: number) => -floor * GAP;
const LAVA_Y = floorY(FLOORS - 1) - .7;
const COLOR = { night: 0x2a0f0a, stone: 0xfff3dc, hot: 0xff6a1f, rune: 0x57e4cb, lava: 0xff5a14, glow: 0xffb347, own: 0xffe44e, life: 0xfff9ed, shadow: 0x1a0a06 } as const;

function texture(draw: (c: CanvasRenderingContext2D, n: number) => void, repeat = 1) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  draw(canvas.getContext("2d")!, 256);
  const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace;
  if (repeat > 1) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
/** Lava: dark crust veins over bright molten blobs. */
const lavaTexture = () => texture((c, n) => {
  c.fillStyle = "#ff5a14"; c.fillRect(0, 0, n, n);
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % n, y = (i * 53) % n, r = 18 + (i * 37) % 40, g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 3 ? "#ffd166" : "#fff1a8"); g.addColorStop(1, "#ff5a1400");
    for (const [dx, dy] of [[0, 0], [n, 0], [0, n], [-n, 0], [0, -n]]) { c.fillStyle = g; c.save(); c.translate(dx, dy); c.fillRect(x - r, y - r, r * 2, r * 2); c.restore(); }
  }
  c.strokeStyle = "#8a1d1255"; c.lineWidth = 5;
  for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo((i * 61) % n, 0); c.bezierCurveTo((i * 89) % n, n * .3, (i * 23) % n, n * .7, (i * 61 + 40) % n, n); c.stroke(); }
}, 3);
/** Temple slab: sandstone with a carved inner border. */
const slabTexture = () => texture((c, n) => {
  c.fillStyle = "#e3d0a4"; c.fillRect(0, 0, n, n);
  c.strokeStyle = "#8f7a52"; c.lineWidth = 14; c.strokeRect(22, 22, n - 44, n - 44);
  c.strokeStyle = "#e6d5ae"; c.lineWidth = 4; c.strokeRect(34, 34, n - 68, n - 68);
  c.fillStyle = "#a8946a"; for (const [x, y] of [[60, 70], [170, 90], [110, 180], [190, 200]]) { c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill(); }
});

interface Slab { state: string; changedAt: number; from: number }
interface Figure { fig: Character; lives: T.Mesh[]; marker?: T.Mesh; ring?: T.Mesh; shadow: T.Mesh; outAt?: number; top: number }

export function createLavaWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.night); kit.scene.fog = null;
  kit.camera.fov = 26; kit.camera.updateProjectionMatrix();
  const box = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D(), color = new T.Color(), hot = new T.Color(COLOR.hot);

  // Lava sea: emissive, slowly flowing texture, warm light from below.
  const lavaMap = lavaTexture();
  const lava = new T.Mesh(new T.PlaneGeometry(COLS + 30, ROWS + 30), new T.MeshStandardMaterial({ map: lavaMap, emissive: COLOR.lava, emissiveMap: lavaMap, emissiveIntensity: .9, roughness: 1 }));
  lava.rotation.x = -Math.PI / 2; lava.position.y = LAVA_Y; lava.receiveShadow = true; world.add(lava);
  const heat = new T.PointLight(COLOR.glow, 3, 22, 1.4); heat.position.set(0, LAVA_Y + 1.1, 0); world.add(heat);

  // Slabs, runes on returning slabs, and a ghost outline where a slab will come back.
  // One mesh per floor, so floors above the viewer can turn into faint glass on their own.
  const slabMap = slabTexture();
  const floors = Array.from({ length: FLOORS }, () => {
    const mesh = new T.InstancedMesh(box, new T.MeshStandardMaterial({ map: slabMap, roughness: .85 }), TILES);
    mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
    return mesh;
  });
  const runes = new T.InstancedMesh(new T.TorusGeometry(.13, .025, 6, 24), new T.MeshBasicMaterial({ color: COLOR.rune }), TILES * FLOORS); runes.count = 0; world.add(runes);
  const ghosts = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: COLOR.rune, transparent: true, opacity: .28, depthWrite: false }), TILES * FLOORS); ghosts.count = 0; world.add(ghosts);
  const state: Slab[] = Array.from({ length: TILES * FLOORS }, () => ({ state: "1", changedAt: -1e9, from: 0 }));
  let camY: number | undefined, chasing = false, fresh = true, camRound = 0;
  // Behind and above the own figure, steep enough to read the slabs around it.
  const chaseCam = new ChaseCamera(kit, 3.8, 4.3, 2.2, 0), target = new T.Vector3();
  /** Floors above the viewer are hidden: seen from above they would cover the viewer's own floor. */
  const showFrom = (own: number) => floors.forEach((mesh, floor) => { mesh.visible = floor >= own; });

  // Embers rising from the lava (decoration only, off with reduced motion).
  const embers = new T.InstancedMesh(new T.SphereGeometry(1, 6, 4), new T.MeshBasicMaterial({ color: COLOR.glow }), EMBERS); embers.frustumCulled = false; world.add(embers);

  const impact = new Impact(world, kit);
  const splash = new Debris(world, 90, new T.MeshBasicMaterial({ color: 0xffffff }));
  const figures = new Map<string, Figure>();
  let lastSeq = 0, frame = 0, aspect = 0, last = performance.now();

  const figureFor = (id: string, style: number, selected: string | undefined, viewer: string): Figure => {
    let f = figures.get(id);
    if (f) return f;
    const { fig, top } = fittedFigure(kit, world, style, selected, .38, 1.15);
    // Heading first, then the forward tilt of a dive about the figure's own side axis.
    fig.group.rotation.order = "YXZ";
    const lives = Array.from({ length: FL.lives }, (_, i) => kit.ball(fig.group, COLOR.life, (i - (FL.lives - 1) / 2) * .17, top + .18, 0, .065));
    const marker = id === viewer ? kit.cone(fig.group, COLOR.own, 0, top + .5, 0, .2, .38) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    const ring = id === viewer ? kit.mesh(world, new T.TorusGeometry(.42, .045, 6, 32), COLOR.own, 0, .02, 0) : undefined;
    if (ring) { ring.rotation.x = Math.PI / 2; ring.castShadow = false; }
    const shadow = new T.Mesh(new T.CircleGeometry(.3, 20), new T.MeshBasicMaterial({ color: COLOR.shadow, transparent: true, opacity: .45, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; world.add(shadow);
    f = { fig, lives, marker, ring, shadow, top }; figures.set(id, f); return f;
  };

  const runnerPos = (r: Runner, before: Runner | undefined, alpha: number) => before?.alive ? [before.x + (r.x - before.x) * alpha, before.y + (r.y - before.y) * alpha] as const : [r.x, r.y] as const;
  /** Height of a runner's feet: its floor, or on the way down a fall that speeds up like a real one. */
  const feetY = (r: Runner, simTime: number, reduced: boolean) => {
    const left = Math.max(0, Math.min(1, (r.dropUntil - simTime) / FL.dropMs));
    if (left <= 0 || reduced) return floorY(r.floor);
    const k = 1 - left; return floorY(r.floor - 1) + (floorY(r.floor) - floorY(r.floor - 1)) * k * k;
  };

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as LavaGame, prev = f.prev.game as LavaGame, reduced = f.reduced, dt = Math.min(.05, (time - last) / 1000);
    last = time;
    if (!reduced) { lavaMap.offset.x += dt * .012; lavaMap.offset.y += dt * .007; }
    const local = f.local as ChaseLocal, mine = g.runners[f.viewer], own = mine?.floor ?? 0;
    // Chase camera for the own living figure unless this device chose the overview.
    const chase = !local.overview && !!mine?.alive;
    if (chase !== chasing) {
      chasing = chase; aspect = 0; fresh = true; chaseCam.reset(); camY = undefined;
      kit.camera.fov = chase ? 55 : 26; kit.camera.updateProjectionMatrix();
      if (!chase) delete local.camYaw;
    }
    showFrom(own);
    if (chase) world.position.y = 0;
    else {
      if (kit.camera.aspect !== aspect) { aspect = kit.camera.aspect; fitTiltedCamera(kit, COLS / 2 + .1, ROWS / 2 + .1, .2, TILT); }
      // Overview follows the viewer's floor (also during a fall); spectators watch the top floor.
      const wanted = mine ? -feetY(mine, f.simTime, reduced) : 0;
      camY = reduced || camY === undefined ? wanted : camY + (wanted - camY) * (1 - Math.exp(-dt * 7));
      world.position.y = camY;
    }
    heat.intensity = reduced ? 3 : 3 + Math.sin(time / 600) * .6;

    // Slabs: tremble and heat while crumbling, tip and sink when gone, rise when they return.
    // The ring that collapses next glows a warning 1.5 s ahead.
    const roundTime = f.simTime - g.roundStart, nextRing = FL.ringAt.findIndex(t => roundTime < t);
    const warnRing = g.phase === "play" && nextRing >= 0 && FL.ringAt[nextRing] - roundTime < 1500 ? nextRing : -1;
    let r = 0, gh = 0;
    for (let i = 0; i < TILES * FLOORS; i++) {
      const floor = Math.floor(i / TILES), j = i % TILES, mesh = floors[floor], base = floorY(floor);
      const tile = g.tiles[i] ?? "0", slab = state[i], x = wx(j % COLS + .5), z = wz(Math.floor(j / COLS) + .5);
      if (tile !== slab.state) { slab.from = slab.state === "2" || slab.state === "1" ? 1 : 0; slab.state = tile; slab.changedAt = time; }
      const age = time - slab.changedAt;
      let y = -SLAB / 2, tilt = 0, shake = 0, heatK = 0, scale = 1;
      const ringOf = ring(i);
      if (tile === "2") {
        const left = Math.max(0, Math.min(1, ((g.timers[i] ?? s.time) - f.simTime) / FL.crackMs));
        heatK = 1 - left; shake = reduced ? 0 : Math.sin(time / 28 + i) * heatK * .05;
      }
      if ((tile === "1" || tile === "2") && ringOf === warnRing) heatK = Math.max(heatK, reduced ? .6 : .35 + Math.abs(Math.sin(time / 160)) * .5); else if (tile === "0" || tile === "3") {
        // Falling: tip over and sink (instant with reduced motion).
        const k = reduced || !slab.from ? 1 : Math.min(1, age / 650);
        y = -SLAB / 2 - k * k * 1.4; tilt = k * .9 * ((i % 2) ? 1 : -1); heatK = 1; scale = k >= 1 ? 0 : 1;
      } else if (age < 320 && !reduced && slab.from === 0) {
        // Returning slab rises from below.
        const k = age / 320; y = -SLAB / 2 - (1 - k) * (1 - k) * 1.2;
      }
      dummy.position.set(x + shake, base + y, z); dummy.rotation.set(tilt, 0, tilt * .4); dummy.scale.set(.94 * scale, SLAB * scale, .94 * scale); dummy.updateMatrix();
      mesh.setMatrixAt(j, dummy.matrix);
      // Deeper floors sit in the shade of the ones above.
      color.set(COLOR.stone).lerp(hot, heatK * .75).multiplyScalar(floor > own ? 1 - Math.min(.45, (floor - own) * .22) : 1); mesh.setColorAt(j, color);
      if (floor < own) continue;
      if (g.regen[i] === "1" && (tile === "1" || tile === "2")) { dummy.position.set(x + shake, base + y + SLAB / 2 + .01, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); runes.setMatrixAt(r++, dummy.matrix); }
      if (tile === "3") { dummy.position.set(x, base - .5, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(.9, .06, .9); dummy.updateMatrix(); ghosts.setMatrixAt(gh++, dummy.matrix); }
    }
    for (const mesh of floors) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    runes.count = r; runes.instanceMatrix.needsUpdate = true; ghosts.count = gh; ghosts.instanceMatrix.needsUpdate = true;

    // Embers drift up from the lava in a fixed loop.
    embers.visible = !reduced;
    if (!reduced) for (let i = 0; i < EMBERS; i++) {
      const k = ((time / 2600 + i * .37) % 1);
      dummy.position.set(((i * 7.3) % (COLS + 6)) - (COLS + 6) / 2, LAVA_Y + .1 + k * 2.2, ((i * 5.9) % (ROWS + 6)) - (ROWS + 6) / 2);
      dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.05 * (1 - k)); dummy.updateMatrix(); embers.setMatrixAt(i, dummy.matrix);
    }
    embers.instanceMatrix.needsUpdate = true;

    // Events: shoves, lava hits, falls, collapsing edge.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const target = figures.get(e.ids[0]), runner = g.runners[e.ids[0]] ?? prev.runners?.[e.ids[0]];
      if (e.kind === "dash") target?.fig.act?.("attack", time);
      else if (e.kind === "shove") target?.fig.act?.("hit", time);
      else if ((e.kind === "hit" || e.kind === "out") && target) {
        const at = prev.runners?.[e.ids[0]] ?? runner;
        if (at) { if (!reduced) splash.burst(wx(at.x), LAVA_Y + .2, wz(at.y), time, { count: 10, speed: 1.8, up: 4, size: .12, life: 650, color: COLOR.glow }); impact.hit(wx(at.x), wz(at.y), time, reduced, .8); }
        // A lost life respawns the figure standing upright (no knock-down pose); only the last one is a fall.
        if (e.kind === "out") { target.fig.act?.("death", time); target.outAt = time; }
      } else if (e.kind === "drop" && runner && !reduced) {
        // Crumbs follow the runner through the hole.
        splash.burst(wx(runner.x), floorY(runner.floor - 1) - .1, wz(runner.y), time, { count: 6, speed: .8, up: .5, size: .09, life: 500, color: 0xc9b48a });
      } else if (e.kind === "shrink") impact.hit(0, 0, time, reduced, .6);
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    // Figures: running, jump arc with shadow, sliding after a shove, sinking when out.
    for (const p of s.players) {
      const runner = g.runners[p.id];
      if (!runner) continue;
      const fg = figureFor(p.id, p.style, f.characters[p.id], f.viewer), before = prev.runners?.[p.id];
      const [x, y] = runnerPos(runner, before, f.alpha);
      const falling = runner.dropUntil > f.simTime, ground = feetY(runner, f.simTime, reduced);
      const air = falling ? 0 : Math.max(0, Math.min(1, (runner.airUntil - f.simTime) / FL.jumpMs)), lift = air > 0 ? Math.sin((1 - air) * Math.PI) * .9 : 0;
      let height = ground + lift;
      if (!runner.alive) {
        // Out: the figure sinks into the lava, then leaves.
        const sink = fg.outAt === undefined ? 1 : Math.min(1, (time - fg.outAt) / 900);
        height = floorY(FLOORS - 1) - sink * 1.6; fg.fig.group.visible = sink < 1 && fg.outAt !== undefined;
      } else { fg.outAt = undefined; fg.fig.group.visible = !(f.simTime < runner.invulnUntil && !reduced && Math.floor(time / 110) % 2 === 0); }
      // Opponents on a floor above the own one stay out of sight (they would hang in the air over the viewer's floor).
      const above = !!mine?.alive && runner.alive && p.id !== f.viewer && runner.floor < own;
      if (above) fg.fig.group.visible = false;
      // Dive: flat through the air, then lying on the belly for a moment (a pose, also with reduced motion).
      const diving = f.simTime < (runner.diveUntil ?? 0), prone = !diving && f.simTime < (runner.proneUntil ?? 0);
      const diveK = diving ? 1 - ((runner.diveUntil ?? 0) - f.simTime) / FL.diveMs : 0;
      if (diving) height = ground + (reduced ? .25 : Math.sin(diveK * Math.PI) * .45);
      fg.fig.group.position.set(wx(x), height + (prone ? .12 : 0), wz(y));
      const speed = Math.hypot(runner.vx, runner.vy), sliding = s.time < runner.slideUntil;
      fg.fig.pose(Math.atan2(runner.fx, runner.fy), sliding || diving || prone ? 0 : speed, time, falling ? .6 : diving ? 0 : lift, false, reduced);
      fg.fig.group.rotation.z = sliding && !reduced ? Math.sin(time / 40) * .15 : 0;
      fg.fig.group.rotation.x = diving || prone ? Math.PI / 2 * (diving && !reduced ? Math.min(1, diveK * 3) : 1) : 0;
      fg.shadow.visible = runner.alive && !above; fg.shadow.position.set(wx(x), floorY(runner.floor) + .01, wz(y)); fg.shadow.scale.setScalar(1 - lift * .4);
      fg.lives.forEach((m, i) => { m.visible = runner.alive && !above && i < runner.lives; });
      if (fg.marker) { fg.marker.visible = !chase; fg.marker.position.y = fg.top + .5 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1); }
      if (fg.ring) { fg.ring.visible = runner.alive; fg.ring.position.set(wx(x), ground + .02, wz(y)); }
    }

    if (chase && mine) {
      const [x, y] = runnerPos(mine, prev.runners?.[f.viewer], f.alpha);
      target.set(wx(x), feetY(mine, f.simTime, reduced), wz(y));
      // A new round places the camera behind the figure; afterwards only a swipe turns it (running never swings the view).
      if (g.round !== camRound) { camRound = g.round; fresh = true; }
      takeCameraTurn(local, d => chaseCam.turn(d));
      chaseCam.tune(f.local as ChaseLocal);
      chaseCam.update(target, fresh ? headingOf(mine.fx, mine.fy) : undefined, dt, reduced, 1.3);
      fresh = false; followCamera(local, f.input, chaseCam.yaw);
    }
    host.dataset.camera = chase ? "chase" : "overview";
    if (chase) host.dataset.yaw = chaseCam.yaw.toFixed(3); else delete host.dataset.yaw;
    splash.update(time);
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...figures].map(([id, fg]) => [id, fg.fig.group.userData.characterId])));
    frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); box.dispose(); kit.dispose(); } };
}
