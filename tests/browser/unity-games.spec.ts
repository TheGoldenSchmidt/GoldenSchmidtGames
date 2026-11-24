import { test, expect } from "@playwright/test";
import { UNITY_GAMES } from "../../src/unityGames";

// Unity test games: one shared WebGL build in the app's own frame (?spiel= picks the game), open to everyone.
for (const game of UNITY_GAMES) test(`Unity-Test ${game.name}: Eintrag, Start im App-Rahmen unter der CSP, Rückkehr`, async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (/CSP-VERSTOSS|\[GSG\] Unbekanntes Spiel/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", e => console.log(`CSP-VERSTOSS ${e.violatedDirective} ${e.blockedURI}`)));
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).tap();
  await page.getByRole("button", { name: /^Unity-Minispiele/ }).tap();
  // Name plus the start of the description: "Tower Tumble" must not also match "Tower Tumble – Survival".
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entry = page.getByRole("button", { name: new RegExp(`^${escape(game.name)} ${escape(game.text.split(" ")[0])}`) });
  await expect(entry).toBeVisible();
  await entry.tap();
  const frame = page.locator("iframe.unity-game__frame");
  await expect(frame).toHaveAttribute("src", new RegExp(`^/unity/spiele/index\\.html\\?spiel=${game.id}(&|$)`));
  const unity = page.frameLocator("iframe.unity-game__frame");
  await expect(unity.getByText(/Unity wird geladen/)).toBeAttached();
  const handle = await frame.elementHandle();
  const content = await handle!.contentFrame();
  await content!.waitForFunction(() => (window as unknown as { gsgUnity?: unknown }).gsgUnity, null, { timeout: 150000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: info.outputPath(`${game.id}.png`) });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: `${game.name} verlassen` }).tap();
  await expect(entry).toBeVisible();
  expect(errors).toEqual([]);
});
