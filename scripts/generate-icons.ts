import { writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

type Color = [number, number, number, number];

const palette = {
  night: [18, 23, 47, 255] as Color,
  cream: [247, 244, 236, 255] as Color,
  coral: [255, 123, 107, 255] as Color,
  mint: [89, 217, 184, 255] as Color,
  blue: [39, 60, 117, 255] as Color
};

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
  const setPixel = (x: number, y: number, color: Color) => {
    const offset = (y * size + x) * 4;
    pixels.set(color, offset);
  };
  const card = { x: size * .13, y: size * .215, w: size * .74, h: size * .57, r: size * .115 };
  const circles = [
    { x: size * .332, y: size * .406, r: size * .053, color: palette.coral },
    { x: size * .668, y: size * .406, r: size * .053, color: palette.mint }
  ];
  const line = { x1: size * .324, x2: size * .676, y: size * .594, r: size * .041 };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let color = palette.night;
      if (insideRoundedRect(x, y, card.x, card.y, card.w, card.h, card.r)) color = palette.cream;
      for (const circle of circles) {
        if ((x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.r ** 2) color = circle.color;
      }
      const lineX = Math.max(line.x1, Math.min(x, line.x2));
      if ((x - lineX) ** 2 + (y - line.y) ** 2 <= line.r ** 2) color = palette.blue;
      setPixel(x, y, color);
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

const publicDirectory = path.resolve(process.cwd(), "public");
for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]] as const) {
  writeFileSync(path.join(publicDirectory, name), render(size));
}
console.log("PWA-Icons erzeugt: 180, 192 und 512 Pixel");
