import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

type Color = [number, number, number, number];

type Point = [number, number];
type Shape = { color: Color; bounds: [number, number, number, number] } & (
  | { kind: "rect"; x: number; y: number; width: number; height: number; radius: number }
  | { kind: "circle"; x: number; y: number; radius: number }
  | { kind: "polygon"; points: Point[] }
);

const publicDirectory = path.resolve(process.cwd(), "public");
// The SVG is the single source for every icon. Its deliberately simple shapes
// and outlined lettering need no system fonts, browser, or image dependencies.
const svg = readFileSync(path.join(publicDirectory, "gsg-icon.svg"), "utf8");
const shapes: Shape[] = [...svg.matchAll(/<(rect|circle|polygon)\b([^>]+)\/>/g)].map(([, kind, source]) => {
  const attributes = Object.fromEntries([...source.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
  const n = (key: string) => Number(attributes[key] ?? 0);
  const hex = attributes.fill;
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Unsupported icon color: ${hex}`);
  const color: Color = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
  if (kind === "rect") {
    const x = n("x"), y = n("y"), width = n("width"), height = n("height");
    return { kind, color, x, y, width, height, radius: n("rx"), bounds: [x, y, x + width, y + height] };
  }
  if (kind === "circle") {
    const x = n("cx"), y = n("cy"), radius = n("r");
    return { kind, color, x, y, radius, bounds: [x - radius, y - radius, x + radius, y + radius] };
  }
  const points = attributes.points.trim().split(/\s+/).map(point => point.split(",").map(Number) as Point);
  return { kind: "polygon", color, points, bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] };
});
if (!shapes.length) throw new Error("No icon shapes found");

function contains(shape: Shape, x: number, y: number) {
  const [left, top, right, bottom] = shape.bounds;
  if (x < left || x > right || y < top || y > bottom) return false;
  if (shape.kind === "rect") return insideRoundedRect(x, y, shape.x, shape.y, shape.width, shape.height, shape.radius);
  if (shape.kind === "circle") return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
  let inside = false;
  for (let i = 0, j = shape.points.length - 1; i < shape.points.length; j = i++) {
    const [xi, yi] = shape.points[i], [xj, yj] = shape.points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  typeBuffer.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return result;
}

function insideRoundedRect(x: number, y: number, left: number, top: number, width: number, height: number, radius: number) {
  const right = left + width;
  const bottom = top + height;
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function render(size: number) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 4;
  const scale = 512 / size;
  const foreground = [...shapes].reverse();
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const channels = [0, 0, 0];
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = (x + (sx + .5) / samples) * scale;
          const py = (y + (sy + .5) / samples) * scale;
          // Opaque navy corners let Android apply any launcher mask. All
          // lettering and pips sit inside the central 80% safe circle.
          const color = foreground.find(shape => contains(shape, px, py))?.color ?? shapes[0].color;
          for (let c = 0; c < 3; c += 1) channels[c] += color[c];
        }
      }
      const offset = (y * size + x) * 4;
      for (let c = 0; c < 3; c += 1) pixels[offset + c] = Math.round(channels[c] / (samples * samples));
      pixels[offset + 3] = 255;
    }
  }

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0;
    pixels.copy(raw, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const [name, size] of [["gsg-icon-192.png", 192], ["gsg-icon-512.png", 512], ["gsg-apple-touch-icon.png", 180]] as const) {
  writeFileSync(path.join(publicDirectory, name), render(size));
}
console.log("GSG-Icons aus gsg-icon.svg erzeugt: 180, 192 und 512 Pixel");
