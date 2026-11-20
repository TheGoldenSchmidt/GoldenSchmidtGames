import type { Cell, Kind } from "./rules";

export const side = 54;
export const height = side * Math.sqrt(3) / 2;
export const gap = 28;
export const width = 6 * side;
export const boardHeight = 12 * height + gap;
export const shapes: Record<Kind, string> = {
  rabbit: "M-4 1 Q-8-9-4-8 Q-1-8-1-2 H1 Q1-8 4-8 Q8-9 4 1 Q6 7 0 7 Q-6 7-4 1Z",
  deer: "M0 7 Q-5 6-4 1 L-8-3 M-5 0 L-5-7 M-5-4 L-8-6 M-4 1 Q0-3 4 1 L8-3 M5 0 L5-7 M5-4 L8-6 M4 1 Q5 6 0 7",
  monkey: "M-5 0 A2 2 0 1 0-5 4 M5 0 A2 2 0 1 1 5 4 M-5 1 Q-5-6 0-6 Q5-6 5 1 Q7 7 0 7 Q-7 7-5 1Z"
};

export function triangle(cell: Cell) {
  const lower = cell.row > 6;
  const depth = 6 - Math.abs(cell.row - 6);
  const x = width / 2 + cell.x * side / 2;
  const y = lower ? boardHeight - depth * height : depth * height;
  const facingCenter = (cell.x + depth) % 2 === 0;
  const base = facingCenter ? y + (lower ? -height : height) : y;
  const tip = facingCenter ? y : y + (lower ? -height : height);
  return { x, y: (2 * base + tip) / 3, points: `${x},${tip} ${x - side / 2},${base} ${x + side / 2},${base}` };
}
