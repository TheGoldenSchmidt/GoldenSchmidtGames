// UI sprites: stone slabs for 9-slice buttons, the octagonal arrow socket and the wooden title plank.
// Rendered head-on with an orthographic camera; 1 unit = 100 sprite pixels.
// The slice sizes the CSS uses (inselwelt.css) are listed in SLAB_SPRITES and PLANK_SPRITE and must stay in sync.
import * as THREE from "three";
import { at, C, facet, jitter, mesh, polygonShape, seeded, surface, WOOD, type Rand } from "./kit";

export type SlabKind = "gold" | "violet" | "stone";

/** Face gradient, rim light and shade, the darker base ledge and the edge line, per material. */
interface SlabLook { light: string; top: string; bottom: string; shade: string; base: string; edge: string; cracks: number }
const LOOK: Record<SlabKind, SlabLook> = {
  gold: { light: "#fff3c4", top: "#ffde88", bottom: "#f6b658", shade: "#d68a38", base: "#d4904a", edge: "#6b3814", cracks: .32 },
  violet: { light: "#f6daff", top: "#e0b6fd", bottom: "#c696f3", shade: "#a26cdc", base: "#8458c8", edge: "#33196a", cracks: .26 },
  stone: { light: "#d6cde8", top: "#867a9c", bottom: "#6a5f80", shade: "#52476a", base: "#4a3f60", edge: "#1d1729", cracks: .34 }
};

/**
 * Sprite size, face size, corner cut, rim width and base drop in sprite pixels, and the 9-slice insets
 * (top, right, bottom, left) that keep corners, rim and base out of the stretched middle.
 */
export const SLAB_SPRITES = {
  big: { width: 720, height: 184, face: [700, 138], cut: 24, rim: 15, drop: 26, slice: [44, 48, 66, 48] },
  small: { width: 360, height: 112, face: [344, 82], cut: 16, rim: 10, drop: 16, slice: [30, 32, 46, 32] }
} as const;

type Pt = [number, number];

/**
 * Points around a rectangle with cut corners. Every edge is sampled in steps of about `step`; the samples
 * of an outer and an inner outline built with the same arguments correspond one to one.
 */
function chamferPath(w: number, h: number, cut: number, step: number, sizeW = w, sizeH = h): Array<{ p: Pt; n: Pt }> {
  const x = w / 2, y = h / 2, c = cut;
  const corners: Pt[] = [[-x + c, -y], [x - c, -y], [x, -y + c], [x, y - c], [x - c, y], [-x + c, y], [-x, y - c], [-x, -y + c]];
  const normals: Pt[] = [[0, -1], [.7071, -.7071], [1, 0], [.7071, .7071], [0, 1], [-.7071, .7071], [-1, 0], [-.7071, -.7071]];
  // Sample counts follow the reference size, so outer and inner outlines get the same number of points.
  const lengths = [sizeW - 2 * c, c * 1.41, sizeH - 2 * c, c * 1.41, sizeW - 2 * c, c * 1.41, sizeH - 2 * c, c * 1.41];
  const out: Array<{ p: Pt; n: Pt }> = [];
  corners.forEach((a, k) => {
    const b = corners[(k + 1) % 8], count = Math.max(k % 2 ? 2 : 1, Math.round(lengths[k] / step));
    for (let i = 0; i < count; i++) out.push({ p: [a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count], n: normals[k] });
  });
  return out;
}

/** A carved stone block: flat face, an uneven chipped rim, straight walls down to z = 0. */
function stoneBlock(rand: Rand, w: number, h: number, cut: number, rim: number, depth: number, look: SlabLook, face: THREE.Material, rimMaterial: THREE.Material, chip: number) {
  const group = new THREE.Group();
  const step = .2;
  const outer = chamferPath(w, h, cut, step);
  const inner = chamferPath(w - rim * 2, h - rim * 2, Math.max(.02, cut - rim * .45), step, w, h);
  // Chips bite into the outer edge; the rim width wanders so the bevel reads as cut stone.
  const P = outer.map(({ p, n }) => {
    const bite = rand() < .16 ? chip * (1.5 + rand() * 1.6) : rand() * chip * .7;
    return [p[0] - n[0] * bite, p[1] - n[1] * bite] as Pt;
  });
  const Q = inner.map(({ p, n }) => {
    const wander = (rand() - .5) * rim * .55;
    return [p[0] + n[0] * wander, p[1] + n[1] * wander] as Pt;
  });
  const top = depth, rimLow = depth - rim * .75;

  // Face: one flat polygon with a smooth top-to-bottom gradient.
  const tris = THREE.ShapeUtils.triangulateShape(Q.map(([x, y]) => new THREE.Vector2(x, y)), []);
  const facePos: number[] = [], faceCol: number[] = [];
  const light = C(look.top), dark = C(look.bottom), col = new THREE.Color();
  for (const tri of tris) for (const idx of tri) {
    const [x, y] = Q[idx];
    facePos.push(x, y, top);
    col.copy(dark).lerp(light, THREE.MathUtils.clamp(y / h + .5, 0, 1)).offsetHSL(0, 0, -Math.abs(x / w) * .03);
    faceCol.push(col.r, col.g, col.b);
  }
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute("position", new THREE.Float32BufferAttribute(facePos, 3));
  faceGeo.setAttribute("color", new THREE.Float32BufferAttribute(faceCol, 3));
  faceGeo.computeVertexNormals();
  group.add(mesh(faceGeo, face));

  // Rim facets between face and outer edge, and the walls below.
  const rimPos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => rimPos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    quad([...Q[i], top], [...P[i], rimLow], [...P[j], rimLow], [...Q[j], top]);
    quad([...P[i], rimLow], [...P[i], 0], [...P[j], 0], [...P[j], rimLow]);
  }
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute("position", new THREE.Float32BufferAttribute(rimPos, 3));
  const lit = C(look.light), mid = C(look.top), shade = C(look.shade);
  group.add(mesh(facet(rimGeo, (_m, n, r) => {
    const base = n.y > .3 ? lit.clone().lerp(mid, r * .35) : n.y < -.3 ? shade.clone() : mid.clone().lerp(shade, .35 + r * .3);
    return base.offsetHSL(0, 0, (r - .5) * .06);
  }, rand), rimMaterial));
  return { group, outline: P };
}

function edgeLine(points: Pt[], grow: number, z: number, color: string) {
  // Average the neighbouring edge directions to push each point outwards.
  const out = points.map((p, i) => {
    const a = points[(i - 1 + points.length) % points.length], b = points[(i + 1) % points.length];
    const tx = b[0] - a[0], ty = b[1] - a[1], len = Math.hypot(tx, ty) || 1;
    return [p[0] + ty / len * grow, p[1] - tx / len * grow] as Pt;
  });
  return at(mesh(new THREE.ShapeGeometry(polygonShape(out)), new THREE.MeshBasicMaterial({ color })), 0, 0, z);
}

export function buildSlab(kind: SlabKind, size: keyof typeof SLAB_SPRITES, pressed: boolean) {
  const spec = SLAB_SPRITES[size], look = LOOK[kind];
  // Same seed for normal and pressed, so both sprites show the same stone.
  const rand = seeded(kind.length * 977 + (size === "big" ? 11 : 23));
  const scene = new THREE.Scene();
  const [fw, fh] = [spec.face[0] / 100, spec.face[1] / 100];
  const cut = spec.cut / 100, rim = spec.rim / 100, drop = spec.drop / 100;
  const faceY = spec.height / 200 - .05 - fh / 2;
  const chip = size === "big" ? .022 : .016;

  const faceMat = surface({ grain: [4, 4, 4], albedo: kind === "stone" ? .14 : .1, bump: .9, roughness: kind === "stone" ? .85 : .6, cracks: look.cracks });
  const rimMat = surface({ grain: [6, 6, 6], albedo: .1, bump: .9, roughness: .8 });
  const face = stoneBlock(rand, fw, fh, cut, rim, .2, look, faceMat, rimMat, chip);
  face.group.position.y = faceY - (pressed ? drop * .6 : 0);
  scene.add(face.group);

  // The base ledge below: darker, broken in a few places, visible as the slab's thickness.
  const baseLook: SlabLook = { ...look, light: look.shade, top: look.base, bottom: look.base, shade: look.edge };
  const baseMat = surface({ grain: [5, 5, 5], albedo: .14, bump: .9, roughness: .85, vertexColors: true });
  const base = stoneBlock(rand, fw + .01, fh, cut, rim * .6, .14, baseLook, baseMat, baseMat, chip * 1.3);
  base.group.position.set(0, faceY - drop, -.09);
  scene.add(base.group);

  // A thin dark edge behind both blocks keeps the shape crisp on any background.
  scene.add(at(edgeLine(face.outline, .018, -.42, look.edge), 0, faceY - (pressed ? drop * .6 : 0), 0));
  scene.add(at(edgeLine(base.outline, .02, -.43, look.edge), 0, faceY - drop, 0));
  return scene;
}

/** Wooden title plank for menu headers and section labels; the ends are cut and nailed. */
export const PLANK_SPRITE = { width: 480, height: 112, slice: [30, 56, 34, 56] } as const;

export function buildPlank() {
  const rand = seeded(5150);
  const scene = new THREE.Scene();
  const w = 4.64, h = .86;
  const x = w / 2, y = h / 2;
  const outline: Pt[] = [[-x + .1, -y], [x - .16, -y + .02], [x, -y + .2], [x - .06, y - .14], [x - .2, y], [-x + .14, y - .02], [-x - .02, y - .24], [-x + .04, -y + .16]];
  const shape = polygonShape(outline);
  const plank = new THREE.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 1, steps: 1 });
  jitter(plank, [.008, .008, .004], 51);
  // Light, calm grain on the face: the title sits on it.
  const wood = surface({ grain: [1, 24, 4], albedo: .13, bump: .6, roughness: .75, cracks: .1 });
  scene.add(mesh(facet(plank, (m, n, r) => WOOD(m, n, r).multiplyScalar(n.z > .8 ? 1.16 + (m.y / h) * .06 : n.y > .3 ? 1.24 : .78), rand), wood));
  for (const nx of [-x + .26, x - .3]) {
    const nail = mesh(new THREE.CylinderGeometry(.045, .045, .03, 10), surface({ vertexColors: false, color: "#8a8fa8", roughness: .35, metalness: .6, albedo: .05, bump: .2 }));
    nail.rotation.x = Math.PI / 2;
    scene.add(at(nail, nx, 0, .2));
  }
  const back = new THREE.ShapeGeometry(polygonShape(outline.map(([px, py]) => [px * 1.012 + Math.sign(px) * .012, py * 1.06] as Pt)));
  scene.add(at(mesh(back, new THREE.MeshBasicMaterial({ color: "#4a2a17" })), 0, -.012, -.1));
  return scene;
}

/** Octagonal socket for the arrow; the chevron itself stays an SVG in the page. */
export function buildSocket(kind: "gold" | "violet") {
  const scene = new THREE.Scene();
  const base = kind === "gold" ? ["#6e4a2a", "#4a2e16"] : ["#4a2d82", "#2f1a5c"];
  const r = .4, k = r * Math.tan(Math.PI / 8);
  const oct = polygonShape([[-k, -r], [k, -r], [r, -k], [r, k], [k, r], [-k, r], [-r, k], [-r, -k]]);
  const geo = new THREE.ExtrudeGeometry(oct, { depth: .06, bevelEnabled: true, bevelThickness: .04, bevelSize: .045, bevelSegments: 2 });
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal;
  const hi = C(base[0]), lo = C(base[1]), col = new THREE.Color();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    col.copy(lo).lerp(hi, THREE.MathUtils.clamp(p.getY(i) / r * .5 + .5, 0, 1));
    if (n.getZ(i) < .95 && n.getY(i) < -.3) col.lerp(C("#ffffff"), .12);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(mesh(geo, surface({ grain: [6, 6, 6], albedo: .05, bump: .4, roughness: .5 })));
  return scene;
}

export function spriteCamera(width: number, height: number) {
  const w = width / 200, h = height / 200;
  const camera = new THREE.OrthographicCamera(-w, w, h, -h, .1, 20);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
