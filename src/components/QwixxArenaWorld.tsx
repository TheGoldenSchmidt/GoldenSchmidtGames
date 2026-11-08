import { useEffect, useRef, useState } from "react";
import { preloadFigures } from "../figures/catalog";

export interface QwixxArenaPlayer { id: string; name: string; characterId?: string }
export type QwixxArenaAction = "waiting" | "gathering" | "throwing" | "choosing";

export function QwixxArenaWorld({ players, activeId, action, reducedMotion }: {
  players: QwixxArenaPlayer[]; activeId: string; action: QwixxArenaAction; reducedMotion: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ activeId, action, reducedMotion });
  latest.current = { activeId, action, reducedMotion };
  const [state, setState] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let cancelled = false, frame = 0;
    let world: { render: (elapsed: number) => void; dispose: () => void } | undefined;
    const started = performance.now();
    const fallback = () => {
      if (cancelled) return;
      world?.dispose(); world = undefined; setState("fallback");
    };
    void Promise.all([
      import("../three/qwixxArenaWorld"),
      preloadFigures(players.map(player => player.characterId))
    ]).then(([{ createQwixxArenaWorld }]) => {
      if (cancelled || !host.current) return;
      try {
        world = createQwixxArenaWorld(host.current, players, () => latest.current, fallback);
        world.render(0); setState("ready");
        let lastFrame = 0;
        const animate = (time: number) => {
          if (cancelled) return;
          const activeMotion = latest.current.action === "gathering" || latest.current.action === "throwing";
          if (time - lastFrame >= (activeMotion ? 34 : 90)) {
            try { world?.render(time - started); } catch { fallback(); return; }
            lastFrame = time;
          }
          frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
      } catch { fallback(); }
    }).catch(fallback);
    return () => { cancelled = true; cancelAnimationFrame(frame); world?.dispose(); };
  }, [players]);

  return <div ref={host} className="qwixx-arena-world" data-arena-state={state} data-active-player={activeId} data-action={action} aria-hidden="true">
    <div className="qwixx-arena-world__fallback" />
  </div>;
}
