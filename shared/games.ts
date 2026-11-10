import type { GameDefinition, GameId } from "./types";
import { isMinigameMode, type MinigameMode } from "./minigameModes";

export function isPartyMode(id: unknown): id is "party" | "roll-it-up" | MinigameMode {
  return id === "party" || id === "roll-it-up" || isMinigameMode(id);
}

export const GAMES: GameDefinition[] = [
  { id: "roll-it-up", name: "Roll It Up!", shortDescription: "Sammle sechs Utensilien in der Bauschale und erreiche den Jayspot.", minPlayers: 2, maxPlayers: 6, status: "ready" },
  { id: "party", name: "Inselparty", shortDescription: "Eine Insel, Trophäen, Items und gemeinsame Minispiele.", minPlayers: 2, maxPlayers: 6, status: "ready" },
  { id: "free-minigame", name: "Freies Minispiel", shortDescription: "Wählt ein Minispiel und spielt direkt gegeneinander.", minPlayers: 2, maxPlayers: 6, status: "ready" },
  { id: "goldenschmidt", name: "Schlag den GoldenSchmidt", shortDescription: "Zufällige Minispiele, einmalige Einsätze und ein Gesamtsieg.", minPlayers: 2, maxPlayers: 6, status: "ready" },
  {
    id: "qwixx",
    name: "Qwixx",
    shortDescription: "Vier Farbreihen, sechs Würfel und Entscheidungen bei jedem Wurf.",
    minPlayers: 2,
    maxPlayers: 5,
    status: "ready"
  },
  {
    id: "durak",
    name: "Durak",
    shortDescription: "Angreifen, verteidigen und als Erster alle Karten loswerden.",
    minPlayers: 2,
    maxPlayers: 6,
    status: "ready"
  },
  {
    id: "kribbeln",
    name: "Kribbeln",
    shortDescription: "Sechs Würfel, wechselnde Farbaufgaben und spannende Kribbelfelder.",
    minPlayers: 2,
    maxPlayers: 5,
    status: "ready"
  },
  {
    id: "binokel",
    name: "Binokel",
    shortDescription: "Reizen, melden und mit dem richtigen Trumpf Stiche sammeln.",
    minPlayers: 2,
    maxPlayers: 4,
    status: "soon"
  }
];

export function getGame(id: GameId): GameDefinition {
  const game = GAMES.find((entry) => entry.id === id);
  if (!game) throw new Error(`Unbekanntes Spiel: ${id}`);
  return game;
}
