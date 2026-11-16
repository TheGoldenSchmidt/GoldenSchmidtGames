import type { Page } from "@playwright/test";

export async function selectEntryCharacter(page: Page, name: string) {
  await page.locator("summary").filter({hasText:"Deine Spielfigur"}).click();
  await page.getByRole("group", {name:"Deine Spielfigur"}).getByRole("button", {name, exact:true}).click();
}
