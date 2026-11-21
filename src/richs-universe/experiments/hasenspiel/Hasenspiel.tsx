import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ExperimentProps } from "../../experiments";
import { CENTER, canMove, cells, centerLinks, wallFields, movesFrom, newGame, play, sideLinks, type Cell, type Color, type Kind, type Level, type Game, type Move } from "./rules";
import { botLevels, botTurn, type BotLevel } from "./bot";
import { MovementIntro } from "./MovementIntro";
import { HasenspielRules } from "./HasenspielRules";
import { boardHeight, gap, height, side, triangle, width } from "./boardDrawing";
import { PieceEmblem } from "./PieceEmblem";
import { ForestIntro } from "./ForestIntro";
import { Victory } from "./Victory";
import "./hasenspiel.css";

const names = { blue: "Blau", gray: "Grau" };
const boardMaterials = {
  "blue-field": ["#c7d9d8", "#8faeb4"],
  "gray-field": ["#e8ddc5", "#b9ac96"],
  "clearing": ["#e3c887", "#ae854b"],
  "blue-piece": ["#2b72b9", "#17477d"],
  "gray-piece": ["#d1d4d8", "#929ba5"],
  "bush": ["#84aa63", "#235238"],
} as const;

const levels: Level[] = [1, 2, 3];
const species: Record<Kind, string> = { rabbit: "Hase", deer: "Hirsch", monkey: "Affe" };
function fieldName(cell: Cell) {
  return cell.id === CENTER ? "Lichtung" : `${cell.row < 6 ? "Blaue" : "Graue"} Seite, Reihe ${6 - Math.abs(cell.row - 6)}, Feld ${cell.x + 7 - Math.abs(cell.row - 6)}`;
}

const boardPoint = (cell: Cell) => cell.id === CENTER
  ? { x: width / 2, y: boardHeight / 2, points: "" } : triangle(cell);

type Motion = { from: Cell; move: Move; next: Game };

function motionStyle(from: Cell, move: Move): CSSProperties {
  const start = boardPoint(from);
  const end = boardPoint(cells.find(cell => cell.id === move.to)!);
  const via = move.via && cells.find(cell => cell.id === move.via);
  const mid = via ? boardPoint(via) : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return {
    "--move-x": `${end.x - start.x}px`, "--move-y": `${end.y - start.y}px`,
    "--via-x": `${mid.x - start.x}px`, "--via-y": `${mid.y - start.y}px`,
    "--jump-height": move.friendly || move.capture ? "13px" : "0px",
  } as CSSProperties;
}

export default function Hasenspiel({ onExit }: ExperimentProps) {
  const [intro, setIntro] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const field = useRef<HTMLDivElement>(null);
  const closeIntro = useCallback(() => setIntro(false), []);
  const [levelChosen, setLevelChosen] = useState(false);
  const [motion, setMotion] = useState<Motion>();
  const [game, setGame] = useState(() => newGame());
  const [botLevel, setBotLevel] = useState<BotLevel>();
  const [firstColor, setFirstColor] = useState<Color>();
  const secondColor = firstColor === "blue" ? "gray" : "blue";
  const botThinking = !!botLevel && !!firstColor && !game.result && game.turn === secondColor;
  const firstPlayer = botLevel ? "Du" : "Person 1";
  const secondPlayer = botLevel ? "Bot" : "Person 2";
  useEffect(() => {
    if (!motion) return;
    const timer = window.setTimeout(() => {
      setGame(motion.next);
      setMotion(undefined);
    }, motion.move.via ? 620 : 400);
    return () => window.clearTimeout(timer);
  }, [motion]);

  useEffect(() => {
    if (!botLevel || !botThinking || motion) return;
    const timer = window.setTimeout(() => {
      const next = botTurn(game, botLevel);
      const from = cells.find(cell => game.board[cell.id]?.color === game.turn && !next.board[cell.id]);
      const to = from && cells.find(cell => next.board[cell.id] === game.board[from.id]);
      const move = from && to && movesFrom(game, from).find(candidate =>
        candidate.to === to.id && (!candidate.capture || !next.board[candidate.capture])
        && candidate.friendly === Object.keys(game.board).find(id => game.board[id]?.id === next.previous[game.turn]?.crossed));
      if (from && move && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setMotion({ from, move, next });
      } else {
        setGame(next);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [botLevel, botThinking, game, motion]);

  const [selected, setSelected] = useState<Cell>();
  const [destination, setDestination] = useState<Cell>();
  const targets = selected ? movesFrom(game, selected) : [];
  const choices = destination ? targets.filter(move => move.to === destination.id) : [];
  const wall = useMemo(() => wallFields(game.board, game.initialWalls), [game.board, game.initialWalls]);
  const boardId = useId();
  const bushPattern = `${boardId}-bush-pattern`;
  const boardPaint = Object.fromEntries(Object.keys(boardMaterials)
    .map(name => [`--hare-${name}`, `url(#${boardId}-${name})`])) as CSSProperties;
  const center = game.board[CENTER];
  const winner = game.result && game.result !== "draw"
    ? botLevel && game.result === secondColor ? "Bot" : names[game.result]
    : undefined;
  const status = game.result === "draw" ? "Unentschieden" : winner
    ? "Partie beendet"
    : botThinking ? "Der Bot ist am Zug" : `${names[game.turn]} ist am Zug`;

  function reset(level: Level) {
    setMotion(undefined);
    setGame(newGame(level));
    setFirstColor(undefined);
    setSelected(undefined);
    setDestination(undefined);
  }

  function takeMove(cell: Cell, choice = 0) {
    if (!selected || motion) return;
    const move = targets.filter(candidate => candidate.to === cell.id)[choice];
    if (!move) return;
    const next = play(game, selected.id, cell.id, choice);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setGame(next);
    else setMotion({ from: selected, move, next });
    setSelected(undefined);
    setDestination(undefined);
  }

  function select(cell: Cell) {
    if (!firstColor || game.result || botThinking || motion) return;
    setDestination(undefined);
    const count = targets.filter(move => move.to === cell.id).length;
    if (count > 1) setDestination(cell);
    else if (count === 1) takeMove(cell);
    else setSelected(cell !== selected && game.board[cell.id]?.color === game.turn ? cell : undefined);
  }

  return (
    <main className="ru-hasenspiel">
      <div className="hare-page" inert={intro}>
        <header className="hare-header">
          <button type="button" onClick={onExit}>Zurück</button>
          <h1>Die Lichtung</h1>
          <button type="button" onClick={() => { reset(game.level); setLevelChosen(false); }}>Neues Spiel</button>
        </header>
        <label className="hare-mode">
          Gegner
          <select disabled={!!firstColor} value={botLevel ?? ""} onChange={event => {
            setBotLevel(botLevels.find(level => level === event.target.value));
            reset(game.level);
          }}>
            <option value="">Zweite Person</option>
            {botLevels.map(level => <option key={level} value={level}>Bot · {level}</option>)}
          </select>
        </label>
        <div className="hare-levels" role="group" aria-label="Schwierigkeitsstufe">
          {levels.map(level => <button key={level} type="button" aria-pressed={levelChosen && game.level === level} disabled={!!firstColor}
            onClick={() => { reset(level); setLevelChosen(true); }}>Stufe {level}</button>)}
        </div>
        {levelChosen && !firstColor && <MovementIntro level={game.level} key={game.level} />}
        <div className="hare-status" aria-live="polite">
          {firstColor ? <>
            <span>Münzwurf · {firstPlayer}: {names[firstColor]} · {secondPlayer}: {names[secondColor]}</span>
            <strong>{status}</strong>
            <span>{center?.kind === "rabbit" ? `${names[center.color]} hält die Lichtung · ${game.held}/3` : "Lichtung mit einem Hasen drei gegnerische Züge halten"}</span>
          </> : <button type="button" disabled={!levelChosen} onClick={() => setFirstColor(Math.random() < .5 ? "blue" : "gray")}>
            {levelChosen ? "Münze werfen" : "Zuerst eine Stufe wählen"}
          </button>}
        </div>
        <div className="hare-playfield" ref={field} data-intro={intro || undefined}>
          <svg className="hare-board" style={boardPaint} viewBox={`-25 -2 ${width + 50} ${boardHeight + 4}`} aria-label="Dreiecksbrett">
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
              {Object.entries(boardMaterials).map(([name, [light, dark]]) => (
                <linearGradient key={name} id={`${boardId}-${name}`} x1="12%" y1="0%" x2="80%" y2="100%">
                  <stop stopColor={light} />
                  <stop offset="1" stopColor={dark} />
                </linearGradient>
              ))}
              <pattern id={bushPattern} width="18" height="13" patternUnits="userSpaceOnUse">
                <rect width="18" height="13" fill="#2c563d" />
                <ellipse cx="9" cy="10.5" rx="8" ry="2" fill="#172e22" opacity=".65" />
                <path d="M1 9Q0 5 4 5Q5 1 9 2Q13 1 14 5Q18 5 17 9Q14 12 9 10Q4 12 1 9Z" fill={`url(#${boardId}-bush)`} />
                <path d="M4 7Q5 5 7 5M9 5Q11 3 13 6" fill="none" stroke="#a0bf7f" strokeWidth="1" opacity=".8" />
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
              const shape = boardPoint(cell);
              const rabbit = game.board[cell.id];
              const target = targets.find(move => move.to === cell.id);
              const active = !!firstColor && !game.result && !botThinking && !motion && (rabbit?.color === game.turn || !!target);
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
                  {rabbit && motion?.from !== cell && <g data-captured={motion?.move.capture === cell.id || undefined} data-double={!!motion?.move.via} className={`hare-token hare-token-${rabbit.color}`} transform={`translate(${shape.x} ${shape.y})`}>
                    <ellipse className="hare-piece-shadow" cy="7" rx="12" ry="7" />
                    <circle className="hare-piece-base" cy="2.5" r="12" />
                    <circle className="hare-piece-face" r="12" />
                    <PieceEmblem kind={rabbit.kind} />
                    {(frozen || resting) && <circle className="hare-frozen" r="13.5" />}
                  </g>}
                  {target && <circle className="hare-target" cx={shape.x + (rabbit ? 9 : 0)} cy={shape.y} r={rabbit ? 3 : 4} />}
                </g>
              );
            })}
            {motion && (() => {
              const piece = game.board[motion.from.id]!;
              const start = boardPoint(motion.from);
              return <g transform={`translate(${start.x} ${start.y})`} aria-hidden="true">
                <g className={`hare-token hare-token-${piece.color} hare-token-moving`} style={motionStyle(motion.from, motion.move)}
                  data-double={!!motion.move.via}>
                  <circle className="hare-piece-base" cy="2.5" r="12" />
                  <circle className="hare-piece-face" r="12" />
                  <PieceEmblem kind={piece.kind} />
                </g>
              </g>;
            })()}
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
              {capture ? `${ally ? " · " : ""}Figur auf ${fieldName(capture)} schlagen` : ally ? null : "Direkt ziehen"}
            </button>;
          })}
        </section>}
        {firstColor && !game.result && !botThinking && !motion && !canMove(game) && <button type="button" onClick={() => { setGame(play(game)); setSelected(undefined); setDestination(undefined); }}>Kein Zug möglich · Passen</button>}
        <HasenspielRules level={game.level} />
        <button className="hare-replay" type="button" onClick={() => setIntro(true)}>Waldauftakt wiederholen</button>
      </div>
      {intro && <ForestIntro field={field} onDone={closeIntro} />}
    </main>
  );
}
