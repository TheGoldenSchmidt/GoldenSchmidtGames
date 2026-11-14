// UI sprites: carved slabs for 9-slice buttons and the octagonal arrow socket.
// Rendered head-on with an orthographic camera; 1 unit = 100 sprite pixels.
// The slice sizes the CSS uses (inselwelt.css) are listed in SLAB_SPRITES and must stay in sync.
import * as THREE from "three";
import { at, C, chamferedRect, jitter, mesh, polygonShape, surface } from "./kit";

export type SlabKind = "gold" | "violet" | "stone";

interface SlabLook { light: string; top: string; bottom: string; side: string; ink: string }
const LOOK: Record<SlabKind, SlabLook> = {
  gold: { light: "#fff0b4", top: "#ffd777", bottom: "#f1aa4c", side: "#a95a24", ink: "#2b1d4f" },
  violet: { light: "#f6d6ff", top: "#dcaefc", bottom: "#c18ef2", side: "#55309a", ink: "#25164f" },
  stone: { light: "#c2bbd8", top: "#7c7092", bottom: "#605575", side: "#2e2742", ink: "#1d1830" }
};

/** Sprite size and 9-slice insets in sprite pixels (top, right, bottom, left). */
export const SLAB_SPRITES = {
  big: { width: 720, height: 172, face: [700, 140], cut: 22, drop: 18, slice: [36, 44, 50, 44] },
  small: { width: 360, height: 104, face: [344, 80], cut: 15, drop: 11, slice: [26, 30, 38, 30] }
} as const;

/** Face outline: chamfered corners and two chips in the long edges, like a cut stone. */
function faceShape(w: number, h: number, cut: number, chips: boolean) {
  const x = w / 2, y = h / 2, c = cut;
  const pts: Array<[number, number]> = [[-x + c, -y]];
  if (chips) pts.push([w * .16 - x, -y], [w * .16 - x + .05, -y + .025], [w * .16 - x + .13, -y]);
  pts.push([x - c, -y], [x, -y + c], [x, y - c], [x - c, y]);
  if (chips) pts.push([w * .63 - x + .14, y], [w * .63 - x + .06, y - .028], [w * .63 - x, y]);
  pts.push([-x + c, y], [-x, y - c], [-x, -y + c]);
  return polygonShape(pts);
}

function gradientColors(geometry: THREE.BufferGeometry, look: SlabLook, h: number) {
  geometry.computeVertexNormals();
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  const light = C(look.light), top = C(look.top), bottom = C(look.bottom), col = new THREE.Color();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = THREE.MathUtils.clamp(p.getY(i) / h + .5, 0, 1);
    col.copy(bottom).lerp(top, t);
    if (n.getZ(i) < .95 && n.getY(i) > .3) col.lerp(light, .7);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function buildSlab(kind: SlabKind, size: keyof typeof SLAB_SPRITES, pressed: boolean) {
  const spec = SLAB_SPRITES[size], look = LOOK[kind];
  const scene = new THREE.Scene();
  const [fw, fh] = [spec.face[0] / 100, spec.face[1] / 100];
  const cut = spec.cut / 100, drop = spec.drop / 100;
  const top = spec.height / 200 - .06 - fh / 2;
  const faceY = top - (pressed ? drop * .65 : 0);
  const bevel = size === "big" ? .085 : .055;

  const face = new THREE.ExtrudeGeometry(faceShape(fw - bevel * 2, fh - bevel * 2, cut * .8, size === "big"), {
    depth: .12, bevelEnabled: true, bevelThickness: bevel * .9, bevelSize: bevel, bevelSegments: 2, curveSegments: 1
  });
  jitter(face, [.006, .006, .004], size === "big" ? 31 : 37);
  const faceMat = surface({ grain: [4.5, 4.5, 4.5], albedo: kind === "stone" ? .12 : .07, bump: .7, roughness: kind === "stone" ? .85 : .55 });
  scene.add(at(mesh(gradientColors(face, look, fh), faceMat), 0, faceY, 0));

  // Side wall below the face, and the dark ink outline around both.
  const sideShape = chamferedRect(fw + .02, fh, cut);
  const side = new THREE.ExtrudeGeometry(sideShape, { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .02, bevelSegments: 1 });
  scene.add(at(mesh(side, surface({ vertexColors: false, color: look.side, grain: [4, 4, 4], albedo: .1, bump: .5, roughness: .8 })), 0, top - drop, -.16));
  const ink = surface({ vertexColors: false, color: look.ink, albedo: .02, bump: .1, roughness: .9 });
  for (const y of [top, top - drop]) scene.add(at(mesh(new THREE.ShapeGeometry(chamferedRect(fw + .08, fh + .08, cut + .02)), ink), 0, y, -.3));
  scene.add(at(mesh(new THREE.PlaneGeometry(fw + .08 - (cut + .02) * 2, drop), ink), 0, top - drop / 2, -.3));
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
