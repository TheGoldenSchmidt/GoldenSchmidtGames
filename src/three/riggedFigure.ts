import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Rigged GLB figures (Quaternius Mannequin with clips from the Universal
 * Animation Library 2, CC0; built by scripts/assets/build-mannequin.mjs).
 * Each player gets an own skeleton clone, an own tint and an animation mixer
 * with cross-fades between looping states and one-shot actions.
 */
export type LoopState = "idle" | "move" | "fall";
export type OneShot = "dash" | "hit" | "land" | "cheer";

let pending: Promise<GLTF> | undefined;
/** Loads the shared figure once (cached by the service worker afterwards). */
export function loadMannequin(): Promise<GLTF> {
  pending ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/mannequin.glb`).catch(error => { pending = undefined; throw error; });
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

const FADE = .18;

/** A tinted, independently animated copy of the figure, `height` world units tall, facing +Z. */
export function riggedFigure(gltf: GLTF, color: number, height: number): RiggedFigure {
  const model = cloneSkinned(gltf.scene) as T.Object3D, group = new T.Group();
  const material = new T.MeshStandardMaterial({ color, roughness: .55, metalness: .05 });
  model.traverse(o => { const mesh = o as T.Mesh; if (mesh.isMesh) { mesh.material = material; mesh.castShadow = true; mesh.frustumCulled = false; } });
  // Measure the skinned (posed) vertices: the FBX source mixes unit scales between
  // mesh and bones, so plain mesh bounds or bone positions mislead.
  model.updateMatrixWorld(true);
  const bounds = new T.Box3();
  model.traverse(o => { const mesh = o as T.SkinnedMesh; if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); bounds.union(mesh.boundingBox!.clone().applyMatrix4(mesh.matrixWorld)); } });
  const tall = bounds.isEmpty() ? 1 : bounds.max.y - bounds.min.y;
  model.scale.multiplyScalar(height / Math.max(.001, tall));
  // Stand on the ground.
  model.position.y -= (bounds.isEmpty() ? 0 : bounds.min.y) * height / Math.max(.001, tall);
  group.add(model);
  const mixer = new T.AnimationMixer(model), actions = new Map<string, T.AnimationAction>();
  for (const clip of gltf.animations) {
    const action = mixer.clipAction(clip);
    if (["dash", "hit", "land", "cheer"].includes(clip.name)) { action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; }
    actions.set(clip.name, action);
  }
  let loop: LoopState = "idle", shot: T.AnimationAction | undefined;
  const idle = actions.get("idle")!;
  idle.play();
  const fadeTo = (next: T.AnimationAction, from?: T.AnimationAction) => { next.reset().setEffectiveWeight(1).fadeIn(FADE).play(); if (from && from !== next) from.fadeOut(FADE); };
  mixer.addEventListener("finished", event => {
    if (event.action !== shot) return;
    const back = actions.get(loop)!; fadeTo(back, shot); shot = undefined;
  });
  return {
    group, height,
    setLoop(state, speed = 1) {
      const current = actions.get(loop)!, next = actions.get(state)!;
      next.timeScale = state === "move" ? Math.max(.6, Math.min(1.8, speed)) : 1;
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
    update(dt) {
      // Body animations explain actions (walking, being hit), so they also run with reduced motion;
      // shaking and flourishes are left out by the scenes instead.
      mixer.update(dt);
    },
    dispose() { mixer.stopAllAction(); material.dispose(); }
  };
}
