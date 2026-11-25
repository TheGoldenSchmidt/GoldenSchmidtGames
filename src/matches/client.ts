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
  /** Height covered by the floating HUD at the top (only for `fullBleed` games; others start below it). */
  top: number;
}

/** Frame for a 3D world: the same snapshot data as the canvas, plus the chosen figures. */
export interface MatchWorldFrame extends Omit<MatchFrame, "w" | "h" | "top"> {
  /** Figure per player id (as chosen in the lobby). */
  characters: Record<string, string | undefined>;
  /** Bot seats (a Unity scene that simulates drives them itself). */
  bots?: Record<string, boolean>;
}
export interface MatchWorld { dispose(): void }
/** Builds a WebGL scene in `host`; `read` returns the current frame, `onError` falls back to the canvas. */
export type MatchWorldFactory = (host: HTMLElement, read: () => MatchWorldFrame, onError: () => void) => MatchWorld;

export interface MatchIO {
  readonly input: MatchInput;
  local: Record<string, number>;
  /** Update held values; `now` sends them immediately (still spaced ≥ 30 ms). */
  set(values: Partial<MatchInput>, now?: boolean): void;
  press(kind: "a" | "b"): void;
  command(value: number): void;
}

export interface MatchControlsProps { io: MatchIO; view: MatchState; viewer: string; active: boolean; /** True while the 3D world (not the canvas fallback) is shown. */ world?: boolean }

export interface MatchClient {
  /** Draws one frame into a canvas already scaled to CSS pixels. */
  render(ctx: CanvasRenderingContext2D, frame: MatchFrame): void;
  Controls(props: MatchControlsProps): ReactNode;
  /** One short status line for the HUD (round, lives …). */
  status?(view: MatchState, viewer: string): string;
  sound?(event: MatchEvent, viewer: string): Sfx | undefined;
  /** Event kinds that must not appear as a text chip (e.g. decoys would give the trick away). */
  quiet?: readonly string[];
  /** Label under the HUD score; defaults to "Punkte". */
  unit?: string;
  /** Colour under the floating HUD for canvas games (the canvas starts below it). */
  backdrop?: string;
  /** The canvas draws the full screen and keeps its own HUD items below `frame.top`. */
  fullBleed?: boolean;
  /**
   * Optional 2.5D/3D presentation, loaded on demand. Without WebGL or after an
   * error the stage falls back to `render` on the canvas; rules are unaffected.
   */
  world?: () => Promise<MatchWorldFactory>;
  /** True when the 3D world uses a chase camera (test mode shows camera sliders). */
  chase?: boolean;
  /** Text overlay for the 3D world (the canvas draws its own). */
  banner?(view: MatchState, viewer: string): { title: string; text: string } | undefined;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Stick to field direction for a camera that looks along `yaw` (0 = towards
 * the top of the field): pushing the stick up always moves away from the
 * camera. Field x is right, field y is down on the overview (= world +z).
 */
export function cameraRelative(x: number, y: number, yaw: number): [number, number] {
  const fx = Math.sin(yaw), fy = -Math.cos(yaw);
  return [x * -fy + -y * fx, x * fx + -y * fy];
}
/** Heading (camera yaw) of a field direction. */
export const headingOf = (x: number, y: number) => Math.atan2(x, -y);

/** Keys in `MatchIO.local` shared between the touch controls and a 3D world with a chase camera. */
export interface ChaseLocal {
  /** Current camera heading while a chase camera is active; undefined otherwise. */
  camYaw?: number;
  /** Raw stick values as the finger holds them (screen directions). */
  stickX?: number; stickY?: number;
  /** Raw aim drag (screen directions) while the finger holds it. */
  aimX?: number; aimY?: number;
  /** 1 = overview chosen on this device. */
  overview?: number;
  /** Camera turn by hand (radians) not yet applied by the 3D world. */
  camTurn?: number;
  /** Test mode: chase camera distance, height and follow speed as multipliers. */
  camDistK?: number; camHeightK?: number; camTurnK?: number;
}
/** Applies a pending hand turn to a chase camera (call once per frame before `update`). */
export function takeCameraTurn(local: ChaseLocal, turn: (delta: number) => void) {
  if (local.camTurn) { turn(local.camTurn); local.camTurn = 0; }
}

/**
 * Called by a 3D world with a chase camera once per frame: publishes the
 * camera heading for the controls and keeps a held stick meaning "away from
 * the camera" while the camera turns (the next periodic packet carries it).
 */
export function followCamera(local: ChaseLocal, input: MatchInput, yaw: number) {
  local.camYaw = yaw;
  const sx = local.stickX ?? 0, sy = local.stickY ?? 0, ax = local.aimX ?? 0, ay = local.aimY ?? 0;
  if (Math.hypot(sx, sy) > .05) {
    const [ix, iy] = cameraRelative(sx, sy, yaw);
    if (Math.abs(ix - input.x) + Math.abs(iy - input.y) > .04) { input.x = ix; input.y = iy; }
  }
  if (Math.hypot(ax, ay) > .05) {
    const [ix, iy] = cameraRelative(ax, ay, yaw);
    if (Math.abs(ix - input.ax) + Math.abs(iy - input.ay) > .04) { input.ax = ix; input.ay = iy; }
  }
}
/** Aim handler for chase-camera games: remembers the raw drag and sends the field direction. */
export function chaseAim(io: MatchIO, x: number, y: number, now = true) {
  const local = io.local as ChaseLocal;
  local.aimX = x; local.aimY = y;
  const [ax, ay] = local.camYaw === undefined ? [x, y] : cameraRelative(x, y, local.camYaw);
  io.set({ ax, ay }, now);
}
/** Stick handler for chase-camera games: remembers the raw stick and sends the field direction. */
export function chaseStick(io: MatchIO, x: number, y: number) {
  const local = io.local as ChaseLocal;
  local.stickX = x; local.stickY = y;
  const [fx, fy] = local.camYaw === undefined ? [x, y] : cameraRelative(x, y, local.camYaw);
  io.set({ x: fx, y: fy }, true);
}
