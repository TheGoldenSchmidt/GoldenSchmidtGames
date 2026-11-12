import * as T from "three";
import { BA, DIR4, type Bomber, type BombGame, type BombPower } from "../../shared/matches/bombArena";
import type { MatchWorld, MatchWorldFrame } from "../matches/client";
import { Debris, fittedFigure, fitTiltedCamera, Impact } from "./matchScene";
import { SceneKit, type Character } from "./sceneKit";

/**
 * Bomb Arena in 2.5D: a fixed, tilted camera over the 11 × 15 field, blocks
 * with height, the players' chosen figures, glowing flames and debris. Pure
 * presentation of the authoritative view; nothing here changes the rules.
 */
const COLS = BA.cols, ROWS = BA.rows, CELLS = COLS * ROWS;
const wx = (x: number) => x - (COLS - 1) / 2, wz = (y: number) => y - (ROWS - 1) / 2;
const WALL_H = .62, CRATE_H = .7, TILT = 64 * Math.PI / 180;
const COLOR = { night: 0x24133f, base: 0x2e2050, floorA: 0x9a9eb3, floorB: 0x8f93a8, wall: 0x5a5480, closing: 0xc23b2a, flame: 0xff7a28, core: 0xffe44e, bomb: 0x1d1a2b, item: 0x6544e8, own: 0xffe44e, life: 0xff86c8 } as const;
const ITEM_ICON: Record<BombPower, string> = { range: "✚", bomb: "●", speed: "»", kick: "⤳" };

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  draw(canvas.getContext("2d")!, 128);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; return texture;
}
const crateTexture = () => canvasTexture((c, n) => {
  c.fillStyle = "#b8743d"; c.fillRect(0, 0, n, n);
  c.strokeStyle = "#6e3f1c"; c.lineWidth = 10; c.strokeRect(5, 5, n - 10, n - 10);
  c.lineWidth = 9; c.beginPath(); c.moveTo(10, 10); c.lineTo(n - 10, n - 10); c.stroke();
  c.strokeStyle = "#d9965a"; c.lineWidth = 3; for (const y of [38, 64, 90]) { c.beginPath(); c.moveTo(14, y); c.lineTo(n - 14, y); c.stroke(); }
});
const wallTexture = () => canvasTexture((c, n) => {
  c.fillStyle = "#5a5480"; c.fillRect(0, 0, n, n);
  c.fillStyle = "#6a6590"; for (const [x, y, w, h] of [[4, 4, 58, 38], [66, 4, 58, 38], [4, 46, 36, 36], [44, 46, 80, 36], [4, 86, 70, 38], [78, 86, 46, 38]]) c.fillRect(x, y, w, h);
  c.fillStyle = "#ffe44e"; c.fillRect(0, 0, n, 5);
});

interface Figure { fig: Character; lives: T.Mesh[]; marker?: T.Mesh; deadAt?: number }

export function createBombWorld(host: HTMLElement, read: () => MatchWorldFrame, onError: () => void): MatchWorld {
  const kit = new SceneKit(host, onError), world = new T.Group();
  kit.scene.add(world);
  kit.scene.background = new T.Color(COLOR.night); kit.scene.fog = null;
  kit.camera.fov = 26; kit.camera.updateProjectionMatrix();
  const box = new T.BoxGeometry(1, 1, 1), dummy = new T.Object3D();

  // Ground: dark plinth, checkered tiles, a frame.
  kit.box(world, COLOR.base, 0, -.35, 0, COLS + 1.2, .5, ROWS + 1.2).castShadow = false;
  const tiles = new T.InstancedMesh(box, new T.MeshStandardMaterial({ roughness: .9 }), CELLS);
  for (let i = 0; i < CELLS; i++) {
    const x = i % COLS, y = Math.floor(i / COLS);
    dummy.position.set(wx(x), -.05, wz(y)); dummy.scale.set(1, .1, 1); dummy.updateMatrix(); tiles.setMatrixAt(i, dummy.matrix);
    tiles.setColorAt(i, new T.Color((x + y) % 2 ? COLOR.floorB : COLOR.floorA));
  }
  tiles.receiveShadow = true; world.add(tiles);

  // Blocks: fixed walls, crates and closing walls as instances (rebuilt when the cell string changes).
  const walls = new T.InstancedMesh(box, new T.MeshStandardMaterial({ map: wallTexture(), roughness: .85 }), CELLS);
  const crates = new T.InstancedMesh(box, new T.MeshStandardMaterial({ map: crateTexture(), roughness: .8 }), CELLS);
  const closing = new T.InstancedMesh(box, new T.MeshStandardMaterial({ color: COLOR.closing, emissive: 0x5a1208, roughness: .6 }), CELLS);
  for (const mesh of [walls, crates, closing]) { mesh.castShadow = true; mesh.receiveShadow = true; mesh.count = 0; world.add(mesh); }

  // Flames: additive glowing boxes, outer and core.
  const flames = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: COLOR.flame, transparent: true, opacity: .88, depthWrite: false }), CELLS);
  const cores = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: COLOR.core, transparent: true, opacity: .95, depthWrite: false }), CELLS);
  for (const mesh of [flames, cores]) { mesh.count = 0; mesh.frustumCulled = false; world.add(mesh); }
  const impact = new Impact(world, kit);

  // Debris of bursting crates.
  const debris = new Debris(world, 96, new T.MeshStandardMaterial({ map: crates.material.map, roughness: .8 }));

  const bombs = new Map<number, T.Group>(), items = new Map<string, T.Group>(), figures = new Map<string, Figure>();
  const appeared = new Map<number, number>();
  let cells = "", lastSeq = 0, frame = 0, aspect = 0;
  const seenGroups = new Set<number>();

  const fitCamera = () => { aspect = kit.camera.aspect; fitTiltedCamera(kit, COLS / 2 + .15, ROWS / 2 + .15, WALL_H, TILT); };

  const rebuildCells = (next: string, time: number, reduced: boolean) => {
    let w = 0, c = 0, k = 0;
    for (let i = 0; i < CELLS; i++) {
      const x = wx(i % COLS), z = wz(Math.floor(i / COLS)), now = next[i], before = cells[i];
      if (now === "1") { dummy.position.set(x, WALL_H / 2, z); dummy.scale.set(.98, WALL_H, .98); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); walls.setMatrixAt(w++, dummy.matrix); }
      else if (now === "2") { dummy.position.set(x, CRATE_H / 2, z); dummy.scale.set(.86, CRATE_H, .86); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); crates.setMatrixAt(c++, dummy.matrix); }
      else if (now === "3") { k++; if (before !== "3" && !appeared.has(i)) appeared.set(i, cells ? time : -1e9); }
      // A crate turned into floor: it bursts into a few splinters.
      if (before === "2" && now !== "2" && cells && !reduced) debris.burst(x, .4, z, time);
    }
    walls.count = w; crates.count = c; closing.count = k;
    walls.instanceMatrix.needsUpdate = true; crates.instanceMatrix.needsUpdate = true;
    if (next.indexOf("3") < 0) appeared.clear();
    cells = next;
  };

  const figureFor = (id: string, style: number, selected: string | undefined, viewer: string): Figure => {
    let f = figures.get(id);
    if (f) return f;
    const { fig, top } = fittedFigure(kit, world, style, selected, .5, 1.55);
    const lives = [0, 1, 2].map(i => kit.ball(fig.group, COLOR.life, (i - 1) * .17, top + .18, 0, .07));
    const marker = id === viewer ? kit.cone(fig.group, COLOR.own, 0, top + .5, 0, .22, .42) : undefined;
    if (marker) marker.rotation.x = Math.PI;
    f = { fig, lives, marker }; figures.set(id, f); return f;
  };

  const bomberPos = (b: Bomber) => [b.cx + (b.tx - b.cx) * b.progress, b.cy + (b.ty - b.cy) * b.progress] as const;

  const animate = (time: number) => {
    const f = read(), s = f.cur, g = s.game as BombGame, prev = f.prev.game as BombGame, reduced = f.reduced;
    if (kit.camera.aspect !== aspect) fitCamera();
    if (g.cells !== cells) rebuildCells(g.cells, time, reduced);

    // Closing walls drop in from above.
    let k = 0;
    for (let i = 0; i < CELLS; i++) {
      if (g.cells[i] !== "3") continue;
      const age = time - (appeared.get(i) ?? -1e9), drop = reduced ? 0 : Math.max(0, 1 - age / 320) ** 2 * 5;
      dummy.position.set(wx(i % COLS), WALL_H / 2 + drop, wz(Math.floor(i / COLS))); dummy.scale.set(.98, WALL_H, .98); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      closing.setMatrixAt(k++, dummy.matrix);
    }
    closing.instanceMatrix.needsUpdate = true;

    // Fresh events: animations, flash and shake.
    for (const e of s.events) {
      if (e.seq <= lastSeq) continue;
      const target = figures.get(e.ids[0]);
      if (e.kind === "bomb") target?.fig.act?.("attack", time);
      else if (e.kind === "hit") target?.fig.act?.("hit", time);
      else if (e.kind === "out" && target) { target.fig.act?.("death", time); target.deadAt = time; }
    }
    lastSeq = Math.max(lastSeq, s.eventSeq);

    // Flames, and a flash at every new explosion centre.
    let n = 0;
    for (const fl of g.flames) {
      const left = Math.max(0, Math.min(1, (fl.until - f.simTime) / BA.flameMs)), x = wx(fl.x), z = wz(fl.y), height = .25 + left * .45;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, height / 2, z); dummy.scale.set(.94, height, .94); dummy.updateMatrix(); flames.setMatrixAt(n, dummy.matrix);
      dummy.position.set(x, height * .55, z); dummy.scale.set(.55, height * 1.12, .55); dummy.updateMatrix(); cores.setMatrixAt(n, dummy.matrix);
      n++;
      if (fl.center && !seenGroups.has(fl.group)) {
        seenGroups.add(fl.group); impact.hit(x, z, time, reduced);
      }
    }
    flames.count = n; cores.count = n; flames.instanceMatrix.needsUpdate = true; cores.instanceMatrix.needsUpdate = true;
    if (seenGroups.size > 200) seenGroups.clear();

    debris.update(time);

    // Bombs: pulse faster and turn red shortly before they go off; kicked bombs glide.
    const liveBombs = new Set<number>();
    for (const b of g.bombs) {
      liveBombs.add(b.id);
      let group = bombs.get(b.id);
      if (!group) {
        group = new T.Group(); world.add(group);
        kit.ball(group, COLOR.bomb, 0, .34, 0, .34);
        kit.cylinder(group, 0x8a7a6a, .12, .72, 0, .045, .18).rotation.z = -.5;
        const spark = new T.Mesh(new T.SphereGeometry(.09, 8, 6), new T.MeshBasicMaterial({ color: COLOR.core })); spark.position.set(.17, .82, 0); spark.name = "spark"; group.add(spark);
        bombs.set(b.id, group);
      }
      const before = prev.bombs?.find(q => q.id === b.id), bx = before ? before.x + (b.x - before.x) * f.alpha : b.x, by = before ? before.y + (b.y - before.y) * f.alpha : b.y;
      group.position.set(wx(bx), 0, wz(by));
      const left = Math.max(0, b.at - f.simTime), urgent = left < 700;
      group.scale.setScalar(reduced ? 1 : 1 + Math.sin(time / (urgent ? 55 : 140)) * .07);
      (group.getObjectByName("spark") as T.Mesh).material = urgent ? redSpark : yellowSpark;
    }
    for (const [id, group] of bombs) if (!liveBombs.has(id)) { world.remove(group); bombs.delete(id); }

    // Items float above their cell.
    const liveItems = new Set<string>();
    for (const item of g.items) {
      const key = `${item.x},${item.y},${item.kind}`; liveItems.add(key);
      let group = items.get(key);
      if (!group) {
        group = new T.Group(); group.position.set(wx(item.x), 0, wz(item.y)); world.add(group);
        kit.cylinder(group, COLOR.item, 0, .05, 0, .34, .08);
        const badge = kit.badge(group, ITEM_ICON[item.kind], "#24133f", .62); badge.position.set(0, .5, 0); badge.name = "badge";
        items.set(key, group);
      }
      const badge = group.getObjectByName("badge")!;
      badge.position.y = .5 + (reduced ? 0 : Math.sin(time / 260 + item.x) * .07);
    }
    for (const [key, group] of items) if (!liveItems.has(key)) { world.remove(group); items.delete(key); }

    // Figures: interpolated cell movement, facing, walking, blinking while protected.
    for (const p of s.players) {
      const b = g.bombers[p.id];
      if (!b) continue;
      const fig = figureFor(p.id, p.style, f.characters[p.id], f.viewer), before = prev.bombers?.[p.id];
      const [nx, ny] = bomberPos(b), [px, py] = before?.alive ? bomberPos(before) : [nx, ny];
      const jump = Math.abs(nx - px) + Math.abs(ny - py) > 1.2, x = jump ? nx : px + (nx - px) * f.alpha, y = jump ? ny : py + (ny - py) * f.alpha;
      fig.fig.group.position.set(wx(x), 0, wz(y));
      const [dx, dy] = DIR4[b.dir], moving = b.tx !== b.cx || b.ty !== b.cy;
      fig.fig.pose(Math.atan2(dx, dy), moving ? 4 : 0, time, 0, false, reduced);
      // A knocked-out figure finishes its fall, then leaves the field.
      if (b.alive) fig.deadAt = undefined;
      const gone = !b.alive && (fig.deadAt === undefined || time - fig.deadAt > 1100);
      const blink = b.alive && s.time < b.invulnUntil && !reduced && Math.floor(time / 120) % 2 === 0;
      fig.fig.group.visible = !gone && !blink;
      fig.lives.forEach((m, i) => { m.visible = b.alive && i < b.lives; });
      if (fig.marker) fig.marker.position.y = fig.lives[0].position.y + .32 + (reduced ? 0 : Math.abs(Math.sin(time / 220)) * .1);
    }

    // Short shake on explosions (not with reduced motion).
    impact.update(time, reduced);
    kit.render();
    host.dataset.figures = JSON.stringify(Object.fromEntries([...figures].map(([id, fg]) => [id, fg.fig.group.userData.characterId])));
    frame = requestAnimationFrame(animate);
  };
  const yellowSpark = new T.MeshBasicMaterial({ color: COLOR.core }), redSpark = new T.MeshBasicMaterial({ color: 0xff4d3d });
  frame = requestAnimationFrame(animate);
  return { dispose: () => { cancelAnimationFrame(frame); yellowSpark.dispose(); redSpark.dispose(); box.dispose(); kit.dispose(); } };
}
