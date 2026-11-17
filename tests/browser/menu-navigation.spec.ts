import { selectedLobbyGame } from "./select-lobby-game";
import { CHARACTERS } from "../../shared/characters";
import { selectEntryCharacter } from "./select-entry-character";
import { test, expect } from "@playwright/test";

test("Online-Wege trennen Erstellen, Raumcode und QR und behalten die Figur", async ({page}) => {
  await page.goto("/");
  const localFace = page.getByRole("button", {name: /^Lokal spielen/}).locator(".adventure-choice__face");
  const citrine = await localFace.evaluate(el => getComputedStyle(el).backgroundImage);
  expect(citrine).toContain("citrine");
  await page.getByRole("button", {name: /Online spielen/}).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  const create = page.getByRole("button", {name: /^Raum erstellen/});
  await expect(create.locator(".adventure-choice__face")).toHaveCSS("background-image", citrine);
  await create.click();
  await expect(page.getByRole("textbox", {name: "Raumcode"})).toHaveCount(0);
  await selectEntryCharacter(page, "Morty Smith");
  await page.getByRole("button", {name: "Zurück"}).click();
  await page.getByRole("button", {name: /^Raum beitreten/}).click();
  await expect(page.getByRole("button", {name: "Neuen Raum erstellen"})).toHaveCount(0);
  await expect(page.locator("summary").filter({hasText:"Deine Spielfigur"})).toContainText("Morty Smith");
  const code = page.getByRole("textbox", {name: "Raumcode"});
  await code.fill("abc12");
  await expect(code).toHaveValue("ABC12");
  await page.getByRole("radio", {name: /QR vom Handy-Host/}).check();
  await expect(code).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Einladung scannen"})).toBeVisible();
  await page.getByRole("radio", {name: "Raumcode"}).check();
  await expect(code).toHaveValue("ABC12");
});

test("Menüton lässt sich ausschalten und bleibt nach Neustart stumm", async ({page}) => {
  await page.goto("/");
  const sound = page.getByRole("button", {name: "Spieltöne"});
  await expect(sound).toHaveAttribute("aria-pressed","true");
  await sound.click();
  await page.getByRole("button", {name: /Online spielen/}).click();
  await expect(sound).toHaveAttribute("aria-pressed","false");
  await page.reload();
  await expect(sound).toHaveAttribute("aria-pressed","false");
  await sound.click();
  await expect(sound).toHaveAttribute("aria-pressed","true");
});

test("Menübuttons spielen genau einen kurzen Klick, stumme Buttons bleiben leise", async ({page}) => {
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const log = JSON.parse(sessionStorage.getItem("menu-clicks") ?? "[]") as number[];
      log.push((this.buffer?.duration ?? 0) / this.playbackRate.value);
      sessionStorage.setItem("menu-clicks", JSON.stringify(log));
      start.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", {name: /Online spielen/}).click();
  await page.getByRole("button", {name: "Zurück"}).click();
  await page.getByRole("button", {name: "Spieltöne"}).click();
  await page.getByRole("button", {name: /Online spielen/}).click();
  const clicks: number[] = await page.evaluate(() => JSON.parse(sessionStorage.getItem("menu-clicks") ?? "[]"));
  expect(clicks).toHaveLength(2);
  expect(clicks[1]).toBeGreaterThan(clicks[0] * 1.3);
  for (const duration of clicks) {
    expect(duration).toBeGreaterThan(0);
    expect(duration).toBeLessThan(.04);
  }
});

test("Illustrierte Online-Spielwahl übernimmt das gewählte Spiel in die Lobby", async ({page}, info) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.getByRole("button", {name:/Online spielen/}).click();
  await page.getByRole("button", {name:/^Raum erstellen/}).click();
  const cards = page.getByRole("group", {name:"Spiel auswählen"}).getByRole("button");
  await expect(cards).toHaveCount(7);
  await page.screenshot({path:info.outputPath("spielwahl.png")});
  await page.getByRole("button", {name:/^Inselparty/}).click();
  await expect(page.locator("summary").filter({hasText:"Spiel auswählen"})).toContainText("Inselparty");
  await selectEntryCharacter(page, "Morty Smith");
  await page.screenshot({path:info.outputPath("raum-erstellen.png")});
  await page.getByRole("button", {name:"Neuen Raum erstellen"}).click();
  await expect(selectedLobbyGame(page)).toHaveText("Inselparty");
});

test("Beitritt zeigt Figurenkarten und behält die Wahl beim Wechsel zum QR-Code", async ({page}, info) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await page.getByRole("button", {name:/Online spielen/}).click();
  await page.getByRole("button", {name:/^Raum beitreten/}).click();
  const figure = page.locator("summary").filter({hasText:"Deine Spielfigur"});
  await figure.click();
  const cards = page.getByRole("group", {name:"Deine Spielfigur"}).getByRole("button");
  await expect(cards).toHaveCount(CHARACTERS.length);
  await page.screenshot({path:info.outputPath("figuren.png")});
  await cards.filter({hasText:"MC Goldie"}).click();
  await expect(figure).toContainText("MC Goldie");
  await page.screenshot({path:info.outputPath("beitreten.png")});
  await page.getByRole("radio", {name:/QR vom Handy/}).check();
  await expect(page.getByRole("button", {name:"Einladung scannen"})).toBeVisible();
  await expect(figure).toContainText("MC Goldie");
});
