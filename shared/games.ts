import type { GameDefinition, GameId } from "./types";

export const GAMES: GameDefinition[] = [
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
    status: "soon"
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
