import { dist } from "./geometry";
import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Hook Wars – side view (x 0…20 to the right, y 0…14 up). Robots run on
 * one-way platforms and fire a grappling hook that latches onto anchors
 * (swing and reel in) or yanks opponents, who may drop their core. Each
 * robot delivers cores to its own zone. The hook is a hitscan ray: fair and
 * robust over the network.
 */
export const HW = {
  width: 20, height: 14, radius: .4, gravity: 18, run: 5, groundGrip: .35, airGrip: .07, jump: 7.2,
  hookRange: 7.5, anchorSnap: .7, reel: 5, minRope: 1.2, playerYank: 9, hitCooldown: 4000, missCooldown: 350,
  coreEvery: 6000, maxCores: 3, coreRadius: .35, zoneW: 1.6, fallY: -2, respawnMs: 1500,
  regular: 90000, overtime: 30000, substeps: 2
} as const;
export const PLATFORMS = [
  { x0: .5, x1: 5.5, y: 1.5 }, { x0: 14.5, x1: 19.5, y: 1.5 }, { x0: 1, x1: 5, y: 6 }, { x0: 15, x1: 19, y: 6 },
  { x0: 8, x1: 12, y: 3.5 }, { x0: 7.5, x1: 12.5, y: 9 }, { x0: 2, x1: 6, y: 11 }, { x0: 14, x1: 18, y: 11 }
] as const;
export const ANCHORS = [[5, 13], [10, 13.3], [15, 13], [10, 6.4], [3, 8.6], [17, 8.6], [6.6, 4.6], [13.4, 4.6]] as const;
/** Zones mirror each other left/right; each zone has its spawn right next to it. */
export const ZONES = [[1.6, 1.5], [18.4, 1.5], [1.9, 6], [18.1, 6], [2.9, 11], [17.1, 11]] as const;
const CORE_SPAWNS = [[10, 4.1], [10, 9.6], [10, 12.4], [7, 7.6], [13, 7.6]] as const;
export interface Bot { id: string; x: number; y: number; vx: number; vy: number; grounded: boolean; core: boolean; hook?: { kind: "anchor"; index: number; length: number } ; nextHook: number; nextYank: number; out: boolean; respawnAt: number; delivered: number; lastShot?: { x: number; y: number; at: number; hit: boolean } }
export interface HookGame { bots: Record<string, Bot>; cores: { id: number; x: number; y: number; vy: number }[]; nextCore: number; nextId: number; overtime?: string[]; winner?: string }

const zoneOf = (s: MatchState<HookGame>, id: string) => ZONES[s.players.findIndex(p => p.id === id) % ZONES.length];

function spawn(s: MatchState<HookGame>, b: Bot) {
  const [zx, zy] = zoneOf(s, b.id);
  Object.assign(b, { x: zx < 10 ? zx + 1.6 : zx - 1.6, y: zy + HW.radius, vx: 0, vy: 0, grounded: true, core: false, hook: undefined, out: false });
}

/** First anchor near the ray, or the first opponent hit by it. */
export function castHook(g: HookGame, from: Bot, dx: number, dy: number) {
  const n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
  let best: { kind: "anchor" | "bot"; index?: number; id?: string; along: number } | undefined;
  ANCHORS.forEach(([ax, ay], index) => {
    const rx = ax - from.x, ry = ay - from.y, along = rx * ux + ry * uy, off = Math.abs(rx * uy - ry * ux);
    if (along > 0 && along <= HW.hookRange && off <= HW.anchorSnap && (!best || along < best.along)) best = { kind: "anchor", index, along };
  });
  for (const o of Object.values(g.bots)) {
    if (o.id === from.id || o.out) continue;
    const rx = o.x - from.x, ry = o.y - from.y, along = rx * ux + ry * uy, off = Math.abs(rx * uy - ry * ux);
    if (along > 0 && along <= HW.hookRange && off <= HW.radius * 1.4 && (!best || along < best.along)) best = { kind: "bot", id: o.id, along };
  }
  return { hit: best, end: { x: from.x + ux * (best?.along ?? HW.hookRange), y: from.y + uy * (best?.along ?? HW.hookRange) } };
}

function fireHook(s: MatchState<HookGame>, b: Bot, dx: number, dy: number) {
  const g = s.game;
  if (b.out || s.time < b.nextHook || Math.hypot(dx, dy) < .2) return;
  const { hit, end } = castHook(g, b, dx, dy);
  b.nextHook = s.time + HW.missCooldown;
  b.lastShot = { x: end.x, y: end.y, at: s.time, hit: Boolean(hit) };
  if (hit?.kind === "anchor") { b.hook = { kind: "anchor", index: hit.index!, length: Math.max(HW.minRope, hit.along) }; emit(s, "latch", "", [b.id]); return; }
  if (hit?.kind === "bot" && s.time >= b.nextYank) {
    const target = g.bots[hit.id!], n = dist(b.x, b.y, target.x, target.y) || 1;
    // A successful hook on a robot yanks it closer; a carried core drops.
    target.vx = (b.x - target.x) / n * HW.playerYank; target.vy = (b.y - target.y) / n * HW.playerYank + 2; target.hook = undefined; target.grounded = false;
    if (target.core) { target.core = false; g.cores.push({ id: g.nextId++, x: target.x, y: target.y + .6, vy: 2 }); emit(s, "steal", "Kern abgeluchst!", [target.id, b.id]); }
    else emit(s, "yank", "Herangezogen!", [target.id, b.id]);
    b.nextYank = s.time + HW.hitCooldown;
    return;
  }
  emit(s, "miss", "", [b.id]);
}

function moveBot(s: MatchState<HookGame>, p: MatchPlayer, b: Bot, dt: number) {
  const g = s.game, input = inputOfPlayer(s, p);
  if (b.hook && !input.hb) { b.hook = undefined; emit(s, "release", "", [b.id]); }
  const grip = b.grounded ? HW.groundGrip : HW.airGrip;
  b.vx += (input.x * HW.run - b.vx) * grip;
  if (b.grounded && input.y < -.6 && !b.hook) { b.vy = HW.jump; b.grounded = false; }
  b.vy -= HW.gravity * dt;
  const bottom = b.y - HW.radius;
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.hook) {
    // Rope: reel in while held and keep the robot within the rope length (swing).
    const [ax, ay] = ANCHORS[b.hook.index];
    b.hook.length = Math.max(HW.minRope, b.hook.length - HW.reel * dt);
    const d = dist(b.x, b.y, ax, ay);
    if (d > b.hook.length) {
      const nx = (b.x - ax) / d, ny = (b.y - ay) / d;
      b.x = ax + nx * b.hook.length; b.y = ay + ny * b.hook.length;
      const out = b.vx * nx + b.vy * ny;
      if (out > 0) { b.vx -= out * nx; b.vy -= out * ny; }
    }
  }
  b.grounded = false;
  if (b.vy <= 0) for (const pl of PLATFORMS) {
    if (b.x < pl.x0 || b.x > pl.x1) continue;
    if (bottom >= pl.y - 1e-6 && b.y - HW.radius <= pl.y) { b.y = pl.y + HW.radius; b.vy = 0; b.grounded = true; break; }
  }
  if (b.x < HW.radius) { b.x = HW.radius; b.vx = Math.max(0, b.vx); }
  if (b.x > HW.width - HW.radius) { b.x = HW.width - HW.radius; b.vx = Math.min(0, b.vx); }
  if (b.y > HW.height + 1) { b.y = HW.height + 1; b.vy = Math.min(0, b.vy); }
}

function deliver(s: MatchState<HookGame>, b: Bot) {
  const g = s.game, [zx, zy] = zoneOf(s, b.id);
  if (!b.core || Math.abs(b.x - zx) > HW.zoneW / 2 || Math.abs(b.y - HW.radius - zy) > .3) return;
  b.core = false; b.delivered++;
  emit(s, "deliver", "Kern abgegeben! +1", [b.id]);
  if (g.overtime?.includes(b.id) && !g.winner) { g.winner = b.id; s.done = true; }
}

export const hookWars: MatchModule<HookGame> = {
  id: "hooks",
  meta: {
    name: "Hook Wars", seconds: (HW.regular + HW.overtime) / 1000 + 1, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Schwing dich mit dem Greifhaken durch die Arena, sammle Energiekerne und bring sie in deine Zone. Die meisten Kerne gewinnen.",
    rules: "Lauf mit dem Stick (nach oben = springen). Ziehe rechts in eine Richtung, um den Greifhaken zu schießen: An Ankern schwingst du und wirst herangezogen, loslassen löst das Seil. Sammle Energiekerne und bring sie in deine eigene Zone (+1). Triffst du einen Gegner, ziehst du ihn heran und er verliert seinen Kern (danach 4 Sekunden Pause). Wer abstürzt, verliert seinen Kern. Die meisten Kerne nach 90 Sekunden gewinnen.",
    controls: "Links laufen · rechts ziehen = Haken · loslassen = lösen.",
    look: { icon: "⚓", action: "Schwingen, schnappen, abliefern", hint: "Stick laufen · rechts ziehen für den Haken", goal: "Die meisten Kerne nach 90 s" }
  },
  create(s) {
    s.game = { bots: {}, cores: [], nextCore: 1500, nextId: 1 };
    for (const p of s.players) { const b: Bot = { id: p.id, x: 0, y: 0, vx: 0, vy: 0, grounded: true, core: false, nextHook: 0, nextYank: 0, out: false, respawnAt: 0, delivered: 0 }; s.game.bots[p.id] = b; spawn(s, b); }
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    for (const p of s.players) {
      const b = g.bots[p.id];
      if (p.gone) { b.out = true; continue; }
      if (b.out) { if (s.time >= b.respawnAt) spawn(s, b); continue; }
      for (let i = 0; i < HW.substeps; i++) moveBot(s, p, b, dt / HW.substeps);
      if (b.y < HW.fallY) {
        b.out = true; b.respawnAt = s.time + HW.respawnMs; b.hook = undefined;
        emit(s, "fall", b.core ? "Abgestürzt – Kern verloren" : "Abgestürzt!", [b.id]);
        b.core = false;
        continue;
      }
      const core = g.cores.find(c => !b.core && dist(c.x, c.y, b.x, b.y) < HW.radius + HW.coreRadius);
      if (core) { b.core = true; g.cores = g.cores.filter(c => c !== core); emit(s, "pickup", "Kern geschnappt!", [b.id]); }
      deliver(s, b);
    }
    // Dropped cores fall onto platforms; lost ones vanish.
    for (const c of g.cores) {
      if (c.vy === 0) continue;
      c.vy -= HW.gravity * dt; const before = c.y; c.y += c.vy * dt;
      const pl = PLATFORMS.find(q => c.x >= q.x0 && c.x <= q.x1 && before >= q.y + HW.coreRadius && c.y <= q.y + HW.coreRadius);
      if (pl) { c.y = pl.y + HW.coreRadius; c.vy = 0; }
    }
    g.cores = g.cores.filter(c => c.y > HW.fallY);
    if (s.time >= g.nextCore) {
      g.nextCore = s.time + HW.coreEvery;
      if (g.cores.length < HW.maxCores) {
        const free = CORE_SPAWNS.filter(([x, y]) => !g.cores.some(c => dist(c.x, c.y, x, y) < 1));
        const [x, y] = free[Math.floor(random(s) * free.length)] ?? CORE_SPAWNS[0];
        g.cores.push({ id: g.nextId++, x, y, vy: 0 });
        emit(s, "core", "", []);
      }
    }
    if (!s.done && !g.overtime && s.time >= HW.regular) {
      const active = s.players.filter(p => !p.gone).map(p => g.bots[p.id]), best = Math.max(...active.map(b => b.delivered)), top = active.filter(b => b.delivered === best);
      if (top.length === 1) { g.winner = top[0].id; s.done = true; }
      else { g.overtime = top.map(b => b.id); emit(s, "overtime", "Gleichstand! Die nächste Abgabe entscheidet.", g.overtime); }
    }
  },
  press(s, p, kind) {
    const b = s.game.bots[p.id];
    if (kind !== "b" || !b) return;
    fireHook(s, b, p.input.ax, -p.input.ay);
  },
  remove(s, id) { const b = s.game.bots[id]; if (b) { b.out = true; b.hook = undefined; b.core = false; } },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.bots[p.id].delivered, detail: `${g.bots[p.id].delivered} Kerne abgeliefert`,
      keys: [presence(p), g.winner === p.id ? 1 : 0, g.bots[p.id].delivered] })));
  },
  bot(s, id) {
    const g = s.game, me = g.bots[id];
    if (!me || me.out) return {};
    const [zx, zy] = zoneOf(s, id);
    // Steal from a nearby carrier when the hook is ready, otherwise fetch a core or bring it home.
    const carrier = Object.values(g.bots).find(o => o.id !== id && o.core && !o.out && dist(o.x, o.y, me.x, me.y) < HW.hookRange - .5);
    if (carrier && s.time >= me.nextYank && s.time >= me.nextHook && !me.hook) return { ax: carrier.x - me.x, ay: -(carrier.y - me.y), hb: true, pressB: true };
    const goal = me.core ? { x: zx, y: zy + HW.radius } : g.cores.sort((a, b) => dist(a.x, a.y, me.x, me.y) - dist(b.x, b.y, me.x, me.y))[0] ?? { x: 10, y: 9.4 };
    const dx = goal.x - me.x, dy = goal.y - me.y, x = Math.max(-1, Math.min(1, dx * 1.5));
    if (me.hook) {
      const [ax, ay] = ANCHORS[me.hook.index];
      // Hold while the anchor still brings the robot closer; release near the goal height.
      // A fully reeled rope is let go so the next, higher anchor can be grabbed.
      const keep = me.hook.length > HW.minRope + .05 && dy > -.5 && ay > me.y + .3 && Math.abs(ax - goal.x) < Math.abs(me.x - goal.x) + 1.5;
      return { x, hb: keep, ax: ax - me.x, ay: -(ay - me.y) };
    }
    if (dy > 1.2 && s.time >= me.nextHook) {
      const options = ANCHORS.map(([ax, ay], i) => ({ i, ax, ay, d: dist(ax, ay, goal.x, goal.y) + (hash(`${id}:${i}`) % 7) * .05 }))
        .filter(a => a.ay > me.y + .8 && dist(a.ax, a.ay, me.x, me.y) < HW.hookRange - .3).sort((a, b) => a.d - b.d);
      if (options.length) return { x, ax: options[0].ax - me.x, ay: -(options[0].ay - me.y), hb: true, pressB: true };
    }
    return { x, y: dy > .6 && me.grounded ? -1 : 0 };
  }
};
