import { followCamera, takeCameraTurn, type ChaseLocal, type MatchWorld, type MatchWorldFrame } from "./client";
import { isUnityHost, UNITY_MATCH_SCENES, UNITY_SNAPSHOTS, unityMatchSetup, unityStage } from "../unityMatch";
import type { MatchState } from "../../shared/matches/types";
import type { LavaHostGame } from "../../shared/matches/lavaHost";
import type { MiniView } from "../../shared/minigameLooks";
import type { PartyUnityReport } from "../../shared/party";

/** How long the stage waits for a Unity build that is still loading before the web view takes over. */
const READY_TIMEOUT = 25000;

/**
 * Match world drawn by the persistent Unity frame (see `unityMatch.ts`): posts the setup once
 * Unity is ready, every new snapshot and the own aim, forwards hand turns of the camera and
 * keeps chase controls relative to the camera heading that Unity reports back.
 *
 * Floor is Lava also gets the own input every frame ("own"): Unity moves the own figure at once
 * and blends it into the room's positions. With "Unity · Host rechnet" the host's scene also gets
 * everyone's inputs ("inputs") and its reports go to the room through `report`.
 */
export function createUnityWorld(view: MiniView, host: HTMLElement, read: () => MatchWorldFrame, onError: () => void, report?: (r: PartyUnityReport) => void): MatchWorld {
  const chase = view !== "top";
  let frame = 0, started = false, disposed = false, camYaw: number | undefined, lastCur: MatchState | undefined, lastAim = "", lastOwn = "", reportSeq = 0, hostRole = false;
  const since = performance.now();
  host.dataset.renderer = "unity";
  host.dataset.ready = "false";
  // Shown at once: while the build still loads, its own loading bar is visible under the countdown.
  unityStage.show(true);
  const off = unityStage.listen(message => {
    if (message.type === "cam" && typeof message.yaw === "number" && Number.isFinite(message.yaw)) { camYaw = message.yaw; host.dataset.yaw = camYaw.toFixed(3); }
    else if (message.type === "error") fail();
    // The host's simulation: snapshots and the end go to the room (checked there).
    else if (hostRole && (message.type === "hostsnap" || message.type === "hostdone") && message.snap) {
      report?.({ seq: ++reportSeq, snap: message.snap, done: message.type === "hostdone" });
      host.dataset.hostReports = String(reportSeq);
    }
  });
  const fail = () => {
    if (disposed) return;
    // Without Unity on the host, the room computes with the web rules from now on.
    if (hostRole) report?.({ seq: ++reportSeq, fail: true });
    dispose(); onError();
  };
  const start = (f: MatchWorldFrame) => {
    hostRole = isUnityHost(f.cur, f.viewer);
    // A reloaded host continues the report numbers above the room's last accepted one.
    if (hostRole) reportSeq = (f.cur.game as LavaHostGame).seq;
    unityStage.post(unityMatchSetup(f.cur, f.viewer, view, f.reduced, f.names, f.characters, f.bots));
    host.dataset.ready = "true";
    host.dataset.role = hostRole ? "host" : "view";
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
      const game = UNITY_MATCH_SCENES[f.cur.id], snapshot = UNITY_SNAPSHOTS[game];
      if (f.cur !== lastCur) {
        lastCur = f.cur;
        const snap = snapshot?.(f.cur);
        if (snap) unityStage.post(snap);
        if (hostRole) unityStage.post({ type: "inputs", time: f.cur.time, players: (f.cur.game as LavaHostGame).inputs ?? [] });
      }
      const local = f.local as ChaseLocal;
      if (chase) {
        takeCameraTurn(local, delta => unityStage.post({ type: "turn", delta }));
        if (camYaw !== undefined) followCamera(local, f.input, camYaw);
      }
      // The own aim (field direction) shows at once: laser and turret do not wait for the next snapshot.
      const aim = `${f.input.ax.toFixed(2)},${f.input.ay.toFixed(2)}`;
      if (aim !== lastAim) { lastAim = aim; unityStage.post({ type: "aim", x: f.input.ax, y: f.input.ay }); }
      if (game === "lava") {
        const own = `${f.input.x.toFixed(2)},${f.input.y.toFixed(2)},${f.input.ca},${f.input.cb},${f.input.cn}`;
        if (own !== lastOwn) { lastOwn = own; unityStage.post({ type: "own", x: f.input.x, y: f.input.y, ca: f.input.ca, cb: f.input.cb, cn: f.input.cn }); }
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
    delete host.dataset.renderer;
  }
  return { dispose };
}
