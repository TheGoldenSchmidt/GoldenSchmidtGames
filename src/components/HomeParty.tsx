import { useEffect, useRef, useState } from "react";
import { characterPortrait } from "../../shared/characters";

// The same approved cast appears in the scene and its static WebGL fallback.
export const HOME_CAST = ["alpha_rick_prime", "alpha_morty_smith", "alpha_eric_cartman", "alpha_korvo"] as const;

export function HomeParty() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let scene: { dispose: () => void } | undefined;
    void import("../three/homeParty").then(async ({ createHomeParty, loadHomeCast }) => {
      await loadHomeCast(HOME_CAST);
      if (cancelled || !host.current) return;
      try {
        scene = createHomeParty(host.current, HOME_CAST, () => {
          if (!cancelled) setReady(false);
          scene?.dispose();
        });
        setReady(true);
      } catch {
        scene?.dispose();
        setReady(false);
      }
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; scene?.dispose(); };
  }, []);

  return (
    <div className="home-party" aria-hidden="true" data-ready={ready}>
      <span className="home-party__bubble">Du fehlst noch!</span>
      <div className="home-party__fallback">
        {HOME_CAST.map(id => <img key={id} src={characterPortrait(id)} alt="" width="120" height="130" />)}
      </div>
      <div className="home-party__canvas" ref={host} />
      <span className="home-party__caption">Kleine Runde. Großes Chaos.</span>
    </div>
  );
}
