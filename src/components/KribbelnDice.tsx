import type { CSSProperties } from "react";
import { KRIBBEL_DICE_FACES, type KribbelDie } from "../../shared/kribbeln";

export const KRIBBEL_COLOR_NAMES = { red: "Rot", yellow: "Gelb", green: "Grün", blue: "Blau", orange: "Orange", purple: "Violett" };
const PIPS: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export const KRIBBEL_ROLL_DURATION = 1250;

export function KribbelnDice({ dice, kept, disabled, rolling = false, rollKey, onToggle }: {
  dice: KribbelDie[]; kept: number[]; disabled: boolean; rolling?: boolean; rollKey: string; onToggle: (index: number) => void;
}) {
  return <div className="kribbel-dice" aria-label="Sechs Farbwürfel">
    {Array.from({ length: 6 }, (_, index) => {
      const die = dice[index];
      const held = kept.includes(index);
      const falling = rolling && !held;
      return <button key={index} className={`kribbel-die-slot ${held ? "is-kept" : ""} ${!die ? "is-empty" : ""} ${falling ? "is-rolling" : ""}`}
        disabled={disabled || rolling || !die} onClick={() => onToggle(index)} aria-pressed={held}
        aria-label={falling ? `Würfel ${index + 1} fällt` : die ? `Würfel ${index + 1}: ${KRIBBEL_COLOR_NAMES[die.color]} ${die.value}, ${held ? "behalten, antippen zum Freigeben" : "antippen zum Behalten"}` : `Würfel ${index + 1} wartet`}>
        {die ? <span key={held ? `held-${index}` : rollKey} className="die-scene kribbel-cube-scene" style={{ "--roll-delay": `${index * 45}ms` } as CSSProperties}>
          <span className="kribbel-cube-view">
          <span className={`die-cube die-cube--show-${die.value}`}>
            {KRIBBEL_DICE_FACES[index].map(face => <span className={`die-face die-face--${face.value} ${falling ? "kribbel-face--hidden" : `kribbel-face-color--${face.color}`}`} key={face.value} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[face.value].includes(i + 1) ? "is-on" : ""} />)}
            </span>)}
          </span>
          </span>
        </span> : <span className="kribbel-die-placeholder" aria-hidden="true">⚄</span>}
        <span className="kribbel-die-caption">{falling ? "Fällt …" : die ? held ? "✓ Bleibt" : KRIBBEL_COLOR_NAMES[die.color] : "Bereit"}</span>
      </button>;
    })}
  </div>;
}
