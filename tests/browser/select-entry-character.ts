import type { Page } from "@playwright/test";

export async function selectEntryCharacter(page: Page, name: string, title = "Deine Spielfigur") {
  const group = page.getByRole("group", {name:title, exact:true});
  if (!await group.isVisible()) await page.locator("summary").filter({hasText:title}).click();
  await page.getByRole("group", {name:title, exact:true}).getByRole("button", {name, exact:true}).click();
}
