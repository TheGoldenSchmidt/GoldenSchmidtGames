import { useState } from "react";
import type { ExperimentProps } from "../../experiments";
import { CENTER, canMove, cells, movesFrom, newGame, play, type Cell } from "./rules";
import "./hasenspiel.css";

const side = 54;
const height = side * Math.sqrt(3) / 2;
const gap = 28;
const width = 6 * side;
const boardHeight = 12 * height + gap;
const names = { blue: "Blau", gray: "Grau" };

function triangle(cell: Cell) {
  const lower = cell.row > 6;
  const depth = 6 - Math.abs(cell.row - 6);
  const x = width / 2 + cell.x * side / 2;
  const y = lower ? boardHeight - depth * height : depth * height;
  const facingCenter = (cell.x + depth) % 2 === 0;
  const base = facingCenter ? y + (lower ? -height : height) : y;
  const tip = facingCenter ? y : y + (lower ? -height : height);
  return { x, y: (2 * base + tip) / 3, points: `${x},${tip} ${x - side / 2},${base} ${x + side / 2},${base}` };
}

export default function Hasenspiel({ onExit }: ExperimentProps) {
  const [game, setGame] = useState(newGame);
  const [selected, setSelected] = useState<Cell>();
  const targets = selected ? movesFrom(game, selected) : [];
  const center = game.board[CENTER];
  const status = game.result === "draw" ? "Unentschieden" : game.result
    ? `${names[game.result]} gewinnt` : `${names[game.turn]} ist am Zug`;

  function select(cell: Cell) {
    if (game.result) return;
    if (selected && targets.some(move => move.to === cell.id)) {
      setGame(play(game, selected.id, cell.id));
      setSelected(undefined);
    } else {
      setSelected(cell !== selected && game.board[cell.id]?.color === game.turn ? cell : undefined);
    }
  }

  return (
    <main className="ru-hasenspiel">
      <div className="hare-page">
        <header className="hare-header">
          <button type="button" onClick={onExit}>Zurück</button>
          <h1>Hasenspiel</h1>
          <button type="button" onClick={() => { setGame(newGame()); setSelected(undefined); }}>Neu</button>
        </header>
        <div className="hare-status" aria-live="polite">
          <strong>{status}</strong>
          <span>{center ? `${names[center.color]} hält das Zentrum · ${game.held}/3` : "Zentrum drei gegnerische Züge halten"}</span>
        </div>
        <svg className="hare-board" viewBox={`-2 -2 ${width + 4} ${boardHeight + 4}`} aria-label="Dreiecksbrett">
          {cells.map(cell => {
            const isCenter = cell.id === CENTER;
            const shape = isCenter ? { x: width / 2, y: boardHeight / 2, points: "" } : triangle(cell);
            const rabbit = game.board[cell.id];
            const target = targets.find(move => move.to === cell.id);
            const active = !game.result && (rabbit?.color === game.turn || !!target);
            const name = isCenter ? "Zentrum" : `${cell.row < 6 ? "Blaue" : "Graue"} Seite, Reihe ${7 - Math.abs(cell.row - 6)}, Feld ${cell.x + 7 - Math.abs(cell.row - 6)}`;
            return (
              <g key={cell.id} className="hare-cell" data-target={!!target} data-selected={selected === cell}
                role={active ? "button" : undefined} tabIndex={active ? 0 : undefined}
                aria-label={active ? `${name}${rabbit ? `, Hase ${names[rabbit.color]}` : ""}` : undefined}
                onClick={() => select(cell)}
                onKeyDown={event => {
                  if (active && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    select(cell);
                  }
                }}>
                {isCenter
                  ? <rect x={width / 2 - side * 1.25} y={6 * height} width={side * 2.5} height={gap} rx="4" />
                  : <polygon points={shape.points} data-side={cell.row < 6 ? "blue" : "gray"} />}
                {rabbit && <g className={`hare-token hare-token-${rabbit.color}`} transform={`translate(${shape.x} ${shape.y})`}>
                  <circle r="11" />
                  <path d="M-4 1 Q-8-9-4-8 Q-1-8-1-2 H1 Q1-8 4-8 Q8-9 4 1 Q6 7 0 7 Q-6 7-4 1Z" />
                  {rabbit.color === "gray" && <path d="M-4 9H4" />}
                </g>}
                {target && <circle className="hare-target" cx={shape.x + (rabbit ? 9 : 0)} cy={shape.y} r={rabbit ? 3 : 4} />}
              </g>
            );
          })}
        </svg>
        {!game.result && !canMove(game) && <button type="button" onClick={() => { setGame(play(game)); setSelected(undefined); }}>Kein Zug möglich · Passen</button>}
        <details>
          <summary>Regeln für Stufe 1</summary>
          <p>Wähle einen eigenen Hasen und tippe auf ein markiertes Zielfeld. Ziehe entlang einer Kante eine Reihe vorwärts oder springe über einen benachbarten Hasen auf ein freies Feld. Sprünge können seitlich und vorwärts führen.</p>
          <p>Gegnerische Hasen werden geschlagen. Eigene bleiben stehen. Im nächsten eigenen Zug darf derselbe Hase denselben eigenen Hasen nicht erneut überspringen.</p>
          <p>Das Zentrum ist aus beiden Richtungen über die jeweils fünf mittleren Felder erreichbar. Ein Sprung darüber landet gerade gegenüber. Dieselbe Figur gewinnt, wenn sie drei gegnerische Züge im Zentrum bleibt.</p>
          <p>Wer keinen legalen Zug hat, passt. Passen zählt beim Halten des Zentrums mit. Passen beide nacheinander bei leerem Zentrum, endet die Partie unentschieden.</p>
        </details>
      </div>
    </main>
  );
}
