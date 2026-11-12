// Probe: the start screen island as a lit 3D scene. Baked to an image, never loaded by the app.
// Units: 1 = 100 units of the island SVG; the grass surface is y = 0, the camera looks along -z.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { LOGO_GAMES, LOGO_GOLDEN, LOGO_SCHMIDT } from "../../src/components/homeLogoPaths";
import { MOTTO } from "./motto";

type Rand = () => number;
type Paint = (centre: THREE.Vector3, normal: THREE.Vector3, r: number) => THREE.Color;

function seeded(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, z: number, k: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

/** Moves vertices by position-keyed noise, so vertices that coincide stay together. */
function jitter<T extends THREE.BufferGeometry>(geometry: T, amount: number, key = 0): T {
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 500), y = Math.round(p.getY(i) * 500), z = Math.round(p.getZ(i) * 500);
    p.setXYZ(i,
      p.getX(i) + (hash(x, y, z, key) - .5) * 2 * amount,
      p.getY(i) + (hash(x, y, z, key + 1) - .5) * 2 * amount,
      p.getZ(i) + (hash(x, y, z, key + 2) - .5) * 2 * amount);
  }
  return geometry;
}

/** One colour per triangle: the hand-cut facet look. */
function facet(source: THREE.BufferGeometry, paint: Paint, rand: Rand) {
  const g = source.index ? source.toNonIndexed() : source;
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    m.copy(a).add(b).add(c).divideScalar(3);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize();
    const col = paint(m, n, rand());
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (i + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.deleteAttribute("normal");
  g.computeVertexNormals();
  return g;
}

const C = (hex: string) => new THREE.Color(hex);
const tmp = new THREE.Color();
/** A material tone that wanders a little from facet to facet. */
function tone(hexes: string[], spread = .05): Paint {
  const set = hexes.map(C);
  return (_m, _n, r) => {
    const base = set[Math.floor(r * set.length) % set.length];
    return tmp.copy(base).offsetHSL(0, 0, ((r * 7.13) % 1 - .5) * spread).clone();
  };
}

const matte = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, metalness: 0 });
const sheen = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .38, metalness: 0 });
const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .7, side: THREE.DoubleSide });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material = matte) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function solid(geometry: THREE.BufferGeometry, hex: string, roughness = .8) {
  return mesh(geometry, new THREE.MeshStandardMaterial({ color: hex, flatShading: true, roughness }));
}
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

const STONE = tone(["#a096a6", "#958a9b", "#aba1b0", "#8b8093"], .06);
const stonePaint: Paint = (m, n, r) => (n.y > .7 && r < .3 ? C("#a3ad52") : STONE(m, n, r));
const ROCK = tone(["#b9774f", "#a8694a", "#9b5c42", "#8c513e"], .07);
const rockPaint: Paint = (m, n, r) => ROCK(m, n, r).multiplyScalar(THREE.MathUtils.clamp(1.1 + m.y * .16, .78, 1.12));
const GRASS = tone(["#a9dc42", "#98d43c", "#86cc38", "#7cc232"], .05);
const GRASS_LIP = tone(["#4f9a2e", "#3f8f2f", "#58a632"], .05);
const WOOD = tone(["#dfa468", "#dba062", "#e3a96e"], .025);
const CHEST_WOOD = tone(["#9a5526", "#8a4a22", "#a35d2c"], .06);
const GOLD = tone(["#ffc83d", "#f6b93a", "#ffd257"], .04);

function rock(radius: number, key: number, paint: Paint, rand: Rand, detail = 1, rough = .22) {
  return mesh(facet(jitter(new THREE.IcosahedronGeometry(radius, detail), radius * rough, key), paint, rand));
}

/** A stone with chamfered edges, lying along x. */
function block(w: number, h: number, d: number, key: number, rand: Rand, paint: Paint = stonePaint) {
  const bevel = Math.min(w, h, d) * .16;
  const shape = new THREE.Shape();
  const x = w / 2 - bevel, y = h / 2 - bevel;
  shape.moveTo(-x, -y); shape.lineTo(x, -y); shape.lineTo(x, y); shape.lineTo(-x, y); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return mesh(facet(jitter(g, .022, key), paint, rand));
}

function shapesOf(d: string) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap(path => path.toShapes(true));
}

/** Extrudes outline text (y down, baseline 0) into y-up geometry centred on x. */
function extrudeText(word: { width: number; d: string }, options: THREE.ExtrudeGeometryOptions) {
  const g = new THREE.ExtrudeGeometry(shapesOf(word.d), { curveSegments: 6, bevelSegments: 2, ...options });
  g.deleteAttribute("uv");
  g.scale(1, -1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1);
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    p.setXYZ(i + 2, x, y, z);
  }
  g.translate(-word.width / 2, 0, 0);
  g.clearGroups();
  return g;
}

function bendUp(g: THREE.BufferGeometry, half: number, rise: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + rise * (1 - (p.getX(i) / half) ** 2));
  return g;
}

/** Carved lettering: lit face with a vertical gradient, darker walls, and a dark backing as outline. */
function lettering(word: { width: number; d: string }, scale: number, rise: number, face: [string, string], wall: string, rim: string, outline: string) {
  const group = new THREE.Group();
  const front = bendUp(extrudeText(word, { depth: 26, bevelEnabled: true, bevelThickness: 7, bevelSize: 4.5 }), word.width / 2, rise);
  front.computeVertexNormals();
  const p = front.attributes.position, n = front.attributes.normal;
  const top = C(face[0]), bottom = C(face[1]), side = C(wall), light = C(rim);
  const colors = new Float32Array(p.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const nz = n.getZ(i), ny = n.getY(i);
    const t = THREE.MathUtils.clamp((p.getY(i) - rise * (1 - (p.getX(i) / (word.width / 2)) ** 2)) / 71, 0, 1);
    if (nz > .9) col.copy(bottom).lerp(top, t);
    else if (nz > .25) col.copy(ny > .2 ? light : ny < -.2 ? side : bottom).lerp(top, ny > .2 ? .3 : 0);
    else col.copy(side);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  front.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  group.add(mesh(front, sheen));
  const back = bendUp(extrudeText(word, { depth: 12, bevelEnabled: true, bevelThickness: 2, bevelSize: 2, bevelOffset: 6.5 }), word.width / 2, rise);
  back.computeVertexNormals();
  const backing = solid(back, outline, .7);
  backing.position.z = -4;
  group.add(backing);
  group.scale.setScalar(scale);
  return group;
}

function leaf(rand: Rand, dark: boolean) {
  const base = [0, 0, 0], tip = [0, .4, 0], left = [-.12, .13, -.03], right = [.12, .13, -.03], ridge = [0, .15, .05];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...base, ...ridge, ...left, ...left, ...ridge, ...tip, ...base, ...right, ...ridge, ...ridge, ...right, ...tip], 3));
  const lights = dark ? ["#5aa62f", "#4f9a2e"] : ["#a4dc44", "#93d23c"];
  const darks = dark ? ["#2f6f29", "#357a2b"] : ["#4f9a2e", "#58a632"];
  return mesh(facet(g, (m, _n, r) => C((m.x < 0 ? lights : darks)[r < .5 ? 0 : 1]), rand), leafMat);
}

function vine(rand: Rand, turns: Array<[number, number, boolean?]>) {
  const group = new THREE.Group();
  for (const [turn, size, dark] of turns) {
    const l = leaf(rand, Boolean(dark));
    l.rotation.set((rand() - .3) * .7, (rand() - .5) * .8, THREE.MathUtils.degToRad(-turn));
    l.scale.setScalar(size);
    l.position.set((rand() - .5) * .1, (rand() - .5) * .1, rand() * .06);
    group.add(l);
  }
  return group;
}

function crownShape(w: number, h: number) {
  const s = new THREE.Shape();
  const pts: Array<[number, number]> = [[-.5, 0], [.5, 0], [.54, .62], [.3, .32], [0, .82], [-.3, .32], [-.54, .62]];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x * w, y * h) : s.moveTo(x * w, y * h)));
  s.closePath();
  return s;
}

function plaque(rand: Rand) {
  const g = new THREE.Group();

  // Carved slab behind the lettering.
  const half: Array<[number, number]> = [[.56, 1.27], [.75, .82], [1.34, .56], [1.58, .25], [1.6, -.5], [1.54, -.92]];
  const slab = new THREE.Shape();
  [...half, ...half.map(([x, y]) => [-x, y] as [number, number]).reverse()].forEach(([x, y], i) => (i ? slab.lineTo(x, y) : slab.moveTo(x, y)));
  slab.closePath();
  const slabGeo = new THREE.ExtrudeGeometry(slab, { depth: .2, bevelEnabled: false });
  slabGeo.translate(0, 0, -.22);
  g.add(mesh(facet(slabGeo, tone(["#3d3040", "#38293a", "#423446"], .03), rand)));

  // Ring of stones along the slab edge.
  const line: Array<[number, number]> = [[-.53, 1.35], [.53, 1.35], [.84, .86], [1.42, .6], [1.67, .28], [1.7, -.49], [1.64, -.92]];
  const counts = [2, 1, 1, 1, 2, 1];
  let key = 10;
  for (const mirror of [1, -1]) {
    for (let i = mirror === 1 ? 0 : 1; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const length = Math.hypot(bx - ax, by - ay), angle = Math.atan2(by - ay, bx - ax);
      for (let k = 0; k < counts[i]; k++) {
        const t = (k + .5) / counts[i];
        const stone = block(length / counts[i] + .1, .37 + rand() * .06, .56 + rand() * .08, key++, rand);
        stone.position.set((ax + (bx - ax) * t) * mirror, ay + (by - ay) * t, rand() * .03);
        stone.rotation.z = mirror === 1 ? angle : Math.PI - angle;
        g.add(stone);
      }
    }
    // Corner stones cover the joints.
    for (const [x, y] of [line[1], line[3], line[5]]) {
      const corner = block(.48, .48, .66, key++, rand);
      corner.position.set(x * mirror, y, .02);
      corner.rotation.z = rand() * .6;
      g.add(corner);
      const rivet = solid(new THREE.SphereGeometry(.06, 10, 8), "#6a6f93", .35);
      (rivet.material as THREE.MeshStandardMaterial).flatShading = false;
      rivet.position.set(x * mirror, y, .37);
      g.add(rivet);
    }
  }
  // Bottom beam.
  for (let i = 0; i < 4; i++) {
    const stone = block(.99, .5 + rand() * .04, .66 + rand() * .06, key++, rand);
    stone.position.set(-1.44 + i * .96, -1.15, .04);
    g.add(stone);
  }
  for (const x of [-1.62, 1.62]) {
    const rivet = solid(new THREE.SphereGeometry(.06, 10, 8), "#6a6f93", .35);
    (rivet.material as THREE.MeshStandardMaterial).flatShading = false;
    g.add(at(rivet, x, -1.2, .4));
  }

  // Rock hanging below.
  for (const [x, y, r, h] of [[-.95, -1.6, .46, .7], [-.3, -1.66, .52, 1], [.42, -1.64, .48, .82], [1, -1.56, .42, .58]]) {
    const cone = new THREE.ConeGeometry(r, h, 6, 2);
    cone.rotateX(Math.PI);
    g.add(at(mesh(facet(jitter(cone, .07, key++), rockPaint, rand)), x, y - h * .2, -.02));
  }

  // Crown and lettering.
  const crown = new THREE.ExtrudeGeometry(crownShape(.66, .5), { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .02, bevelSegments: 1 });
  g.add(at(mesh(facet(crown, GOLD, rand), sheen), 0, .66, 0));
  const band = block(.62, .1, .2, key++, rand, tone(["#e09a22", "#d98a1e"], .03));
  band.material = sheen;
  g.add(at(band, 0, .64, .08));

  g.add(at(lettering(LOGO_GOLDEN, .0066, 7, ["#ffe680", "#f8a01f"], "#c8661a", "#fff3b0", "#3a1c10"), 0, 0, 0));
  g.add(at(lettering(LOGO_SCHMIDT, .00655, 4, ["#ffe680", "#f8a01f"], "#c8661a", "#fff3b0", "#3a1c10"), 0, -.52, .03));
  g.add(at(lettering(LOGO_GAMES, .0047, 0, ["#ffffff", "#b9b4d6"], "#77729c", "#ffffff", "#262036"), 0, -.9, .06));

  // Vines at the corners.
  g.add(at(vine(rand, [[-128, 1.1, true], [-84, 1.3], [-38, 1.35], [8, 1.05, true], [-160, 1], [-60, .9, true]]), -1.46, .56, .4));
  g.add(at(vine(rand, [[-8, 1, true], [36, 1.25], [84, 1.1], [130, .95, true], [60, .85]]), 1.44, .64, .4));
  g.add(at(vine(rand, [[-150, 1.05, true], [-106, 1.25], [-58, 1.15], [-20, .9, true]]), -1.76, -.7, .38));
  g.add(at(vine(rand, [[28, 1.05, true], [72, 1.3], [118, 1.15], [160, .9, true]]), 1.76, -.76, .38));
  g.add(at(vine(rand, [[70, 1], [122, 1.1], [168, .9, true], [30, .8, true]]), 1.2, -1.4, .46));
  g.add(at(vine(rand, [[-104, 1], [-156, .92, true], [-60, .85]]), -1.24, -1.4, .46));
  g.add(at(vine(rand, [[-30, .8], [20, .9, true], [70, .75]]), .2, 1.5, .3));

  // Flag on the right.
  const pole = solid(new THREE.CylinderGeometry(.035, .04, 2.75, 6), "#8a4a2f");
  g.add(at(pole, 1.93, .2, -.1));
  g.add(at(solid(new THREE.SphereGeometry(.075, 10, 8), "#c98a3a", .4), 1.93, 1.62, -.1));
  const cloth = new THREE.PlaneGeometry(.66, .62, 8, 4);
  cloth.translate(.33, 0, 0);
  const cp = cloth.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i);
    cp.setZ(i, Math.sin(x * 9.5) * .07 * (x / .66 + .2));
    cp.setY(i, cp.getY(i) - x * .1);
  }
  const flag = mesh(facet(cloth, tone(["#e4473c", "#dc3f38", "#ea5142"], .04), rand), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .75, side: THREE.DoubleSide }));
  g.add(at(flag, 1.96, 1.2, -.1));
  const emblem = mesh(facet(new THREE.ShapeGeometry(crownShape(.3, .24)), GOLD, rand), sheen);
  g.add(at(emblem, 2.22, 1.04, .0));
  return g;
}

function island(rand: Rand) {
  const g = new THREE.Group();
  const N = 28, RX = 2.62, RZ = 1.52;
  const edge = Array.from({ length: N }, () => 1 + (rand() - .5) * .16);
  const rings = [
    { r: 0, y: .1, n: 0, band: 0 }, { r: .36, y: .085, n: .03, band: 0 }, { r: .68, y: .06, n: .03, band: 0 }, { r: .9, y: .03, n: .02, band: 0 }, { r: 1, y: 0, n: 0, band: 0 },
    { r: 1.02, y: -.2, n: 0, band: 1 }, { r: .95, y: -.24, n: 0, band: 2 },
    { r: .93, y: -.62, n: .08, band: 3 }, { r: .74, y: -1.05, n: .14, band: 3 }, { r: .4, y: -1.4, n: .12, band: 3 }, { r: 0, y: -1.62, n: 0, band: 3 }
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
  const sand = C("#d6c46a");
  const painted = facet(body, (m, n, r) => {
    const band = bands[index++];
    if (band === 0) return Math.abs(m.x) < .36 - m.z * .08 && m.z > .15 && m.z < 1.2 ? sand.clone().offsetHSL(0, 0, (r - .5) * .05) : GRASS(m, n, r);
    if (band === 1) return GRASS_LIP(m, n, r);
    if (band === 2) return C("#2f6f29");
    return rockPaint(m, n, r);
  }, rand);
  // Faces were wound for a view from outside and above; flip those that point inward.
  g.add(mesh(painted, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .9, side: THREE.DoubleSide })));

  // Hanging rock.
  let key = 200;
  for (const [x, z, r, h] of [[-1.9, .5, .52, 1.1], [-1.2, .95, .66, 1.6], [-.35, 1.05, .6, 1.3], [1.25, .9, .56, 1.4], [2, .45, .5, 1.1], [.4, -.3, .76, 1.8], [-.85, -.5, .6, 1.3], [1.25, -.5, .55, 1.2]]) {
    const cone = new THREE.ConeGeometry(r, h, 6, 2);
    cone.rotateX(Math.PI);
    g.add(at(mesh(facet(jitter(cone, .09, key++), rockPaint, rand)), x, -.5 - h / 2, z));
  }
  // Grass ledge beside the waterfall.
  const ledge = rock(.3, key++, (m, n, r) => (n.y > .45 ? GRASS(m, n, r) : rockPaint(m, n, r).multiplyScalar(1.4)), rand);
  ledge.scale.set(1.5, .7, 1);
  g.add(at(ledge, 1.22, -.86, 1.22));

  // Tufts.
  for (const [x, z, s] of [[-2.1, .55, 1], [-1.02, 1.02, .8], [-.36, .98, .9], [.52, 1.1, .8], [.92, .92, 1], [2.25, .5, .8], [-1.9, -.4, 1], [2, -.5, 1], [.1, .5, .7], [-.2, -.9, .9], [1.0, -.95, .9]]) {
    for (let k = 0; k < 3; k++) {
      const blade = new THREE.ConeGeometry(.045, .14 + rand() * .1, 3);
      const tuft = mesh(facet(blade, k === 1 ? GRASS : GRASS_LIP, rand));
      tuft.position.set(x + (k - 1) * .07, .09, z + (rand() - .5) * .06);
      tuft.rotation.z = (k - 1) * -.25;
      tuft.scale.setScalar(s);
      g.add(tuft);
    }
  }
  return g;
}

function sword(rand: Rand) {
  const g = new THREE.Group();
  const blade = new THREE.CylinderGeometry(.09, .09, 1.1, 4, 1);
  blade.scale(1, 1, .3);
  g.add(at(mesh(facet(blade, tone(["#eef1f9", "#e4e8f3"], .02), rand), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .22 })), 0, .5, 0));
  const guard = block(.64, .1, .13, 300, rand, GOLD);
  guard.material = sheen;
  g.add(at(guard, 0, 1.08, 0));
  for (const x of [-.32, .32]) g.add(at(solid(new THREE.SphereGeometry(.07, 8, 6), "#f6bd3c", .35), x, 1.08, 0));
  g.add(at(solid(new THREE.CylinderGeometry(.045, .05, .26, 6), "#7a3f2a"), 0, 1.26, 0));
  for (const y of [1.19, 1.26, 1.33]) g.add(at(solid(new THREE.TorusGeometry(.05, .012, 4, 8), "#b0683f"), 0, y, 0)).rotation.x = Math.PI / 2;
  g.add(at(solid(new THREE.SphereGeometry(.085, 10, 8), "#f6bd3c", .3), 0, 1.44, 0));
  g.rotation.set(-.1, .25, .27);
  return g;
}

function die() {
  const g = new THREE.Group();
  const cube = mesh(new RoundedBoxGeometry(.52, .52, .52, 3, .075), new THREE.MeshStandardMaterial({ color: "#faf6f0", roughness: .45 }));
  g.add(cube);
  const pipMat = new THREE.MeshStandardMaterial({ color: "#2b2238", roughness: .5 });
  const pip = (face: "top" | "front" | "right", u: number, v: number) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(.052, 14), pipMat);
    p.receiveShadow = true;
    const d = .2605;
    if (face === "top") { p.rotation.x = -Math.PI / 2; p.position.set(u, d, v); }
    if (face === "front") p.position.set(u, v, d);
    if (face === "right") { p.rotation.y = Math.PI / 2; p.position.set(d, v, u); }
    g.add(p);
  };
  const s = .14;
  [[-s, -s], [0, 0], [s, s]].forEach(([u, v]) => pip("top", u, v));
  [[-s, -s], [s, -s], [0, 0], [-s, s], [s, s]].forEach(([u, v]) => pip("front", u, v));
  [[-s, s], [s, -s]].forEach(([u, v]) => pip("right", u, v));
  g.rotation.y = -.62;
  return g;
}

function chest(rand: Rand) {
  const g = new THREE.Group();
  const gold = (geo: THREE.BufferGeometry) => mesh(facet(geo, GOLD, rand), sheen);
  g.add(at(mesh(facet(jitter(new THREE.BoxGeometry(1.1, .48, .66, 4, 2, 2), .012, 400), CHEST_WOOD, rand)), 0, .24, 0));
  for (const z of [-.33, .33]) {
    g.add(at(gold(new THREE.BoxGeometry(1.18, .09, .07)), 0, .47, z));
    g.add(at(gold(new THREE.BoxGeometry(1.18, .07, .07)), 0, .03, z));
    for (const x of [-.55, .55]) g.add(at(gold(new THREE.BoxGeometry(.1, .5, .1)), x, .25, z));
  }
  for (const x of [-.55, .55]) g.add(at(gold(new THREE.BoxGeometry(.07, .09, .7)), x, .47, 0));
  g.add(at(gold(new THREE.BoxGeometry(.18, .22, .06)), 0, .37, .35));
  g.add(at(solid(new THREE.CircleGeometry(.03, 10), "#63301a"), 0, .37, .382));

  // Treasure: a bright bed with coins on top.
  const hot = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd35a").multiplyScalar(1.5) });
  g.add(at(new THREE.Mesh(new THREE.BoxGeometry(1, .04, .56), hot), 0, .45, 0));
  for (let i = 0; i < 12; i++) {
    const coin = mesh(new THREE.CylinderGeometry(.075, .075, .028, 10), new THREE.MeshStandardMaterial({ color: "#ffcf4a", roughness: .3, emissive: "#b8741a", emissiveIntensity: .25 }));
    coin.position.set((rand() - .5) * .8, .49 + rand() * .06, (rand() - .5) * .4);
    coin.rotation.set((rand() - .5) * 1.1, 0, (rand() - .5) * 1.1);
    g.add(coin);
  }

  // Open lid, hinged at the back.
  const lid = new THREE.Group();
  const shell = (r: number, length: number) => {
    const c = new THREE.CylinderGeometry(r, r, length, 8, 1, false, 0, Math.PI);
    c.rotateZ(Math.PI / 2);
    c.translate(0, 0, .33);
    return c;
  };
  const wood = mesh(facet(shell(.33, 1.1), CHEST_WOOD, rand), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, side: THREE.DoubleSide }));
  lid.add(wood);
  for (const x of [-.5, 0, .5]) {
    const strap = mesh(facet(shell(.345, .1), GOLD, rand), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .38, side: THREE.DoubleSide }));
    strap.position.x = x;
    lid.add(strap);
  }
  lid.add(at(gold(new THREE.BoxGeometry(1.18, .07, .07)), 0, 0, .66));
  lid.position.set(0, .5, -.33);
  lid.rotation.x = -1.95;
  g.add(lid);

  const light = new THREE.PointLight("#ffc65a", 1.5, 2.6, 2);
  light.position.set(0, .8, .15);
  g.add(light);

  // Burst and halo, facing the camera.
  const star = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? .1 : i % 4 ? .24 : .36, a = (i / 16) * Math.PI * 2 + Math.PI / 2;
    if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const burst = new THREE.Mesh(new THREE.ShapeGeometry(star), new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3b0").multiplyScalar(3.2) }));
  burst.position.set(0, .72, .12);
  burst.userData.billboard = true;
  g.add(burst);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,246,200,.8)"); glow.addColorStop(.3, "rgba(255,214,96,.32)"); glow.addColorStop(1, "rgba(255,200,70,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: new THREE.Color(1.25, 1.15, .9), transparent: true, depthWrite: false }));
  halo.scale.setScalar(1.25);
  halo.position.set(0, .7, .1);
  g.add(halo);
  g.rotation.y = -.2;
  return g;
}

function sign(rand: Rand) {
  const g = new THREE.Group();
  const bend = (geo: THREE.BufferGeometry) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, p.getZ(i) - .4 * (x / 2.12) ** 2);
      p.setY(i, p.getY(i) + .035 * Math.sin(x * 1.4 + .6) + .05 * (1 - (x / 2.12) ** 2));
    }
    return geo;
  };
  const plank = new THREE.BoxGeometry(4.25, .64, .13, 10, 2, 1);
  const pp = plank.attributes.position;
  for (let i = 0; i < pp.count; i++) {
    const x = pp.getX(i);
    if (Math.abs(x) > 2.1) { pp.setY(i, pp.getY(i) * .55); pp.setX(i, x * 1.02); }
  }
  g.add(mesh(facet(jitter(bend(plank), .014, 500), (m, n, r) => WOOD(m, n, r).multiplyScalar(n.y > .5 ? 1.12 : 1), rand)));
  const text = extrudeText(MOTTO, { depth: 5, bevelEnabled: false, curveSegments: 4 });
  text.scale(.00212, .00212, .00212);
  text.translate(0, -.072, .066);
  bend(text);
  text.computeVertexNormals();
  g.add(solid(text, "#43240f", .8));
  return g;
}

function waterfall() {
  const geo = new THREE.PlaneGeometry(.46, 1.9, 8, 10);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 4);
  const foam = C("#f2fbff"), high = C("#9bdcff"), low = C("#3f8fe0");
  for (let i = 0; i < p.count; i++) {
    const t = .5 - p.getY(i) / 1.9;
    const column = Math.round((p.getX(i) / .46 + .5) * 8);
    const c = (column === 2 || column === 5 ? foam.clone().lerp(high, t * .8) : high.clone().lerp(low, Math.min(1, t * 1.3)));
    p.setX(i, p.getX(i) * (1 + t * .25));
    colors.set([c.r * 1.15, c.g * 1.15, c.b * 1.15, t > .6 ? Math.max(0, 1 - (t - .6) / .4) : 1], i * 4);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
}

export interface HomeScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  billboards: THREE.Object3D[];
}

export function buildHomeScene(aspect: number): HomeScene {
  const rand = seeded(20261112);
  const scene = new THREE.Scene();

  scene.add(island(rand));

  const logo = plaque(rand);
  logo.scale.setScalar(.9);
  logo.position.set(0, 2.2, -.4);
  logo.rotation.x = -.06;
  scene.add(logo);

  const stone = rock(.36, 600, stonePaint, rand);
  stone.scale.set(1.2, .55, .95);
  scene.add(at(stone, -1.42, .1, .52));
  scene.add(at(sword(rand), -1.4, .1, .52));
  scene.add(at(die(), -.74, .3, .66));
  scene.add(at(chest(rand), 1.52, .04, .4));
  scene.add(at(sign(rand), 0, -.44, 1.74));
  scene.add(at(waterfall(), .64, -1.08, 1.62));

  const camera = new THREE.PerspectiveCamera(21, aspect, 1, 60);
  const target = new THREE.Vector3(0, .95, 0);
  const pitch = THREE.MathUtils.degToRad(9), distance = 16.6;
  camera.position.set(0, target.y + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();

  const billboards: THREE.Object3D[] = [];
  scene.traverse(o => { if (o.userData.billboard) billboards.push(o); });
  return { scene, camera, billboards };
}
