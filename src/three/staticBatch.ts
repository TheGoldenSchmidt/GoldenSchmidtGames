import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Bake immobile, untextured scenery into a few vertex-coloured draw calls. */
export function batchScenery(group: T.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<string, { material: T.MeshStandardMaterial; geometry: T.BufferGeometry[] }>();
  const sources: T.Mesh[] = [], originals = new Set<T.BufferGeometry>();
  group.traverse(object => {
    if (!(object instanceof T.Mesh) || !(object.material instanceof T.MeshStandardMaterial) || object.material.map) return;
    const material = object.material;
    const key = `${material.roughness}/${material.metalness}/${material.flatShading}/${material.side}`;
    let batch = batches.get(key);
    if (!batch) {
      const copy = material.clone(); copy.color.set(0xffffff); copy.vertexColors = true;
      batch = { material: copy, geometry: [] }; batches.set(key, batch);
    }
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
    const count = geometry.getAttribute("position").count, colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) material.color.toArray(colors, i * 3);
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
    for (const attr of Object.keys(geometry.attributes)) if (!["position", "normal", "color"].includes(attr)) geometry.deleteAttribute(attr);
    batch.geometry.push(geometry); sources.push(object); originals.add(object.geometry);
  });
  for (const source of sources) source.removeFromParent();
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometry, false)!;
    batch.geometry.forEach(g => g.dispose()); geometry.computeBoundingSphere();
    const mesh = new T.Mesh(geometry, batch.material);
    mesh.castShadow = mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; group.add(mesh);
  }
  originals.forEach(g => g.dispose());
}
