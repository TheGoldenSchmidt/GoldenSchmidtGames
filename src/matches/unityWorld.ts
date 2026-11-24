import { followCamera, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "./client";
import { UNITY_MATCH_SCENES, UNITY_SNAPSHOTS, unityMatchSetup, unityStage } from "../unityMatch";
import type { MatchState } from "../../shared/matches/types";
import type { MiniView } from "../../shared/minigameLooks";

/** How long the stage waits for a Unity build that is still loading before the web view takes over. */
const READY_TIMEOUT = 25000;

/**
 * Match world drawn by the persistent Unity frame (see `unityMatch.ts`): posts the setup once
 * Unity is ready, every new snapshot and the own aim, forwards hand turns of the camera and
 * keeps chase controls relative to the camera heading that Unity reports back.
 */
export function createUnityWorld(view: MiniView, host: HTMLElement, read: () => MatchWorldFrame, onError: () => void): MatchWorld {
  const chase = view !== "top";
  let frame = 0, started = false, disposed = false, camYaw: number | undefined, lastCur: MatchState | undefined, lastAim = "";
  const since = performance.now();
  host.dataset.renderer = "unity";
  host.dataset.ready = "false";
  // Shown at once: while the build still loads, its own loading bar is visible under the countdown.
  unityStage.show(true);
  const off = unityStage.listen(message => {
    if (message.type === "cam" && typeof message.yaw === "number" && Number.isFinite(message.yaw)) { camYaw = message.yaw; host.dataset.yaw = camYaw.toFixed(3); }
    else if (message.type === "error") fail();
  });
  const fail = () => { if (disposed) return; dispose(); onError(); };
  const start = (f: MatchWorldFrame) => {
    unityStage.post(unityMatchSetup(f.cur, f.viewer, view, f.reduced, f.names, f.characters));
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
      const local = f.local as ChaseLocal;
      if (chase) {
        takeCameraTurn(local, delta => unityStage.post({ type: "turn", delta }));
        if (camYaw !== undefined) followCamera(local, f.input, camYaw);
      }
      // The own aim (field direction) shows at once: laser and turret do not wait for the next snapshot.
      const aim = `${f.input.ax.toFixed(2)},${f.input.ay.toFixed(2)}`;
      if (aim !== lastAim) { lastAim = aim; unityStage.post({ type: "aim", x: f.input.ax, y: f.input.ay }); }
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
    delete host.dataset.renderer;
  }
  return { dispose };
}
