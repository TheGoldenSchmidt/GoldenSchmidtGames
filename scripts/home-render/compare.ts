// Puts the start screen next to the reference picture (docs/design/startscreen-referenz.webp).
//   npm run compare:home              writes test-results/startscreen-vergleich.png
// The screen is captured at the reference size (502 × 1022 CSS pixels, touch, reduced motion);
// the output shows reference, screenshot and a 50 % overlay side by side.
// Set PLAYWRIGHT_CHROMIUM_PATH if the installed browser does not match the Playwright version.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { createServer } from "vite";

const reference = await readFile("docs/design/startscreen-referenz.webp");
const server = await createServer({ logLevel: "error", server: { port: 5197, strictPort: true, host: "127.0.0.1" } });
await server.listen();
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 502, height: 1022 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto("http://127.0.0.1:5197/");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction("[...document.querySelectorAll('.home img')].every(img => img.complete && img.naturalWidth > 0)");
  const shot = await page.screenshot();
  // Passed as source text: the TypeScript runner would otherwise wrap named helpers in calls the page lacks.
  const compose = `(async ([refUrl, shotUrl]) => {
    const load = src => new Promise((done, fail) => { const img = new Image(); img.onload = () => done(img); img.onerror = fail; img.src = src; });
    const [ref, own] = await Promise.all([load(refUrl), load(shotUrl)]);
    const w = 502, h = 1022, gap = 16, label = 34;
    const canvas = document.createElement("canvas");
    canvas.width = w * 3 + gap * 2; canvas.height = h + label;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#221b4f"; ctx.font = "bold 20px sans-serif";
    ["Vorlage", "Umsetzung", "Überblendung 50 %"].forEach((text, i) => ctx.fillText(text, i * (w + gap) + 6, 24));
    ctx.drawImage(ref, 0, label, w, h);
    ctx.drawImage(own, w + gap, label, w, h);
    ctx.drawImage(ref, (w + gap) * 2, label, w, h);
    ctx.globalAlpha = .5;
    ctx.drawImage(own, (w + gap) * 2, label, w, h);
    return canvas.toDataURL("image/png");
  })(${JSON.stringify([`data:image/webp;base64,${reference.toString("base64")}`, `data:image/png;base64,${shot.toString("base64")}`])})`;
  const sheet = await page.evaluate(compose) as string;
  await mkdir("test-results", { recursive: true });
  await writeFile("test-results/startscreen-vergleich.png", Buffer.from(sheet.split(",")[1], "base64"));
  console.log("Vergleich geschrieben: test-results/startscreen-vergleich.png");
} finally {
  await browser.close();
  await server.close();
}
