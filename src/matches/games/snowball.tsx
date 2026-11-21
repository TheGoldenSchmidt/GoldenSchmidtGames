import { useEffect, useRef } from "react";
import { SB, SNOW_TREES, SNOW_WALLS, throwTarget, type SnowGame } from "../../../shared/matches/snowball";
import { ActionButton, AimPad, CameraSwipe, Stick } from "../controls";
import { chaseAim, chaseStick, lerp, playerColor, type ChaseLocal, type MatchClient, type MatchControlsProps, type MatchFrame } from "../client";

/** Height of a flying ball for its distance travelled (presentation only; the rules fly flat). */
export const ballArc = (travelled: number) => { const k = Math.min(1, travelled / SB.range); return .9 + Math.sin(k * Math.PI) * 1.1 - k * .6; };

/** Top-down fallback without WebGL: snowy field, walls, trees, piles, players and balls. */
function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as SnowGame, prev = f.prev.game as SnowGame, { w, h } = f;
  const scale = Math.min((w - 12) / SB.size, (h - 140) / SB.size), ox = (w - SB.size * scale) / 2, oy = 6;
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;
  ctx.fillStyle = "#24306b"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#eef6ff"; ctx.fillRect(X(0), Y(0), SB.size * scale, SB.size * scale);
  ctx.fillStyle = "#cfe3f7"; for (let i = 0; i < 40; i++) { const x = (i * 7.3) % SB.size, y = (i * 5.1) % SB.size; ctx.beginPath(); ctx.arc(X(x), Y(y), scale * .25, 0, Math.PI * 2); ctx.fill(); }
  for (const wall of SNOW_WALLS) { ctx.fillStyle = "#9fc2e6"; ctx.fillRect(X(wall.x0), Y(wall.y0), (wall.x1 - wall.x0) * scale, (wall.y1 - wall.y0) * scale); ctx.fillStyle = "#ffffff"; ctx.fillRect(X(wall.x0), Y(wall.y0), (wall.x1 - wall.x0) * scale, Math.max(2, scale * .18)); }
  for (const tree of SNOW_TREES) { ctx.fillStyle = "#2f7a5a"; ctx.beginPath(); ctx.arc(X(tree.x), Y(tree.y), tree.r * scale * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#ffffffcc"; ctx.beginPath(); ctx.arc(X(tree.x) - 2, Y(tree.y) - 2, tree.r * scale * .5, 0, Math.PI * 2); ctx.fill(); }
  for (const pile of g.piles) { const ready = f.simTime >= pile.readyAt; ctx.fillStyle = ready ? "#ffffff" : "#ffffff55"; ctx.strokeStyle = "#9fc2e6"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(pile.x), Y(pile.y), SB.pileRadius * scale * (ready ? 1 : .6), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  for (const p of s.players) {
    const me = g.players[p.id], before = prev.players?.[p.id]; if (!me) continue;
    const x = before ? lerp(before.x, me.x, f.alpha) : me.x, y = before ? lerp(before.y, me.y, f.alpha) : me.y, color = playerColor(p.style);
    if (me.outAt !== undefined) {
      // Snowman: two balls and a hat in the player colour.
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#9fc2e6"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(x), Y(y), SB.radius * scale * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(X(x), Y(y) - scale * .5, SB.radius * scale * .75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.fillRect(X(x) - scale * .2, Y(y) - scale * 1.05, scale * .4, scale * .25);
      continue;
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(y), SB.radius * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.id === f.viewer ? "#ffe44e" : "#24133f"; ctx.lineWidth = p.id === f.viewer ? 3 : 2; ctx.stroke();
    ctx.fillStyle = "#24133f"; ctx.beginPath(); ctx.arc(X(x + me.fx * SB.radius * .6), Y(y + me.fy * SB.radius * .6), scale * .1, 0, Math.PI * 2); ctx.fill();
    // Hits taken (frost marks) and carried balls.
    for (let i = 0; i < SB.hitsOut; i++) { ctx.fillStyle = i < me.hits ? "#57a6e4" : "#24133f44"; ctx.fillRect(X(x) - 9 + i * 7, Y(y) - SB.radius * scale - 9, 5, 4); }
    for (let i = 0; i < me.balls; i++) { ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#24133f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(X(x) + SB.radius * scale + 4, Y(y) - 4 + i * 8, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  // Lock-on ring under the opponent the own throw would go to.
  const mine = g.players[f.viewer], aim = Math.hypot(f.input.ax, f.input.ay);
  const locked = mine && mine.outAt === undefined && mine.balls > 0 && !s.done ? throwTarget(g, mine, aim > .2 ? f.input.ax / aim : undefined, aim > .2 ? f.input.ay / aim : undefined) : undefined;
  if (locked) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(X(locked.x), Y(locked.y), SB.radius * scale * 1.7, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  for (const b of g.balls) {
    const before = prev.balls?.find(q => q.id === b.id), x = before ? lerp(before.x, b.x, f.alpha) : b.x, y = before ? lerp(before.y, b.y, f.alpha) : b.y;
    ctx.fillStyle = "#24306b44"; ctx.beginPath(); ctx.arc(X(x), Y(y), SB.ballRadius * scale, 0, Math.PI * 2); ctx.fill();
    const lift = ballArc(Math.hypot(x - b.sx, y - b.sy)) * scale * .4;
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#24133f"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(x), Y(y) - lift, SB.ballRadius * scale * 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function SnowControls({ io, view, viewer, active, world }: MatchControlsProps) {
  const g = view.game as SnowGame, me = g.players[viewer], local = io.local as ChaseLocal;
  const off = !active || !me || me.outAt !== undefined, clear = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(clear.current), []);
  const aim = (x: number, y: number) => { window.clearTimeout(clear.current); if (world) chaseAim(io, x, y); else io.set({ ax: x, ay: y }, true); };
  return <>
    {world && <CameraSwipe local={io.local} className="tank-camera-swipe" />}
    <div className="tank-aim-half snow-aim-half"><AimPad label="Zielen und werfen" radius={70}
      onAim={(x, y) => { if (!off) aim(x, y); }}
      onRelease={(x, y) => {
        if (off) return;
        if (world && Math.hypot(x, y) < .2 && local.camYaw !== undefined && me) {
          // Tap: at the nearest opponent the camera shows (the marked one), else straight ahead.
          const fx = Math.sin(local.camYaw), fy = -Math.cos(local.camYaw), pick = throwTarget(g, me, fx, fy, SB.tapCone);
          const dx = pick ? pick.x - me.x : fx, dy = pick ? pick.y - me.y : fy, n = Math.hypot(dx, dy) || 1;
          io.set({ ax: dx / n, ay: dy / n });
        } else if (world) chaseAim(io, x, y, false); else io.set({ ax: x, ay: y });
        io.press("a");
        // Keep the aim until the throw packet has surely left (packets are spaced), then stop aiming.
        local.aimX = local.aimY = 0;
        window.clearTimeout(clear.current); clear.current = window.setTimeout(() => io.set({ ax: 0, ay: 0 }), 150);
      }}>
      <span className="tank-aim-hint" aria-hidden="true">{me && me.balls > 0 ? `Tippen = Wurf · ziehen = zielen (${me.balls})` : "Kein Schneeball – formen!"}</span>
    </AimPad></div>
    <Stick disabled={off} onMove={(x, y) => world ? chaseStick(io, x, y) : io.set({ x, y }, true)} />
    <div className="snow-form">
      {/* One tap: forms balls whenever standing still, up to two; running pauses it, a throw stops it. */}
      <ActionButton icon="❄" label={me?.forming ? "Formt …" : "Formen"} tone="cyan" disabled={off || (me?.balls ?? 0) >= SB.maxBalls}
        charge={me ? (me.balls >= SB.maxBalls ? 1 : me.form / SB.formMs) : 0}
        onPress={() => io.press("b")} />
    </div>
  </>;
}

export const snowballClient: MatchClient = {
  backdrop: "#24306b",
  render,
  chase: true,
  unit: "Treffer",
  world: () => import("../../three/snowWorld").then(m => m.createSnowWorld),
  banner(view, viewer) {
    const me = (view.game as SnowGame).players[viewer];
    if (!me || me.outAt === undefined || view.done) return undefined;
    return { title: "Schneemann!", text: "Drei Treffer – du schaust den anderen zu." };
  },
  quiet: ["throw", "splat"],
  Controls: SnowControls,
  status(view, viewer) {
    const me = (view.game as SnowGame).players[viewer], left = Math.max(0, Math.ceil((SB.maxMs - view.time) / 1000));
    if (!me) return `noch ${left} s`;
    if (me.outAt !== undefined) return `Schneemann · noch ${left} s`;
    return `${me.balls}/${SB.maxBalls} Bälle · ${me.hits}/${SB.hitsOut} getroffen${me.hits ? ` (−${Math.round(me.hits * SB.slowPerHit * 100)} %)` : ""} · ${left} s`;
  },
  sound(event, viewer) {
    if (event.kind === "hit" || event.kind === "frozen") return event.ids[0] === viewer ? "fail" : event.ids[1] === viewer ? "hit" : undefined;
    if (event.kind === "throw") return event.ids.includes(viewer) ? "shot" : undefined;
    if (event.kind === "formed" || event.kind === "pickup") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "splat") return "bounce";
    return undefined;
  }
};
