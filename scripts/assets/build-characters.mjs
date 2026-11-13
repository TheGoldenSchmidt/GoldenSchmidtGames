/**
 * Builds the rigged web characters from the Quaternius sources in src/3DModels
 * (all CC0) into public/models/:
 *
 * - body_m.glb, body_f.glb   Universal Base Characters (Superhero male/female):
 *                            skinned body, eyes and brows; no textures (loaded
 *                            separately from public/models/tex, see the .py script)
 * - hair_<name>.glb          hairstyles skinned to the same 65-bone skeleton
 * - anims.glb                the clips used by the games (Universal Animation
 *                            Library 1 and 2) on a bare skeleton
 *
 * Separate files keep bone names unique, so every clip binds to every figure by
 * name. Run: node scripts/assets/build-characters.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.ProgressEvent ??= class extends Event { constructor(type, init = {}) { super(type); Object.assign(this, init); } };
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); } readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:application/octet-stream;base64,${Buffer.from(b).toString("base64")}`; this.onloadend?.(); }); } };

const ROOT = "src/3DModels";
const BODIES = `${ROOT}/Universal Base Characters[Standard]/Base Characters/Godot - UE`;
const HAIR = `${ROOT}/Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)`;
const UAL1 = `${ROOT}/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb`;
const UAL2 = `${ROOT}/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb`;
const OUT = "public/models";

/** Library clip → name used by the games. */
export const CLIPS = {
  Idle_Loop: "idle", Jog_Fwd_Loop: "jog", Sprint_Loop: "sprint", Push_Loop: "push",
  Jump_Start: "jumpStart", Jump_Loop: "air", Jump_Land: "land",
  Hit_Chest: "hitLight", Hit_Knockback: "hit", Shield_Dash: "dash",
  Slide_Start: "slideStart", Slide_Loop: "slide", Dance_Loop: "dance", Yes: "cheer", Roll: "roll",
  Punch_Jab: "punch", Death01: "death"
};
const HAIRSTYLES = ["Hair_Buzzed", "Hair_BuzzedFemale", "Hair_SimpleParted", "Hair_Long", "Hair_Buns", "Hair_Beard"];

/** Loads a .gltf with its .bin inlined; images are dropped (textures come from public/models/tex). */
async function loadGltf(path) {
  const json = JSON.parse(readFileSync(path, "utf8")), dir = path.slice(0, path.lastIndexOf("/") + 1);
  for (const buffer of json.buffers) buffer.uri = `data:application/octet-stream;base64,${readFileSync(dir + decodeURIComponent(buffer.uri)).toString("base64")}`;
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) { if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; }
  return new Promise((res, rej) => new GLTFLoader().parse(JSON.stringify(json), "", res, rej));
}
async function loadGlb(path) { const b = readFileSync(path); return new Promise((res, rej) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej)); }

/**
 * Garment regions per vertex from the skin weights, so outfits can be painted and
 * widened at runtime without new textures:
 *   ga = (shirt: torso + upper arms, sleeves: forearms, shorts: hips + thighs, legs: shins)
 *   gb = (shoes: feet, gloves: hands)
 */
const REGION = [
  [/^(spine_0[1-3]|clavicle_[lr]|upperarm_[lr])$/, 0], [/^lowerarm_[lr]$/, 1], [/^(pelvis|thigh_[lr])$/, 2], [/^calf_[lr]$/, 3],
  [/^(foot|ball)_[lr]$|^ball_leaf_[lr]$/, 4], [/^hand_[lr]$|^(index|middle|ring|pinky|thumb)_/, 5]
];
function garments(mesh) {
  const g = mesh.geometry, index = g.attributes.skinIndex, weight = g.attributes.skinWeight;
  if (!mesh.isSkinnedMesh || !index || !weight) return;
  const region = mesh.skeleton.bones.map(b => REGION.find(([re]) => re.test(b.name))?.[1] ?? -1);
  const ga = new Float32Array(index.count * 4), gb = new Float32Array(index.count * 2);
  for (let v = 0; v < index.count; v++) for (let k = 0; k < 4; k++) {
    const r = region[index.getComponent(v, k)], w = weight.getComponent(v, k);
    if (r < 0 || !w) continue;
    if (r < 4) ga[v * 4 + r] += w; else gb[v * 2 + r - 4] += w;
  }
  g.setAttribute("ga", new T.BufferAttribute(ga, 4)); g.setAttribute("gb", new T.BufferAttribute(gb, 2));
}

/** Shared vertices and only the attributes the game uses; materials keep their names. */
function slim(scene) {
  scene.traverse(o => {
    if (!o.isMesh) return;
    for (const name of Object.keys(o.geometry.attributes)) if (!["position", "normal", "uv", "skinIndex", "skinWeight"].includes(name)) o.geometry.deleteAttribute(name);
    if (/^MI_Superhero/.test(o.material.name)) garments(o);
    o.geometry = mergeVertices(o.geometry, 1e-5);
    const name = o.material.name; o.material = new T.MeshStandardMaterial({ name }); o.castShadow = true;
  });
}
async function write(file, scene, animations = []) {
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations, onlyVisible: false });
  writeFileSync(`${OUT}/${file}`, Buffer.from(glb));
  return `${file} ${(glb.byteLength / 1024).toFixed(0)} KB`;
}

mkdirSync(OUT, { recursive: true });
const report = [];
for (const [file, source] of [["body_m.glb", "Superhero_Male_FullBody"], ["body_f.glb", "Superhero_Female_FullBody"]]) {
  const gltf = await loadGltf(`${BODIES}/${source}.gltf`); slim(gltf.scene); report.push(await write(file, gltf.scene));
}
for (const name of HAIRSTYLES) {
  const gltf = await loadGltf(`${HAIR}/${name}.gltf`); slim(gltf.scene);
  report.push(await write(`hair_${name.replace("Hair_", "").toLowerCase()}.glb`, gltf.scene));
}

// Animations: chosen clips, body rotations plus root/pelvis position, ~20 keys per second.
const skip = bone => /(index|middle|ring|pinky|thumb)_0[2-4]|_leaf_/.test(bone);
const thin = clip => {
  clip.tracks = clip.tracks.filter(t => { const [bone, prop] = t.name.split("."); return !skip(bone) && (prop === "quaternion" || (prop === "position" && /^(root|pelvis)$/.test(bone))); })
    .map(t => {
      const stride = t.getValueSize(), times = [], values = []; let last = -1;
      for (let i = 0; i < t.times.length; i++) if (i === 0 || i === t.times.length - 1 || t.times[i] - last >= .05) { times.push(t.times[i]); last = t.times[i]; for (let k = 0; k < stride; k++) values.push(t.values[i * stride + k]); }
      return new t.constructor(t.name, times, values);
    });
  return clip;
};
const libraries = [await loadGlb(UAL1), await loadGlb(UAL2)];
const clips = [];
for (const [source, name] of Object.entries(CLIPS)) {
  const clip = libraries.flatMap(l => l.animations).find(a => a.name === source || a.name.endsWith(`|${source}`));
  if (!clip) throw new Error(`Animation fehlt: ${source}`);
  const copy = thin(clip.clone()); copy.name = name; clips.push(copy);
}
// A bare skeleton carries the clips (no mesh needed).
const rig = libraries[0].scene.clone(true);
rig.traverse(o => { if (o.isMesh) o.visible = false; });
const bones = new T.Group(); rig.traverse(o => { if (o.isBone && !o.parent?.isBone) bones.add(o.clone(true)); });
report.push(await write("anims.glb", bones, clips));

// The earlier single-file prototype figure is replaced.
if (existsSync(`${OUT}/mannequin.glb`)) rmSync(`${OUT}/mannequin.glb`);
console.log(report.join("\n"));
