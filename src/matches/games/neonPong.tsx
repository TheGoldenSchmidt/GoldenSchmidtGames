import { NP, type PongGame } from "../../../shared/matches/neonPong";
import { SliderPad } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

const POWER_ICON = { wide: "↔", multi: "⁂", curve: "↝", slow: "◔" } as const;

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as PongGame, prev = f.prev.game as PongGame, { w, h } = f;
  const me = s.players.find(p => p.id === f.viewer), team = me?.team ?? 0, flip = team === 1;
  const scale = Math.min((w - 16) / (NP.halfW * 2), (h - 16) / (NP.halfH * 2 + .8)), cx = w / 2, cy = h / 2;
  const X = (x: number) => cx + (flip ? -x : x) * scale, Y = (y: number) => cy + (flip ? -y : y) * scale;
  // Arena.
  ctx.fillStyle = "#070418"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#1f1650"; ctx.lineWidth = 1;
  for (let y = -NP.halfH; y <= NP.halfH; y += 1) { ctx.beginPath(); ctx.moveTo(X(-NP.halfW), Y(y)); ctx.lineTo(X(NP.halfW), Y(y)); ctx.stroke(); }
  ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(X(-NP.halfW), Y(-NP.halfH)); ctx.lineTo(X(-NP.halfW), Y(NP.halfH)); ctx.moveTo(X(NP.halfW), Y(-NP.halfH)); ctx.lineTo(X(NP.halfW), Y(NP.halfH)); ctx.stroke();
  ctx.setLineDash([8, 10]); ctx.strokeStyle = "#57e4cb66"; ctx.beginPath(); ctx.moveTo(X(-NP.halfW), Y(0)); ctx.lineTo(X(NP.halfW), Y(0)); ctx.stroke(); ctx.setLineDash([]);
  // Goal lines: own goal at the bottom of the screen.
  for (const side of [0, 1]) {
    const y = side === 0 ? NP.halfH : -NP.halfH, recent = g.lastGoal && g.lastGoal.team !== side && f.simTime - g.lastGoal.at < 700 && !f.reduced;
    ctx.strokeStyle = recent ? "#fff9ed" : side === team ? "#ffe44e" : "#ff86c8"; ctx.lineWidth = recent ? 6 : 3;
    ctx.beginPath(); ctx.moveTo(X(-NP.halfW), Y(y)); ctx.lineTo(X(NP.halfW), Y(y)); ctx.stroke();
  }
  // Big faded score per half.
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `900 ${Math.round(scale * 2.6)}px 'Trebuchet MS', sans-serif`;
  ctx.fillStyle = "#ffe44e22"; ctx.fillText(String(g.score[team]), cx, Y(team === 0 ? 3.6 : -3.6));
  ctx.fillStyle = "#ff86c822"; ctx.fillText(String(g.score[1 - team]), cx, Y(team === 0 ? -3.6 : 3.6));
  if (g.power) {
    const r = NP.powerRadius * scale, pulse = f.reduced ? 1 : 1 + Math.sin(f.t / 180) * .08;
    ctx.fillStyle = "#6544e8"; ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(g.power.x), Y(g.power.y), r * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff9ed"; ctx.font = `900 ${Math.round(r * 1.1)}px 'Trebuchet MS', sans-serif`; ctx.fillText(POWER_ICON[g.power.kind], X(g.power.x), Y(g.power.y) + 1);
  }
  // Paddles; the own paddle is predicted from the local finger position.
  for (const paddle of g.paddles) {
    const p = s.players.find(q => q.id === paddle.id)!, before = prev.paddles?.find(q => q.id === paddle.id);
    let x = before ? lerp(before.x, paddle.x, f.alpha) : paddle.x;
    if (paddle.id === f.viewer && !f.reduced) {
      const screen = (f.input.x + 1) / 2, target = paddle.team === 0 ? paddle.min + screen * (paddle.max - paddle.min) : paddle.max - screen * (paddle.max - paddle.min);
      // Up to 250 ms ahead of the authority, which covers the usual round trip.
      const reach = NP.paddleSpeed * Math.min(.25, Math.max(.1, (f.simTime - s.time) / 1000 + .1));
      x = paddle.x + Math.max(-reach, Math.min(reach, target - paddle.x));
    }
    const wide = g.effects[paddle.team]?.kind === "wide", half = (g.paddles.filter(q => q.team === paddle.team).length > 1 ? NP.paddleDuo : NP.paddleSolo) * (wide ? NP.wide : 1) / 2;
    const y = paddle.team === 0 ? NP.paddleY : -NP.paddleY, color = playerColor(p.style);
    ctx.fillStyle = color + "44"; ctx.fillRect(X(x) - half * scale - 4, Y(y) - NP.paddleT * scale / 2 - 4, half * 2 * scale + 8, NP.paddleT * scale + 8);
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(X(x) - half * scale, Y(y) - NP.paddleT * scale / 2, half * 2 * scale, NP.paddleT * scale, 6); ctx.fill();
    if (paddle.id === f.viewer) { ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2; ctx.stroke(); }
  }
  // Balls with a short glow trail, interpolated between snapshots.
  const trails = (f.local as unknown as { pongTrail?: Record<number, [number, number][]> });
  trails.pongTrail ??= {};
  for (const ball of g.balls) {
    const before = prev.balls?.find(b => b.id === ball.id);
    const bx = before ? lerp(before.x, ball.x, f.alpha) : ball.x, by = before ? lerp(before.y, ball.y, f.alpha) : ball.y;
    const trail = trails.pongTrail[ball.id] ??= [];
    if (!f.reduced) { trail.push([bx, by]); if (trail.length > 10) trail.shift(); }
    trail.forEach(([tx, ty], i) => { ctx.fillStyle = `rgba(87,228,203,${(i + 1) / trail.length * .35})`; ctx.beginPath(); ctx.arc(X(tx), Y(ty), NP.ball * scale * (i + 1) / trail.length, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = "#57e4cb44"; ctx.beginPath(); ctx.arc(X(bx), Y(by), NP.ball * scale * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(X(bx), Y(by), NP.ball * scale * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  for (const id of Object.keys(trails.pongTrail)) if (!g.balls.some(b => b.id === Number(id))) delete trails.pongTrail[Number(id)];
  // Effects of each team as small chips.
  ctx.font = "800 13px 'Trebuchet MS', sans-serif";
  for (const side of [0, 1]) {
    const effect = g.effects[side];
    if (!effect) continue;
    const label = `${POWER_ICON[effect.kind]} ${side === team ? "Ihr" : "Gegner"}`;
    ctx.fillStyle = side === team ? "#ffe44e" : "#ff86c8";
    ctx.fillText(label, cx, side === team ? h - 14 : 14);
  }
  if (!g.balls.length && !s.done) {
    ctx.fillStyle = "#fff9ed"; ctx.font = "900 20px 'Trebuchet MS', sans-serif";
    ctx.fillText(g.lastGoal && f.simTime - g.lastGoal.at < 1200 ? (g.lastGoal.team === team ? "TOR für euch!" : "Gegentor!") : "Aufschlag …", cx, cy);
  }
  if (g.golden && !s.done) { ctx.fillStyle = "#ffe44e"; ctx.font = "900 16px 'Trebuchet MS', sans-serif"; ctx.fillText("GOLDEN GOAL", cx, Y(team === 0 ? 1.2 : -1.2)); }
}

export const neonPongClient: MatchClient = {
  render,
  quiet: ["hit", "wall", "serve"],
  Controls({ io, active }) {
    return <SliderPad label="Schläger bewegen" onMove={x => { if (active) io.set({ x }, true); }}>
      <span className="pong-slider-hint" aria-hidden="true">⟵ Finger hier waagrecht ziehen ⟶</span>
    </SliderPad>;
  },
  status(view, viewer) {
    const g = view.game as PongGame, me = view.players.find(p => p.id === viewer), team = me?.team ?? 0;
    const left = Math.max(0, Math.ceil((NP.regular - view.time) / 1000));
    const duo = view.players.length === 4 ? " · 2 gegen 2" : "";
    return `${g.score[team]} : ${g.score[1 - team]} · ${g.golden ? "Golden Goal" : `noch ${left} s`}${duo}`;
  },
  sound(event, viewer) {
    if (event.kind === "goal") return event.ids.includes(viewer) ? "score" : "fail";
    if (event.kind === "hit") return "bounce";
    if (event.kind === "power") return "power";
    if (event.kind === "golden" || event.kind === "serve") return "tick";
    return undefined;
  }
};
