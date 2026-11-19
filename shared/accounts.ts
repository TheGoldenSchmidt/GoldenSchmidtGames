import type { CharacterId } from "./characters";
import type { GameId } from "./types";

export const ACCOUNT_ROLES = ["player", "developer", "admin"] as const;
export type AccountRole = typeof ACCOUNT_ROLES[number];
export const ROLE_NAMES: Record<AccountRole, string> = { player: "Spieler", developer: "Entwickler", admin: "Admin" };
export interface AccountSettings { displayName: string; characterId?: CharacterId; sound: boolean }
export interface Account { id: string; username: string; role: AccountRole; settings: AccountSettings }
export interface GameStatistic { gameId: GameId; played: number; won: number }
export function canDevelop(role: AccountRole | undefined) { return role === "admin" || role === "developer"; }
