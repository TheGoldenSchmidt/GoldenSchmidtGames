import { AM, ARROW_KINDS, SLOTS, launch, trajectory, type ArrowGame, type ArrowKind } from "../../../shared/matches/arrowMasters";
import { AimPad } from "../controls";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as ArrowGame, prev = f.prev.game as ArrowGame, { w, h } = f;
  const scale = (w - 8) / AM.width, top = 34, X = (x: number) => 4 + x * scale, Y = (y: number) => top + (AM.height - y) * scale;
  const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#8fd3ff"); sky.addColorStop(.55, "#d8f1ff"); sky.addColorStop(1, "#5c8a3a");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // Castle silhouette and tournament ground.
  ctx.fillStyle = "#9aa7c7"; for (let x = 0; x < AM.width; x += 2.5) ctx.fillRect(X(x), Y(5 + (x % 5 === 0 ? 1.5 : .8)), scale * 1.6, (5 + (x % 5 === 0 ? 1.5 : .8)) * scale);
  ctx.fillStyle = "#6fa84a"; ctx.fillRect(0, Y(0), w, h - Y(0));
  ctx.fillStyle = "#7b5a3a"; for (const [x, y] of SLOTS) ctx.fillRect(X(x - .9), Y(y), 1.8 * scale, .3 * scale);
  ctx.fillStyle = "#6b6f80"; for (const o of g.obstacles) ctx.fillRect(X(o.x0), Y(o.y1), (o.x1 - o.x0) * scale, (o.y1 - o.y0) * scale);
  for (const t of g.targets) for (const [r, c] of [[AM.targetR, "#e3263b"], [AM.targetR * .66, "#fff9ed"], [AM.targetR * .33, "#e3263b"]] as const) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), r * scale, 0, Math.PI * 2); ctx.fill(); }
  // Wind flag.
  ctx.fillStyle = "#24133fcc"; ctx.beginPath(); ctx.roundRect(w / 2 - 70, 4, 140, 24, 12); ctx.fill();
  ctx.fillStyle = "#fff9ed"; ctx.font = "800 13px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(g.wind === 0 ? "Windstill" : `Wind ${g.wind > 0 ? "→" : "←"} ${Math.abs(g.wind).toFixed(1)}`, w / 2, 16);
  for (const p of s.players) {
    const a = g.archers[p.id];
    if (!a) continue;
    const color = playerColor(p.style), x = X(a.x), y = Y(a.y);
    ctx.globalAlpha = a.down ? .35 : 1;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - AM.bodyW * scale / 2, Y(a.y + AM.bodyH * .8), AM.bodyW * scale, AM.bodyH * .8 * scale, 5); ctx.fill();
    ctx.fillStyle = "#f4c9a0"; ctx.beginPath(); ctx.arc(x, Y(a.y + AM.bodyH * .95), AM.bodyW * .32 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#7b5a3a"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + (a.x < AM.width / 2 ? 1 : -1) * scale * .25, Y(a.y + AM.bodyH * .55), scale * .45, a.x < AM.width / 2 ? -1.2 : Math.PI - 1.2, a.x < AM.width / 2 ? 1.2 : Math.PI + 1.2); ctx.stroke();
    ctx.globalAlpha = 1;
    if (p.id === f.viewer) {
      ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 2; ctx.strokeRect(x - AM.bodyW * scale / 2 - 3, Y(a.y + AM.bodyH) - 3, AM.bodyW * scale + 6, AM.bodyH * scale + 6);
      // Positions change every round: point at the own archer at the start of aiming.
      if (g.phase === "aim" && f.simTime - g.phaseStart < 2500) {
        const bob = f.reduced ? 0 : Math.sin(f.t / 140) * 4, tip = Y(a.y + AM.bodyH) - 20 + bob;
        ctx.fillStyle = "#ffe44e"; ctx.strokeStyle = "#24133f"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, tip); ctx.lineTo(x - 9, tip - 12); ctx.lineTo(x + 9, tip - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.font = "900 12px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 3; ctx.strokeText("DU", x, tip - 20); ctx.fillText("DU", x, tip - 20);
      }
    }
    for (let i = 0; i < a.hp; i++) { ctx.fillStyle = "#e3263b"; ctx.beginPath(); ctx.arc(x - 8 + i * 8, Y(a.y + AM.bodyH) - 8, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // Own aim: short preview of the launch arc (without wind).
  const me = g.archers[f.viewer];
  if (g.phase === "aim" && me?.aim) {
    ctx.fillStyle = me.kind === "heavy" ? "#6b2a10" : "#24133f";
    // The triple shot shows its fan.
    for (const turn of me.kind === "triple" ? [-AM.tripleSpread, 0, AM.tripleSpread] : [0])
      for (const [x, y] of trajectory(launch(me), me.aim.angle + turn, me.aim.power, 0, .35, 10)) { ctx.beginPath(); ctx.arc(X(x), Y(y), me.kind === "heavy" ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  for (const [i, arrow] of g.arrows.entries()) {
    const before = prev.arrows?.[i], x = before && before.owner === arrow.owner ? lerp(before.x, arrow.x, f.alpha) : arrow.x, y = before && before.owner === arrow.owner ? lerp(before.y, arrow.y, f.alpha) : arrow.y;
    const angle = Math.atan2(-arrow.vy, arrow.vx), p = s.players.find(q => q.id === arrow.owner);
    ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(angle);
    ctx.strokeStyle = arrow.kind === "heavy" ? "#1b0f22" : "#3b2a1a"; ctx.lineWidth = arrow.kind === "heavy" ? 4 : 2; ctx.beginPath(); ctx.moveTo(-scale * .6, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.fillStyle = p ? playerColor(p.style) : "#fff"; ctx.fillRect(-scale * .6, -3, scale * .18, 6);
    ctx.restore();
  }
  const left = Math.max(0, Math.ceil((AM.aimMs - (f.simTime - g.phaseStart)) / 1000));
  ctx.textAlign = "center"; ctx.font = "900 18px 'Trebuchet MS', sans-serif";
  const below = Y(0) + 26;
  if (g.phase === "aim") { ctx.fillStyle = "#24133f"; ctx.fillText(g.tiebreak && !g.tiebreak.includes(f.viewer) ? "Stechen – du schaust zu" : me?.aim ? `Gespannt ${Math.round(me.aim.power * 100)} % · Schuss in ${left}` : `Ziehen zum Zielen · Schuss in ${left}`, w / 2, below); }
  else if (g.phase === "result") {
    const hits = g.arrows.filter(a => a.owner === f.viewer && a.hit), got = g.arrows.filter(a => a.hit === f.viewer);
    ctx.fillStyle = "#24133f"; ctx.fillText(hits.length ? (hits[0].hit === "target" ? "Zielscheibe getroffen!" : hits[0].hit === f.viewer ? "Eigentreffer!" : "Treffer!") : got.length ? "Du wurdest getroffen" : "Daneben", w / 2, below);
  }
}

export const arrowMastersClient: MatchClient = {
  backdrop: "#8fd3ff",
  render,
  quiet: ["fire"],
  Controls({ io, view, viewer, active }) {
    const g = view.game as ArrowGame, can = active && g.phase === "aim" && !(g.tiebreak && !g.tiebreak.includes(viewer)), me = g.archers[viewer];
    const label: Record<ArrowKind, string> = { normal: "Pfeil", triple: "Dreifach", heavy: "Schwer" };
    return <>
      {!g.tiebreak && me && <div className="arrow-kinds" role="group" aria-label="Pfeilart">
        {ARROW_KINDS.map((kind, i) => {
          const left = kind === "normal" ? undefined : me.specials?.[kind] ?? 0;
          return <button key={kind} type="button" aria-pressed={(me.kind ?? "normal") === kind} disabled={!can || left === 0} onClick={() => io.command(i)}>
            {label[kind]}{left !== undefined && <small>{left}×</small>}
          </button>;
        })}
      </div>}
      <div className="arrow-aim-area"><AimPad label="Bogen spannen und zielen" radius={130}
        onAim={(x, y) => { if (can) io.set({ ax: x, ay: y }, true); }}
        onRelease={() => io.set({ ax: 0, ay: 0 }, true)}>
        <span className="arrow-aim-hint" aria-hidden="true">Hier ziehen: entgegen der Schussrichtung</span>
      </AimPad></div>
    </>;
  },
  status(view) {
    const g = view.game as ArrowGame;
    return g.tiebreak ? "Präzisions-Stechen" : `Runde ${g.round} von ${AM.rounds} · ${g.phase === "aim" ? "Zielen" : g.phase === "flight" ? "Pfeile fliegen" : "Auswertung"}`;
  },
  sound(event, viewer) {
    if (event.kind === "fire") return "shot";
    if (event.kind === "hit") return event.ids[1] === viewer ? "score" : event.ids[0] === viewer ? "hit" : undefined;
    if (event.kind === "target") return event.ids.includes(viewer) ? "score" : undefined;
    if (event.kind === "down") return event.ids[1] === viewer ? "win" : undefined;
    if (event.kind === "round") return "tick";
    return undefined;
  }
};
