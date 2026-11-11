import { ACTION_MINI_IDS, ARENA_META, isArenaId, type ArenaId } from "./partyArena";
import { MATCH_IDS, MATCH_MODULES, isMatchId, matchEligible, playerRange, type MatchId } from "./matches/framework";

/**
 * All digital minigames that rooms can draw. The 14 3D arenas are "classic"
 * and can be switched off per room; match games depend on the player count.
 */
export type PlayableMiniId = ArenaId | MatchId;
export const PLAYABLE_MINI_IDS: readonly PlayableMiniId[] = [...MATCH_IDS, ...ACTION_MINI_IDS];
export const isPlayableMini = (id: unknown): id is PlayableMiniId => typeof id === "string" && (isArenaId(id) || isMatchId(id));
export const isClassicMini = (id: unknown): id is ArenaId => typeof id === "string" && isArenaId(id);

export function miniName(id: PlayableMiniId) { return isMatchId(id) ? MATCH_MODULES[id].meta.name : ARENA_META[id].name; }
export function miniEligible(id: PlayableMiniId, players: number) { return isMatchId(id) ? matchEligible(id, players) : players >= 1 && players <= 6; }
export function miniPlayerHint(id: PlayableMiniId) { return isMatchId(id) ? `${playerRange(id)} Spieler` : "1–6 Spieler"; }

/** Draw pool for a room. Never empty for valid settings; callers check `length`. */
export function miniPool(players: number, classic: boolean): PlayableMiniId[] {
  return [...MATCH_IDS.filter(id => matchEligible(id, players)), ...(classic ? ACTION_MINI_IDS : [])];
}
