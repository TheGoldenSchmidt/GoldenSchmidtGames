import { useMemo } from "react";
import { UNITY_GAMES, unityGameUrl, type UnityGameId } from "../unityGames";
import "../styles/unityGame.css";

/** Full-screen frame for a Unity test game; the build brings its own HUD, the app only the way back. */
export function UnityGameScreen({ game, characterId, onExit }: { game: UnityGameId; characterId?: string; onExit: () => void }) {
  const entry = UNITY_GAMES.find(item => item.id === game)!;
  const src = useMemo(() => unityGameUrl(game, characterId, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false), [game, characterId]);
  return (
    <main className="unity-game">
      <iframe className="unity-game__frame" src={src} title={`${entry.name} (Unity-Test)`} allow="autoplay; fullscreen" />
      <button className="unity-game__exit" onClick={onExit} aria-label={`${entry.name} verlassen`}>×</button>
    </main>
  );
}
