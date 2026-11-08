import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { KRIBBEL_COLORS, KRIBBEL_ROWS } from "../../shared/kribbeln";

async function localGame(page: Page, reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", { name: /^Kribbeln / }).first().click();
  await page.getByRole("button", { name: "Kribbeln starten", exact: true }).click();
  if (!reduced) await page.getByRole("button", { name: "Intro überspringen" }).click();
  await expect(page.getByRole("heading", { name: KRIBBEL_ROWS[0].label, exact: true })).toBeVisible();
}

async function checkVisibleMaterial(page: Page) {
  const faces = await page.locator(".kribbel-cube-scene .die-face").evaluateAll(elements => elements.map(element => ({
    value: Number(element.className.match(/die-face--(\d)/)?.[1]),
    color: element.className.match(/kribbel-face-color--(\w+)/)?.[1]
  })));
  expect(faces).toHaveLength(36);
  for (const color of KRIBBEL_COLORS) for (let value = 1; value <= 6; value++) {
    expect(faces.filter(face => face.color === color && face.value === value)).toHaveLength(1);
  }
}

test("Würfel bleiben beim Fallen neutral und zeigen danach 36 eindeutige Farbseiten", async ({ page }, info) => {
  await localGame(page);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
  await expect(page.locator(".kribbel-face--hidden")).toHaveCount(36);
  await expect(page.locator('.kribbel-cube-scene [class*="kribbel-face-color--"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Würfel \d fällt$/ })).toHaveCount(6);
  await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "waiting");
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("…");
  const backgrounds = await page.locator(".kribbel-face--hidden").evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor));
  expect(new Set(backgrounds)).toEqual(new Set(["rgb(212, 225, 223)"]));
  await page.screenshot({ path: info.outputPath("kribbeln-wuerfel-fallen.png"), fullPage: true });
  await page.clock.runFor(1250);
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
  await checkVisibleMaterial(page);
  await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "met");
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("6");
  await expect(page.getByRole("button", { name: "Ergebnis eintragen", exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath("kribbeln-gelandet.png"), fullPage: true });

  const first = page.locator(".kribbel-die-slot").nth(0);
  const second = page.locator(".kribbel-die-slot").nth(1);
  await first.click(); await second.click();
  const heldLabels = await page.locator(".kribbel-die-slot.is-kept").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")));
  await page.getByRole("button", { name: "4 Würfel neu werfen", exact: true }).click();
  await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
  await expect(page.locator(".kribbel-face--hidden")).toHaveCount(24);
  expect(await page.locator(".kribbel-die-slot.is-kept").evaluateAll(elements => elements.map(element => element.getAttribute("aria-label")))).toEqual(heldLabels);
  await page.clock.runFor(1250);
  await checkVisibleMaterial(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Alle Aufgaben haben verständliche Zielbilder und Kribbelfelder zeigen die nächste Summe", async ({ page }, info) => {
  await localGame(page, true);
  for (let row = 0; row < KRIBBEL_ROWS.length; row++) {
    await expect(page.getByRole("heading", { name: KRIBBEL_ROWS[row].label, exact: true })).toBeVisible();
    await expect(page.locator(".kribbel-task__picture")).toHaveAttribute("aria-label", new RegExp(KRIBBEL_ROWS[row].label));
    await expect(page.locator(".kribbel-task")).toHaveAttribute("data-state", "waiting");
    if ([5, 8, 9].includes(row)) await expect(page.locator(".kribbel-task__hint")).toHaveText("Du brauchst mindestens 7 Augen.");
    if ([0, 3, 6, 7, 9].includes(row)) await page.screenshot({ path: info.outputPath(`kribbeln-aufgabe-${row + 1}.png`), fullPage: true });
    for (let player = 0; player < 2; player++) {
      await page.getByRole("button", { name: "Würfeln", exact: true }).click();
      await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(0);
      await expect(page.locator(".kribbel-task")).not.toHaveAttribute("data-state", "waiting");
      await page.getByRole("button", { name: row === 2 ? "Ergebnis eintragen" : "Aufgabe streichen", exact: true }).click();
    }
  }
  await expect(page.getByRole("heading", { name: "Partie beendet", exact: true })).toBeVisible();
});

test("Reduzierte Bewegung beendet einen laufenden Wurf ohne weitere Wartezeit", async ({ page }) => {
  await localGame(page);
  await page.clock.install(); await page.clock.pauseAt(new Date());
  await page.getByRole("button", { name: "Würfeln", exact: true }).click();
  await expect(page.locator(".kribbel-face--hidden")).toHaveCount(36);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".kribbel-face--hidden")).toHaveCount(0);
  await expect(page.locator(".kribbel-feedback > strong")).toHaveText("6");
  await expect(page.getByRole("button", { name: "Ergebnis eintragen", exact: true })).toBeEnabled();
});

test("Online sehen beide Geräte behaltene Würfel und dieselben gelandeten Farben", async ({ page, browser }) => {
  const secondContext = await browser.newContext({ viewport: page.viewportSize()! });
  const observer = await secondContext.newPage();
  try {
    // Die Einführungen werden separat geprüft. Beide Geräte treten hier
    // ohne Intro bei, damit der zweite Klick dessen automatisches Ende nicht überholt.
    await page.emulateMedia({reducedMotion:"reduce"});
    await observer.emulateMedia({reducedMotion:"reduce"});
    await page.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Anna" });
    await observer.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Ben" });
    await page.goto("/"); await page.getByRole("button", { name: /Online spielen/ }).click();
    await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
    await page.getByRole("combobox", { name: "Ausgewähltes Spiel", exact: true }).selectOption("kribbeln");
    const code = await page.locator(".room-code strong").innerText();
    await observer.goto(new URL("/", page.url()).href); await observer.getByRole("button", { name: /Online spielen/ }).click();
    await observer.getByRole("textbox", { name: "Raumcode" }).fill(code);
    await observer.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    await observer.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await expect(page.getByRole("heading",{name:KRIBBEL_ROWS[0].label,exact:true})).toBeVisible();
    await expect(observer.getByRole("heading",{name:KRIBBEL_ROWS[0].label,exact:true})).toBeVisible();
    await page.emulateMedia({reducedMotion:"no-preference"});
    await observer.emulateMedia({reducedMotion:"no-preference"});
    await page.getByRole("button", { name: "Würfeln", exact: true }).click();
    await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(6);
    await expect(page.getByRole("button", { name: "6 Würfel neu werfen", exact: true })).toBeEnabled();
    await expect(observer.locator(".kribbel-face--hidden")).toHaveCount(0);
    await page.locator(".kribbel-die-slot").nth(0).click();
    await page.locator(".kribbel-die-slot").nth(1).click();
    await page.getByRole("button", { name: "4 Würfel neu werfen", exact: true }).click();
    await expect(page.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
    await expect(observer.locator(".kribbel-die-slot.is-rolling")).toHaveCount(4);
    await expect(observer.locator(".kribbel-die-slot.is-kept")).toHaveCount(2);
    await expect(observer.locator(".kribbel-face--hidden")).toHaveCount(24);
    await expect(page.getByRole("button", { name: "4 Würfel neu werfen", exact: true })).toBeEnabled();
    await expect(observer.locator(".kribbel-face--hidden")).toHaveCount(0);
    const labels = (target: Page) => target.locator(".kribbel-die-caption").allTextContents();
    expect(await labels(observer)).toEqual(await labels(page));
    await checkVisibleMaterial(observer);
  } finally { await secondContext.close(); }
});
