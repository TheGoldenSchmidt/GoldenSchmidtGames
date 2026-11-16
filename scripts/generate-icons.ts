import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

// The icons are checked in. Run npm run generate:icons when the crest artwork changes.
const layers = ["valley", "plaque", "crown", "golden", "schmidt", "games"] as const;
const sources = await Promise.all(layers.map(async name => {
  const bytes = await readFile(`src/assets/expedition/${name}.webp`);
  return `data:image/webp;base64,${bytes.toString("base64")}`;
}));
const outputs = [
  ["gsg-icon-32.png", 32],
  ["gsg-apple-touch-icon.png", 180],
  ["gsg-icon-192.png", 192],
  ["gsg-icon-512.png", 512]
] as const;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH });
try {
  const page = await browser.newPage();
  const pngs = await page.evaluate(async ({ sources, sizes }) => {
    const [valley, plaque, crown, golden, schmidt, games] = await Promise.all(sources.map(async src => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return image;
    }));
    const master = document.createElement("canvas");
    master.width = master.height = 1024;
    const ctx = master.getContext("2d", { alpha: false })!;
    ctx.scale(2, 2);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(valley, 320, 0, 810, 810, 0, 0, 512, 512);
    ctx.fillStyle = "rgba(17, 21, 44, 0.64)";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(plaque, -20, -4, 552, 520);

    // Trace the shared seams with the next letters in the original title sprites.
    // The crown and initials fit inside the launcher's central 80%-diameter safe circle.
    const initials = [
      { source: golden, x: 70, y: 224, scale: 1.02,
        outline: "M0 0 H121 L126 22 Q114 43 115 71 Q114 95 123 115 L124 125 L110 137 L95 151 H0 Z" },
      { source: schmidt, x: 197, y: 216, scale: 1.02,
        outline: "M0 0 H109 L119 20 Q105 37 102 70 Q101 100 113 121 L108 140 L93 170 H0 Z" },
      { source: games, x: 318, y: 225, scale: 1.08,
        outline: "M0 0 H113 L116 24 L109 47 L116 60 L113 85 L105 107 L109 117 L100 135 H0 Z" }
    ];
    for (const { source, outline, x, y, scale } of initials) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.clip(new Path2D(outline));
      ctx.drawImage(source, 0, 0);
      ctx.restore();
    }
    ctx.drawImage(crown, 168, 83, 176, 138);

    return sizes.map(size => {
      const icon = document.createElement("canvas");
      icon.width = icon.height = size;
      const target = icon.getContext("2d", { alpha: false })!;
      target.imageSmoothingQuality = "high";
      target.drawImage(master, 0, 0, size, size);
      return icon.toDataURL("image/png").split(",")[1];
    });
  }, { sources, sizes: outputs.map(([, size]) => size) });
  for (const [index, [name]] of outputs.entries()) {
    await writeFile(`public/${name}`, Buffer.from(pngs[index], "base64"));
  }
} finally {
  await browser.close();
}
