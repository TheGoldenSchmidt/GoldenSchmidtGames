import type { Page } from "@playwright/test";
import { getGame } from "../../shared/games";
import type { GameId } from "../../shared/types";

export const selectedLobbyGame = (page: Page) => page.locator(".room summary").filter({hasText:"Spiel auswählen"}).locator("strong");

export async function selectLobbyGame(page: Page, id: GameId) {
  await selectedLobbyGame(page).click();
  const gallery = page.getByRole("group", {name:"Spiel auswählen"});
  await gallery.getByRole("button").filter({has:page.getByText(getGame(id).name,{exact:true})}).click();
}
