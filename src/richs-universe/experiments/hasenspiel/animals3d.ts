import * as T from "three";
import type { Color, Kind } from "./rules";

type Point = [number, number, number];

export function animal(kind: Kind, color: Color, geometry: T.SphereGeometry, geometries: Set<T.BufferGeometry>) {
  const model = new T.Group();
  const blue = color === "blue";
  const surface = kind === "rabbit" ? new T.SphereGeometry(1, 24, 16) : geometry;
  geometries.add(surface);
  const stone = new T.MeshStandardMaterial({
    color: blue ? "#608ac2" : "#a5a4ac", roughness: .37, metalness: .28,
    emissive: blue ? "#21477d" : "#323645", emissiveIntensity: .18,
  });
  const detail = new T.MeshStandardMaterial({ color: blue ? "#233857" : "#41404a", roughness: .6 });
  const accent = new T.MeshStandardMaterial({ color: blue ? "#aec9e8" : "#ddd5c6", roughness: .42 });
  function oval(at: Point, size: Point, material = stone, tilt = 0) {
    const mesh = new T.Mesh(surface, material);
    mesh.position.set(...at);
    mesh.scale.set(...size);
    mesh.rotation.z = tilt;
    model.add(mesh);
  }
  function branch(points: Point[], radius: number, material = stone) {
    const curve = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
    const tube = new T.TubeGeometry(curve, 8, radius, 5, false);
    geometries.add(tube);
    model.add(new T.Mesh(tube, material));
  }

  if (kind === "rabbit") {
    const pedestal = new T.CylinderGeometry(6.95, 7.25, 1.45, 32);
    geometries.add(pedestal);
    const base = new T.Mesh(pedestal, stone);
    base.position.y = .725;
    model.add(base);
    oval([0, 1.12, 0], [7.02, .64, 7.02]);
    oval([0, 7.3, -1.9], [4.95, 5.85, 4.45], stone, -.08);
    oval([0, 9.85, .65], [3.7, 5.55, 3.65]);
    // Sculpt the forehead, cheek and sloping muzzle as one continuous surface.
    const head = new T.SphereGeometry(1, 40, 28);
    const vertices = head.getAttribute("position");
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const z = vertices.getZ(i);
      const front = Math.max(0, z);
      const taper = front * front;
      const cheek = Math.exp(-((y + .32) ** 2 * 12 + (z - .34) ** 2 * 6));
      vertices.setXYZ(i,
        x * (3.64 - 1.72 * taper + .52 * cheek),
        14.38 + y * (4.15 - 1.85 * taper) - 2.38 * taper,
        1.57 + 4.36 * z + .65 * taper);
    }
    head.computeVertexNormals();
    geometries.add(head);
    model.add(new T.Mesh(head, stone));
    oval([0, 12.09, 6.53], [.64, .39, .22]);
    oval([0, 4.9, -5.15], [1.85, 1.85, 1.65]);
    for (const sign of [-1, 1]) {
      const earHeight = sign > 0 ? 5.1 : 5.65;
      const tilt = -sign * .34;
      oval([sign * 3.12, 20.05, .7], [1.82, earHeight, 1.07], stone, tilt);
      oval([sign * 3.15, 20.25, 1.48], [1.11, earHeight - .9, .49], accent, tilt);
      oval([sign * 3.25, 5.35, -1.93], [2.52, 3.81, 3.27]);
      oval([sign * 1.85, 5.05, 2.95], [1.24, 3.24, 1.15], stone, -sign * .08);
      oval([sign * 1.9, 2.25, 4.05], [1.45, .9, 1.95]);
      oval([sign * 3.35, 2.15, -.13], [2.14, .79, 2.3]);
      const eye = new T.Mesh(surface, stone);
      eye.position.set(sign * 2.84, 15.08, 3.69);
      eye.scale.set(.26, .59, 1.04);
      eye.rotation.x = -.26;
      eye.rotation.y = sign * .35;
      model.add(eye);
      branch([[sign * 3.01, 15.28, 3.02], [sign * 3.08, 15.48, 3.69], [sign * 2.82, 15.22, 4.43]], .14);
    }
  } else if (kind === "monkey") {
    oval([0, 8, -.75], [3.9, 3.3, 6.5]);
    oval([0, 10, 5.6], [3.1, 3.25, 3.1]);
    oval([0, 9.3, 7.6], [2.55, 2, 2], accent);
    branch([[0, 9, -5], [0, 12, -8], [1, 17, -8], [3, 20, -5], [1, 19, -3], [0, 17.5, -4]], .9);
    for (const sign of [-1, 1]) {
      oval([sign * 2.7, 10.5, 5.1], [1.25, 1.4, 1.1]);
      oval([sign * 1.05, 10.6, 8.25], [.45, .48, .42], detail);
      branch([[sign * 2.5, 8, 3], [sign * 4.25, 4.5, 4.6], [sign * 4.4, 1.2, 7]], 1.15);
      branch([[sign * 2, 8, -5], [sign * 4.5, 4.6, -3], [sign * 4.9, 1, -6]], 1.25);
      oval([sign * 4.4, 1, 7.5], [1.5, .8, 1.6]);
    }
  } else {
    oval([0, 10, -1], [3.55, 3.8, 7.5]);
    oval([0, 13, 4.7], [2, 5, 2.3]);
    oval([0, 17, 6], [2.1, 2.05, 3.35]);
    oval([0, 16.35, 8.7], [1.5, 1.25, 1.3], accent);
    for (const sign of [-1, 1]) {
      oval([sign * 2, 18, 5.4], [1.6, .75, 1.25], stone, sign * .4);
      oval([sign * 1.65, 17.6, 7.55], [.4, .45, .4], detail);
      for (const z of [-5, 3.4]) {
        branch([[sign * 2.15, 9, z], [sign * 2.4, 5, z - .7], [sign * 2.4, 1.2, z]], .75);
        oval([sign * 2.4, .9, z + .5], [1, .9, 1.4], detail);
      }
      branch([[sign, 18, 5], [sign * 2.5, 21, 4], [sign * 5.5, 24, 3], [sign * 7.5, 27, 3]], .52, accent);
      branch([[sign * 4.3, 23, 3.4], [sign * 4.5, 25, 5], [sign * 5.3, 26.6, 6]], .38, accent);
      branch([[sign * 5.8, 24.5, 3], [sign * 6.5, 26.5, 1], [sign * 7, 28, 0]], .33, accent);
    }
  }

  model.scale.setScalar(kind === "deer" ? .88 : 1);
  model.rotation.y = blue ? .48 : Math.PI + .48;
  return model;
}
