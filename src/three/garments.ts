import * as T from "three";

/**
 * Loose clothing as an own cloth layer, derived from the body mesh: the part of
 * the body a garment covers is cut out at straight edges (hem, cuffs, collar),
 * pushed outwards onto a wide silhouette that hangs straight instead of
 * following the muscles, smoothed and skinned with the body's own weights. So
 * the cloth bends at the same joints as the body, without bulges and gaps.
 * Pocket, ribbed hem and cuffs and the trouser stripe are drawn by the shader
 * from the rest-pose position, crisp at any mesh resolution.
 * All measures are metres in the rest pose (T-pose, Y up).
 */
export type Garment = "hoodie" | "pants";
export interface ClothColors { hoodie: number; trim: number; pants: number; stripe: number }

/** Distance between skin and cloth where the cloth lies on the body. */
const EASE = .012;
const HOODIE = {
  hem: .885, collar: 1.51, centre: -.024,
  /** Height → half width and half depth of the body of the hoodie; it stays clear of the trousers below. */
  body: [[.885, .23, .172], [.94, .243, .182], [1.3, .245, .183], [1.42, .238, .174], [1.5, .13, .112], [1.56, .095, .095]],
  /** Along the arm (0 shoulder, 1 wrist) → radius of the sleeve; it ends in the cuff. */
  sleeve: [[0, .102], [.5, .096], [.86, .092], [.97, .064]], cuff: .97,
  /** Ribbed bands and the belly pocket (bottom, top, half width at bottom and top). */
  band: .05, cuffBand: .05, pocket: [.935, 1.1, .15, .085]
};
const PANTS = {
  hem: .085, waist: 1, centre: -.027, hips: [.196, .152],
  /** Along the leg (0 hip, 1 ankle) → radius of the trouser leg. */
  leg: [[0, .116], [.5, .12], [1, .126]],
  /** Half the gap between the trouser legs. */
  gap: .005
};

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (from: number, to: number, value: number) => { const k = Math.min(1, Math.max(0, (value - from) / (to - from))); return k * k * (3 - 2 * k); };
/** Piecewise-linear lookup in rows of [key, ...values]. */
function curve(rows: number[][], key: number, column: number) {
  if (key <= rows[0][0]) return rows[0][column];
  for (let i = 1; i < rows.length; i++) if (key <= rows[i][0]) return mix(rows[i - 1][column], rows[i][column], (key - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]));
  return rows[rows.length - 1][column];
}
/**
 * Depth (z) of the cloth surface in the rest pose at `x`, `y`: the front-most
 * point, or the back-most with `back`. Chains, cords and the hood rest on it.
 */
export function clothSurface(cloth: T.Mesh, x: number, y: number, back = false) {
  const p = cloth.geometry.attributes.position, index = cloth.geometry.index!;
  let depth = back ? Infinity : -Infinity;
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
    const ax = p.getX(ia), ay = p.getY(ia), bx = p.getX(ib), by = p.getY(ib), cx = p.getX(ic), cy = p.getY(ic);
    if (x < Math.min(ax, bx, cx) || x > Math.max(ax, bx, cx) || y < Math.min(ay, by, cy) || y > Math.max(ay, by, cy)) continue;
    const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const u = ((x - ax) * (cy - ay) - (cx - ax) * (y - ay)) / area, v = ((bx - ax) * (y - ay) - (x - ax) * (by - ay)) / area;
    if (u < 0 || v < 0 || u + v > 1) continue;
    const z = p.getZ(ia) + u * (p.getZ(ib) - p.getZ(ia)) + v * (p.getZ(ic) - p.getZ(ia));
    depth = back ? Math.min(depth, z) : Math.max(depth, z);
  }
  return Number.isFinite(depth) ? depth : 0;
}

interface Limb { from: T.Vector3; axis: T.Vector3; length: number }

function build(body: T.SkinnedMesh, garments: readonly Garment[]) {
  const source = body.geometry, pos = source.attributes.position, skinIndex = source.attributes.skinIndex, skinWeight = source.attributes.skinWeight, index = source.index!;
  const bones = body.skeleton.bones, count = pos.count;
  const joint = (name: string) => new T.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[bones.findIndex(b => b.name === name)].clone().invert());
  const limb = (a: string, b: string): Limb => { const from = joint(a), to = joint(b); return { from, axis: to.clone().sub(from).normalize(), length: from.distanceTo(to) }; };
  const neck = joint("neck_01").lerp(joint("Head"), .5);
  const arms = [limb("upperarm_l", "hand_l"), limb("upperarm_r", "hand_r")], legs = [limb("thigh_l", "foot_l"), limb("thigh_r", "foot_r")];
  // Share of each vertex that follows the left/right arm (0, 1) and the left/right leg (2, 3); the rest is the trunk.
  const part = bones.map(b => { const side = b.name.endsWith("_r") ? 1 : 0; return /^(upperarm|lowerarm|hand|index|middle|ring|pinky|thumb)/.test(b.name) ? side : /^(thigh|calf|foot|ball)/.test(b.name) ? 2 + side : -1; });
  const share = new Float32Array(count * 4), pelvis = bones.findIndex(b => b.name === "pelvis");
  /** Share that follows head and neck: never part of a garment. */
  const head = new Float32Array(count);
  for (let v = 0; v < count; v++) for (let k = 0; k < 4; k++) {
    const bone = skinIndex.getComponent(v, k), p = part[bone];
    if (p >= 0) share[v * 4 + p] += skinWeight.getComponent(v, k); else if (/^(Head|neck_01)$/.test(bones[bone].name)) head[v] += skinWeight.getComponent(v, k);
  }

  // Vertices doubled along texture seams count as one point.
  const point = new Int32Array(count), ids = new Map<string, number>(), first: number[] = [];
  for (let v = 0; v < count; v++) {
    const key = `${Math.round(pos.getX(v) * 2e4)},${Math.round(pos.getY(v) * 2e4)},${Math.round(pos.getZ(v) * 2e4)}`;
    let id = ids.get(key);
    if (id === undefined) { id = first.length; ids.set(key, id); first.push(v); }
    point[v] = id;
  }
  const points = first.length, a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), ab = new T.Vector3(), ac = new T.Vector3();
  const normalsOf = (positions: (i: number, target: T.Vector3) => T.Vector3, triangles: ArrayLike<number>, size: number) => {
    const normals = new Float32Array(size * 3);
    for (let i = 0; i < triangles.length; i += 3) {
      positions(triangles[i], a); positions(triangles[i + 1], b); positions(triangles[i + 2], c);
      ab.subVectors(b, a); ac.subVectors(c, a); ab.cross(ac);
      for (let k = 0; k < 3; k++) { const p = triangles[i + k] * 3; normals[p] += ab.x; normals[p + 1] += ab.y; normals[p + 2] += ab.z; }
    }
    for (let p = 0; p < size; p++) { const l = Math.hypot(normals[p * 3], normals[p * 3 + 1], normals[p * 3 + 2]) || 1; normals[p * 3] /= l; normals[p * 3 + 1] /= l; normals[p * 3 + 2] /= l; }
    return normals;
  };
  const bodyTriangles = Array.from(index.array as ArrayLike<number>, v => point[v]);
  const skin = (p: number, target: T.Vector3) => target.fromBufferAttribute(pos, first[p]);
  const skinNormals = normalsOf(skin, bodyTriangles, points);

  const outPosition: number[] = [], outNormal: number[] = [], outIndex: number[] = [], outSkinIndex: number[] = [], outSkinWeight: number[] = [], outPiece: number[] = [];
  const q = new T.Vector3(), centre = new T.Vector3(), result = new T.Vector3(), other = new T.Vector3();
  /** Pushes `p` out to at least `radius` around the limb axis. */
  const tube = (p: T.Vector3, l: Limb, radius: number[][], target: T.Vector3) => {
    const t = q.subVectors(p, l.from).dot(l.axis) / l.length;
    centre.copy(l.from).addScaledVector(l.axis, t * l.length); q.subVectors(p, centre);
    const d = q.length(), r = curve(radius, t, 1);
    return d < r ? target.copy(centre).addScaledVector(q, r / Math.max(d, 1e-5)) : target.copy(p);
  };
  /** Pushes `p` out onto an ellipse around the spine at its height. */
  const ellipse = (p: T.Vector3, halfWidth: number, halfDepth: number, z: number, target: T.Vector3) => {
    const r = Math.hypot(p.x / halfWidth, (p.z - z) / halfDepth);
    if (r >= 1) return target.copy(p);
    return r < 1e-4 ? target.set(p.x, p.y, z + halfDepth) : target.set(p.x / r, p.y, z + (p.z - z) / r);
  };

  for (const garment of garments) {
    const hoodie = garment === "hoodie";
    /** Moves a point outside the garment onto its edge (hem, cuff, collar, waist); returns whether it moved. */
    const clamp = (p: T.Vector3, v: number) => {
      if (!hoodie) { const y = Math.min(PANTS.waist, Math.max(PANTS.hem, p.y)), moved = y !== p.y; p.y = y; return moved; }
      const side = share[v * 4] > .5 ? 0 : share[v * 4 + 1] > .5 ? 1 : -1;
      // The collar is a ring around the neck; the shoulders next to it rise higher and stay covered.
      if (side < 0) { const y = Math.min(HOODIE.collar + (head[v] > .2 ? 0 : .25 * smooth(.085, .13, Math.hypot(p.x - neck.x, p.z - neck.z))), Math.max(HOODIE.hem, p.y)), moved = y !== p.y; p.y = y; return moved; }
      const t = q.subVectors(p, arms[side].from).dot(arms[side].axis) / arms[side].length;
      if (t <= HOODIE.cuff) return false;
      p.addScaledVector(arms[side].axis, (HOODIE.cuff - t) * arms[side].length); return true;
    };
    /** The wide silhouette: trunk and limbs each keep a minimum girth, mixed by how much a point follows which. */
    const fit = (p: T.Vector3, v: number) => {
      const w = share.subarray(v * 4, v * 4 + 4);
      if (hoodie) {
        ellipse(p, curve(HOODIE.body, p.y, 1), curve(HOODIE.body, p.y, 2), HOODIE.centre, result).multiplyScalar(1 - w[0] - w[1]);
        for (const s of [0, 1]) if (w[s] > 0) result.addScaledVector(tube(p, arms[s], HOODIE.sleeve, other), w[s]);
      } else {
        // Below the hips the legs carry the cloth; the seat stays where the body is.
        ellipse(p, PANTS.hips[0], PANTS.hips[1], PANTS.centre, result).lerp(p, 1 - smooth(.84, .9, p.y)).multiplyScalar(1 - w[2] - w[3]);
        for (const s of [0, 1]) if (w[2 + s] > 0) {
          tube(p, legs[s], PANTS.leg, other);
          other.x = s ? Math.min(other.x, -PANTS.gap) : Math.max(other.x, PANTS.gap);
          result.addScaledVector(other, w[2 + s]);
        }
      }
      return p.copy(result);
    };

    // Triangles with at least one point inside the garment; points outside move onto its edge.
    const inside = new Uint8Array(points), local = new Int32Array(points).fill(-1), used: number[] = [], triangles: number[] = [];
    for (let p = 0; p < points; p++) inside[p] = clamp(skin(p, a), first[p]) ? 0 : 1;
    for (let i = 0; i < bodyTriangles.length; i += 3) {
      if (!inside[bodyTriangles[i]] && !inside[bodyTriangles[i + 1]] && !inside[bodyTriangles[i + 2]]) continue;
      for (let k = 0; k < 3; k++) { const p = bodyTriangles[i + k]; if (local[p] < 0) { local[p] = used.length; used.push(p); } triangles.push(local[p]); }
    }
    const size = used.length, cloth = new Float32Array(size * 3), base = new Float32Array(size * 3);
    const read = (i: number, target: T.Vector3) => target.set(cloth[i * 3], cloth[i * 3 + 1], cloth[i * 3 + 2]);
    const write = (i: number, p: T.Vector3) => { cloth[i * 3] = p.x; cloth[i * 3 + 1] = p.y; cloth[i * 3 + 2] = p.z; };
    const p = new T.Vector3(), n = new T.Vector3();
    used.forEach((id, i) => {
      skin(id, p); clamp(p, first[id]); base.set([p.x, p.y, p.z], i * 3);
      p.addScaledVector(n.fromArray(skinNormals, id * 3), EASE); write(i, fit(p, first[id]));
    });
    // Smoothing takes the last traces of muscles out of the cloth; edges stay straight, the girth is kept.
    const neighbours: number[][] = Array.from({ length: size }, () => []);
    for (let i = 0; i < triangles.length; i += 3) for (let k = 0; k < 3; k++) { const from = triangles[i + k], to = triangles[i + (k + 1) % 3]; if (!neighbours[from].includes(to)) neighbours[from].push(to); if (!neighbours[to].includes(from)) neighbours[to].push(from); }
    const next = new Float32Array(size * 3);
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < size; i++) {
        p.set(0, 0, 0); for (const o of neighbours[i]) p.add(read(o, a)); p.multiplyScalar(1 / neighbours[i].length);
        read(i, a).lerp(p, .55); next.set([a.x, a.y, a.z], i * 3);
      }
      cloth.set(next);
      used.forEach((id, i) => {
        read(i, p); clamp(p, first[id]); fit(p, first[id]);
        // Never closer to the skin than the ease.
        if (inside[id]) { n.fromArray(skinNormals, id * 3); const gap = a.fromArray(base, i * 3).sub(p).dot(n) + EASE; if (gap > 0) { p.addScaledVector(n, gap); clamp(p, first[id]); } }
        write(i, p);
      });
    }
    // The hoodie hangs past the crotch: skin between the legs would close it like a floor at the hem.
    if (hoodie) for (let i = triangles.length - 3; i >= 0; i -= 3) {
      read(triangles[i], a); read(triangles[i + 1], b); read(triangles[i + 2], c);
      if (Math.max(a.y, b.y, c.y) > HOODIE.hem + .03) continue;
      ab.subVectors(b, a); ac.subVectors(c, a); ab.cross(ac).normalize();
      if (Math.abs(ab.y) > .8) triangles.splice(i, 3);
    }
    const normals = normalsOf(read, triangles, size), start = outPosition.length / 3;
    used.forEach((id, i) => {
      const v = first[id];
      outPosition.push(cloth[i * 3], cloth[i * 3 + 1], cloth[i * 3 + 2]); outNormal.push(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]); outPiece.push(hoodie ? 0 : 1);
      // The hoodie hangs from the hips: only its sides give way to the thighs, the middle never swings with a leg.
      const follow = hoodie ? smooth(.07, .13, Math.abs(pos.getX(v))) : 1, weights = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const bone = skinIndex.getComponent(v, k), w = skinWeight.getComponent(v, k), kept = part[bone] >= 2 ? w * follow : w;
        weights.set(bone, (weights.get(bone) ?? 0) + kept); if (kept < w) weights.set(pelvis, (weights.get(pelvis) ?? 0) + w - kept);
      }
      const top = [...weights].filter(([, w]) => w > 0).sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((total, [, w]) => total + w, 0) || 1;
      for (let k = 0; k < 4; k++) { outSkinIndex.push(top[k]?.[0] ?? 0); outSkinWeight.push((top[k]?.[1] ?? 0) / sum); }
    });
    for (const t of triangles) outIndex.push(start + t);
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(outPosition, 3));
  geometry.setAttribute("normal", new T.Float32BufferAttribute(outNormal, 3));
  geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(outSkinIndex, 4));
  geometry.setAttribute("skinWeight", new T.Float32BufferAttribute(outSkinWeight, 4));
  geometry.setAttribute("piece", new T.Float32BufferAttribute(outPiece, 1));
  geometry.setIndex(outIndex);
  return geometry;
}

const cache = new Map<string, T.BufferGeometry>();
const f = (value: number) => value.toFixed(4);

/**
 * The cloth layer for `body` (kept per body type under `key`), bound to the
 * body's skeleton. The caller adds it next to the body and disposes the material.
 */
export function clothing(body: T.SkinnedMesh, key: string, garments: readonly Garment[], colors: ClothColors) {
  const id = `${key}:${garments.join("+")}`;
  let geometry = cache.get(id);
  if (!geometry) { geometry = build(body, garments); cache.set(id, geometry); }
  const material = new T.MeshStandardMaterial({ roughness: .94, metalness: 0, side: T.DoubleSide });
  const uniforms = { cHoodie: { value: new T.Color(colors.hoodie) }, cTrim: { value: new T.Color(colors.trim) }, cPants: { value: new T.Color(colors.pants) }, cStripe: { value: new T.Color(colors.stripe) } };
  // Rest-pose landmarks of this body for the shader: arm axis, cuff position, leg axis.
  const bones = body.skeleton.bones, at = (name: string) => new T.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[bones.findIndex(b => b.name === name)].clone().invert());
  const shoulder = at("upperarm_l"), hand = at("hand_l"), hip = at("thigh_l"), foot = at("foot_l"), cuffX = mix(shoulder.x, hand.x, HOODIE.cuff) - HOODIE.cuffBand;
  const [p0, p1, w0, w1] = HOODIE.pocket;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "attribute float piece;\nvarying float vPiece;\nvarying vec3 vRest;\n" + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n      vPiece = piece; vRest = position;");
    shader.fragmentShader = "uniform vec3 cHoodie;\nuniform vec3 cTrim;\nuniform vec3 cPants;\nuniform vec3 cStripe;\nvarying float vPiece;\nvarying vec3 vRest;\n" + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      vec3 cloth;
      if (vPiece < .5) {
        cloth = cHoodie;
        // Belly pocket on the front: a touch darker, with a seam along its edge.
        float k = clamp((vRest.y - ${f(p0)}) / ${f(p1 - p0)}, 0., 1.);
        float d = max(abs(vRest.x) - mix(${f(w0)}, ${f(w1)}, k), max(${f(p0)} - vRest.y, vRest.y - ${f(p1)}));
        cloth *= 1. - step(${f(HOODIE.centre)}, vRest.z) * (.07 * smoothstep(.002, -.002, d) + .2 * smoothstep(.0045, .002, abs(d + .005)));
        // Ribbed hem and cuffs.
        float hem = smoothstep(.002, -.002, vRest.y - ${f(HOODIE.hem + HOODIE.band)});
        float cuff = smoothstep(-.002, .002, abs(vRest.x) - ${f(cuffX)});
        float rib = hem > cuff ? sin(atan(vRest.x, vRest.z - ${f(HOODIE.centre)}) * 84.) : sin(atan(vRest.y - ${f(shoulder.y)}, vRest.z - ${f(shoulder.z)}) * 30.);
        cloth = mix(cloth, cTrim * (.9 + .1 * rib), max(hem, cuff));
      } else {
        cloth = cPants;
        // Stripe down the outside of each leg.
        float legZ = mix(${f(hip.z)}, ${f(foot.z)}, clamp((${f(hip.y)} - vRest.y) / ${f(hip.y - foot.y)}, 0., 1.));
        float stripe = smoothstep(.024, .02, abs(vRest.z - legZ)) * step(${f(hip.x)}, abs(vRest.x));
        cloth = mix(cloth, cStripe, stripe);
      }
      diffuseColor.rgb *= cloth;`);
  };
  material.customProgramCacheKey = () => `rigged-cloth-${id}`;
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.bind(body.skeleton, body.bindMatrix);
  mesh.castShadow = true; mesh.frustumCulled = false;
  return mesh;
}
