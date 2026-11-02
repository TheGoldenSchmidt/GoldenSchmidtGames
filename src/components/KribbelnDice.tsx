import type { CSSProperties } from "react";
import type { KribbelDie } from "../../shared/kribbeln";

export const KRIBBEL_COLOR_NAMES = { red: "Rot", yellow: "Gelb", green: "Grün", blue: "Blau", orange: "Orange", purple: "Violett" };
const PIPS: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export function KribbelnDice({ dice, kept, disabled, rollKey, onToggle }: {
  dice: KribbelDie[]; kept: number[]; disabled: boolean; rollKey: string; onToggle: (index: number) => void;
}) {
  return <div className="kribbel-dice" aria-label="Sechs Farbwürfel">
    {Array.from({ length: 6 }, (_, index) => {
      const die = dice[index];
      const held = kept.includes(index);
      return <button key={index} className={`kribbel-die-slot ${held ? "is-kept" : ""} ${!die ? "is-empty" : ""}`}
        disabled={disabled || !die} onClick={() => onToggle(index)} aria-pressed={held}
        aria-label={die ? `Würfel ${index + 1}: ${KRIBBEL_COLOR_NAMES[die.color]} ${die.value}, ${held ? "behalten, antippen zum Freigeben" : "antippen zum Behalten"}` : `Würfel ${index + 1} wartet`}>
        {die ? <span key={rollKey} className={`die-scene kribbel-cube-scene kribbel-face-color--${die.color}`} style={{ "--roll-delay": `${index * 45}ms` } as CSSProperties}>
          <span className={`die-cube die-cube--show-${die.value}`}>
            {[1, 2, 3, 4, 5, 6].map(face => <span className={`die-face die-face--${face}`} key={face} aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[face].includes(i + 1) ? "is-on" : ""} />)}
            </span>)}
          </span>
        </span> : <span className="kribbel-die-placeholder" aria-hidden="true">⚄</span>}
        <span className="kribbel-die-caption">{die ? held ? "✓ Bleibt" : KRIBBEL_COLOR_NAMES[die.color] : "Bereit"}</span>
      </button>;
    })}
  </div>;
}
