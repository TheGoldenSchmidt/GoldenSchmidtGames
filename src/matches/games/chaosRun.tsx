import { useRef } from "react";
import { CR, courseLayout, hammerLow, platformY, wallClosed, type RunGame } from "../../../shared/matches/chaosRun";
import { lerp, playerColor, type MatchClient, type MatchControlsProps, type MatchFrame } from "../client";

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as RunGame, prev = f.prev.game as RunGame, { w, h } = f, layout = courseLayout(g.course);
  const me = g.runners[f.viewer] ?? Object.values(g.runners)[0];
  // Own runner is extrapolated for smooth scrolling; the others are interpolated.
  const ahead = !me.fallen && me.finishAt === undefined && !f.reduced ? me.vx * Math.min(.12, (f.simTime - s.time) / 1000) : 0;
  const camX = me.x + ahead, scale = w / 12, groundY = h * .68, left = camX - 2.6;
  const X = (x: number) => (x - left) * scale, Y = (y: number) => groundY - y * scale, t = f.simTime;
  const sky = ctx.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, "#3b1d64"); sky.addColorStop(1, "#ff86c8");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Gameshow spotlights scroll slowly behind the course.
  ctx.fillStyle = "#ffffff14";
  for (let k = Math.floor(left / 6) - 1; k < left / 6 + 4; k++) { const x = X(k * 6) * .5 + w * .1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 40, groundY); ctx.lineTo(x + 40, groundY); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = "#24133f"; ctx.fillRect(0, groundY, w, h - groundY);
  // Ground with gaps.
  const solid: [number, number][] = [[0, g.length + 4]];
  for (const [a, b] of layout.gaps) for (let i = solid.length - 1; i >= 0; i--) { const [s0, s1] = solid[i]; if (b <= s0 || a >= s1) continue; solid.splice(i, 1, ...([[s0, a], [b, s1]] as [number, number][]).filter(([x0, x1]) => x1 > x0)); }
  for (const [a, b] of solid) { ctx.fillStyle = "#57e4cb"; ctx.fillRect(X(a), groundY, (b - a) * scale, 10); ctx.fillStyle = "#2f8f80"; ctx.fillRect(X(a), groundY + 10, (b - a) * scale, h); }
  for (const [b0, b1] of layout.bridges) for (let x = b0; x < b1; x++) {
    const collapse = me.bridge[String(Math.floor(x - b0))];
    if (collapse !== undefined && t >= collapse) continue;
    ctx.fillStyle = collapse !== undefined ? "#c98b4a" : "#e0a35a"; ctx.fillRect(X(x) + 1, groundY, scale - 2, 8);
  }
  for (const pl of layout.platforms) { const y = platformY(pl.phase, t); ctx.fillStyle = "#ffe44e"; ctx.fillRect(X(pl.x0), Y(y), (pl.x1 - pl.x0) * scale, 10); }
  for (const hm of layout.hammers) {
    const swing = Math.sin(2 * Math.PI * ((t / CR.hammerPeriod + hm.phase) % 1) * 1 - Math.PI / 2 + .6) * (hammerLow(hm.phase, t) ? .25 : 1.1);
    const pivotX = X(hm.x), pivotY = Y(3.6), headX = pivotX + Math.sin(swing) * scale * 3, headY = pivotY + Math.cos(swing) * scale * 3;
    ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(headX, headY); ctx.stroke();
    ctx.fillStyle = hammerLow(hm.phase, t) ? "#e3263b" : "#b23a48"; ctx.fillRect(headX - scale * .6, headY - scale * .45, scale * 1.2, scale * .9);
  }
  for (const wall of layout.walls) { const closed = wallClosed(wall.phase, t); ctx.fillStyle = closed ? "#6544e8" : "#6544e855"; ctx.fillRect(X(wall.x) - scale * .3, Y(closed ? 1.7 : .25), scale * .6, (closed ? 1.7 : .25) * scale); }
  for (const [b0, b1] of layout.beams) {
    ctx.fillStyle = "#ffe44e"; ctx.fillRect(X(b0), Y(1.6), (b1 - b0) * scale, (1.6 - .85) * scale);
    ctx.fillStyle = "#24133f"; for (let x = b0; x < b1; x += .5) ctx.fillRect(X(x), Y(1.6), scale * .25, (1.6 - .85) * scale);
  }
  for (const m of g.course) { ctx.fillStyle = "#fff9ed"; ctx.fillRect(X(m.x0), Y(2), 3, 2 * scale); ctx.fillStyle = "#57e4cb"; ctx.fillRect(X(m.x0) + 3, Y(2), scale * .5, scale * .35); }
  for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? "#fff9ed" : "#24133f"; ctx.fillRect(X(g.length), Y(2.4) + k * scale * .3, scale * .4, scale * .3); }
  for (const p of [...s.players].sort(a => a.id === f.viewer ? 1 : -1)) {
    const r = g.runners[p.id], before = prev.runners?.[p.id];
    if (!r || r.fallen) continue;
    const own = p.id === f.viewer, x = own ? r.x + ahead : before && !before.fallen ? lerp(before.x, r.x, f.alpha) : r.x, y = before && !own ? lerp(before.y, r.y, f.alpha) : r.y;
    const sliding = s.time < r.slideUntil, height = sliding ? CR.slideHeight : CR.height;
    ctx.globalAlpha = own ? 1 : .45;
    ctx.fillStyle = playerColor(p.style);
    ctx.beginPath(); ctx.roundRect(X(x) - CR.width * scale / 2, Y(y + height), CR.width * scale, height * scale, 8); ctx.fill();
    ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(X(x) + scale * .12, Y(y + height) + scale * .2, scale * .08, 0, Math.PI * 2); ctx.fill();
    if (own) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // Progress strip with every runner.
  const barY = 14, barX = 16, barW = w - 32;
  ctx.fillStyle = "#24133fcc"; ctx.beginPath(); ctx.roundRect(barX - 6, barY - 8, barW + 12, 16, 8); ctx.fill();
  for (const p of s.players) {
    const r = g.runners[p.id], k = Math.min(1, r.best / g.length);
    ctx.fillStyle = playerColor(p.style); ctx.beginPath(); ctx.arc(barX + k * barW, barY, p.id === f.viewer ? 7 : 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (me.fallen) { ctx.fillStyle = "#fff9ed"; ctx.font = "900 20px 'Trebuchet MS', sans-serif"; ctx.fillText("Zurück zum Checkpoint …", w / 2, h * .35); }
  if (me.finishAt !== undefined) { ctx.fillStyle = "#ffe44e"; ctx.font = "900 26px 'Trebuchet MS', sans-serif"; ctx.fillText(`Im Ziel! ${(me.finishAt / 1000).toFixed(1)} s`, w / 2, h * .35); }
}

/** Whole-stage gesture: tap jumps (holding jumps higher), swiping down slides. */
function RunControls({ io, active }: MatchControlsProps) {
  const start = useRef<{ id: number; y: number; slid: boolean } | undefined>(undefined);
  const end = () => { start.current = undefined; io.set({ ha: false }, true); };
  return <div className="match-swipe-zone run-gesture" role="group" aria-label="Tippen zum Springen, nach unten wischen zum Rutschen"
    onPointerDown={event => { if (!active || start.current) return; start.current = { id: event.pointerId, y: event.clientY, slid: false }; event.currentTarget.setPointerCapture(event.pointerId); io.set({ ha: true }); io.press("a"); }}
    onPointerMove={event => { const s = start.current; if (!s || s.id !== event.pointerId || s.slid) return; if (event.clientY - s.y > 28) { s.slid = true; io.set({ ha: false }); io.press("b"); } }}
    onPointerUp={end} onPointerCancel={end}>
    <span className="run-hint" aria-hidden="true">Tippen = Sprung · Halten = höher · ↓ wischen = Rutschen</span>
  </div>;
}

export const chaosRunClient: MatchClient = {
  backdrop: "#3b1d64",
  render,
  // 2.5D with rigged characters and a chase camera; the canvas above stays as fallback without WebGL.
  world: async () => {
    const [scene, rig] = await Promise.all([import("../../three/chaosWorld"), import("../../three/riggedFigure")]);
    const chars = await rig.loadCharacterKit();
    return (host, read, onError) => scene.createChaosWorld(host, read, onError, chars);
  },
  banner(view, viewer) {
    const r = (view.game as RunGame).runners[viewer];
    if (!r || view.done) return undefined;
    if (r.finishAt !== undefined) return { title: "Im Ziel!", text: `${(r.finishAt / 1000).toFixed(1)} s` };
    if (r.fallen) return { title: "Abgestürzt!", text: "Zurück zum Checkpoint …" };
    return undefined;
  },
  quiet: ["jump", "slide"],
  Controls: RunControls,
  status(view, viewer) {
    const g = view.game as RunGame, r = g.runners[viewer], left = Math.max(0, Math.ceil((CR.maxMs - view.time) / 1000));
    return `${r ? `${Math.round(r.best / g.length * 100)} % geschafft` : "Zuschauen"} · noch ${left} s`;
  },
  sound(event, viewer) {
    if (!event.ids.includes(viewer)) return event.kind === "finish" ? "score" : undefined;
    if (event.kind === "jump") return "bounce";
    if (event.kind === "hit" || event.kind === "fall") return "fail";
    if (event.kind === "checkpoint") return "tick";
    if (event.kind === "finish") return "win";
    return undefined;
  }
};
