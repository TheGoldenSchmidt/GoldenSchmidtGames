// Backdrop layers: sky, clouds, mountains, pines and haze for portrait and landscape screens,
// plus the leafy foreground corners. Positions are authored as screen fractions (u from left,
// v from top) at a depth, so the composition can be matched to the reference picture directly.
import * as THREE from "three";
import { at, C, facet, hash, jitter, mesh, type Rand, rockPaint, seeded, surface, tone } from "./kit";

const mountainMat = surface({ grain: [.6, .6, .6], albedo: .1, bump: .6, roughness: .95 });
const pineMat = surface({ grain: [4, 4, 4], albedo: .08, bump: .4, roughness: .85 });
const cloudMat = surface({ grain: [1.2, 1.2, 1.2], albedo: .03, bump: .2, roughness: 1, emissive: "#b4a8ea", emissiveIntensity: .5 });
const bushMat = surface({ grain: [5, 5, 5], albedo: .1, bump: .6, roughness: .8 });
const rockMat = surface({ grain: [4, 5, 4], albedo: .16, bump: 1, roughness: .9 });

/** Point at screen fraction (u, v) and distance `depth` in front of the camera. */
function place(camera: THREE.PerspectiveCamera, u: number, v: number, depth: number) {
  const ndc = new THREE.Vector3(u * 2 - 1, 1 - v * 2, .5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const forward = camera.getWorldDirection(new THREE.Vector3());
  return camera.position.clone().add(dir.multiplyScalar(depth / dir.dot(forward)));
}
/** World size of one screen height at a distance. */
function screenHeight(camera: THREE.PerspectiveCamera, depth: number) {
  return 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
}

interface MountainStyle { lit: string; mid: string; shade: string; snow?: string }
const PINK: MountainStyle = { lit: "#f4b0e6", mid: "#b585dc", shade: "#7c63c9", snow: "#ffe6f7" };
const TEAL: MountainStyle = { lit: "#6fb3c9", mid: "#4f93ad", shade: "#3a6a8f" };
const BLUE: MountainStyle = { lit: "#9aa4ef", mid: "#7480dc", shade: "#5560c2", snow: "#d9ddff" };
const HAZE: MountainStyle = { lit: "#a6b4f0", mid: "#8c9ce6", shade: "#7486da" };

function mountain(rand: Rand, key: number, radius: number, height: number, style: MountainStyle, sides = 9) {
  // A faceted peak: the ridges spread more towards the base, the summit leans a little.
  const cone = new THREE.ConeGeometry(radius, height, sides, 6, true);
  cone.translate(0, height / 2, 0);
  const p = cone.attributes.position;
  const lean = (rand() - .5) * radius * .25;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / height;
    const x = Math.round(p.getX(i) * 50), z = Math.round(p.getZ(i) * 50), y = Math.round(p.getY(i) * 50);
    const ridge = 1 + (hash(x, y, z, key) - .5) * .7 * (1 - t);
    p.setXYZ(i, p.getX(i) * ridge + lean * t, t < .02 ? -height * .3 : p.getY(i) + (hash(x, y, z, key + 1) - .5) * height * .07 * (1 - t), p.getZ(i) * ridge);
  }
  const lit = C(style.lit), mid = C(style.mid), shade = C(style.shade), snow = style.snow ? C(style.snow) : undefined;
  return mesh(facet(cone, (m, n, r) => {
    const facing = n.x * -.75 + n.z * .55 + n.y * .3;
    const base = facing > .3 ? lit.clone() : facing > -.1 ? mid.clone() : shade.clone();
    if (snow && m.y > height * .74 && facing > -.25) base.lerp(snow, .8);
    return base.offsetHSL(0, 0, (r - .5) * .06);
  }, rand), mountainMat, false);
}

function pine(rand: Rand, size: number) {
  const g = new THREE.Group();
  const greens = tone(["#4f9e3a", "#5aab3e", "#468f34"], .05), darks = tone(["#2f6f2e", "#357a31"], .04);
  g.add(at(mesh(new THREE.CylinderGeometry(.06, .09, .5, 5), surface({ vertexColors: false, color: "#6a3a2c" })), 0, .25, 0));
  for (let tier = 0; tier < 4; tier++) {
    const r = .62 - tier * .12, h = .8 - tier * .08;
    const cone = new THREE.ConeGeometry(r, h, 7, 1);
    jitter(cone, .04, tier * 13 + Math.floor(rand() * 100));
    g.add(at(mesh(facet(cone, (m, n, rr) => (n.x < .1 ? greens(m, n, rr) : darks(m, n, rr)), rand), pineMat), 0, .55 + tier * .42, 0));
  }
  g.scale.setScalar(size);
  g.rotation.y = rand() * 6;
  return g;
}

function cloud(rand: Rand, puffs = 6) {
  const g = new THREE.Group();
  const white = tone(["#fbf7ff", "#f1eaff", "#e9e0fb"], .03);
  for (let i = 0; i < puffs; i++) {
    const r = .45 + rand() * .5 * (1 - Math.abs(i / (puffs - 1) - .5) * 1.4);
    const ball = new THREE.IcosahedronGeometry(r, 1);
    jitter(ball, r * .08, i * 7 + 3);
    const p = ball.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < -r * .2) p.setY(k, -r * .2);
    ball.scale(1.25, .8, 1);
    g.add(at(mesh(facet(ball, white, rand), cloudMat, false), (i / (puffs - 1) - .5) * puffs * .62, rand() * .25, (rand() - .5) * .4));
  }
  return g;
}

function skyTexture(layout: "portrait" | "landscape") {
  const canvas = document.createElement("canvas");
  canvas.width = layout === "portrait" ? 270 : 480;
  canvas.height = layout === "portrait" ? 585 : 270;
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#1f2462");
  sky.addColorStop(.16, "#363a92");
  sky.addColorStop(.36, "#5a5ec4");
  sky.addColorStop(.58, "#7480da");
  sky.addColorStop(.82, "#8e9fe8");
  sky.addColorStop(1, "#93aaee");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Soft elliptical glows: pink evening light on the right, deeper night in the top left.
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / ry, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
    g.addColorStop(0, color.replace("A", String(alpha)));
    g.addColorStop(.55, color.replace("A", String(alpha * .45)));
    g.addColorStop(1, color.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(-w * 4, -h * 4, w * 8, h * 8);
    ctx.restore();
  };
  ellipse(w * 1.05, h * .2, w * .75, h * (layout === "portrait" ? .26 : .55), "rgba(238,186,236,A)", .85);
  ellipse(-w * .1, -h * .05, w * .8, h * (layout === "portrait" ? .22 : .5), "rgba(16,18,66,A)", .6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function backdropCamera(layout: "portrait" | "landscape", aspect: number) {
  const camera = new THREE.PerspectiveCamera(layout === "portrait" ? 52 : 34, aspect, .5, 400);
  camera.position.set(0, 4, 30);
  camera.lookAt(0, 6.5, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/**
 * One element of a backdrop. `u`/`v` are screen fractions (for mountains: the peak), `depth` the distance
 * from the camera. `size` is a percentage: mountain and pine height of the screen height, cloud width of
 * the screen width. `width` is a mountain's base radius relative to its height, or the spread of a pine group.
 */
interface Item { kind: "mountain" | "pines" | "cloud"; u: number; v: number; depth: number; size: number; style?: MountainStyle; count?: number; width?: number }

/** Portrait composition after the reference: peaks and pines frame the sides, haze fills the lower middle. */
const PORTRAIT: Item[] = [
  { kind: "mountain", u: .42, v: .8, depth: 110, size: 12, style: HAZE, width: 1.9 },
  { kind: "mountain", u: .12, v: .82, depth: 100, size: 10, style: HAZE, width: 1.7 },
  { kind: "mountain", u: .8, v: .78, depth: 105, size: 13, style: HAZE, width: 1.6 },
  { kind: "mountain", u: .62, v: .88, depth: 80, size: 8, style: TEAL, width: 2.2 },
  { kind: "cloud", u: .5, v: .87, depth: 70, size: 70 },
  { kind: "cloud", u: .08, v: .9, depth: 64, size: 40 },
  { kind: "mountain", u: .07, v: .14, depth: 80, size: 26, style: PINK, width: .62 },
  { kind: "mountain", u: -.04, v: .22, depth: 70, size: 18, style: BLUE, width: .9 },
  { kind: "mountain", u: .95, v: .19, depth: 78, size: 24, style: BLUE, width: .7 },
  { kind: "mountain", u: .04, v: .27, depth: 52, size: 14, style: TEAL, width: 1.1 },
  { kind: "mountain", u: 1.02, v: .3, depth: 50, size: 12, style: TEAL, width: 1.1 },
  { kind: "pines", u: .08, v: .31, depth: 30, size: 13, count: 6, width: .24 },
  { kind: "pines", u: .94, v: .32, depth: 30, size: 11, count: 5, width: .18 },
  { kind: "cloud", u: .12, v: .105, depth: 40, size: 20 },
  { kind: "cloud", u: .98, v: .225, depth: 46, size: 18 },
  { kind: "cloud", u: .93, v: .27, depth: 50, size: 12 }
];

/** Landscape: the same world, spread along the edges around the hero and the game modes. */
const LANDSCAPE: Item[] = [
  { kind: "mountain", u: .5, v: .76, depth: 110, size: 16, style: HAZE, width: 2.6 },
  { kind: "mountain", u: .22, v: .79, depth: 100, size: 14, style: HAZE, width: 2.2 },
  { kind: "mountain", u: .8, v: .75, depth: 105, size: 16, style: HAZE, width: 2.2 },
  { kind: "cloud", u: .36, v: .88, depth: 70, size: 30 },
  { kind: "cloud", u: .7, v: .9, depth: 66, size: 26 },
  { kind: "mountain", u: .05, v: .2, depth: 80, size: 40, style: PINK, width: .62 },
  { kind: "mountain", u: .94, v: .3, depth: 78, size: 34, style: BLUE, width: .7 },
  { kind: "mountain", u: .02, v: .42, depth: 52, size: 22, style: TEAL, width: 1.1 },
  { kind: "mountain", u: .99, v: .48, depth: 50, size: 18, style: TEAL, width: 1.1 },
  { kind: "pines", u: .05, v: .5, depth: 30, size: 16, count: 6, width: .1 },
  { kind: "pines", u: .95, v: .55, depth: 30, size: 14, count: 5, width: .08 },
  { kind: "cloud", u: .14, v: .13, depth: 44, size: 10 },
  { kind: "cloud", u: .8, v: .1, depth: 48, size: 10 },
  { kind: "cloud", u: .9, v: .26, depth: 52, size: 7 }
];

export function buildBackdrop(layout: "portrait" | "landscape", camera: THREE.PerspectiveCamera) {
  const rand = seeded(layout === "portrait" ? 4242 : 4343);
  const scene = new THREE.Scene();
  scene.background = skyTexture(layout);
  scene.fog = new THREE.Fog("#8d9de6", 30, 150);
  let key = 1000;
  for (const item of layout === "portrait" ? PORTRAIT : LANDSCAPE) {
    const point = place(camera, item.u, item.v, item.depth);
    const tall = screenHeight(camera, item.depth), wide = tall * camera.aspect;
    if (item.kind === "mountain") {
      const height = item.size / 100 * tall * 1.6;
      const m = mountain(rand, key++, height * (item.width ?? 1), height, item.style!);
      scene.add(at(m, point.x, point.y - height, point.z));
    } else if (item.kind === "pines") {
      const count = item.count ?? 3;
      for (let i = 0; i < count; i++) {
        const spread = (i / Math.max(1, count - 1) - .5) * (item.width ?? .15);
        const p = place(camera, item.u + spread + (rand() - .5) * .02, item.v + (rand() - .5) * .03, item.depth + (rand() - .5) * 4);
        const s = item.size / 100 * tall / 2.3 * (.7 + rand() * .5);
        scene.add(at(pine(rand, s), p.x, p.y - s * 2.3, p.z));
      }
    } else {
      const c = cloud(rand, 5 + Math.floor(rand() * 3));
      c.scale.setScalar(item.size / 100 * wide / 3.8);
      scene.add(at(c, point.x, point.y, point.z));
    }
  }
  return scene;
}

/* Foreground corners ------------------------------------------------- */

function bush(rand: Rand, key: number, size: number) {
  const g = new THREE.Group();
  const leafTones = tone(["#c2dc3e", "#b0d23a", "#9cc735", "#86b52f"], .05), shade = tone(["#5d8f2a", "#4f7d26"], .04);
  for (let i = 0; i < 7; i++) {
    const r = size * (.45 + rand() * .35);
    const blob = jitter(new THREE.IcosahedronGeometry(r, 1), r * .16, key + i);
    blob.scale(1.2, .8, 1);
    const a = (i / 7) * Math.PI * 1.6 + .2;
    g.add(at(mesh(facet(blob, (m, n, rr) => (n.y > -.1 && n.x < .4 ? leafTones(m, n, rr) : shade(m, n, rr)), rand), bushMat),
      Math.cos(a) * size * .7, Math.sin(a) * size * .45 + size * .1, (rand() - .5) * size * .5));
  }
  return g;
}

export function cornerCamera(aspect: number) {
  const camera = new THREE.PerspectiveCamera(30, aspect, .5, 60);
  camera.position.set(0, 1.2, 10);
  camera.lookAt(0, 1.2, 0);
  camera.updateMatrixWorld();
  return camera;
}

export function buildCorner(side: "left" | "right") {
  const rand = seeded(side === "left" ? 77 : 78);
  const scene = new THREE.Scene();
  const m = side === "left" ? 1 : -1;
  if (side === "left") {
    scene.add(at(bush(rand, 2000, 1.2), -1.9, -.7, 0));
    scene.add(at(bush(rand, 2100, .85), -.5, -1.5, .6));
    scene.add(at(bush(rand, 2200, 1), -2.1, 1.05, -.6));
  } else {
    scene.add(at(bush(rand, 2300, 1.05), 2, .9, -.4));
    scene.add(at(bush(rand, 2400, .7), .9, -.35, .3));
    const boulder = mesh(facet(jitter(new THREE.IcosahedronGeometry(1.3, 0), .22, 2500), rockPaint, rand), rockMat);
    boulder.scale.set(1, .9, .9);
    scene.add(at(boulder, 1.75, -1.35, .4));
    const small = mesh(facet(jitter(new THREE.IcosahedronGeometry(.55, 0), .12, 2600), rockPaint, rand), rockMat);
    scene.add(at(small, .35, -1.65, 1));
  }
  scene.rotation.y = m * .12;
  return scene;
}
