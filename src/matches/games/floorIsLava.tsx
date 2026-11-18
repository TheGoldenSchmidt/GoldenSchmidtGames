import { FL, FLOOR_TILES, dropping, grounded, type LavaGame } from "../../../shared/matches/floorIsLava";
import { ActionButton, CameraSwipe, Stick } from "../controls";
import { useEffect, useState } from "react";
import { chaseStick, lerp, playerColor, type ChaseLocal, type MatchClient, type MatchControlsProps, type MatchFrame } from "../client";

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as LavaGame, prev = f.prev.game as LavaGame, { w, h } = f;
  const size = Math.floor(Math.min((w - 8) / FL.cols, (h - 8) / FL.rows)), ox = (w - size * FL.cols) / 2, oy = (h - size * FL.rows) / 2;
  const X = (x: number) => ox + x * size, Y = (y: number) => oy + y * size;
  // Lava: slow glow, static with reduced motion.
  const glow = f.reduced ? .5 : .5 + Math.sin(f.t / 700) * .15;
  const lava = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * .7);
  lava.addColorStop(0, `rgba(255,${Math.round(140 + glow * 60)},60,1)`); lava.addColorStop(1, "#8a1d12");
  ctx.fillStyle = lava; ctx.fillRect(0, 0, w, h);
  // Only the viewer's floor is drawn in full; through its holes the floor below shows dark and small.
  const floor = g.runners[f.viewer]?.floor ?? 0, base = floor * FLOOR_TILES, below = floor + 1 < FL.floors ? base + FLOOR_TILES : -1;
  for (let j = 0; j < FLOOR_TILES; j++) {
    const top = g.tiles[base + j];
    if (below < 0 || (top !== "0" && top !== "3") || g.tiles[below + j] === "0" || g.tiles[below + j] === "3") continue;
    ctx.fillStyle = "#5a4630"; ctx.fillRect(X(j % FL.cols) + size * .18, Y(Math.floor(j / FL.cols)) + size * .18, size * .64, size * .64);
  }
  for (let j = 0; j < FLOOR_TILES; j++) {
    const i = base + j, tile = g.tiles[i], x = X(j % FL.cols), y = Y(Math.floor(j / FL.cols));
    if (tile === "0") continue;
    if (tile === "3") { ctx.strokeStyle = "#57e4cb88"; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.strokeRect(x + 4, y + 4, size - 8, size - 8); ctx.setLineDash([]); continue; }
    const left = tile === "2" ? Math.max(0, (g.timers[i] ?? s.time) - f.simTime) / FL.crackMs : 1;

    const shake = tile === "2" && !f.reduced ? Math.sin(f.t / 30 + i) * (1 - left) * 2 : 0;
    ctx.fillStyle = tile === "2" ? `rgb(${Math.round(120 + (1 - left) * 80)},${Math.round(100 - (1 - left) * 40)},80)` : "#a8946a";
    ctx.fillRect(x + 2 + shake, y + 2, size - 4, size - 4);
    ctx.fillStyle = "#00000022"; ctx.fillRect(x + 2 + shake, y + size - 7, size - 4, 5);
    if (g.regen[i] === "1") { ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + size / 2 + shake, y + size / 2, size * .18, 0, Math.PI * 2); ctx.stroke(); }
    if (tile === "2") { ctx.strokeStyle = "#2a1a10"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + size * .2 + shake, y + size * .3); ctx.lineTo(x + size * .5 + shake, y + size * .55); ctx.lineTo(x + size * .8 + shake, y + size * .4); ctx.moveTo(x + size * .5 + shake, y + size * .55); ctx.lineTo(x + size * .45 + shake, y + size * .85); ctx.stroke(); }
  }
  for (const p of s.players) {
    const r = g.runners[p.id], before = prev.runners?.[p.id];
    // Out, or in the lava until the return.
    if (!r?.alive || r.respawnAt) continue;
    const x = before?.alive ? lerp(before.x, r.x, f.alpha) : r.x, y = before?.alive ? lerp(before.y, r.y, f.alpha) : r.y;
    // Runners on other floors appear as faint ghosts; a falling runner shrinks into the floor below.
    ctx.globalAlpha = r.floor === floor ? 1 : .3;
    if (r.floor !== floor && dropping(s, r) && r.floor - 1 === floor) ctx.globalAlpha = .6;
    const air = !grounded(s, r), lift = air ? size * .25 : 0, blink = f.simTime < r.invulnUntil && !f.reduced && Math.floor(f.t / 110) % 2 === 0;
    ctx.fillStyle = "#00000055"; ctx.beginPath(); ctx.ellipse(X(x), Y(y) + size * .12, size * FL.radius, size * FL.radius * .5, 0, 0, Math.PI * 2); ctx.fill();
    if (blink) { ctx.globalAlpha = 1; continue; }
    // Shove: a white streak behind; facing shown as a small nose.
    if (s.time < r.shoveUntil && !f.reduced) { ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(x), Y(y) - lift); ctx.lineTo(X(x - r.fx * .6), Y(y - r.fy * .6) - lift); ctx.stroke(); }
    ctx.fillStyle = playerColor(p.style); ctx.beginPath(); ctx.arc(X(x), Y(y) - lift, size * FL.radius * (air ? 1.15 : 1), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a1a10"; ctx.beginPath(); ctx.arc(X(x + r.fx * FL.radius * .7), Y(y + r.fy * FL.radius * .7) - lift, size * .06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.id === f.viewer ? "#ffe44e" : "#2a1a10"; ctx.lineWidth = p.id === f.viewer ? 3 : 2; ctx.stroke();
    for (let i = 0; i < r.lives; i++) { ctx.fillStyle = "#fff9ed"; ctx.beginPath(); ctx.arc(X(x) - size * .12 + i * size * .24, Y(y) - lift - size * .5, size * .07, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#2a0f0ae6"; ctx.beginPath(); ctx.roundRect(8, 8, 92, 26, 13); ctx.fill();
  ctx.fillStyle = "#ffd166"; ctx.font = "800 13px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`Etage ${floor + 1} von ${FL.floors}`, 54, 21);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (g.phase !== "play") {
    const last = g.history.at(-1);
    ctx.fillStyle = "#2a1a10dd"; ctx.fillRect(0, h / 2 - 40, w, 80);
    ctx.fillStyle = "#ffe44e"; ctx.font = "900 22px 'Trebuchet MS', sans-serif";
    ctx.fillText(last?.tiebreak ? "Stechrunde vorbei" : `Durchgang ${g.round} vorbei`, w / 2, h / 2 - 12);
    ctx.fillStyle = "#fff9ed"; ctx.font = "800 15px 'Trebuchet MS', sans-serif";
    ctx.fillText(last?.winners.includes(f.viewer) ? "Du stehst am längsten!" : `+${last?.points[f.viewer] ?? 0} Punkte für dich`, w / 2, h / 2 + 16);
  }
}

/** The camera choice is a per-device convenience: remembered locally, never sent. */
const CAMERA_KEY = "gsg-lava-overview";
function storedOverview() { try { return localStorage.getItem(CAMERA_KEY) === "1"; } catch { return false; } }

function LavaControls({ io, view, viewer, active, world }: MatchControlsProps) {
  const g = view.game as LavaGame, me = g.runners[viewer], local = io.local as ChaseLocal;
  const [overview, setOverview] = useState(storedOverview);
  useEffect(() => { local.overview = overview ? 1 : 0; try { localStorage.setItem(CAMERA_KEY, overview ? "1" : "0"); } catch { /* private mode */ } }, [overview]);
  const charge = (ready: number, cooldown: number) => me ? Math.max(0, Math.min(1, 1 - (ready - view.time) / cooldown)) : 0;
  const off = !active || !me?.alive || g.phase !== "play";
  // With the chase camera the stick is relative to the camera: up runs away from it.
  const move = (x: number, y: number) => chaseStick(io, x, y);
  return <>
    {world && !overview && <CameraSwipe local={io.local} />}
    {world && <button type="button" className="match-camera" aria-pressed={overview} onClick={() => setOverview(v => !v)}>Übersicht</button>}
    <Stick disabled={!active} onMove={move} />
    <div className="lava-buttons">
      <ActionButton icon="⇉" label="Schubsen" tone="pink" charge={charge(me?.shoveReady ?? 0, FL.shoveCooldown)} disabled={off} onPress={() => io.press("b")} />
      <ActionButton icon="⇗" label="Hechten" tone="cyan" charge={charge(me?.diveReady ?? 0, FL.diveCooldown)} disabled={off} onPress={() => io.command(1)} />
      <ActionButton icon="⤒" label="Springen" tone="gold" charge={charge(me?.jumpReady ?? 0, FL.jumpCooldown)} disabled={off} onPress={() => io.press("a")} />
    </div>
  </>;
}

export const floorIsLavaClient: MatchClient = {
  render,
  chase: true,
  // 2.5D presentation; the canvas above stays as fallback without WebGL.
  world: () => import("../../three/lavaWorld").then(m => m.createLavaWorld),
  banner(view, viewer) {
    const g = view.game as LavaGame, last = g.history.at(-1), me = g.runners[viewer];
    // In the lava for a moment: the return is announced (the canvas hides the figure meanwhile).
    if (g.phase === "play" && me?.alive && me.respawnAt) return { title: "In der Lava!", text: `Ein Leben weg – gleich bist du zurück (${me.lives} übrig)` };
    if (g.phase === "play" || view.done) return undefined;
    return { title: last?.tiebreak ? "Stechrunde vorbei" : `Durchgang ${g.round} vorbei`, text: last?.winners.includes(viewer) ? "Du stehst am längsten!" : `+${last?.points[viewer] ?? 0} Punkte für dich` };
  },
  quiet: ["jump", "dash", "drop", "dive", "back"],
  Controls: LavaControls,
  status(view, viewer) {
    const g = view.game as LavaGame, me = g.runners[viewer];
    const left = Math.max(0, Math.ceil(((g.tiebreak ? FL.tiebreakMax : FL.roundMax) - (view.time - g.roundStart)) / 1000));
    return `${g.tiebreak ? "Stechrunde" : `Runde ${g.round}/${FL.rounds}`} · ${g.phase === "play" ? `${left} s` : "Pause"} · ${me?.alive ? `Etage ${me.floor + 1}/${FL.floors}` : "raus"}`;
  },
  sound(event, viewer) {
    if (event.kind === "jump" || event.kind === "drop") return event.ids.includes(viewer) ? "bounce" : undefined;
    if (event.kind === "dive") return event.ids.includes(viewer) ? "power" : undefined;
    if (event.kind === "hit" || event.kind === "out") return event.ids[0] === viewer ? "fail" : event.ids[1] === viewer ? "win" : "hit";
    if (event.kind === "shove") return event.ids[0] === viewer ? "hit" : event.ids[1] === viewer ? "bounce" : undefined;
    if (event.kind === "result") return event.ids.includes(viewer) ? "win" : "score";
    if (event.kind === "round" || event.kind === "shrink") return "tick";
    return undefined;
  }
};
