// Renders the scene many times with one sun sample and one sky sample each and averages the results.
// That yields soft shadows, sky occlusion in crevices and smooth edges without a path tracer.
import * as THREE from "three";
import { buildHomeScene } from "./scene";

const query = new URLSearchParams(location.search);
const W = Number(query.get("w") ?? 1000), H = Number(query.get("h") ?? 1080), PASSES = Number(query.get("n") ?? 96);
const EXPOSURE = Number(query.get("exposure") ?? 1.1);

const state = { done: false, progress: 0, error: "", png: "" };
(window as unknown as { __bake: typeof state }).__bake = state;

function halton(index: number, base: number) {
  let f = 1, r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) { f /= base; r += f * (i % base); }
  return r;
}

const SKY_ZENITH = new THREE.Color("#5f70d8"), SKY_HORIZON = new THREE.Color("#e0c2f0"), BELOW = new THREE.Color("#8a9fe8");
const SUN_DIR = new THREE.Vector3(-.5, .66, .74).normalize();

try {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.append(renderer.domElement);

  const { scene, camera, billboards } = buildHomeScene(W / H);
  billboards.forEach(o => o.quaternion.copy(camera.quaternion).premultiply(o.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()));

  const shadowed = (size: number) => {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    light.shadow.mapSize.set(size, size);
    Object.assign(light.shadow.camera, { left: -4.2, right: 4.2, top: 4.6, bottom: -3.4, near: 2, far: 40 });
    light.shadow.bias = -.0006;
    light.shadow.normalBias = .012;
    scene.add(light, light.target);
    light.target.position.set(0, 1, 0);
    return light;
  };
  const sun = shadowed(2048), sky = shadowed(1024);
  const bounce = new THREE.DirectionalLight(0xffffff, 1);
  scene.add(bounce, bounce.target);
  bounce.target.position.set(0, 1, 0);

  const sceneTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const sumTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  const quadScene = new THREE.Scene().add(quad);
  const vertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }";
  const add = new THREE.ShaderMaterial({
    uniforms: { map: { value: sceneTarget.texture } }, vertexShader,
    fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }",
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor, depthTest: false, depthWrite: false
  });
  // Averages, restores straight alpha, tone-maps (Khronos PBR Neutral keeps saturated colours) and encodes sRGB.
  const resolve = new THREE.ShaderMaterial({
    uniforms: { map: { value: sumTarget.texture }, passes: { value: PASSES }, exposure: { value: EXPOSURE } }, vertexShader,
    fragmentShader: `uniform sampler2D map; uniform float passes; uniform float exposure; varying vec2 vUv;
      vec3 neutral(vec3 c) {
        float x = min(c.r, min(c.g, c.b));
        float offset = x < .08 ? x - 6.25 * x * x : .04;
        c -= offset;
        float peak = max(c.r, max(c.g, c.b));
        if (peak < .76) return c;
        float d = 1. - .76;
        float newPeak = 1. - d * d / (peak + d - .76);
        c *= newPeak / peak;
        float g = 1. - 1. / (.15 * (peak - newPeak) + 1.);
        return mix(c, vec3(newPeak), g);
      }
      void main() {
        vec4 s = texture2D(map, vUv) / passes;
        vec3 c = s.a > .0001 ? s.rgb / s.a : vec3(0.);
        c = neutral(c * exposure);
        c = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.)), vec3(1. / 2.4)) - .055, step(.0031308, c));
        gl_FragColor = vec4(c, clamp(s.a, 0., 1.));
      }`,
    blending: THREE.NoBlending, depthTest: false, depthWrite: false
  });

  renderer.setRenderTarget(sumTarget);
  renderer.clear();
  renderer.autoClear = false;

  let pass = 0;
  const up = new THREE.Vector3(), color = new THREE.Color();
  const step = () => {
    for (let k = 0; k < 4 && pass < PASSES; k++, pass++) {
      const i = pass + 1;
      camera.setViewOffset(W, H, halton(i, 2) - .5, halton(i, 3) - .5, W, H);

      // Sun: a small disc, which softens shadow edges.
      const a = halton(i, 5) * Math.PI * 2, r = Math.sqrt(halton(i, 7)) * .035;
      sun.position.copy(SUN_DIR).add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)).normalize().multiplyScalar(20).add(sun.target.position);
      sun.color.set("#fff1d8");
      sun.intensity = 2.9;

      // Sky: one direction of the upper dome per pass; the average is the whole dome with occlusion.
      const y = halton(i, 11), phi = halton(i, 13) * Math.PI * 2, s = Math.sqrt(1 - y * y);
      up.set(Math.cos(phi) * s, y, Math.sin(phi) * s);
      color.copy(SKY_HORIZON).lerp(SKY_ZENITH, Math.pow(y, .6));
      sky.color.copy(color);
      sky.intensity = .7 * 2 * Math.PI;
      sky.position.copy(up).multiplyScalar(20).add(sky.target.position);

      // Light from below, unshadowed: haze under the island.
      const by = halton(i, 17), bphi = halton(i, 19) * Math.PI * 2, bs = Math.sqrt(1 - by * by);
      bounce.position.set(Math.cos(bphi) * bs, -by, Math.sin(bphi) * bs).multiplyScalar(20).add(bounce.target.position);
      bounce.color.copy(BELOW);
      bounce.intensity = .34 * 2 * Math.PI;

      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      quad.material = add;
      renderer.setRenderTarget(sumTarget);
      renderer.render(quadScene, quadCamera);
    }
    state.progress = pass / PASSES;
    if (pass < PASSES) { requestAnimationFrame(step); return; }
    quad.material = resolve;
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(quadScene, quadCamera);
    state.png = renderer.domElement.toDataURL("image/png");
    state.done = true;
  };
  step();
} catch (error) {
  state.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  state.done = true;
}
