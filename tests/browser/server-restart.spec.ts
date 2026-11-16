import { expect, test } from "@playwright/test";
import { restartFixture } from "../../scripts/restart-fixture";

for (const [game, marker] of [
  ["qwixx", ".qwixx-turn"], ["durak", ".durak-players"],
  ["kribbeln", ".kribbel-score-strip"], ["party", ".party-mini-intro"]
] as const) {
  test(`Zwei Geräte kehren nach Prozessabbruch automatisch zu ${game} zurück`, async ({ page, browser }, info) => {
    const service = await restartFixture();
    const context = await browser.newContext({ viewport: page.viewportSize(), isMobile: info.project.name === "phone",
      hasTouch: info.project.name === "phone", reducedMotion: "reduce" });
    try {
      const url = await service.start();
      const guest = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const [device, character] of [[page, "Prime Rick"], [guest, "Morty Smith"]] as const) {
        await device.goto(url);
        await device.getByRole("button", { name: /Online spielen/ }).click();
    await device.getByRole("button", { name: device === page ? /^Raum erstellen/ : /^Raum beitreten/ }).click();
        await device.getByLabel("Deine Spielfigur").selectOption({label: character});
      }
      await page.getByRole("button", { name: "Neuen Raum erstellen", exact: true }).click();
      const code = await page.locator(".room-code strong").innerText();
      await page.getByLabel("Ausgewähltes Spiel").selectOption(game);
      await guest.getByRole("textbox", { name: "Raumcode" }).fill(code);
      await guest.getByRole("button", { name: "Raum beitreten", exact: true }).click();
      for (const device of [guest, page]) await device.getByRole("button", { name: "Ich bin bereit", exact: true }).click();
      for (const device of [page, guest]) await expect(device.locator(marker)).toBeVisible();
      await service.crash();
      for (const device of [page, guest]) await expect(device.getByText("Verbindung wird wiederhergestellt …")).toBeVisible();
      await service.start();
      for (const device of [page, guest]) {
        await expect(device.locator(marker)).toBeVisible({ timeout: 15000 });
        await expect(device.locator(".game-intro")).toHaveCount(0);
      }
      if (game === "qwixx") {
        await page.getByRole("button", { name: "Würfeln", exact: true }).click();
        await expect(guest.getByRole("button", { name: "Weiße Aktion auslassen", exact: true })).toBeVisible();
      }
    } finally {
      await context.close();
      await service.close();
    }
  });
}
