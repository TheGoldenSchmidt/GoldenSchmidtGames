import { useState } from "react";
import { PC, shownRacer, type ParcoursGame } from "../../../shared/matches/parcours";
import { blinkOpen, blinkWarn, boxAt, course, gooAt, sweeperAngle, type Look } from "../../../shared/matches/parcoursCourses";
import { ActionButton, CameraSwipe, Stick } from "../controls";
import { chaseStick, lerp, playerColor, type MatchClient, type MatchControlsProps, type MatchFrame } from "../client";

const LOOK_FILL: Record<Look, string> = { floor: "#ffd166", wall: "#6544e8", door: "#ff86c8", pusher: "#e3263b", belt: "#3a3f66", step: "#ffe3a3", seesaw: "#57e4cb", tile: "#bfe6ff", roller: "#b23a48", ledge: "#ffb347", finish: "#fff9ed", trap: "#ffe3a3", hold: "#c98bff" };

/** Canvas fallback: the course from above around the own racer, forward is up. */
function render(ctx: CanvasRenderingContext2D, f: MatchFrame) {
  const s = f.cur, g = s.game as ParcoursGame, prev = f.prev.game as ParcoursGame, c = course(g.course), { w, h } = f, t = f.simTime;
  const me = g.racers[f.viewer] ?? Object.values(g.racers)[0], scale = w / 12.5, camZ = me ? me.z : 0;
  const X = (x: number) => w / 2 + (x-(c.practice?me?.x??0:0)) * scale, Y = (z: number) => h * .7 - (z - camZ) * scale;
  ctx.fillStyle = "#1d2466"; ctx.fillRect(0, 0, w, h);
  // Lower boxes first, so walls and doors cover the floor.
  const boxes = c.boxes.map((b, i) => ({ b, i, bb: boxAt(b, t) })).sort((p, q) => p.bb.y1 - q.bb.y1);
  for (const { b, bb } of boxes) {
    if (b.door !== undefined && g.doors[b.door] === "1") continue;
    if (b.tile !== undefined && g.tiles[b.tile] === "2") continue;
    if (blinkOpen(b, t)) continue;
    ctx.fillStyle = b.tile !== undefined && g.tiles[b.tile] === "1" ? "#7be38f" : blinkWarn(b, t) ? "#ff6a1f" : LOOK_FILL[b.look];
    ctx.fillRect(X(bb.x0), Y(bb.z1), (bb.x1 - bb.x0) * scale, (bb.z1 - bb.z0) * scale);
    if (b.y1 - (b.y0 + (b.look === "floor" || b.look === "finish" || b.look === "belt" ? 1 : 0)) > 1) { ctx.strokeStyle = "#24133f"; ctx.lineWidth = 2; ctx.strokeRect(X(bb.x0), Y(bb.z1), (bb.x1 - bb.x0) * scale, (bb.z1 - bb.z0) * scale); }
  }
  for (let k = 0; k < (c.practice?0:10); k++) { ctx.fillStyle = k % 2 ? "#fff9ed" : "#24133f"; ctx.fillRect(X(-5 + k), Y(c.finishZ) - 4, scale, 8); }
  for (const sw of c.sweepers) {
    const a = sweeperAngle(sw, t), dx = Math.cos(a) * sw.length, dz = Math.sin(a) * sw.length;
    ctx.strokeStyle = sw.y1 <= .8 ? "#ff5f8f" : "#ffe44e"; ctx.lineWidth = Math.max(4, scale * .35); ctx.setLineDash(sw.y1 <= .8 ? [] : [8, 6]);
    ctx.beginPath(); ctx.moveTo(X(sw.x - dx), Y(sw.z - dz)); ctx.lineTo(X(sw.x + dx), Y(sw.z + dz)); ctx.stroke(); ctx.setLineDash([]);
  }
  if (c.goo && me && gooAt(c, t) > me.y - 3) { ctx.fillStyle = "#8dff5a55"; ctx.fillRect(0, 0, w, h); }
  for (const p of s.players) {
    const r = g.racers[p.id], before = prev.racers?.[p.id];
    if (!r || r.respawnAt || r.pose === "out") continue;
    const x = before ? lerp(before.x, r.x, f.alpha) : r.x, z = before ? lerp(before.z, r.z, f.alpha) : r.z, lift = r.grounded ? 0 : 3;
    ctx.fillStyle = playerColor(p.style); ctx.beginPath(); ctx.arc(X(x), Y(z) - lift, scale * PC.radius * (r.duck ? .8 : 1), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.id === f.viewer ? "#ffe44e" : "#24133f"; ctx.lineWidth = p.id === f.viewer ? 3 : 2; ctx.stroke();
    ctx.strokeStyle = "#24133f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(x), Y(z) - lift); ctx.lineTo(X(x + Math.sin(r.face) * .45), Y(z + Math.cos(r.face) * .45) - lift); ctx.stroke();
  }
  if (me?.respawnAt) { ctx.fillStyle = "#24133fcc"; ctx.fillRect(0, h * .4, w, 50); ctx.fillStyle = "#fff9ed"; ctx.font = "900 18px 'Trebuchet MS', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Zurück zum Kontrollpunkt …", w / 2, h * .4 + 25); }
}

function ParcoursControls({ io, view, viewer, active, world }: MatchControlsProps) {
  const g = view.game as ParcoursGame, me = g.racers[viewer], off = !active || !me || me.pose === "done" || me.pose === "out";
  const [, redraw] = useState(0), local = io.local as Record<string, number>;
  // Watching others (after the finish, when out, as a spectator): pick the next racer still in the race.
  const watching = !me || me.pose === "done" || me.pose === "out";
  const shown = shownRacer(g, view.players, viewer, local.watch), slots = view.players.map((p, i) => ({ p, i })).filter(({ p }) => { const r = g.racers[p.id]; return r && r.pose !== "done" && r.pose !== "out" && p.id !== viewer; });
  const next = () => { const at = slots.findIndex(({ p }) => p.id === shown?.id); const pick = slots[(at + 1) % slots.length]; if (pick) { local.watch = pick.i; redraw(n => n + 1); } };
  const shownPlayer = view.players.find(p => p.id === shown?.id);
  if (watching && !view.done) return <>{slots.length > 1 && <button type="button" className="parcours-watch" onClick={next}>
    <i aria-hidden="true" style={{ background: playerColor(shownPlayer?.style ?? 0) }} />Nächste Person zeigen</button>}</>;
  return <>
    {world && <CameraSwipe local={io.local} />}
    <Stick disabled={!active} onMove={(x, y) => chaseStick(io, x, y)} />
    <div className="parcours-buttons">
      <ActionButton icon="⇗" label="Hechten" tone="pink" disabled={off} onPress={() => io.press("b")} />
      <ActionButton icon="⤒" label="Springen" tone="gold" disabled={off} onPress={() => io.press("a")} />
      <ActionButton icon="⤓" label="Ducken" tone="cyan" disabled={off} onPress={() => io.set({ hb: true }, true)} onRelease={() => io.set({ hb: false }, true)} />
      <ActionButton icon="◉" label="Festhalten" tone="cyan" disabled={off} onPress={() => io.set({ ha: true }, true)} onRelease={() => io.set({ ha: false }, true)} />
    </div>
  </>;
}

/** Finals count seconds standing instead of metres. */
export const finalClient = (): MatchClient => ({ ...parcoursClient, unit: "Sekunden" });

export const parcoursClient: MatchClient = {
  render,
  chase: true,
  unit: "Meter",
  world: async () => {
    const [scene, rig] = await Promise.all([import("../../three/parcoursWorld"), import("../../three/riggedFigure")]);
    const chars = await rig.loadCharacterKit();
    return (host, read, onError) => scene.createParcoursWorld(host, read, onError, chars);
  },
  banner(view, viewer) {
    const g = view.game as ParcoursGame, me = g.racers[viewer];
    if (!me || view.done) return undefined;
    if (me.respawnAt) return { title: "Abgestürzt!", text: "Zurück zum Kontrollpunkt …" };
    return undefined;
  },
  quiet: ["jump", "dive", "land", "climb"],
  Controls: ParcoursControls,
  status(view, viewer) {
    const g = view.game as ParcoursGame, c = course(g.course), me = g.racers[viewer], left = Math.max(0, Math.ceil(((g.firstFinish !== undefined ? g.firstFinish + PC.finishGrace : c.limitMs ?? PC.maxMs) - view.time) / 1000));
    if (!me) return `noch ${left} s`;
    const place = g.order.indexOf(viewer);
    if (c.elimination) return me.pose === "out" ? `Raus – du schaust zu · noch ${left} s` : `Du stehst noch · ${Object.values(g.racers).filter(r => r.pose !== "out").length} stehen · noch ${left} s`;
    if (me.pose === "out") return `Raus – du schaust zu · noch ${left} s`;
    return place >= 0 ? `Im Ziel als ${place + 1}. · du schaust zu · noch ${left} s` : `${Math.round(me.best)} von ${c.finishZ} m · ${g.firstFinish !== undefined ? "Zielschluss in" : "noch"} ${left} s`;
  },
  sound(event, viewer) {
    const mine = event.ids[0] === viewer;
    if (event.kind === "jump" || event.kind === "climb") return mine ? "bounce" : undefined;
    if (event.kind === "dive" || event.kind === "grab") return mine ? "power" : undefined;
    if (event.kind === "hit" || event.kind === "fall") return mine ? "fail" : undefined;
    if (event.kind === "out") return mine ? "fail" : "score";
    if (event.kind === "door") return mine ? "boom" : undefined;
    if (event.kind === "tile") return mine ? "fail" : "tick";
    if (event.kind === "hold") return event.ids.includes(viewer) ? "hit" : undefined;
    if (event.kind === "finish") return mine ? "win" : "score";
    return undefined;
  }
};

