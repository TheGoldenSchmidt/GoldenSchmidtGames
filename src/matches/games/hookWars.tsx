import { useRef } from "react";
import { ANCHORS, HW, PLATFORMS, ZONES, type HookGame } from "../../../shared/matches/hookWars";
import { AimPad, Stick } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchControlsProps, type MatchFrame } from "../client";

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as HookGame, prev = f.prev.game as HookGame, { w, h } = f;
  // Keep the lowest platforms above the stick and the hook area.
  const bottom = Math.min(140, h * .22), scale = Math.min(w / 12, (h - bottom - 16) / (HW.height + 1.5)), me = g.bots[f.viewer];
  const view = w / scale, camX = Math.max(0, Math.min(HW.width - view, (me && !me.out ? me.x : HW.width / 2) - view / 2));
  const X = (x: number) => (x - camX) * scale, Y = (y: number) => h - bottom - (y + 1) * scale;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#1b1f3b"); sky.addColorStop(1, "#4b2a5c");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff10"; for (let k = 0; k < 30; k++) ctx.fillRect(((k * 97) % 400) / 400 * w, ((k * 53) % 300) / 300 * h * .6, 2, 2);
  ctx.fillStyle = "#e3263b44"; ctx.fillRect(0, Y(HW.fallY + 1.2), w, h);
  ZONES.forEach(([zx, zy], i) => {
    const p = s.players[i];
    if (!p) return;
    ctx.fillStyle = playerColor(p.style) + "88"; ctx.fillRect(X(zx - HW.zoneW / 2), Y(zy) - 6, HW.zoneW * scale, 6);
    ctx.strokeStyle = playerColor(p.style); ctx.lineWidth = 2; ctx.strokeRect(X(zx - HW.zoneW / 2), Y(zy + 1.4), HW.zoneW * scale, 1.4 * scale);
    if (p.id === f.viewer) { ctx.fillStyle = "#ffe44e"; ctx.font = "900 11px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText("DEINE ZONE", X(zx), Y(zy + 1.6)); }
  });
  for (const pl of PLATFORMS) {
    ctx.fillStyle = "#6b7280"; ctx.fillRect(X(pl.x0), Y(pl.y), (pl.x1 - pl.x0) * scale, .35 * scale);
    ctx.fillStyle = "#9ca3af"; ctx.fillRect(X(pl.x0), Y(pl.y), (pl.x1 - pl.x0) * scale, 3);
    ctx.fillStyle = "#3b3f4a"; for (let x = pl.x0 + .3; x < pl.x1; x += .9) ctx.fillRect(X(x), Y(pl.y) + 6, 3, 3);
  }
  for (const [ax, ay] of ANCHORS) { ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(ax), Y(ay), .28 * scale, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = "#57e4cb55"; ctx.fill(); }
  const glow = f.reduced ? 1 : 1 + Math.sin(f.t / 200) * .12;
  for (const c of g.cores) { ctx.fillStyle = "#57e4cb44"; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), HW.coreRadius * scale * 1.8 * glow, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#b8fff2"; ctx.beginPath(); ctx.arc(X(c.x), Y(c.y), HW.coreRadius * scale, 0, Math.PI * 2); ctx.fill(); }
  for (const p of s.players) {
    const b = g.bots[p.id], before = prev.bots?.[p.id];
    if (!b || b.out) continue;
    const x = before && !before.out ? lerp(before.x, b.x, f.alpha) : b.x, y = before && !before.out ? lerp(before.y, b.y, f.alpha) : b.y, color = playerColor(p.style);
    if (b.hook) { const [ax, ay] = ANCHORS[b.hook.index]; ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(ax), Y(ay)); ctx.stroke(); }
    if (b.lastShot && f.simTime - b.lastShot.at < 180 && !b.hook) { ctx.strokeStyle = b.lastShot.hit ? "#ffe44e" : "#fff9ed66"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(b.lastShot.x), Y(b.lastShot.y)); ctx.stroke(); ctx.setLineDash([]); }
    const r = HW.radius * scale;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(X(x) - r, Y(y) - r, r * 2, r * 2, 6); ctx.fill();
    ctx.fillStyle = "#24133f"; ctx.fillRect(X(x) - r * .55, Y(y) - r * .35, r * 1.1, r * .4);
    ctx.fillStyle = "#57e4cb"; ctx.fillRect(X(x) - r * .4, Y(y) - r * .25, r * .25, r * .2); ctx.fillRect(X(x) + r * .15, Y(y) - r * .25, r * .25, r * .2);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(x), Y(y) - r); ctx.lineTo(X(x), Y(y) - r * 1.6); ctx.stroke();
    if (b.core) { ctx.fillStyle = "#b8fff2"; ctx.beginPath(); ctx.arc(X(x), Y(y) - r * 2.1, HW.coreRadius * scale * .8, 0, Math.PI * 2); ctx.fill(); }
    if (p.id === f.viewer) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 2; ctx.strokeRect(X(x) - r - 3, Y(y) - r - 3, r * 2 + 6, r * 2 + 6); }
  }
  // Mini map of the whole scrapyard: cores, zones and robots.
  const mw = 90, mh = mw * HW.height / HW.width, mx = w - mw - 8, my = 8;
  ctx.fillStyle = "#00000088"; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "#fff9ed55"; ctx.strokeRect(mx + camX / HW.width * mw, my, view / HW.width * mw, mh);
  for (const c of g.cores) { ctx.fillStyle = "#b8fff2"; ctx.fillRect(mx + c.x / HW.width * mw - 2, my + mh - c.y / HW.height * mh - 2, 4, 4); }
  for (const p of s.players) { const b = g.bots[p.id]; if (!b || b.out) continue; ctx.fillStyle = playerColor(p.style); ctx.beginPath(); ctx.arc(mx + b.x / HW.width * mw, my + mh - Math.max(0, b.y) / HW.height * mh, p.id === f.viewer ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill(); }
  if (me?.out) { ctx.fillStyle = "#fff9ed"; ctx.font = "900 18px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText(`Abgestürzt! Zurück in ${Math.max(0, Math.ceil((me.respawnAt - f.simTime) / 1000))} s`, w / 2, h * .3); }
}

/** Left: stick (up = jump). Right half: drag to fire the hook, release to let go. */
function HookControls({ io, active }: MatchControlsProps) {
  const fired = useRef(false);
  return <>
    <div className="hook-aim-half"><AimPad label="Greifhaken zielen und halten" radius={60}
      onAim={(x, y) => {
        if (!active) return;
        io.set({ ax: x, ay: y, hb: true });
        if (!fired.current && Math.hypot(x, y) > .3) { fired.current = true; io.press("b"); }
      }}
      onRelease={() => { fired.current = false; io.set({ hb: false, ax: 0, ay: 0 }, true); }}>
      <span className="hook-hint" aria-hidden="true">Ziehen = Haken · loslassen = lösen</span>
    </AimPad></div>
    <Stick disabled={!active} onMove={(x, y) => io.set({ x, y }, true)} />
  </>;
}

export const hookWarsClient: MatchClient = {
  backdrop: "#1b1f3b",
  render,
  quiet: ["latch", "release", "miss", "core"],
  Controls: HookControls,
  status(view, viewer) {
    const g = view.game as HookGame, me = g.bots[viewer], left = Math.max(0, Math.ceil((HW.regular - view.time) / 1000));
    return `${g.overtime ? "Nächste Abgabe entscheidet" : `noch ${left} s`} · ${me ? `${me.delivered} Kerne${me.core ? " · Kern dabei!" : ""}` : "Zuschauen"}`;
  },
  sound(event, viewer) {
    if (event.kind === "latch") return event.ids.includes(viewer) ? "bounce" : undefined;
    if (event.kind === "deliver") return event.ids.includes(viewer) ? "win" : "score";
    if (event.kind === "steal" || event.kind === "yank") return event.ids[1] === viewer ? "hit" : event.ids[0] === viewer ? "fail" : undefined;
    if (event.kind === "pickup") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "fall") return event.ids.includes(viewer) ? "fail" : undefined;
    if (event.kind === "core" || event.kind === "overtime") return "tick";
    return undefined;
  }
};
