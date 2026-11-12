import { emit, hash, inputOfPlayer, presence, rank, random, type MatchModule, type MatchState } from "./types";

/**
 * Neon Pong – Power Pong. Portrait field: team 0 defends the bottom edge,
 * team 1 the top edge. Every device sees its own team at the bottom; inputs
 * are screen-relative and mirrored here for team 1. Ball physics run in
 * sub-steps so fast balls cannot tunnel through paddles.
 */
export const NP = {
  halfW: 4.5, halfH: 8, paddleY: 7, paddleT: .32, ball: .22,
  paddleSolo: 2.1, paddleDuo: 1.7, wide: 1.6, paddleSpeed: 42,
  startSpeed: 6.5, speedUp: .45, maxSpeed: 15, maxAngle: Math.PI / 3,
  serveDelay: 1200, goalsToWin: 7, regular: 90000, goldenMax: 30000,
  powerEvery: [10000, 15000] as const, powerRadius: .5,
  wideMs: 5000, curveMs: 6000, slowMs: 4000, slowFactor: .55, curveAccel: 8, substeps: 6,
  /** Overlap of the two 2v2 ranges around the centre line. */
  duoOverlap: .9
} as const;
export type PowerKind = "wide" | "multi" | "curve" | "slow";
export interface Ball { id: number; x: number; y: number; vx: number; vy: number; speed: number; lastTeam: number; curve: number; extra: boolean }
export interface Paddle { id: string; team: number; x: number; min: number; max: number }
export interface PongGame {
  score: [number, number];
  balls: Ball[];
  nextBall: number;
  paddles: Paddle[];
  serveAt: number;
  serveTo: number;
  power?: { kind: PowerKind; x: number; y: number };
  nextPower: number;
  effects: ({ kind: PowerKind; until: number } | undefined)[];
  golden: boolean;
  winner?: number;
  lastGoal?: { team: number; at: number };
}

const width = (g: PongGame, p: Paddle) => (g.paddles.filter(q => q.team === p.team).length > 1 ? NP.paddleDuo : NP.paddleSolo) * (g.effects[p.team]?.kind === "wide" ? NP.wide : 1);
/** Team 0 hits upwards (towards negative y). */
const forward = (team: number) => team === 0 ? -1 : 1;

function serve(s: MatchState<PongGame>) {
  const g = s.game, angle = (random(s) - .5) * Math.PI / 3, dir = g.serveTo === 0 ? 1 : -1;
  g.balls.push({ id: g.nextBall++, x: 0, y: 0, vx: Math.sin(angle) * NP.startSpeed, vy: Math.cos(angle) * NP.startSpeed * dir, speed: NP.startSpeed, lastTeam: -1, curve: 0, extra: false });
  emit(s, "serve", "Aufschlag!", []);
}

function collect(s: MatchState<PongGame>, ball: Ball) {
  const g = s.game, power = g.power;
  if (!power || ball.lastTeam < 0 || Math.hypot(ball.x - power.x, ball.y - power.y) > NP.powerRadius + NP.ball) return;
  // At most one active effect per team; a blocked power-up stays on the field.
  if (g.effects[ball.lastTeam]) return;
  g.power = undefined;
  const team = ball.lastTeam, ids = s.players.filter(p => p.team === team).map(p => p.id);
  if (power.kind === "multi") {
    for (const turn of [-.45, .45]) {
      const angle = Math.atan2(ball.vx, ball.vy) + turn;
      g.balls.push({ id: g.nextBall++, x: ball.x, y: ball.y, vx: Math.sin(angle) * ball.speed, vy: Math.cos(angle) * ball.speed, speed: ball.speed, lastTeam: team, curve: 0, extra: true });
    }
    g.effects[team] = { kind: "multi", until: Infinity };
  } else g.effects[team] = { kind: power.kind, until: s.time + (power.kind === "wide" ? NP.wideMs : power.kind === "curve" ? NP.curveMs : NP.slowMs) };
  emit(s, "power", power.kind === "wide" ? "Breiter Schläger!" : power.kind === "multi" ? "Mehrball!" : power.kind === "curve" ? "Kurvenbälle!" : "Zeitlupe!", ids);
}

function score(s: MatchState<PongGame>, team: number) {
  const g = s.game;
  g.score[team]++;
  g.lastGoal = { team, at: s.time };
  g.serveTo = 1 - team;
  emit(s, "goal", "Tor!", s.players.filter(p => p.team === team).map(p => p.id));
  if (g.score[team] >= NP.goalsToWin || g.golden) { g.winner = team; s.done = true; g.balls = []; }
}

function moveBall(s: MatchState<PongGame>, ball: Ball, dt: number) {
  const g = s.game;
  const slowTeam = g.effects.findIndex(e => e?.kind === "slow");
  // Slow motion only for balls flying towards the team that collected it.
  const towards = ball.vy > 0 ? 0 : 1, factor = slowTeam === towards ? NP.slowFactor : 1;
  if (ball.curve) ball.vx += ball.curve * dt;
  const length = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx = ball.vx / length * ball.speed; ball.vy = ball.vy / length * ball.speed;
  const px = ball.x, py = ball.y;
  ball.x += ball.vx * dt * factor; ball.y += ball.vy * dt * factor;
  if (Math.abs(ball.x) > NP.halfW - NP.ball) { ball.x = Math.sign(ball.x) * (NP.halfW - NP.ball) * 2 - ball.x; ball.vx = -ball.vx; ball.curve = -ball.curve * .5; emit(s, "wall", "", []); }
  for (const paddle of g.paddles) {
    const line = paddle.team === 0 ? NP.paddleY : -NP.paddleY, incoming = paddle.team === 0 ? ball.vy > 0 : ball.vy < 0;
    const edge = line - Math.sign(line) * (NP.paddleT / 2 + NP.ball);
    const crossed = paddle.team === 0 ? py <= edge && ball.y >= edge : py >= edge && ball.y <= edge;
    if (!incoming || !crossed) continue;
    const half = width(g, paddle) / 2, t = (edge - py) / (ball.y - py || 1), hitX = px + (ball.x - px) * t;
    if (Math.abs(hitX - paddle.x) > half + NP.ball) continue;
    const offset = Math.max(-1, Math.min(1, (hitX - paddle.x) / half)), angle = offset * NP.maxAngle;
    ball.speed = Math.min(NP.maxSpeed, ball.speed + NP.speedUp);
    ball.vx = Math.sin(angle) * ball.speed; ball.vy = Math.cos(angle) * ball.speed * forward(paddle.team);
    ball.x = hitX; ball.y = edge; ball.lastTeam = paddle.team;
    ball.curve = g.effects[paddle.team]?.kind === "curve" ? (offset >= 0 ? -1 : 1) * NP.curveAccel : 0;
    emit(s, "hit", "", [paddle.id]);
    break;
  }
  collect(s, ball);
}

export const neonPong: MatchModule<PongGame> = {
  id: "pong",
  meta: {
    name: "Neon Pong", seconds: (NP.regular + NP.goldenMax) / 1000 + 2, players: [2, 4], hz: 20,
    instruction: "Ziehe den Finger waagrecht über die untere Bildschirmhälfte, um deinen Schläger zu bewegen. Wo der Ball den Schläger trifft, bestimmt den Abprallwinkel. Ball durch Power-ups schießen: breiter Schläger, Mehrball, Kurvenbälle oder Zeitlupe. Zuerst 7 Tore oder nach 90 Sekunden mehr Tore; bei Gleichstand entscheidet das nächste Tor. Zu viert spielt ihr 2 gegen 2.",
    controls: "Finger waagrecht ziehen: Schläger folgt.",
    look: { icon: "◐", action: "Verteidige dein Neon-Tor", hint: "Waagrecht ziehen, Ball zurückschlagen", goal: "7 Tore oder mehr nach 90 s" }
  },
  teams: count => Array.from({ length: count }, (_, i) => i % 2),
  create(s) {
    const paddles: Paddle[] = [];
    for (const team of [0, 1]) {
      const members = s.players.filter(p => p.team === team);
      members.forEach((p, i) => {
        // Screen-left seat of each team; team 1 is mirrored in world coordinates.
        const half = (members.length > 1 ? NP.paddleDuo : NP.paddleSolo) / 2;
        let min = -NP.halfW + half, max = NP.halfW - half;
        if (members.length > 1) { if (i === 0) max = NP.duoOverlap; else min = -NP.duoOverlap; }
        if (team === 1) [min, max] = [-max, -min];
        paddles.push({ id: p.id, team, x: (min + max) / 2, min, max });
      });
    }
    s.game = { score: [0, 0], balls: [], nextBall: 1, paddles, serveAt: NP.serveDelay, serveTo: random(s) < .5 ? 0 : 1, nextPower: NP.powerEvery[0] + random(s) * (NP.powerEvery[1] - NP.powerEvery[0]), effects: [undefined, undefined], golden: false };
    return s.game;
  },
  step(s, dt) {
    const g = s.game;
    for (const team of [0, 1]) {
      const effect = g.effects[team];
      if (effect && (effect.kind === "multi" ? !g.balls.some(b => b.extra) : s.time >= effect.until)) g.effects[team] = undefined;
    }
    // Paddles follow the absolute finger position with a common speed limit.
    for (const paddle of g.paddles) {
      const p = s.players.find(q => q.id === paddle.id)!, input = inputOfPlayer(s, p);
      const screen = (input.x + 1) / 2, target = paddle.team === 0 ? paddle.min + screen * (paddle.max - paddle.min) : paddle.max - screen * (paddle.max - paddle.min);
      const half = width(g, paddle) / 2, lo = Math.max(paddle.min, -NP.halfW + half), hi = Math.min(paddle.max, NP.halfW - half);
      const goal = Math.max(lo, Math.min(hi, p.gone ? paddle.x : target));
      paddle.x += Math.max(-NP.paddleSpeed * dt, Math.min(NP.paddleSpeed * dt, goal - paddle.x));
      paddle.x = Math.max(lo, Math.min(hi, paddle.x));
    }
    if (!g.balls.length && s.time >= g.serveAt) serve(s);
    for (let i = 0; i < NP.substeps && !s.done; i++) {
      for (const ball of [...g.balls]) {
        moveBall(s, ball, dt / NP.substeps);
        if (Math.abs(ball.y) > NP.halfH + NP.ball) {
          g.balls = g.balls.filter(b => b !== ball);
          score(s, ball.y > 0 ? 1 : 0);
          if (s.done) return;
          if (!g.balls.length) g.serveAt = s.time + NP.serveDelay;
        }
      }
    }
    if (!g.power && s.time >= g.nextPower) {
      const kinds: PowerKind[] = ["wide", "multi", "curve", "slow"];
      g.power = { kind: kinds[Math.floor(random(s) * kinds.length)], x: (random(s) - .5) * 6, y: (random(s) - .5) * 5 };
      g.nextPower = s.time + NP.powerEvery[0] + random(s) * (NP.powerEvery[1] - NP.powerEvery[0]);
      emit(s, "spawn", "Power-up erscheint!", []);
    }
    if (!g.golden && s.time >= NP.regular) {
      if (g.score[0] !== g.score[1]) { g.winner = g.score[0] > g.score[1] ? 0 : 1; s.done = true; }
      else { g.golden = true; emit(s, "golden", "Golden Goal!", []); }
    }
  },
  remove(s) {
    const g = s.game;
    for (const team of [0, 1]) if (!s.players.some(p => p.team === team && !p.gone)) { g.winner = 1 - team; s.done = true; }
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.score[p.team], detail: `Team ${p.team === 0 ? "Unten" : "Oben"} · ${g.score[p.team]}:${g.score[1 - p.team]}`,
      keys: [g.winner === undefined ? 0 : g.winner === p.team ? 1 : 0, g.score[p.team] - g.score[1 - p.team], presence(p)] })));
  },
  finish(s) { const g = s.game; if (g.winner === undefined && g.score[0] !== g.score[1]) g.winner = g.score[0] > g.score[1] ? 0 : 1; },
  bot(s, id) {
    const g = s.game, paddle = g.paddles.find(p => p.id === id), me = s.players.find(p => p.id === id);
    if (!paddle || !me) return {};
    const line = paddle.team === 0 ? NP.paddleY : -NP.paddleY;
    // Predict where incoming balls cross the paddle line, including wall bounces.
    const incoming = g.balls.filter(b => paddle.team === 0 ? b.vy > 0 : b.vy < 0)
      .map(b => { const t = (line - b.y) / b.vy, raw = b.x + b.vx * t, span = 2 * (NP.halfW - NP.ball); let x = ((raw + NP.halfW - NP.ball) % (2 * span) + 2 * span) % (2 * span); if (x > span) x = 2 * span - x; return { t, x: x - NP.halfW + NP.ball }; })
      .sort((a, b) => a.t - b.t);
    // Bots react once a ball is in their half and aim with a per-rally error, so they can miss.
    const error = ((hash(`${id}:${g.nextBall}:${g.score.join()}:${Math.floor(s.time / 4000)}`) % 100) / 100 - .5) * 3.2;
    const ownHalf = incoming.filter(b => b.t < 1.1);
    const target = ownHalf.length ? ownHalf[0].x + error : (paddle.min + paddle.max) / 2;
    const screen = paddle.team === 0 ? (target - paddle.min) / (paddle.max - paddle.min) : (paddle.max - target) / (paddle.max - paddle.min);
    return { x: Math.max(-1, Math.min(1, screen * 2 - 1)) };
  }
};
