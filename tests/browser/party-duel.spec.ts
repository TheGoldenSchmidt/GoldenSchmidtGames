import { test, expect } from "@playwright/test";
import { minigameMenu } from "./party-session";
import { randomUUID } from "node:crypto";

/** Duellfelder (Inselparty): challenge from the board, the 1v1 match against a bot, the pot and the way back to the island. */
for (const motion of ["reduce", "no-preference"] as const) test(`Duellfeld (${motion}): herausfordern, Duell spielen, Pott und zurück zur Insel`, async ({ page }, info) => {
  test.setTimeout(150000);
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: "Anna" });
  await page.goto("/"); await page.getByRole("button", { name: /Lokal spielen/ }).click();
  await page.getByRole("button", { name: /^Inselparty 1–5 Bots/ }).click();
  await page.getByLabel("Deine Spielfigur").selectOption({ label: "Prime Rick" });
  await page.getByLabel("Bot-Mitspieler").selectOption("2");
  await page.getByRole("button", { name: "Testpartie mit Bots erstellen" }).click();
  await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
  const intro = page.getByRole("button", { name: "Intro überspringen" }); if (await intro.count()) await intro.click();
  await expect(page.locator(".party-mini-intro")).toBeVisible();
  // Test tool: the own figure lands on duel field 8.
  await page.locator(".party-test-tools>summary").click();
  await page.getByRole("button", { name: "Duellfeld testen" }).click();
  await expect(page.getByRole("heading", { name: /Duellfeld/ })).toBeVisible({ timeout: 15000 });
  const targets = page.getByRole("group", { name: "Gegner wählen" }).getByRole("button");
  await expect(targets).toHaveCount(2);
  await targets.nth(1).click();
  await expect(targets.nth(1)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("group", { name: "Einsatz wählen" }).getByRole("button", { name: "5", exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`duel-challenge-${motion}.png`) });
  await page.getByRole("button", { name: /herausfordern · Pott 10 Münzen/ }).click();
  // Intro: who duels whom; only the two duelists get ready.
  await expect(page.getByText(/Duell auf Feld 8/)).toBeVisible();
  await expect(page.locator(".party-duel-headline")).toContainText("Pott 10 Münzen");
  await expect(page.locator(".party-ready-players > span")).toHaveCount(2);
  await page.screenshot({ path: info.outputPath(`duel-intro-${motion}.png`) });
  await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
  // The match runs (a quick bot may already decide it); otherwise give up after a moment of play.
  const result = page.getByRole("heading", { name: /gewinnt!|Unentschieden|Duell gewonnen!/ });
  await expect(page.getByText("Duell um 10 Münzen").filter({ visible: true }).or(result)).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(4500);
  if (!(await result.isVisible())) {
    await page.screenshot({ path: info.outputPath(`duel-play-${motion}.png`) });
    const giveUp = minigameMenu(page);
    if (await giveUp.isVisible()) { await giveUp.click(); await page.getByRole("button", { name: /^(Jetzt aufgeben|Versuch beenden)$/ }).click(); }
  }
  await expect(result).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: info.outputPath(`duel-result-${motion}.png`) });
  await page.getByRole("button", { name: "Weiter auf der Insel", exact: true }).click();
  await expect(page.getByText(/gewinnt das Duell|Einsatz zurück/).first()).toBeVisible();
  expect(errors).toEqual([]);
});
