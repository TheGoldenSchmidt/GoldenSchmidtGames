import * as T from "three";
import type { Color, Kind } from "./rules";

type Point = [number, number, number];

export function animal(kind: Kind, color: Color, geometry: T.SphereGeometry, geometries: Set<T.BufferGeometry>) {
  const model = new T.Group();
  const blue = color === "blue";
  const stone = new T.MeshStandardMaterial({
    color: blue ? "#608ac2" : "#a5a4ac", roughness: .37, metalness: .28,
    emissive: blue ? "#21477d" : "#323645", emissiveIntensity: .18,
  });
  const detail = new T.MeshStandardMaterial({ color: blue ? "#233857" : "#41404a", roughness: .6 });
  const accent = new T.MeshStandardMaterial({ color: blue ? "#aec9e8" : "#ddd5c6", roughness: .42 });
  function oval(at: Point, size: Point, material = stone, tilt = 0) {
    const mesh = new T.Mesh(geometry, material);
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
    oval([0, 7, 0], [5.6, 7, 4.3]);
    oval([0, 13, 1], [4.5, 4.3, 3.7]);
    oval([0, 11.7, 4], [2.7, 1.6, 2], accent);
    oval([0, 12.6, 5.7], [1, .65, .7], detail);
    oval([0, 4, -4], [2.6, 2.6, 2.4]);
    for (const sign of [-1, 1]) {
      oval([sign * 2.8, 18.4, .4], [1.5, 5, 1.2], stone, -sign * .25);
      oval([sign * 3.05, 18.5, 1.25], [.73, 3.4, .48], accent, -sign * .25);
      oval([sign * 3.2, 1.4, 2.35], [2.25, 1.4, 2.75]);
      oval([sign * 3, 8, 3.3], [1.35, 2.8, 1.35], stone, -sign * .55);
      oval([sign * 2.35, 14, 3.72], [.58, .67, .42], detail);
    }
    oval([0, 7.8, 4.8], [1.45, 3, 1.35], accent, -.78);
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
