// Building blocks for the start screen scenes: seeded randomness, faceted geometry and materials.
// Scale: 1 unit = 100 px of the island artwork. All colours are sRGB hex values.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

export type Rand = () => number;
export type Paint = (centre: THREE.Vector3, normal: THREE.Vector3, r: number) => THREE.Color;

export function seeded(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(x: number, y: number, z: number, k: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.19) * 43758.5453;
  return s - Math.floor(s);
}

export const C = (hex: string) => new THREE.Color(hex);

/** Moves vertices by position-keyed noise, so vertices that coincide stay together. */
export function jitter<T extends THREE.BufferGeometry>(geometry: T, amount: number | [number, number, number], key = 0): T {
  const [ax, ay, az] = typeof amount === "number" ? [amount, amount, amount] : amount;
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 500), y = Math.round(p.getY(i) * 500), z = Math.round(p.getZ(i) * 500);
    p.setXYZ(i,
      p.getX(i) + (hash(x, y, z, key) - .5) * 2 * ax,
      p.getY(i) + (hash(x, y, z, key + 1) - .5) * 2 * ay,
      p.getZ(i) + (hash(x, y, z, key + 2) - .5) * 2 * az);
  }
  return geometry;
}

/** One colour per triangle: the hand-cut facet look. Normals stay per face. */
export function facet(source: THREE.BufferGeometry, paint: Paint, rand: Rand) {
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

/** A material tone that wanders a little from facet to facet. */
export function tone(hexes: string[], spread = .05): Paint {
  const set = hexes.map(C);
  return (_m, _n, r) => set[Math.floor(r * set.length) % set.length].clone().offsetHSL(0, 0, ((r * 7.13) % 1 - .5) * spread);
}

/* ------------------------------------------------------------------ */
/* Materials                                                            */

export interface SurfaceOptions {
  roughness?: number;
  metalness?: number;
  /** World-space frequency of the surface grain; stretch one axis for wood grain. */
  grain?: [number, number, number];
  /** How far the grain darkens and lightens the albedo (0 to 1). */
  albedo?: number;
  /** Strength of the grain as surface relief. */
  bump?: number;
  /** Fine dark cracks along noise ridges (0 to 1). */
  cracks?: number;
  flat?: boolean;
  color?: string;
  vertexColors?: boolean;
  side?: THREE.Side;
  envMapIntensity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

const NOISE = /* glsl */ `
varying vec3 vSurfacePos;
uniform vec3 uGrain;
uniform float uAlbedo;
uniform float uBump;
uniform float uCracks;
float surfaceHash(vec3 p) { p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float surfaceNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(surfaceHash(i), surfaceHash(i + vec3(1, 0, 0)), f.x), mix(surfaceHash(i + vec3(0, 1, 0)), surfaceHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(surfaceHash(i + vec3(0, 0, 1)), surfaceHash(i + vec3(1, 0, 1)), f.x), mix(surfaceHash(i + vec3(0, 1, 1)), surfaceHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float surfaceGrain(vec3 p) { return .55 * surfaceNoise(p) + .3 * surfaceNoise(p * 2.03 + 7.1) + .15 * surfaceNoise(p * 4.1 + 3.7); }
`;

/**
 * MeshStandardMaterial with a procedural grain: it varies the albedo and perturbs the normal
 * (same method as three's bump map, with the height taken from 3D noise instead of a texture).
 */
export function surface(options: SurfaceOptions = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? "#ffffff",
    vertexColors: options.vertexColors ?? true,
    flatShading: options.flat ?? true,
    roughness: options.roughness ?? .85,
    metalness: options.metalness ?? 0,
    side: options.side ?? THREE.FrontSide,
    envMapIntensity: options.envMapIntensity ?? 1,
    emissive: options.emissive ?? "#000000",
    emissiveIntensity: options.emissiveIntensity ?? 1
  });
  const grain = new THREE.Vector3(...(options.grain ?? [6, 6, 6]));
  const albedo = options.albedo ?? .14, bump = options.bump ?? .6, cracks = options.cracks ?? 0;
  material.onBeforeCompile = shader => {
    shader.uniforms.uGrain = { value: grain };
    shader.uniforms.uAlbedo = { value: albedo };
    shader.uniforms.uBump = { value: bump };
    shader.uniforms.uCracks = { value: cracks };
    shader.vertexShader = "varying vec3 vSurfacePos;\n" + shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nvSurfacePos = (modelMatrix * vec4(transformed, 1.)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + NOISE)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float surfaceH = surfaceGrain(vSurfacePos * uGrain);
        diffuseColor.rgb *= 1. + (surfaceH - .5) * 2. * uAlbedo;
        if (uCracks > 0.) {
          // Thin lines where a second noise crosses its middle, only in some patches: hairline cracks.
          float ridge = abs(surfaceNoise(vSurfacePos * uGrain * 1.3 + 13.1) - .5);
          float crackArea = smoothstep(.58, .74, surfaceNoise(vSurfacePos * uGrain * .22 + 4.2));
          float crack = (1. - smoothstep(.004, .014, ridge)) * crackArea;
          diffuseColor.rgb *= 1. - crack * uCracks;
          surfaceH -= crack * .35;
        }`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          vec2 dHdxy = vec2(dFdx(surfaceH), dFdy(surfaceH)) * uBump;
          vec3 sigmaX = normalize(dFdx(-vViewPosition)), sigmaY = normalize(dFdy(-vViewPosition));
          vec3 r1 = cross(sigmaY, normal), r2 = cross(normal, sigmaX);
          float det = dot(sigmaX, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dHdxy.x * r1 + dHdxy.y * r2));
        }`);
  };
  material.customProgramCacheKey = () => `surface-${grain.toArray().join()}-${albedo}-${bump}-${cracks}`;
  return material;
}

export function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, cast = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

/* ------------------------------------------------------------------ */
/* Palette: the Inselwelt materials (see designregeln.md)               */

export const STONE = tone(["#8c8079", "#82766f", "#958982", "#7a6e68"], .06);
export const MOSS = C("#93a447");
export const stonePaint: Paint = (m, n, r) => (n.y > .62 && r < .28 ? MOSS.clone().offsetHSL(0, 0, (r - .14) * .3) : STONE(m, n, r));
const ROCK = tone(["#a8714f", "#9a654a", "#8c5a44", "#7f5040"], .07);
export const rockPaint: Paint = (m, n, r) => ROCK(m, n, r).multiplyScalar(THREE.MathUtils.clamp(1.1 + m.y * .14, .74, 1.12));
export const GRASS = tone(["#9fd83e", "#8fcf38", "#80c533", "#a8dd47"], .05);
export const GRASS_LIP = tone(["#4f9a2e", "#46902c", "#58a632"], .05);
export const WOOD = tone(["#dea468", "#d99d61", "#e3ab70"], .025);
export const CHEST_WOOD = tone(["#a65d2e", "#995428", "#b06633"], .05);
export const GOLD = tone(["#ffc83d", "#f7b93a", "#ffd257"], .04);

/* ------------------------------------------------------------------ */
/* Shapes                                                               */

export function shapesOf(d: string) {
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
  return data.paths.flatMap(path => path.toShapes());
}

/** Extrudes outline text (y down, baseline 0) into y-up geometry centred on x. */
export function extrudeText(word: { width: number; d: string }, options: THREE.ExtrudeGeometryOptions) {
  const g = new THREE.ExtrudeGeometry(shapesOf(word.d), { curveSegments: 6, bevelSegments: 2, ...options });
  g.deleteAttribute("uv");
  g.scale(1, -1, 1);
  // Mirroring flips the winding; swap two corners of every triangle to restore it.
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

export function polygonShape(points: Array<[number, number]>) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}

/** Polygon with every corner cut by `cut`, centred on the origin. */
export function chamferedRect(w: number, h: number, cut: number) {
  const x = w / 2, y = h / 2;
  return polygonShape([[-x + cut, -y], [x - cut, -y], [x, -y + cut], [x, y - cut], [x - cut, y], [-x + cut, y], [-x, y - cut], [-x, -y + cut]]);
}
