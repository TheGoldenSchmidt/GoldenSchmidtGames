import { PIECE_KINDS, TW, pieceCells, restingY, type PackedBody, type PieceKind, type TowerGame, type TowerView } from "../../../shared/matches/towerTumble";
import { ActionButton, SliderPad } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

type Towers = Record<string, TowerView>;
const towersOf = (game: unknown) => (game as TowerGame).towers as unknown as Towers;

function cell(ctx: CanvasRenderingContext2D, size: number, color: string, outline = true) {
  ctx.fillStyle = color; ctx.fillRect(-size / 2, -size / 2, size, size);
  if (!outline) return;
  ctx.fillStyle = "#ffffff40"; ctx.fillRect(-size / 2, -size / 2, size, Math.max(2, size * .18));
  ctx.strokeStyle = "#24133f"; ctx.lineWidth = Math.max(1, size * .08); ctx.strokeRect(-size / 2 + ctx.lineWidth / 2, -size / 2 + ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
}

/** Draws one piece: centre (x, y) in world units, rotated by `a` (counter-clockwise, y up). */
function piece(ctx: CanvasRenderingContext2D, k: PieceKind, r: number, x: number, y: number, a: number, X: (x: number) => number, Y: (y: number) => number, scale: number, color: string, outline = true) {
  ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(-a);
  for (const [cx, cy] of pieceCells(k, r)) { ctx.save(); ctx.translate(cx * scale, -cy * scale); cell(ctx, scale, color, outline); ctx.restore(); }
  ctx.restore();
}

/** Bodies interpolated by id between the last two snapshots. */
function bodies(cur: PackedBody[], prev: PackedBody[] | undefined, alpha: number) {
  const before = new Map((prev ?? []).map(b => [b[0], b]));
  return cur.map(b => {
    const p = before.get(b[0]);
    return p ? { k: PIECE_KINDS[b[1]], r: b[2], x: lerp(p[3], b[3], alpha), y: lerp(p[4], b[4], alpha), a: lerp(p[5], b[5], alpha) } : { k: PIECE_KINDS[b[1]], r: b[2], x: b[3], y: b[4], a: b[5] };
  });
}

function goalLine(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, size: number) {
  for (let x = x0, i = 0; x < x1; x += size, i++) { ctx.fillStyle = i % 2 ? "#24133f" : "#fff9ed"; ctx.fillRect(x, y - size / 2, Math.min(size, x1 - x), size); }
}

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, towers = towersOf(s.game), prevTowers = towersOf(f.prev.game), { w, h } = f;
  const me = towers[f.viewer], others = s.players.filter(p => p.id !== f.viewer && towers[p.id]);
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#6b5bd6"); sky.addColorStop(.6, "#ff86c8"); sky.addColorStop(1, "#ffd166");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  const side = others.length ? Math.min(118, Math.round(w * .26)) : 0, mainW = w - side;
  if (me) {
    const scale = mainW / (TW.laneHalf * 2 + 1), cx = mainW / 2;
    // Camera: keep the pedestal low on screen at first, then follow the tower top and the falling piece.
    const local = f.local as { towerCam?: number }, focus = Math.max(me.height, me.piece ? me.piece.y - 1 : 0);
    const wanted = Math.max(0, focus - (h / scale) * .45);
    local.towerCam = f.reduced || local.towerCam === undefined ? wanted : lerp(local.towerCam, wanted, .08);
    const floor = h * .72 / scale - local.towerCam;
    const X = (x: number) => cx + x * scale, Y = (y: number) => (floor - y) * scale;
    // Height marks every 2 m and the checkered finish line.
    ctx.font = "800 11px 'Trebuchet MS', sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    for (let y = 2; y < TW.goal + 8; y += 2) { if (Y(y) < -10 || Y(y) > h) continue; ctx.fillStyle = "#24133f2a"; ctx.fillRect(0, Y(y), mainW, 1); ctx.fillStyle = "#24133f99"; ctx.textAlign = "right"; ctx.fillText(`${y} m`, mainW - 4, Y(y) - 7); }
    goalLine(ctx, 0, mainW, Y(TW.goal), Math.max(6, scale * .3));
    ctx.fillStyle = "#24133f"; ctx.font = "900 13px 'Trebuchet MS', sans-serif"; ctx.textAlign = "left"; ctx.fillText(`ZIEL ${TW.goal} m`, 80, Y(TW.goal) - scale * .45);
    // Pedestal.
    ctx.fillStyle = "#4b3a7a"; ctx.fillRect(X(-TW.baseHalf), Y(0), TW.baseHalf * 2 * scale, h);
    ctx.fillStyle = "#ffe44e"; ctx.fillRect(X(-TW.baseHalf), Y(0), TW.baseHalf * 2 * scale, Math.max(3, scale * .12));
    const color = playerColor(s.players.find(p => p.id === f.viewer)?.style ?? 0);
    for (const b of bodies(me.packed, prevTowers[f.viewer]?.packed, f.alpha)) piece(ctx, b.k, b.r, b.x, b.y, b.a, X, Y, scale, color);
    if (me.piece) {
      const p = me.piece, before = prevTowers[f.viewer]?.piece, same = before?.n === p.n && before.r === p.r;
      const x = same ? lerp(before.x, p.x, f.alpha) : p.x, y = same ? lerp(before.y, p.y, f.alpha) : p.y;
      // Landing guide: where the piece would touch the tower if dropped straight down.
      const ghost = restingY(me, p.k, p.r, p.x);
      if (ghost !== undefined && ghost < y) { ctx.globalAlpha = .28; piece(ctx, p.k, p.r, p.x, ghost, 0, X, Y, scale, "#fff9ed", false); ctx.globalAlpha = 1; }
      ctx.strokeStyle = "#fff9ed88"; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5;
      for (const [ccx] of pieceCells(p.k, p.r)) { ctx.beginPath(); ctx.moveTo(X(p.x + ccx), Y(y)); ctx.lineTo(X(p.x + ccx), Y(ghost ?? 0)); ctx.stroke(); }
      ctx.setLineDash([]);
      piece(ctx, p.k, p.r, x, y, 0, X, Y, scale, color);
    }
    // Next piece and the hold countdown.
    const next = (s.game as TowerGame).sequence[me.next];
    if (next) {
      ctx.fillStyle = "#24133fcc"; ctx.beginPath(); ctx.roundRect(6, 6, 66, 58, 10); ctx.fill();
      ctx.fillStyle = "#fff9ed"; ctx.font = "800 10px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText("NÄCHSTER", 39, 16);
      piece(ctx, next, 0, 0, 0, 0, x => 39 + x * 11, y => 40 - y * 11, 11, color);
    }
    if (me.holdSince !== undefined && me.finishedAt === undefined) {
      const left = Math.max(0, TW.holdMs - (f.simTime - me.holdSince)) / 1000;
      ctx.fillStyle = "#24133fdd"; ctx.beginPath(); ctx.roundRect(cx - 80, h * .3 - 30, 160, 60, 14); ctx.fill();
      ctx.fillStyle = "#ffe44e"; ctx.font = "900 26px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.fillText(`Halten! ${left.toFixed(1)}`, cx, h * .3);
    }
  }
  // The other towers as small columns on the right, each from the pedestal up to the finish line.
  if (others.length) {
    const box = Math.min(150, (h * .62) / others.length), sc = Math.min((side - 16) / (TW.laneHalf * 2), (box - 22) / (TW.goal + 2));
    ctx.fillStyle = "#24133f55"; ctx.fillRect(mainW, 0, side, h);
    others.forEach((p, i) => {
      const t = towers[p.id], top = 6 + i * box, base = top + box - 14, mx = mainW + side / 2, color = playerColor(p.style);
      const X = (x: number) => mx + x * sc, Y = (y: number) => base - y * sc;
      ctx.globalAlpha = p.gone ? .35 : 1;
      goalLine(ctx, X(-TW.laneHalf), X(TW.laneHalf), Y(TW.goal), Math.max(2, sc * .4));
      ctx.fillStyle = "#4b3a7a"; ctx.fillRect(X(-TW.baseHalf), Y(0), TW.baseHalf * 2 * sc, 4);
      ctx.save(); ctx.beginPath(); ctx.rect(mainW, top, side, box - 4); ctx.clip();
      for (const b of bodies(t.packed, prevTowers[p.id]?.packed, f.alpha)) piece(ctx, b.k, b.r, b.x, b.y, b.a, X, Y, sc, color, false);
      ctx.restore();
      ctx.fillStyle = color; ctx.font = "900 11px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center";
      ctx.fillText(t.finishedAt !== undefined ? "ZIEL!" : `${t.height.toFixed(1)} m`, mx, base + 8);
      ctx.globalAlpha = 1;
    });
  }
}

export const towerTumbleClient: MatchClient = {
  render,
  unit: "Meter",
  quiet: ["lost", "hold", "drop"],
  Controls({ io, view, viewer, active }) {
    const mine = towersOf(view.game)[viewer], playing = active && !!mine && mine.finishedAt === undefined;
    return <>
      <SliderPad className="tower-slider" label="Stein verschieben" onMove={x => { if (playing) io.set({ x, hb: true }, true); }} onRelease={() => io.set({ hb: false }, true)}>
        <span className="tower-hint" aria-hidden="true">⟵ hier ziehen: Stein verschieben ⟶</span>
      </SliderPad>
      <div className="tower-buttons">
        <ActionButton icon="⟳" label="Drehen" tone="cyan" disabled={!playing} onPress={() => io.press("a")} />
        <ActionButton icon="⇩" label="Fallen" disabled={!playing} onPress={() => io.set({ ha: true }, true)} onRelease={() => io.set({ ha: false }, true)} />
      </div>
    </>;
  },
  status(view, viewer) {
    const mine = towersOf(view.game)[viewer], left = Math.max(0, Math.ceil((TW.regular - view.time) / 1000));
    if (!mine) return `noch ${left} s`;
    return `${mine.height.toFixed(1)} von ${TW.goal} m · ${mine.lost} verloren · noch ${left} s`;
  },
  sound(event, viewer) {
    if (event.kind === "lost") return event.ids.includes(viewer) ? "fail" : undefined;
    if (event.kind === "hold") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "finish") return event.ids.includes(viewer) ? "win" : "fail";
    return undefined;
  }
};
