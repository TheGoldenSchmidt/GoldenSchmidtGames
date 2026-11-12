import { BA, DIR4, type BombGame } from "../../../shared/matches/bombArena";
import { ActionButton, Stick } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

const ITEM_ICON = { range: "✚", bomb: "●", speed: "»", kick: "⤳" } as const;

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as BombGame, prev = f.prev.game as BombGame, { w, h } = f;
  const size = Math.floor(Math.min((w - 8) / BA.cols, (h - 8) / BA.rows)), ox = (w - size * BA.cols) / 2, oy = (h - size * BA.rows) / 2;
  const X = (x: number) => ox + x * size, Y = (y: number) => oy + y * size;
  ctx.fillStyle = "#1d1a2b"; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < BA.rows; y++) for (let x = 0; x < BA.cols; x++) {
    const c = g.cells[y * BA.cols + x], px = X(x), py = Y(y);
    if (c === "1") { ctx.fillStyle = "#4b4766"; ctx.fillRect(px, py, size, size); ctx.fillStyle = "#6a6590"; ctx.fillRect(px + 2, py + 2, size - 4, size * .25); }
    else if (c === "3") { ctx.fillStyle = "#c23b2a"; ctx.fillRect(px, py, size, size); ctx.fillStyle = "#ff8a3d"; ctx.fillRect(px + size * .2, py + size * .2, size * .6, size * .6); }
    else {
      ctx.fillStyle = (x + y) % 2 ? "#8f93a8" : "#9a9eb3"; ctx.fillRect(px, py, size, size);
      if (c === "2") { ctx.fillStyle = "#b8743d"; ctx.fillRect(px + 2, py + 2, size - 4, size - 4); ctx.strokeStyle = "#6e3f1c"; ctx.lineWidth = 2; ctx.strokeRect(px + 4, py + 4, size - 8, size - 8); ctx.beginPath(); ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + size - 4, py + size - 4); ctx.stroke(); }
    }
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const item of g.items) {
    ctx.fillStyle = "#6544e8"; ctx.beginPath(); ctx.roundRect(X(item.x) + size * .15, Y(item.y) + size * .15, size * .7, size * .7, 6); ctx.fill();
    ctx.fillStyle = "#ffe44e"; ctx.font = `900 ${Math.round(size * .45)}px 'Trebuchet MS', sans-serif`; ctx.fillText(ITEM_ICON[item.kind], X(item.x) + size / 2, Y(item.y) + size / 2 + 1);
  }
  for (const bomb of g.bombs) {
    const left = Math.max(0, bomb.at - f.simTime), pulse = f.reduced ? 1 : 1 + Math.sin(f.t / (left < 700 ? 60 : 140)) * .06;
    const cx = X(bomb.x) + size / 2, cy = Y(bomb.y) + size / 2;
    ctx.fillStyle = "#16121f"; ctx.beginPath(); ctx.arc(cx, cy, size * .36 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = left < 700 ? "#ff4d3d" : "#ffe44e"; ctx.beginPath(); ctx.arc(cx + size * .2, cy - size * .28, size * .09, 0, Math.PI * 2); ctx.fill();
    // Fuse ring shows the remaining time.
    ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, size * .44, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (left / BA.fuse)); ctx.stroke();
  }
  for (const flame of g.flames) {
    const k = Math.max(0, (flame.until - f.simTime) / BA.flameMs), inset = flame.center ? .05 : .15;
    ctx.fillStyle = `rgba(255,122,40,${.55 + k * .4})`; ctx.fillRect(X(flame.x) + size * .05, Y(flame.y) + size * inset, size * .9, size * (1 - 2 * inset));
    ctx.fillStyle = `rgba(255,228,78,${.5 + k * .5})`; ctx.fillRect(X(flame.x) + size * .25, Y(flame.y) + size * .3, size * .5, size * .4);
  }
  for (const p of s.players) {
    const b = g.bombers[p.id], before = prev.bombers?.[p.id];
    if (!b?.alive) continue;
    const pos = (q: typeof b) => [q.cx + (q.tx - q.cx) * q.progress, q.cy + (q.ty - q.cy) * q.progress] as const;
    const [nx, ny] = pos(b), [bx, by] = before?.alive ? pos(before) : [nx, ny];
    const jump = Math.abs(nx - bx) + Math.abs(ny - by) > 1.2;
    const x = jump ? nx : lerp(bx, nx, f.alpha), y = jump ? ny : lerp(by, ny, f.alpha);
    const cx = X(x) + size / 2, cy = Y(y) + size / 2, blink = s.time < b.invulnUntil && !f.reduced && Math.floor(f.t / 120) % 2 === 0;
    if (blink) continue;
    ctx.fillStyle = "#16121f"; ctx.beginPath(); ctx.ellipse(cx, cy + size * .3, size * .3, size * .1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = playerColor(p.style); ctx.beginPath(); ctx.arc(cx, cy, size * .34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.id === f.viewer ? "#ffe44e" : "#16121f"; ctx.lineWidth = p.id === f.viewer ? 3 : 2; ctx.stroke();
    const [ex, ey] = DIR4[b.dir];
    ctx.fillStyle = "#fff9ed";
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + ex * size * .12 + (ey ? side : 0) * size * .1, cy + ey * size * .12 + (ex ? side : 0) * size * .1 - size * .04, size * .07, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < b.lives; i++) { ctx.fillStyle = "#ff86c8"; ctx.fillRect(cx - size * .2 + i * size * .24, cy - size * .52, size * .16, size * .1); }
  }
  if (g.phase !== "play") {
    const last = g.history.at(-1);
    ctx.fillStyle = "#16121fdd"; ctx.fillRect(0, h / 2 - 40, w, 80);
    ctx.fillStyle = "#ffe44e"; ctx.font = "900 22px 'Trebuchet MS', sans-serif";
    ctx.fillText(last?.sudden ? "Sudden Death entschieden" : `Durchgang ${g.round} vorbei`, w / 2, h / 2 - 12);
    ctx.fillStyle = "#fff9ed"; ctx.font = "800 15px 'Trebuchet MS', sans-serif";
    ctx.fillText(last?.winners.includes(f.viewer) ? "Du gewinnst diesen Durchgang!" : `+${last?.points[f.viewer] ?? 0} Punkte für dich`, w / 2, h / 2 + 16);
  }
}

export const bombArenaClient: MatchClient = {
  render,
  // 2.5D presentation; the canvas above stays as fallback without WebGL.
  world: () => import("../../three/bombWorld").then(m => m.createBombWorld),
  banner(view, viewer) {
    const g = view.game as BombGame, last = g.history.at(-1);
    if (g.phase === "play" || view.done) return undefined;
    return { title: last?.sudden ? "Sudden Death entschieden" : `Durchgang ${g.round} vorbei`, text: last?.winners.includes(viewer) ? "Du gewinnst diesen Durchgang!" : `+${last?.points[viewer] ?? 0} Punkte für dich` };
  },
  quiet: ["bomb", "boom", "kick"],
  Controls({ io, view, viewer, active }) {
    const g = view.game as BombGame, me = g.bombers[viewer];
    const mine = g.bombs.filter(b => b.owner === viewer).length, ready = !!me && mine < me.maxBombs;
    return <>
      <Stick disabled={!active} onMove={(x, y) => io.set({ x, y }, true)} />
      <ActionButton icon="✹" label="Bombe" tone="pink" disabled={!active || !me?.alive || g.phase !== "play"} charge={ready ? 1 : 0} onPress={() => io.press("a")} />
    </>;
  },
  status(view, viewer) {
    const g = view.game as BombGame, me = g.bombers[viewer];
    const left = Math.max(0, Math.ceil(((g.sudden ? BA.suddenMax : BA.roundMax) - (view.time - g.roundStart)) / 1000));
    const round = g.sudden ? "Sudden Death" : `Runde ${g.round}/${BA.rounds}`;
    return `${round} · ${g.phase === "play" ? `${left} s` : "Pause"} · ${me?.alive ? `${me.lives} Leben` : "raus"}`;
  },
  sound(event, viewer) {
    if (event.kind === "boom") return "boom";
    if (event.kind === "bomb") return event.ids.includes(viewer) ? "tick" : undefined;
    if (event.kind === "out") return event.ids[1] === viewer ? "win" : event.ids[0] === viewer ? "fail" : "hit";
    if (event.kind === "hit") return event.ids.includes(viewer) ? "fail" : undefined;
    if (event.kind === "power") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "result") return event.ids.includes(viewer) ? "win" : "score";
    if (event.kind === "round" || event.kind === "shrink") return "tick";
    return undefined;
  }
};

