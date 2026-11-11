import { TW, landingY, type Block, type TowerGame } from "../../../shared/matches/towerTumble";
import { SliderPad } from "../controls";
import { playerColor, type MatchClient, type MatchFrame } from "../client";

function drawBlock(ctx: CanvasRenderingContext2D, b: Pick<Block, "parts" | "x" | "y">, X: (x: number) => number, Y: (y: number) => number, scale: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (const p of b.parts) {
    const x = X(b.x + p.dx), y = Y(b.y + p.dy + p.h);
    ctx.fillStyle = color; ctx.fillRect(x, y, p.w * scale, p.h * scale);
    ctx.fillStyle = "#ffffff33"; ctx.fillRect(x, y, p.w * scale, Math.min(5, p.h * scale * .2));
    ctx.strokeStyle = "#24133f"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, p.w * scale - 2, p.h * scale - 2);
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as TowerGame, { w, h } = f;
  const scale = w / TW.width, height = Math.max(0, ...g.blocks.map(b => b.y + b.h));
  // The camera keeps the top of the tower and the waiting block in view.
  const viewTop = Math.max(h / scale - 1.5, height + TW.spawnGap + 2.5), groundY = h - 1.2 * scale;
  const X = (x: number) => x * scale, Y = (y: number) => groundY - (y - Math.max(0, viewTop - h / scale)) * scale;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#ffd166"); sky.addColorStop(1, "#ff86c8");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Height marks every 2 m and the record line.
  ctx.font = "800 11px 'Trebuchet MS', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (let y = 2; y < viewTop + 2; y += 2) { ctx.fillStyle = "#24133f33"; ctx.fillRect(0, Y(y), w, 1); ctx.fillStyle = "#24133f88"; ctx.fillText(`${y} m`, 4, Y(y) - 7); }
  if (g.record > 0) { ctx.strokeStyle = "#e3263b"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y(g.record)); ctx.lineTo(w, Y(g.record)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#e3263b"; ctx.fillText(`Rekord ${g.record.toFixed(1)} m`, w - 110, Y(g.record) - 8); }
  ctx.fillStyle = "#6b4f3a"; ctx.fillRect(X(TW.baseX0), Y(0), (TW.baseX1 - TW.baseX0) * scale, h);
  ctx.fillStyle = "#3b2a1a"; ctx.fillRect(0, Y(-.6), w, h);
  for (const b of g.blocks) { const p = s.players.find(q => q.id === b.owner); drawBlock(ctx, b, X, Y, scale, p ? playerColor(p.style) : "#999"); }
  // Toppled blocks fall and turn for a moment (decoration only).
  for (const { block, at } of g.falling) {
    const k = Math.min(1, (f.simTime - at) / 1200), p = s.players.find(q => q.id === block.owner);
    if (k >= 1) continue;
    const cx = X(block.x + block.w / 2), cy = Y(block.y + block.h / 2);
    ctx.save(); ctx.translate(cx + (f.reduced ? 0 : (block.x + block.w / 2 < TW.width / 2 ? -1 : 1) * k * 60), cy + (f.reduced ? 0 : k * k * 300)); ctx.rotate(f.reduced ? 0 : (block.x < TW.width / 2 ? -1 : 1) * k * 1.6);
    drawBlock(ctx, { parts: block.parts, x: -block.w / 2, y: -block.h / 2 }, x => x * scale, y => -y * scale, scale, p ? playerColor(p.style) : "#999", 1 - k * .6);
    ctx.restore();
  }
  const current = g.current;
  if (current) {
    const p = s.players.find(q => q.id === current.owner)!, mine = current.owner === f.viewer;
    // Own block follows the finger immediately; others see the authority's position.
    const x = mine && g.phase === "aim" && !f.reduced ? Math.max(0, Math.min(TW.width - current.shape.w, (f.input.x + 1) / 2 * (TW.width - current.shape.w))) : current.x;
    if (g.phase === "aim") {
      const land = landingY(g.blocks, current.shape, x);
      ctx.strokeStyle = "#24133f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(x + current.shape.w / 2), 0); ctx.lineTo(X(x + current.shape.w / 2), Y(current.y + current.shape.h)); ctx.stroke();
      if (Number.isFinite(land)) drawBlock(ctx, { parts: current.shape.parts, x, y: land }, X, Y, scale, "#24133f", .18);
    }
    drawBlock(ctx, { parts: current.shape.parts, x, y: current.y }, X, Y, scale, playerColor(p.style));
  }
  ctx.textAlign = "center";
  if (g.phase === "result" && g.last) {
    const name = f.names[g.last.owner] ?? "";
    ctx.fillStyle = "#24133fdd"; ctx.fillRect(0, h * .2 - 26, w, 52);
    ctx.fillStyle = g.last.outcome === "collapse" ? "#ff86c8" : "#ffe44e"; ctx.font = "900 19px 'Trebuchet MS', sans-serif";
    ctx.fillText(g.last.outcome === "collapse" ? `${name}: Einsturz! −2` : g.last.outcome === "slip" ? `${name}: abgerutscht` : `${name}: steht! +${g.last.bonus ? 2 : 1}`, w / 2, h * .2);
  }
}

export const towerTumbleClient: MatchClient = {
  render,
  quiet: ["drop", "land", "turn"],
  Controls({ io, view, viewer, active }) {
    const g = view.game as TowerGame, mine = active && g.phase === "aim" && g.current?.owner === viewer;
    if (!mine) return <p className="tower-wait" role="status">{g.current ? "Die anderen bauen gerade …" : ""}</p>;
    return <SliderPad className="tower-slider" label="Baustein verschieben, loslassen zum Fallenlassen" onMove={x => io.set({ x }, true)} onRelease={() => io.press("a")}>
      <span className="tower-hint" aria-hidden="true">Ziehen · loslassen = fallen lassen</span>
    </SliderPad>;
  },
  status(view, viewer) {
    const g = view.game as TowerGame, turnOwner = g.current?.owner;
    const left = g.phase === "aim" ? Math.max(0, Math.ceil((TW.aimMs - (view.time - g.phaseStart)) / 1000)) : 0;
    const mineLeft = g.turns.slice(g.turn + (g.tiebreak ? 0 : 1)).filter(id => id === viewer).length + (turnOwner === viewer ? 1 : 0);
    return g.tiebreak ? "Stechrunde" : turnOwner === viewer ? `Du bist dran · ${left} s` : `Noch ${mineLeft} Stein${mineLeft === 1 ? "" : "e"} für dich`;
  },
  sound(event, viewer) {
    if (event.kind === "turn") return event.ids.includes(viewer) ? "go" : undefined;
    if (event.kind === "land") return "bounce";
    if (event.kind === "collapse") return "boom";
    if (event.kind === "record") return "win";
    if (event.kind === "stable") return event.ids.includes(viewer) ? "score" : "tick";
    if (event.kind === "slip") return event.ids.includes(viewer) ? "fail" : undefined;
    return undefined;
  }
};
