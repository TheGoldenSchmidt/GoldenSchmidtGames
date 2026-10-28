import type { GameDefinition, GameId } from "./types";

export const GAMES: GameDefinition[] = [
  {
    id: "qwixx",
    name: "Qwixx",
    shortDescription: "Vier Farbreihen, sechs Würfel und Entscheidungen bei jedem Wurf.",
    minPlayers: 2,
    maxPlayers: 5,
    status: "ready"
  }
];

export function getGame(id: GameId): GameDefinition {
  const game = GAMES.find((entry) => entry.id === id);
  if (!game) throw new Error(`Unbekanntes Spiel: ${id}`);
  return game;
}
