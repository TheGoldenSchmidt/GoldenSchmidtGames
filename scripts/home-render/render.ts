// Browser side of the bake. Renders one layer many times, each pass with one sample of the sun disc,
// one direction of the sky dome and a sub-pixel camera offset, and averages the passes. That gives soft
// shadows, sky occlusion in crevices (ambient occlusion) and clean edges without a path tracer.
// Afterwards: bloom, tone mapping (Khronos PBR Neutral), colour grading, sRGB and WebP export.
//
// Query: ?layer=<id>[&n=<passes>][&scale=<0..1>][&live=1]
import * as THREE from "three";
import { type Layer, LAYERS } from "./layers";

const query = new URLSearchParams(location.search);
const layer = LAYERS.find(l => l.id === query.get("layer")) ?? LAYERS[0];
const scale = Number(query.get("scale") ?? 1);
const W = Math.round(layer.width * scale), H = Math.round(layer.height * scale);
const PASSES = Number(query.get("n") ?? layer.passes);

const state = { done: false, progress: 0, error: "", image: "", layer: layer.id, width: W, height: H };
(window as unknown as { __bake: typeof state }).__bake = state;

function halton(index: number, base: number) {
  let f = 1, r = 0;
  for (let i = index; i > 0; i = Math.floor(i / base)) { f /= base; r += f * (i % base); }
  return r;
}

/** A warm studio sky for metals: they reflect it, nothing else sees it. */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const sphere = new THREE.SphereGeometry(10, 32, 16);
  const p = sphere.attributes.position;
  const colors = new Float32Array(p.count * 3), c = new THREE.Color();
  const top = new THREE.Color("#fff3dc"), horizon = new THREE.Color("#d8a868"), ground = new THREE.Color("#3a2416");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 10;
    if (y > 0) c.copy(horizon).lerp(top, Math.pow(y, .5)); else c.copy(horizon).lerp(ground, Math.pow(-y, .4));
    colors.set([c.r * 1.2, c.g * 1.2, c.b * 1.2], i * 3);
  }
  sphere.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.8) }));
  sun.position.set(-4.6, 6, 5.4);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, .02).texture;
  pmrem.dispose();
  return texture;
}

function fitShadow(light: THREE.DirectionalLight, centre: THREE.Vector3, radius: number, direction: THREE.Vector3) {
  light.target.position.copy(centre);
  light.position.copy(direction).multiplyScalar(radius * 2).add(centre);
  Object.assign(light.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: .1, far: radius * 4 });
  light.shadow.camera.updateProjectionMatrix();
}

const vertexShader = "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }";

class Post {
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private scene = new THREE.Scene().add(this.quad);
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(private renderer: THREE.WebGLRenderer) {}
  run(material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }
}

const shader = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>, blending: THREE.Blending = THREE.NoBlending) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, blending, depthTest: false, depthWrite: false });

function bake(layer: Layer) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.append(renderer.domElement);

  const { scene, camera } = layer.build();
  const environment = studioEnvironment(renderer);
  scene.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.userData?.reflective) { m.envMap = environment; m.envMapIntensity = 1; m.needsUpdate = true; }
    if (o.userData.billboard) o.quaternion.copy(camera.quaternion).premultiply(o.parent!.getWorldQuaternion(new THREE.Quaternion()).invert());
  });

  // Shadow cameras cover the casting objects (the sky background is not part of the bounds).
  const box = new THREE.Box3();
  scene.traverse(o => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).castShadow) box.expandByObject(o); });
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const shadowLight = (size: number) => {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    light.shadow.mapSize.set(size, size);
    light.shadow.bias = -.0004;
    light.shadow.normalBias = sphere.radius * .0025;
    scene.add(light, light.target);
    return light;
  };
  const L = layer.lighting;
  const sun = shadowLight(4096), sky = shadowLight(1024);
  const rim = new THREE.DirectionalLight(L.rimColor, L.rimIntensity);
  rim.position.set(...L.rim).add(sphere.center);
  rim.target.position.copy(sphere.center);
  const bounce = new THREE.DirectionalLight(L.bounceColor, 1);
  bounce.target.position.copy(sphere.center);
  scene.add(rim, rim.target, bounce, bounce.target);

  const float = { type: THREE.FloatType, depthBuffer: false };
  const sceneTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
  const sum = new THREE.WebGLRenderTarget(W, H, float);
  const post = new Post(renderer);
  const add = shader("uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }", { map: { value: sceneTarget.texture } }, THREE.CustomBlending);
  Object.assign(add, { blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });

  renderer.setRenderTarget(sum);
  renderer.clear();
  renderer.autoClear = false;

  const sunDir = new THREE.Vector3(...L.sun).normalize();
  const zenith = new THREE.Color(L.skyZenith), horizon = new THREE.Color(L.skyHorizon), dir = new THREE.Vector3();
  const sunTangent = new THREE.Vector3().crossVectors(sunDir, new THREE.Vector3(0, 1, 0)).normalize();
  const sunBitangent = new THREE.Vector3().crossVectors(sunTangent, sunDir);
  const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? camera as THREE.PerspectiveCamera : undefined;
  const ortho = (camera as THREE.OrthographicCamera).isOrthographicCamera ? camera as THREE.OrthographicCamera : undefined;
  const orthoBase = ortho ? { left: ortho.left, right: ortho.right, top: ortho.top, bottom: ortho.bottom } : undefined;
  let pass = 0;

  const accumulate = () => {
    for (let k = 0; k < 4 && pass < PASSES; k++, pass++) {
      const i = pass + 1, jx = halton(i, 2) - .5, jy = halton(i, 3) - .5;
      if (perspective) perspective.setViewOffset(W, H, jx, jy, W, H);
      if (ortho && orthoBase) {
        const px = (orthoBase.right - orthoBase.left) / W, py = (orthoBase.top - orthoBase.bottom) / H;
        Object.assign(ortho, { left: orthoBase.left + jx * px, right: orthoBase.right + jx * px, top: orthoBase.top - jy * py, bottom: orthoBase.bottom - jy * py });
        ortho.updateProjectionMatrix();
      }
      // Sun: a small disc, which softens shadow edges.
      const a = halton(i, 5) * Math.PI * 2, r = Math.sqrt(halton(i, 7)) * L.sunSpread;
      dir.copy(sunDir).addScaledVector(sunTangent, Math.cos(a) * r).addScaledVector(sunBitangent, Math.sin(a) * r).normalize();
      fitShadow(sun, sphere.center, sphere.radius, dir);
      sun.color.set(L.sunColor);
      sun.intensity = L.sunIntensity;
      // Sky: one direction of the upper dome per pass; the average is the whole dome with occlusion.
      const y = halton(i, 11), phi = halton(i, 13) * Math.PI * 2, s = Math.sqrt(1 - y * y);
      fitShadow(sky, sphere.center, sphere.radius, dir.set(Math.cos(phi) * s, y, Math.sin(phi) * s));
      sky.color.copy(horizon).lerp(zenith, Math.pow(y, .6));
      sky.intensity = L.skyIntensity * Math.PI;
      // Light from below, unshadowed: the haze under the island.
      const by = halton(i, 17), bphi = halton(i, 19) * Math.PI * 2, bs = Math.sqrt(1 - by * by);
      bounce.position.set(Math.cos(bphi) * bs, -by, Math.sin(bphi) * bs).add(sphere.center);
      bounce.intensity = L.bounceIntensity * Math.PI;

      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      post.run(add, sum);
    }
    state.progress = pass / PASSES;
    if (pass < PASSES) requestAnimationFrame(accumulate); else finish();
  };

  const finish = () => {
    const G = layer.grade, half = { type: THREE.HalfFloatType, depthBuffer: false };
    // Average, straight colour (alpha stays separate) in linear light.
    const hdr = new THREE.WebGLRenderTarget(W, H, half);
    post.run(shader(`uniform sampler2D map; uniform float passes; varying vec2 vUv;
      void main() { vec4 s = texture2D(map, vUv) / passes; gl_FragColor = vec4(s.a > .0001 ? s.rgb / s.a : vec3(0.), clamp(s.a, 0., 1.)); }`,
      { map: { value: sum.texture }, passes: { value: PASSES } }), hdr);

    // Bloom: bright parts, blurred at five sizes.
    const levels: THREE.WebGLRenderTarget[] = [];
    if (G.bloom > 0) {
      const bright = shader(`uniform sampler2D map; uniform float threshold; varying vec2 vUv;
        void main() { vec4 c = texture2D(map, vUv); vec3 p = c.rgb * c.a; float l = max(p.r, max(p.g, p.b));
          float k = clamp((l - threshold) / max(l, .0001), 0., 1.); gl_FragColor = vec4(p * k * k, 1.); }`, { map: { value: hdr.texture }, threshold: { value: G.bloomThreshold } });
      const copy = shader("uniform sampler2D map; varying vec2 vUv; void main() { gl_FragColor = texture2D(map, vUv); }", { map: { value: null } });
      const blur = shader(`uniform sampler2D map; uniform vec2 step; varying vec2 vUv;
        void main() { vec3 c = texture2D(map, vUv).rgb * .2270;
          c += (texture2D(map, vUv + step * 1.3846).rgb + texture2D(map, vUv - step * 1.3846).rgb) * .3162;
          c += (texture2D(map, vUv + step * 3.2308).rgb + texture2D(map, vUv - step * 3.2308).rgb) * .0703;
          gl_FragColor = vec4(c, 1.); }`, { map: { value: null }, step: { value: new THREE.Vector2() } });
      let source: THREE.Texture = hdr.texture;
      for (let level = 0; level < 5; level++) {
        const w = Math.max(1, W >> (level + 1)), h = Math.max(1, H >> (level + 1));
        const a = new THREE.WebGLRenderTarget(w, h, half), b = new THREE.WebGLRenderTarget(w, h, half);
        if (level === 0) post.run(bright, a); else { copy.uniforms.map.value = source; post.run(copy, a); }
        blur.uniforms.map.value = a.texture; blur.uniforms.step.value.set(1 / w, 0); post.run(blur, b);
        blur.uniforms.map.value = b.texture; blur.uniforms.step.value.set(0, 1 / h); post.run(blur, a);
        levels.push(a);
        source = a.texture;
      }
    }

    const final = shader(`uniform sampler2D map; uniform sampler2D b0, b1, b2, b3, b4; uniform float bloom, exposure, saturation, contrast, vignette;
      varying vec2 vUv;
      vec3 neutral(vec3 c) {
        float x = min(c.r, min(c.g, c.b)); float offset = x < .08 ? x - 6.25 * x * x : .04; c -= offset;
        float peak = max(c.r, max(c.g, c.b)); if (peak < .76) return c;
        float d = .24; float newPeak = 1. - d * d / (peak + d - .76); c *= newPeak / peak;
        float g = 1. - 1. / (.15 * (peak - newPeak) + 1.); return mix(c, vec3(newPeak), g);
      }
      void main() {
        vec4 h = texture2D(map, vUv);
        vec3 glow = (texture2D(b0, vUv).rgb * .8 + texture2D(b1, vUv).rgb * .9 + texture2D(b2, vUv).rgb + texture2D(b3, vUv).rgb * .9 + texture2D(b4, vUv).rgb * .8) * bloom * .22;
        vec3 premul = h.rgb * h.a + glow;
        float a = clamp(h.a + dot(glow, vec3(.3, .5, .2)) * 1.4, 0., 1.);
        vec3 c = a > .0001 ? premul / a : vec3(0.);
        c = neutral(c * exposure);
        float luma = dot(c, vec3(.2126, .7152, .0722));
        c = mix(vec3(luma), c, saturation);
        // Cool, violet shadows and warm highlights, as in the reference.
        c += (vec3(-.012, -.006, .03) * (1. - luma) + vec3(.02, .008, -.02) * luma) * .9;
        c = clamp((c - .5) * contrast + .5, 0., 1.);
        vec2 q = vUv - .5; c *= 1. - vignette * smoothstep(.25, .85, dot(q, q) * 2.6);
        c = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.)), vec3(1. / 2.4)) - .055, step(.0031308, c));
        gl_FragColor = vec4(c, a);
      }`, {
      map: { value: hdr.texture }, bloom: { value: G.bloom }, exposure: { value: G.exposure }, saturation: { value: G.saturation },
      contrast: { value: G.contrast }, vignette: { value: G.vignette },
      ...Object.fromEntries([0, 1, 2, 3, 4].map(i => [`b${i}`, { value: levels[i]?.texture ?? null }]))
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(null);
    renderer.clear();
    post.run(final, null);
    state.image = renderer.domElement.toDataURL("image/webp", layer.quality);
    state.done = true;
  };

  accumulate();
}

/** Live view for editing the scene: one realtime pass with soft shadows, no accumulation. */
function live(layer: Layer) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = layer.grade.exposure;
  document.body.append(renderer.domElement);
  const { scene, camera } = layer.build();
  const environment = studioEnvironment(renderer);
  scene.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.userData?.reflective) { m.envMap = environment; m.needsUpdate = true; }
    if (o.userData.billboard) o.quaternion.copy(camera.quaternion);
  });
  const L = layer.lighting;
  const box = new THREE.Box3().setFromObject(scene), sphere = box.getBoundingSphere(new THREE.Sphere());
  const sun = new THREE.DirectionalLight(L.sunColor, L.sunIntensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  fitShadow(sun, sphere.center, sphere.radius, new THREE.Vector3(...L.sun).normalize());
  scene.add(sun, sun.target, new THREE.HemisphereLight(L.skyZenith, L.bounceColor, L.skyIntensity * 2.2));
  const rim = new THREE.DirectionalLight(L.rimColor, L.rimIntensity);
  rim.position.set(...L.rim);
  scene.add(rim);
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  state.done = true;
}

try {
  if (query.get("live")) live(layer); else bake(layer);
} catch (error) {
  state.error = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  state.done = true;
}
