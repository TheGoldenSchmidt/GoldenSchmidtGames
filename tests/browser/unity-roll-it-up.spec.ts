import { test, expect } from "@playwright/test";
import { loginTestOwner } from "./account-session";
import { minigameMenu } from "./party-session";

// Roll It Up! with the Unity board: developer entry only; rules, bots and minigames stay in the app.
test("Roll It Up! (Unity): nur für Admin/Entwicklung, Unity-Brett lädt und nimmt das Würfeln an", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Nur Smartphone");
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (/CSP-VERSTOSS/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", e => console.log(`CSP-VERSTOSS ${e.violatedDirective} ${e.blockedURI}`)));

  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).tap();
  await expect(page.getByRole("button", { name: /^Inselparty/ })).toBeVisible();
  await page.getByRole("button", { name: /^Unity-Minispiele/ }).tap();
  await expect(page.getByRole("button", { name: /^Roll It Up! \(Unity\)/ })).toHaveCount(0);

  await loginTestOwner(page.request);
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).tap();
  await page.getByRole("button", { name: /^Unity-Minispiele/ }).tap();
  await page.getByRole("button", { name: /^Roll It Up! \(Unity\)/ }).tap();
  await page.getByLabel("Deine Spielfigur").selectOption({ label: "Jonas" });
  await page.getByLabel("Bot-Mitspieler").selectOption("3");
  await page.getByRole("button", { name: "Testpartie mit Bots erstellen" }).tap();
  await page.getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
  const intro = page.getByRole("button", { name: "Intro überspringen" });
  if (await intro.count()) await intro.tap();

  // The Unity board loads (hidden) during the opening minigame and stays loaded afterwards.
  const board = page.locator(".unity-roll");
  await expect(board.locator("iframe")).toHaveAttribute("src", /^\/unity\/spiele\/index\.html\?spiel=rollitup/);
  await page.locator(".party-mini-intro").getByRole("button", { name: "Ich bin bereit", exact: true }).tap();
  const attempt = minigameMenu(page);
  await expect(attempt).toBeVisible();
  await expect(page.locator(".match-countdown, .party-action-countdown")).toHaveCount(0, { timeout: 10000 });
  await attempt.tap();
  await page.getByRole("button", { name: /^(Jetzt aufgeben|Versuch beenden)$/ }).tap();
  const confirm = page.getByRole("button", { name: "Weiter zur Bauschale", exact: true });
  await expect(confirm).toBeVisible({ timeout: 70000 });
  await confirm.tap();
  await expect(board).toHaveAttribute("data-ready", "true", { timeout: 150000 });
  await expect(board).not.toHaveClass(/is-hidden/, { timeout: 20000 });
  // Bots may go first: wait for the own turn, then tap the gold main action of the Unity card.
  await expect(board).toHaveAttribute("data-my-turn", "true", { timeout: 120000 });
  await expect(board).toHaveAttribute("data-phase", "turn");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: info.outputPath("unity-bauschale.png") });
  // Unity's menu button opens the app's own game menu (panel request over the bridge).
  await page.touchscreen.tap(28, 36);
  await expect(page.getByRole("dialog", { name: "Spielmenü" })).toBeVisible();
  await page.getByRole("button", { name: "Spielmenü schließen" }).tap();
  const view = page.viewportSize()!;
  await page.touchscreen.tap(140, view.height - 52);
  await expect.poll(async () => board.getAttribute("data-phase"), { timeout: 15000 }).not.toBe("turn");
  await page.waitForTimeout(900);
  await page.screenshot({ path: info.outputPath("unity-wurf.png") });
  await expect.poll(async () => board.getAttribute("data-phase"), { timeout: 20000 }).not.toBe("moving");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: info.outputPath("unity-landung.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(view.width);
  expect(errors).toEqual([]);
});
