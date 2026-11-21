import { useLayoutEffect, useRef, type RefObject } from "react";

function ease(start: number, end: number, time: number) {
  const n = Math.min(1, Math.max(0, (time - start) / (end - start)));
  return n * n * (3 - 2 * n);
}

export function ForestIntro({ field, onDone }: {
  field: RefObject<HTMLDivElement | null>;
  onDone: () => void;
}) {
  const scenery = useRef<HTMLDivElement>(null);
  const woods = useRef<HTMLDivElement>(null);
  const moss = useRef<HTMLDivElement>(null);
  const night = useRef<HTMLDivElement>(null);
  const legs = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const board = field.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!board || motion.matches) { onDone(); return; }
    const savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.scrollTo(0, 0);
    const box = board.getBoundingClientRect();
    const w = window.innerWidth, h = window.innerHeight;
    const start = performance.now();
    let frame = 0;
    // Keep the live board in the shot as the camera settles onto its actual layout.
    function draw(now: number) {
      const t = (now - start) / 1000;
      const walk = ease(.1, 3.9, t), rise = ease(2.7, 6.7, t);
      const dx = (w / 2 - box.left - box.width / 2) * (1 - rise);
      const dy = (h * (.595 + .059 * walk) - box.top - box.height / 2) * (1 - rise);
      const scale = (Math.min(w * .13, 85) + walk * Math.min(w * .25, 180)) / box.width * (1 - rise) + rise;
      board!.style.transform = `translate(${dx}px, ${dy}px) perspective(1400px) rotateX(${73 * (1 - rise)}deg) scale(${scale})`;
      const rect = board!.getBoundingClientRect();
      const support = legs.current!.style;
      support.left = `${rect.left + rect.width * .07}px`;
      support.top = `${rect.bottom - 2}px`;
      support.width = `${rect.width * .86}px`;
      support.height = `${rect.width * .27}px`;
      support.opacity = String(1 - ease(2.7, 4.9, t));
      woods.current!.style.transform = `scale(${1.02 + .35 * walk + .18 * rise}) translateY(${-8 * rise}%)`;
      moss.current!.style.opacity = String(rise);
      moss.current!.style.transform = `scale(${1.25 - .25 * rise})`;
      scenery.current!.style.opacity = String(1 - ease(4.8, 6.8, t));
      night.current!.style.opacity = String(1 - ease(.22, 1.38, t));
      if (t < 6.9) frame = requestAnimationFrame(draw);
      else onDone();
    }
    draw(start);
    window.addEventListener("resize", onDone);
    motion.addEventListener("change", onDone);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onDone);
      motion.removeEventListener("change", onDone);
      document.documentElement.style.overflow = savedOverflow;
      board.style.transform = "";
    };
  }, [field, onDone]);

  return <>
    <div className="hare-intro-scene" ref={scenery} aria-hidden="true">
      <div className="hare-intro-woods" ref={woods} />
      <div className="hare-intro-moss" ref={moss} />
      <div className="hare-intro-shade" />
    </div>
    <div className="hare-intro-legs" ref={legs} aria-hidden="true" />
    <div className="hare-intro-night" ref={night} aria-hidden="true" />
    <button className="hare-intro-skip" type="button" onClick={onDone}>Überspringen</button>
  </>;
}
