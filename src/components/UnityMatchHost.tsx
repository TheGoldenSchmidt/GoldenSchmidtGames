import { useEffect, useMemo, useRef } from "react";
import { UNITY_MATCH_URL, unityStage, type UnityMessage } from "../unityMatch";

/**
 * The persistent Unity frame of a party with Unity rendering. It starts loading during the
 * minigame intro and stays loaded between rounds; the match stage shows it while a match runs.
 * Touches go to the app's controls above it.
 */
export function UnityMatchHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const reduced = useMemo(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), []);
  useEffect(() => {
    unityStage.attach(frame.current ?? undefined);
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !unityStage.isFrame(event.source)) return;
      const data = event.data as { source?: string; payload?: UnityMessage };
      if (data?.source === "gsg-unity" && data.payload && typeof data.payload.type === "string") unityStage.receive(data.payload);
    };
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); unityStage.attach(undefined); };
  }, []);
  return <div className="unity-match" aria-hidden="true">
    <iframe ref={frame} src={`${UNITY_MATCH_URL}${reduced ? "&ruhig=1" : ""}`} title="Unity-Darstellung" tabIndex={-1} />
  </div>;
}
