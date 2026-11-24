import { useEffect, useRef } from "react";

/**
 * In-app back navigation for the Android back gesture and the browser back button.
 *
 * Screens register a back step (close a dialog, leave a sub view, ask before leaving a game).
 * While at least one is registered, a single guard entry sits on the browser history; the
 * back gesture pops it and the most recently registered step runs instead of leaving the app.
 * The start screen registers nothing, so there the gesture leaves the app as usual.
 */
type Step = { run: () => void };
const steps: Step[] = [];
let guarded = false, ignorePop = false, installed = false;

function arm() {
  if (guarded || !steps.length) return;
  history.pushState({ gsgBack: true }, "");
  guarded = true;
}

/** Removes a leftover guard once nothing can go back any more (e.g. after returning home via a button). */
function disarmLater() {
  window.setTimeout(() => {
    if (steps.length || !guarded) return;
    guarded = false;
    if (history.state?.gsgBack) { ignorePop = true; history.back(); }
  }, 0);
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("popstate", () => {
    if (ignorePop) { ignorePop = false; return; }
    guarded = false;
    steps.at(-1)?.run();
    // Re-arm after React applied the step; a screen that is still open keeps the gesture in the app.
    window.setTimeout(arm, 0);
  });
}

/** Registers a back step while `enabled`; the newest step runs first. */
export function useBackStep(run: () => void, enabled = true) {
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    install();
    const step: Step = { run: () => latest.current() };
    steps.push(step);
    arm();
    return () => {
      const index = steps.indexOf(step);
      if (index >= 0) steps.splice(index, 1);
      disarmLater();
    };
  }, [enabled]);
}
