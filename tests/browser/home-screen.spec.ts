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
    const island = page.getByRole("img", { name: "GoldenSchmidtGames" });
    await expect(island).toBeVisible();
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>(".home img")].every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    await expect(page.locator(".home")).toHaveAttribute("data-intro", "playing");
    const layers = page.locator(".crest-piece, .expedition-motto");
    const animations = await layers.evaluateAll(elements => elements.map(element => {
      const animation = element.getAnimations()[0];
      const effect = animation?.effect as KeyframeEffect | undefined;
      return effect && { delay: effect.getTiming().delay, end: effect.getComputedTiming().endTime,
        frames: effect.getKeyframes() };
    }));
    if (reducedMotion === "reduce") {
      expect(animations.every(animation => !animation)).toBe(true);
    } else {
      const order = await layers.evaluateAll(elements => elements.map(element => element.classList.item(element.classList.length - 1)));
      expect(order).toEqual(["crest-plaque", "crest-golden", "crest-schmidt", "crest-games", "crest-crown", "expedition-motto"]);
      for (let i = 1; i < animations.length; i++) {
        expect(animations[i]?.delay).toBeGreaterThanOrEqual(Math.round(Number(animations[i - 1]?.end)));
      }
      expect(animations.at(-1)?.frames.map(frame => frame.opacity)).toEqual(["0", "1"]);
      expect(animations.at(-1)?.frames.every(frame => !("transform" in frame))).toBe(true);
    }
    await expect(page.locator(".expedition-actions .adventure-choice")).toHaveCount(2);
    await expect(page.locator(".home canvas")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.getAnimations()
      .filter(animation => (animation.effect as KeyframeEffect | null)?.target?.closest(".home"))
      .filter(animation => animation.playState === "running").length), { timeout: 5000 }).toBe(0);
    // One fixed screen: nothing scrolls, the sky and corner layers are decoration only.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(page.locator(".expedition-motto")).toHaveText("Play like the GoldenSchmidt - Be like the GoldenSchmidt");
    await expect(page.locator(".expedition-motto")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: info.outputPath(`start-${reducedMotion}.png`), fullPage: true });

    // Both modes remain immediately accessible, including from the keyboard.
    await local.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Lokal spielen", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zurück", exact: true }).click();
    await expect(page.locator(".home")).toHaveAttribute("data-intro", "complete");
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
  // The installation help opens above the utility row instead of growing the page.
  await page.getByRole("button", { name: "App installieren", exact: true }).click();
  await expect(page.locator(".install-help")).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.getByRole("button", { name: "Installationshilfe schließen", exact: true }).click();
  await expect(page.locator(".install-help")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "App aktualisieren" }).getByRole("button", { name: /Updates prüfen|Neue Version laden/ })).toBeVisible();
  for (const viewport of [{ width: 320, height: 550 }, { width: 320, height: 640 }, { width: 360, height: 660 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("button", { name: /Lokal spielen/ })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /Online spielen/ })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "App installieren", exact: true })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /Updates prüfen|Neue Version laden/ })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: /^Gastprofil:/ })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath(`start-${viewport.width}x${viewport.height}.png`) });
  }
});
