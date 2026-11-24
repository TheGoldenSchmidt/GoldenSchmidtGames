import { useEffect, useMemo, useRef, useState } from "react";
import { activePartyPlayer, type PartyAction, type PartyGame } from "../../shared/party";
import { UNITY_ROLL_IT_UP_URL, unityRollAction, unityRollBoard, unityRollState } from "../unityRollItUp";
import "../styles/unityGame.css";

type Panel = "inventory" | "collection" | "menu" | "journal";
const PANELS = new Set<Panel>(["inventory", "collection", "menu", "journal"]);

interface Props {
  game: PartyGame; viewer: string; now: number; busy: boolean; connected: boolean; error: string;
  /** Board phases show the Unity board; during minigames it stays loaded but hidden (no reload per round). */
  visible: boolean;
  send: (action: PartyAction) => void;
  onPanel: (panel: Panel) => void;
}

/**
 * Roll It Up! with the Unity board (developer test): the Bauschale, dice, figures and board
 * decisions are drawn by the Unity build; rules, bots and minigames run unchanged through the room.
 */
export function UnityRollItUpBoard({ game, viewer, now, busy, connected, error, visible, send, onPanel }: Props) {
  const frame = useRef<HTMLIFrameElement>(null), ready = useRef(false), [loaded, setLoaded] = useState(false);
  const latest = useRef({ game, send, onPanel });
  latest.current = { game, send, onPanel };
  const reduced = useMemo(() => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), []);
  const src = `${UNITY_ROLL_IT_UP_URL}${reduced ? "&ruhig=1" : ""}`;

  const post = (payload: unknown) => frame.current?.contentWindow?.postMessage({ source: "gsg-app", payload }, window.location.origin);
  const snapshot = () => unityRollState(latest.current.game, viewer, { serverNow: now, busy, connected, error, reduced });

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: string; payload?: { type?: string; action?: unknown; panel?: string } };
      if (data?.source !== "gsg-unity" || !data.payload) return;
      const message = data.payload;
      if (message.type === "ready") {
        ready.current = true;
        setLoaded(true);
        post(unityRollBoard(game));
        post(snapshot());
        post({ type: "visible", on: visible });
      } else if (message.type === "action") {
        const action = unityRollAction(latest.current.game, viewer, message.action);
        if (action) latest.current.send(action);
      } else if (message.type === "panel" && PANELS.has(message.panel as Panel)) latest.current.onPanel(message.panel as Panel);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [viewer]);

  // The room state changes far less often than the 50-ms clock: post on real changes only.
  useEffect(() => { if (ready.current) post(snapshot()); }, [game, busy, connected, error]);
  useEffect(() => { if (ready.current) post({ type: "visible", on: visible }); }, [visible]);

  return (
    <div className={`unity-roll ${visible ? "" : "is-hidden"}`} aria-hidden={!visible} data-ready={loaded} data-phase={game.phase} data-my-turn={activePartyPlayer(game).id === viewer}>
      <iframe ref={frame} className="unity-game__frame" src={src} title="Roll It Up! – Unity-Brett" allow="autoplay" />
    </div>
  );
}
