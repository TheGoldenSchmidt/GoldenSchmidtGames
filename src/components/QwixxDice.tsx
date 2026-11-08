import type { CSSProperties, RefObject } from "react";
import { QWIXX_COLORS, QWIXX_COLOR_NAMES } from "../../shared/qwixx";
import type { QwixxColor, QwixxDice as DiceResult } from "../../shared/types";
import { useDiceCupLayout } from "./useDiceCupLayout";

const PIPS: Record<number, number[]> = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const COLORS = ["white", "white", ...QWIXX_COLORS] as const;
const LANDINGS = [
  [18, 25], [49, 17], [78, 28], [28, 66], [58, 58], [82, 72]
] as const;

function hash(value: string) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

export function QwixxDice({ dice, closedRows, rolling, inCup, cupRef, rollKey, selectableIds = [], selectedIds = [], onSelect }: {
  dice?: DiceResult; closedRows: QwixxColor[]; rolling: boolean; inCup: boolean; cupRef: RefObject<HTMLButtonElement | null>; rollKey: string;
  selectableIds?: string[]; selectedIds?: string[]; onSelect?: (id: string) => void;
}) {
  const root = useDiceCupLayout(cupRef);
  return <div ref={root} className="qwixx-dice kribbel-dice" aria-label="Zwei weiße und vier farbige Würfel">
    {COLORS.map((color, index) => {
      const id = color === "white" ? `white-${index + 1}` : color;
      const name = color === "white" ? `Weißer Würfel ${index + 1}` : `${QWIXX_COLOR_NAMES[color]}er Würfel`;
      const colorName = color === "white" ? "Weiß" : QWIXX_COLOR_NAMES[color];
      const value = color === "white" ? dice?.white[index as 0 | 1] : dice?.colors[color];
      const removed = color !== "white" && (closedRows.includes(color) || value === null);
      const flying = rolling && !removed, stored = !flying && !removed && (inCup || !dice);
      const selectable = selectableIds.includes(id) && !removed && !stored && !flying, selected = selectedIds.includes(id);
      const seed = hash(`${rollKey}-${id}`), slot = LANDINGS[(index * 5 + hash(rollKey)) % LANDINGS.length];
      const style = { "--arena-left": `${slot[0] + (seed % 7) - 3}%`, "--arena-top": `${slot[1] + (Math.floor(seed / 7) % 7) - 3}%`, "--landing-rotate": `${(seed % 37) - 18}deg`, "--collision-x": `${index % 2 ? -28 : 28}px` } as CSSProperties;
      const label = removed ? `${name} entfernt` : stored ? `${name} im Becher` : flying ? `${name} fliegt` : `${name}: ${value}${selectable ? ", auswählen" : ""}`;
      return <button type="button" key={id} className={`qwixx-die kribbel-die-slot${flying ? " is-rolling" : ""}${stored ? " is-in-cup" : ""}${removed ? " is-retired" : ""}${selected ? " is-chosen" : ""}`}
        data-die-id={id} data-die-color={color} aria-label={label} aria-pressed={selectable ? selected : undefined} disabled={!selectable} onClick={() => selectable && onSelect?.(id)} style={style}>
        <span className="kribbel-die-anchor">
          <span className="die-scene kribbel-cube-scene" style={{ "--roll-delay": `${110 + index * 30}ms`, "--flight-name": Number(rollKey.split("-").at(-1)) % 2 ? "kribbel-eject" : "kribbel-eject-again" } as CSSProperties}>
            <span className="kribbel-cube-view">
              <span className={`die-cube die-cube--show-${value ?? 1}`}>
                {[1, 2, 3, 4, 5, 6].map(face => <span key={face} className={`die-face die-face--${face} kribbel-face-color--${color}`} aria-hidden="true">
                  {Array.from({ length: 9 }, (_, pip) => <i key={pip} className={PIPS[face].includes(pip + 1) ? "is-on" : ""} />)}
                </span>)}
              </span>
            </span>
          </span>
          {removed && <span className="qwixx-die__removed" aria-hidden="true">×</span>}
        </span>
        <span className="kribbel-die-caption">{removed ? `${colorName} entfällt` : stored ? "Im Becher" : colorName}</span>
      </button>;
    })}
  </div>;
}
