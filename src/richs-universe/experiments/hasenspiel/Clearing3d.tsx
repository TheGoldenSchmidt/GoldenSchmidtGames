import { useEffect, useRef } from "react";
import * as T from "three";
import { boardHeight, gap, height, side, triangle, width } from "./boardDrawing";
import { CENTER, cells, type Game } from "./rules";
import { animal } from "./animals3d";

const angle = Math.PI * .36;
const groundScale = 1 / Math.sin(angle);
const viewWidth = width + 50;
const viewHeight = boardHeight + 4;
const groundY = (y: number) => (y - boardHeight / 2) * groundScale;

function createScene(canvas: HTMLCanvasElement) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 3000);
  camera.position.set(0, 850 * Math.sin(angle), 850 * Math.cos(angle));
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight("#fff5dc", "#576b86", 1.9));
  const sun = new T.DirectionalLight("#ffe0a8", 2.25);
  sun.position.set(-300, 500, -240);
  scene.add(sun);
  const rim = new T.DirectionalLight("#91b6f2", .8);
  rim.position.set(280, 180, 150);
  scene.add(rim);

  const geometries = new Set<T.BufferGeometry>();
  const sphere = new T.SphereGeometry(1, 12, 8);
  const disk = new T.CircleGeometry(1, 48);
  geometries.add(sphere).add(disk);
  const grass = new T.MeshStandardMaterial({ color: "#485d36", roughness: 1 });
  const earth = new T.MeshStandardMaterial({ color: "#78623b", roughness: 1 });
  const blue = new T.MeshStandardMaterial({ color: "#758d82", roughness: .95 });
  const gray = new T.MeshStandardMaterial({ color: "#8b896b", roughness: .95 });
  const shrub = new T.MeshStandardMaterial({ color: "#35683a", roughness: .87 });
  const shadow = new T.MeshBasicMaterial({ color: "#192619", transparent: true, opacity: .42, depthWrite: false });

  const floor = new T.Mesh(disk, grass);
  floor.rotation.x = -Math.PI / 2;
  floor.scale.set(width * .68, boardHeight * .49 * groundScale, 1);
  floor.position.y = -.7;
  scene.add(floor);

  for (const cell of cells) {
    if (cell.id === CENTER) continue;
    const field = triangle(cell);
    const coordinates = field.points.split(" ").flatMap(point => {
      const [x, y] = point.split(",").map(Number);
      return [x - width / 2, 0, groundY(y)];
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(coordinates, 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    geometries.add(geometry);
    scene.add(new T.Mesh(geometry, cell.row < 6 ? blue : gray));
  }
  blue.side = gray.side = T.DoubleSide;
  const clearingGeometry = new T.PlaneGeometry(side * 2.5, gap * groundScale);
  geometries.add(clearingGeometry);
  const clearing = new T.Mesh(clearingGeometry, earth);
  clearing.rotation.x = -Math.PI / 2;
  clearing.position.z = groundY(6 * height + gap / 2);
  scene.add(clearing);

  type Piece = NonNullable<Game["board"][string]>;
  const colors = ["blue", "gray"] as const;
  const kinds = ["rabbit", "monkey", "deer"] as const;
  const models = new Map(colors.flatMap(color => kinds.map(kind => [
    `${color}/${kind}`, animal(kind, color, sphere, geometries),
  ] as const)));
  const occupants = new T.Group();
  scene.add(occupants);
  function draw() { renderer.render(scene, camera); }
  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    const scale = Math.min(clientWidth / viewWidth, clientHeight / viewHeight);
    camera.left = -clientWidth / scale / 2;
    camera.right = -camera.left;
    camera.top = clientHeight / scale / 2;
    camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    renderer.setSize(clientWidth, clientHeight, false);
    draw();
  }
  function update(board: Game["board"], wall: Set<string>) {
    occupants.clear();
    for (const cell of cells) {
      const piece: Piece | undefined = board[cell.id];
      if (!piece && !wall.has(cell.id)) continue;
      const point = cell.id === CENTER ? { x: width / 2, y: boardHeight / 2 } : triangle(cell);
      const group = new T.Group();
      group.position.set(point.x - width / 2, 0, groundY(point.y));
      if (wall.has(cell.id)) {
        for (const x of [-7, 0, 7]) {
          const bush = new T.Mesh(sphere, shrub);
          bush.position.set(x, 2, 0);
          bush.scale.set(5, 4, 7);
          group.add(bush);
        }
      }
      if (piece) {
        const contact = new T.Mesh(disk, shadow);
        contact.rotation.x = -Math.PI / 2;
        contact.position.set(1.5, .25, 2.5);
        contact.scale.set(9, 7, 1);
        group.add(contact, models.get(`${piece.color}/${piece.kind}`)!.clone());
      }
      occupants.add(group);
    }
    draw();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return { update, draw, dispose() {
    observer.disconnect();
    const materials = new Set([grass, earth, blue, gray, shrub, shadow]);
    for (const model of models.values()) model.traverse(object => {
      if (object instanceof T.Mesh) materials.add(object.material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    renderer.dispose();
  } };
}

export function Clearing3d({ board, wall, onReady }: {
  board: Game["board"]; wall: Set<string>; onReady: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  useEffect(() => {
    const surface = canvas.current!;
    let view: ReturnType<typeof createScene>;
    try { view = createScene(surface); } catch { return; }
    scene.current = view;
    const lost = (event: Event) => {
      event.preventDefault();
      onReady(false);
    };
    const restored = () => { view.draw(); onReady(true); };
    surface.addEventListener("webglcontextlost", lost);
    surface.addEventListener("webglcontextrestored", restored);
    onReady(true);
    return () => {
      surface.removeEventListener("webglcontextlost", lost);
      surface.removeEventListener("webglcontextrestored", restored);
      scene.current = null;
      view.dispose();
    };
  }, [onReady]);
  useEffect(() => { scene.current?.update(board, wall); }, [board, wall]);
  return <canvas ref={canvas} className="hare-3d-canvas" aria-hidden="true" />;
}
