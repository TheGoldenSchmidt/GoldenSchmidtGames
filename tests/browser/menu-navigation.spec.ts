import { test, expect } from "@playwright/test";

test("Online-Wege trennen Erstellen, Raumcode und QR und behalten die Figur", async ({page}) => {
  await page.goto("/");
  await page.getByRole("button", {name: /Online spielen/}).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", {name: /^Raum erstellen/}).click();
  await expect(page.getByRole("textbox", {name: "Raumcode"})).toHaveCount(0);
  await page.getByLabel("Deine Spielfigur").selectOption({label: "Morty Smith"});
  await page.getByRole("button", {name: "Zurück"}).click();
  await page.getByRole("button", {name: /^Raum beitreten/}).click();
  await expect(page.getByRole("button", {name: "Neuen Raum erstellen"})).toHaveCount(0);
  await expect(page.getByLabel("Deine Spielfigur")).toHaveValue("alpha_morty_smith");
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
