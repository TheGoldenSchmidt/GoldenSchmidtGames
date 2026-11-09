import {characterId,characterPortrait} from "../../shared/characters";
import {preloadFigures} from "../figures/catalog";
import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getGame } from "../../shared/games";
import type { GameId } from "../../shared/types";
import type { IntroPlayer, IntroStage } from "../three/introWorld";

const CAPTIONS: Record<string, Record<IntroStage, string>> = {
  "roll-it-up": { seated: "Willkommen in der Bauschale.", approach: "Sechs Kaufstellen am Rand.", overhead: "Euer Ziel ist die Bank auf dem Hügel." },
  durak: { seated: "Nehmt Platz. Die Karten liegen bereit.", approach: "Die Runde rückt zusammen.", overhead: "Der Tisch gehört euch." },
  qwixx: { seated: "Eure Runde. Sechs Würfel. Vier Farben.", approach: "Alle Augen auf den nächsten Wurf.", overhead: "Jeder Wurf zählt." },
  kribbeln: { seated: "Nehmt Platz an der Würfelkiste.", approach: "Sechs Farben, neue Möglichkeiten.", overhead: "Jetzt kribbelt’s." },
  party: { seated: "Eure Insel wartet auf euch.", approach: "Vom Hafen mitten ins Abenteuer.", overhead: "Die Inselparty beginnt." }
};
const COLORS = ["#e65c65", "#398fe2", "#67b94b", "#a16bd0", "#f4a53e", "#e8ca3b"];

function IntroFallback({ gameId, players }: { gameId: GameId; players: IntroPlayer[] }) {
  return <div className="game-intro__fallback" aria-hidden="true">
    <svg viewBox="0 0 600 600">
      <circle cx="300" cy="300" r="260" fill={gameId === "party" ? "#219fca" : "#183e45"} />
      <circle cx="300" cy="300" r="194" fill={gameId === "party" ? "#ffe5a1" : "#925c3d"} />
      <circle cx="300" cy="300" r="179" fill={gameId === "party" ? "#65ba61" : "#205b50"} stroke="#d8b575" strokeWidth="2" />
      {players.map((player, index) => {
        const angle = index / players.length * Math.PI * 2;
        const x = 300 + Math.sin(angle) * 230, y = 300 + Math.cos(angle) * 230;
        return <g key={player.id}>
          <circle cx={x} cy={y} r="28" fill={COLORS[index % COLORS.length]} />
          <image href={characterPortrait(characterId(player.characterId,index))} x={x-25} y={y-27} width="50" height="54"/>
        </g>;
      })}
      {gameId === "roll-it-up" ? <g fill="#e0a96a"><ellipse cx="300" cy="300" rx="105" ry="90" fill="#798351"/><path d="M250 267h100v12H250zm0 19h100v12H250zm-5 22h110v12H245zm9 12h8v16h-8zm84 0h8v16h-8z"/></g> : gameId === "durak" ? <g transform="translate(270 255) rotate(-12 30 45)">
        <rect width="60" height="90" rx="5" fill="#fff9e8" /><rect x="5" y="5" width="50" height="80" rx="3" fill="#274f69" />
        <path d="M30 29 42 45 30 61 18 45Z" fill="#d8b575" />
      </g> : gameId === "party" ? <text x="300" y="320" textAnchor="middle" fontSize="70" fill="#fff9e8">⚑</text>
        : [0, 1, 2, 3, 4, 5].map(i => <g key={i} transform={`translate(${228 + i % 3 * 52} ${252 + Math.floor(i / 3) * 52})`}>
          <rect width="40" height="40" rx="6" fill={COLORS[i]} /><circle cx="20" cy="20" r="4" fill="#fff9e8" />
        </g>)}
    </svg>
  </div>;
}

function IntroScene({ gameId, players, onComplete }: { gameId: GameId; players: IntroPlayer[]; onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState<IntroStage>("seated");
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cancelled = false, started = false, frame = 0;
    let world: { render: (elapsed: number) => void; dispose: () => void } | undefined;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; skip.current?.focus({ preventScroll: true });

    function start() {
      if (cancelled || started) return;
      started = true;
      const startTime = performance.now();
      const animate = (time: number) => {
        if (cancelled) return;
        try { world?.render(time - startTime); } catch { useFallback(); }
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
      timers.push(setTimeout(() => setStage("approach"), 950));
      timers.push(setTimeout(() => setStage("overhead"), 3050));
      timers.push(setTimeout(() => setLeaving(true), 3600));
      timers.push(setTimeout(onComplete, 4000));
    }
    function useFallback() {
      if (cancelled) return;
      world?.dispose(); world = undefined;
      setFallback(true); setReady(false); start();
    }

    // Slow loading or missing WebGL must never prevent entering the game.
    const loadTimeout = setTimeout(useFallback, 1800);
    void Promise.all([import("../three/introWorld"),preloadFigures(players.map(p=>p.characterId))]).then(([{ createIntroWorld }]) => {
      if (cancelled || started || !host.current) return;
      try {
        world = createIntroWorld(host.current, gameId, players, useFallback);
        world.render(0); setReady(true); clearTimeout(loadTimeout); start();
      } catch { clearTimeout(loadTimeout); useFallback(); }
    }).catch(() => { clearTimeout(loadTimeout); useFallback(); });

    return () => {
      cancelled = true; clearTimeout(loadTimeout); timers.forEach(clearTimeout);
      cancelAnimationFrame(frame); world?.dispose(); document.body.style.overflow = oldOverflow;
    };
  }, [gameId, players, onComplete]);

  return <section className={`game-intro game-intro--${gameId}${ready ? " is-ready" : ""}${leaving ? " is-leaving" : ""}${fallback ? " is-fallback" : ""}`}
    role="dialog" aria-modal="true" aria-labelledby="game-intro-title" aria-describedby="game-intro-caption" data-stage={stage}
    onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); onComplete(); }
      if (event.key === "Tab") { event.preventDefault(); skip.current?.focus(); }
    }}>
    <IntroFallback gameId={gameId} players={players} />
    <div className="game-intro__world" ref={host} aria-hidden="true" />
    <header className="game-intro__header">
      <h1 id="game-intro-title">{getGame(gameId).name}</h1>
      <button ref={skip} className="game-intro__skip" onClick={onComplete}>Intro überspringen <span aria-hidden="true">›</span></button>
    </header>
    <footer className="game-intro__footer">
      <p id="game-intro-caption" role="status">{(CAPTIONS[gameId] ?? CAPTIONS.durak)[stage]}</p>
      <div className="game-intro__track" aria-hidden="true"><i /></div>
    </footer>
  </section>;
}

export const GameIntroActive = createContext(false);

/** Keep the live game subscribed, but shield its controls until the camera arrives. */
export function GameIntro({ gameId, players, enabled, children }: { gameId: GameId; players: IntroPlayer[]; enabled: boolean; children: ReactNode }) {
  const [active, setActive] = useState(() => enabled && typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const gameRoot = useRef<HTMLDivElement>(null);
  const completed = useRef(false);
  // Freeze the cast for this one introduction, independent of online updates.
  const cast = useRef(players);
  const finish = useCallback(() => { completed.current = true; setActive(false); }, []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { if (media.matches) finish(); };
    media.addEventListener("change", change);
    // The preference may have changed between the initial render and effect registration.
    change();
    return () => media.removeEventListener("change", change);
  }, [finish]);
  useEffect(() => {
    if (!active && completed.current) gameRoot.current?.focus({ preventScroll: true });
  }, [active]);

  return <>
    <div className="game-entrance" ref={gameRoot} tabIndex={-1} inert={active} aria-hidden={active || undefined}>
      <GameIntroActive.Provider value={active}>{children}</GameIntroActive.Provider>
    </div>
    {active && <IntroScene gameId={gameId} players={cast.current} onComplete={finish} />}
  </>;
}
