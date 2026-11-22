import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ExperimentProps } from "../../experiments";
import { CENTER, canMove, cells, centerLinks, wallFields, movesFrom, newGame, play, sideLinks, type Cell, type Color, type Kind, type Level, type Game, type Move } from "./rules";
import { botLevels, botTurn, type BotLevel } from "./bot";
import { MovementIntro } from "./MovementIntro";
import { HasenspielRules } from "./HasenspielRules";
import { boardHeight, gap, height, side, triangle, width } from "./boardDrawing";
import { PieceEmblem } from "./PieceEmblem";
import { ForestIntro } from "./ForestIntro";
import { MatchHistory, readHistory, type FinishedMatch } from "./MatchHistory";
import { Victory } from "./Victory";
import "./hasenspiel.css";

const names = { blue: "Weiß", gray: "Braun" };
const boardMaterials = {
  "blue-field": ["#b1c58b", "#819d68"],
  "gray-field": ["#e0e3ae", "#b4c786"],
  "clearing": ["#edd58b", "#bf9e55"],
  "blue-piece": ["#fffef8", "#e2ded2"],
  "gray-piece": ["#b27d55", "#96603f"],
  "bush": ["#84aa63", "#235238"],
} as const;

const levels: Level[] = [1, 2, 3];
const species: Record<Kind, string> = { rabbit: "Hase", deer: "Hirsch", monkey: "Affe" };
function fieldName(cell: Cell) {
  return cell.id === CENTER ? "Lichtung" : `${cell.row < 6 ? "Weiße" : "Braune"} Seite, Reihe ${6 - Math.abs(cell.row - 6)}, Feld ${cell.x + 7 - Math.abs(cell.row - 6)}`;
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
  const closeIntro = useCallback(() => setIntro(false), []);
  const [levelChosen, setLevelChosen] = useState(false);
  const [motion, setMotion] = useState<Motion>();
  const [game, setGame] = useState(() => newGame());
  const [botLevel, setBotLevel] = useState<BotLevel>();
  const [firstColor, setFirstColor] = useState<Color>();
  const [coin, setCoin] = useState<Color>();
  const [confirmation, setConfirmation] = useState<"exit" | "new">();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmation]);

  useEffect(() => {
    if (!coin || confirmation) return;
    const timer = window.setTimeout(() => {
      setFirstColor(coin);
      setCoin(undefined);
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 750 : 1850);
    return () => window.clearTimeout(timer);
  }, [coin, confirmation]);
  const secondColor = firstColor === "blue" ? "gray" : "blue";
  const botThinking = !!botLevel && !!firstColor && !game.result && game.turn === secondColor;
  const firstPlayer = botLevel ? "Du" : "Person 1";
  const secondPlayer = botLevel ? "Bot" : "Person 2";
  const [history, setHistory] = useState(readHistory);
  const [matchId, setMatchId] = useState("");
  useEffect(() => {
    if (!game.result || !firstColor || !matchId) return;
    const outcome = game.result === "draw" ? "draw" : game.result === firstColor ? "first" : "second";
    const match: FinishedMatch = { id: matchId, level: game.level, bot: botLevel, outcome, firstColor };
    setHistory(previous => previous.some(entry => entry.id === matchId) ? previous : [match, ...previous]);
    try { localStorage.setItem("lichtung.score." + matchId, JSON.stringify(match)); } catch { /* Keep session scores in memory. */ }
  }, [game.result, game.level, botLevel, firstColor, matchId]);

  useEffect(() => {
    if (!motion || confirmation) return;
    const timer = window.setTimeout(() => {
      setGame(motion.next);
      setMotion(undefined);
    }, motion.move.via ? 620 : 400);
    return () => window.clearTimeout(timer);
  }, [motion, confirmation]);

  useEffect(() => {
    if (!botLevel || !botThinking || motion || confirmation) return;
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
  }, [botLevel, botThinking, game, motion, confirmation]);

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
    setCoin(undefined);
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
    if (destination || !firstColor || game.result || botThinking || motion) return;
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
          <button type="button" onClick={() => setConfirmation("exit")}>Zurück</button>
          <h1>Die Lichtung</h1>
          <button type="button" onClick={() => setConfirmation("new")}>Neues Spiel</button>
        </header>
        <div className="hare-status" aria-live="polite">
          {levelChosen && <strong>Stufe {game.level}{firstColor && ` · ${status}`}</strong>}
          {firstColor && <span>{firstPlayer}: {names[firstColor]} · {secondPlayer}: {names[secondColor]}</span>}
        </div>
        <div className="hare-playfield">
          {coin && <section className="hare-panel hare-toss" role="status">
            <strong>Münzwurf</strong>
            <div className="hare-throw" aria-hidden="true"><div className="hare-coin" data-brown={coin === "gray"}>
              <span>W</span><span>B</span>
            </div></div>
          </section>}
          {!firstColor && !coin && <section className="hare-panel" aria-label="Partie einrichten">
            <strong>Partie einrichten</strong>
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
            <button type="button" disabled={!levelChosen} onClick={() => {
              setMatchId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
              setCoin(Math.random() < .5 ? "blue" : "gray");
            }}>{levelChosen ? "Münze werfen" : "Zuerst eine Stufe wählen"}</button>
          </section>}
        {destination && <section className="hare-panel hare-choices" aria-label="Sprung auswählen">
          <strong>Mehrere Züge führen auf dieses Feld</strong>
          {choices.map((move, index) => {
            const capture = cells.find(cell => cell.id === move.capture);
            const ally = cells.find(cell => cell.id === move.friendly);
            return <button type="button" key={index} onClick={() => takeMove(destination, index)}>
              {ally ? `Über eigene Figur auf ${fieldName(ally)}` : null}
              {capture ? `${ally ? " · " : ""}Figur auf ${fieldName(capture)} schlagen` : ally ? null : "Direkt ziehen"}
            </button>;
          })}
          <button type="button" onClick={() => setDestination(undefined)}>Abbrechen</button>
        </section>}
          {firstColor && center?.kind === "rabbit" && <aside className="hare-hold" data-lower={center.color === "blue"} role="status">
            {names[center.color]} hält<br />die Lichtung<br /><b>{game.held}/3</b>
          </aside>}
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
          {game.result === "draw" && <div className="hare-announcement" role="status"><strong>Unentschieden</strong></div>}
          {winner && <Victory title={`${winner} gewinnt`} />}
        </div>
        {firstColor && !game.result && !botThinking && !motion && !canMove(game) && <button type="button" onClick={() => { setGame(play(game)); setSelected(undefined); setDestination(undefined); }}>Kein Zug möglich · Passen</button>}
        <MatchHistory history={history} />
        <HasenspielRules level={game.level} />
        <button className="hare-replay" type="button" onClick={() => setIntro(true)}>Waldauftakt wiederholen</button>
      </div>
      <dialog ref={dialog} className="hare-confirm" aria-labelledby="hare-confirm-title"
        onCancel={event => { event.preventDefault(); setConfirmation(undefined); }}>
        <h2 id="hare-confirm-title">Bist du dir sicher?</h2>
        <p>{confirmation === "exit" ? "Möchtest du die Lichtung verlassen?" : "Möchtest du ein neues Spiel beginnen?"}</p>
        <div><button type="button" onClick={() => {
          setConfirmation(undefined);
          if (confirmation === "exit") onExit();
          else { reset(game.level); setLevelChosen(false); }
        }}>Ja</button>
        <button type="button" autoFocus onClick={() => setConfirmation(undefined)}>Nein</button></div>
      </dialog>
      {intro && <ForestIntro onDone={closeIntro} />}
    </main>
  );
}
