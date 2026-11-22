import { useEffect, useRef, useState, type PointerEvent } from "react";
import { CENTER, cells, type Move } from "./rules";
import { boardHeight, triangle, width } from "./boardDrawing";

const palette = ["#f7cc68", "#63cbd0", "#d8a2e5", "#e99778", "#94cc86"];
export function routeColor(i: number) { return palette[i] ?? `hsl(${(i * 137.5) % 360} 68% 72%)`; }

export function routeFields(moves: Move[]) {
  const fields = new Map<string, number[]>();
  moves.forEach((move, i) => {
    // Colour landing and transit fields. Jumped pieces keep their own square.
    for (const id of new Set([...(move.trail ?? []), move.via, move.to])) {
      if (!id) continue;
      const numbers = fields.get(id) ?? [];
      numbers.push(i);
      fields.set(id, numbers);
    }
  });
  return fields;
}

const points = new Map(cells.map(cell => [cell.id, cell.id === CENTER
  ? { x: width / 2, y: boardHeight / 2 } : triangle(cell)]));

export function RouteArrow({ from, move, index, marker }: { from: string; move: Move; index: number; marker: string }) {
  const stops = [from, ...(move.trail ?? []), ...(move.via ? [move.via] : []), move.to];
  return <g pointerEvents="none" aria-hidden="true">
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto">
      <path d="M0 0L10 5L0 10Z" fill="#393143" /></marker></defs>
    {stops.slice(1).map((id,i) => {
      const a = points.get(stops[i])!, b = points.get(id)!;
      const dx = b.x-a.x, dy = b.y-a.y;
      const length = Math.hypot(dx,dy) || 1;
      const crossed = i === 0 ? move.friendly ?? move.capture : move.capture;
      const middle = crossed && points.get(crossed);
      const end = `${b.x-dx/length*8} ${b.y-dy/length*8}`;
      const path = `M${a.x+dx/length*8} ${a.y+dy/length*8} ` + (middle
        ? `Q${2*middle.x-(a.x+b.x)/2-dy/length*8} ${2*middle.y-(a.y+b.y)/2+dx/length*8} ${end}` : `L${end}`);
      return <g key={i}><path d={path} fill="none" stroke="#393143" strokeWidth="4" />
        <path d={path} fill="none" stroke={routeColor(index)} strokeWidth="2.3" markerEnd={`url(#${marker})`}/></g>;
    })}
  </g>;
}

export function useRouteHold() {
  const [preview, setPreview] = useState<number>();
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function end() {
    window.clearTimeout(timer.current);
    setPreview(undefined);
  }
  function handlers(index: number, activate: () => void) {
    return {
      onPointerDown(event: PointerEvent<Element>) {
        if (!event.isPrimary || event.button !== 0) return;
        end();
        held.current = false;
        if (index >= 0) timer.current = window.setTimeout(() => { held.current = true; setPreview(index); }, 380);
      },
      onPointerLeave: end, onPointerCancel: end, onPointerUp: end,
      onContextMenu(event: {preventDefault(): void}) { if (index >= 0) event.preventDefault(); },
      onClick() {
        if (!held.current) activate();
        held.current = false;
      },
    };
  }
  return { preview, handlers };
}
