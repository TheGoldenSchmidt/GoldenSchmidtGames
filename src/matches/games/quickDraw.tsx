import type { QuickDrawGame, QuickDrawRound } from "../../../shared/matches/quickDraw";
import type { MatchState } from "../../../shared/matches/types";
import { TapZone } from "../controls";
import { playerColor, type MatchClient, type MatchFrame } from "../client";

const round = (s: MatchState) => (s.game as QuickDrawGame).rounds.at(-1)!;
const shownKey = (r: QuickDrawRound) => `qd-signal-${r.index}`;
const tapKey = (r: QuickDrawRound) => `qd-tap-${r.index}`;

function cowboy(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, pose: "idle" | "draw" | "down") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.fillStyle = "#2a1636";
  // Body, legs and the coloured poncho identify each player.
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-6, -26); ctx.lineTo(6, -26); ctx.lineTo(9, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-13, -24); ctx.lineTo(13, -24); ctx.lineTo(9, -42); ctx.lineTo(-9, -42); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#2a1636";
  ctx.beginPath(); ctx.arc(0, -48, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(-15, -55, 30, 3.5);
  ctx.beginPath(); ctx.moveTo(-8, -54); ctx.quadraticCurveTo(0, -68, 8, -54); ctx.fill();
  ctx.strokeStyle = "#2a1636"; ctx.lineWidth = 4; ctx.lineCap = "round";
  if (pose === "draw") {
    ctx.beginPath(); ctx.moveTo(10, -36); ctx.lineTo(22, -38); ctx.stroke();
    ctx.fillStyle = "#ffe44e"; ctx.beginPath(); ctx.arc(27, -38, 5, 0, Math.PI * 2); ctx.fill();
  } else if (pose === "down") {
    ctx.beginPath(); ctx.moveTo(10, -36); ctx.lineTo(14, -20); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(10, -36); ctx.lineTo(12, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, -36); ctx.lineTo(-12, -22); ctx.stroke();
  }
  ctx.restore();
}

function scene(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, flash: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#3b1d64"); sky.addColorStop(.55, "#c4486a"); sky.addColorStop(1, "#ffb15a");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.arc(w * .5, horizon - 6, Math.min(w, h) * .11, Math.PI, 0); ctx.fill();
  // Saloon facades frame the street on both sides.
  ctx.fillStyle = "#4a2440";
  for (const side of [0, 1]) {
    const x0 = side ? w * .78 : 0, x1 = side ? w : w * .22;
    ctx.fillRect(x0, horizon - h * .16, x1 - x0, h * .16);
    ctx.fillRect(side ? x0 + 8 : x0, horizon - h * .21, (x1 - x0) * .7, h * .06);
  }
  const ground = ctx.createLinearGradient(0, horizon, 0, h);
  ground.addColorStop(0, "#d9894f"); ground.addColorStop(1, "#7d3f2c");
  ctx.fillStyle = ground; ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = "#ffffff22"; ctx.lineWidth = 2;
  for (const t of [-.6, -.25, .25, .6]) { ctx.beginPath(); ctx.moveTo(w * .5 + t * w * .08, horizon); ctx.lineTo(w * .5 + t * w * 1.2, h); ctx.stroke(); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * .55})`; ctx.fillRect(0, 0, w, h); }
}

function decoy(ctx: CanvasRenderingContext2D, kind: string, progress: number, w: number, horizon: number) {
  if (kind === "crow") {
    const x = -40 + progress * (w + 80), y = horizon * .35 + Math.sin(progress * 12) * 8;
    ctx.fillStyle = "#1b0f22"; ctx.beginPath(); ctx.ellipse(x, y, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    const wing = Math.sin(progress * 40) * 9;
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 18, y - wing); ctx.lineTo(x + 2, y - 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 18, y - wing); ctx.lineTo(x + 6, y - 2); ctx.fill();
  } else if (kind === "lamp") {
    const on = progress < .8 && Math.floor(progress * 8) % 2 === 0;
    ctx.fillStyle = on ? "#ff6a3d" : "#6b3a2a";
    ctx.beginPath(); ctx.arc(w * .14, horizon - 40, 10, 0, Math.PI * 2); ctx.fill();
    if (on) { ctx.fillStyle = "#ff6a3d55"; ctx.beginPath(); ctx.arc(w * .14, horizon - 40, 30, 0, Math.PI * 2); ctx.fill(); }
  } else {
    const drop = Math.min(1, progress * 3);
    ctx.save(); ctx.translate(w / 2, horizon * .3 * drop);
    ctx.fillStyle = "#a76a3c"; ctx.fillRect(-70, -22, 140, 44);
    ctx.strokeStyle = "#4a2440"; ctx.lineWidth = 3; ctx.strokeRect(-70, -22, 140, 44);
    ctx.fillStyle = "#ffe44e"; ctx.font = "900 22px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("WARTE …", 0, 2); ctx.restore();
  }
}

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as QuickDrawGame, r = round(s), { w, h } = f;
  const horizon = h * .46;
  const signal = r.signalAt !== undefined;
  if (signal && f.local[shownKey(r)] === undefined) f.local[shownKey(r)] = f.t;
  const sinceSignal = signal ? f.t - f.local[shownKey(r)] : -1;
  scene(ctx, w, h, horizon, signal && !f.reduced && sinceSignal < 160 ? 1 - sinceSignal / 160 : 0);
  for (const d of r.decoys) { const p = (s.time - d.at) / 600; if (p >= 0 && p <= 1 && r.resolvedAt === undefined) decoy(ctx, d.kind, p, w, horizon); }
  const others = s.players.filter(p => p.id !== f.viewer && r.participants.includes(p.id));
  const size = Math.min(1.35, w / Math.max(2, others.length) / 46);
  others.forEach((p, i) => {
    const x = w * (others.length === 1 ? .5 : .14 + i * .72 / (others.length - 1)), y = horizon + h * .1;
    const shot = r.shots[p.id], pose = shot?.early ? "down" : shot ? "draw" : "idle";
    cowboy(ctx, x, y, size, playerColor(p.style), pose);
    ctx.textAlign = "center"; ctx.font = "800 12px 'Trebuchet MS', sans-serif"; ctx.fillStyle = "#fff9ed";
    ctx.fillText(f.names[p.id] ?? "", x, y + 16);
    if (r.resolvedAt !== undefined) {
      ctx.font = "900 13px 'Trebuchet MS', sans-serif";
      ctx.fillStyle = shot?.early ? "#ff8a8a" : "#ffe44e";
      ctx.fillText(shot?.early ? "Fehlstart" : shot?.reaction != null ? `${shot.reaction} ms` : "—", x, y + 32);
      if (r.points[p.id]) ctx.fillText(`+${r.points[p.id]}`, x, y - 60 * size - 12);
    }
  });
  // Own revolver hand in the foreground.
  const me = s.players.find(p => p.id === f.viewer);
  if (me) {
    const mine = r.shots[me.id], tapped = f.local[tapKey(r)] !== undefined || !!mine;
    ctx.save(); ctx.translate(w * .74, h * .86);
    ctx.fillStyle = playerColor(me.style); ctx.fillRect(-14, -8, 60, 30);
    ctx.fillStyle = "#2a1636"; ctx.fillRect(18, tapped ? -48 : -24, 18, 36); ctx.fillRect(tapped ? 6 : 26, tapped ? -60 : -30, tapped ? 46 : 10, 12);
    if (tapped && !(mine?.early) && f.t - (f.local[tapKey(r)] ?? 0) < 140 && !f.reduced) { ctx.fillStyle = "#ffe44e"; ctx.beginPath(); ctx.arc(-2, -54, 16, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (r.resolvedAt === undefined && signal) {
    const pulse = f.reduced ? 1 : 1 + Math.max(0, .25 - sinceSignal / 800);
    ctx.save(); ctx.translate(w / 2, horizon * .5); ctx.scale(pulse, pulse);
    ctx.fillStyle = "#e3263b"; ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(-110, -38, 220, 76, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff9ed"; ctx.font = "900 48px 'Trebuchet MS', sans-serif"; ctx.fillText("ZIEH!", 0, 3);
    ctx.restore();
  } else if (r.resolvedAt === undefined) {
    ctx.fillStyle = "#fff9edcc"; ctx.font = "800 17px 'Trebuchet MS', sans-serif";
    ctx.fillText(me && r.shots[me.id]?.early ? "Fehlstart – warte auf die Nächste" : "Ruhig … noch nicht ziehen", w / 2, h * .66);
  } else if (me) {
    const mine = r.shots[me.id], points = r.points[me.id] ?? 0, won = r.winners.includes(me.id);
    ctx.fillStyle = "#24133fcc"; ctx.beginPath(); ctx.roundRect(w / 2 - 130, h * .6 - 34, 260, 68, 14); ctx.fill();
    ctx.fillStyle = won ? "#ffe44e" : "#fff9ed"; ctx.font = "900 22px 'Trebuchet MS', sans-serif";
    const label = !r.participants.includes(me.id) ? "Du schaust beim Stechen zu" : mine?.early ? "Fehlstart!" : mine?.reaction != null ? `${mine.reaction} ms${points ? ` · +${points}` : ""}` : "Nicht gezogen";
    ctx.fillText(won && g.mode !== "group" ? `Gewonnen! ${label}` : label, w / 2, h * .6);
  }
}

export const quickDrawClient: MatchClient = {
  render,
  quiet: ["signal", "decoy", "shot"],
  Controls({ io, view, active }) {
    const r = round(view);
    return <TapZone className="qd-tap" label="Ziehen und schießen" disabled={!active || r.resolvedAt !== undefined || io.local[tapKey(r)] !== undefined}
      onTap={event => {
        const shown = io.local[shownKey(r)], at = event.timeStamp || performance.now();
        io.local[tapKey(r)] = performance.now();
        io.command(shown === undefined ? -1 : Math.max(0, Math.round(at - shown)));
      }}>
      <span className="qd-tap-hint">Tippen zum Ziehen</span>
    </TapZone>;
  },
  status(view) {
    const g = view.game as QuickDrawGame, r = round(view);
    if (r.kind === "tiebreak") return "Stechen um den Sieg";
    return g.mode === "duel" ? `Duell · Runde ${r.index} · 3 Siege gewinnen` : `Durchgang ${g.rounds.filter(x => x.kind === "group").length} von 5`;
  },
  sound(event, viewer) {
    if (event.kind === "signal") return "go";
    if (event.kind === "shot") return "shot";
    if (event.kind === "false") return event.ids.includes(viewer) ? "fail" : undefined;
    if (event.kind === "result") return event.ids.includes(viewer) ? "win" : "tick";
    if (event.kind === "round") return "tick";
    return undefined;
  }
};
