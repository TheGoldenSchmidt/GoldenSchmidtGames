import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";
import { KRIBBEL_DICE_FACES, type KribbelDie } from "../../shared/kribbeln";

export const KRIBBEL_COLOR_NAMES = { red: "Rot", yellow: "Gelb", green: "Grün", blue: "Blau", orange: "Orange", purple: "Violett" };
const PIPS: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export const KRIBBEL_ROLL_DURATION = 1250;

export function KribbelnDice({ dice, kept, disabled, rolling = false, inCup = false, cupRef, rollKey, onToggle }: {
  dice: KribbelDie[]; kept: number[]; disabled: boolean; rolling?: boolean; inCup?: boolean; cupRef?: RefObject<HTMLButtonElement | null>; rollKey: string; onToggle: (index: number) => void;
}) {
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
  return <div ref={root} className="kribbel-dice" aria-label="Sechs Farbwürfel">
    {Array.from({ length: 6 }, (_, index) => {
      const die = dice[index];
      const held = kept.includes(index);
      const falling = rolling && !held;
      const stored = !falling && !held && (inCup || !die);
      const faceUp = die?.value ?? 1;
      return <button key={index} data-die-index={index} className={`kribbel-die-slot ${held ? "is-kept" : ""} ${stored ? "is-in-cup" : ""} ${falling ? "is-rolling" : ""}`}
        disabled={disabled || rolling || stored || !die} onClick={() => onToggle(index)} aria-pressed={held}
        aria-label={stored ? `Würfel ${index + 1} im Becher` : falling ? `Würfel ${index + 1} fliegt` : die ? `Würfel ${index + 1}: ${KRIBBEL_COLOR_NAMES[die.color]} ${die.value}, ${held ? "behalten, antippen zum Freigeben" : "antippen zum Behalten"}` : `Würfel ${index + 1} wartet`}>
        <span className="kribbel-die-anchor">
        <span className="die-scene kribbel-cube-scene" style={{ "--roll-delay": `${110 + index * 30}ms`, "--flight-name": Number(rollKey.split("-").at(-1)) % 2 ? "kribbel-eject" : "kribbel-eject-again" } as CSSProperties}>
          <span className="kribbel-cube-view">
          <span className={`die-cube die-cube--show-${faceUp}`}>
            {KRIBBEL_DICE_FACES[index].map(face => <span className={`die-face die-face--${face.value} kribbel-face-color--${face.color}`} key={face.value} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[face.value].includes(i + 1) ? "is-on" : ""} />)}
            </span>)}
          </span>
          </span>
        </span>
        </span>
        <span className="kribbel-die-caption">{stored ? "Im Becher" : falling ? "Fliegt …" : die ? held ? "✓ Bleibt" : KRIBBEL_COLOR_NAMES[die.color] : "Bereit"}</span>
      </button>;
    })}
  </div>;
}
