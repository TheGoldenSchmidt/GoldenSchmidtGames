import { followCamera, takeCameraTurn, type ChaseLocal, type MatchIO, type MatchWorld, type MatchWorldFrame } from "./client";
import { UNITY_MATCH_SCENES, UNITY_SNAPSHOTS, unityInput, unityMatchSetup, unityStage } from "../unityMatch";
import type { MatchState } from "../../shared/matches/types";
import type { MiniView } from "../../shared/minigameLooks";

/** How long the stage waits for a Unity build that is still loading before the web view takes over. */
const READY_TIMEOUT = 25000;

export interface UnityWorldHooks {
  io: MatchIO;
  /** Milliseconds until the room's start signal. */
  startIn: () => number;
  sound: () => boolean;
  /** Unity's own HUD took over (true) – the app hides its controls, countdown and feedback. */
  onControls: (unity: boolean) => void;
}

/**
 * Match world drawn by the persistent Unity frame (see `unityMatch.ts`). Once Unity is ready it gets
 * the setup and every new snapshot; when its scene is up ("playing") Unity's own HUD takes the touches
 * and sends input and taps back, which go to the room like the app's controls. Until then the app's
 * controls work (aim and camera turns are forwarded, the stick follows Unity's camera heading).
 */
export function createUnityWorld(view: MiniView, host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, hooks: UnityWorldHooks): MatchWorld {
  const chase = view !== "top";
  let frame = 0, started = false, disposed = false, camYaw: number | undefined, lastCur: MatchState | undefined, lastAim = "", sound: boolean | undefined;
  const since = performance.now();
  host.dataset.renderer = "unity";
  host.dataset.ready = "false";
  // Shown at once: while the build still loads, its own loading bar is visible under the countdown.
  unityStage.show(true);
  const off = unityStage.listen(message => {
    if (!started) return;
    if (message.type === "cam" && typeof message.yaw === "number" && Number.isFinite(message.yaw)) { camYaw = message.yaw; host.dataset.yaw = camYaw.toFixed(3); }
    else if (message.type === "playing") { host.dataset.controls = "unity"; unityStage.interactive(true); hooks.onControls(true); }
    else if (message.type === "input") hooks.io.set(unityInput(message), true);
    else if (message.type === "press" && (message.kind === "a" || message.kind === "b")) hooks.io.press(message.kind);
    // A game command (e.g. Floor is Lava's dive = 1); the rules check it like the app's own button.
    else if (message.type === "command" && Number.isInteger(message.value) && message.value! >= 0 && message.value! <= 9) hooks.io.command(message.value!);
    else if (message.type === "error") fail();
  });
  const fail = () => { if (disposed) return; dispose(); onError(); };
  const start = (f: MatchWorldFrame) => {
    sound = hooks.sound();
    unityStage.post(unityMatchSetup(f.cur, f.viewer, view, f.reduced, f.names, f.characters, hooks.startIn(), sound));
    host.dataset.ready = "true";
    started = true;
  };
  const tick = () => {
    if (disposed) return;
    const f = read();
    if (!started) {
      if (unityStage.ready) start(f);
      else if (performance.now() - since > READY_TIMEOUT) { fail(); return; }
    }
    if (started) {
      const snapshot = UNITY_SNAPSHOTS[UNITY_MATCH_SCENES[f.cur.id]];
      if (f.cur !== lastCur && snapshot) { lastCur = f.cur; unityStage.post(snapshot(f.cur)); }
      if (hooks.sound() !== sound) { sound = hooks.sound(); unityStage.post({ type: "sound", on: sound }); }
      if (host.dataset.controls !== "unity") {
        const local = f.local as ChaseLocal;
        if (chase) {
          takeCameraTurn(local, delta => unityStage.post({ type: "turn", delta }));
          if (camYaw !== undefined) followCamera(local, f.input, camYaw);
        }
        // The app's aim (field direction) shows at once in Unity: laser and turret do not wait for the next snapshot.
        const aim = `${f.input.ax.toFixed(2)},${f.input.ay.toFixed(2)}`;
        if (aim !== lastAim) { lastAim = aim; unityStage.post({ type: "aim", x: f.input.ax, y: f.input.ay }); }
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    off();
    if (started) unityStage.post({ type: "idle" });
    unityStage.show(false);
    hooks.onControls(false);
    delete host.dataset.renderer;
    delete host.dataset.controls;
  }
  return { dispose };
}
