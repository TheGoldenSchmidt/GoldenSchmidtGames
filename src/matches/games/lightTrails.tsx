import { decodeTrail, inner, LT, type TrailsGame } from "../../../shared/matches/lightTrails";
import { ActionButton, Stick } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

/** Decoded trails per rider and round; only the newly arrived characters are decoded each frame. */
const cache = new Map<string, { text: string; pts: number[] }>();
function trailPoints(g: TrailsGame, id: string) {
  const text = g.trails?.[id] ?? "", key = `${g.round}:${id}`;
  let hit = cache.get(key);
  if (!hit || !text.startsWith(hit.text)) { hit = { text: "", pts: [] }; cache.set(key, hit); }
  if (text.length > hit.text.length) { decodeTrail(text, hit.text.length, hit.pts); hit.text = text; }
  if (cache.size > 40) for (const k of [...cache.keys()].slice(0, 20)) cache.delete(k);
  return hit.pts;
}

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as TrailsGame, prev = f.prev.game as TrailsGame, { w, h } = f;
  const scale = Math.min((w - 12) / LT.w, (h - 12) / LT.h);
  const ox = (w - scale * LT.w) / 2, oy = (h - scale * LT.h) / 2;
  const px = (x: number) => ox + x * scale, py = (y: number) => oy + y * scale;
  ctx.fillStyle = "#07051a"; ctx.fillRect(0, 0, w, h);
  // Floor grid (decoration only: movement is free, not on cells).
  ctx.strokeStyle = "#1d1546"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= LT.w; x += 2) { ctx.moveTo(px(x) + .5, py(0)); ctx.lineTo(px(x) + .5, py(LT.h)); }
  for (let y = 0; y <= LT.h; y += 2) { ctx.moveTo(px(0), py(y) + .5); ctx.lineTo(px(LT.w), py(y) + .5); }
  ctx.stroke();
  // Shrinking walls glow red.
  const border = lerp(prev.border ?? g.border, g.border, f.alpha), box = inner({ border });
  if (border > 0) {
    ctx.fillStyle = "#ff2e6355";
    ctx.fillRect(px(0), py(0), LT.w * scale, border * scale); ctx.fillRect(px(0), py(LT.h - border), LT.w * scale, border * scale);
    ctx.fillRect(px(0), py(border), border * scale, (LT.h - 2 * border) * scale); ctx.fillRect(px(LT.w - border), py(border), border * scale, (LT.h - 2 * border) * scale);
  }
  ctx.strokeStyle = border ? "#ff2e63" : "#57e4cb"; ctx.lineWidth = 3;
  ctx.strokeRect(px(box.x0), py(box.y0), (box.x1 - box.x0) * scale, (box.y1 - box.y0) * scale);
  const roundTime = f.simTime - g.roundStart;
  for (const p of s.players) {
    const r = g.riders[p.id];
    if (!r) continue;
    const color = playerColor(p.style), before = prev.round === g.round ? prev.riders?.[p.id] : undefined;
    // Smooth head: interpolate between snapshots while alive.
    const hx = before && r.alive ? lerp(before.x, r.x, f.alpha) : r.x, hy = before && r.alive ? lerp(before.y, r.y, f.alpha) : r.y;
    const pts = trailPoints(g, p.id);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const [width, alpha] of [[LT.trail * 6, r.alive ? .22 : .1], [LT.trail * 2.2, r.alive ? 1 : .45]] as const) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, width * scale);
      ctx.beginPath(); ctx.moveTo(px(pts[0] ?? hx), py(pts[1] ?? hy));
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(px(pts[i]), py(pts[i + 1]));
      ctx.lineTo(px(hx), py(hy)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (r.alive) {
      ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(px(hx), py(hy), Math.max(4, LT.radius * 1.5 * scale), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(hx), py(hy), Math.max(2.5, LT.radius * scale), 0, Math.PI * 2); ctx.fill();
      // Nose: shows the heading.
      ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px(hx), py(hy)); ctx.lineTo(px(hx + Math.sin(r.a) * .8), py(hy - Math.cos(r.a) * .8)); ctx.stroke();
      if (p.id === f.viewer) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(hx), py(hy), Math.max(10, scale * 1.1), 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.strokeStyle = "#ff86c8"; ctx.lineWidth = 2.5;
      const cx = px(r.x), cy = py(r.y), d = Math.max(5, scale * .5);
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
    }
  }
  if (g.phase !== "play") {
    const last = g.history.at(-1), mine = last?.points[f.viewer] ?? 0;
    ctx.fillStyle = "#07051acc"; ctx.fillRect(0, h / 2 - 44, w, 88);
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#ffe44e"; ctx.font = "900 24px 'Trebuchet MS', sans-serif";
    ctx.fillText(g.phase === "done" ? "Alle Durchgänge gespielt" : `Durchgang ${g.round} vorbei`, w / 2, h / 2 - 12);
    ctx.fillStyle = "#fff9ed"; ctx.font = "800 16px 'Trebuchet MS', sans-serif";
    ctx.fillText(last?.survivor === f.viewer ? `Letzte Person! +${mine}` : `+${mine} für dich`, w / 2, h / 2 + 18);
  } else if (roundTime < 1200) {
    ctx.textAlign = "center"; ctx.fillStyle = "#57e4cb"; ctx.font = "900 22px 'Trebuchet MS', sans-serif";
    ctx.fillText(`Durchgang ${g.round}`, w / 2, oy + 40);
  }
}

export const lightTrailsClient: MatchClient = {
  backdrop: "#07051a",
  render,
  Controls({ io, view, viewer, active }) {
    const g = view.game as TrailsGame, alive = active && g.phase === "play" && !!g.riders[viewer]?.alive;
    return <>
      <Stick disabled={!active} onMove={(x, y) => io.set({ x, y }, true)} />
      <div className="trails-buttons">
        <ActionButton icon="⟲" label="Links" tone="cyan" disabled={!alive} onPress={() => io.set({ ha: true, hb: false }, true)} onRelease={() => io.set({ ha: false }, true)} />
        <ActionButton icon="⟳" label="Rechts" tone="cyan" disabled={!alive} onPress={() => io.set({ hb: true, ha: false }, true)} onRelease={() => io.set({ hb: false }, true)} />
      </div>
    </>;
  },
  status(view, viewer) {
    const g = view.game as TrailsGame, r = g.riders[viewer];
    const shrink = g.phase === "play" && g.border > 0 ? " · Arena schrumpft" : "";
    return `Durchgang ${g.round} von ${LT.rounds}${r && !r.alive && g.phase === "play" ? " · Du bist raus" : ""}${shrink}`;
  },
  sound(event, viewer) {
    if (event.kind === "out") return event.ids.includes(viewer) ? "fail" : "boom";
    if (event.kind === "result") return event.ids.includes(viewer) ? "win" : "score";
    if (event.kind === "round" || event.kind === "shrink") return "tick";
    return undefined;
  }
};
