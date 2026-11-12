import { DIRS, LT, type TrailsGame } from "../../../shared/matches/lightTrails";
import { ActionButton, SwipeZone } from "../controls";
import { playerColor, type MatchClient, type MatchFrame } from "../client";

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as TrailsGame, { w, h } = f;
  const cell = Math.floor(Math.min((w - 12) / LT.cols, (h - 12) / LT.rows));
  const ox = Math.round((w - cell * LT.cols) / 2), oy = Math.round((h - cell * LT.rows) / 2);
  const px = (x: number) => ox + (x + .5) * cell, py = (y: number) => oy + (y + .5) * cell;
  ctx.fillStyle = "#07051a"; ctx.fillRect(0, 0, w, h);
  // Grid floor.
  ctx.strokeStyle = "#2b1f5a"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= LT.cols; x++) { ctx.moveTo(ox + x * cell + .5, oy); ctx.lineTo(ox + x * cell + .5, oy + LT.rows * cell); }
  for (let y = 0; y <= LT.rows; y++) { ctx.moveTo(ox, oy + y * cell + .5); ctx.lineTo(ox + LT.cols * cell, oy + y * cell + .5); }
  ctx.stroke();
  // Shrinking walls glow red.
  if (g.border > 0) {
    const b = g.border * cell;
    ctx.fillStyle = "#ff2e6355";
    ctx.fillRect(ox, oy, LT.cols * cell, b); ctx.fillRect(ox, oy + LT.rows * cell - b, LT.cols * cell, b);
    ctx.fillRect(ox, oy + b, b, LT.rows * cell - 2 * b); ctx.fillRect(ox + LT.cols * cell - b, oy + b, b, LT.rows * cell - 2 * b);
  }
  ctx.strokeStyle = g.border ? "#ff2e63" : "#57e4cb"; ctx.lineWidth = 3;
  ctx.strokeRect(ox + g.border * cell, oy + g.border * cell, (LT.cols - 2 * g.border) * cell, (LT.rows - 2 * g.border) * cell);
  const roundTime = f.simTime - g.roundStart;
  for (const p of s.players) {
    const r = g.riders[p.id];
    if (!r) continue;
    const color = playerColor(p.style);
    // Smooth head: extrapolate within the current cell step while alive.
    const progress = g.phase === "play" && r.alive && !f.reduced ? Math.max(0, Math.min(1, roundTime / LT.moveMs - g.move)) * .9 : 0;
    const hx = r.x + DIRS[r.dir][0] * progress, hy = r.y + DIRS[r.dir][1] * progress;
    const points: [number, number][] = [...r.path, [hx, hy]];
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const [width, alpha] of [[cell * .9, r.alive ? .25 : .12], [cell * .38, r.alive ? 1 : .45]] as const) {
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (r.alive) {
      ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(px(hx), py(hy), cell * .42, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px(hx), py(hy), cell * .28, 0, Math.PI * 2); ctx.fill();
      if (p.id === f.viewer) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px(hx), py(hy), cell * .75, 0, Math.PI * 2); ctx.stroke(); }
    } else {
      ctx.strokeStyle = "#ff86c8"; ctx.lineWidth = 2.5;
      const cx = px(r.x), cy = py(r.y), d = cell * .45;
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
  render,
  Controls({ io, view, viewer, active }) {
    const g = view.game as TrailsGame, alive = active && g.phase === "play" && !!g.riders[viewer]?.alive;
    return <>
      <SwipeZone className="trails-swipe" label="Wischen, um abzubiegen" onSwipe={dir => { if (alive) io.command(dir); }} />
      <ActionButton icon="⟲" label="Links" tone="cyan" disabled={!alive} onPress={() => io.command(4)} />
      <ActionButton icon="⟳" label="Rechts" tone="cyan" disabled={!alive} onPress={() => io.command(5)} />
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
