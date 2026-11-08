import * as T from "three";
import type { GameId } from "../../shared/types";
import { character, PLAYER_COLORS, SceneKit } from "./sceneKit";

export interface IntroPlayer { id: string; name: string; characterId?: string }
export type IntroStage = "seated" | "approach" | "overhead";

const FELT = 0x205b50;
const WOOD = 0x925c3d;
const BRASS = 0xd8b575;
const PAPER = 0xfff9e8;
const PIPS: Record<number, number[][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
};

function card(kit: SceneKit, parent: T.Object3D, x: number, y: number, z: number, angle = 0) {
  const group = new T.Group(); group.position.set(x, y, z); group.rotation.y = angle; parent.add(group);
  kit.box(group, PAPER, 0, 0, 0, .52, .025, .76);
  kit.box(group, 0x274f69, 0, .017, 0, .45, .014, .68);
  const emblem = kit.box(group, BRASS, 0, .028, 0, .16, .006, .16); emblem.rotation.y = Math.PI / 4;
  for (const side of [-1, 1]) kit.box(group, BRASS, side * .19, .028, 0, .009, .006, .59);
  return group;
}

function die(kit: SceneKit, parent: T.Object3D, color: number, x: number, z: number, angle: number) {
  const group = new T.Group(); group.position.set(x, 2.19, z); group.rotation.set(.05, angle, .04); parent.add(group);
  kit.box(group, color, 0, 0, 0, .49, .49, .49);
  const ink = color === PAPER || color === 0xf2ca53 ? 0x193e43 : PAPER;
  for (let face = 0; face < 6; face++) {
    for (const [u, v] of PIPS[face + 1]) {
      const a = u * .13, b = v * .13;
      const point = face === 0 ? [a, .251, b] : face === 1 ? [a, -.251, b]
        : face === 2 ? [a, b, .251] : face === 3 ? [a, b, -.251]
        : face === 4 ? [.251, a, b] : [-.251, a, b];
      const pip = kit.ball(group, ink, point[0], point[1], point[2], .034);
      pip.castShadow = false;
    }
  }
}

function scoresheet(kit: SceneKit, parent: T.Object3D, x: number, z: number, angle: number, kribbeln: boolean) {
  const sheet = new T.Group(); sheet.position.set(x, 1.97, z); sheet.rotation.y = angle; parent.add(sheet);
  kit.box(sheet, PAPER, 0, 0, 0, 1.05, .018, 1.35);
  const colors = kribbeln ? [0xe66c63, 0xf2ca53, 0x5da77a, 0x4c8ac5, 0x9b6abb, 0xe79649]
    : [0xe66c63, 0xf2ca53, 0x5da77a, 0x4c8ac5];
  colors.forEach((color, row) => {
    for (let col = 0; col < 6; col++) kit.box(sheet, color, -.39 + col * .155, .013, -.4 + row * .18, .12, .009, .13).castShadow = false;
  });
  kit.box(sheet, 0x224a53, -.19, .013, -.56, .52, .009, .025);
  const pencil = kit.box(sheet, BRASS, .66, .025, 0, .045, .045, .9); pencil.rotation.y = -.18;
}

function seatedPlayer(kit: SceneKit, parent: T.Object3D, index: number, angle: number, name: string) {
  const group = new T.Group(); group.position.set(Math.sin(angle) * 4.05, 0, Math.cos(angle) * 4.05);
  group.rotation.y = angle + Math.PI; parent.add(group);
  const color = PLAYER_COLORS[index % PLAYER_COLORS.length];
  // A seat, bent legs, and arms resting on the table make the posture readable.
  kit.box(group, WOOD, 0, 1.13, -.08, 1, .18, .92);
  kit.box(group, WOOD, 0, 1.83, -.47, 1, 1.22, .14);
  kit.box(group, 0x29464b, 0, 1.26, -.06, .87, .14, .77);
  for (const side of [-1, 1]) {
    for (const z of [-.4, .28]) kit.cylinder(group, WOOD, side * .4, .55, z, .045, 1.1);
    kit.beam(group, 0x243b4b, new T.Vector3(side * .19, 1.26, 0), new T.Vector3(side * .19, 1.14, .49), .23);
    kit.beam(group, 0x243b4b, new T.Vector3(side * .19, 1.14, .49), new T.Vector3(side * .19, .35, .5), .2);
    kit.box(group, 0x302d30, side * .19, .27, .57, .26, .18, .4);
    kit.beam(group, color, new T.Vector3(side * .3, 1.98, .04), new T.Vector3(side * .46, 1.94, .61), .18);
    kit.ball(group, 0xffd7b5, side * .46, 1.96, .77, .12, .085, .15);
  }
  kit.ball(group, color, 0, 1.75, 0, .38, .5, .27);
  const skin = [0xffd7b5, 0xb97954, 0xe6b084][index % 3];
  kit.cylinder(group, skin, 0, 2.2, .01, .13, .2);
  kit.ball(group, skin, 0, 2.51, .015, .33, .36, .31);
  kit.ball(group, index % 2 ? 0x402e28 : 0x5b3c2c, 0, 2.72, -.045, .34, .19, .3);
  for (const side of [-1, 1]) kit.ball(group, 0x193e43, side * .115, 2.54, .307, .034, .044, .018);
  kit.ball(group, 0xc77761, 0, 2.4, .313, .06, .017, .015);
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff9e8"; ctx.beginPath(); ctx.roundRect(4, 8, 504, 104, 32); ctx.fill();
  ctx.fillStyle = "#193e43"; ctx.font = "bold 88px 'Trebuchet MS',sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(name.length > 16 ? `${name.slice(0, 15)}…` : name, 256, 65, 462);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  const label = new T.Sprite(new T.SpriteMaterial({ map: texture }));
  label.scale.set(2.1, .525, 1); label.position.set(0, 3.22, -.05); group.add(label);
}

function tableScene(kit: SceneKit, world: T.Group, gameId: GameId, players: IntroPlayer[]) {
  kit.scene.background = new T.Color(0x102f32); kit.scene.fog = new T.Fog(0x102f32, 48, 100);
  kit.box(world, 0x624637, 0, -.16, 0, 160, .2, 160).castShadow = false;
  for (let i = -16; i <= 16; i++) kit.box(world, i % 2 ? 0x624637 : 0x704d39, i * 1.3, -.05, 0, 1.28, .02, 160).castShadow = false;
  kit.cylinder(world, 0x183e45, 0, .01, 0, 5.65, .035).castShadow = false;
  const rugEdge = kit.mesh(world, new T.TorusGeometry(5.36, .035, 6, 80), BRASS, 0, .035, 0); rugEdge.rotation.x = Math.PI / 2;
  for (const x of [-1.9, 1.9]) for (const z of [-1.9, 1.9]) kit.cylinder(world, WOOD, x, .86, z, .13, 1.7);
  kit.cylinder(world, WOOD, 0, 1.78, 0, 3.42, .28);
  kit.cylinder(world, BRASS, 0, 1.925, 0, 3.28, .025);
  const felt = kit.cylinder(world, gameId === "kribbeln" ? 0x285568 : FELT, 0, 1.946, 0, 3.22, .025);
  // Subtle, deterministic felt grain, generated locally once per introduction.
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2200; i++) { ctx.fillStyle = i % 2 ? "#c4c4c4" : "#ededed"; ctx.fillRect((i * 73) % 128, (i * 37 + Math.floor(i / 128) * 11) % 128, 1, 1); }
  const texture = new T.CanvasTexture(canvas); texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(6, 6); texture.colorSpace = T.SRGBColorSpace;
  const material = new T.MeshStandardMaterial({ color: gameId === "kribbeln" ? 0x285568 : FELT, map: texture, roughness: 1 }); felt.material = material;
  const stitch = kit.mesh(world, new T.TorusGeometry(3.04, .012, 5, 80), 0x78a38c, 0, 1.968, 0); stitch.rotation.x = Math.PI / 2;

  players.forEach((player, index) => {
    const angle = index / players.length * Math.PI * 2;
    seatedPlayer(kit, world, index, angle, player.name);
    if (gameId === "durak") {
      for (let n = 0; n < 3; n++) {
        const handAngle = angle + (n - 1) * .13;
        card(kit, world, Math.sin(handAngle) * 2.66, 1.99 + n * .012, Math.cos(handAngle) * 2.66, handAngle);
      }
    } else scoresheet(kit, world, Math.sin(angle) * 2.4, Math.cos(angle) * 2.4, -angle, gameId === "kribbeln");
  });
  if (gameId === "durak") {
    for (let n = 0; n < 8; n++) card(kit, world, -.5 + n * .007, 2 + n * .027, -.15, -.15);
  } else {
    if (gameId === "kribbeln") {
      kit.box(world, WOOD, 0, 1.985, 0, 2.52, .06, 1.73);
      kit.box(world, 0x183e45, 0, 2.025, 0, 2.4, .035, 1.6);
      for (const side of [-1, 1]) {
        kit.box(world, BRASS, side * 1.25, 2.08, 0, .08, .18, 1.75);
        kit.box(world, BRASS, 0, 2.08, side * .85, 2.5, .18, .08);
      }
    }
    const colors = gameId === "qwixx" ? [PAPER, PAPER, 0xe66c63, 0xf2ca53, 0x5da77a, 0x4c8ac5]
      : [0xe66c63, 0xf2ca53, 0x5da77a, 0x4c8ac5, 0xe79649, 0x9b6abb];
    colors.forEach((color, i) => die(kit, world, color, (i % 3 - 1) * .76, (Math.floor(i / 3) - .5) * .73, i * .53));
  }
}

function islandScene(kit: SceneKit, world: T.Group, players: IntroPlayer[]) {
  kit.scene.fog = new T.Fog(0x94def1, 35, 100); kit.water(world);
  kit.cylinder(world, 0xc7a571, 0, .16, 0, 4.8, .55);
  kit.cylinder(world, 0xffe5a1, 0, .46, 0, 4.8, .15);
  kit.cylinder(world, 0x65ba61, 0, .57, -.15, 4.1, .12);
  const colors = [0xffd46b, 0x77d7a1, 0xf38d79, 0xb299e5];
  for (let i = 0; i < 20; i++) {
    const angle = i / 20 * Math.PI * 2;
    kit.cylinder(world, PAPER, Math.sin(angle) * 3.25, .68, Math.cos(angle) * 3.25, .3, .1);
    kit.cylinder(world, colors[i % colors.length], Math.sin(angle) * 3.25, .75, Math.cos(angle) * 3.25, .25, .06);
  }
  kit.lighthouse(world, -1.65, .64, -1.65); kit.palm(world, 1.8, .64, -.7, .9); kit.palm(world, .4, .64, -1.5, .75);
  kit.box(world, 0xffe4aa, .3, 1.1, .5, 1.65, .9, 1.25);
  kit.mesh(world, new T.ConeGeometry(1.45, .9, 4), 0xe87565, .3, 1.99, .5).rotation.y = Math.PI / 4;
  for (let i = 0; i < 7; i++) kit.box(world, WOOD, 0, .47, 4.2 + i * .3, 1.5, .13, .25);
  players.forEach((player, index) => {
    const pawn = character(kit, world, index, player.name, player.characterId);
    pawn.group.position.set((index - (players.length - 1) / 2) * .9, .65, 2.1 + (index % 2) * .5);
    pawn.group.rotation.y = Math.PI;
  });
}

/** A single camera move: establish the players, approach, then look straight down. */
export function createIntroWorld(host: HTMLElement, gameId: GameId, players: IntroPlayer[], onError: () => void) {
  const kit = new SceneKit(host, onError);
  try {
    const world = new T.Group(); kit.scene.add(world);
    if (gameId === "party") islandScene(kit, world, players); else tableScene(kit, world, gameId, players);
    const labels: T.Sprite[] = [];
    world.traverse(object => { if (object instanceof T.Sprite) labels.push(object); });
    const target = new T.Vector3(0, gameId === "party" ? .8 : 1.8, 0);
    return {
      render(elapsed: number) {
        const progress = T.MathUtils.clamp((elapsed - 950) / 2100, 0, 1);
        const eased = progress * progress * (3 - 2 * progress);
        const fit = Math.max(1, .95 / kit.camera.aspect);
        const endDistance = T.MathUtils.lerp(10.4, 13, T.MathUtils.clamp((kit.camera.aspect - .9) / .5, 0, 1));
        const distance = T.MathUtils.lerp(18.2, endDistance, eased) * fit;
        const polar = (1 - eased) * 1.08;
        const azimuth = (1 - eased) * .5;
        kit.camera.position.setFromSphericalCoords(distance, polar, azimuth).add(target);
        kit.camera.up.set(0, progress === 1 ? 0 : 1, progress === 1 ? -1 : 0);
        for (const label of labels) label.material.opacity = 1 - T.MathUtils.clamp((eased - .55) / .45, 0, 1);
        kit.camera.lookAt(target); kit.render();
        host.dataset.camera = JSON.stringify({ polar: Number(polar.toFixed(4)), distance: Number(distance.toFixed(2)) });
      },
      dispose() { kit.dispose(); }
    };
  } catch (error) { kit.dispose(); throw error; }
}
