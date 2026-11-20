import { useEffect, useState } from "react";
import type { ExperimentProps } from "../../experiments";
import { CENTER, canMove, cells, centerLinks, deerLine, movesFrom, newGame, play, sideLinks, type Cell, type Color, type Kind, type Level } from "./rules";
import { botLevels, botTurn, type BotLevel } from "./bot";
import { Victory } from "./Victory";
import "./hasenspiel.css";

const side = 54;
const height = side * Math.sqrt(3) / 2;
const gap = 28;
const width = 6 * side;
const boardHeight = 12 * height + gap;
const names = { blue: "Blau", gray: "Grau" };
const colors: Color[] = ["blue", "gray"];
const levels: Level[] = [1, 2, 3];
const species: Record<Kind, string> = { rabbit: "Hase", deer: "Hirsch", monkey: "Affe" };
const shapes: Record<Kind, string> = {
  rabbit: "M-4 1 Q-8-9-4-8 Q-1-8-1-2 H1 Q1-8 4-8 Q8-9 4 1 Q6 7 0 7 Q-6 7-4 1Z",
  deer: "M0 7 Q-5 6-4 1 L-8-3 M-5 0 L-5-7 M-5-4 L-8-6 M-4 1 Q0-3 4 1 L8-3 M5 0 L5-7 M5-4 L8-6 M4 1 Q5 6 0 7",
  monkey: "M-5 0 A2 2 0 1 0-5 4 M5 0 A2 2 0 1 1 5 4 M-5 1 Q-5-6 0-6 Q5-6 5 1 Q7 7 0 7 Q-7 7-5 1Z"
};

function fieldName(cell: Cell) {
  return cell.id === CENTER ? "Zentrum" : `${cell.row < 6 ? "Blaue" : "Graue"} Seite, Reihe ${7 - Math.abs(cell.row - 6)}, Feld ${cell.x + 7 - Math.abs(cell.row - 6)}`;
}

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
  const [game, setGame] = useState(() => newGame());
  const [botLevel, setBotLevel] = useState<BotLevel>();
  const botThinking = !!botLevel && !game.result && game.turn === "gray";
  useEffect(() => {
    if (!botLevel || !botThinking) return;
    const timer = window.setTimeout(() => {
      const next = botTurn(game, botLevel);
      setGame(current => current === game ? next : current);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [botLevel, botThinking, game]);

  const [selected, setSelected] = useState<Cell>();
  const [destination, setDestination] = useState<Cell>();
  const targets = selected ? movesFrom(game, selected) : [];
  const choices = destination ? targets.filter(move => move.to === destination.id) : [];
  const protectedFields = new Set(colors.flatMap(color =>
    deerLine(game.board, color).between.map(cell => cell.id)));
  const center = game.board[CENTER];
  const winner = game.result && game.result !== "draw"
    ? botLevel && game.result === "gray" ? "Bot" : names[game.result]
    : undefined;
  const status = game.result === "draw" ? "Unentschieden" : winner
    ? "Partie beendet"
    : botThinking ? "Der Bot ist am Zug" : `${names[game.turn]} ist am Zug`;

  function reset(level: Level) {
    setGame(newGame(level));
    setSelected(undefined);
    setDestination(undefined);
  }

  function takeMove(cell: Cell, choice = 0) {
    if (!selected) return;
    setGame(play(game, selected.id, cell.id, choice));
    setSelected(undefined);
    setDestination(undefined);
  }

  function select(cell: Cell) {
    if (game.result || botThinking) return;
    setDestination(undefined);
    const count = targets.filter(move => move.to === cell.id).length;
    if (count > 1) setDestination(cell);
    else if (count === 1) takeMove(cell);
    else setSelected(cell !== selected && game.board[cell.id]?.color === game.turn ? cell : undefined);
  }

  return (
    <main className="ru-hasenspiel">
      <div className="hare-page">
        <header className="hare-header">
          <button type="button" onClick={onExit}>Zurück</button>
          <h1>Hasenspiel</h1>
          <button type="button" onClick={() => reset(game.level)}>Neu</button>
        </header>
        <label className="hare-mode">
          Gegner
          <select value={botLevel ?? ""} onChange={event => {
            setBotLevel(botLevels.find(level => level === event.target.value));
            reset(game.level);
          }}>
            <option value="">Zweite Person</option>
            {botLevels.map(level => <option key={level} value={level}>Bot · {level}</option>)}
          </select>
        </label>
        <div className="hare-levels" role="group" aria-label="Schwierigkeitsstufe">
          {levels.map(level => <button key={level} type="button" aria-pressed={game.level === level}
            onClick={() => { if (level !== game.level) reset(level); }}>Stufe {level}</button>)}
        </div>
        <div className="hare-status" aria-live="polite">
          <strong>{status}</strong>
          <span>{center ? `${names[center.color]} hält das Zentrum · ${game.held}/3` : "Zentrum drei gegnerische Züge halten"}</span>
        </div>
        <div className="hare-playfield">
          <svg className="hare-board" viewBox={`-2 -2 ${width + 4} ${boardHeight + 4}`} aria-label="Dreiecksbrett">
            <g className="hare-side-links" aria-hidden="true">
              {sideLinks.map(link => {
                const x = width / 2 + link.x * side / 2;
                return <line key={link.id} x1={x} x2={x} y1={6 * height} y2={6 * height + gap} />;
              })}
            </g>
            {cells.map(cell => {
              const isCenter = cell.id === CENTER;
              const shape = isCenter ? { x: width / 2, y: boardHeight / 2, points: "" } : triangle(cell);
              const rabbit = game.board[cell.id];
              const target = targets.find(move => move.to === cell.id);
              const active = !game.result && !botThinking && (rabbit?.color === game.turn || !!target);
              const frozen = rabbit && game.frozen.includes(rabbit.id);
              return (
                <g key={cell.id} className="hare-cell" data-target={!!target} data-selected={selected === cell} data-protected={protectedFields.has(cell.id)}
                  role={active ? "button" : undefined} tabIndex={active ? 0 : undefined}
                  aria-label={active ? `${fieldName(cell)}${rabbit ? `, ${species[rabbit.kind]} ${names[rabbit.color]}${frozen ? ", blockiert" : ""}` : ""}` : undefined}
                  onClick={() => select(cell)}
                  onKeyDown={event => {
                    if (active && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      select(cell);
                    }
                  }}>
                  {isCenter
                    ? <g className="hare-center">
                      <rect x={width / 2 - side * 1.25} y={6 * height} width={side * 2.5} height={gap} rx="4" />
                      {centerLinks.map(link => {
                        const x = width / 2 + link.x * side / 2;
                        return <line key={link.id} x1={x} x2={x} y1={6 * height} y2={6 * height + gap} />;
                      })}
                    </g>
                    : <polygon points={shape.points} data-side={cell.row < 6 ? "blue" : "gray"} />}
                  {rabbit && <g className={`hare-token hare-token-${rabbit.color}`} transform={`translate(${shape.x} ${shape.y})`}>
                    <circle r="11" />
                    <path data-kind={rabbit.kind} d={shapes[rabbit.kind]} />
                    {frozen && <circle className="hare-frozen" r="13" />}
                    {rabbit.color === "gray" && <path d="M-4 9H4" />}
                  </g>}
                  {target && <circle className="hare-target" cx={shape.x + (rabbit ? 9 : 0)} cy={shape.y} r={rabbit ? 3 : 4} />}
                </g>
              );
            })}
          </svg>
          {winner && <Victory title={`${winner} gewinnt`} />}
        </div>
        {destination && <section className="hare-choices" aria-label="Sprung auswählen">
          <strong>Mehrere Züge führen auf dieses Feld</strong>
          {choices.map((move, index) => {
            const capture = cells.find(cell => cell.id === move.capture);
            const ally = cells.find(cell => cell.id === move.friendly);
            return <button type="button" key={index} onClick={() => takeMove(destination, index)}>
              {ally ? `Über eigene Figur auf ${fieldName(ally)}` : null}
              {capture ? `${ally ? " · " : ""}Schlage auf ${fieldName(capture)}` : ally ? null : "Ohne Schlagen ziehen"}
            </button>;
          })}
        </section>}
        {!game.result && !botThinking && !canMove(game) && <button type="button" onClick={() => { setGame(play(game)); setSelected(undefined); setDestination(undefined); }}>Kein Zug möglich · Passen</button>}
        <details>
          <summary>Regeln für Stufe {game.level}</summary>
          <p>Wähle einen eigenen Hasen und tippe auf ein markiertes Zielfeld. Ziehe entlang einer Kante eine Reihe vorwärts oder springe über einen benachbarten Hasen auf ein freies Feld. Sprünge können seitlich und vorwärts führen.</p>
          <p>Gegnerische Hasen werden geschlagen. Eigene bleiben stehen. Im nächsten eigenen Zug darf derselbe Hase denselben eigenen Hasen nicht erneut überspringen.</p>
          <p>Links und rechts vom Zentrum verbinden gestrichelte Linien je drei gegenüberliegende Feldpaare. Über diese Verbindungen kannst du direkt auf die andere Spielfeldhälfte ziehen oder springen.</p>
          <p>Das Zentrum ist aus beiden Richtungen über die jeweils fünf mittleren Felder erreichbar. Ein Sprung darüber landet gerade gegenüber. Dieselbe Figur gewinnt, wenn sie drei gegnerische Züge im Zentrum bleibt.</p>
          <p>Wer keinen legalen Zug hat, passt. Passen zählt beim Halten des Zentrums mit. Passen beide nacheinander bei leerem Zentrum, endet die Partie unentschieden.</p>
          {game.level >= 2 && <p>Hasen dürfen seitlich ein Feld zur Reihenmitte ziehen. Stehen drei gleichfarbige Hasen direkt nebeneinander, kann der mittlere nicht von einem Gegner übersprungen werden.</p>}
          {game.level === 3 && <>
            <p>Hasen und Affen dürfen zweimal springen, wenn sie erst eine eigene und dann eine gegnerische Figur überspringen.</p>
            <p>Hirsche ziehen ein Feld vor oder zur Seite. Sie können auch nach links, rechts oder diagonal vorwärts bis zum letzten freien Feld vor einem Hindernis oder dem Brettrand voranpreschen, auch über die Spielfeldmitte hinweg. Stehen vier bis sechs Felder zwischen den Hirschen, ist der Bereich für gegnerische Hasen gesperrt. Hasen darin setzen einmal aus, sobald die Sperre entsteht. Danach dürfen sie hinausziehen. Die beiden Hirsche können von Affen übersprungen werden.</p>
            <p>Affen ziehen und springen auch rückwärts. Beim Hangeln dürfen sie über mindestens zwei Hasen vorwärts oder seitlich klettern, mit höchstens einem leeren Feld dazwischen. Sie landen auf einem freien Feld und schlagen beim Hangeln keine Figur.</p>
          </>}
        </details>
      </div>
    </main>
  );
}
