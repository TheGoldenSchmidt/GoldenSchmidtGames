import { isPlayableMini, miniEligible, miniName, miniPlayerHint, miniPool, PLAYABLE_MINI_IDS, type PlayableMiniId } from "./minigameCatalog";

export type MinigameMode = "free-minigame" | "goldenschmidt";
export const isMinigameMode = (id: unknown): id is MinigameMode => id === "free-minigame" || id === "goldenschmidt";

/** `classic` keeps the 14 original 3D arenas in the random draw. */
export interface MinigameOptions { rounds: number; miniId: PlayableMiniId; classic: boolean }
export const MINIGAME_DEFAULTS: MinigameOptions = { rounds: 5, miniId: "dash", classic: true };

export function minigameOptions(value?: Partial<MinigameOptions>): MinigameOptions {
  const rounds = value?.rounds ?? MINIGAME_DEFAULTS.rounds;
  const miniId = value?.miniId ?? MINIGAME_DEFAULTS.miniId;
  const classic = value?.classic ?? MINIGAME_DEFAULTS.classic;
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > PLAYABLE_MINI_IDS.length || typeof miniId !== "string" || !isPlayableMini(miniId) || typeof classic !== "boolean") {
    throw new Error(`Wähle 1–${PLAYABLE_MINI_IDS.length} Minispiele und ein verfügbares Minispiel.`);
  }
  return { rounds, miniId, classic };
}

/** Checks settings against the actual number of players before a room can start. */
export function checkMinigameSetup(mode: MinigameMode, options: MinigameOptions, players: number) {
  if (mode === "free-minigame") {
    if (!miniEligible(options.miniId, players)) throw new Error(`${miniName(options.miniId)} braucht ${miniPlayerHint(options.miniId)}.`);
    return;
  }
  const pool = miniPool(players, options.classic);
  if (!pool.length) throw new Error("Für diese Spielerzahl gibt es ohne klassische Minispiele noch kein passendes Spiel.");
  if (options.rounds > pool.length) throw new Error(`Für ${players} Spieler stehen ${pool.length} Minispiele zur Auswahl. Wähle höchstens ${pool.length}.`);
}

export interface MinigameRoundResult {
  miniId: PlayableMiniId;
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
