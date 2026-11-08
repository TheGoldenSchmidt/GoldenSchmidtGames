import { useLayoutEffect, useRef, type RefObject } from "react";

/** Measure each permanent die's landing point relative to the shared cup. */
export function useDiceCupLayout(cupRef?: RefObject<HTMLButtonElement | null>) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!root.current || !cupRef?.current) return;
    const measure = () => {
      const cup = cupRef.current?.getBoundingClientRect();
      if (!cup) return;
      root.current?.querySelectorAll<HTMLElement>(".kribbel-die-anchor").forEach(anchor => {
        const target = anchor.getBoundingClientRect(), scene = anchor.querySelector<HTMLElement>(".die-scene");
        if (!scene) return;
        scene.style.setProperty("--pour-x", `${cup.left + cup.width * .95 - target.left - target.width / 2}px`);
        scene.style.setProperty("--pour-y", `${cup.top + cup.height * .4 - target.top - target.height / 2}px`);
        scene.style.setProperty("--stash-x", `${cup.left + cup.width * .5 - target.left - target.width / 2}px`);
        scene.style.setProperty("--stash-y", `${cup.top + cup.height * .3 - target.top - target.height / 2}px`);
      });
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(root.current); observer.observe(cupRef.current);
    return () => observer.disconnect();
  }, [cupRef]);
  return root;
}
