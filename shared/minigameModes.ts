import { ACTION_MINI_IDS, isArenaId, type ArenaId } from "./partyArena";

export type MinigameMode = "free-minigame" | "goldenschmidt";
export const isMinigameMode = (id: unknown): id is MinigameMode => id === "free-minigame" || id === "goldenschmidt";

export interface MinigameOptions { rounds: number; miniId: ArenaId }
export const MINIGAME_DEFAULTS: MinigameOptions = { rounds: 5, miniId: "dash" };

export function minigameOptions(value?: Partial<MinigameOptions>): MinigameOptions {
  const rounds = value?.rounds ?? MINIGAME_DEFAULTS.rounds;
  const miniId = value?.miniId ?? MINIGAME_DEFAULTS.miniId;
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > ACTION_MINI_IDS.length || typeof miniId !== "string" || !isArenaId(miniId)) {
    throw new Error(`Wähle 1–${ACTION_MINI_IDS.length} Minispiele und ein verfügbares Minispiel.`);
  }
  return { rounds, miniId };
}

export interface MinigameRoundResult {
  miniId: ArenaId;
  winnerIds: string[];
  bets: Record<string, number>;
  points: Record<string, number>;
}

export interface MinigameCompetition {
  rounds: number;
  scores: Record<string, number>;
  used: Record<string, number[]>;
  bets: Record<string, number>;
  locked: string[];
  history: MinigameRoundResult[];
}

export function availableBets(competition: MinigameCompetition, playerId: string): number[] {
  return Array.from({ length: competition.rounds }, (_, i) => i + 1).filter(n => !competition.used[playerId]?.includes(n));
}

/** Called only on the authoritative, cloned game state. A committed bet cannot be changed. */
export function placeMinigameBet(competition: MinigameCompetition, playerId: string, value: number) {
  if (competition.locked.includes(playerId)) throw new Error("Dein Einsatz steht bereits fest.");
  if (!Number.isInteger(value) || !competition.used[playerId] || !availableBets(competition, playerId).includes(value)) {
    throw new Error("Wähle einen deiner noch freien Einsätze.");
  }
  competition.bets[playerId] = value;
  competition.used[playerId].push(value);
  competition.locked.push(playerId);
}
