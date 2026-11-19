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
    // Start the idle check after the delayed controls have actually appeared.
    await expect(local).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.getAnimations()
      .filter(animation => (animation.effect as KeyframeEffect | null)?.target?.closest(".home"))
      .filter(animation => animation.playState === "running").length), { timeout: 5000 }).toBe(0);
    // One fixed screen: nothing scrolls, the sky and corner layers are decoration only.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(page.locator(".expedition-motto blockquote")).toHaveText("Play like the GoldenSchmidt - Be like the GoldenSchmidt");
    await expect(page.locator(".expedition-motto")).toHaveCSS("opacity", "1");
    await expect(page.locator(".expedition-motto figcaption")).toHaveText("— TheGoldenSchmidt");
    // The dark stone face narrows above the lower rim. Keep the whole last line on that face.
    const plaque = (await page.locator(".crest-plaque").boundingBox())!;
    const games = (await page.locator(".crest-games").boundingBox())!;
    expect(games.x).toBeGreaterThan(plaque.x + plaque.width * .25);
    expect(games.x + games.width).toBeLessThan(plaque.x + plaque.width * .75);
    expect(games.y + games.height).toBeLessThan(plaque.y + plaque.height * .8);
    await page.screenshot({ path: info.outputPath(`start-${reducedMotion}.png`), fullPage: true });

    // After the intro both modes are available, including from the keyboard.
    await expect(local).toBeInViewport();
    await expect(online).toBeInViewport();
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

test("Krone reflektiert einmal nach der Landung, alle Buttons warten bis nach dem Zitat", async ({page}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.addStyleTag({content:".expedition-home * { animation-play-state:paused !important; }"});
  await expect(page.locator(".home")).toHaveAttribute("data-intro", "playing");
  const home = page.locator(".home");
  const at = (time: number) => home.evaluate((element, time) => {
    for (const animation of element.getAnimations({subtree:true})) animation.currentTime = time;
  }, time);
  const end = (selector: string) => page.locator(selector).evaluate(element =>
    Number(element.getAnimations()[0].effect!.getComputedTiming().endTime));
  const landed = await end(".crest-crown");
  const quoteVisible = await end(".expedition-motto");
  const buttons = home.getByRole("button");
  const reflection = home.locator(".crown-reflection");
  await at(landed - 1);
  await expect(reflection).toHaveCSS("opacity", "0");
  await expect(buttons).toHaveCount(0);
  await at((landed + quoteVisible) / 2);
  expect(await reflection.evaluate(element => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.5);
  await at(quoteVisible - 1);
  await expect(reflection).toHaveCSS("opacity", "0");
  await expect(buttons).toHaveCount(0);
  await at(await end(".expedition-controls"));
  await expect(buttons.first()).toBeVisible();
  await expect(home.getByRole("button", {name:/Lokal spielen/})).toBeVisible();
});

test("Startbildschirm: Profil, Installationshilfe und schmale Ansicht", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /^Gastprofil:/ }).click();
  await expect(page.getByRole("dialog", { name: "Profil & Anmeldung" })).toBeVisible();
  await page.getByText("Ohne Konto als Gast spielen", { exact: true }).click();
  await page.getByRole("textbox", { name: "Gastname" }).fill("Die wilde Spielerunde");
  await page.getByRole("button", { name: "Gastprofil speichern", exact: true }).click();
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

test("Startbildschirm: Fortsetzen und Updates teilen sich eine Zeile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const playerId = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); if (value?.id) return value.id as string; } catch { /* not JSON */ }
    }
  });
  await page.evaluate(playerId => localStorage.setItem("spielraum.last-host.v1", JSON.stringify({ playerId, nearby: { role: "host" }, sessionToken: "x" })), playerId);
  for (const viewport of [{ width: 320, height: 640 }, { width: 412, height: 915 }]) {
    await page.setViewportSize(viewport);
    await page.reload();
    const resume = page.getByRole("button", { name: "Handy-Tisch fortsetzen", exact: true });
    const update = page.getByRole("button", { name: /Updates prüfen|Neue Version laden/ });
    const install = page.getByRole("button", { name: "App installieren", exact: true });
    for (const button of [resume, update, install]) await expect(button).toBeInViewport({ ratio: 1 });
    const [r, u, i] = await Promise.all([resume, update, install].map(button => button.boundingBox()));
    // Resume on the left, update on the right, all in one row without overlap.
    expect(Math.abs(r!.y - u!.y)).toBeLessThan(2);
    expect(r!.x + r!.width).toBeLessThanOrEqual(i!.x);
    expect(i!.x + i!.width).toBeLessThanOrEqual(u!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  }
});

test("Startbildschirm: Update-Prüfung verändert weder Größe noch Scrollbarkeit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 320, height: 640 }, { width: 412, height: 915 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const hero = page.locator(".expedition-hero");
    const before = (await hero.boundingBox())!;
    await page.getByRole("button", { name: /Updates prüfen/ }).click();
    const note = page.getByRole("complementary", { name: "App aktualisieren" }).getByRole("status");
    await expect(note).toBeVisible();
    // The note floats above the tool row instead of pushing the island up.
    expect(await hero.boundingBox()).toEqual(before);
    await page.mouse.wheel(0, 600);
    await page.evaluate(() => window.scrollTo(0, 600));
    expect(await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight <= innerHeight])).toEqual([0, true]);
    // It hides by itself; the status text stays available to screen readers.
    const tool = page.getByRole("complementary", { name: "App aktualisieren" });
    await expect(tool).toHaveAttribute("data-note", "false", { timeout: 8000 });
    await expect(note).not.toBeEmpty();
    expect(await note.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  }
});
