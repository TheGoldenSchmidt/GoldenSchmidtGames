// Every image the start screen uses, with its size, camera and post-processing.
// `npm run render:home` writes them to src/assets/home/<id>.webp.
import * as THREE from "three";
import { backdropCamera, buildBackdrop, buildCorner, cornerCamera } from "./backdrop";
import { buildHero, HERO_WORDS } from "./hero";
import { buildPlank, buildSlab, buildSocket, PLANK_SPRITE, SLAB_SPRITES, spriteCamera } from "./sprites";

export interface Grade {
  exposure: number;
  saturation: number;
  contrast: number;
  bloom: number;
  bloomThreshold: number;
  vignette: number;
}

export interface Lighting {
  /** Direction towards the sun. */
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  sunSpread: number;
  skyZenith: string;
  skyHorizon: string;
  skyIntensity: number;
  rim: [number, number, number];
  rimColor: string;
  rimIntensity: number;
  bounceColor: string;
  bounceIntensity: number;
}

export interface Layer {
  id: string;
  width: number;
  height: number;
  passes: number;
  transparent: boolean;
  quality: number;
  /** Crop the image to its visible content; the position within the full frame goes to hero-layers.json. */
  crop?: boolean;
  build: () => { scene: THREE.Scene; camera: THREE.Camera };
  lighting: Lighting;
  grade: Grade;
}

const WORLD: Lighting = {
  sun: [-.5, .66, .74], sunColor: "#ffeccc", sunIntensity: 2.8, sunSpread: .035,
  skyZenith: "#6474dc", skyHorizon: "#e2c4f2", skyIntensity: .72,
  rim: [.55, .35, -.75], rimColor: "#b9c4ff", rimIntensity: 1.1,
  bounceColor: "#8a9fe8", bounceIntensity: .32
};
const SPRITE: Lighting = {
  ...WORLD, sun: [-.32, .62, .72], sunIntensity: 2.2, sunSpread: .05, skyIntensity: .9, skyZenith: "#c9cff5", skyHorizon: "#f3e6f6",
  rim: [0, -.4, -1], rimIntensity: 0, bounceIntensity: .12
};
const HERO_GRADE: Grade = { exposure: 1.12, saturation: 1.12, contrast: 1.06, bloom: .5, bloomThreshold: .95, vignette: 0 };
const BACKDROP_GRADE: Grade = { exposure: 1.02, saturation: 1.08, contrast: 1.03, bloom: .25, bloomThreshold: 1, vignette: .22 };
const SPRITE_GRADE: Grade = { exposure: 1.12, saturation: 1.02, contrast: 1.04, bloom: 0, bloomThreshold: 1, vignette: 0 };

function heroCamera(width: number, height: number) {
  // Fits a fixed horizontal field so the island keeps its width whatever the image height.
  const aspect = width / height, horizontal = .156;
  const camera = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(Math.atan(horizontal / aspect)) * 2, aspect, 1, 60);
  const target = new THREE.Vector3(0, .95, 0), pitch = THREE.MathUtils.degToRad(9), distance = 16.6;
  camera.position.set(0, target.y + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

/** Full frame of the hero layers in pixels; the page keeps this aspect ratio. */
export const HERO_FRAME = { width: 1000, height: 1195 };

const sprite = (id: string, width: number, height: number, build: () => THREE.Scene): Layer => ({
  id, width, height, passes: 64, transparent: true, quality: .92,
  build: () => ({ scene: build(), camera: spriteCamera(width, height) }), lighting: SPRITE, grade: SPRITE_GRADE
});

export const LAYERS: Layer[] = [
  // The hero in five layers of the same frame, cropped to their content (see HERO_FRAME and hero-layers.json).
  ...(["island", "plaque", ...HERO_WORDS] as const).map((part): Layer => ({
    id: `hero-${part}`, width: HERO_FRAME.width, height: HERO_FRAME.height, passes: part === "island" ? 160 : 128, transparent: true,
    quality: .9, crop: true, build: () => ({ scene: buildHero(part), camera: heroCamera(HERO_FRAME.width, HERO_FRAME.height) }),
    lighting: WORLD, grade: HERO_GRADE
  })),
  {
    id: "backdrop-portrait", width: 900, height: 1950, passes: 96, transparent: false, quality: .86,
    build: () => { const camera = backdropCamera("portrait", 900 / 1950); return { scene: buildBackdrop("portrait", camera), camera }; },
    lighting: WORLD, grade: BACKDROP_GRADE
  },
  {
    id: "backdrop-landscape", width: 1920, height: 1080, passes: 96, transparent: false, quality: .86,
    build: () => { const camera = backdropCamera("landscape", 1920 / 1080); return { scene: buildBackdrop("landscape", camera), camera }; },
    lighting: WORLD, grade: BACKDROP_GRADE
  },
  {
    id: "corner-left", width: 520, height: 600, passes: 96, transparent: true, quality: .88,
    build: () => ({ scene: buildCorner("left"), camera: cornerCamera(520 / 600) }), lighting: WORLD, grade: HERO_GRADE
  },
  {
    id: "corner-right", width: 520, height: 600, passes: 96, transparent: true, quality: .88,
    build: () => ({ scene: buildCorner("right"), camera: cornerCamera(520 / 600) }), lighting: WORLD, grade: HERO_GRADE
  },
  ...(["gold", "violet", "stone"] as const).flatMap(kind => {
    const size = kind === "stone" ? "small" : "big", spec = SLAB_SPRITES[size];
    return [
      sprite(`slab-${kind}`, spec.width, spec.height, () => buildSlab(kind, size, false)),
      sprite(`slab-${kind}-pressed`, spec.width, spec.height, () => buildSlab(kind, size, true))
    ];
  }),
  sprite("plank", PLANK_SPRITE.width, PLANK_SPRITE.height, buildPlank),
  sprite("socket-gold", 96, 96, () => buildSocket("gold")),
  sprite("socket-violet", 96, 96, () => buildSocket("violet"))
];
