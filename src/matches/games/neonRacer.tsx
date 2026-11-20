import { useEffect, useRef, useState } from "react";
import { NR, TRACK, type Car, type RacerGame, type RacerItem } from "../../../shared/matches/neonRacer";
import type { MatchState } from "../../../shared/matches/types";
import { lerp, playerColor, type MatchClient, type MatchControlsProps, type MatchFrame, type MatchIO } from "../client";
import { useWheelTilt } from "../useWheelTilt";

export const RACER_ICON: Record<RacerItem, string> = { boost: "⚡", gun: "✹", missile: "➹", shield: "⛨" };
const ITEM_NAME: Record<RacerItem, string> = { boost: "Turbo", gun: "Blaster", missile: "Lenkrakete", shield: "Schild" };
const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

/** Track outlines in world units, built once: surface ring (even-odd) and both edges. */
let paths: { surface: Path2D; left: Path2D; right: Path2D; centre: Path2D } | undefined;
function trackPaths() {
  if (paths) return paths;
  const t = TRACK, hw = NR.halfWidth, surface = new Path2D(), left = new Path2D(), right = new Path2D(), centre = new Path2D();
  for (const [path, side] of [[left, -1], [right, 1]] as const) {
    for (let i = 0; i <= t.count; i++) {
      const k = i % t.count, x = t.x[k] - t.ty[k] * hw * side, y = t.y[k] + t.tx[k] * hw * side;
      if (i) { path.lineTo(x, y); surface.lineTo(x, y); } else { path.moveTo(x, y); surface.moveTo(x, y); }
    }
    surface.closePath();
  }
  for (let i = 0; i <= t.count; i++) { const k = i % t.count; if (i) centre.lineTo(t.x[k], t.y[k]); else centre.moveTo(t.x[k], t.y[k]); }
  paths = { surface, left, right, centre };
  return paths;
}

interface RacerLocal { camA?: number; camT?: number; trails?: Record<string, [number, number][]>; smoke?: Record<number, [number, number][]>; wrongSince?: number }

function carPose(c: Car, before: Car | undefined, alpha: number) {
  if (!before || Math.hypot(before.x - c.x, before.y - c.y) > 4) return { x: c.x, y: c.y, a: c.a };
  return { x: lerp(before.x, c.x, alpha), y: lerp(before.y, c.y, alpha), a: angleLerp(before.a, c.a, alpha) };
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, own: boolean, c: Car, simTime: number, reduced: boolean, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  if (simTime < c.boostUntil) {
    // Turbo flame behind the car.
    const flick = reduced ? 1 : .8 + Math.abs(Math.sin(t / 40)) * .5;
    ctx.fillStyle = "#ffa04acc"; ctx.beginPath(); ctx.moveTo(-.9, -.32); ctx.lineTo(-.9 - 1.1 * flick, 0); ctx.lineTo(-.9, .32); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = color + "40"; ctx.beginPath(); ctx.roundRect(-1.15, -.72, 2.3, 1.44, .5); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-.9, -.5, 1.8, 1, .32); ctx.fill();
  ctx.fillStyle = "#120a22"; ctx.beginPath(); ctx.roundRect(.05, -.36, .5, .72, .14); ctx.fill();
  ctx.fillStyle = "#fff9ed"; ctx.fillRect(.78, -.42, .12, .2); ctx.fillRect(.78, .22, .12, .2);
  if (own) { ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = .12; ctx.beginPath(); ctx.roundRect(-.9, -.5, 1.8, 1, .32); ctx.stroke(); }
  ctx.restore();
  if (simTime < c.shieldUntil) { ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = .14; ctx.globalAlpha = reduced ? .9 : .6 + Math.sin(t / 120) * .3; ctx.beginPath(); ctx.arc(x, y, 1.25, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
}

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as RacerGame, prev = f.prev.game as RacerGame, { w, h } = f, local = f.local as RacerLocal;
  const viewerCar = g.cars[f.viewer] ?? Object.values(g.cars)[0];
  const me = carPose(viewerCar, prev.cars?.[viewerCar.id], f.alpha);
  // Camera behind the own car, nose up; it turns smoothly (instantly with reduced motion).
  const dt = Math.min(.1, Math.max(0, (f.t - (local.camT ?? f.t)) / 1000)); local.camT = f.t;
  local.camA = local.camA === undefined || f.reduced ? me.a : angleLerp(local.camA, me.a, 1 - Math.exp(-dt * 5));
  const landscape = w > h, k = landscape ? h / 15 : w / 22, focusY = landscape ? h * .62 : h * .6;
  ctx.fillStyle = "#07051a"; ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, focusY); ctx.rotate(-(local.camA + Math.PI / 2)); ctx.scale(k, k); ctx.translate(-me.x, -me.y);
  // Grid around the camera.
  const reach = Math.hypot(w, h) / k * .75;
  ctx.strokeStyle = "#1f1650"; ctx.lineWidth = 1 / k;
  for (let gx = Math.floor((me.x - reach) / 4) * 4; gx < me.x + reach; gx += 4) { ctx.beginPath(); ctx.moveTo(gx, me.y - reach); ctx.lineTo(gx, me.y + reach); ctx.stroke(); }
  for (let gy = Math.floor((me.y - reach) / 4) * 4; gy < me.y + reach; gy += 4) { ctx.beginPath(); ctx.moveTo(me.x - reach, gy); ctx.lineTo(me.x + reach, gy); ctx.stroke(); }
  const p = trackPaths();
  ctx.fillStyle = "#1b1440"; ctx.fill(p.surface, "evenodd");
  ctx.setLineDash([1.2, 1.6]); ctx.strokeStyle = "#57e4cb30"; ctx.lineWidth = .12; ctx.stroke(p.centre); ctx.setLineDash([]);
  ctx.lineWidth = .28; ctx.strokeStyle = "#ff86c8"; ctx.stroke(p.left); ctx.strokeStyle = "#57e4cb"; ctx.stroke(p.right);
  // Checkered start and finish line across the track.
  {
    const t = TRACK, nx = -t.ty[0], ny = t.tx[0];
    for (let i = -6; i < 6; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#fff9ed" : "#24133f";
      const ox = t.x[0] + nx * (i + .5) * NR.halfWidth / 6 + t.tx[0] * (j - 1) * .55, oy = t.y[0] + ny * (i + .5) * NR.halfWidth / 6 + t.ty[0] * (j - 1) * .55;
      ctx.fillRect(ox - .3, oy - .3, .6, .6);
    }
  }
  // Item boxes: spinning and glowing while ready.
  for (const box of g.boxes) {
    const ready = f.simTime >= box.readyAt;
    ctx.save(); ctx.translate(box.x, box.y); ctx.rotate(f.reduced ? .6 : f.t / 500 + box.id);
    if (ready) { ctx.fillStyle = "#6544e8"; ctx.fillRect(-.48, -.48, .96, .96); ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = .1; ctx.strokeRect(-.48, -.48, .96, .96); ctx.fillStyle = "#ffe44e"; ctx.font = "900 .7px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", 0, .04); }
    else { ctx.strokeStyle = "#6544e866"; ctx.lineWidth = .06; ctx.strokeRect(-.4, -.4, .8, .8); }
    ctx.restore();
  }
  // Light trails behind every car (the neon look of Light Trails).
  local.trails ??= {};
  const poses: Record<string, { x: number; y: number; a: number }> = {};
  for (const pl of s.players) {
    const c = g.cars[pl.id]; if (!c) continue;
    const pose = poses[pl.id] = carPose(c, prev.cars?.[pl.id], f.alpha), trail = local.trails[pl.id] ??= [];
    const last = trail.at(-1);
    if (!f.reduced && (!last || Math.hypot(last[0] - pose.x, last[1] - pose.y) > .35)) { trail.push([pose.x, pose.y]); if (trail.length > 22) trail.shift(); }
    if (last && Math.hypot(last[0] - pose.x, last[1] - pose.y) > 5) trail.length = 0;
    const color = playerColor(pl.style);
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i++) {
      ctx.strokeStyle = color; ctx.globalAlpha = i / trail.length * .55; ctx.lineWidth = .18 + i / trail.length * .3;
      ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // Shots and missiles (missiles leave smoke).
  local.smoke ??= {};
  for (const shot of g.shots) {
    const before = prev.shots?.find(q => q.id === shot.id), x = before ? lerp(before.x, shot.x, f.alpha) : shot.x, y = before ? lerp(before.y, shot.y, f.alpha) : shot.y;
    if (shot.kind === "shot") {
      ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = .16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(shot.a) * .9, y - Math.sin(shot.a) * .9); ctx.stroke();
      ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(x, y, .18, 0, Math.PI * 2); ctx.fill();
    } else {
      const smoke = local.smoke[shot.id] ??= [];
      if (!f.reduced) { smoke.push([x, y]); if (smoke.length > 14) smoke.shift(); }
      smoke.forEach(([sx, sy], i) => { ctx.fillStyle = `rgba(255,249,237,${i / smoke.length * .3})`; ctx.beginPath(); ctx.arc(sx, sy, .15 + (smoke.length - i) * .02, 0, Math.PI * 2); ctx.fill(); });
      ctx.save(); ctx.translate(x, y); ctx.rotate(shot.a); ctx.fillStyle = "#ffa04a"; ctx.beginPath(); ctx.moveTo(.5, 0); ctx.lineTo(-.35, -.25); ctx.lineTo(-.2, 0); ctx.lineTo(-.35, .25); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  for (const id of Object.keys(local.smoke)) if (!g.shots.some(q => q.id === Number(id))) delete local.smoke[Number(id)];
  // Cars, the own one last (on top).
  for (const pl of [...s.players].sort((a, b) => Number(a.id === f.viewer) - Number(b.id === f.viewer))) {
    const c = g.cars[pl.id], pose = poses[pl.id]; if (!c || !pose) continue;
    ctx.globalAlpha = pl.gone ? .35 : 1;
    drawCar(ctx, pose.x, pose.y, pose.a, playerColor(pl.style), pl.id === f.viewer, c, f.simTime, f.reduced, f.t);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Minimap: whole circuit with every car as a dot.
  const t = TRACK, minX = Math.min(...t.x), maxX = Math.max(...t.x), minY = Math.min(...t.y), maxY = Math.max(...t.y);
  const mw = landscape ? 86 : 70, mh = mw * (maxY - minY) / (maxX - minX), ms = mw / (maxX - minX), mx0 = w - mw - 10, my0 = f.top + 10;
  ctx.fillStyle = "#07051acc"; ctx.beginPath(); ctx.roundRect(mx0 - 6, my0 - 6, mw + 12, mh + 12, 10); ctx.fill();
  ctx.save(); ctx.translate(mx0 - minX * ms, my0 - minY * ms); ctx.scale(ms, ms);
  ctx.strokeStyle = "#57e4cb88"; ctx.lineWidth = 2.6 / ms * .9; ctx.stroke(p.centre);
  for (const pl of s.players) { const pose = poses[pl.id]; if (!pose) continue; ctx.fillStyle = playerColor(pl.style); ctx.beginPath(); ctx.arc(pose.x, pose.y, (pl.id === f.viewer ? 4.2 : 3) / ms, 0, Math.PI * 2); ctx.fill(); if (pl.id === f.viewer) { ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 1.2 / ms; ctx.stroke(); } }
  ctx.restore();

  // Place and lap, and a hint when driving the wrong way.
  const own = g.cars[f.viewer];
  if (own) {
    const place = 1 + Object.values(g.cars).filter(c => c.id !== own.id && (c.finishAt !== undefined ? own.finishAt === undefined || c.finishAt < own.finishAt : own.finishAt === undefined && c.prog > own.prog)).length;
    const lap = Math.max(1, Math.min(NR.laps, Math.floor(own.prog / TRACK.length) + 1));
    const by = f.top + 10;
    ctx.fillStyle = "#07051acc"; ctx.beginPath(); ctx.roundRect(10, by, 104, 52, 12); ctx.fill();
    ctx.fillStyle = "#ffe44e"; ctx.font = "900 30px 'Trebuchet MS', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(`${place}.`, 18, by + 27);
    ctx.fillStyle = "#fff9ed"; ctx.font = "800 12px 'Trebuchet MS', sans-serif"; ctx.fillText(`von ${s.players.length}`, 56, by + 20); ctx.fillText(own.finishAt !== undefined ? "Im Ziel" : `Runde ${lap}/${NR.laps}`, 56, by + 36);
    const seg = own.seg, along = Math.cos(own.a) * TRACK.tx[seg] + Math.sin(own.a) * TRACK.ty[seg];
    if (along < -.3 && own.v > 2 && own.finishAt === undefined) local.wrongSince ??= f.t; else local.wrongSince = undefined;
    if (local.wrongSince !== undefined && f.t - local.wrongSince > 900) {
      ctx.fillStyle = "#ff86c8"; ctx.font = "900 20px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText("Falsche Richtung!", w / 2, f.top + 90);
    }
    if (f.simTime < own.spinUntil) { ctx.fillStyle = "#ffe44e"; ctx.font = "900 18px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText("Schleudern!", w / 2, f.top + 116); }
  }
}

/** Hold-to-press pedal; reports pressed state while a finger is on it. */
function Pedal({ label, className, disabled, onChange }: { label: string; className: string; disabled: boolean; onChange: (down: boolean) => void }) {
  const [down, setDown] = useState(false), pointer = useRef<number | undefined>(undefined);
  const release = () => { if (pointer.current === undefined) return; pointer.current = undefined; setDown(false); onChange(false); };
  useEffect(() => { if (disabled) release(); }, [disabled]);
  return <button type="button" className={`racer-pedal ${className} ${down ? "is-down" : ""}`} aria-label={label} aria-pressed={down} disabled={disabled}
    onPointerDown={event => { if (pointer.current !== undefined) return; pointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); setDown(true); onChange(true); }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onClick={event => { if (event.detail === 0) { onChange(true); window.setTimeout(() => onChange(false), 300); } }}>
    <span>{label}</span>
  </button>;
}

/** Steering wheel: grab anywhere and turn it; it springs back when released (±120° = full lock). */
const LOCK = 120 * Math.PI / 180;
function Wheel({ disabled, onSteer }: { disabled: boolean; onSteer: (x: number) => void }) {
  const [turn, setTurn] = useState(0), grab = useRef<{ id: number; from: number; start: number } | undefined>(undefined);
  const angleOf = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect(), dx = event.clientX - box.left - box.width / 2, dy = event.clientY - box.top - box.height / 2;
    return Math.hypot(dx, dy) < 10 ? undefined : Math.atan2(dx, -dy);
  };
  const release = () => { grab.current = undefined; setTurn(0); onSteer(0); };
  useEffect(() => { if (disabled) release(); }, [disabled]);
  return <div className={`racer-wheel ${disabled ? "is-disabled" : ""}`} role="slider" aria-label="Lenkrad" aria-valuemin={-1} aria-valuemax={1} aria-valuenow={Math.round(turn / LOCK * 100) / 100}
    onPointerDown={event => { if (disabled || grab.current) return; const a = angleOf(event) ?? 0; grab.current = { id: event.pointerId, from: a, start: turn }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerMove={event => {
      const g = grab.current, a = angleOf(event);
      if (!g || g.id !== event.pointerId || a === undefined) return;
      const next = Math.max(-LOCK, Math.min(LOCK, g.start + Math.atan2(Math.sin(a - g.from), Math.cos(a - g.from))));
      // Keep turning past the lock smoothly by moving the grab point along.
      if (Math.abs(next) >= LOCK) { g.from = a; g.start = next; }
      setTurn(next); onSteer(next / LOCK);
    }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <svg viewBox="-60 -60 120 120" style={{ transform: `rotate(${turn}rad)` }} aria-hidden="true">
      <circle r="52" fill="none" stroke="#24133f" strokeWidth="14" />
      <circle r="52" fill="none" stroke="#57e4cb" strokeWidth="8" />
      <path d="M-46 6 L-12 10 L0 24 L12 10 L46 6" fill="none" stroke="#57e4cb" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle r="13" fill="#24133f" stroke="#ffe44e" strokeWidth="4" />
      <rect x="-4" y="-58" width="8" height="12" rx="3" fill="#ffe44e" />
    </svg>
  </div>;
}

function ItemButton({ io, car, disabled }: { io: MatchIO; car?: Car; disabled: boolean }) {
  const item = car?.item;
  return <button type="button" className={`racer-item ${item ? "is-ready" : ""}`} aria-label={item ? `Item einsetzen: ${ITEM_NAME[item]}` : "Kein Item"} disabled={disabled || !item}
    onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); io.press("a"); }}
    onClick={event => { if (event.detail === 0) io.press("a"); }}>
    <b aria-hidden="true">{item ? RACER_ICON[item] : "?"}</b>
    <span>{item ? `${ITEM_NAME[item]}${item === "gun" && car?.ammo ? ` ×${car.ammo}` : ""}` : "Item"}</span>
  </button>;
}

function racing(view: MatchState, viewer: string, active: boolean) {
  const car = (view.game as RacerGame).cars[viewer];
  return { car, off: !active || !car || car.finishAt !== undefined };
}

function RacerControls({ io, view, viewer, active }: MatchControlsProps) {
  const { car, off } = racing(view, viewer, active);
  return <>
    <Wheel disabled={off} onSteer={x => io.set({ x }, true)} />
    <div className="racer-right">
      <ItemButton io={io} car={car} disabled={off} />
      <div className="racer-pedals">
        <Pedal label="Bremse" className="racer-pedal--brake" disabled={off} onChange={down => io.set({ hb: down }, true)} />
        <Pedal label="Gas" className="racer-pedal--gas" disabled={off} onChange={down => io.set({ ha: down }, true)} />
      </div>
    </div>
  </>;
}

/** Landscape: tilt steers; left half brakes, right half accelerates; item at the top. */
function TiltControls({ io, view, viewer, active }: MatchControlsProps) {
  const { car, off } = racing(view, viewer, active);
  const last = useRef(0);
  // In portrait the game is turned by 90° (see CSS), so the phone is held as in landscape.
  const tilt = useWheelTilt(x => { if (off) return; if (Math.abs(x - last.current) > .03 || (x === 0) !== (last.current === 0)) { last.current = x; io.set({ x }, true); } },
    () => window.matchMedia("(orientation: portrait)").matches ? 90 : 0);
  const keys = useRef({ left: false, right: false });
  const fallback = tilt.status === "denied" || tilt.status === "missing" || tilt.status === "insecure";
  useEffect(() => { if (off) { last.current = 0; io.set({ x: 0 }); } }, [off]);
  return <>
    <Pedal label="Bremse" className="racer-zone racer-zone--brake" disabled={off} onChange={down => io.set({ hb: down }, true)} />
    <Pedal label="Gas" className="racer-zone racer-zone--gas" disabled={off} onChange={down => io.set({ ha: down }, true)} />
    <div className="racer-tilt-top">
      <ItemButton io={io} car={car} disabled={off} />
      {tilt.status === "off" || tilt.status === "asking" ? <button type="button" className="racer-chip" onClick={() => void tilt.enable()}>Bewegungssteuerung starten</button>
        : tilt.status === "active" || tilt.status === "waiting" ? <button type="button" className="racer-chip" onClick={tilt.calibrate}>Lenkrad ausrichten</button>
        : <span className="racer-chip" role="status">{tilt.message}</span>}
    </div>
    {fallback && <div className="racer-steer-buttons">
      {([-1, 1] as const).map(dir => <Pedal key={dir} label={dir < 0 ? "Links lenken" : "Rechts lenken"} className="racer-steer" disabled={off}
        onChange={down => { keys.current[dir < 0 ? "left" : "right"] = down; io.set({ x: Number(keys.current.right) - Number(keys.current.left) }, true); }} />)}
    </div>}
  </>;
}

const common: Omit<MatchClient, "Controls"> = {
  render,
  // The circuit runs under the HUD; place and minimap sit below it.
  fullBleed: true,
  unit: "%",
  quiet: ["wall", "item", "shot"],
  status(view, viewer) {
    const g = view.game as RacerGame, me = g.cars[viewer], left = Math.max(0, Math.ceil(((g.firstFinish !== undefined ? g.firstFinish + NR.finishGrace : NR.maxMs) - view.time) / 1000));
    if (!me) return `noch ${left} s`;
    const lap = Math.max(1, Math.min(NR.laps, Math.floor(me.prog / TRACK.length) + 1));
    return `${me.finishAt !== undefined ? "Im Ziel" : `Runde ${lap}/${NR.laps}`} · ${me.item ? `Item: ${ITEM_NAME[me.item]}` : "kein Item"} · noch ${left} s`;
  },
  sound(event, viewer) {
    if (event.kind === "hit") return event.ids[0] === viewer ? "fail" : event.ids[1] === viewer ? "hit" : undefined;
    if (event.kind === "block") return event.ids[0] === viewer ? "power" : undefined;
    if (event.kind === "item" || event.kind === "boost" || event.kind === "shield") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "shot" || event.kind === "missile") return event.ids.includes(viewer) ? "shot" : undefined;
    if (event.kind === "wall") return event.ids.includes(viewer) ? "bounce" : undefined;
    if (event.kind === "finish") return event.ids.includes(viewer) ? "win" : "tick";
    return undefined;
  }
};
export const neonRacerClient: MatchClient = { ...common, Controls: RacerControls };
export const neonRacerTiltClient: MatchClient = { ...common, Controls: TiltControls };
