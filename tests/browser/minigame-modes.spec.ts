import { test, expect } from "@playwright/test";
import { endOwnAttempt, onlineSession, participate } from "./party-session";
import { CHARACTERS } from "../../shared/characters";
import { PLAYABLE_MINI_IDS } from "../../shared/minigameCatalog";

test("14 Einsätze und sechs lange Namen bleiben auf 320 Pixeln bedienbar", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 844 });
  const session = await onlineSession(page, false, CHARACTERS.slice(0, 6).map(c => c.id), false, "goldenschmidt", { rounds: 14 }, Array.from({length:6},(_,i)=>`GoldenSchmidtMitspieler${i+1}`));
  try {
    const chips = page.getByRole("group", { name: "Dein Einsatz", exact: true }).getByRole("button");
    await expect(chips).toHaveCount(14);
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("fourteen-bets-320.png"), fullPage: true });
  } finally { session.close(); }
});

test("Beide Minispielmodi sind in der Lobby konfigurierbar", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Online spielen/ }).click();
  await page.getByRole("button", { name: "Morty Smith", exact: true }).click();
  await page.getByRole("button", { name: "Neuen Raum erstellen" }).click();
  await page.getByLabel("Ausgewähltes Spiel").selectOption("free-minigame");
  const minigame = page.getByRole("combobox", { name: "Minispiel", exact: true });
  await expect(minigame).toBeVisible();
  await expect(minigame.locator("option")).toHaveCount(PLAYABLE_MINI_IDS.length);
  await expect(minigame.locator("optgroup")).toHaveCount(2);
  await minigame.selectOption("golf");
  await expect(minigame).toHaveValue("golf");
  await page.getByLabel("Ausgewähltes Spiel").selectOption("goldenschmidt");
  await page.getByLabel("Anzahl Minispiele").selectOption("14");
  await expect(page.getByLabel("Anzahl Minispiele")).toHaveValue("14");
  await expect(page.getByText(/14 zufällige Minispiele ohne Wiederholung/)).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lobby-320.png"), fullPage: true });
});

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test(`Wettbewerb: verdeckt setzen, wiederbeitreten und alle Einsätze verbrauchen (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    const session = await onlineSession(page, false, undefined, false, "goldenschmidt", { rounds: 2 });
    try {
      await expect(page.getByRole("heading", { name: "Was setzt du auf deinen Sieg?" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Einsatz festlegen", exact: true })).toBeDisabled();
      const chip = page.getByRole("button", { name: "2 Punkte setzen", exact: true });
      if (testInfo.project.name === "phone") await chip.tap(); else { await chip.focus(); await page.keyboard.press("Enter"); }
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await page.screenshot({ path: testInfo.outputPath(`betting-${reducedMotion}.png`), fullPage: true });
      await page.getByRole("button", { name: "Einsatz festlegen · 2", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /Dein Einsatz/ })).toContainText("2 Punkte");
      await page.reload();
      await expect(page.getByRole("status").filter({ hasText: /Dein Einsatz/ })).toContainText("2 Punkte");
      await session.action({ type: "bet", value: 1 }, session.ids[1]);
      for (let round = 1; round <= 2; round++) {
        await expect(page.locator(".party-mini-intro")).toBeVisible();
        await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
        await session.action({ type: "ready" }, session.ids[1]);
        // Die Ziehung ist zufällig: 3D-Arena oder neues Match-Spiel, beides über die echte Bedienung.
        const kind = await participate(page, session, round);
        await endOwnAttempt(page, kind);
        // Giving up ends a two-player match game at once; a 3D arena waits for the other attempt.
        if (kind === "arena") await session.action({ type: "finish" }, session.ids[1]);
        await expect(page.getByRole("list", { name: "Minispielergebnis", exact: true })).toBeVisible();
        if (round === 1) {
          await expect(session.action({ type: "next" }, session.ids[1])).rejects.toThrow(/Nur der Host/);
          await page.getByRole("button", { name: "Nächstes Minispiel", exact: true }).click();
          await expect(page.getByRole("button", { name: "2 Punkte verbraucht", exact: true })).toBeDisabled();
          await expect(page.getByRole("button", { name: "1 Punkt setzen", exact: true })).toBeEnabled();
          await page.getByRole("button", { name: "1 Punkt setzen", exact: true }).click();
          await page.getByRole("button", { name: "Einsatz festlegen · 1", exact: true }).click();
          await session.action({ type: "bet", value: 2 }, session.ids[1]);
        }
      }
      await expect(page.getByRole("heading", { name: "Der Wettbewerb ist entschieden!", exact: true })).toBeVisible();
      await page.getByText("Gespielte Minispiele und Einsätze", { exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`results-${reducedMotion}.png`), fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // Online rooms return to their lobby after the competition.
      await page.getByRole("button", { name: "Zurück zur Lobby", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Mitspieler", exact: true })).toBeVisible();
    } finally { session.close(); }
  });
}

test("Freies Minispiel startet die gewählte Arena und endet nach einem Spiel", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false, "free-minigame", { miniId: "hurdles" });
  try {
    await expect(page.getByRole("heading", { name: "Hafenhüpfer", exact: true })).toBeVisible();
    await expect(page.getByText(/Münzen aus dem Minispiel|Trophäenstand/)).toHaveCount(0);
    await page.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
    await session.action({ type: "ready" }, session.ids[1]);
    await expect(page.locator(".party-action-world")).toBeVisible();
    await expect(page.locator(".party-action-countdown")).toHaveCount(0, { timeout: 10000 });
    await page.keyboard.down("ArrowRight");
    await expect.poll(async () => (await session.state()).partyGame!.mini!.runs[session.ids[0]].lastInput).toBeGreaterThan(0);
    await page.keyboard.up("ArrowRight");
    await session.control(session.ids[1], { x: .1, z: 0, jump: false, punch: false }, 1);
    await session.action({ type: "finish" }, session.ids[0]); await session.action({ type: "finish" }, session.ids[1]);
    await expect(page.getByRole("heading", { name: "Euer Ergebnis", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nächstes Minispiel", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("free-result.png"), fullPage: true });
  } finally { session.close(); }
});
