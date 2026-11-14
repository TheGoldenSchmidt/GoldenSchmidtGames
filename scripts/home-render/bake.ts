// Renders the start screen layers (scripts/home-render/layers.ts) to src/assets/home/<id>.webp.
//   npm run render:home                       all layers at full quality
//   npm run render:home -- hero slab-gold     only these layers
//   npm run render:home -- --draft --out=DIR  quick preview: a quarter of the passes, written to DIR
// Re-running overwrites the same files; the scenes are seeded, so unchanged sources give the same images.
// Set PLAYWRIGHT_CHROMIUM_PATH if the installed browser does not match the Playwright version.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { LAYERS } from "./layers";

const args = process.argv.slice(2);
const option = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split("=")[1];
const draft = args.includes("--draft");
const only = args.filter(a => !a.startsWith("--"));
const unknown = only.filter(id => !LAYERS.some(l => l.id === id));
if (unknown.length) throw new Error(`Unbekannte Ebene: ${unknown.join(", ")}. Vorhanden: ${LAYERS.map(l => l.id).join(", ")}`);
const outDir = path.resolve(option("out") ?? "src/assets/home");
const layers = LAYERS.filter(l => !only.length || only.includes(l.id));

const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { port: 5198, strictPort: true, host: "127.0.0.1" } });
await server.listen();
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
});
try {
  await mkdir(outDir, { recursive: true });
  for (const layer of layers) {
    const started = Date.now();
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    page.on("pageerror", error => console.error(error.message));
    const passes = draft ? Math.max(8, Math.round(layer.passes / 4)) : layer.passes;
    await page.goto(`http://127.0.0.1:5198/scripts/home-render/index.html?layer=${layer.id}&n=${passes}`);
    await page.waitForFunction("window.__bake && window.__bake.done", undefined, { timeout: 900_000, polling: 250 });
    const state = await page.evaluate("({ error: window.__bake.error, image: window.__bake.image })") as { error: string; image: string };
    await page.close();
    if (state.error) throw new Error(`${layer.id}: ${state.error}`);
    if (!state.image.startsWith("data:image/webp")) throw new Error(`${layer.id}: Browser lieferte kein WebP`);
    const file = path.join(outDir, `${layer.id}.webp`);
    const data = Buffer.from(state.image.split(",")[1], "base64");
    await writeFile(file, data);
    console.log(`${layer.id.padEnd(22)} ${layer.width} × ${layer.height}  ${passes} Durchgänge  ${(data.length / 1024).toFixed(0).padStart(4)} KB  ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
} finally {
  await browser.close();
  await server.close();
}
