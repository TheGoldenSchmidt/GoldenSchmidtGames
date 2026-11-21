import { useId, useState } from "react";
import { PieceEmblem } from "./PieceEmblem";
import { boardHeight, gap, height, shapes, side, triangle, width } from "./boardDrawing";
import { CENTER, cells, newGame, play, wallFields, type Color, type Game, type Kind, type Level } from "./rules";

const piece = (id: string, color: Color = "blue", kind: Kind = "rabbit") => ({ id, color, kind });
const position = (level: Level, board: Game["board"], turn: Color = "blue"): Game =>
  ({ ...newGame(level), board, turn });

type Frame = { label: string; game: Game; path: string[]; blocked?: boolean; guide?: "edges" | "center"; captureAt?: string };
const frame = (label: string, game: Game, path: string[], blocked = false): Frame =>
  ({ label, game, path, blocked });

const rabbit = position(1, { "3:-1": piece("hare") });
const jump = position(1, { "3:-2": piece("hare"), "3:-1": piece("opponent", "gray") });
const friendly = position(1, { "3:-2": piece("hare"), "3:-1": piece("friend") });
const repeat = { ...friendly, previous: { blue: { mover: "hare", crossed: "friend" }, gray: undefined } };
const trio = position(2, {
  [CENTER]: piece("hare"), "7:-1": piece("left", "gray"), "7:0": piece("middle", "gray"), "7:1": piece("right", "gray"),
});
const double = position(3, { "3:-2": piece("hare"), "3:-3": piece("friend"), "4:-2": piece("opponent", "gray") });
const deer = position(3, { "4:0": piece("deer", "blue", "deer"), "4:-2": piece("obstacle", "gray") });
const restingDeer = play(deer, "4:0", "4:3");
const wallSetup = position(3, {
  "4:-4": piece("left", "blue", "deer"), "3:2": piece("right", "blue", "deer"),
  "4:-2": piece("friend"), "4:1": piece("enemy", "gray", "monkey"),
});
const wall = play(wallSetup, "3:2", "4:3");
const wallClimb = position(3, {
  "4:-4": piece("left", "gray", "deer"), "4:3": piece("right", "gray", "deer"),
  "3:-2": piece("monkey", "blue", "monkey"), "3:-1": piece("first"),
  "4:-1": piece("second", "gray"), "4:0": piece("third"),
});
const climbing = position(3, {
  "5:-4": piece("monkey", "blue", "monkey"), "5:-3": piece("first", "gray"), "5:-1": piece("second", "gray"),
});
const monkey = position(3, { "4:0": piece("monkey", "blue", "monkey") });

const longHang = position(3, {
  "5:-4": piece("monkey", "blue", "monkey"),
  ...Object.fromEntries([-3, -2, -1, 0, 1].map(x => [`5:${x}`, piece(`hare${x}`)])),
});

export const examples = {
  edges: { ...frame("Diese drei grünen Kanten verbinden das Feld mit seinen Nachbarn. Eine gemeinsame Ecke reicht nicht.", rabbit, ["3:-1"]), guide: "edges" } satisfies Frame,
  victory: frame("So gewinnst du: Bleibt derselbe Hase drei gegnerische Züge in Folge auf der Lichtung, gewinnt seine Farbe. Auch ein gegnerischer Pass zählt.",
    position(1, { [CENTER]: piece("hare") }), [CENTER]),
  centerMap: { ...frame("Fünf Zugänge auf jeder Seite. Über die besetzte Lichtung führen fünf gerade Sprungwege, jeder zum genau gegenüberliegenden Feld.", position(1, {}), [CENTER]), guide: "center" } satisfies Frame,
  enter: frame("Auf die freie Lichtung springen · über einen eigenen Hasen am Eingang", position(1, {
    "5:-1": piece("hare"), "5:0": piece("friend"),
  }), ["5:-1", "5:0", CENTER]),
  leave: frame("Von der Lichtung abspringen · über einen Hasen auf der Gegenseite", position(1, {
    [CENTER]: piece("hare"), "7:0": piece("friend"),
  }), [CENTER, "7:0", "7:1"]),
  backwardJump: frame("Falsch · der Sprung führt eine Reihe zurück", position(1, {
    "4:-1": piece("hare"), "3:-1": piece("friend"),
  }), ["4:-1", "3:-1", "3:0"], true),
  fullDouble: { ...frame("Ein Zug mit zwei Sprüngen. Zuerst über die eigene Figur auf ein freies Feld, von dort über den Gegner. Nur der Gegner wird geschlagen.", double,
    ["3:-2", "3:-3", "4:-3", "4:-2", "5:-2"]), captureAt: "4:-2" },
  longHang: frame("Langes Hangeln · über fünf Hasen bis zum freien Feld. Alle fünf bleiben stehen.", longHang,
    ["5:-4", "5:-3", "5:-2", "5:-1", "5:0", "5:1", "5:2"]),
  resting: frame("Verboten · dieser Hirsch ruht nach drei Feldern. Grau darf ihn nicht überspringen. Blau muss ihn im nächsten eigenen Zug stehen lassen.", {
    ...restingDeer, board: { ...restingDeer.board, "4:2": piece("hare", "gray") }
  }, ["4:2", "4:3", "4:4"], true),
  step: [
    frame("Eine Ebene vor", rabbit, ["3:-1", "4:-1"]),
    frame("Seitwärts in Stufe 1 verboten", rabbit, ["3:-1", "3:0"], true),
    frame("Rückwärts verboten", position(1, { "4:-1": piece("hare") }), ["4:-1", "3:-1"], true),
    frame("Zwei Ebenen auf einmal verboten", rabbit, ["3:-1", "5:-1"], true),
  ],
  jump: [
    frame("Seitlich über den Gegner springen", jump, ["3:-2", "3:-1", "3:0"]),
    frame("Der Gegner wurde geschlagen", play(jump, "3:-2", "3:0"), ["3:0"]),
    frame("Über einen eigenen Hasen springen", friendly, ["3:-2", "3:-1", "3:0"]),
    frame("Der eigene Hase bleibt stehen", play(friendly, "3:-2", "3:0"), ["3:0"]),
    frame("Im nächsten eigenen Zug ist dieses Paar gesperrt", repeat, ["3:-2", "3:-1", "3:0"], true),
    frame("Vorwärts springen", position(1, { "3:-1": piece("hare"), "4:-1": piece("friend") }), ["3:-1", "4:-1", "4:0"]),
  ],
  crossing: [
    frame("Über die gestrichelte Verbindung ziehen", position(1, { "5:3": piece("hare") }), ["5:3", "7:3"]),
    ...[-2, -1, 0, 1, 2].map((x, i) => frame(
      `Lichtung überspringen · Weg ${i + 1} von links`,
      position(1, { [`5:${x}`]: piece("hare"), [CENTER]: piece("opponent", "gray") }),
      [`5:${x}`, CENTER, `7:${x}`],
    )),
    frame("Rückwärts über die Lichtung springen ist verboten",
      position(1, { "7:0": piece("hare"), [CENTER]: piece("opponent", "gray") }), ["7:0", CENTER, "5:0"], true),
  ],
  sideways: [frame("Ein freies Feld zur Reihenmitte", position(2, { "3:-2": piece("hare") }), ["3:-2", "3:-1"])],
  trio: [
    frame("Gegnerischer Sprung über den mittleren Hasen gesperrt", trio, [CENTER, "7:0", "8:0"], true),
    frame("Eigener Sprung über den mittleren Hasen erlaubt", position(2, {
      "7:-1": piece("hare", "gray"), "7:0": piece("middle", "gray"), "7:1": piece("right", "gray"),
    }, "gray"), ["7:-1", "7:0", CENTER]),
  ],
  double: [
    frame("1. Über die eigene Figur springen", double, ["3:-2", "3:-3", "4:-3"]),
    frame("2. Über den Gegner springen", { ...play(double, "3:-2", "4:-3"), turn: "blue" }, ["4:-3", "4:-2", "5:-2"]),
    frame("Beide Sprünge zählen als ein Zug", play(double, "3:-2", "5:-2"), ["5:-2"]),
  ],
  deer: [
    frame("Waagerecht über drei freie Felder", deer, ["4:0", "4:1", "4:2", "4:3"]),
    frame("Der Hirsch ruht und ist vor Sprüngen geschützt", play(deer, "4:0", "4:3"), ["4:3"]),
    frame("Senkrecht ziehen", deer, ["4:0", "5:0"]),
    frame("Diagonal ziehen", deer, ["4:0", "3:1"]),
    frame("Eine Figur blockiert den Weg", deer, ["4:0", "4:-2", "4:-3"], true),
  ],
  wall: [
    frame("Der zweite Hirsch zieht in dieselbe Reihe", wallSetup, ["3:2", "4:3"]),
    frame("Der Wall entsteht. Grau setzt hier aus", wall, ["4:1"]),
    frame("Grau darf nach der Betäubung seitwärts herausziehen", { ...wall, frozen: [] }, ["4:1", "4:2"]),
    frame("Vorwärts bleibt der Wall für Grau gesperrt", { ...wall, frozen: [] }, ["4:1", "3:1"], true),
    frame("Blau kann frei hindurchziehen", { ...wall, turn: "blue" }, ["4:-2", "5:-2"]),
    frame("Blau hangelt über einen grauen Wall", wallClimb, ["3:-2", "3:-1", "4:-1", "4:0", "5:0"]),
    frame("Nur von außen seitlich kann Blau den Hirsch schlagen", position(3, {
      "4:-2": piece("left", "gray", "deer"), "4:2": piece("right", "gray", "deer"), "4:-3": piece("hare"),
    }), ["4:-3", "4:-2", "4:-1"]),
    frame("Vom Wall aus ist der Sprung über den Hirsch gesperrt", position(3, {
      "4:-2": piece("left", "gray", "deer"), "4:2": piece("right", "gray", "deer"), "4:-1": piece("monkey", "blue", "monkey"),
    }), ["4:-1", "4:-2", "4:-3"], true),
  ],
  monkey: [
    frame("Vorwärts ziehen", monkey, ["4:0", "5:0"]),
    frame("Seitwärts ziehen", monkey, ["4:0", "4:-1"]),
    frame("Rückwärts ziehen", position(3, { "5:0": piece("monkey", "blue", "monkey") }), ["5:0", "4:0"]),
    frame("Rückwärts über eine Figur springen", position(3, { "5:0": piece("monkey", "blue", "monkey"), "4:0": piece("friend") }), ["5:0", "4:0", "4:1"]),
    frame("Hangeln über zwei Hasen mit einer Lücke", climbing, ["5:-4", "5:-3", "5:-2", "5:-1", "5:0"]),
    frame("Beim Hangeln bleiben beide Hasen stehen", play(climbing, "5:-4", "5:0"), ["5:0"]),
  ],
};

const drawing = new Map(cells.map(cell => [cell.id, {
  ...cell, ...(cell.id === CENTER ? { x: width / 2, y: boardHeight / 2, points: "" } : triangle(cell)),
}]));

export function RuleExample({ frames, animate = false }: { frames: Frame[]; animate?: boolean }) {
  const [step, setStep] = useState(0);
  const marker = useId();
  const { game, label, path, blocked, guide, captureAt } = frames[step];
  const guideCells = guide === "center" ? ["5:-2", "5:2", "7:-2", "7:2"] : [];
  const shown = [...Object.keys(game.board), ...path, ...guideCells].map(id => drawing.get(id)!);
  const minX = Math.max(-2, Math.min(...shown.map(cell => cell.x)) - side);
  const maxX = Math.min(width + 2, Math.max(...shown.map(cell => cell.x)) + side);
  const minY = Math.max(-2, Math.min(...shown.map(cell => cell.y)) - height * .7);
  const maxY = Math.min(boardHeight + 2, Math.max(...shown.map(cell => cell.y)) + height * .7);
  const route = path.map((id, index) => {
    const cell = drawing.get(id)!;
    if (id === CENTER && index > 0 && index < path.length - 1) {
      return { ...cell, x: drawing.get(path[index - 1])!.x };
    }
    return cell;
  });
  const end = route.at(-1)!;
  const wall = wallFields(game.board, game.initialWalls);
  const visible = [...drawing.values()].filter(cell => cell.x >= minX - side / 2 && cell.x <= maxX + side / 2
    && cell.y >= minY - height / 2 && cell.y <= maxY + height / 2);
  const bridge = route.find((cell, i) => cell.row === 5 && route[i + 1]?.row === 7);
  return (
    <figure className="hare-rule-example">
      <svg className="hare-rule-diagram" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">
        <defs>
          <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto">
            <path d="M0 0L10 5L0 10Z" fill="context-stroke" />
          </marker>
        </defs>
        {visible.map(cell => (
          <g key={cell.id} className="hare-cell">
            {cell.id === CENTER ? <rect x={width / 2 - side * 1.25} y={6 * height} width={side * 2.5} height={gap} rx="4" />
              : <polygon points={cell.points} data-side={cell.row < 6 ? "blue" : "gray"}
                style={wall.has(cell.id) ? { fill: "#4b8955" } : undefined} />}
          </g>
        ))}
        {guide === "edges" && <polygon points={route[0].points} fill="none" stroke="#19883b" strokeWidth="5" strokeLinejoin="round" />}
        {guide === "center" && [-2,-1,0,1,2].map(column => {
          const top = drawing.get(`5:${column}`)!;
          const bottom = drawing.get(`7:${column}`)!;
          return <g key={column} stroke="#21733e" strokeWidth="2.5">
            <line x1={top.x} x2={bottom.x} y1={top.y} y2={bottom.y} strokeDasharray="4 2" />
            <circle cx={top.x} cy={top.y} r="3" /><circle cx={bottom.x} cy={bottom.y} r="3" />
          </g>;
        })}
        {bridge && <line className="hare-rule-bridge" x1={bridge.x} x2={bridge.x} y1={6 * height} y2={6 * height + gap} />}
        <polyline className="hare-rule-route" data-blocked={blocked} points={route.map(cell => `${cell.x},${cell.y}`).join(" ")}
          markerEnd={blocked || route.length === 1 ? undefined : `url(#${marker})`} />
        {visible.map(cell => {
          const token = game.board[cell.id];
          if (!token) return null;
          return <g key={cell.id} className={`hare-token hare-token-${token.color}`} transform={`translate(${cell.x} ${cell.y})`}>
            <g>
              {animate && captureAt === cell.id && <set attributeName="opacity" to="0" begin="1.2s" fill="freeze" />}
              {animate && !blocked && cell.id === path[0] && route.length > 1 &&
                <animateMotion key={label} dur="1.4s" fill="freeze"
                  path={route.map((point, i) => `${i ? "L" : "M"}${point.x - cell.x} ${point.y - cell.y}`).join(" ")} />}
            <circle r="11" />
            {token.kind === "deer" ? <PieceEmblem kind="deer" /> : <path data-kind={token.kind} d={shapes[token.kind]} />}
            {(game.frozen.includes(token.id) || game.restingDeer?.includes(token.id)) && <circle className="hare-frozen" r="13" />}
            </g>
          </g>;
        })}
        {route.length === 1 && !guide && <circle className="hare-rule-highlight" cx={end.x} cy={end.y} r="16" />}
        {blocked && <text className="hare-rule-cross" x={end.x} y={end.y}>×</text>}
      </svg>
      <figcaption>
        <span aria-live="polite">{label}</span>
        {frames.length > 1 && <div className="hare-rule-controls" role="group" aria-label="Beispielschritte">
          {frames.map(({ label: name }, index) => <button key={name} type="button" aria-pressed={index === step}
            aria-label={name} onClick={() => setStep(index)}>{index + 1}</button>)}
        </div>}
      </figcaption>
    </figure>
  );
}
