import { useEffect, useState } from "react";
import tablePhoto from "./forest-table.webp";

export function ForestIntro({ onDone }: { onDone: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) { onDone(); return; }
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    reduced.addEventListener("change", onDone);
    return () => {
      reduced.removeEventListener("change", onDone);
      document.documentElement.style.overflow = overflow;
    };
  }, [onDone]);
  return <>
    <div className="hare-intro-scene" data-ready={ready} aria-hidden="true"
      onAnimationEnd={event => { if (event.animationName === "hare-reveal-board") onDone(); }}>
      <img className="hare-intro-woods" src={tablePhoto} alt="" onLoad={() => setReady(true)} onError={onDone} />
      <div className="hare-intro-sun" />
    </div>
    <button className="hare-intro-skip" type="button" onClick={onDone}>Überspringen</button>
  </>;
}
