import { CENTER, cells, nextPositions, type Color, type Game } from "./rules";

export const botLevels = ["Leicht", "Mittel", "Schwer"] as const;
export type BotLevel = typeof botLevels[number];

const win = 100_000;
const beamWidth = 8;

function evaluate(game: Game, color: Color): number {
  if (game.result === "draw") return 0;
  if (game.result) return game.result === color ? win : -win;

  let score = 0;
  let closestOwn = 8;
  let closestOpponent = 8;
  for (const cell of cells) {
    const piece = game.board[cell.id];
    if (!piece) continue;
    const own = piece.color === color;
    const sign = own ? 1 : -1;
    const distance = Math.abs(cell.row - 6) + Math.max(0, Math.abs(cell.x) - 2);
    const value = piece.kind === "monkey" ? 130 : piece.kind === "deer" ? 110 : 80;
    score += sign * (value + Math.max(0, 5 - distance) * 4);
    if (own) closestOwn = Math.min(closestOwn, distance);
    else closestOpponent = Math.min(closestOpponent, distance);
  }
  const center = game.board[CENTER];
  if (center?.kind === "rabbit") score += (center.color === color ? 1 : -1) * (180 + 100 * game.held);
  return score + 30 * (closestOpponent - closestOwn);
}

function ranked(game: Game, color: Color) {
  const sign = game.turn === color ? 1 : -1;
  return nextPositions(game).map(position => ({ position, score: evaluate(position, color) }))
    .sort((a, b) => sign * (b.score - a.score));
}

function search(game: Game, color: Color, depth: number): number {
  if (game.result) return evaluate(game, color);
  const options = ranked(game, color);
  if (depth === 1) return options[0].score;
  const scores = options.slice(0, beamWidth).map(({ position }) => search(position, color, depth - 1));
  return game.turn === color ? Math.max(...scores) : Math.min(...scores);
}

export function botTurn(game: Game, level: BotLevel, random = Math.random): Game {
  if (game.result) return game;
  if (level === "Leicht") {
    const options = nextPositions(game);
    return options[Math.floor(random() * options.length)];
  }

  const options = ranked(game, game.turn);
  const first = options[0];
  if (first.position.result === game.turn || options.length === 1) return first.position;

  let best = first.position;
  let bestScore = -Infinity;
  for (const { position } of options.slice(0, beamWidth)) {
    const score = search(position, game.turn, level === "Schwer" ? 2 : 1);
    if (score > bestScore) {
      best = position;
      bestScore = score;
    }
  }
  return best;
}
