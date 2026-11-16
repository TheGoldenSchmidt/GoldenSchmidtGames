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
