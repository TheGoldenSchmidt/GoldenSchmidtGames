import { useEffect, useId, useState } from "react";
import type { ExperimentProps } from "../../experiments";
import { CENTER, canMove, cells, centerLinks, wallFields, movesFrom, newGame, play, sideLinks, type Cell, type Color, type Kind, type Level } from "./rules";
import { botLevels, botTurn, type BotLevel } from "./bot";
import { HasenspielRules } from "./HasenspielRules";
import { Victory } from "./Victory";
import "./hasenspiel.css";

const side = 54;
const height = side * Math.sqrt(3) / 2;
const gap = 28;
const width = 6 * side;
const boardHeight = 12 * height + gap;
const names = { blue: "Blau", gray: "Grau" };
const levels: Level[] = [1, 2, 3];
const species: Record<Kind, string> = { rabbit: "Hase", deer: "Hirsch", monkey: "Affe" };
const shapes: Record<Kind, string> = {
  rabbit: "M-4 1 Q-8-9-4-8 Q-1-8-1-2 H1 Q1-8 4-8 Q8-9 4 1 Q6 7 0 7 Q-6 7-4 1Z",
  deer: "M0 7 Q-5 6-4 1 L-8-3 M-5 0 L-5-7 M-5-4 L-8-6 M-4 1 Q0-3 4 1 L8-3 M5 0 L5-7 M5-4 L8-6 M4 1 Q5 6 0 7",
  monkey: "M-5 0 A2 2 0 1 0-5 4 M5 0 A2 2 0 1 1 5 4 M-5 1 Q-5-6 0-6 Q5-6 5 1 Q7 7 0 7 Q-7 7-5 1Z"
};

function fieldName(cell: Cell) {
  return cell.id === CENTER ? "Lichtung" : `${cell.row < 6 ? "Blaue" : "Graue"} Seite, Reihe ${6 - Math.abs(cell.row - 6)}, Feld ${cell.x + 7 - Math.abs(cell.row - 6)}`;
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
  const [firstColor, setFirstColor] = useState<Color>();
  const secondColor = firstColor === "blue" ? "gray" : "blue";
  const botThinking = !!botLevel && !!firstColor && !game.result && game.turn === secondColor;
  const firstPlayer = botLevel ? "Du" : "Person 1";
  const secondPlayer = botLevel ? "Bot" : "Person 2";
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
  const wall = wallFields(game.board, game.initialWalls);
  const bushPattern = useId();
  const center = game.board[CENTER];
  const winner = game.result && game.result !== "draw"
    ? botLevel && game.result === secondColor ? "Bot" : names[game.result]
    : undefined;
  const status = game.result === "draw" ? "Unentschieden" : winner
    ? "Partie beendet"
    : botThinking ? "Der Bot ist am Zug" : `${names[game.turn]} ist am Zug`;

  function reset(level: Level) {
    setGame(newGame(level));
    setFirstColor(undefined);
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
    if (!firstColor || game.result || botThinking) return;
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
          {firstColor ? <>
            <span>Münzwurf · {firstPlayer}: {names[firstColor]} · {secondPlayer}: {names[secondColor]}</span>
            <strong>{status}</strong>
            <span>{center ? `${names[center.color]} hält die Lichtung · ${game.held}/3` : "Lichtung drei gegnerische Züge halten"}</span>
          </> : <button type="button" onClick={() => setFirstColor(Math.random() < .5 ? "blue" : "gray")}>
            Münze werfen
          </button>}
        </div>
        <div className="hare-playfield">
          <svg className="hare-board" viewBox={`-2 -2 ${width + 27} ${boardHeight + 4}`} aria-label="Dreiecksbrett">
            <g className="hare-row-numbers" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5].map(depth => {
                const y = (depth + .5) * height;
                const x = width / 2 + (depth + 1) * side / 2 + 13;
                return <g key={depth}>
                  <text x={x} y={y}>{depth + 1}</text>
                  <text x={x} y={boardHeight - y}>{depth + 1}</text>
                </g>;
              })}
            </g>
            <defs>
              <pattern id={bushPattern} width="18" height="13" patternUnits="userSpaceOnUse">
                <rect width="18" height="13" fill="#23533a" />
                <path d="M0 11Q0 6 4 7Q4 2 8 3Q12 3 12 7Q17 6 18 11V13H0Z" fill="#39764b" />
                <path d="M3 10Q5 6 9 7M11 10Q13 7 15 9" fill="none" stroke="#76a867" strokeWidth="1.3" />
              </pattern>
            </defs>
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
              const active = !!firstColor && !game.result && !botThinking && (rabbit?.color === game.turn || !!target);
              const resting = rabbit && game.restingDeer?.includes(rabbit.id);
              const frozen = rabbit && game.frozen.includes(rabbit.id);
              return (
                <g key={cell.id} className="hare-cell" data-target={!!target} data-selected={selected === cell} data-wall={wall.has(cell.id)}
                  role={active ? "button" : undefined} tabIndex={active ? 0 : undefined}
                  aria-label={active ? `${fieldName(cell)}${rabbit ? `, ${species[rabbit.kind]} ${names[rabbit.color]}${resting ? ", ruht" : frozen ? ", betäubt" : ""}` : ""}` : undefined}
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
                    : <polygon points={shape.points} data-side={cell.row < 6 ? "blue" : "gray"}
                      style={wall.has(cell.id) ? { fill: `url(#${bushPattern})` } : undefined} />}
                  {rabbit && <g className={`hare-token hare-token-${rabbit.color}`} transform={`translate(${shape.x} ${shape.y})`}>
                    <circle r="11" />
                    <path data-kind={rabbit.kind} d={shapes[rabbit.kind]} />
                    {(frozen || resting) && <circle className="hare-frozen" r="13" />}
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
        {firstColor && !game.result && !botThinking && !canMove(game) && <button type="button" onClick={() => { setGame(play(game)); setSelected(undefined); setDestination(undefined); }}>Kein Zug möglich · Passen</button>}
        <HasenspielRules level={game.level} />
      </div>
    </main>
  );
}
