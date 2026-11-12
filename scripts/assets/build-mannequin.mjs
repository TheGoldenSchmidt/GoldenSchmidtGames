/**
 * Builds the web figure for the rigged match games from the Quaternius
 * sources in assets/ual2/ (CC0): the Mannequin_F mesh plus a few clips of the
 * Universal Animation Library 2, as one small GLB in public/models/.
 *
 * Run: node scripts/assets/build-mannequin.mjs
 * Only the listed clips are kept; finger, leaf and scale tracks are dropped and
 * keyframes are thinned, so phones download about a megabyte instead of 25.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import * as T from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Minimal browser shims for the loaders and the exporter under Node.
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {} }), createElement: () => ({ style: {}, getContext: () => null }) };
globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); }); } readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result = `data:application/octet-stream;base64,${Buffer.from(b).toString("base64")}`; this.onloadend?.(); }); } };

/** Clip in the library → name used by the game. */
export const CLIPS = {
  "Armature|Idle_FoldArms_Loop": "idle",
  "Armature|Walk_Carry_Loop": "move",
  "Armature|Shield_Dash": "dash",
  "Armature|Hit_Knockback": "hit",
  "Armature|NinjaJump_Idle_Loop": "fall",
  "Armature|NinjaJump_Land": "land",
  "Armature|Yes": "cheer"
};

const load = path => { const b = readFileSync(path); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ""); };
const figure = load("assets/ual2/Mannequin_F.fbx"), library = load("assets/ual2/UAL2_Standard.fbx");

const skip = name => /(index|middle|ring|pinky|thumb)_0[2-4]|_leaf_/.test(name);
const clips = library.animations.filter(a => CLIPS[a.name]).map(a => {
  const clip = a.clone(); clip.name = CLIPS[a.name];
  // Keep rotations of the body bones and only the root/pelvis position; thin to ~20 keys per second.
  clip.tracks = clip.tracks.filter(t => {
    const [bone, prop] = t.name.split(".");
    if (skip(bone) || prop === "scale") return false;
    return prop === "quaternion" || (prop === "position" && /^(root|pelvis)$/.test(bone));
  }).map(t => {
    const stride = t.getValueSize(), times = [], values = [];
    let last = -1;
    for (let i = 0; i < t.times.length; i++) if (i === 0 || i === t.times.length - 1 || t.times[i] - last >= .05) {
      times.push(t.times[i]); last = t.times[i];
      for (let k = 0; k < stride; k++) values.push(t.values[i * stride + k]);
    }
    return new t.constructor(t.name, times, values);
  });
  return clip;
});
const missing = Object.values(CLIPS).filter(n => !clips.some(c => c.name === n));
if (missing.length) throw new Error(`Clips fehlen: ${missing.join(", ")}`);

// Plain material: the game tints it per player. Fingers stay in the mesh.
// Shared vertices instead of FBX triangle soup; no UVs (untextured).
figure.traverse(o => {
  if (!o.isMesh) return;
  o.geometry.deleteAttribute("uv"); o.geometry.deleteAttribute("uv1");
  o.geometry = mergeVertices(o.geometry, 1e-5);
  o.material = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }); o.castShadow = true;
});
figure.animations = clips;
const glb = await new GLTFExporter().parseAsync(figure, { binary: true, animations: clips, onlyVisible: true });
mkdirSync("public/models", { recursive: true });
writeFileSync("public/models/mannequin.glb", Buffer.from(glb));
const box = new T.Box3().setFromObject(figure), size = box.getSize(new T.Vector3());
console.log(`public/models/mannequin.glb: ${(glb.byteLength / 1024).toFixed(0)} KB, Clips: ${clips.map(c => `${c.name} ${c.duration.toFixed(2)} s`).join(", ")}, Größe ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`);
