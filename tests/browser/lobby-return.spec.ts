import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { selectEntryCharacter } from "./select-entry-character";
import { selectLobbyGame } from "./select-lobby-game";

async function enterRoom(page: Page, name: string, code?: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(profile => localStorage.setItem("spielraum.profile.v1", JSON.stringify(profile)), { id: randomUUID(), username: name });
  await page.goto("/");
  await joinOrCreate(page, code);
}
async function joinOrCreate(page: Page, code?: string) {
  await page.getByRole("button", { name: /Online spielen/ }).click();
  await page.getByRole("button", { name: code ? /^Raum beitreten/ : /^Raum erstellen/ }).click();
  await selectEntryCharacter(page, code ? "Morty Smith" : "Prime Rick");
  if (code) await page.getByRole("textbox", { name: "Raumcode" }).fill(code);
  await page.getByRole("button", { name: code ? "Raum beitreten" : "Neuen Raum erstellen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mitspieler", exact: true })).toBeVisible();
}
/** Ends the own attempt in whichever minigame was drawn (3D arena or match game). */
async function giveUp(page: Page) {
  const attempt = page.locator(".party-end-attempt summary");
  await expect(attempt).toBeVisible();
  await expect(page.locator(".match-countdown, .party-action-countdown")).toHaveCount(0, { timeout: 10000 });
  await attempt.click();
  await page.locator(".party-end-attempt button").click();
}

test("Nach dem Spiel zurück in die Lobby, dort verlassen oder für alle beenden", async ({ page, browser }, testInfo) => {
  test.setTimeout(90000);
  const context = await browser.newContext({ viewport: page.viewportSize()!, isMobile: true, hasTouch: true });
  const guest = await context.newPage();
  try {
    await enterRoom(page, "Anna");
    await selectLobbyGame(page, "free-minigame");
    const code = await page.locator(".room-code strong").innerText();
    await enterRoom(guest, "Ben", code);
    // Guests may only leave; ending the party for everyone is the host's action.
    await expect(guest.getByRole("button", { name: "Party verlassen", exact: true })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Party für alle beenden", exact: true })).toHaveCount(0);

    for (const device of [guest, page]) await device.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    for (const device of [page, guest]) await device.locator(".party-mini-intro").getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await giveUp(page);
    // A 3D arena waits for every attempt; a match game ends once one player is left.
    const results = (device: Page) => device.getByRole("button", { name: "Zurück zur Lobby", exact: true });
    const outcome = async () => await results(guest).isVisible() ? "finished"
      : await guest.locator(".party-end-attempt summary").isVisible() && !await page.locator(".party-end-attempt").count() && !await results(page).isVisible() ? "waiting" : "pending";
    await expect.poll(outcome).not.toBe("pending");
    if (await outcome() === "waiting") await giveUp(guest);
    for (const device of [page, guest]) {
      await expect(results(device)).toBeVisible();
      // The end screen offers only the way back to the lobby, not straight to the start menu.
      await expect(device.getByRole("button", { name: "Verlassen", exact: true })).toHaveCount(0);
    }

    await results(guest).click();
    for (const device of [page, guest]) await expect(device.getByRole("heading", { name: "Mitspieler", exact: true })).toBeVisible();
    await expect(page.locator(".room-code strong")).toHaveText(code);

    await guest.getByRole("button", { name: "Party verlassen", exact: true }).click();
    await expect(guest.getByRole("button", { name: /Online spielen/ })).toBeVisible();
    await expect(page.locator(".player-row:not(.player-row--empty)")).toHaveCount(1);

    await joinOrCreate(guest, code);
    await expect(page.locator(".player-row:not(.player-row--empty)")).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("lobby-host.png"), fullPage: true });
    await page.getByRole("button", { name: "Party für alle beenden", exact: true }).click();
    const confirm = page.getByRole("group", { name: "Party für alle beenden?" });
    await confirm.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("lobby-confirm.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await confirm.getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Mitspieler", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Party für alle beenden", exact: true }).click();
    await confirm.getByRole("button", { name: "Ja, für alle beenden", exact: true }).click();
    for (const device of [page, guest]) await expect(device.getByRole("button", { name: /Online spielen/ })).toBeVisible();
    await expect(guest.getByRole("alert")).toHaveText("Der Host hat die Party beendet.");
    // The closed room cannot be entered again.
    await guest.getByRole("button", { name: /Online spielen/ }).click();
    await guest.getByRole("button", { name: /^Raum beitreten/ }).click();
    await guest.getByRole("textbox", { name: "Raumcode" }).fill(code);
    await guest.getByRole("button", { name: "Raum beitreten", exact: true }).click();
    await expect(guest.getByRole("alert")).toContainText("geschlossen");
  } finally { await context.close(); }
});
