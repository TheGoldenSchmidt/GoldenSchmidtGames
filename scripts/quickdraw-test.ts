import assert from "node:assert/strict";
import { advanceMatch, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { QD, type QuickDrawGame, type QuickDrawRound } from "../shared/matches/quickDraw";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import { applyPartyAction, createPartyGame, partyMiniResults, tickParty, type PartyGame } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type QD = MatchState<QuickDrawGame>;
const make = (count: number, seed = 11) => createMatch("quickdraw", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as QD;
const round = (s: QD): QuickDrawRound => s.game.rounds.at(-1)!;
const seqs = new Map<string, number>();
/** One tap: `at` is authority time, `claim` the device-measured reaction (-1 = before seeing the signal). */
function shoot(s: QD, id: string, at: number, claim: number, rtt?: number) {
  const p = s.players.find(q => q.id === id)!;
  if (rtt !== undefined) p.rtt = rtt;
  advanceMatch(s, at);
  const seq = (seqs.get(`${s.seed}:${id}`) ?? 0) + 1; seqs.set(`${s.seed}:${id}`, seq);
  return setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN + 1, n: claim }, seq, at);
}
const settle = (s: QD) => { const r = round(s); advanceMatch(s, Math.max(s.time, r.signalAt! + QD.window) + 50); };
const nextRound = (s: QD) => { const r = round(s); if (r.resolvedAt === undefined) settle(s); advanceMatch(s, r.resolvedAt! + QD.resultPause + 50); };

// Signalzeit: 2–5 Sekunden nach Rundenbeginn, vorher verborgen, Täuschungen erst sichtbar, wenn sie stattfinden.
for (let seed = 1; seed < 200; seed++) {
  const s = make(3, seed), r = round(s), delay = r.signalAt! - r.startAt;
  assert.ok(delay >= QD.minDelay && delay <= QD.maxDelay, `Signal nach ${delay} ms`);
  assert.ok(r.decoys.every(d => d.at > r.startAt && d.at < r.signalAt!));
  assert.equal(round(publicMatch(s, "p0") as QD).signalAt, undefined);
  assert.equal(round(publicMatch(s, "p0") as QD).decoys.length, 0);
  assert.deepEqual(make(3, seed).game, s.game, "Gleicher Startwert, gleiche Runde");
}
{
  const s = make(2, 5), r = round(s);
  advanceMatch(s, r.signalAt! - 50);
  assert.equal(round(publicMatch(s, "p0") as QD).signalAt, undefined, "Kurz vor dem Signal noch geheim");
  advanceMatch(s, r.signalAt!);
  assert.equal(round(publicMatch(s, "p0") as QD).signalAt, r.signalAt, "Ab dem Signal sichtbar");
  assert.ok(s.events.some(e => e.kind === "signal"));
}

// Duell: schnellerer gültiger Schuss gewinnt; Reaktionszeit wird gegen die Serveruhr geprüft.
{
  const s = make(2), r = round(s);
  shoot(s, "p1", r.signalAt! + 330, 360, 0);
  shoot(s, "p0", r.signalAt! + 400, 250, 100);
  advanceMatch(s, r.signalAt! + 450);
  assert.equal(r.resolvedAt, r.signalAt! + 450, "Beide geschossen: im nächsten Schritt aufgelöst");
  assert.equal(r.shots.p0.reaction, 250, "Ehrliche Angabe innerhalb der Laufzeit");
  assert.equal(r.shots.p1.reaction, 330, "Mehr als die Serverdauer wird auf die Serverdauer begrenzt");
  assert.deepEqual(r.winners, ["p0"]);
  assert.equal(s.game.score.p0, 1);
  // Verdeckt bis zur Auflösung, danach sichtbar.
  assert.equal(round(publicMatch(s, "p1") as QD).shots.p0.reaction, 250);
}
{
  // Manipulierte, zu schnelle Angabe: höchstens Laufzeit + Takt Vorteil.
  const s = make(2), r = round(s);
  shoot(s, "p0", r.signalAt! + 600, 90, 120);
  assert.equal(r.shots.p0.reaction, 600 - 120 - QD.margin);
  // Unter 80 ms ist vorweggenommen und ein Fehlstart.
  const t = make(2, 99), q = round(t);
  shoot(t, "p0", q.signalAt! + 60, 60, 0);
  assert.equal(q.shots.p0.early, true);
  // -1 nach dem Signal: das Gerät hat das Signal noch nicht gezeigt, also Fehlstart.
  const u = make(2, 98), v = round(u);
  shoot(u, "p1", v.signalAt! + 20, -1, 300);
  assert.equal(v.shots.p1.early, true);
}
{
  // Fehlstart vor dem Signal: der Gegner gewinnt die Runde sofort.
  const s = make(2), r = round(s);
  shoot(s, "p1", r.signalAt! - 300, 0);
  assert.equal(r.shots.p1.early, true);
  advanceMatch(s, s.time + 50);
  assert.ok(r.resolvedAt! < r.signalAt!, "Noch vor dem Signal entschieden");
  assert.deepEqual(r.winners, ["p0"]);
  assert.equal(s.game.falseStarts.p1, 1);
  // Weitere Tipps derselben Runde bleiben wirkungslos.
  shoot(s, "p1", r.signalAt! + 300, 250);
  assert.equal(r.shots.p1.early, true);
}
{
  // Niemand schießt: keine Wertung, nach dem Fenster nächste Runde. Bis 3 Siege, höchstens 9 Runden.
  const s = make(2);
  settle(s);
  assert.deepEqual(round(s).winners, []);
  nextRound(s);
  assert.equal(s.game.rounds.length, 2);
  for (let i = 0; i < 3; i++) { const r = round(s); shoot(s, "p1", r.signalAt! + 300, 300); shoot(s, "p0", r.signalAt! + 500, 500); nextRound(s); }
  assert.equal(s.done, true); assert.equal(s.game.score.p1, 3);
  assert.deepEqual(matchStandings(s).map(x => [x.id, x.place]), [["p1", 1], ["p0", 2]]);
  const t = make(2, 3);
  while (!t.done) { settle(t); nextRound(t); }
  assert.equal(t.game.rounds.length, QD.duelMaxRounds, "Endlose Duelle werden begrenzt");
  assert.deepEqual(matchStandings(t).map(x => x.place), [1, 1], "Ohne Sieg teilen sich beide den Platz");
}

// Gruppe mit 4 und 6: 3/2/1 Punkte, Fehlstart 0, gleiche Zeit teilt Punkte, 5 Durchgänge.
for (const count of [4, 6]) {
  const s = make(count), r = round(s);
  shoot(s, "p0", r.signalAt! - 100, 0);
  shoot(s, "p1", r.signalAt! + 300, 300);
  shoot(s, "p2", r.signalAt! + 250, 250);
  shoot(s, "p3", r.signalAt! + 250, 250);
  settle(s);
  assert.deepEqual([0, 1, 2, 3].map(i => r.points[`p${i}`] ?? 0), [0, 1, 3, 3]);
  if (count === 6) assert.equal(r.points.p4 ?? 0, 0, "Nicht geschossen: 0 Punkte");
  for (let i = 1; i < 5; i++) { nextRound(s); const q = round(s); shoot(s, "p1", q.signalAt! + 200, 200); settle(s); }
  nextRound(s);
  assert.equal(s.game.rounds.filter(x => x.kind === "group").length, 5);
  assert.equal(s.done, true, "Eindeutiger Sieger: kein Stechen");
  assert.equal(matchStandings(s)[0].id, "p1");
}
{
  // Gleichstand an der Spitze: Stechen nur unter den Führenden.
  const s = make(3);
  // Vier Durchgänge abwechselnd, der fünfte mit exakt gleicher Zeit (beide 3 Punkte).
  for (let i = 0; i < 5; i++) { const r = round(s); shoot(s, i % 2 ? "p1" : "p0", r.signalAt! + 200, 200); shoot(s, i % 2 ? "p0" : "p1", r.signalAt! + (i === 4 ? 200 : 300), i === 4 ? 200 : 300); settle(s); nextRound(s); }
  assert.equal(s.game.score.p0, s.game.score.p1);
  const tie = round(s);
  assert.equal(tie.kind, "tiebreak"); assert.deepEqual(tie.participants, ["p0", "p1"]);
  shoot(s, "p2", tie.signalAt! + 100, 100);
  assert.equal(tie.shots.p2, undefined, "Zuschauer können im Stechen nicht schießen");
  shoot(s, "p1", tie.signalAt! + 220, 220); shoot(s, "p0", tie.signalAt! + 260, 260);
  nextRound(s);
  assert.equal(s.done, true);
  assert.deepEqual(matchStandings(s).slice(0, 2).map(x => [x.id, x.place]), [["p1", 1], ["p0", 2]]);
  // Drei Stechen ohne gültigen Schuss: geteilter Platz.
  const t = make(3, 21);
  for (let i = 0; i < 5; i++) { const r = round(t); shoot(t, "p0", r.signalAt! + 200, 200); shoot(t, "p1", r.signalAt! + 200, 200); settle(t); nextRound(t); }
  while (!t.done) { settle(t); nextRound(t); }
  assert.equal(t.game.rounds.filter(x => x.kind === "tiebreak").length, QD.maxTiebreaks);
  assert.deepEqual(matchStandings(t).slice(0, 2).map(x => x.place), [1, 1]);
}

// Abbruch mitten in der Runde: übrige Spieler werden sofort gewertet; im Duell endet das Spiel.
{
  const s = make(3), r = round(s);
  shoot(s, "p0", r.signalAt! + 200, 200); shoot(s, "p1", r.signalAt! + 300, 300);
  removeMatchPlayer(s, "p2");
  assert.notEqual(r.resolvedAt, undefined);
  const d = make(2), q = round(d);
  removeMatchPlayer(d, "p1"); settle(d); nextRound(d);
  assert.equal(d.done, true); assert.equal(matchStandings(d)[0].id, "p0");
}

// Gesamtablauf über die Party: Bots für 2, 4 und 6 Spieler, Neustart per JSON mitten im Spiel.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g: PartyGame = createPartyGame(players, undefined, true, 77 + count, 1_000, "free-minigame", { miniId: "quickdraw" });
  const driver = new PartyBotDriver();
  let now = 1_000;
  for (let i = 0; i < 8000 && g.phase !== "finished"; i++) {
    now += 50;
    if (i === 400) g = JSON.parse(JSON.stringify(g)); // Speichern und Laden mitten im Spiel
    g = tickParty(driver.step(g, now), now);
  }
  assert.equal(g.phase, "finished", `${count} Bots beenden Quick Draw`);
  assert.ok(now - 1_000 < 125_000);
  const results = partyMiniResults(g);
  assert.ok(results.every(r => r.participated), "Bots reagieren über normale Eingaben");
  assert.ok(g.winners.length >= 1);
  assert.deepEqual(g.winners, results.filter(r => r.place === 1).map(r => r.player.id));
}
// Zeitablauf: ohne Reaktionen endet das Spiel an der harten Grenze mit geteiltem Platz.
{
  let g = createPartyGame([{ id: "a", name: "A" }, { id: "b", name: "B" }], undefined, true, 5, 0, "free-minigame", { miniId: "quickdraw" });
  g = applyPartyAction(g, "a", { type: "ready" }, 0); g = applyPartyAction(g, "b", { type: "ready" }, 0);
  g = tickParty(g, g.deadline + 1);
  assert.equal(g.phase, "finished"); assert.deepEqual(g.winners, [], "Ohne Eingaben keine Teilnahme");
}
console.log("Quick Draw erfolgreich: verdecktes Signal, Täuschungen, Duell bis 3, Gruppe 3/2/1 mit 4 und 6 Spielern, Stechen, Fehlstarts, Latenzprüfung, Abbruch, Zeitablauf, Neustart und Bots.");
