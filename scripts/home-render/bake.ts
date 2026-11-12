// Probe: bakes the island scene to a transparent PNG.
//   npx tsx scripts/home-render/bake.ts <out.png> [width] [height] [passes]
// Set PLAYWRIGHT_CHROMIUM_PATH if the installed browser does not match the Playwright version.
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const [out = "island.png", width = "1500", height = "1620", passes = "160"] = process.argv.slice(2);
const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { port: 5198, strictPort: true, host: "127.0.0.1" } });
await server.listen();
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
});
try {
  const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`http://127.0.0.1:5198/scripts/home-render/index.html?w=${width}&h=${height}&n=${passes}`);
  await page.waitForFunction("window.__bake && window.__bake.done", undefined, { timeout: 900_000, polling: 500 });
  const state = await page.evaluate("({ error: window.__bake.error, png: window.__bake.png })") as { error: string; png: string };
  if (state.error) throw new Error(state.error);
  await writeFile(out, Buffer.from(state.png.split(",")[1], "base64"));
  console.log(`Inselszene gerendert: ${out} (${width} × ${height}, ${passes} Durchgänge)`);
} finally {
  await browser.close();
  await server.close();
}
