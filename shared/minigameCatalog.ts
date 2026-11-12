import { ACTION_MINI_IDS, ARENA_META, isArenaId, type ArenaId } from "./partyArena";
import { MATCH_IDS, MATCH_MODULES, isMatchId, matchEligible, playerRange, type MatchId } from "./matches/framework";

/**
 * All digital minigames that rooms can draw. The "1st Generation Minigames"
 * (the 14 3D arenas plus retired match games such as Hook Wars) can be
 * switched off per room (option `classic`); match games depend on the player count.
 */
export type PlayableMiniId = ArenaId | MatchId;
export const FIRST_GEN_LABEL = "1st Generation Minigames";
/** Match games moved to the first generation; they stay playable but are not "new". */
export const FIRST_GEN_MATCH_IDS: readonly MatchId[] = ["hooks"];
export const NEW_MATCH_IDS: readonly MatchId[] = MATCH_IDS.filter(id => !FIRST_GEN_MATCH_IDS.includes(id));
export const FIRST_GEN_MINI_IDS: readonly PlayableMiniId[] = [...FIRST_GEN_MATCH_IDS, ...ACTION_MINI_IDS];
export const PLAYABLE_MINI_IDS: readonly PlayableMiniId[] = [...NEW_MATCH_IDS, ...FIRST_GEN_MINI_IDS];
export const isPlayableMini = (id: unknown): id is PlayableMiniId => typeof id === "string" && (isArenaId(id) || isMatchId(id));
export const isClassicMini = (id: unknown): id is PlayableMiniId => typeof id === "string" && (FIRST_GEN_MINI_IDS as readonly string[]).includes(id);

export function miniName(id: PlayableMiniId) { return isMatchId(id) ? MATCH_MODULES[id].meta.name : ARENA_META[id].name; }
export function miniEligible(id: PlayableMiniId, players: number) { return isMatchId(id) ? matchEligible(id, players) : players >= 1 && players <= 6; }
export function miniPlayerHint(id: PlayableMiniId) { return isMatchId(id) ? `${playerRange(id)} Spieler` : "1–6 Spieler"; }

/** Draw pool for a room. Never empty for valid settings; callers check `length`. */
export function miniPool(players: number, classic: boolean): PlayableMiniId[] {
  return [...NEW_MATCH_IDS, ...(classic ? FIRST_GEN_MINI_IDS : [])].filter(id => miniEligible(id, players));
}
