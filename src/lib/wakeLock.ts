import { useEffect } from "react";

type Sentinel = { release: () => Promise<void>; addEventListener: (type: "release", listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

/**
 * Keeps the screen on while `active` (lobby and running games): otherwise phones lock during
 * other players' turns, and a hosting phone pauses the whole table. The browser drops the lock
 * when the app goes to the background; it is requested again when the app is visible.
 * Without support (or permission) nothing happens.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    const api = (navigator as WakeLockNavigator).wakeLock;
    if (!active || !api) return;
    let lock: Sentinel | undefined, stopped = false, pending = false;
    const request = () => {
      if (stopped || lock || pending || document.visibilityState !== "visible") return;
      pending = true;
      api.request("screen").then(sentinel => {
        pending = false;
        if (stopped) { void sentinel.release().catch(() => {}); return; }
        lock = sentinel;
        sentinel.addEventListener("release", () => { if (lock === sentinel) lock = undefined; });
      }).catch(() => { pending = false; });
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
