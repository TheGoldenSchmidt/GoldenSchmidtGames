import { TANK_FIELD, TT, wallRects, type TankGame } from "../../../shared/matches/tankTrouble";
import { AimPad, Stick } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

const POWER_ICON = { rapid: "⚡", triple: "⋔", shield: "⛨" } as const;
interface Boom { x: number; y: number; t: number; color: string }

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as TankGame, prev = f.prev.game as TankGame, { w, h } = f;
  const scale = Math.min((w - 12) / TANK_FIELD.width, (h - 12) / TANK_FIELD.height);
  const ox = (w - TANK_FIELD.width * scale) / 2, oy = (h - TANK_FIELD.height * scale) / 2;
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale;
  ctx.fillStyle = "#2c2a1e"; ctx.fillRect(0, 0, w, h);
  for (let r = 0; r < TT.rows; r++) for (let c = 0; c < TT.cols; c++) {
    ctx.fillStyle = (r + c) % 2 ? "#c9b98a" : "#d3c597";
    ctx.fillRect(X(c * TT.cell), Y(r * TT.cell), TT.cell * scale + .5, TT.cell * scale + .5);
  }
  for (const wall of wallRects(g)) {
    const x = X(wall.x0), y = Y(wall.y0), ww = (wall.x1 - wall.x0) * scale, hh = (wall.y1 - wall.y0) * scale;
    ctx.fillStyle = wall.kind === 1 ? "#3b3550" : wall.kind === 2 ? "#b4553a" : "#7d3b2a";
    ctx.fillRect(x, y, ww, hh);
    if (wall.kind === 3) { ctx.strokeStyle = "#f3d1a2"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + ww * .3, y); ctx.lineTo(x + ww * .55, y + hh * .5); ctx.lineTo(x + ww * .4, y + hh); ctx.stroke(); }
  }
  for (const power of g.powers) {
    ctx.fillStyle = "#6544e8"; ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(power.x), Y(power.y), .32 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffe44e"; ctx.font = `900 ${Math.round(.4 * scale)}px 'Trebuchet MS', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(POWER_ICON[power.kind], X(power.x), Y(power.y) + 1);
  }
  for (const p of s.players) {
    const tank = g.tanks[p.id], before = prev.tanks?.[p.id];
    if (!tank) continue;
    const smooth = before && before.alive && tank.alive ? f.alpha : 1;
    const x = before ? lerp(before.x, tank.x, smooth) : tank.x, y = before ? lerp(before.y, tank.y, smooth) : tank.y, color = playerColor(p.style);
    ctx.save(); ctx.translate(X(x), Y(y));
    if (!tank.alive) { ctx.globalAlpha = .35; ctx.fillStyle = "#24133f"; ctx.beginPath(); ctx.arc(0, 0, TT.tank * scale, 0, Math.PI * 2); ctx.fill(); ctx.restore(); continue; }
    ctx.rotate(tank.angle);
    ctx.fillStyle = "#24133f"; ctx.fillRect(-.42 * scale, -.36 * scale, .84 * scale, .72 * scale);
    ctx.fillStyle = color; ctx.fillRect(-.34 * scale, -.27 * scale, .68 * scale, .54 * scale);
    ctx.rotate(tank.aim - tank.angle);
    ctx.fillStyle = "#24133f"; ctx.fillRect(0, -.07 * scale, .58 * scale, .14 * scale);
    ctx.beginPath(); ctx.arc(0, 0, .2 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const shielded = s.time < tank.shieldUntil || tank.power?.kind === "shield";
    if (shielded) { ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X(x), Y(y), (TT.tank + .14) * scale, 0, Math.PI * 2); ctx.stroke(); }
    if (p.id === f.viewer) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(X(x), Y(y), (TT.tank + .26) * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    for (let i = 0; i < TT.hp; i++) { ctx.fillStyle = i < tank.hp ? "#ffe44e" : "#24133f88"; ctx.fillRect(X(x) + (i - 1.5) * 9 + 1, Y(y) - (TT.tank + .38) * scale, 7, 4); }
    if (tank.power && tank.power.kind !== "shield") { ctx.fillStyle = "#ffe44e"; ctx.font = "900 12px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText(POWER_ICON[tank.power.kind], X(x), Y(y) + (TT.tank + .5) * scale); }
  }
  for (const bullet of g.bullets) {
    const before = prev.bullets?.find(b => b.id === bullet.id), x = before ? lerp(before.x, bullet.x, f.alpha) : bullet.x, y = before ? lerp(before.y, bullet.y, f.alpha) : bullet.y;
    ctx.fillStyle = "#24133f"; ctx.beginPath(); ctx.arc(X(x), Y(y), (TT.bullet + .04) * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffe44e"; ctx.beginPath(); ctx.arc(X(x), Y(y), TT.bullet * .6 * scale, 0, Math.PI * 2); ctx.fill();
  }
  // Short explosion rings for destroyed tanks (decorative; skipped with reduced motion).
  const local = f.local as unknown as { tankSeq?: number; booms?: Boom[] };
  local.booms ??= [];
  for (const event of s.events) if (event.seq > (local.tankSeq ?? 0) && event.kind === "dead") {
    const tank = g.tanks[event.ids[0]], before = prev.tanks?.[event.ids[0]], p = s.players.find(q => q.id === event.ids[0]);
    if (before && p) local.booms.push({ x: before.x, y: before.y, t: f.t, color: playerColor(p.style) });
    void tank;
  }
  local.tankSeq = s.eventSeq;
  local.booms = local.booms.filter(b => f.t - b.t < 600);
  if (!f.reduced) for (const boom of local.booms) {
    const k = (f.t - boom.t) / 600;
    ctx.strokeStyle = boom.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(X(boom.x), Y(boom.y), (.3 + k * 1.2) * scale, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const me = g.tanks[f.viewer];
  if (me && !me.alive) {
    ctx.fillStyle = "#24133fcc"; ctx.fillRect(0, h / 2 - 30, w, 60);
    ctx.fillStyle = "#fff9ed"; ctx.font = "900 18px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`Zerstört! Zurück in ${Math.max(0, Math.ceil((me.respawnAt - f.simTime) / 1000))} s`, w / 2, h / 2);
  }
}

export const tankTroubleClient: MatchClient = {
  render,
  // 2.5D presentation; the canvas above stays as fallback without WebGL.
  world: () => import("../../three/tankWorld").then(m => m.createTankWorld),
  banner(view, viewer) {
    const me = (view.game as TankGame).tanks[viewer];
    if (!me || me.alive || view.done) return undefined;
    return { title: "Zerstört!", text: `Zurück in ${Math.max(0, Math.ceil((me.respawnAt - view.time) / 1000))} s` };
  },
  quiet: ["shot", "bounce", "crack", "break"],
  Controls({ io, active }) {
    return <>
      <div className="tank-aim-half"><AimPad label="Zielen und schießen" radius={70}
        onAim={(x, y) => { if (active) io.set({ ax: x, ay: y }, true); }}
        onRelease={(x, y) => { if (!active) return; io.set({ ax: x, ay: y }); io.press("a"); io.set({ ax: 0, ay: 0 }); }}>
        <span className="tank-aim-hint" aria-hidden="true">Ziehen · loslassen = Feuer</span>
      </AimPad></div>
      <Stick disabled={!active} onMove={(x, y) => io.set({ x, y }, true)} />
    </>;
  },
  status(view, viewer) {
    const g = view.game as TankGame, me = g.tanks[viewer];
    const left = Math.max(0, Math.ceil((TT.regular - view.time) / 1000));
    return `${g.overtime ? "Stechen" : `noch ${left} s`} · ${me ? `${me.hp}/${TT.hp} Treffer` : "Zuschauen"}`;
  },
  sound(event, viewer) {
    if (event.kind === "shot") return event.ids.includes(viewer) ? "shot" : undefined;
    if (event.kind === "dead") return event.ids[1] === viewer ? "win" : event.ids[0] === viewer ? "fail" : "boom";
    if (event.kind === "hit") return event.ids[0] === viewer ? "hit" : undefined;
    if (event.kind === "power") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "break" || event.kind === "crack") return "boom";
    if (event.kind === "overtime") return "tick";
    return undefined;
  }
};
