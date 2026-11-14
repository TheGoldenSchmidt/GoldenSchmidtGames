// Hero layer: the floating island with the carved stone plaque, logo, flag, sword, die, chest,
// motto sign and waterfall. The grass surface is y = 0; the camera looks along -z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  at, C, CHEST_WOOD, chamferedRect, extrudeText, facet, GOLD, GRASS, GRASS_LIP, jitter, mesh, polygonShape,
  type Paint, type Rand, rockPaint, seeded, stonePaint, surface, tone, WOOD
} from "./kit";
import { LOGO_GAMES, LOGO_GOLDEN, LOGO_SCHMIDT, MOTTO_BE, MOTTO_PLAY } from "./logoPaths";

/* Materials of this layer. `reflective` marks metals that receive the warm studio reflection. */
const stoneMat = surface({ grain: [7, 7, 7], albedo: .14, bump: .9, roughness: .82 });
const rockMat = surface({ grain: [4, 5, 4], albedo: .16, bump: 1, roughness: .9 });
const grassMat = surface({ grain: [5, 2, 5], albedo: .1, bump: .5, roughness: .9, side: THREE.DoubleSide });
const woodMat = surface({ grain: [1.2, 26, 4], albedo: .2, bump: .7, roughness: .75 });
const chestWoodMat = surface({ grain: [1.5, 22, 22], albedo: .2, bump: .6, roughness: .7, side: THREE.DoubleSide });
chestWoodMat.emissive = new THREE.Color("#3a1404");
const goldMat = surface({ grain: [14, 14, 14], albedo: .05, bump: .3, roughness: .32, metalness: .55, side: THREE.DoubleSide });
const leafMat = surface({ grain: [9, 9, 9], albedo: .08, bump: .3, roughness: .62, side: THREE.DoubleSide });
const darkMat = surface({ grain: [9, 9, 9], albedo: .1, bump: .5, roughness: .9 });
goldMat.userData.reflective = true;
const goldOutside = surface({ grain: [14, 14, 14], albedo: .05, bump: .3, roughness: .32, metalness: .55 });
goldOutside.userData.reflective = true;

function plain(hex: string, roughness = .8, metalness = 0) {
  const m = surface({ vertexColors: false, color: hex, roughness, metalness, albedo: .04, bump: .2 });
  if (metalness > 0) m.userData.reflective = true;
  return m;
}

function rock(radius: number, key: number, paint: Paint, rand: Rand, material: THREE.Material = rockMat, detail = 1, rough = .22) {
  return mesh(facet(jitter(new THREE.IcosahedronGeometry(radius, detail), radius * rough, key), paint, rand), material);
}

/** A stone with chamfered edges, lying along x. */
function block(w: number, h: number, d: number, key: number, rand: Rand, paint: Paint = stonePaint, material: THREE.Material = stoneMat) {
  const bevel = Math.min(w, h, d) * .17;
  const g = new THREE.ExtrudeGeometry(chamferedRect(w - bevel * 2, h - bevel * 2, Math.min(w, h) * .06), {
    depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return mesh(facet(jitter(g, Math.min(w, h) * .055, key), paint, rand), material);
}

function bendUp(g: THREE.BufferGeometry, half: number, rise: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + rise * (1 - (p.getX(i) / half) ** 2));
  return g;
}

/** Carved metal lettering: a lit face with a vertical gradient, darker walls, a dark backing as outline. */
function lettering(word: { width: number; d: string }, scale: number, rise: number, face: [string, string], wall: string, rim: string, outline: string) {
  const group = new THREE.Group();
  const front = bendUp(extrudeText(word, { depth: 24, bevelEnabled: true, bevelThickness: 7, bevelSize: 4.5 }), word.width / 2, rise);
  front.computeVertexNormals();
  const p = front.attributes.position, n = front.attributes.normal;
  const top = C(face[0]), bottom = C(face[1]), side = C(wall), light = C(rim), col = new THREE.Color();
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const nz = n.getZ(i), ny = n.getY(i);
    const t = THREE.MathUtils.clamp((p.getY(i) - rise * (1 - (p.getX(i) / (word.width / 2)) ** 2)) / 71, 0, 1);
    if (nz > .9) col.copy(bottom).lerp(top, t);
    else if (nz > .25) col.copy(ny > .2 ? light : ny < -.2 ? side : bottom).lerp(top, ny > .2 ? .3 : 0);
    else col.copy(side);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  front.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const metal = surface({ flat: false, grain: [.6, .6, .6], albedo: .03, bump: .1, roughness: .34, metalness: .62 });
  metal.userData.reflective = true;
  group.add(mesh(front, metal));
  const back = bendUp(extrudeText(word, { depth: 12, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelOffset: 7 }), word.width / 2, rise);
  back.computeVertexNormals();
  group.add(at(mesh(back, plain(outline, .7)), 0, -2, -6));
  group.scale.setScalar(scale);
  return group;
}

function leaf(rand: Rand, dark: boolean) {
  // A rounded leaf with a raised midrib; the left half catches more light than the right.
  const R0 = [0, 0, .02], R1 = [0, .15, .07], R2 = [0, .3, .05], T = [0, .44, 0];
  const L1 = [-.1, .07, 0], L2 = [-.16, .2, -.01], L3 = [-.12, .34, -.01];
  const M = (v: number[]) => [-v[0], v[1], v[2]];
  const left = [[R0, L1, R1], [L1, L2, R1], [R1, L2, R2], [L2, L3, R2], [R2, L3, T]];
  const right = left.map(([a, b, c]) => [M(a), M(c), M(b)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...left, ...right].flat(2), 3));
  const lights = dark ? ["#4f9a2e", "#58a632"] : ["#a6dc46", "#98d23e"];
  const darks = dark ? ["#2c6a28", "#337529"] : ["#5fae34", "#67b538"];
  const result = mesh(facet(g, (m, _n, r) => C((m.x < 0 ? lights : darks)[r < .5 ? 0 : 1]), rand), leafMat);
  // Thin and double-sided: a leaf would shadow itself. Leaves still cast shadows onto the stones.
  result.receiveShadow = false;
  return result;
}

function vine(rand: Rand, turns: Array<[number, number, boolean?]>) {
  const group = new THREE.Group();
  for (const [turn, size, dark] of turns) {
    const l = leaf(rand, Boolean(dark));
    l.rotation.set((rand() - .2) * .8, (rand() - .5) * .9, THREE.MathUtils.degToRad(-turn));
    l.scale.setScalar(size);
    l.position.set((rand() - .5) * .1, (rand() - .5) * .1, rand() * .08);
    group.add(l);
  }
  return group;
}

function crownShape(w: number, h: number) {
  return polygonShape(([[-.5, 0], [.5, 0], [.56, .66], [.29, .36], [0, .86], [-.29, .36], [-.56, .66]] as Array<[number, number]>).map(([x, y]) => [x * w, y * h]));
}

function crown(rand: Rand) {
  const g = new THREE.Group();
  const body = new THREE.ExtrudeGeometry(crownShape(.7, .52), { depth: .12, bevelEnabled: true, bevelThickness: .035, bevelSize: .025, bevelSegments: 2 });
  g.add(mesh(facet(body, GOLD, rand), goldMat));
  g.add(at(mesh(facet(jitter(new THREE.BoxGeometry(.66, .11, .2), .006, 7), GOLD, rand), goldMat), 0, .02, .08));
  for (const [x, y] of [[-.39, .35], [0, .46], [.39, .35]]) g.add(at(mesh(new THREE.SphereGeometry(.045, 10, 8), plain("#ffd75a", .3, .6)), x, y, .17));
  g.add(at(mesh(new THREE.OctahedronGeometry(.055), plain("#e0473f", .25)), 0, .2, .17));
  return g;
}

function plaque(rand: Rand) {
  const g = new THREE.Group();

  // Dark carved slab behind the lettering.
  const half: Array<[number, number]> = [[.56, 1.27], [.75, .82], [1.34, .56], [1.58, .25], [1.6, -.5], [1.54, -.92]];
  const slab = polygonShape([...half, ...half.map(([x, y]) => [-x, y] as [number, number]).reverse()]);
  const slabGeo = new THREE.ExtrudeGeometry(slab, { depth: .2, bevelEnabled: false });
  slabGeo.translate(0, 0, -.22);
  g.add(mesh(facet(slabGeo, tone(["#30282a", "#2b2325", "#352c2d"], .03), rand), darkMat));

  // Ring of stones along the slab edge.
  const line: Array<[number, number]> = [[-.55, 1.36], [.55, 1.36], [.86, .86], [1.44, .6], [1.69, .28], [1.72, -.49], [1.66, -.92]];
  const counts = [2, 1, 1, 1, 2, 1];
  let key = 10;
  for (const mirror of [1, -1]) {
    for (let i = mirror === 1 ? 0 : 1; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const length = Math.hypot(bx - ax, by - ay), angle = Math.atan2(by - ay, bx - ax);
      for (let k = 0; k < counts[i]; k++) {
        const t = (k + .5) / counts[i];
        const stone = block(length / counts[i] + .1, .4 + rand() * .06, .58 + rand() * .08, key++, rand);
        stone.position.set((ax + (bx - ax) * t) * mirror, ay + (by - ay) * t, rand() * .03);
        stone.rotation.z = mirror === 1 ? angle : Math.PI - angle;
        g.add(stone);
      }
    }
    for (const [x, y] of [line[1], line[3], line[5]]) {
      const corner = block(.5, .5, .68, key++, rand);
      corner.position.set(x * mirror, y, .03);
      corner.rotation.z = rand() * .6;
      g.add(corner);
      g.add(at(mesh(new THREE.SphereGeometry(.065, 14, 10), plain("#6f7189", .3, .7)), x * mirror, y, .39));
    }
  }
  // Bottom beam of four stones, with rivets at the ends.
  for (let i = 0; i < 4; i++) {
    const stone = block(.99, .52 + rand() * .04, .7 + rand() * .06, key++, rand);
    stone.position.set(-1.44 + i * .96, -1.2, .05);
    g.add(stone);
  }
  for (const x of [-1.62, 1.62]) g.add(at(mesh(new THREE.SphereGeometry(.065, 14, 10), plain("#6f7189", .3, .7)), x, -1.2, .43));

  // Rock hanging below the plaque.
  for (const [x, y, r, h] of [[-.95, -1.6, .46, .7], [-.3, -1.66, .52, 1], [.42, -1.64, .48, .82], [1, -1.56, .42, .58]]) {
    const cone = new THREE.ConeGeometry(r, h, 6, 2);
    cone.rotateX(Math.PI);
    g.add(at(mesh(facet(jitter(cone, .07, key++), rockPaint, rand), rockMat), x, y - h * .2, -.02));
  }

  g.add(at(crown(rand), 0, .76, .02));
  // The lettering stands in front of the stone ring (its front faces reach z ≈ .36), each word its own layer.
  const word = (name: string, lettered: THREE.Group, y: number, z: number) => { lettered.name = name; g.add(at(lettered, 0, y, z)); };
  word("golden", lettering(LOGO_GOLDEN, .0067, 10, ["#fff0a0", "#f2a92e"], "#a8521a", "#fff6c8", "#3b1d0f"), .08, .34);
  word("schmidt", lettering(LOGO_SCHMIDT, .0066, 7, ["#fff0a0", "#f2a92e"], "#a8521a", "#fff6c8", "#3b1d0f"), -.43, .37);
  word("games", lettering(LOGO_GAMES, .0048, 3, ["#f6f6ff", "#a9a6c8"], "#6c6890", "#ffffff", "#262036"), -.82, .4);

  // Vines climbing along the frame: small and dark leaves mixed, denser at the corners.
  const vines: Array<[number, number, Array<[number, number, boolean?]>]> = [
    [-1.5, .58, [[-128, .8, true], [-84, .95], [-38, 1], [8, .8, true], [-160, .75], [-60, .7, true], [-110, .7]]],
    [-1.06, 1.0, [[-60, .7], [-10, .75, true], [30, .65]]],
    [-.5, 1.48, [[-40, .7], [10, .75, true]]],
    [.34, 1.5, [[-30, .7], [20, .75, true], [70, .65]]],
    [1.0, 1.0, [[10, .7, true], [50, .75], [100, .65]]],
    [1.48, .62, [[-8, .75, true], [36, .95], [84, .85], [130, .75, true], [60, .7]]],
    [-1.8, -.1, [[-120, .7], [-80, .75, true]]],
    [-1.8, -.72, [[-150, .8, true], [-106, .95], [-58, .9], [-20, .7, true]]],
    [1.8, -.2, [[80, .7, true], [120, .75]]],
    [1.8, -.78, [[28, .8, true], [72, 1], [118, .9], [160, .7, true]]],
    [-1.26, -1.4, [[-104, .8], [-156, .72, true], [-60, .7]]],
    [-.4, -1.48, [[-130, .6, true], [-170, .65]]]
  ];
  for (const [x, y, leaves] of vines) g.add(at(vine(rand, leaves), x, y, .42 + (Math.abs(y) > 1.3 ? .08 : 0)));

  // Flag on the right.
  g.add(at(mesh(new THREE.CylinderGeometry(.035, .042, 2.8, 8), plain("#8a4a2f", .7)), 1.95, .2, -.1));
  g.add(at(mesh(new THREE.SphereGeometry(.08, 14, 10), plain("#e2a93e", .3, .6)), 1.95, 1.64, -.1));
  const cloth = new THREE.PlaneGeometry(.7, .64, 10, 5);
  cloth.translate(.35, 0, 0);
  const cp = cloth.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    cp.setZ(i, Math.sin(x * 9) * .08 * (x / .7 + .2));
    cp.setY(i, cp.getY(i) - x * .12 + Math.sin(x * 9 + 1) * .02);
  }
  g.add(at(mesh(facet(cloth, tone(["#e4473c", "#dc3f38", "#ea5142"], .04), rand), surface({ grain: [3, 30, 3], albedo: .06, bump: .3, roughness: .8, side: THREE.DoubleSide })), 1.98, 1.22, -.1));
  const emblem = new THREE.ExtrudeGeometry(crownShape(.3, .25), { depth: .012, bevelEnabled: false });
  g.add(at(mesh(facet(emblem, GOLD, rand), goldMat), 2.24, 1.02, .02));
  return g;
}

function island(rand: Rand) {
  const g = new THREE.Group();
  const N = 30, RX = 2.68, RZ = 1.56;
  const edge = Array.from({ length: N }, () => 1 + (rand() - .5) * .16);
  const rings = [
    { r: 0, y: .1, n: 0, band: 0 }, { r: .36, y: .085, n: .03, band: 0 }, { r: .68, y: .06, n: .03, band: 0 }, { r: .9, y: .03, n: .02, band: 0 }, { r: 1, y: 0, n: 0, band: 0 },
    { r: 1.025, y: -.17, n: 0, band: 1 }, { r: .97, y: -.22, n: 0, band: 2 }, { r: .95, y: -.46, n: .04, band: 2 },
    { r: .9, y: -.78, n: .08, band: 3 }, { r: .72, y: -1.14, n: .14, band: 3 }, { r: .4, y: -1.46, n: .12, band: 3 }, { r: 0, y: -1.68, n: 0, band: 3 }
  ];
  const points = rings.map((ring, ri) => Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2;
    const tooth = ri === 5 ? (i % 2 ? -.13 : .02) : 0;
    const m = edge[i] * (1 + (rand() - .5) * ring.n * 2);
    return new THREE.Vector3(Math.cos(angle) * ring.r * RX * m, ring.y + tooth + (rand() - .5) * ring.n, Math.sin(angle) * ring.r * RZ * m);
  }));
  const positions: number[] = [], bands: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, band: number) => { positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); bands.push(band); };
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = points[r][i], b = points[r][j], c = points[r + 1][i], d = points[r + 1][j];
      const band = rings[r + 1].band;
      if (rings[r].r === 0) tri(a, d, c, band);
      else if (rings[r + 1].r === 0) tri(a, b, c, band);
      else { tri(a, b, c, band); tri(b, d, c, band); }
    }
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  let index = 0;
  const sand = C("#dcc879"), soil = tone(["#6e3f2b", "#7a4630", "#643828"], .05);
  const painted = facet(body, (m, n, r) => {
    const band = bands[index++];
    if (band === 0) return Math.abs(m.x - m.z * .12) < .34 && m.z > .2 && m.z < 1.3 ? sand.clone().offsetHSL(0, 0, (r - .5) * .06) : GRASS(m, n, r);
    if (band === 1) return GRASS_LIP(m, n, r);
    if (band === 2) return soil(m, n, r);
    return rockPaint(m, n, r);
  }, rand);
  g.add(mesh(painted, grassMat));

  // Hanging rock with a deep central mass.
  let key = 200;
  for (const [x, z, r, h] of [[-1.95, .5, .54, 1.1], [-1.25, .95, .68, 1.7], [-.4, 1.05, .62, 1.45], [1.3, .9, .58, 1.5], [2.05, .45, .52, 1.1], [.35, -.3, .82, 2.1], [-.85, -.5, .64, 1.5], [1.3, -.5, .58, 1.3], [.45, .75, .5, 1.9]]) {
    const cone = new THREE.ConeGeometry(r, h, 6, 3);
    cone.rotateX(Math.PI);
    g.add(at(mesh(facet(jitter(cone, .09, key++), rockPaint, rand), rockMat), x, -.6 - h / 2, z));
  }
  // Grass ledges beside the waterfall.
  for (const [x, y, z, s] of [[1.25, -.92, 1.24, 1], [-.1, -1.05, 1.2, .8]]) {
    const ledge = rock(.3, key++, (m, n, r) => (n.y > .45 ? GRASS(m, n, r) : rockPaint(m, n, r).multiplyScalar(1.3)), rand);
    ledge.scale.set(1.5 * s, .7 * s, 1 * s);
    g.add(at(ledge, x, y, z));
  }
  // Pebbles and tufts on the grass.
  for (const [x, z, s] of [[-2.15, .2, .1], [.95, 1.12, .08], [-.6, 1.25, .07], [2.25, -.2, .09], [-.15, -.85, .08]]) {
    const pebble = rock(s, key++, stonePaint, rand, stoneMat, 0, .3);
    pebble.scale.y = .6;
    g.add(at(pebble, x, .07, z));
  }
  for (const [x, z, s] of [[-2.1, .55, 1], [-1.02, 1.02, .8], [-.36, 1.08, .9], [.52, 1.15, .8], [.95, .95, 1], [2.25, .5, .8], [-1.9, -.4, 1], [2, -.5, 1], [.1, .5, .7], [-.2, -.9, .9], [1.0, -.95, .9], [-2.35, .9, .9], [2.4, .95, .9]]) {
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.ConeGeometry(.045, .15 + rand() * .1, 3);
      const tuft = mesh(facet(blade, k === 1 ? GRASS : GRASS_LIP, rand), grassMat);
      tuft.position.set(x + (k - 1) * .07, .1, z + (rand() - .5) * .06);
      tuft.rotation.z = (k - 1) * -.25;
      tuft.scale.setScalar(s);
      g.add(tuft);
    }
  }
  return g;
}

function sword(rand: Rand) {
  const g = new THREE.Group();
  const blade = new THREE.CylinderGeometry(.095, .095, 1.15, 4, 1);
  blade.scale(1, 1, .28);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) if (bp.getY(i) < 0) bp.setX(i, bp.getX(i) * .55);
  const steel = surface({ grain: [20, 2, 20], albedo: .04, bump: .2, roughness: .25, metalness: .6 });
  steel.userData.reflective = true;
  g.add(at(mesh(facet(blade, tone(["#eef1f9", "#dfe4f0"], .02), rand), steel), 0, .52, 0));
  const guard = new THREE.BoxGeometry(.66, .1, .14, 4, 1, 1);
  const gp = guard.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, gp.getY(i) + (gp.getX(i) / .33) ** 2 * .04);
  g.add(at(mesh(facet(guard, GOLD, rand), goldMat), 0, 1.1, 0));
  for (const x of [-.34, .34]) g.add(at(mesh(new THREE.SphereGeometry(.072, 12, 8), plain("#f6bd3c", .3, .6)), x, 1.15, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(.045, .05, .27, 8), plain("#7a3f2a", .8)), 0, 1.29, 0));
  for (const y of [1.21, 1.28, 1.35]) {
    const ring = mesh(new THREE.TorusGeometry(.05, .013, 5, 10), plain("#a85f37", .7));
    ring.rotation.x = Math.PI / 2;
    g.add(at(ring, 0, y, 0));
  }
  g.add(at(mesh(new THREE.SphereGeometry(.088, 14, 10), plain("#f6bd3c", .3, .6)), 0, 1.47, 0));
  g.rotation.set(-.1, .25, .27);
  return g;
}

function die() {
  const g = new THREE.Group();
  const ivory = surface({ vertexColors: false, color: "#faf6f0", flat: false, roughness: .42, albedo: .02, bump: .1 });
  g.add(mesh(new RoundedBoxGeometry(.52, .52, .52, 4, .08), ivory));
  const pipMat = new THREE.MeshStandardMaterial({ color: "#2b2238", roughness: .5 });
  const pip = (face: "top" | "front" | "right", u: number, v: number) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(.052, 16), pipMat);
    p.receiveShadow = true;
    const d = .2606;
    if (face === "top") { p.rotation.x = -Math.PI / 2; p.position.set(u, d, v); }
    if (face === "front") p.position.set(u, v, d);
    if (face === "right") { p.rotation.y = Math.PI / 2; p.position.set(d, v, -u); }
    g.add(p);
  };
  const s = .14;
  [[-s, -s], [0, 0], [s, s]].forEach(([u, v]) => pip("top", u, v));
  [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]].forEach(([u, v]) => pip("front", u, v));
  [[-s, s], [s, -s]].forEach(([u, v]) => pip("right", u, v));
  g.rotation.set(.04, -.6, .03);
  return g;
}

function chest(rand: Rand) {
  const g = new THREE.Group();
  const gold = (geo: THREE.BufferGeometry) => mesh(facet(geo, GOLD, rand), goldMat);
  const W = 1.12, H = .5, D = .68;
  // Body: planks with dark seams.
  for (let k = 0; k < 3; k++) {
    const plank = mesh(facet(jitter(new THREE.BoxGeometry(W, H / 3 - .012, D, 6, 1, 2), .008, 400 + k), CHEST_WOOD, rand), chestWoodMat);
    g.add(at(plank, 0, H / 6 + k * H / 3, 0));
  }
  g.add(at(mesh(new THREE.BoxGeometry(W - .02, H, D - .02), plain("#3a1d10", .9)), 0, H / 2, 0));
  for (const z of [-D / 2, D / 2]) {
    g.add(at(gold(new THREE.BoxGeometry(W + .08, .09, .07)), 0, H - .02, z));
    g.add(at(gold(new THREE.BoxGeometry(W + .08, .07, .07)), 0, .03, z));
    for (const x of [-W / 2, W / 2, -.18, .18]) g.add(at(gold(new THREE.BoxGeometry(Math.abs(x) > .3 ? .1 : .07, H, .09)), x, H / 2, z));
  }
  for (const x of [-W / 2, W / 2]) g.add(at(gold(new THREE.BoxGeometry(.07, .09, D + .04)), x, H - .02, 0));
  g.add(at(gold(new THREE.BoxGeometry(.2, .24, .07)), 0, H - .14, D / 2 + .03));
  g.add(at(mesh(new THREE.CircleGeometry(.032, 12), plain("#4a2412", .8)), 0, H - .14, D / 2 + .068));

  // Treasure: a glowing mound of coins and a few gems.
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb02a").multiplyScalar(1.35) });
  const mound = new THREE.SphereGeometry(.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  mound.scale(1, .32, .62);
  g.add(at(new THREE.Mesh(mound, hot), 0, H - .03, 0));
  const coinMat = plain("#ffcf4a", .28, .7);
  coinMat.emissive = new THREE.Color("#d88a1c");
  coinMat.emissiveIntensity = .35;
  for (let i = 0; i < 26; i++) {
    const coin = mesh(new THREE.CylinderGeometry(.085, .085, .03, 12), coinMat);
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * .4;
    coin.position.set(Math.cos(a) * r, H + .1 - r * .22 + rand() * .04, Math.sin(a) * r * .55);
    coin.rotation.set((rand() - .5) * 1.2, 0, (rand() - .5) * 1.2);
    g.add(coin);
  }
  for (const [x, z, hex] of [[-.22, .1, "#ff4f6d"], [.24, -.05, "#47c6ff"], [.05, .18, "#7dff7a"]] as const) {
    const gem = mesh(new THREE.OctahedronGeometry(.06), new THREE.MeshStandardMaterial({ color: hex, roughness: .15, emissive: hex, emissiveIntensity: .45, flatShading: true }));
    g.add(at(gem, x, H + .14, z));
  }

  // Open lid, hinged at the back: a curved shell lit from inside by the treasure, with gold straps and rim.
  const lid = new THREE.Group();
  const shell = (r: number, length: number, open = false) => {
    const c = new THREE.CylinderGeometry(r, r, length, 10, 1, open, 0, Math.PI);
    c.rotateZ(Math.PI / 2);
    c.translate(0, 0, D / 2);
    return c;
  };
  lid.add(mesh(facet(shell(D / 2, W), CHEST_WOOD, rand), surface({ grain: [1.5, 22, 22], albedo: .2, bump: .6, roughness: .7 })));
  // The inside of the lid: darker wood, seen when it stands open.
  lid.add(mesh(facet(shell(D / 2 - .012, W - .01), tone(["#5c2f17", "#532a14"], .04), rand), surface({ grain: [1.5, 22, 22], albedo: .15, bump: .5, roughness: .8, side: THREE.BackSide })));
  for (const x of [-W / 2 + .05, -.18, .18, W / 2 - .05]) {
    const strap = mesh(facet(shell(D / 2 + .016, .08, true), GOLD, rand), goldOutside);
    strap.position.x = x;
    lid.add(strap);
  }
  lid.add(at(gold(new THREE.BoxGeometry(W + .08, .06, .07)), 0, 0, D));
  lid.position.set(0, H, -D / 2);
  lid.rotation.x = -2.05;
  g.add(lid);

  const light = new THREE.PointLight("#ffc65a", 2.2, 3, 2);
  light.position.set(0, H + .35, .2);
  g.add(light);

  // Sparkle above the treasure, facing the camera.
  const star = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? .07 : i % 4 ? .2 : .36, a = (i / 16) * Math.PI * 2 + Math.PI / 2;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const burst = new THREE.Mesh(new THREE.ShapeGeometry(star), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff6c8").multiplyScalar(2.6) }));
  burst.position.set(-.02, H + .34, .1);
  burst.userData.billboard = true;
  g.add(burst);
  g.rotation.y = -.24;
  return g;
}

function sign(rand: Rand) {
  const g = new THREE.Group();
  const L = 2.15;
  const bend = (geo: THREE.BufferGeometry) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (x / L) ** 2;
      p.setZ(i, p.getZ(i) - .42 * t);
      p.setY(i, p.getY(i) + .11 * (1 - t) + .02 * Math.sin(x * 2.1));
    }
    return geo;
  };
  // Plank outline with ragged, cut ends; tall enough for the motto in two lines.
  const outline: Array<[number, number]> = [
    [-L, -.28], [-L - .05, .02], [-L + .02, .34], [-L + .2, .46], [L - .2, .46], [L - .03, .35], [L + .06, .04], [L - .02, -.3], [L - .22, -.45], [-L + .2, -.45]
  ];
  const plankShape = polygonShape(outline);
  const plank = new THREE.ExtrudeGeometry(plankShape, { depth: .1, bevelEnabled: true, bevelThickness: .035, bevelSize: .03, bevelSegments: 2, curveSegments: 2, steps: 1 });
  // Subdivide along x so the bend stays smooth: rebuild from many vertical strips.
  const strips = new THREE.BufferGeometry().copy(plank);
  const tessellated = tessellateX(strips, 40);
  g.add(mesh(facet(jitter(bend(tessellated), .006, 500), (m, n, r) => WOOD(m, n, r).multiplyScalar(n.z > .8 ? 1 : n.y > .3 ? 1.15 : .78), rand), woodMat));
  // Dark backing as the outline.
  const back = new THREE.ExtrudeGeometry(plankShape, { depth: .06, bevelEnabled: true, bevelThickness: .01, bevelSize: .045, bevelOffset: .02, bevelSegments: 1 });
  back.translate(0, -.015, -.05);
  g.add(mesh(bend(tessellateX(back, 40)), plain("#4a2a17", .9)));
  // Engraved motto: „Play like The GoldenSchmidt“ above „Be like The GoldenSchmidt“.
  for (const [line, baseline] of [[MOTTO_PLAY, .07], [MOTTO_BE, -.26]] as const) {
    const text = extrudeText(line, { depth: 4, bevelEnabled: true, bevelThickness: .6, bevelSize: .5, bevelSegments: 1, curveSegments: 4 });
    text.scale(.0026, .0026, .0026);
    text.translate(0, baseline, .136);
    bend(tessellateX(text, 0));
    text.computeVertexNormals();
    g.add(mesh(text, plain("#43240f", .85)));
  }
  return g;
}

/** Splits long triangles along x so later bending stays smooth. `pieces` 0 leaves the geometry as is. */
function tessellateX(source: THREE.BufferGeometry, pieces: number) {
  if (!pieces) return source;
  const g = source.index ? source.toNonIndexed() : source;
  const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
  const limit = (box.max.x - box.min.x) / pieces;
  let tris: THREE.Vector3[][] = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) tris.push([0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(p, i + k)));
  for (let pass = 0; pass < 8; pass++) {
    const next: THREE.Vector3[][] = [];
    let split = false;
    for (const t of tris) {
      const edges = [[0, 1], [1, 2], [2, 0]].map(([a, b]) => ({ a, b, len: Math.abs(t[a].x - t[b].x) }));
      const longest = edges.reduce((m, e) => (e.len > m.len ? e : m));
      if (longest.len <= limit) { next.push(t); continue; }
      split = true;
      const c = 3 - longest.a - longest.b;
      const mid = t[longest.a].clone().lerp(t[longest.b], .5);
      next.push([t[longest.a], mid, t[c]], [mid, t[longest.b], t[c]]);
    }
    tris = next;
    if (!split) break;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(tris.flatMap(t => t.flatMap(v => [v.x, v.y, v.z])), 3));
  out.computeVertexNormals();
  return out;
}

function waterfall() {
  // A sheet that curls over the island lip and falls, with foam streaks; unlit so it stays luminous.
  const rows = 24, cols = 8, width = .5;
  const pos: number[] = [], col: number[] = [], index: number[] = [];
  const foam = C("#f4fcff"), high = C("#9fe2ff"), low = C("#3f93e2");
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const curl = Math.min(1, t * 6);
    const y = t < 1 / 6 ? .1 * Math.sin(curl * Math.PI / 2) - .02 : -(t - 1 / 6) * 2.3;
    const z = t < 1 / 6 ? Math.sin(curl * Math.PI / 2) * .12 : .12 + (t - 1 / 6) * .14;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols - .5;
      pos.push(u * width * (1 + t * .35), y, z + Math.sin(u * 9) * .015);
      const streak = i % 3 === 1 ? .8 : 0;
      const c = high.clone().lerp(low, Math.min(1, t * 1.25)).lerp(foam, streak * (1 - t * .6));
      col.push(c.r * 1.25, c.g * 1.25, c.b * 1.25, t > .66 ? Math.max(0, 1 - (t - .66) / .34) : 1);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(index);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
}

/** The hero is rendered as five layers that line up exactly, so the page can bring them in one by one. */
export type HeroPart = "island" | "plaque" | "golden" | "schmidt" | "games";
export const HERO_WORDS = ["golden", "schmidt", "games"] as const;

/**
 * island: ground, props, sign and waterfall; the plaque stays in the scene as a holdout, so it still casts
 * its shadow and cuts out whatever lies behind it. plaque: the stone frame with crown, vines and flag.
 * golden, schmidt, games: one word each.
 */
export function buildHero(part: HeroPart) {
  const rand = seeded(20261112);
  const scene = new THREE.Scene();
  const ground: THREE.Object3D[] = [island(rand)];

  const logo = plaque(rand);
  logo.scale.setScalar(.9);
  logo.position.set(0, 2.2, -.4);
  logo.rotation.x = -.06;
  scene.add(logo);

  const stone = mesh(facet(jitter(new THREE.IcosahedronGeometry(.36, 1), .08, 600), stonePaint, rand), stoneMat);
  stone.scale.set(1.2, .55, .95);
  ground.push(at(stone, -1.42, .1, .52), at(sword(rand), -1.4, .1, .52), at(die(), -.74, .3, .66), at(chest(rand), 1.5, .04, .38),
    at(sign(rand), 0, -.58, 1.74), at(waterfall(), .64, -.22, 1.62));
  if (part === "island") scene.add(...ground);

  const words = HERO_WORDS.map(name => logo.getObjectByName(name)!);
  if (part === "island" || part === "plaque") words.forEach(w => logo.remove(w));
  else logo.children.filter(child => child.name !== part).forEach(child => logo.remove(child));
  if (part === "island") logo.traverse(o => { o.userData.holdout = true; });
  return scene;
}
