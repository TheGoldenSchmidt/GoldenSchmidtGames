import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Chaos Run – side-scrolling auto-runner. Runners do not collide with each
 * other (version 1), so every runner is simulated independently on the same
 * seeded course. y is the height above the ground line (up is positive).
 */
export const CR = {
  speed: 6, gravity: 24, jump: 8.5, holdGravity: .45, holdMs: 260, fastFall: -14,
  slideMs: 800, height: 1.2, slideHeight: .55, width: .6,
  stunMs: 550, knockback: -5, fallLimit: -3, respawnMs: 800,
  start: 8, moduleLength: 24, modules: 8, finishRun: 10, maxMs: 90000,
  bridgeCollapse: 600, hammerPeriod: 2400, wallPeriod: 3000, platformPeriod: 2400
} as const;
export type ModuleKind = "gap" | "hammer" | "platform" | "bridge" | "wall" | "beam";
export interface CourseModule { kind: ModuleKind; x0: number; length: number; phase: number }
export interface Runner {
  id: string; x: number; y: number; vx: number; vy: number; grounded: boolean;
  jumpAt: number; slideUntil: number; stunUntil: number; respawnAt: number; fallen: boolean;
  checkpoint: number; best: number; bestAt: number; finishAt?: number;
  /** Per-runner bridge tiles: tile x → collapse time. */
  bridge: Record<string, number>;
}
export interface RunGame { course: CourseModule[]; length: number; runners: Record<string, Runner>; order: string[] }

/** Course geometry derived from the module list (pure, shared by authority, bots and rendering). */
export function courseLayout(course: CourseModule[]) {
  const gaps: [number, number][] = [], platforms: { x0: number; x1: number; phase: number }[] = [], hammers: { x: number; phase: number }[] = [];
  const walls: { x: number; phase: number }[] = [], beams: [number, number][] = [], bridges: [number, number][] = [];
  for (const m of course) {
    const mid = m.x0 + m.length / 2;
    if (m.kind === "gap") gaps.push([mid - 1.3, mid + 1.3]);
    if (m.kind === "platform") { gaps.push([mid - 3.2, mid + 3.2]); platforms.push({ x0: mid - 1.1, x1: mid + 1.1, phase: m.phase }); }
    if (m.kind === "bridge") { gaps.push([mid - 4, mid + 4]); bridges.push([mid - 4, mid + 4]); }
    if (m.kind === "hammer") hammers.push({ x: mid, phase: m.phase });
    if (m.kind === "wall") walls.push({ x: mid, phase: m.phase });
    if (m.kind === "beam") beams.push([mid - 1.5, mid + 1.5]);
  }
  return { gaps, platforms, hammers, walls, beams, bridges };
}
export type Layout = ReturnType<typeof courseLayout>;
/** Moving platform height (0…1.6) at a time. */
export const platformY = (phase: number, time: number) => .8 - .8 * Math.cos(2 * Math.PI * (time / CR.platformPeriod) + phase);
/** Hammer swings low through the lane for 40 % of its cycle. */
export const hammerLow = (phase: number, time: number) => ((time / CR.hammerPeriod + phase) % 1 + 1) % 1 < .4;
/** The wall rises for half of its cycle; closed walls are 1.7 high (high jump clears them). */
export const wallClosed = (phase: number, time: number) => ((time / CR.wallPeriod + phase) % 1 + 1) % 1 < .5;
const WALL_HEIGHT = 1.7, BEAM_BOTTOM = .85, HAMMER_HEIGHT = .9;

function inside(range: [number, number], x: number) { return x > range[0] && x < range[1]; }

function step(s: MatchState<RunGame>, layout: Layout, p: MatchPlayer, r: Runner, dt: number) {
  const g = s.game, time = s.time;
  if (r.finishAt !== undefined) return;
  if (r.fallen) {
    if (time < r.respawnAt) return;
    Object.assign(r, { x: r.checkpoint + .5, y: 0, vx: CR.speed, vy: 0, grounded: true, fallen: false, stunUntil: 0, bridge: {} });
  }
  const input = inputOfPlayer(s, p), stunned = time < r.stunUntil;
  r.vx += ((stunned ? 0 : CR.speed) - r.vx) * (stunned ? .08 : .25);
  const before = r.y;
  // Holding after a jump makes the arc higher.
  const held = input.ha && r.vy > 0 && time - r.jumpAt < CR.holdMs;
  r.vy -= CR.gravity * (held ? CR.holdGravity : 1) * dt;
  r.x += r.vx * dt; r.y += r.vy * dt;
  const sliding = time < r.slideUntil, height = sliding ? CR.slideHeight : CR.height;
  // Ground, gaps, bridges and moving platforms.
  let floor = -Infinity;
  const overGap = layout.gaps.some(gap => inside(gap, r.x));
  if (!overGap) floor = 0;
  for (const [b0, b1] of layout.bridges) if (inside([b0, b1], r.x)) {
    const tile = String(Math.floor(r.x - b0)), collapse = r.bridge[tile];
    if (collapse === undefined || time < collapse) floor = 0;
  }
  for (const pl of layout.platforms) if (inside([pl.x0, pl.x1], r.x)) { const py = platformY(pl.phase, time); if (before >= py - .25) floor = Math.max(floor, py); }
  r.grounded = false;
  if (r.y <= floor && r.vy <= 0 && before >= floor - .3) {
    r.y = floor; r.vy = 0; r.grounded = true;
    for (const [b0, b1] of layout.bridges) if (inside([b0, b1], r.x) && floor === 0) { const tile = String(Math.floor(r.x - b0)); r.bridge[tile] ??= time + CR.bridgeCollapse; }
  }
  if (r.y < CR.fallLimit) {
    r.fallen = true; r.respawnAt = time + CR.respawnMs;
    emit(s, "fall", "Abgestürzt! Zurück zum Checkpoint", [r.id]);
    return;
  }
  // Hazards: hammers, rising walls and low beams knock the runner back.
  const hitBack = (text: string, push: number) => { r.x -= push; r.vx = CR.knockback; r.vy = Math.max(r.vy, 2); r.stunUntil = time + CR.stunMs; emit(s, "hit", text, [r.id]); };
  if (!stunned) {
    for (const h of layout.hammers) if (Math.abs(r.x - h.x) < .7 && r.y < HAMMER_HEIGHT && hammerLow(h.phase, time)) { hitBack("Vom Hammer erwischt!", .4); break; }
    for (const w of layout.walls) if (Math.abs(r.x - w.x) < .45 && r.y < WALL_HEIGHT && wallClosed(w.phase, time)) { r.x = w.x - .5; hitBack("Gegen die Wand!", .3); break; }
    for (const beam of layout.beams) if (inside([beam[0] - .2, beam[1] + .2], r.x) && r.y + height > BEAM_BOTTOM) { r.x = Math.min(r.x, beam[0] - .3); hitBack("Ducken nicht vergessen!", .2); break; }
  }
  const checkpoint = g.course.filter(m => m.x0 <= r.x).at(-1)?.x0 ?? 0;
  if (checkpoint > r.checkpoint && r.grounded && !overGap) { r.checkpoint = checkpoint; emit(s, "checkpoint", "Checkpoint!", [r.id]); }
  if (r.x > r.best + 1e-9) { r.best = Math.min(r.x, g.length); r.bestAt = time; }
  if (r.x >= g.length) { r.finishAt = time; r.best = g.length; emit(s, "finish", "Im Ziel!", [r.id]); }
}

export const chaosRun: MatchModule<RunGame> = {
  id: "chaosrun",
  meta: {
    name: "Chaos Run", seconds: CR.maxMs / 1000 + 1, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Deine Figur rennt von selbst. Tippe zum Springen, halte länger für einen höheren Sprung, wische nach unten zum Rutschen. Weiche Lücken, Hämmern, Wänden und niedrigen Balken aus; Brücken stürzen hinter dir ein. Nach einem Sturz geht es am letzten Checkpoint weiter. Wer zuerst im Ziel ist, gewinnt; nach 90 Sekunden zählt der weiteste Fortschritt.",
    controls: "Tippen springen · halten höher · nach unten wischen rutschen.",
    look: { icon: "⚑", action: "Durch den Hindernisparcours", hint: "Tippen springen · runter wischen rutschen", goal: "Zuerst im Ziel" }
  },
  create(s) {
    // Every module type appears; order and timing phases come from the seed.
    const kinds: ModuleKind[] = ["gap", "hammer", "platform", "bridge", "wall", "beam"];
    const order = [...kinds, kinds[Math.floor(random(s) * kinds.length)], kinds[Math.floor(random(s) * kinds.length)]];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const course = order.slice(0, CR.modules).map((kind, i) => ({ kind, x0: CR.start + i * CR.moduleLength, length: CR.moduleLength, phase: Math.round(random(s) * 100) / 100 }));
    const length = CR.start + CR.modules * CR.moduleLength + CR.finishRun;
    s.game = { course, length, order: s.players.map(p => p.id), runners: Object.fromEntries(s.players.map(p => [p.id, { id: p.id, x: 1, y: 0, vx: 0, vy: 0, grounded: true, jumpAt: -9999, slideUntil: 0, stunUntil: 0, respawnAt: 0, fallen: false, checkpoint: 0, best: 1, bestAt: 0, bridge: {} }])) };
    return s.game;
  },
  step(s, dt) {
    const layout = courseLayout(s.game.course);
    for (const p of s.players) if (!p.gone) for (let i = 0; i < 2; i++) step(s, layout, p, s.game.runners[p.id], dt / 2);
    if (s.players.every(p => p.gone || s.game.runners[p.id].finishAt !== undefined)) s.done = true;
  },
  press(s, p, kind) {
    const r = s.game.runners[p.id];
    if (!r || r.fallen || r.finishAt !== undefined) return;
    if (kind === "a" && r.grounded && s.time >= r.stunUntil) { r.vy = CR.jump; r.jumpAt = s.time; r.grounded = false; r.slideUntil = 0; emit(s, "jump", "", [p.id]); }
    if (kind === "b") { if (!r.grounded) r.vy = Math.min(r.vy, CR.fastFall); r.slideUntil = s.time + CR.slideMs; emit(s, "slide", "", [p.id]); }
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => {
      const r = g.runners[p.id], percent = Math.round(r.best / g.length * 100);
      return { id: p.id, score: percent, detail: r.finishAt !== undefined ? `Im Ziel nach ${(r.finishAt / 1000).toFixed(1)} s` : `${percent} % geschafft`,
        keys: [presence(p), r.finishAt !== undefined ? 1 : 0, r.finishAt !== undefined ? -r.finishAt : 0, Math.round(r.best * 100), -r.bestAt] };
    }));
  },
  bot(s, id) {
    const g = s.game, r = g.runners[id], layout = courseLayout(g.course);
    if (!r || r.fallen || r.finishAt !== undefined) return {};
    const ahead = (x: number, from: number, to: number) => x - r.x > from && x - r.x < to;
    const skill = hash(id) % 3;
    const gap = layout.gaps.some(([a]) => ahead(a, .1, .7 + skill * .1)) && !layout.bridges.some(([b0]) => ahead(b0, -.2, 9));
    const platform = layout.platforms.some(pl => ahead(pl.x0 - 2.2, 0, .5));
    const hammer = layout.hammers.some(h => ahead(h.x, .6, 1.4) && hammerLow(h.phase, s.time + 150));
    const wall = layout.walls.some(w => ahead(w.x, .7, 1.6) && wallClosed(w.phase, s.time + 200));
    // Slide in front of and under a beam; renew the slide before it runs out.
    const beam = layout.beams.some(([b0, b1]) => r.x > b0 - 1.2 && r.x < b1 + .4);
    if (beam && s.time >= r.slideUntil - 120) return { pressB: true };
    if (r.grounded && (gap || platform || hammer || wall)) return { pressA: true, ha: wall || platform };
    return { ha: r.vy > 0 && s.time - r.jumpAt < CR.holdMs };
  }
};
