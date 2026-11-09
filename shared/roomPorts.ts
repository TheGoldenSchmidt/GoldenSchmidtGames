import type { RoomState } from "./types";
export interface SavedRoom {
  version: 1;
  savedAt: number;
  emptySince?: number;
  room: RoomState;
  tokens: [string, string][];
  moveSequences: [string, { sequence: number; id: string }][];
}

export interface RoomStorage {
  load(claim: boolean): Promise<SavedRoom[]>;
  save(changes: Map<string, SavedRoom | null>): Promise<void>;
  close(): void;
}
export interface RoomPeer {
  id: string;
  connected: boolean;
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, payload: unknown): void;
  join(group: string): void;
  leave(group: string): void;
}
export interface RoomHub {
  onPeer(listener: (peer: RoomPeer) => void): void;
  peer(id: string): RoomPeer | undefined;
  members(group: string): Iterable<string> | undefined;
  emitTo(groups: string[], event: string, payload: unknown): void;
  clearGroup(group: string): void;
  dropConnections(): void;
}
