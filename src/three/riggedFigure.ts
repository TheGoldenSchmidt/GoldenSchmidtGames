import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Rigged, animated characters for the match games: Quaternius Universal Base
 * Characters with hairstyles and clips from the Universal Animation Library 1
 * and 2 (all CC0), built by scripts/assets/build-characters.mjs and
 * build-character-textures.py into public/models/.
 *
 * Every player gets an own skeleton, a look (body, skin, hair) and the player
 * colour on the clothing (masked in the shader, folds and shading stay).
 */
export type LoopState = "idle" | "jog" | "sprint" | "push" | "air" | "slide" | "dance";
export type OneShot = "dash" | "hit" | "hitLight" | "jumpStart" | "land" | "slideStart" | "cheer" | "roll";
const ONE_SHOTS: readonly string[] = ["dash", "hit", "hitLight", "jumpStart", "land", "slideStart", "cheer", "roll"];

type Body = "m" | "f";
/** The hair texture is greyscale (the source tints it in the engine); `hairColor` is that tint. */
interface Look { body: Body; skin: "light" | "dark"; hair?: string; beard?: boolean; hairColor: number }
/** Six clearly different looks, one per player colour slot. */
export const LOOKS: readonly Look[] = [
  { body: "m", skin: "light", hair: "simpleparted", hairColor: 0x6b4423 },
  { body: "f", skin: "dark", hair: "buns", hairColor: 0x2b1d16 },
  { body: "m", skin: "dark", hair: "buzzed", beard: true, hairColor: 0x1f1714 },
  { body: "f", skin: "light", hair: "long", hairColor: 0xe0b85c },
  { body: "m", skin: "light", hair: "buzzed", beard: true, hairColor: 0xb4532a },
  { body: "f", skin: "dark", hair: "buzzedfemale", hairColor: 0xe07a24 }
];
const HAIRS = ["simpleparted", "buns", "buzzed", "long", "buzzedfemale", "beard"] as const;

export interface CharacterKit {
  bodies: Record<Body, GLTF>;
  hairs: Record<string, GLTF>;
  clips: T.AnimationClip[];
  textures: Record<string, T.Texture>;
}

let pending: Promise<CharacterKit> | undefined;
/** Loads bodies, hairstyles, clips and textures once (precached by the service worker). */
export function loadCharacterKit(): Promise<CharacterKit> {
  pending ??= (async () => {
    const base = `${import.meta.env.BASE_URL}models/`, gltf = new GLTFLoader(), tex = new T.TextureLoader();
    const texture = async (name: string, color = true) => {
      const t = await tex.loadAsync(`${base}tex/${name}`);
      t.flipY = false; t.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace; t.anisotropy = 2; return t;
    };
    const [m, f, anims, ...hairs] = await Promise.all([gltf.loadAsync(`${base}body_m.glb`), gltf.loadAsync(`${base}body_f.glb`), gltf.loadAsync(`${base}anims.glb`), ...HAIRS.map(h => gltf.loadAsync(`${base}hair_${h}.glb`))]);
    const names = ["body_m_light.jpg", "body_m_dark.jpg", "body_f_light.jpg", "body_f_dark.jpg", "hair_1.jpg", "hair_2.jpg", "eye.jpg"];
    const loaded = await Promise.all([...names.map(n => texture(n)), texture("outfit_m.png", false), texture("outfit_f.png", false)]);
    const textures = Object.fromEntries([...names, "outfit_m.png", "outfit_f.png"].map((n, i) => [n, loaded[i]]));
    return { bodies: { m, f }, hairs: Object.fromEntries(HAIRS.map((h, i) => [h, hairs[i]])), clips: anims.animations, textures };
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}

export interface RiggedFigure {
  group: T.Group;
  /** Height of the scaled figure in world units. */
  height: number;
  setLoop(state: LoopState, speed?: number): void;
  play(action: OneShot): void;
  update(dt: number): void;
  dispose(): void;
}

const FADE = .16;

/** Skin material whose clothing (mask) takes the player colour. */
function outfitMaterial(map: T.Texture, mask: T.Texture, color: number) {
  const material = new T.MeshStandardMaterial({ map, roughness: .62, metalness: 0 });
  const tint = new T.Color(color);
  material.onBeforeCompile = shader => {
    shader.uniforms.outfitMap = { value: mask }; shader.uniforms.outfitColor = { value: tint };
    shader.fragmentShader = "uniform sampler2D outfitMap;\nuniform vec3 outfitColor;\n" + shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      float outfit = texture2D(outfitMap, vMapUv).r;
      float shade = dot(diffuseColor.rgb, vec3(.299, .587, .114));
      diffuseColor.rgb = mix(diffuseColor.rgb, outfitColor * (.55 + .9 * shade), outfit);`);
  };
  return material;
}

/** Rebinds a separately loaded skinned mesh (hair) to the body's bones by name. */
function bindTo(mesh: T.SkinnedMesh, body: T.Object3D) {
  const bones = mesh.skeleton.bones.map(b => (body.getObjectByName(b.name) as T.Bone | undefined) ?? b);
  mesh.bind(new T.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
}

/** A player's character, `height` world units tall, facing +Z, clothing in `color`. */
export function riggedFigure(kit: CharacterKit, slot: number, color: number, height: number): RiggedFigure {
  const look = LOOKS[slot % LOOKS.length], group = new T.Group();
  const model = cloneSkinned(kit.bodies[look.body].scene) as T.Object3D;
  const materials: T.Material[] = [];
  // The greyscale hair texture is ~0.75 bright; the tint is lifted so the colour reads at that brightness.
  const hairTint = new T.Color(look.hairColor).multiplyScalar(1.35);
  const skinMap = kit.textures[`body_${look.body}_${look.skin}.jpg`], hairMap = kit.textures[look.body === "m" ? "hair_1.jpg" : "hair_2.jpg"];
  model.traverse(o => {
    const mesh = o as T.SkinnedMesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as T.Material).name;
    const material = name.startsWith("MI_Superhero") ? outfitMaterial(skinMap, kit.textures[`outfit_${look.body}.png`], color)
      : name === "MI_Eyes" ? new T.MeshStandardMaterial({ map: kit.textures["eye.jpg"], roughness: .3 })
      : new T.MeshStandardMaterial({ map: hairMap, color: hairTint, roughness: .8 });
    mesh.material = material; materials.push(material); mesh.castShadow = true; mesh.frustumCulled = false;
  });
  // Size from the posed (skinned) body vertices, before hair is added; feet on the ground.
  model.updateMatrixWorld(true);
  const bounds = new T.Box3();
  model.traverse(o => { const mesh = o as T.SkinnedMesh; if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); bounds.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)); } });
  const tall = bounds.isEmpty() ? 1.5 : bounds.max.y - bounds.min.y;
  model.scale.multiplyScalar(height / tall);
  model.position.y -= (bounds.isEmpty() ? 0 : bounds.min.y) * height / tall;
  // Hairstyles (and a beard) are skinned to the same skeleton; they follow the head.
  for (const hair of [look.hair, look.beard ? "beard" : undefined]) {
    if (!hair) continue;
    const source = kit.hairs[hair]?.scene;
    if (!source) continue;
    const copy = cloneSkinned(source) as T.Object3D, meshes: T.SkinnedMesh[] = [];
    // Collect first: moving meshes onto the body while traversing would skip children.
    copy.traverse(o => { if ((o as T.SkinnedMesh).isSkinnedMesh) meshes.push(o as T.SkinnedMesh); });
    meshes.forEach(mesh => {
      const material = new T.MeshStandardMaterial({ map: (mesh.material as T.Material).name === "MI_Hair_1" ? kit.textures["hair_1.jpg"] : kit.textures["hair_2.jpg"], color: hairTint, roughness: .85 });
      mesh.material = material; materials.push(material); mesh.castShadow = true; mesh.frustumCulled = false;
      bindTo(mesh, model); model.add(mesh);
    });
  }
  group.add(model);

  const mixer = new T.AnimationMixer(model), actions = new Map<string, T.AnimationAction>();
  for (const clip of kit.clips) {
    const action = mixer.clipAction(clip);
    if (ONE_SHOTS.includes(clip.name)) { action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; }
    actions.set(clip.name, action);
  }
  let loop: LoopState = "idle", shot: T.AnimationAction | undefined;
  actions.get("idle")!.play();
  const fadeTo = (next: T.AnimationAction, from?: T.AnimationAction) => { next.reset().setEffectiveWeight(1).fadeIn(FADE).play(); if (from && from !== next) from.fadeOut(FADE); };
  mixer.addEventListener("finished", event => {
    if (event.action !== shot) return;
    fadeTo(actions.get(loop)!, shot); shot = undefined;
  });
  return {
    group, height,
    setLoop(state, speed = 1) {
      const current = actions.get(loop)!, next = actions.get(state)!;
      next.timeScale = state === "jog" || state === "sprint" ? Math.max(.6, Math.min(1.8, speed)) : 1;
      if (state === loop) return;
      loop = state;
      if (!shot) fadeTo(next, current); else current.fadeOut(FADE);
    },
    play(name) {
      const action = actions.get(name);
      if (!action) return;
      const from = shot ?? actions.get(loop);
      shot = action; fadeTo(action, from);
    },
    // Body animations explain actions (running, being hit), so they also run with reduced motion.
    update(dt) { mixer.update(dt); },
    dispose() { mixer.stopAllAction(); materials.forEach(m => m.dispose()); }
  };
}
