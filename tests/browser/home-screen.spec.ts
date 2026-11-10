import { test, expect } from "@playwright/test";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`Startbildschirm: Spielzugänge mit Bewegung ${reducedMotion}`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "GoldenSchmidtGames", exact: true })).toBeVisible();
    const local = page.getByRole("button", { name: /Lokal spielen/ });
    const online = page.getByRole("button", { name: /Online spielen/ });
    await expect(local).toBeInViewport();
    await expect(online).toBeInViewport();
    const stage = page.locator(".home-party__canvas");
    await expect(stage).toHaveAttribute("data-webgl", "ready");
    await expect(page.locator(".home-party__canvas canvas")).toHaveCount(1);
    await expect(stage).toHaveAttribute("data-motion", "still", { timeout: 10000 });
    const frames = await stage.getAttribute("data-frames");
    await page.waitForTimeout(200);
    expect(await stage.getAttribute("data-frames")).toBe(frames);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`start-${reducedMotion}.png`), fullPage: true });

    // Both modes remain immediately accessible, including from the keyboard.
    await local.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Lokal spielen", exact: true })).toBeVisible();
    await expect(page.locator(".home-party__canvas canvas")).toHaveCount(0);
    await page.getByRole("button", { name: "Zurück", exact: true }).click();
    await page.getByRole("button", { name: /Online spielen/ }).click();
    await expect(page.getByRole("heading", { name: "Online spielen", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Startbildschirm: Profil, Installationshilfe und schmale Ansicht", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /^Gastprofil:/ }).click();
  await expect(page.getByRole("dialog", { name: "Dein Gastprofil" })).toBeVisible();
  await page.getByRole("textbox", { name: "Anzeigename" }).fill("Die wilde Spielerunde");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("button", { name: "Gastprofil: Die wilde Spielerunde", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Als App installieren/ }).click();
  await expect(page.locator(".install-help")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "App aktualisieren" }).getByRole("button", { name: /Nach Updates suchen|Neue Version laden/ })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole("button", { name: /Online spielen/ })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("start-320-installation.png"), fullPage: true });
});

test("Startbildschirm: ohne WebGL bleiben Figuren und Spielzugänge sichtbar", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator(".home-party__fallback img")).toHaveCount(4);
  await expect(page.locator(".home-party__fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: /Online spielen/ })).toBeInViewport();
  await page.screenshot({ path: info.outputPath("start-ohne-webgl.png"), fullPage: true });
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await expect(page.getByRole("heading", { name: "Lokal spielen", exact: true })).toBeVisible();
});
