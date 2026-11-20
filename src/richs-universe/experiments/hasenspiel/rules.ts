export type Color = "blue" | "gray";
export type Cell = { id: string; row: number; x: number };
export type Level = 1 | 2 | 3;
export type Kind = "rabbit" | "deer" | "monkey";
type Piece = { id: string; color: Color; kind: Kind };
type Board = Partial<Record<string, Piece>>;
type Pair = { mover: string; crossed: string };
export type Move = { to: string; via?: string; first?: string; friendly?: string; capture?: string };

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
  chargedDeer?: string;
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
  return { board, level, frozen: [], turn: "blue", previous: { blue: undefined, gray: undefined }, held: 0, passes: 0 };
}

function forward(piece: Piece, from: Cell, to: Cell) {
  return (to.row - from.row) * (piece.color === "blue" ? 1 : -1);
}

function adjacent(cell: Cell) {
  return neighbors.get(cell.id) ?? [];
}

export function deerLine(board: Board, color: Color): { between: Cell[]; ends: string[] } {
  const deer = cells.filter(cell => board[cell.id]?.kind === "deer" && board[cell.id]?.color === color);
  const [left, right] = deer;
  if (!left || !right || left.row !== right.row) return { between: [], ends: [] };
  const distance = right.x - left.x - 1;
  if (distance < 4 || distance > 6) return { between: [], ends: [] };
  return {
    between: cells.filter(cell => cell.row === left.row && cell.x > left.x && cell.x < right.x),
    ends: [left.id, right.id]
  };
}

function protectedRabbit(board: Board, cell: Cell, piece: Piece) {
  return piece.kind === "rabbit" && [-1, 1].every(offset => {
    const neighbor = board[`${cell.row}:${cell.x + offset}`];
    return neighbor?.kind === "rabbit" && neighbor.color === piece.color;
  });
}

function deerMoves(board: Board, from: Cell, piece: Piece): Move[] {
  const targets = new Set(adjacent(from)
    .filter(to => !board[to.id] && forward(piece, from, to) >= 0)
    .map(to => to.id));
  for (const lateral of [-1, 1]) {
    const nextSideways = (cell: Cell) => adjacent(cell)
      .find(to => to.row === cell.row && to.x - cell.x === lateral);
    let endOfRowRun = from;
    for (let next = nextSideways(from); next && !board[next.id]; next = nextSideways(next)) {
      endOfRowRun = next;
    }
    if (endOfRowRun !== from) targets.add(endOfRowRun.id);

    // Follow either forward diagonal through the alternating triangles.
    const starts = from.id === CENTER
      ? adjacent(from).filter(to => forward(piece, from, to) > 0 && !board[to.id])
      : [from];
    for (const start of starts) {
      let current = start;
      let entryColumn = start.x;
      for (;;) {
        const next = adjacent(current).find(to => forward(piece, current, to) > 0
          && (current.id !== CENTER || to.x === entryColumn)) ?? nextSideways(current);
        if (!next || board[next.id]) break;
        entryColumn = current.x;
        current = next;
      }
      if (forward(piece, from, current) > 0) targets.add(current.id);
    }
  }
  return [...targets].map(to => ({ to }));
}

function hangingMoves(board: Board, from: Cell, piece: Piece): Move[] {
  const targets = new Map<string, Move>();
  for (const lateral of [-1, 1]) {
    const visited = new Set<string>();
    function follow(current: Cell, crossed: number, usedGap: boolean, first?: string) {
      const state = `${current.id}/${crossed}/${usedGap}/${first}`;
      if (visited.has(state)) return;
      visited.add(state);
      for (const to of adjacent(current)) {
        const direction = forward(piece, current, to);
        if (direction < 0 || (direction === 0 && Math.sign(to.x - current.x) !== lateral)) continue;
        const next = board[to.id];
        if (next?.kind === "rabbit") follow(to, Math.min(crossed + 1, 2), usedGap, first ?? to.id);
        if (next || (current !== from && !board[current.id])) continue;
        if (crossed >= 2) targets.set(`${to.id}/${first}`, { to: to.id, first });
        if (crossed && !usedGap && adjacent(to).some(cell => board[cell.id]?.kind === "rabbit")) {
          follow(to, crossed, true, first);
        }
      }
    }
    follow(from, 0, false);
  }
  return [...targets.values()];
}

export function movesFrom(game: Game, from: Cell): Move[] {
  const piece = game.board[from.id];
  if (game.result || piece?.color !== game.turn || game.frozen.includes(piece.id)) return [];
  if (piece.kind === "deer") return deerMoves(game.board, from, piece);

  const opponent = piece.color === "blue" ? "gray" : "blue";
  const enemyLine = deerLine(game.board, opponent);
  const ownLine = deerLine(game.board, piece.color);
  const blocked = new Set(enemyLine.between.map(cell => cell.id));
  const unjumpable = new Set([...enemyLine.ends, ...ownLine.ends]);
  const previous = game.previous[game.turn];
  const rabbit = piece.kind === "rabbit";
  const moves: Move[] = [];

  const jumps = (board: Board, start: Cell) => {
    const result: { to: Cell; middle: Cell; crossed: Piece }[] = [];
    for (const middle of adjacent(start)) {
      const crossed = board[middle.id];
      if (!crossed || crossed.id === game.chargedDeer || (rabbit && middle.id !== CENTER && forward(piece, start, middle) < 0)) continue;
      if (rabbit && (blocked.has(middle.id) || unjumpable.has(middle.id))) continue;
      if (crossed.color === piece.color && previous?.mover === piece.id && previous.crossed === crossed.id) continue;
      if (game.level >= 2 && crossed.color !== piece.color && protectedRabbit(board, middle, crossed)) continue;

      for (const to of adjacent(middle)) {
        if (board[to.id] || (rabbit && blocked.has(to.id))) continue;
        if (middle.id === CENTER) {
          if (to.row === start.row || to.x !== start.x) continue;
        } else {
          if (rabbit && to.id !== CENTER && forward(piece, middle, to) < 0) continue;
          if (start.row === middle.row && middle.row === to.row && to.x - middle.x !== middle.x - start.x) continue;
        }
        result.push({ to, middle, crossed });
      }
    }
    return result;
  };

  for (const to of adjacent(from)) {
    if (game.board[to.id] || (rabbit && blocked.has(to.id))) continue;
    if (!rabbit || to.id === CENTER || forward(piece, from, to) > 0
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
    const key = JSON.stringify([move.to, move.friendly, move.capture, move.via, move.first]);
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
  const positions = cells.flatMap(from => {
    // Different routes can lead to the same position for the bot.
    const outcomes = new Map<string, Move>();
    for (const move of movesFrom(game, from)) {
      const key = JSON.stringify([move.to, move.friendly, move.capture]);
      if (!outcomes.has(key)) outcomes.set(key, move);
    }
    return [...outcomes.values()].map(move => applyMove(game, from, move));
  });
  return positions.length ? positions : [applyMove(game)];
}

function applyMove(game: Game, from?: Cell, move?: Move): Game {
  const board = { ...game.board };
  const previous = { ...game.previous, [game.turn]: undefined };
  let chargedDeer: string | undefined;
  if (move && from) {
    const mover = board[from.id]!;
    if (mover.kind === "deer" && !adjacent(from).some(to => to.id === move.to)) {
      chargedDeer = mover.id;
    }
    const ally = move.friendly ? board[move.friendly] : undefined;
    if (ally) previous[game.turn] = { mover: mover.id, crossed: ally.id };
    if (move.capture) delete board[move.capture];
    delete board[from.id];
    board[move.to] = mover;
  }

  const occupant = board[CENTER];
  const held = occupant && occupant === game.board[CENTER] && from?.id !== CENTER
    ? game.held + Number(occupant.color !== game.turn)
    : 0;
  const passes = move ? 0 : game.passes + 1;
  const result = held >= 3 ? occupant?.color : passes >= 2 && !occupant ? "draw" : undefined;
  const turn = game.turn === "blue" ? "gray" : "blue";
  const oldLine = new Set(deerLine(game.board, game.turn).between.map(cell => cell.id));
  const frozen = deerLine(board, game.turn).between.flatMap(cell => {
    const piece = board[cell.id];
    return !oldLine.has(cell.id) && piece?.kind === "rabbit" && piece.color === turn ? [piece.id] : [];
  });
  return { ...game, board, previous, held, passes, result, turn, frozen, chargedDeer };
}
