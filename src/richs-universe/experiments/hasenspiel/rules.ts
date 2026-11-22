export type Color = "blue" | "gray";
export type Cell = { id: string; row: number; x: number };
export type Level = 1 | 2 | 3;
export type Kind = "rabbit" | "deer" | "monkey";
type Piece = { id: string; color: Color; kind: Kind };
type Board = Partial<Record<string, Piece>>;
type Pair = { mover: string; crossed: string };
export type Move = { to: string; distance?: number; via?: string; friendly?: string; capture?: string };

export const CENTER = "center";
export const cells: Cell[] = Array.from({ length: 13 }, (_, row) => {
  if (row === 6) return [{ id: CENTER, row, x: 0 }];
  const radius = 6 - Math.abs(row - 6);
  return Array.from({ length: 2 * radius + 1 }, (_, col) => ({
    id: `${row}:${col - radius}`, row, x: col - radius
  }));
}).flat();

const border = cells.filter(cell => cell.row === 5);
export const centerLinks = border.filter(cell => Math.abs(cell.x) <= 2);
export const sideLinks = border.filter(cell => Math.abs(cell.x) > 2);
const sideLinkColumns = new Set(sideLinks.map(cell => cell.x));

const neighbors = new Map(cells.map(cell => [cell.id, cells.filter(other => {
  if (cell.id === CENTER || other.id === CENTER) {
    const edge = cell.id === CENTER ? other : cell;
    return (edge.row === 5 || edge.row === 7) && Math.abs(edge.x) <= 2;
  }
  if (Math.min(cell.row, other.row) === 5 && Math.max(cell.row, other.row) === 7) {
    return cell.x === other.x && sideLinkColumns.has(cell.x);
  }
  if (cell.row === other.row) return Math.abs(cell.x - other.x) === 1;
  if (Math.abs(cell.row - other.row) !== 1 || cell.x !== other.x) return false;
  const inner = Math.abs(cell.row - 6) < Math.abs(other.row - 6) ? cell : other;
  const outer = inner === cell ? other : cell;
  const radius = 6 - Math.abs(outer.row - 6);
  return (outer.x + radius) % 2 === 0;
})]));

export type Game = {
  board: Board;
  level: Level;
  frozen: string[];
  restingDeer?: string[];
  initialWalls?: string[];
  turn: Color;
  previous: Record<Color, Pair | undefined>;
  held: number;
  passes: number;
  result?: Color | "draw";
};

export function newGame(level: Level = 1): Game {
  const board: Game["board"] = {};
  for (const cell of cells) {
    if (cell.row <= 3 || cell.row >= 9) {
      const depth = 6 - Math.abs(cell.row - 6);
      const kind = level === 3 && Math.abs(cell.x) === depth
        ? depth === 1 ? "monkey" : depth === 2 ? "deer" : "rabbit"
        : "rabbit";
      board[cell.id] = { id: cell.id, color: cell.row <= 3 ? "blue" : "gray", kind };
    }
  }
  return { board, level, frozen: [], initialWalls: deerWalls(board).map(wall => wall.id), turn: "blue", previous: { blue: undefined, gray: undefined }, held: 0, passes: 0 };
}

function forward(piece: Piece, from: Cell, to: Cell) {
  return (to.row - from.row) * (piece.color === "blue" ? 1 : -1);
}

function adjacent(cell: Cell) {
  return neighbors.get(cell.id) ?? [];
}

function deerWalls(board: Board) {
  return (["blue", "gray"] as const).flatMap(color => {
    const [left, right] = cells.filter(cell => board[cell.id]?.kind === "deer" && board[cell.id]?.color === color);
    if (!left || !right || left.row !== right.row) return [];
    const wallLength = right.x - left.x - 1;
    if (wallLength < 3 || wallLength > 6) return [];
    return [{
      id: `${color}/${left.id}/${right.id}`,
      color,
      ends: [left.id, right.id],
      between: cells.filter(cell => cell.row === left.row && cell.x > left.x && cell.x < right.x)
    }];
  });
}

export function wallFields(board: Board, initialWalls: string[] = [], color?: Color): Set<string> {
  return new Set(deerWalls(board)
    .filter(wall => !initialWalls.includes(wall.id) && (color === undefined || wall.color === color))
    .flatMap(wall => wall.between.map(cell => cell.id)));
}

function protectedRabbit(board: Board, cell: Cell, piece: Piece) {
  return piece.kind === "rabbit" && [-1, 1].every(offset => {
    const neighbor = board[`${cell.row}:${cell.x + offset}`];
    return neighbor?.kind === "rabbit" && neighbor.color === piece.color;
  });
}

const cellsById = new Map(cells.map(cell => [cell.id, cell]));

function deerMoves(board: Board, from: Cell, allowed: (start: Cell, end: Cell) => boolean): Move[] {
  const targets = new Map<string, Move>();

  function follow(start: Cell, x: number, rowStep: number, xStep: number, distance: number) {
    let current = start;
    for (;;) {
      let row = current.row + rowStep;
      x += xStep;
      if (row === 6 && rowStep && xStep === 0 && sideLinkColumns.has(x)) row += rowStep;
      const next = row === 6 && Math.abs(x) <= 2 ? cellsById.get(CENTER) : cellsById.get(`${row}:${x}`);
      if (!next || board[next.id] || !allowed(current, next)) return;
      if ((current.id === CENTER || next.id === CENTER) && !adjacent(current).includes(next)) return;
      distance++;
      if ((targets.get(next.id)?.distance ?? Infinity) > distance) {
        targets.set(next.id, { to: next.id, distance });
      }
      current = next;
    }
  }

  if (from.id === CENTER) {
    for (const exit of adjacent(from)) {
      if (board[exit.id] || !allowed(from, exit)) continue;
      targets.set(exit.id, { to: exit.id, distance: 1 });
      for (const xStep of [-1, 0, 1]) {
        follow(exit, exit.x, Math.sign(exit.row - from.row), xStep, 1);
      }
    }
  } else {
    for (const rowStep of [-1, 0, 1]) {
      for (const xStep of [-1, 0, 1]) {
        if (rowStep || xStep) follow(from, from.x, rowStep, xStep, 0);
      }
    }
  }
  return [...targets.values()];
}

function hangingMoves(board: Board, from: Cell, piece: Piece): Move[] {
  const targets = new Set<string>();
  for (const lateral of [-1, 1]) {
    const visited = new Set<string>();
    function follow(current: Cell, crossed: number, usedGap: boolean) {
      const state = `${current.id}/${crossed}/${usedGap}`;
      if (visited.has(state)) return;
      visited.add(state);
      for (const to of adjacent(current)) {
        const direction = forward(piece, current, to);
        if (direction < 0 || (direction === 0 && Math.sign(to.x - current.x) !== lateral)) continue;
        const next = board[to.id];
        if (next?.kind === "rabbit") follow(to, Math.min(crossed + 1, 2), usedGap);
        if (next || (current !== from && !board[current.id])) continue;
        if (crossed >= 2) targets.add(to.id);
        if (crossed && !usedGap && adjacent(to).some(cell => board[cell.id]?.kind === "rabbit")) {
          follow(to, crossed, true);
        }
      }
    }
    follow(from, 0, false);
  }
  return [...targets].map(to => ({ to }));
}

export function movesFrom(game: Game, from: Cell): Move[] {
  const piece = game.board[from.id];
  if (game.result || piece?.color !== game.turn || game.frozen.includes(piece.id)
    || game.restingDeer?.includes(piece.id)) return [];
  const wall = wallFields(game.board, game.initialWalls, piece.color === "blue" ? "gray" : "blue");
  const rabbit = piece.kind === "rabbit";
  const directionAllowed = (start: Cell, end: Cell) => !rabbit || forward(piece, start, end) >= 0;
  const allowed = (start: Cell, end: Cell) => directionAllowed(start, end) && (wall.has(end.id)
    ? wall.has(start.id)
    : !wall.has(start.id) || forward(piece, start, end) <= 0);
  if (piece.kind === "deer") return deerMoves(game.board, from, allowed);

  const wallEnds = new Map(deerWalls(game.board)
    .filter(wall => !game.initialWalls?.includes(wall.id))
    .flatMap(wall => wall.ends.map(id => [id, new Set(wall.between.map(cell => cell.id))] as const)));
  const previous = game.previous[game.turn];
  const moves: Move[] = [];

  const jumps = (board: Board, start: Cell) => {
    const result: { to: Cell; middle: Cell; crossed: Piece }[] = [];
    for (const middle of adjacent(start)) {
      const crossed = board[middle.id];
      if (!crossed || game.restingDeer?.includes(crossed.id)) continue;
      const protectedWall = wallEnds.get(middle.id);
      if (!allowed(start, middle) || wall.has(middle.id)
        || (protectedWall && (protectedWall.has(start.id) || start.row !== middle.row))) continue;
      if (crossed.color === piece.color && previous?.mover === piece.id && previous.crossed === crossed.id) continue;
      if (game.level >= 2 && crossed.color !== piece.color && protectedRabbit(board, middle, crossed)) continue;

      for (const to of adjacent(middle)) {
        if (board[to.id]) continue;
        if (protectedWall ? !protectedWall.has(to.id) || !directionAllowed(middle, to) : !allowed(middle, to)) continue;
        if (middle.id === CENTER) {
          if (to.row === start.row || to.x !== start.x) continue;
        } else {
          if (start.row === middle.row && middle.row === to.row && to.x - middle.x !== middle.x - start.x) continue;
        }
        result.push({ to, middle, crossed });
      }
    }
    return result;
  };

  for (const to of adjacent(from)) {
    if (game.board[to.id] || !allowed(from, to)) continue;
    if (!rabbit || forward(piece, from, to) > 0
      || (game.level >= 2 && to.row === from.row && Math.abs(to.x) < Math.abs(from.x))) {
      moves.push({ to: to.id });
    }
  }

  for (const { to, middle, crossed } of jumps(game.board, from)) {
    if (crossed.color !== piece.color) {
      moves.push({ to: to.id, capture: middle.id });
      continue;
    }
    moves.push({ to: to.id, friendly: middle.id });
    if (game.level < 3) continue;
    const board = { ...game.board, [from.id]: undefined, [to.id]: piece };
    for (const second of jumps(board, to)) {
      if (second.crossed.color !== piece.color) {
        moves.push({ to: second.to.id, via: to.id, friendly: middle.id, capture: second.middle.id });
      }
    }
  }

  if (!rabbit) moves.push(...hangingMoves(game.board, from, piece));
  const distinct = new Map<string, Move>();
  for (const move of moves) {
    const key = JSON.stringify([move.to, move.friendly, move.capture]);
    if (!distinct.has(key)) distinct.set(key, move);
  }
  return [...distinct.values()];
}

export function canMove(game: Game): boolean {
  return cells.some(cell => movesFrom(game, cell).length > 0);
}

export function play(game: Game, fromId?: string, toId?: string, choice = 0): Game {
  if (game.result) return game;
  const from = cells.find(cell => cell.id === fromId);
  const move = from && movesFrom(game, from).filter(candidate => candidate.to === toId)[choice];
  if (!move && (fromId !== undefined || canMove(game))) return game;

  return applyMove(game, from, move);
}

export function nextPositions(game: Game): Game[] {
  if (game.result) return [];
  const positions = cells.flatMap(from => movesFrom(game, from).map(move => applyMove(game, from, move)));
  return positions.length ? positions : [applyMove(game)];
}

// Track possible future helper locations as well as the rabbit's own steps.
// Treat temporary obstacles as movable so they cannot cause a premature draw.
function canStillReachClearing(board: Board, level: Level): boolean {
  if (board[CENTER]?.kind === "rabbit") return true;
  const entries = Object.entries(board).flatMap(([id, piece]) =>
    piece ? [{ piece, start: cellsById.get(id)! }] : []);
  if (!entries.some(({piece, start}) => piece.kind === "rabbit" && forward(piece, start, cellsById.get(CENTER)!) > 0)) return false;
  if (entries.some(({piece}) => piece.kind !== "rabbit")) return true;
  const owners = new Map<string, Set<number>>();
  const reachable = entries.map(({start}, index) => {
    owners.set(start.id, new Set([index]));
    return new Set([start]);
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const [index, {piece}] of entries.entries()) {
      const seen = reachable[index];
      for (const start of seen) {
        for (const middle of adjacent(start)) {
          const dir = forward(piece, start, middle);
          if (dir < 0) continue;
          const next: Cell[] = [];
          if (dir > 0 || (level >= 2 && Math.abs(middle.x) < Math.abs(start.x))) next.push(middle);
          const helpers = owners.get(middle.id);
          if (helpers && (helpers.size > 1 || !helpers.has(index))) {
            for (const end of adjacent(middle)) {
              if (forward(piece, middle, end) < 0 || end === start) continue;
              if (middle.id === CENTER && (end.row === start.row || end.x !== start.x)) continue;
              if (start.row === middle.row && middle.row === end.row && end.x - middle.x !== middle.x - start.x) continue;
              next.push(end);
            }
          }
          for (const end of next) {
            if (end.id === CENTER) return true;
            if (seen.has(end)) continue;
            seen.add(end);
            if (!owners.has(end.id)) owners.set(end.id, new Set());
            owners.get(end.id)!.add(index);
            changed = true;
          }
        }
      }
    }
  }
  return false;
}

function applyMove(game: Game, from?: Cell, move?: Move): Game {
  const board = { ...game.board };
  const previous = { ...game.previous, [game.turn]: undefined };
  const restingDeer = (game.restingDeer ?? []).filter(id =>
    Object.values(game.board).some(piece => piece?.id === id && piece.color !== game.turn));
  if (move && from) {
    const mover = board[from.id]!;
    if ((move.distance ?? 0) > 2) restingDeer.push(mover.id);
    const ally = move.friendly ? board[move.friendly] : undefined;
    if (ally) previous[game.turn] = { mover: mover.id, crossed: ally.id };
    if (move.capture) delete board[move.capture];
    delete board[from.id];
    board[move.to] = mover;
  }

  const occupant = board[CENTER];
  const held = occupant?.kind === "rabbit" && occupant === game.board[CENTER] && from?.id !== CENTER
    ? game.held + Number(occupant.color !== game.turn)
    : 0;
  // A skipped turn under a temporary effect does not count toward a stalemate.
  const temporaryBlock = game.frozen.length || game.restingDeer?.length;
  const passes = move || temporaryBlock ? 0 : game.passes + 1;
  const contender = canStillReachClearing(board, game.level);
  const result = !contender ? "draw" : held >= 3 ? occupant?.color : passes >= 2 && occupant?.kind !== "rabbit" ? "draw" : undefined;
  const turn = game.turn === "blue" ? "gray" : "blue";
  const oldWalls = new Set(deerWalls(game.board).map(wall => wall.id));
  const frozen = new Set(game.frozen.filter(id =>
    Object.values(board).some(piece => piece?.id === id && piece.color !== game.turn)));
  const walls = deerWalls(board);
  const initialWalls = (game.initialWalls ?? []).filter(id => walls.some(wall => wall.id === id));
  for (const wall of walls) {
    if (oldWalls.has(wall.id)) continue;
    for (const cell of wall.between) {
      const piece = board[cell.id];
      if (piece && piece.color !== wall.color && piece.kind !== "deer") frozen.add(piece.id);
    }
  }
  return { ...game, board, previous, held, passes, result, turn, frozen: [...frozen], restingDeer, initialWalls };
}
