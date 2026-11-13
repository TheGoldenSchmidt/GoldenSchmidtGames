import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { isRiggedCharacter, RIGGED_CHARACTERS, type RiggedCharacterId } from "../../shared/characters";

/**
 * Rigged, animated characters. Humans are Quaternius Universal Base Characters
 * (CC0) with hairstyles, outfits painted by garment region, optional comic
 * shading and accessories; "Bolt" and "Glubschi" are own designs built from
 * primitives on the same 65-bone skeleton. All share the clips of the Universal
 * Animation Library 1 and 2 (built by scripts/assets/build-characters.mjs).
 */
export type LoopState = "idle" | "jog" | "sprint" | "push" | "air" | "slide" | "dance";
export type OneShot = "dash" | "hit" | "hitLight" | "jumpStart" | "land" | "slideStart" | "cheer" | "roll" | "punch" | "death";
const ONE_SHOTS: readonly string[] = ["dash", "hit", "hitLight", "jumpStart", "land", "slideStart", "cheer", "roll", "punch", "death"];

type Body = "m" | "f";
/** A garment colour: fixed, or the player's colour. */
type Paint = number | "player";
interface Outfit {
  shirt?: Paint; sleeves?: Paint; shorts?: Paint; legs?: Paint; shoes?: Paint; gloves?: Paint;
  /** Widening along the normal in metres per region (shirt, sleeves, shorts, legs). */
  wide?: [number, number, number, number];
  /** 0 keeps the skin's painted shading under the colour, 1 is plain cloth. */
  flat?: number;
}
interface Human {
  kind: "human"; body: Body; skin: "light" | "dark"; hair?: string; beard?: boolean;
  /** The hair texture is greyscale (the source tints it in the engine); this is the tint. */
  hairColor: number;
  /** Without an outfit the underwear takes the player colour. */
  outfit?: Outfit;
  /** Comic look: stepped shading and a dark outline. */
  toon?: boolean;
  /** Bone scales for stylised proportions. */
  scale?: { head?: number; hands?: number; feet?: number };
  accessories?: ("hoodie" | "baggy" | "cap" | "chain" | "shades" | "emblem" | "mask")[];
}
interface Built { kind: "robot" | "monster" }
type Spec = Human | Built;

export const RIGGED_SPECS: Record<RiggedCharacterId, Spec> = {
  rig_jonas: { kind: "human", body: "m", skin: "light", hair: "simpleparted", hairColor: 0x6b4423 },
  rig_amara: { kind: "human", body: "f", skin: "dark", hair: "buns", hairColor: 0x2b1d16 },
  rig_malik: { kind: "human", body: "m", skin: "dark", hair: "buzzed", beard: true, hairColor: 0x1f1714 },
  rig_lena: { kind: "human", body: "f", skin: "light", hair: "long", hairColor: 0xe0b85c },
  rig_erik: { kind: "human", body: "m", skin: "light", hair: "buzzed", beard: true, hairColor: 0xb4532a },
  rig_zoe: { kind: "human", body: "f", skin: "dark", hair: "buzzedfemale", hairColor: 0xe07a24 },
  // Rapper: wide hoodie in the player colour, baggy dark jeans, white sneakers, cap, shades, big gold chain.
  rig_mc_goldie: { kind: "human", body: "m", skin: "dark", hair: "buzzed", beard: true, hairColor: 0x1a1412,
    outfit: { shirt: "player", sleeves: "player", shorts: 0x27335a, legs: 0x27335a, shoes: 0xfff9ed, flat: 1 }, accessories: ["baggy", "hoodie", "cap", "shades", "chain"] },
  // Comic heroine in the game's palette: big head and hands, stepped shading, outline.
  rig_kiki_komet: { kind: "human", body: "f", skin: "light", hair: "buns", hairColor: 0xff5fa8, toon: true, scale: { head: 1.3, hands: 1.35, feet: 1.25 },
    outfit: { shirt: "player", shorts: 0x6544e8, legs: 0xffe44e, shoes: 0xffe44e, gloves: 0xffe44e, wide: [.012, 0, .012, .02], flat: 1 }, accessories: ["emblem", "mask"] },
  rig_bolt: { kind: "robot" },
  rig_glubschi: { kind: "monster" }
};
/** Players without a rigged choice get one of the six base humans by colour slot. */
const BASE: readonly RiggedCharacterId[] = ["rig_jonas", "rig_amara", "rig_malik", "rig_lena", "rig_erik", "rig_zoe"];
/** The rigged character a player shows: the chosen one, or a base human by slot. */
export const riggedIdFor = (chosen: unknown, slot: number): RiggedCharacterId => isRiggedCharacter(chosen) ? chosen : BASE[((slot % BASE.length) + BASE.length) % BASE.length];
const HAIRS = ["simpleparted", "buns", "buzzed", "long", "buzzedfemale", "beard"] as const;

export interface CharacterKit {
  bodies: Record<Body, GLTF>;
  hairs: Record<string, GLTF>;
  /** Bare skeleton that carries the clips; base of the built characters. */
  rig: T.Object3D;
  clips: T.AnimationClip[];
  textures: Record<string, T.Texture>;
}

let pending: Promise<CharacterKit> | undefined, ready: CharacterKit | undefined;
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
    ready = { bodies: { m, f }, hairs: Object.fromEntries(HAIRS.map((h, i) => [h, hairs[i]])), rig: anims.scene, clips: anims.animations, textures };
    return ready;
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
/** The kit after `loadCharacterKit()` resolved (scenes preload it); throws otherwise. */
export function characterKit(): CharacterKit { if (!ready) throw new Error("Animierte Figuren werden noch geladen."); return ready; }

export interface RiggedFigure {
  group: T.Group;
  /** Height of the scaled figure in world units. */
  height: number;
  setLoop(state: LoopState, speed?: number): void;
  play(action: OneShot): void;
  update(dt: number): void;
  dispose(): void;
}

const FADE = .16, INK = 0x24133f;
let ramp: T.DataTexture | undefined;
/** Three-step light ramp for the comic look. */
function toonRamp() {
  if (ramp) return ramp;
  ramp = new T.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true; return ramp;
}

/**
 * Body material: skin texture plus garments. Regions come from the vertex
 * attributes `_ga`/`_gb` (see the build script); without an outfit the masked
 * underwear takes the player colour. `wide` pushes clothed regions outwards.
 */
function bodyMaterial(spec: Human, map: T.Texture, mask: T.Texture, player: number) {
  const material: T.MeshStandardMaterial | T.MeshToonMaterial = spec.toon ? new T.MeshToonMaterial({ map, gradientMap: toonRamp() }) : new T.MeshStandardMaterial({ map, roughness: .62, metalness: 0 });
  const o = spec.outfit, paint = (p: Paint | undefined) => new T.Color(p === undefined ? 0 : p === "player" ? player : p), on = (p: Paint | undefined) => p === undefined ? 0 : 1;
  const uniforms = {
    outfitMap: { value: mask }, outfitColor: { value: new T.Color(player) }, outfitOn: { value: o ? 0 : 1 },
    cShirt: { value: paint(o?.shirt) }, cSleeves: { value: paint(o?.sleeves) }, cShorts: { value: paint(o?.shorts) }, cLegs: { value: paint(o?.legs) }, cShoes: { value: paint(o?.shoes) }, cGloves: { value: paint(o?.gloves) },
    gaOn: { value: new T.Vector4(on(o?.shirt), on(o?.sleeves), on(o?.shorts), on(o?.legs)) }, gbOn: { value: new T.Vector2(on(o?.shoes), on(o?.gloves)) },
    gWide: { value: new T.Vector4(...(o?.wide ?? [0, 0, 0, 0])) }, gFlat: { value: o?.flat ?? .5 }
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = "attribute vec4 _ga;\nattribute vec2 _gb;\nvarying vec4 vGa;\nvarying vec2 vGb;\nuniform vec4 gWide;\nuniform vec4 gaOn;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vGa = _ga; vGb = _gb;
      transformed += normalize(objectNormal) * dot(_ga * gaOn, gWide);`);
    shader.fragmentShader = "uniform sampler2D outfitMap;\nuniform vec3 outfitColor;\nuniform float outfitOn;\nuniform vec3 cShirt;\nuniform vec3 cSleeves;\nuniform vec3 cShorts;\nuniform vec3 cLegs;\nuniform vec3 cShoes;\nuniform vec3 cGloves;\nuniform vec4 gaOn;\nuniform vec2 gbOn;\nuniform float gFlat;\nvarying vec4 vGa;\nvarying vec2 vGb;\n" + shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      float shade = dot(diffuseColor.rgb, vec3(.299, .587, .114));
      float fold = mix(.8 + .45 * shade, 1., gFlat);
      diffuseColor.rgb = mix(diffuseColor.rgb, outfitColor * (.55 + .9 * shade), texture2D(outfitMap, vMapUv).r * outfitOn);
      diffuseColor.rgb = mix(diffuseColor.rgb, cShirt * fold, smoothstep(.42, .58, vGa.x) * gaOn.x);
      diffuseColor.rgb = mix(diffuseColor.rgb, cSleeves * fold, smoothstep(.42, .58, vGa.y) * gaOn.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, cShorts * fold, smoothstep(.42, .58, vGa.z) * gaOn.z);
      diffuseColor.rgb = mix(diffuseColor.rgb, cLegs * fold, smoothstep(.42, .58, vGa.w) * gaOn.w);
      diffuseColor.rgb = mix(diffuseColor.rgb, cShoes * fold, smoothstep(.42, .58, vGb.x) * gbOn.x);
      diffuseColor.rgb = mix(diffuseColor.rgb, cGloves * fold, smoothstep(.42, .58, vGb.y) * gbOn.y);`);
  };
  // One program per feature set; the uniforms differ per figure.
  material.customProgramCacheKey = () => `rigged-body-${spec.toon ? "toon" : "std"}`;
  return material;
}

/** Dark hull behind a mesh: the comic outline. Follows widened garments on the body. */
function outline(mesh: T.SkinnedMesh, width: number, wide?: Outfit) {
  const hull = mesh.clone() as T.SkinnedMesh, garments = !!mesh.geometry.getAttribute("_ga");
  const material = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });
  const gWide = { value: new T.Vector4(...(wide?.wide ?? [0, 0, 0, 0])) }, gaOn = { value: new T.Vector4(wide?.shirt === undefined ? 0 : 1, wide?.sleeves === undefined ? 0 : 1, wide?.shorts === undefined ? 0 : 1, wide?.legs === undefined ? 0 : 1) };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { gWide, gaOn });
    shader.vertexShader = (garments ? "attribute vec4 _ga;\nuniform vec4 gWide;\nuniform vec4 gaOn;\n" : "") + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      transformed += normalize(objectNormal) * (${width.toFixed(4)}${garments ? " + dot(_ga * gaOn, gWide)" : ""});`);
  };
  material.customProgramCacheKey = () => `rigged-outline-${garments}-${width}`;
  hull.material = material; hull.castShadow = false; hull.frustumCulled = false;
  mesh.parent!.add(hull);
  return material;
}

/** Rebinds a separately loaded skinned mesh (hair) to the body's bones by name. */
function bindTo(mesh: T.SkinnedMesh, body: T.Object3D) {
  const bones = mesh.skeleton.bones.map(b => (body.getObjectByName(b.name) as T.Bone | undefined) ?? b);
  mesh.bind(new T.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
}

/** World-space bounds (rest pose) of the vertices mainly driven by the named bones. */
function boneBounds(mesh: T.SkinnedMesh, names: RegExp) {
  const box = new T.Box3(), index = mesh.geometry.attributes.skinIndex, weight = mesh.geometry.attributes.skinWeight, v = new T.Vector3();
  const wanted = mesh.skeleton.bones.map(b => names.test(b.name));
  for (let i = 0; i < index.count; i++) {
    let w = 0; for (let k = 0; k < 4; k++) if (wanted[index.getComponent(i, k)]) w += weight.getComponent(i, k);
    if (w > .6) box.expandByPoint(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld));
  }
  return box;
}

const std = (color: number, extra: T.MeshStandardMaterialParameters = {}) => new T.MeshStandardMaterial({ color, roughness: .6, ...extra });
/** Adds a mesh that is placed in world space (rest pose) and then follows `bone`. */
function attach(bone: T.Object3D, geometry: T.BufferGeometry, material: T.Material, place: (m: T.Mesh) => void, into: T.Material[]) {
  const mesh = new T.Mesh(geometry, material); place(mesh); mesh.castShadow = true; mesh.updateMatrixWorld(true);
  bone.attach(mesh); if (!into.includes(material)) into.push(material); return mesh;
}

/** Capsule from bone `a` towards bone `b` (rest pose), following `a`; `reach` < 1 stops short of `b`. */
function limbPart(model: T.Object3D, a: string, b: string, radius: number, material: T.Material, into: T.Material[], reach = 1) {
  const p = model.getObjectByName(a)!.getWorldPosition(new T.Vector3()), q = model.getObjectByName(b)!.getWorldPosition(new T.Vector3()).sub(p).multiplyScalar(reach).add(p);
  return attach(model.getObjectByName(a)!, new T.CapsuleGeometry(radius, Math.max(.01, p.distanceTo(q) - radius), 6, 12), material, m => { m.position.copy(p).lerp(q, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), q.clone().sub(p).normalize()); }, into);
}

/** Clothing pieces and accessories, fitted to the rest pose of this body; each follows one bone. */
function accessorize(spec: Human, model: T.Object3D, body: T.SkinnedMesh, player: number, materials: T.Material[]) {
  const bone = (n: string) => model.getObjectByName(n)!, at = (n: string) => bone(n).getWorldPosition(new T.Vector3());
  const head = boneBounds(body, /^Head$/), c = head.getCenter(new T.Vector3()), size = head.getSize(new T.Vector3()), radius = Math.max(size.x, size.z) / 2;
  const paint = (p: Paint | undefined, fallback: number) => p === undefined ? fallback : p === "player" ? player : p;
  const neck = at("neck_01"), chest = boneBounds(body, /^spine_0[23]$/), torso = at("spine_01").lerp(at("spine_03"), .55);
  // Half axes of the hoodie body; also the surface the chain and emblem rest on.
  const hoodie = spec.accessories?.includes("hoodie") ? new T.Vector3(.26, .33, .21) : undefined;
  const frontAt = (x: number, y: number) => hoodie
    ? torso.z + hoodie.z * Math.sqrt(Math.max(.05, 1 - ((y - torso.y) / hoodie.y) ** 2 - (x / hoodie.x) ** 2))
    : chest.max.z + (spec.outfit?.wide?.[0] ?? 0);
  for (const item of spec.accessories ?? []) {
    if (item === "hoodie") {
      // Wide hoodie: a roomy body, puffy sleeves, a hood on the back and a belly pocket.
      const cloth = std(paint(spec.outfit?.shirt, player), { roughness: .92 }), trim = std(new T.Color(paint(spec.outfit?.shirt, player)).multiplyScalar(.72).getHex(), { roughness: .92 });
      attach(bone("spine_02"), new T.SphereGeometry(1, 24, 18), cloth, m => { m.scale.copy(hoodie!); m.position.copy(torso); }, materials);
      attach(bone("spine_03"), new T.SphereGeometry(1, 16, 12), trim, m => { m.scale.set(.17, .13, .11); m.position.set(neck.x, neck.y - .01, neck.z - .11); }, materials);
      attach(bone("spine_02"), new T.BoxGeometry(.24, .1, .04), trim, m => m.position.set(torso.x, torso.y - .2, frontAt(0, torso.y - .2) - .012), materials);
      for (const s of ["l", "r"]) {
        attach(bone(`upperarm_${s}`), new T.SphereGeometry(.12, 14, 12), cloth, m => m.position.copy(at(`upperarm_${s}`)), materials);
        limbPart(model, `upperarm_${s}`, `lowerarm_${s}`, .095, cloth, materials);
        limbPart(model, `lowerarm_${s}`, `hand_${s}`, .088, cloth, materials, .86);
      }
    } else if (item === "baggy") {
      // Baggy trousers: wide seat and legs that stop above the sneakers.
      const cloth = std(paint(spec.outfit?.shorts, 0x27335a), { roughness: .9 }), hips = at("pelvis");
      attach(bone("pelvis"), new T.SphereGeometry(1, 20, 14), cloth, m => { m.scale.set(.22, .17, .18); m.position.set(hips.x, hips.y - .03, hips.z + .02); }, materials);
      for (const s of ["l", "r"]) { limbPart(model, `thigh_${s}`, `calf_${s}`, .115, cloth, materials); limbPart(model, `calf_${s}`, `foot_${s}`, .105, cloth, materials, .9); }
    } else if (item === "cap") {
      const cloth = std(INK), accent = std(player);
      // Crown over the upper head, flat brim to the front, button on top.
      attach(bone("Head"), new T.SphereGeometry(radius * 1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI * .5), cloth, m => m.position.set(c.x, head.max.y - radius * .82, c.z - radius * .04), materials);
      attach(bone("Head"), new T.CylinderGeometry(radius * 1.02, radius * 1.02, .018, 20, 1, false, -Math.PI * .5, Math.PI), accent, m => { m.position.set(c.x, head.max.y - radius * .78, c.z + radius * .75); m.scale.z = 1.7; m.rotation.x = .12; }, materials);
      attach(bone("Head"), new T.SphereGeometry(radius * .14, 8, 6), accent, m => { m.userData.extra = true; m.position.set(c.x, head.max.y + radius * .28, c.z - radius * .04); }, materials);
    } else if (item === "shades") {
      const glass = std(0x0b0b12, { roughness: .15, metalness: .4 });
      for (const side of [-1, 1]) attach(bone("Head"), new T.BoxGeometry(radius * .72, radius * .36, .03), glass, m => m.position.set(c.x + side * radius * .42, head.min.y + size.y * .56, head.max.z - .005), materials);
      attach(bone("Head"), new T.BoxGeometry(radius * 1.9, radius * .08, .025), glass, m => m.position.set(c.x, head.min.y + size.y * .62, head.max.z - .01), materials);
    } else if (item === "chain") {
      // Big gold chain: two strands of links from the collar down to a heavy medallion.
      // It follows the same bone as the hoodie body, so it stays on the cloth when the chest leans.
      const gold = std(0xffc533, { roughness: .25, metalness: .85 }), low = new T.Vector3(neck.x, neck.y - .3, 0);
      for (const side of [-1, 1]) {
        const top = new T.Vector3(neck.x + side * .1, neck.y - .05, 0);
        for (let i = 0; i <= 5; i++) attach(bone("spine_02"), new T.TorusGeometry(.032, .012, 6, 12), gold, m => {
          const k = i / 5, x = top.x + (low.x - top.x) * k, y = top.y + (low.y - top.y) * k;
          m.position.set(x, y, frontAt(x, y) + .02); m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, side * .45);
        }, materials);
      }
      const y = low.y - .1;
      attach(bone("spine_02"), new T.CylinderGeometry(.1, .1, .03, 24), gold, m => { m.rotation.x = Math.PI / 2; m.position.set(low.x, y, frontAt(0, y) + .03); }, materials);
      attach(bone("spine_02"), new T.CylinderGeometry(.055, .055, .04, 6), std(INK, { roughness: .2, metalness: .3 }), m => { m.rotation.x = Math.PI / 2; m.position.set(low.x, y, frontAt(0, y) + .034); }, materials);
    } else if (item === "emblem") {
      // Five-pointed star on the chest.
      const star = new T.Shape();
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? .034 : .08; if (i) star.lineTo(Math.cos(a) * r, Math.sin(a) * r); else star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const y = neck.y - .2;
      attach(bone("spine_02"), new T.ExtrudeGeometry(star, { depth: .012, bevelEnabled: false }), new T.MeshToonMaterial({ color: 0xffe44e, gradientMap: toonRamp() }), m => m.position.set(neck.x, y, frontAt(0, y) + .004), materials);
    } else if (item === "mask") {
      // Hero mask: a band around the eyes.
      attach(bone("Head"), new T.CylinderGeometry(radius * 1.03, radius * 1.03, size.y * .2, 24, 1, true, -Math.PI * .55, Math.PI * 1.1), new T.MeshToonMaterial({ color: 0x6544e8, gradientMap: toonRamp(), side: T.DoubleSide }), m => m.position.set(c.x, head.min.y + size.y * .57, c.z), materials);
    }
  }
}

function buildHuman(kit: CharacterKit, spec: Human, player: number, materials: T.Material[]) {
  const model = cloneSkinned(kit.bodies[spec.body].scene) as T.Object3D, hulls: T.SkinnedMesh[] = [];
  // The greyscale hair texture is ~0.75 bright; the tint is lifted so the colour reads at that brightness.
  const hairTint = new T.Color(spec.hairColor).multiplyScalar(1.35);
  const skinMap = kit.textures[`body_${spec.body}_${spec.skin}.jpg`], hairMap = kit.textures[spec.body === "m" ? "hair_1.jpg" : "hair_2.jpg"];
  const surface = (parameters: T.MeshStandardMaterialParameters) => spec.toon ? new T.MeshToonMaterial({ map: parameters.map, gradientMap: toonRamp(), ...(parameters.color === undefined ? {} : { color: parameters.color }) }) : new T.MeshStandardMaterial(parameters);
  let body: T.SkinnedMesh | undefined;
  model.traverse(o => {
    const mesh = o as T.SkinnedMesh;
    if (!mesh.isMesh) return;
    const name = (mesh.material as T.Material).name;
    if (name.startsWith("MI_Superhero")) body = mesh;
    const material = name.startsWith("MI_Superhero") ? bodyMaterial(spec, skinMap, kit.textures[`outfit_${spec.body}.png`], player)
      : name === "MI_Eyes" ? surface({ map: kit.textures["eye.jpg"], roughness: .3 })
      : surface({ map: hairMap, color: hairTint, roughness: .8 });
    mesh.material = material; materials.push(material); mesh.castShadow = true; mesh.frustumCulled = false;
    if (name !== "MI_Eyes") hulls.push(mesh);
  });
  // Hairstyles (and a beard) are skinned to the same skeleton; they follow the head.
  for (const hair of [spec.hair, spec.beard ? "beard" : undefined]) {
    const source = hair ? kit.hairs[hair]?.scene : undefined;
    if (!source) continue;
    const copy = cloneSkinned(source) as T.Object3D, meshes: T.SkinnedMesh[] = [];
    // Collect first: moving meshes onto the body while traversing would skip children.
    copy.traverse(o => { if ((o as T.SkinnedMesh).isSkinnedMesh) meshes.push(o as T.SkinnedMesh); });
    meshes.forEach(mesh => {
      const material = surface({ map: (mesh.material as T.Material).name === "MI_Hair_1" ? kit.textures["hair_1.jpg"] : kit.textures["hair_2.jpg"], color: hairTint, roughness: .85 });
      mesh.material = material; materials.push(material); mesh.castShadow = true; mesh.frustumCulled = false;
      bindTo(mesh, model); model.add(mesh); hulls.push(mesh);
    });
  }
  model.updateMatrixWorld(true);
  if (body) accessorize(spec, model, body, player, materials);
  if (spec.toon) for (const mesh of hulls) materials.push(outline(mesh, mesh === body ? .011 : .008, mesh === body ? spec.outfit : undefined));
  // Stylised proportions: clips carry no scale tracks, so bone scales persist.
  const scale = (names: string[], k?: number) => { if (k) for (const n of names) model.getObjectByName(n)?.scale.multiplyScalar(k); };
  scale(["Head"], spec.scale?.head); scale(["hand_l", "hand_r"], spec.scale?.hands); scale(["foot_l", "foot_r"], spec.scale?.feet);
  return { model, pelvis: 1 };
}

/** Own characters from primitives: every part is placed in the rest pose and follows one bone. */
function buildParts(kit: CharacterKit, kind: Built["kind"], player: number, materials: T.Material[]) {
  const model = kit.rig.clone(true), bone = (n: string) => model.getObjectByName(n)!;
  // Proportions: shorter limbs by scaling the rest offsets (clips only rotate these bones).
  const legs = kind === "robot" ? .72 : .52, arms = kind === "robot" ? .92 : .7;
  model.updateMatrixWorld(true);
  const hip = bone("thigh_l").getWorldPosition(new T.Vector3()).y, leg = bone("calf_l").position.length() + bone("foot_l").position.length();
  for (const s of ["l", "r"]) { bone(`calf_${s}`).position.multiplyScalar(legs); bone(`foot_${s}`).position.multiplyScalar(legs); bone(`lowerarm_${s}`).position.multiplyScalar(arms); bone(`hand_${s}`).position.multiplyScalar(arms); }
  // The hips come down with the legs; the clips' hip height is scaled by the same factor.
  const pelvis = (hip - leg * (1 - legs)) / hip;
  bone("pelvis").position.multiplyScalar(pelvis);
  model.updateMatrixWorld(true);
  const at = (n: string) => bone(n).getWorldPosition(new T.Vector3());
  const add = (to: string, geometry: T.BufferGeometry, material: T.Material, place: (m: T.Mesh) => void) => attach(bone(to), geometry, material, place, materials);
  const limb = (a: string, b: string, radius: number, material: T.Material) => limbPart(model, a, b, radius, material, materials);
  const head = at("Head"), chest = at("spine_02"), hips = at("pelvis");
  if (kind === "robot") {
    // "Bolt": a friendly box robot – screen face, antenna, player-coloured panels.
    const shell = std(0xdfe6ee, { roughness: .35, metalness: .35 }), dark = std(0x39425a, { roughness: .5, metalness: .4 }), accent = std(player, { roughness: .4 }), glow = new T.MeshBasicMaterial({ color: 0x57e4cb }), screen = std(0x141627, { roughness: .2 });
    add("spine_02", new T.BoxGeometry(.46, .44, .3), shell, m => m.position.set(chest.x, chest.y + .04, chest.z));
    add("spine_02", new T.BoxGeometry(.24, .16, .02), accent, m => m.position.set(chest.x, chest.y + .08, chest.z + .155));
    for (const dx of [-.06, 0, .06]) add("spine_02", new T.SphereGeometry(.018, 8, 6), glow, m => m.position.set(chest.x + dx, chest.y - .08, chest.z + .155));
    add("pelvis", new T.BoxGeometry(.34, .16, .24), dark, m => m.position.set(hips.x, hips.y + .02, hips.z + .03));
    add("neck_01", new T.CylinderGeometry(.05, .05, .1, 10), dark, m => m.position.set(head.x, head.y - .02, head.z - .01));
    add("Head", new T.BoxGeometry(.48, .38, .38), shell, m => m.position.set(head.x, head.y + .2, head.z));
    add("Head", new T.BoxGeometry(.38, .24, .02), screen, m => m.position.set(head.x, head.y + .2, head.z + .195));
    for (const side of [-1, 1]) {
      add("Head", new T.BoxGeometry(.07, .1, .02), glow, m => m.position.set(head.x + side * .09, head.y + .22, head.z + .2));
      add("Head", new T.CylinderGeometry(.06, .06, .05, 12), accent, m => { m.rotation.z = Math.PI / 2; m.position.set(head.x + side * .26, head.y + .2, head.z); });
    }
    add("Head", new T.BoxGeometry(.12, .02, .02), glow, m => m.position.set(head.x, head.y + .13, head.z + .2));
    add("Head", new T.CylinderGeometry(.012, .012, .16, 6), dark, m => { m.userData.extra = true; m.position.set(head.x, head.y + .47, head.z); });
    add("Head", new T.SphereGeometry(.045, 10, 8), accent, m => { m.userData.extra = true; m.position.set(head.x, head.y + .57, head.z); });
    for (const s of ["l", "r"]) {
      const sh = at(`upperarm_${s}`), hand = at(`hand_${s}`), foot = at(`foot_${s}`), toe = at(`ball_${s}`);
      add(`upperarm_${s}`, new T.SphereGeometry(.1, 12, 10), accent, m => m.position.copy(sh));
      limb(`upperarm_${s}`, `lowerarm_${s}`, .05, dark); limb(`lowerarm_${s}`, `hand_${s}`, .065, shell);
      add(`hand_${s}`, new T.SphereGeometry(.085, 12, 10), dark, m => m.position.copy(hand).add(new T.Vector3(s === "l" ? .04 : -.04, 0, 0)));
      limb(`thigh_${s}`, `calf_${s}`, .065, dark); limb(`calf_${s}`, `foot_${s}`, .085, shell);
      add(`foot_${s}`, new T.BoxGeometry(.17, .1, .3), accent, m => m.position.set(foot.x, toe.y + .04, (foot.z + toe.z) / 2 + .03));
    }
  } else {
    // "Glubschi": a round one-eyed monster in the player colour with horns, belly and big feet.
    const fur = std(player, { roughness: .85 }), deep = std(new T.Color(player).multiplyScalar(.7).getHex(), { roughness: .85 }), belly = std(0xfff3d6, { roughness: .9 }), bone1 = std(0xfff9ed, { roughness: .5 }), ink = std(INK, { roughness: .3 }), eye = std(0xffffff, { roughness: .2 });
    const centre = chest.clone().lerp(hips, .45);
    add("spine_02", new T.SphereGeometry(.5, 24, 18), fur, m => { m.scale.set(.82, .86, .74); m.position.copy(centre); });
    add("spine_02", new T.SphereGeometry(.5, 20, 14), belly, m => { m.scale.set(.56, .58, .3); m.position.set(centre.x, centre.y - .06, centre.z + .26); });
    add("pelvis", new T.ConeGeometry(.09, .34, 10), deep, m => { m.rotation.x = -Math.PI / 2 - .5; m.position.set(hips.x, hips.y - .02, hips.z - .36); });
    add("Head", new T.SphereGeometry(.36, 24, 18), fur, m => { m.scale.set(1, .92, .95); m.position.set(head.x, head.y + .12, head.z); });
    add("Head", new T.SphereGeometry(.17, 20, 16), eye, m => m.position.set(head.x, head.y + .17, head.z + .26));
    add("Head", new T.SphereGeometry(.08, 14, 12), ink, m => m.position.set(head.x, head.y + .17, head.z + .385));
    add("Head", new T.SphereGeometry(.025, 8, 6), eye, m => m.position.set(head.x + .03, head.y + .2, head.z + .455));
    add("Head", new T.SphereGeometry(.12, 16, 10), ink, m => { m.scale.set(1.3, .34, .5); m.position.set(head.x, head.y - .07, head.z + .31); });
    for (const side of [-1, 1]) {
      add("Head", new T.ConeGeometry(.035, .07, 6), bone1, m => { m.rotation.x = Math.PI; m.position.set(head.x + side * .07, head.y - .075, head.z + .355); });
      add("Head", new T.ConeGeometry(.06, .2, 10), bone1, m => { m.userData.extra = true; m.rotation.z = -side * .45; m.position.set(head.x + side * .2, head.y + .45, head.z); });
    }
    for (const s of ["l", "r"]) {
      const hand = at(`hand_${s}`), foot = at(`foot_${s}`), toe = at(`ball_${s}`);
      limb(`upperarm_${s}`, `lowerarm_${s}`, .075, fur); limb(`lowerarm_${s}`, `hand_${s}`, .07, fur);
      add(`hand_${s}`, new T.SphereGeometry(.105, 14, 12), deep, m => m.position.copy(hand).add(new T.Vector3(s === "l" ? .05 : -.05, 0, 0)));
      limb(`thigh_${s}`, `calf_${s}`, .11, fur); limb(`calf_${s}`, `foot_${s}`, .1, fur);
      add(`foot_${s}`, new T.SphereGeometry(.15, 14, 10), deep, m => { m.scale.set(.9, .5, 1.5); m.position.set(foot.x, toe.y + .05, (foot.z + toe.z) / 2 + .05); });
      for (const dx of [-.07, 0, .07]) add(`foot_${s}`, new T.ConeGeometry(.022, .06, 6), bone1, m => { m.rotation.x = Math.PI / 2; m.position.set(foot.x + dx, toe.y + .04, toe.z + .17); });
    }
  }
  return { model, pelvis };
}

/**
 * Fewer draw calls: rigid parts that follow the same bone and share a material
 * become one mesh (a robot or a hoodie is built from dozens of primitives).
 */
function mergeStatic(model: T.Object3D) {
  const parents: T.Object3D[] = [];
  model.traverse(o => { if (o.children.some(c => (c as T.Mesh).isMesh && !(c as T.SkinnedMesh).isSkinnedMesh)) parents.push(o); });
  for (const parent of parents) {
    const groups = new Map<string, T.Mesh[]>();
    for (const child of parent.children) {
      const mesh = child as T.Mesh;
      if (!mesh.isMesh || (mesh as T.SkinnedMesh).isSkinnedMesh) continue;
      const key = `${(mesh.material as T.Material).uuid}:${mesh.userData.extra ? 1 : 0}`;
      groups.set(key, [...(groups.get(key) ?? []), mesh]);
    }
    for (const meshes of groups.values()) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => {
        mesh.updateMatrix();
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
        return g.applyMatrix4(mesh.matrix);
      });
      const merged = new T.Mesh(mergeGeometries(parts), meshes[0].material);
      merged.castShadow = true; merged.userData.extra = meshes[0].userData.extra;
      for (const mesh of meshes) { parent.remove(mesh); mesh.geometry.dispose(); }
      parts.forEach(g => g.dispose());
      parent.add(merged);
    }
  }
}

const scaledClips = new Map<string, T.AnimationClip[]>();
/** Clips with the hip height adapted to shorter legs (cached per factor). */
function clipsFor(kit: CharacterKit, pelvis: number) {
  if (Math.abs(pelvis - 1) < 1e-3) return kit.clips;
  const key = pelvis.toFixed(3);
  let clips = scaledClips.get(key);
  if (!clips) {
    clips = kit.clips.map(c => { const clip = c.clone(); for (const t of clip.tracks) if (t.name === "pelvis.position") t.values = t.values.map(v => v * pelvis); return clip; });
    scaledClips.set(key, clips);
  }
  return clips;
}

/**
 * A player's character, `height` world units tall, facing +Z. `chosen` is the
 * selected character (rigged ids only; others fall back to a base human by slot);
 * `color` is the player colour for clothing and accents.
 */
export function riggedFigure(kit: CharacterKit, chosen: unknown, slot: number, color: number, height: number): RiggedFigure {
  const id = riggedIdFor(chosen, slot), spec = RIGGED_SPECS[id], group = new T.Group(), materials: T.Material[] = [];
  const { model, pelvis } = spec.kind === "human" ? buildHuman(kit, spec, color, materials) : buildParts(kit, spec.kind, color, materials);
  mergeStatic(model);
  group.add(model); group.userData.characterId = id;

  const mixer = new T.AnimationMixer(model), actions = new Map<string, T.AnimationAction>();
  for (const clip of clipsFor(kit, pelvis)) {
    const action = mixer.clipAction(clip);
    if (ONE_SHOTS.includes(clip.name)) { action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; }
    actions.set(clip.name, action);
  }
  let loop: LoopState = "idle", shot: T.AnimationAction | undefined;
  actions.get("idle")!.play();
  // Size and footing from the idle pose (the rest pose is a T-pose): posed vertices of all parts.
  mixer.update(0); model.updateMatrixWorld(true);
  // Antennas, horns and the like (`extra`) sit on top and do not shrink the body.
  const bounds = new T.Box3(), piece = new T.Box3();
  model.traverse(o => { const mesh = o as T.Mesh; if (mesh.isMesh && !mesh.userData.extra && (mesh.material as T.Material).side !== T.BackSide) bounds.union(piece.setFromObject(mesh, true)); });
  const tall = bounds.isEmpty() ? 1.7 : bounds.max.y - bounds.min.y;
  model.scale.multiplyScalar(height / tall);
  model.position.y -= (bounds.isEmpty() ? 0 : bounds.min.y) * height / tall;

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

/** Names for tests and data attributes. */
export const riggedName = (id: RiggedCharacterId) => RIGGED_CHARACTERS.find(c => c.id === id)?.name ?? id;
