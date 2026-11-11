import type { ReactNode } from "react";
import type { MatchEvent, MatchInput, MatchState } from "../../shared/matches/types";
import type { Sfx } from "./sfx";

/** Same order as the 3D arenas and the party roster colours. */
export const PLAYER_HEX = ["#e65c65", "#398fe2", "#67b94b", "#a16bd0", "#f4a53e", "#e8ca3b"];
export const playerColor = (style: number) => PLAYER_HEX[style % PLAYER_HEX.length];

export interface MatchFrame {
  /** Previous and latest snapshot; continuous values are interpolated with `alpha`. */
  prev: MatchState; cur: MatchState; alpha: number;
  viewer: string; reduced: boolean; names: Record<string, string>;
  /** Device-local marks such as the moment a signal became visible. */
  local: Record<string, number>;
  input: MatchInput;
  w: number; h: number;
  /** `performance.now()` of this frame. */
  t: number;
  /** Estimated authority time (ms since start) for this frame, for smooth extrapolation. */
  simTime: number;
}

export interface MatchIO {
  readonly input: MatchInput;
  local: Record<string, number>;
  /** Update held values; `now` sends them immediately (still spaced ≥ 30 ms). */
  set(values: Partial<MatchInput>, now?: boolean): void;
  press(kind: "a" | "b"): void;
  command(value: number): void;
}

export interface MatchControlsProps { io: MatchIO; view: MatchState; viewer: string; active: boolean }

export interface MatchClient {
  /** Draws one frame into a canvas already scaled to CSS pixels. */
  render(ctx: CanvasRenderingContext2D, frame: MatchFrame): void;
  Controls(props: MatchControlsProps): ReactNode;
  /** One short status line for the HUD (round, lives …). */
  status?(view: MatchState, viewer: string): string;
  sound?(event: MatchEvent, viewer: string): Sfx | undefined;
  /** Event kinds that must not appear as a text chip (e.g. decoys would give the trick away). */
  quiet?: readonly string[];
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
