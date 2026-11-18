import { useEffect, useRef } from "react";
import { PIECE_KINDS, TW, pieceCells, restingY, type PackedBody, type PieceKind, type TowerGame, type TowerView } from "../../../shared/matches/towerTumble";
import { ActionButton } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame, type MatchIO } from "../client";

type Towers = Record<string, TowerView>;
const towersOf = (game: unknown) => (game as TowerGame).towers as unknown as Towers;

/**
 * One pre-drawn cell per colour and pixel size: a piece then costs four image
 * copies instead of four fills, strokes and state changes per frame.
 */
const sprites = new Map<string, HTMLCanvasElement>();
function cellSprite(color: string, px: number, outline: boolean) {
  const key = `${color}|${px}|${outline}`;
  let c = sprites.get(key);
  if (c) return c;
  if (sprites.size > 64) sprites.clear();
  c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d")!;
  g.fillStyle = color; g.fillRect(0, 0, px, px);
  if (outline) {
    g.fillStyle = "#ffffff40"; g.fillRect(0, 0, px, Math.max(2, px * .18));
    const line = Math.max(1, px * .08);
    g.strokeStyle = "#24133f"; g.lineWidth = line; g.strokeRect(line / 2, line / 2, px - line, px - line);
  }
  sprites.set(key, c);
  return c;
}

/** Draws one piece: centre (x, y) in world units, rotated by `a` (counter-clockwise, y up). */
function piece(ctx: CanvasRenderingContext2D, k: PieceKind, r: number, x: number, y: number, a: number, X: (x: number) => number, Y: (y: number) => number, scale: number, color: string, outline = true) {
  const sprite = cellSprite(color, Math.max(2, Math.round(scale * ctx.getTransform().a)), outline);
  ctx.save(); ctx.translate(X(x), Y(y)); if (a) ctx.rotate(-a);
  for (const [cx, cy] of pieceCells(k, r)) ctx.drawImage(sprite, cx * scale - scale / 2, -cy * scale - scale / 2, scale, scale);
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
  const local = f.local as { towerCam?: number; towerT?: number; sky?: CanvasGradient; skyH?: number };
  if (!local.sky || local.skyH !== h) { local.sky = ctx.createLinearGradient(0, 0, 0, h); local.sky.addColorStop(0, "#6b5bd6"); local.sky.addColorStop(.6, "#ff86c8"); local.sky.addColorStop(1, "#ffd166"); local.skyH = h; }
  ctx.fillStyle = local.sky; ctx.fillRect(0, 0, w, h);
  const side = others.length ? Math.min(118, Math.round(w * .26)) : 0, mainW = w - side;
  if (me) {
    const scale = mainW / (TW.laneHalf * 2 + 1), cx = mainW / 2;
    // Camera: keep the pedestal low on screen at first, then follow the tower top and the falling piece.
    const focus = Math.max(me.height, me.piece ? me.piece.y - 1 : 0);
    const wanted = Math.max(0, focus - (h / scale) * .45), dt = Math.min(.1, Math.max(0, (f.t - (local.towerT ?? f.t)) / 1000));
    // Same glide on 60 Hz and 120 Hz screens: the follow speed depends on time, not on frames.
    local.towerCam = f.reduced || local.towerCam === undefined ? wanted : lerp(local.towerCam, wanted, 1 - Math.exp(-dt * 5)); local.towerT = f.t;
    // Raising the camera moves the world down on screen: the focus stays in the upper part, also at the finish line.
    const floor = h * .72 / scale + local.towerCam;
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

/** Delay before a held arrow repeats, then one half cell per interval (about six cells per second). */
const REPEAT_DELAY = 240, REPEAT_EVERY = 80;
/** Arrow button: a tap moves the piece one half cell, holding keeps moving it. */
function Arrow({ io, dir, disabled }: { io: MatchIO; dir: -1 | 1; disabled: boolean }) {
  const timer = useRef<number | undefined>(undefined);
  const stop = () => { window.clearTimeout(timer.current); window.clearInterval(timer.current); timer.current = undefined; };
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  useEffect(() => stop, []);
  return <ActionButton icon={dir < 0 ? "⇦" : "⇨"} label={dir < 0 ? "Links" : "Rechts"} disabled={disabled}
    onPress={() => { stop(); io.command(dir); timer.current = window.setTimeout(() => { timer.current = window.setInterval(() => io.command(dir), REPEAT_EVERY); }, REPEAT_DELAY); }}
    onRelease={stop} />;
}

export const towerTumbleClient: MatchClient = {
  render,
  unit: "Meter",
  quiet: ["lost", "hold", "drop"],
  Controls({ io, view, viewer, active }) {
    const mine = towersOf(view.game)[viewer], playing = active && !!mine && mine.finishedAt === undefined;
    return <>
      <div className="tower-arrows">
        <Arrow io={io} dir={-1} disabled={!playing} />
        <Arrow io={io} dir={1} disabled={!playing} />
      </div>
      <div className="tower-buttons">
        <ActionButton icon="⟳" label="Drehen" tone="cyan" disabled={!playing} onPress={() => io.press("a")} />
        <ActionButton icon="⇩" label="Fallen" tone="pink" disabled={!playing} onPress={() => io.set({ ha: true }, true)} onRelease={() => io.set({ ha: false }, true)} />
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
