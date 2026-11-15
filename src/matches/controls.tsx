import { useRef, useState, type ReactNode } from "react";

/**
 * Shared touch controls for all match games. Every control works with
 * pointer events (touch first) and keeps targets at least 44 CSS px.
 */

/** Large area that reacts on finger down, not on release, for reaction games. */
export function TapZone({ onTap, label, disabled, children, className = "" }: { onTap: (event: React.PointerEvent) => void; label: string; disabled?: boolean; children?: ReactNode; className?: string }) {
  return <button type="button" className={`match-tap-zone ${className}`} aria-label={label} disabled={disabled}
    onPointerDown={event => { if (disabled) return; event.preventDefault(); onTap(event); }}
    onClick={event => { if (event.detail === 0 && !disabled) onTap(event as unknown as React.PointerEvent); }}>
    {children}
  </button>;
}

/** Analog stick; reports a vector with length ≤ 1. */
export function Stick({ onMove, disabled, label = "Bewegungsstick" }: { onMove: (x: number, y: number) => void; disabled?: boolean; label?: string }) {
  const pointer = useRef<number | undefined>(undefined), [knob, setKnob] = useState({ x: 0, y: 0 });
  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current) return;
    const box = event.currentTarget.getBoundingClientRect(), radius = box.width / 2 - 17;
    let x = (event.clientX - box.left - box.width / 2) / radius, y = (event.clientY - box.top - box.height / 2) / radius;
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    setKnob({ x, y }); onMove(x, y);
  };
  const release = () => { pointer.current = undefined; setKnob({ x: 0, y: 0 }); onMove(0, 0); };
  return <div className={`match-stick ${disabled ? "is-disabled" : ""}`} role="group" aria-label={label}
    onPointerDown={event => { if (disabled || pointer.current !== undefined) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={update} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <i style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
  </div>;
}

/** Round action button; `charge` (0…1) draws a cooldown ring. */
export function ActionButton({ icon, label, onPress, onRelease, disabled, charge = 1, tone = "gold" }: { icon: string; label: string; onPress: () => void; onRelease?: () => void; disabled?: boolean; charge?: number; tone?: "gold" | "pink" | "cyan" }) {
  return <button type="button" className={`match-action match-action--${tone} ${charge < 1 ? "is-cooling" : ""}`} aria-label={label} disabled={disabled}
    style={{ ["--charge" as string]: `${Math.round(Math.max(0, Math.min(1, charge)) * 360)}deg` }}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); onPress(); }}
    onPointerUp={() => onRelease?.()} onPointerCancel={() => onRelease?.()} onLostPointerCapture={() => onRelease?.()}
    onClick={event => { if (event.detail === 0) { onPress(); onRelease?.(); } }}>
    <b aria-hidden="true">{icon}</b><span>{label}</span>
  </button>;
}

export type SwipeDirection = 0 | 1 | 2 | 3;
/** Detects one swipe per touch: 0 up, 1 right, 2 down, 3 left. */
export function SwipeZone({ onSwipe, label, children, className = "" }: { onSwipe: (direction: SwipeDirection) => void; label: string; children?: ReactNode; className?: string }) {
  const start = useRef<{ id: number; x: number; y: number; fired: boolean } | undefined>(undefined);
  return <div className={`match-swipe-zone ${className}`} role="group" aria-label={label}
    onPointerDown={event => { start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, fired: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      const s = start.current;
      if (!s || s.id !== event.pointerId || s.fired) return;
      const dx = event.clientX - s.x, dy = event.clientY - s.y;
      if (Math.hypot(dx, dy) < 22) return;
      s.fired = true;
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }}
    onPointerUp={() => { start.current = undefined; }} onPointerCancel={() => { start.current = undefined; }}>
    {children}
  </div>;
}

/** Absolute horizontal slider across the full width: finger position → -1…1. */
export function SliderPad({ onMove, onRelease, label, children, className = "" }: { onMove: (x: number) => void; onRelease?: () => void; label: string; children?: ReactNode; className?: string }) {
  const pointer = useRef<number | undefined>(undefined);
  const update = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointer.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    onMove(Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1)));
  };
  const end = (event: React.PointerEvent) => { if (event.pointerId !== pointer.current) return; pointer.current = undefined; onRelease?.(); };
  return <div className={`match-slider ${className}`} role="slider" aria-label={label} aria-valuemin={-1} aria-valuemax={1}
    onPointerDown={event => { pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); update(event); }}
    onPointerMove={update} onPointerUp={end} onPointerCancel={() => { pointer.current = undefined; }}>
    {children}
  </div>;
}

/** Drag from the touch point to aim; reports a vector up to length 1 and the release. */
export function AimPad({ onAim, onRelease, label, radius = 90, children, className = "" }: { onAim: (x: number, y: number) => void; onRelease?: (x: number, y: number) => void; label: string; radius?: number; children?: ReactNode; className?: string }) {
  const start = useRef<{ id: number; x: number; y: number; ax: number; ay: number } | undefined>(undefined);
  const vector = (event: React.PointerEvent) => {
    const s = start.current!;
    let x = (event.clientX - s.x) / radius, y = (event.clientY - s.y) / radius;
    const length = Math.max(1, Math.hypot(x, y)); x /= length; y /= length;
    s.ax = x; s.ay = y; return [x, y] as const;
  };
  const end = (event: React.PointerEvent) => { const s = start.current; if (!s || s.id !== event.pointerId) return; start.current = undefined; onRelease?.(s.ax, s.ay); };
  return <div className={`match-aim-pad ${className}`} role="group" aria-label={label}
    onPointerDown={event => { if (start.current) return; start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, ax: 0, ay: 0 }; event.currentTarget.setPointerCapture(event.pointerId); onAim(0, 0); }}
    onPointerMove={event => { if (start.current?.id === event.pointerId) onAim(...vector(event)); }}
    onPointerUp={end} onPointerCancel={end}>
    {children}
  </div>;
}

const CAMERA_HINT = "gsg-camera-swipe-seen";
/**
 * Horizontal swipe area that turns a chase camera (writes `camTurn` into the
 * match IO's local values). Place it before the other controls so stick and
 * buttons stay on top. A short hint shows until the first swipe on this device.
 */
export function CameraSwipe({ local, className = "" }: { local: Record<string, number>; className?: string }) {
  const start = useRef<{ id: number; x: number } | undefined>(undefined);
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem(CAMERA_HINT) === "1"; } catch { return false; } });
  const move = (event: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    // About 140° for a swipe across a phone screen; swipe left turns the view left.
    local.camTurn = (local.camTurn ?? 0) + (event.clientX - s.x) * .008;
    s.x = event.clientX;
    if (!seen) { setSeen(true); try { localStorage.setItem(CAMERA_HINT, "1"); } catch { /* private mode */ } }
  };
  return <div className={`match-camera-swipe ${className}`} role="group" aria-label="Kamera drehen: waagrecht wischen"
    onPointerDown={event => { if (start.current) return; start.current = { id: event.pointerId, x: event.clientX }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={move} onPointerUp={() => { start.current = undefined; }} onPointerCancel={() => { start.current = undefined; }}>
    {!seen && <span className="match-camera-hint" aria-hidden="true">↔ wischen: Kamera drehen</span>}
  </div>;
}
