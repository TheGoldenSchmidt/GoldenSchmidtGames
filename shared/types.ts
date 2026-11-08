export type GameId = "qwixx" | "durak" | "kribbeln" | "binokel" | "party";

export type QwixxColor = "red" | "yellow" | "green" | "blue";

export interface QwixxDice {
  white: [number, number];
  colors: Record<QwixxColor, number | null>;
}

export interface QwixxSheet {
  playerId: string;
  playerName: string;
  marks: Record<QwixxColor, number[]>;
  locks: QwixxColor[];
  failedThrows: number;
}

export interface QwixxGameState {
  playerOrder: string[];
  sheets: Record<string, QwixxSheet>;
  turnIndex: number;
  round: number;
  phase: "awaiting-roll" | "white-choice" | "color-choice" | "finished";
  dice?: QwixxDice;
  whiteChoices: Partial<Record<string, QwixxColor | null>>;
  closedRows: QwixxColor[];
  winnerIds: string[];
  log: string[];
}

export type DurakSuit = "clubs" | "diamonds" | "hearts" | "spades";
export type DurakRank = "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface DurakCard {
  id: string;
  suit: DurakSuit;
  rank: DurakRank;
}

export interface DurakTablePair {
  attack: DurakCard;
  defense?: DurakCard;
  attackPlayedBy: string;
  defensePlayedBy?: string;
  attackIllegal?: boolean;
  defenseIllegal?: boolean;
}

export interface DurakGameState {
  playerOrder: string[];
  playerNames: Record<string, string>;
  hands: Record<string, DurakCard[]>;
  handCounts: Record<string, number>;
  deck: DurakCard[];
  trumpSuit: DurakSuit;
  trumpCard: DurakCard;
  attackerId: string;
  defenderId: string;
  phase: "attack" | "defend" | "throw-in" | "finished";
  table: DurakTablePair[];
  maxAttackCards: number;
  defenderTakes: boolean;
  finishedPlayerIds: string[];
  durakId: string | null;
  cheatMode: boolean;
  cheatBannedPlayerIds: string[];
  accusationUsedPlayerIds: string[];
  log: string[];
}

export interface GameDefinition {
  id: GameId;
  name: string;
  shortDescription: string;
  minPlayers: number;
  maxPlayers: number;
  status: "ready" | "soon";
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  score: number;
  characterId?: import("./characters").CharacterId;
  bot?: boolean;
}

export interface RoomConfig {
  gameId: GameId;
  playerCount: number;
  durakCheatMode?: boolean;
  party?: import("./party").PartyOptions;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  config: RoomConfig;
  phase: "lobby" | "playing";
  game?: QwixxGameState;
  durakGame?: DurakGameState;
  kribbelnGame?: import("./kribbeln").KribbelnGame;
  partyGame?: import("./party").PartyGame;
  partyToken?: string;
  partyTest?: { seed: number; commandSeq?: number };
}

export interface GuestProfile {
  id: string;
  username: string;
}

export interface Ack<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}
