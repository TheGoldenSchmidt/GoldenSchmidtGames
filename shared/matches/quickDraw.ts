import { activePlayers, emit, hash, presence, rank, random, type MatchModule, type MatchPlayer, type MatchState } from "./types";

/**
 * Quick Draw – Western Showdown. The authority alone knows the signal time and
 * reveals it to devices once it has passed. Devices report the time between
 * seeing the signal and tapping; the authority clamps that value to what its
 * own clock and the measured round trip allow.
 */
export type DecoyKind = "crow" | "lamp" | "sign";
export interface QuickDrawShot { at: number; reaction: number | null; early: boolean }
export interface QuickDrawRound {
  index: number;
  kind: "duel" | "group" | "tiebreak";
  startAt: number;
  /** Hidden from devices until reached. */
  signalAt?: number;
  decoys: { at: number; kind: DecoyKind }[];
  participants: string[];
  shots: Record<string, QuickDrawShot>;
  resolvedAt?: number;
  winners: string[];
  points: Record<string, number>;
}
export interface QuickDrawGame {
  mode: "duel" | "group";
  rounds: QuickDrawRound[];
  score: Record<string, number>;
  tiebreakWins: Record<string, number>;
  best: Record<string, number>;
  falseStarts: Record<string, number>;
}

export const QD = {
  /** Calm phase before the earliest possible signal. */
  minDelay: 2000, maxDelay: 5000,
  window: 2500, resultPause: 2600,
  duelWins: 3, duelMaxRounds: 9, groupRounds: 5, maxTiebreaks: 3,
  /** Faster reactions are anticipation and count as a false start. */
  minReaction: 80,
  /** Snapshot interval plus processing margin added to the round trip. */
  margin: 60, maxRtt: 300
} as const;
const GROUP_POINTS = [3, 2, 1];

function newRound(s: MatchState<QuickDrawGame>, kind: QuickDrawRound["kind"], participants: string[]) {
  const g = s.game, startAt = s.time;
  const signalAt = startAt + QD.minDelay + Math.round(random(s) * (QD.maxDelay - QD.minDelay) / 50) * 50;
  const decoys: QuickDrawRound["decoys"] = [];
  const count = random(s) < .35 ? 0 : random(s) < .65 ? 1 : 2;
  const kinds: DecoyKind[] = ["crow", "lamp", "sign"];
  for (let i = 0; i < count; i++) {
    const earliest = startAt + 700, latest = signalAt - 650;
    if (latest <= earliest) break;
    decoys.push({ at: earliest + Math.round(random(s) * (latest - earliest) / 50) * 50, kind: kinds[Math.floor(random(s) * kinds.length)] });
  }
  decoys.sort((a, b) => a.at - b.at);
  g.rounds.push({ index: g.rounds.length + 1, kind, startAt, signalAt, decoys, participants, shots: {}, winners: [], points: {} });
  emit(s, "round", kind === "tiebreak" ? "Stechen! Ruhig bleiben …" : `Runde ${g.rounds.length}: Hand an den Colt …`, participants);
}

const current = (s: MatchState<QuickDrawGame>) => s.game.rounds.at(-1)!;
const live = (s: MatchState<QuickDrawGame>, r: QuickDrawRound) => r.participants.filter(id => !s.players.find(p => p.id === id)?.gone);

function resolve(s: MatchState<QuickDrawGame>, r: QuickDrawRound) {
  const g = s.game;
  r.resolvedAt = s.time;
  const valid = live(s, r).filter(id => r.shots[id] && !r.shots[id].early && r.shots[id].reaction !== null)
    .sort((a, b) => r.shots[a].reaction! - r.shots[b].reaction!);
  for (const id of valid) g.best[id] = Math.min(g.best[id] ?? Infinity, r.shots[id].reaction!);
  const fastest = valid.length ? r.shots[valid[0]].reaction : null;
  if (r.kind === "group") {
    // Equal reaction times share the better place and its points.
    for (const id of valid) {
      const place = valid.filter(other => r.shots[other].reaction! < r.shots[id].reaction!).length;
      r.points[id] = GROUP_POINTS[place] ?? 0;
      g.score[id] += r.points[id];
    }
    r.winners = valid.filter(id => r.shots[id].reaction === fastest);
  } else if (r.kind === "duel") {
    const early = r.participants.filter(id => r.shots[id]?.early);
    // A false start loses the round; the opponent wins it without needing to shoot.
    if (early.length === 1) r.winners = r.participants.filter(id => id !== early[0] && !s.players.find(p => p.id === id)?.gone);
    else if (!early.length) r.winners = valid.filter(id => r.shots[id].reaction === fastest);
    if (r.winners.length === 1) { g.score[r.winners[0]]++; r.points[r.winners[0]] = 1; } else r.winners = [];
  } else {
    r.winners = valid.filter(id => r.shots[id].reaction === fastest);
    if (r.winners.length === 1) { g.tiebreakWins[r.winners[0]]++; r.points[r.winners[0]] = 1; } else r.winners = [];
  }
  const names = r.winners.length ? "Treffer!" : "Kein gültiger Schuss.";
  emit(s, "result", names, r.winners);
}

function leaders(s: MatchState<QuickDrawGame>) {
  const ids = activePlayers(s).map(p => p.id), top = Math.max(...ids.map(id => s.game.score[id]));
  return ids.filter(id => s.game.score[id] === top);
}

function nextRoundOrEnd(s: MatchState<QuickDrawGame>) {
  const g = s.game, active = activePlayers(s);
  if (active.length < 2) { s.done = true; return; }
  if (g.mode === "duel") {
    if (active.some(p => g.score[p.id] >= QD.duelWins) || g.rounds.length >= QD.duelMaxRounds) { s.done = true; return; }
    newRound(s, "duel", active.map(p => p.id));
    return;
  }
  const regular = g.rounds.filter(r => r.kind === "group").length;
  if (regular < QD.groupRounds) { newRound(s, "group", active.map(p => p.id)); return; }
  const top = leaders(s), tiebreaks = g.rounds.filter(r => r.kind === "tiebreak");
  const decided = tiebreaks.some(r => r.winners.length === 1);
  if (top.length > 1 && !decided && tiebreaks.length < QD.maxTiebreaks) { newRound(s, "tiebreak", top); return; }
  s.done = true;
}

export const quickDraw: MatchModule<QuickDrawGame> = {
  id: "quickdraw",
  meta: {
    name: "Quick Draw", seconds: 120, players: [2, 3, 4, 5, 6], hz: 20,
    instruction: "Warte auf das rote »ZIEH!« und tippe dann so schnell wie möglich. Wer vorher tippt, begeht einen Fehlstart. Krähen, Lampen und Schilder sind Täuschungen. Zu zweit: Wer zuerst 3 Duelle gewinnt, siegt. Ab drei Personen: 5 Durchgänge, die drei Schnellsten erhalten 3, 2 und 1 Punkt.",
    controls: "Tippe irgendwo auf die Straße, um zu ziehen.",
    look: { icon: "✶", action: "Zieh, sobald das Signal kommt", hint: "Tippe erst beim roten »ZIEH!«", goal: "Schnellster gültiger Schuss" }
  },
  create(s) {
    const ids = s.players.map(p => p.id);
    const zero = () => Object.fromEntries(ids.map(id => [id, 0]));
    s.game = { mode: ids.length === 2 ? "duel" : "group", rounds: [], score: zero(), tiebreakWins: zero(), best: {}, falseStarts: zero() };
    newRound(s, s.game.mode, ids);
    return s.game;
  },
  step(s) {
    const r = current(s);
    if (r.resolvedAt === undefined) {
      if (r.signalAt !== undefined && s.time >= r.signalAt && s.time - 50 < r.signalAt) emit(s, "signal", "ZIEH!", r.participants);
      for (const decoy of r.decoys) if (s.time >= decoy.at && s.time - 50 < decoy.at) emit(s, "decoy", "", []);
      const everyone = live(s, r).every(id => r.shots[id]);
      // In a duel a false start decides the round at once.
      const duelDecided = r.kind === "duel" && r.participants.some(id => r.shots[id]?.early);
      if (s.time >= r.signalAt! + QD.window || duelDecided || everyone && (s.time >= r.signalAt! || live(s, r).every(id => r.shots[id].early))) resolve(s, r);
      return;
    }
    if (s.time >= r.resolvedAt + QD.resultPause) nextRoundOrEnd(s);
  },
  press(s, p: MatchPlayer, kind, at, value) {
    if (kind !== "n") return;
    const r = current(s);
    if (r.resolvedAt !== undefined || !r.participants.includes(p.id) || r.shots[p.id] || at < r.startAt) return;
    const signalAt = r.signalAt!;
    // The authority's clock decides false starts; a device admitting it saw no signal is also early.
    if (at < signalAt || value < 0) {
      r.shots[p.id] = { at, reaction: null, early: true };
      s.game.falseStarts[p.id]++;
      emit(s, "false", "Fehlstart!", [p.id]);
      return;
    }
    if (at > signalAt + QD.window) return;
    const elapsed = at - signalAt, slack = Math.min(p.rtt, QD.maxRtt) + QD.margin;
    const reaction = Math.round(Math.min(elapsed, Math.max(elapsed - slack, 0, value)));
    if (reaction < QD.minReaction) {
      r.shots[p.id] = { at, reaction: null, early: true };
      s.game.falseStarts[p.id]++;
      emit(s, "false", "Zu früh gezogen!", [p.id]);
      return;
    }
    r.shots[p.id] = { at, reaction, early: false };
    emit(s, "shot", "Peng!", [p.id]);
  },
  remove(s) {
    const r = current(s);
    if (r.resolvedAt === undefined && live(s, r).every(id => r.shots[id])) resolve(s, r);
  },
  standings(s) {
    const g = s.game;
    return rank(s.players.map(p => ({ id: p.id, score: g.score[p.id], keys: [presence(p), g.score[p.id], g.tiebreakWins[p.id]],
      detail: g.best[p.id] !== undefined ? `Bestzeit ${g.best[p.id]} ms` : "Keine gültige Reaktion" })));
  },
  finish(s) {
    const r = current(s);
    if (r.resolvedAt === undefined && s.time >= (r.signalAt ?? Infinity)) resolve(s, r);
  },
  view(s) {
    const r = current(s);
    if (r.signalAt !== undefined && s.time < r.signalAt) delete r.signalAt;
    r.decoys = r.decoys.filter(d => d.at <= s.time);
    // Reaction times stay secret until the round is resolved.
    if (r.resolvedAt === undefined) for (const shot of Object.values(r.shots)) shot.reaction = null;
  },
  bot(s, id) {
    const r = current(s);
    if (r.resolvedAt !== undefined || !r.participants.includes(id) || r.shots[id]) return {};
    const seed = hash(`${id}:${r.index}`);
    // Bots sometimes flinch at a decoy, otherwise react within 220–480 ms.
    const flinch = r.decoys.find(d => s.time >= d.at && s.time - d.at < 200);
    if (flinch && seed % 100 < 6) return { command: -1 };
    if (r.signalAt === undefined) return {};
    const delay = 220 + seed % 260;
    return s.time - r.signalAt >= delay ? { command: s.time - r.signalAt } : {};
  }
};
