/**
 * Renders the portraits of the rigged characters (public/characters/rig_*.png,
 * 240 × 260 like the classic ones) from the real character stage of the app.
 *
 * Run after `npm run build`:  node scripts/assets/render-rigged-portraits.mjs
 * Needs Chromium (set PLAYWRIGHT_CHROMIUM_PATH if the bundled one does not match).
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const PORT = "4189", ORIGIN = `http://127.0.0.1:${PORT}`, TMP = "node_modules/.cache/rig-portraits";
// Names as in shared/characters.ts (RIGGED_CHARACTERS).
const CHARACTERS = [["rig_jonas", "Jonas"], ["rig_amara", "Amara"], ["rig_malik", "Malik"], ["rig_lena", "Lena"], ["rig_erik", "Erik"], ["rig_zoe", "Zoe"],
  ["rig_mc_goldie", "MC Goldie"], ["rig_kiki_komet", "Kiki Komet"], ["rig_bolt", "Bolt"], ["rig_glubschi", "Glubschi"]];

const server = spawn("npm", ["start"], { env: { ...process.env, PORT, GSG_DATABASE_FILE: ":memory:", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", RENDER: "true" }, stdio: "ignore" });
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${ORIGIN}/api/health`)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
  mkdirSync(TMP, { recursive: true });
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
  await page.goto(ORIGIN);
  await page.getByRole("button", { name: /Online spielen/ }).click();
  for (const [id, name] of CHARACTERS) {
    await page.getByRole("button", { name, exact: true }).click();
    const stage = page.locator(".party-character-canvas");
    await stage.waitFor(); await page.waitForFunction(wanted => document.querySelector(".party-character-canvas")?.getAttribute("data-character") === wanted, id, { timeout: 30000 });
    await page.waitForTimeout(900);
    await stage.screenshot({ path: `${TMP}/${id}.png` });
  }
  await browser.close();
  // Crop around the figure and scale to the portrait size of the classic characters.
  execFileSync("python3", ["-c", `
import sys
from PIL import Image
for cid in sys.argv[2:]:
    im = Image.open(f"{sys.argv[1]}/{cid}.png").convert("RGB"); w, h = im.size
    top, bottom = int(h * .2), int(h * .8); half = int((bottom - top) * 240 / 260 / 2)
    im.crop((w // 2 - half, top, w // 2 + half, bottom)).resize((240, 260), Image.LANCZOS).save(f"public/characters/{cid}.png", optimize=True)
    print(cid)
`, TMP, ...CHARACTERS.map(c => c[0])], { stdio: "inherit" });
} finally { server.kill(); rmSync(TMP, { recursive: true, force: true }); }
