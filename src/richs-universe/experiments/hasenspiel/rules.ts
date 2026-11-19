export type Color = "blue" | "gray";
export type Cell = { id: string; row: number; x: number };
type Rabbit = { id: string; color: Color };
type Pair = { mover: string; crossed: string };
export type Move = { to: string; over?: string };

export const CENTER = "center";
export const cells: Cell[] = Array.from({ length: 13 }, (_, row) => {
  if (row === 6) return [{ id: CENTER, row, x: 0 }];
  const radius = 6 - Math.abs(row - 6);
  return Array.from({ length: 2 * radius + 1 }, (_, col) => ({
    id: `${row}:${col - radius}`, row, x: col - radius
  }));
}).flat();

const neighbors = new Map(cells.map(cell => [cell.id, cells.filter(other => {
  if (cell.id === CENTER || other.id === CENTER) {
    const edge = cell.id === CENTER ? other : cell;
    return (edge.row === 5 || edge.row === 7) && Math.abs(edge.x) <= 2;
  }
  if (cell.row === other.row) return Math.abs(cell.x - other.x) === 1;
  if (Math.abs(cell.row - other.row) !== 1 || cell.x !== other.x) return false;
  const inner = Math.abs(cell.row - 6) < Math.abs(other.row - 6) ? cell : other;
  const outer = inner === cell ? other : cell;
  const radius = 6 - Math.abs(outer.row - 6);
  return (outer.x + radius) % 2 === 0;
})]));

export type Game = {
  board: Partial<Record<string, Rabbit>>;
  turn: Color;
  previous: Record<Color, Pair | undefined>;
  held: number;
  passes: number;
  result?: Color | "draw";
};

export function newGame(): Game {
  const board: Game["board"] = {};
  for (const cell of cells) {
    if (cell.row <= 3 || cell.row >= 9) {
      board[cell.id] = { id: cell.id, color: cell.row <= 3 ? "blue" : "gray" };
    }
  }
  return { board, turn: "blue", previous: { blue: undefined, gray: undefined }, held: 0, passes: 0 };
}

export function movesFrom(game: Game, from: Cell): Move[] {
  const rabbit = game.board[from.id];
  if (game.result || rabbit?.color !== game.turn) return [];
  const forward = game.turn === "blue" ? 1 : -1;
  const previous = game.previous[game.turn];
  const moves: Move[] = [];

  for (const middle of neighbors.get(from.id) ?? []) {
    const crossed = game.board[middle.id];
    if (middle.id !== CENTER && forward * (middle.row - from.row) < 0) continue;
    if (!crossed) {
      if (middle.row !== from.row) moves.push({ to: middle.id });
      continue;
    }
    if (crossed.color === game.turn && previous?.mover === rabbit.id && previous.crossed === crossed.id) continue;
    for (const to of neighbors.get(middle.id) ?? []) {
      if (game.board[to.id]) continue;
      if (middle.id === CENTER) {
        if (to.row === from.row || to.x !== from.x) continue;
      } else {
        if (to.id !== CENTER && forward * (to.row - middle.row) < 0) continue;
        if (from.row === middle.row && middle.row === to.row && to.x - middle.x !== middle.x - from.x) continue;
      }
      moves.push({ to: to.id, over: middle.id });
    }
  }
  return moves;
}

export function canMove(game: Game): boolean {
  return cells.some(cell => movesFrom(game, cell).length > 0);
}

export function play(game: Game, fromId?: string, toId?: string): Game {
  if (game.result) return game;
  const from = cells.find(cell => cell.id === fromId);
  const move = from && movesFrom(game, from).find(candidate => candidate.to === toId);
  if (!move && (fromId !== undefined || canMove(game))) return game;

  const board = { ...game.board };
  const previous = { ...game.previous, [game.turn]: undefined };
  if (move && from) {
    const mover = board[from.id]!;
    const crossed = move.over ? board[move.over] : undefined;
    if (move.over && crossed) {
      if (crossed.color === mover.color) previous[game.turn] = { mover: mover.id, crossed: crossed.id };
      else delete board[move.over];
    }
    delete board[from.id];
    board[move.to] = mover;
  }

  const occupant = board[CENTER];
  const held = occupant && occupant === game.board[CENTER]
    ? game.held + Number(occupant.color !== game.turn)
    : 0;
  const passes = move ? 0 : game.passes + 1;
  const result = held >= 3 ? occupant?.color : passes >= 2 && !occupant ? "draw" : undefined;
  return { board, previous, held, passes, result, turn: game.turn === "blue" ? "gray" : "blue" };
}
