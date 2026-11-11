/** Small deterministic 2D helpers shared by the match games. */
export interface Rect { x0: number; y0: number; x1: number; y1: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const wrapAngle = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Pushes a circle out of a rectangle. Returns true if they overlapped. */
export function pushCircleOut(c: { x: number; y: number }, r: number, rect: Rect) {
  const nx = clamp(c.x, rect.x0, rect.x1), ny = clamp(c.y, rect.y0, rect.y1);
  let dx = c.x - nx, dy = c.y - ny, d = Math.hypot(dx, dy);
  if (d >= r) return false;
  if (d < 1e-9) {
    // Centre inside the rectangle: leave through the nearest side.
    const left = c.x - rect.x0, right = rect.x1 - c.x, top = c.y - rect.y0, bottom = rect.y1 - c.y, m = Math.min(left, right, top, bottom);
    if (m === left) c.x = rect.x0 - r; else if (m === right) c.x = rect.x1 + r; else if (m === top) c.y = rect.y0 - r; else c.y = rect.y1 + r;
    return true;
  }
  dx /= d; dy /= d;
  c.x = nx + dx * r; c.y = ny + dy * r;
  return true;
}

export function pointInRect(x: number, y: number, rect: Rect, pad = 0) {
  return x >= rect.x0 - pad && x <= rect.x1 + pad && y >= rect.y0 - pad && y <= rect.y1 + pad;
}

/** True if the segment a→b crosses the rectangle (slab test). */
export function segmentHitsRect(ax: number, ay: number, bx: number, by: number, rect: Rect, pad = 0) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - (rect.x0 - pad)], [dx, rect.x1 + pad - ax], [-dy, ay - (rect.y0 - pad)], [dy, rect.y1 + pad - ay]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

/** Elastic push between two equal circles; returns the overlap that was resolved. */
export function separateCircles(a: { x: number; y: number }, b: { x: number; y: number }, ra: number, rb: number, fallbackAngle = 0) {
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  if (d >= ra + rb) return 0;
  if (d < 1e-9) { dx = Math.cos(fallbackAngle); dy = Math.sin(fallbackAngle); d = 1; } else { dx /= d; dy /= d; }
  const overlap = ra + rb - Math.hypot(b.x - a.x, b.y - a.y);
  a.x -= dx * overlap / 2; a.y -= dy * overlap / 2; b.x += dx * overlap / 2; b.y += dy * overlap / 2;
  return overlap;
}
