import type { RingGame } from "../../../shared/matches/ringCore";
import { SUMO } from "../../../shared/matches/sumoSmash";
import { BUMPER, ITEMS } from "../../../shared/matches/bumperMayhem";
import { ActionButton, Stick } from "../controls";
import type { MatchState } from "../../../shared/matches/types";
import { lerp, playerColor, type MatchClient, type MatchFrame } from "../client";

type Skin = "sumo" | "bumper";
export const ITEM_ICON = { mega: "⬆", oil: "◍", wave: "◎" } as const;
const VIEW = 6.6;

function render(skin: Skin) {
  return (ctx: CanvasRenderingContext2D, f: MatchFrame) => {
    const s = f.cur, g = s.game as RingGame, prev = f.prev.game as RingGame, { w, h } = f;
    const scale = Math.min(w, h) / (VIEW * 2), cx = w / 2, cy = h / 2;
    const X = (x: number) => cx + x * scale, Y = (y: number) => cy + y * scale;
    if (skin === "sumo") {
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#7fc8f8"); sky.addColorStop(1, "#ffe1f0");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffffaa"; for (const [x, y, r] of [[.15, .12, 30], [.8, .2, 40], [.25, .9, 36], [.85, .85, 28]]) { ctx.beginPath(); ctx.arc(w * x, h * y, r, 0, Math.PI * 2); ctx.fill(); }
      const radius = lerp((f.prev.game as RingGame).radius, g.radius, f.alpha);
      ctx.fillStyle = "#6d4c41"; ctx.beginPath(); ctx.ellipse(cx, cy + 10, radius * scale, radius * scale * .98, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e9d7a8"; ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#b23a48"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, radius * scale - 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#b23a4855"; ctx.lineWidth = 3; for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * scale * .5, cy - scale * .6); ctx.lineTo(cx + side * scale * .5, cy + scale * .6); ctx.stroke(); }
    } else {
      ctx.fillStyle = "#14102e"; ctx.fillRect(0, 0, w, h);
      const radius = lerp((f.prev.game as RingGame).radius, g.radius, f.alpha);
      ctx.fillStyle = "#2a2160"; ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#3b2f80"; ctx.lineWidth = 1;
      for (let k = -VIEW; k <= VIEW; k += .8) { ctx.beginPath(); ctx.moveTo(X(k), Y(-VIEW)); ctx.lineTo(X(k), Y(VIEW)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(-VIEW), Y(k)); ctx.lineTo(X(VIEW), Y(k)); ctx.stroke(); }
      ctx.save(); ctx.globalCompositeOperation = "destination-in"; ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = "#ff86c8"; ctx.lineWidth = 5; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(cx, cy, radius * scale, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      for (const o of g.obstacles) {
        const before = prev.obstacles?.find(p => p.id === o.id), ox = before ? lerp(before.x, o.x, f.alpha) : o.x, oy = before ? lerp(before.y, o.y, f.alpha) : o.y;
        ctx.fillStyle = "#ffe44e"; ctx.beginPath(); ctx.arc(X(ox), Y(oy), o.r * scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#24133f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X(ox), Y(oy), o.r * scale * .6, 0, Math.PI * 2); ctx.stroke();
      }
      // Oil slicks (dull until armed) and item boxes with their symbol.
      for (const o of g.slicks ?? []) { ctx.fillStyle = s.time < o.armedAt ? "#0b0a1866" : "#0b0a18d0"; ctx.beginPath(); ctx.ellipse(X(o.x), Y(o.y), ITEMS.oilRadius * scale, ITEMS.oilRadius * scale * .8, .4, 0, Math.PI * 2); ctx.fill(); }
      for (const item of g.items ?? []) {
        const bob = f.reduced ? 0 : Math.sin(f.t / 220 + item.id) * 3, size = .62 * scale;
        ctx.fillStyle = "#6544e8"; ctx.strokeStyle = "#fff9ed"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(X(item.x) - size / 2, Y(item.y) - size / 2 + bob, size, size, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#ffe44e"; ctx.font = `900 ${Math.round(size * .62)}px 'Trebuchet MS', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ITEM_ICON[item.kind], X(item.x), Y(item.y) + bob + 1);
      }
    }
    for (const p of s.players) {
      const fi = g.fighters[p.id], before = prev.fighters?.[p.id];
      if (!fi?.alive || fi.out) continue;
      const smooth = before && !before.out && Math.hypot(before.x - fi.x, before.y - fi.y) < 1.5 ? f.alpha : 1;
      const x = before ? lerp(before.x, fi.x, smooth) : fi.x, y = before ? lerp(before.y, fi.y, smooth) : fi.y, color = playerColor(p.style);
      const body = (skin === "sumo" ? SUMO.body : BUMPER.body) * (s.time < (fi.bigUntil ?? 0) ? ITEMS.megaScale : 1);
      const shielded = s.time < fi.shieldUntil, acting = s.time < fi.actionUntil;
      ctx.save(); ctx.translate(X(x), Y(y));
      if (shielded) { ctx.strokeStyle = "#57e4cb"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, (body + .15) * scale, 0, Math.PI * 2); ctx.stroke(); }
      if (acting && !f.reduced) { ctx.fillStyle = skin === "sumo" ? "#ffffff66" : "#ffe44e66"; ctx.beginPath(); ctx.arc(-Math.cos(fi.heading) * body * scale, -Math.sin(fi.heading) * body * scale, body * scale * .8, 0, Math.PI * 2); ctx.fill(); }
      ctx.rotate(fi.heading);
      if (skin === "sumo") {
        ctx.fillStyle = "#f4c9a0"; ctx.beginPath(); ctx.arc(0, 0, body * scale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(-body * scale * .95, -body * scale * .28, body * scale * 1.9, body * scale * .56);
        ctx.fillStyle = "#24133f"; ctx.beginPath(); ctx.arc(body * scale * .45, 0, body * scale * .28, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#24133f"; ctx.beginPath(); ctx.roundRect(-body * scale, -body * scale * .8, body * scale * 2, body * scale * 1.6, 10); ctx.fill();
        ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-body * scale * .85, -body * scale * .65, body * scale * 1.7, body * scale * 1.3, 8); ctx.fill();
        ctx.fillStyle = "#fff9ed"; ctx.fillRect(body * scale * .45, -body * scale * .5, body * scale * .25, body * scale * 1.0);
      }
      ctx.restore();
      if (p.id === f.viewer) { ctx.strokeStyle = "#ffe44e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(X(x), Y(y), (body + .28) * scale, 0, Math.PI * 2); ctx.stroke(); }
      // Knocked back: spinning stars show that this fighter has no control right now.
      if (s.time < fi.stunUntil) {
        const spin = f.reduced ? 0 : f.t / 160;
        ctx.fillStyle = "#ffe44e"; ctx.font = `900 ${Math.round(body * scale * .9)}px 'Trebuchet MS', sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let k = 0; k < 3; k++) { const a = spin + k * Math.PI * 2 / 3; ctx.fillText("✦", X(x) + Math.cos(a) * body * scale * .9, Y(y) - body * scale * .2 + Math.sin(a) * body * scale * .35); }
      }
      for (let i = 0; i < fi.lives; i++) { ctx.fillStyle = "#ff86c8"; ctx.beginPath(); ctx.arc(X(x) - 10 + i * 10, Y(y) - (body + .45) * scale, 4, 0, Math.PI * 2); ctx.fill(); }
    }
    const me = g.fighters[f.viewer];
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (g.resetAt !== undefined && !s.done) {
      ctx.fillStyle = "#24133fcc"; ctx.fillRect(0, h / 2 - 28, w, 56); ctx.fillStyle = "#fff9ed"; ctx.font = "900 18px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Ring-Out! Neustart von den Startplätzen – ${Math.max(0, Math.ceil((g.resetAt - f.simTime) / 1000))} s`, w / 2, h / 2);
    } else if (me && me.alive && me.out && !s.done) {
      ctx.fillStyle = "#24133fcc"; ctx.fillRect(0, h / 2 - 28, w, 56); ctx.fillStyle = "#fff9ed"; ctx.font = "900 18px 'Trebuchet MS', sans-serif";
      ctx.fillText(`Ring-Out! Zurück in ${Math.max(0, Math.ceil((me.respawnAt - f.simTime) / 1000))} s`, w / 2, h / 2);
    } else if (g.sudden && f.simTime - g.sudden.start < 1500) {
      ctx.fillStyle = "#ff86c8"; ctx.font = "900 24px 'Trebuchet MS', sans-serif"; ctx.fillText("SUDDEN DEATH", w / 2, 36);
    }
  };
}

function client(skin: Skin, actionLabel: string, icon: string, cooldown: number): MatchClient {
  return {
    render: render(skin),
    backdrop: skin === "sumo" ? "#7fc8f8" : "#14102e",
    quiet: ["action", "bump", "strike", "item"],
    Controls({ io, view, viewer, active }) {
      const g = view.game as RingGame, me = g.fighters[viewer];
      const charge = me ? Math.max(0, Math.min(1, (view.time - me.actionAt) / cooldown)) : 0;
      return <>
        <Stick disabled={!active} onMove={(x, y) => io.set({ x, y }, true)} />
        <ActionButton icon={icon} label={actionLabel} tone={skin === "sumo" ? "pink" : "cyan"} charge={charge} disabled={!active || !me?.alive || me.out || g.resetAt !== undefined} onPress={() => io.press("a")} />
      </>;
    },
    status(view, viewer) {
      const g = view.game as RingGame, me = g.fighters[viewer];
      const left = Math.max(0, Math.ceil((75000 - view.time) / 1000));
      return `${g.sudden ? "Sudden Death" : `noch ${left} s`} · ${me ? (me.alive ? `${me.lives} Leben · ${me.ringOuts} Ring-Outs` : "ausgeschieden") : "Zuschauen"}`;
    },
    sound(event, viewer) {
      if (event.kind === "out") return event.ids[1] === viewer ? "win" : event.ids[0] === viewer ? "fail" : "boom";
      if (event.kind === "strike") return event.ids.includes(viewer) ? "hit" : undefined;
      if (event.kind === "action") return event.ids.includes(viewer) ? (skin === "sumo" ? "bounce" : "power") : undefined;
      if (event.kind === "sudden" || event.kind === "reset") return "tick";
      if (event.kind === "mega" || event.kind === "oil") return event.ids.includes(viewer) ? "power" : undefined;
      if (event.kind === "wave") return "boom";
      if (event.kind === "slip") return event.ids[0] === viewer ? "hit" : undefined;
      return undefined;
    }
  };
}

export const sumoClient: MatchClient = {
  ...client("sumo", "Stoß", "✊", SUMO.cooldown),
  // 2.5D with rigged, animated characters (Quaternius, CC0); the canvas stays as fallback.
  world: async () => {
    const [scene, rig] = await Promise.all([import("../../three/sumoWorld"), import("../../three/riggedFigure")]);
    const chars = await rig.loadCharacterKit();
    return (host, read, onError) => scene.createSumoWorld(host, read, onError, chars);
  },
  banner: ringBanner
};
/** After a ring-out everyone waits for the restart from the start places. */
function ringBanner(view: MatchState, viewer: string) {
  const g = view.game as RingGame, me = g.fighters[viewer];
  if (view.done) return undefined;
  // Without a restart for everyone (more than two left) only the fallen one waits.
  if (g.resetAt === undefined) return me?.out && me.alive ? { title: "Ring-Out!", text: `Zurück in ${Math.max(0, Math.ceil((me.respawnAt - view.time) / 1000))} s` } : undefined;
  const left = `${Math.max(0, Math.ceil((g.resetAt - view.time) / 1000))} s`;
  return me?.out ? { title: "Ring-Out!", text: me.alive ? `Neustart in ${left}` : "Du schaust zu" } : { title: "Ring-Out!", text: `Neustart von den Startplätzen – ${left}` };
}
export const bumperClient: MatchClient = {
  ...client("bumper", "Turbo", "⚡", BUMPER.cooldown),
  // 2.5D bumper cars with the chosen figures at the wheel; the canvas stays as fallback.
  world: async () => {
    const [scene, rig] = await Promise.all([import("../../three/bumperWorld"), import("../../three/riggedFigure")]);
    const chars = await rig.loadCharacterKit();
    return (host, read, onError) => scene.createBumperWorld(host, read, onError, chars);
  },
  banner: ringBanner
};
