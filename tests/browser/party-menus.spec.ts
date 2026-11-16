import { test, expect } from "@playwright/test";

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`Partymenüs: Profil und lokales Setup (${reducedMotion})`, async ({ page }, info) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/");
    await page.getByRole("button", { name: /^Gastprofil:/ }).click();
    await page.getByRole("textbox", { name: "Anzeigename" }).fill("Spieleabend");
    await page.screenshot({ path: info.outputPath("profil.png") });
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await page.getByRole("button", { name: /Lokal spielen/ }).click();
    await expect(page.getByRole("button", { name: "Qwixx starten", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: /^Durak / }).click();
    await page.getByRole("combobox", { name: "Figur von Spieler 1", exact: true }).selectOption("alpha_rick_prime");
    await page.getByRole("combobox", { name: "Figur von Spieler 2", exact: true }).selectOption("alpha_korvo");
    await page.getByRole("checkbox", { name: /Schummelmodus/ }).check();
    await expect(page.getByRole("button", { name: "Durak starten", exact: true })).toBeEnabled();
    const portrait = await page.locator(".local-character-field .character-avatar").first().boundingBox();
    expect(portrait!.width / portrait!.height).toBeGreaterThan(.8);
    expect(portrait!.width / portrait!.height).toBeLessThan(1.2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("lokales-setup.png"), fullPage: true });
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Durak starten", exact: true }).click();
    const skip = page.getByRole("button", { name: "Intro überspringen" });
    if (reducedMotion === "no-preference") await skip.click();
    await expect(page.getByRole("button", { name: "Karten anzeigen", exact: true })).toBeVisible();
  });
}

test("Partymenüs: Online-Auswahl, Lobby und Figurenwechsel", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Online spielen/ }).click();
  await page.getByRole("button", { name: /^Raum erstellen/ }).click();
  await expect(page.getByRole("button", { name: "Neuen Raum erstellen", exact: true })).toBeDisabled();
  await page.getByLabel("Deine Spielfigur").selectOption({label: "Morty Smith"});
  await expect(page.locator(".entry-character img")).toBeVisible();
  await page.screenshot({ path: info.outputPath("online-auswahl.png"), fullPage: true });
  await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Ausgewähltes Spiel", exact: true }).selectOption("party");
  await expect(page.getByRole("combobox", { name: "Tempo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Spielfigur ändern/ }).click();
  await page.getByRole("button", { name: "Prime Rick", exact: true }).click();
  await expect(page.locator(".party-character-canvas")).toHaveAttribute("data-webgl", "ready");
  await expect(page.locator(".player-row").first()).toContainText("Prime Rick");
  await page.getByRole("button", { name: /Figurenwahl schließen/ }).click();
  await expect(page.locator(".party-character-picker")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lobby.png"), fullPage: true });
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("lobby-320.png"), fullPage: true });
});

test("Partymenüs: Handy-Einladung mit lesbarem QR und Textcode", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Online spielen/ }).click();
  await page.getByRole("button", { name: /^Raum erstellen/ }).click();
  await page.getByLabel("Deine Spielfigur").selectOption({label: "Morty Smith"});
  await page.getByRole("radio", { name: /Dieses Handy/ }).check();
  await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
  await page.getByRole("button", { name: "Gerät verbinden", exact: true }).click();
  const dialog = page.locator(".pair-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".pair-qr")).toBeVisible();
  await dialog.getByText("Textcode anzeigen", { exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Eigener Verbindungscode" })).toHaveValue(/^GSG1\./);
  const bounds = await dialog.locator(".pair-qr").boundingBox();
  expect(Math.abs(bounds!.width - bounds!.height)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("qr-einladung.png") });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Lobby", exact: true })).toBeVisible();
});
