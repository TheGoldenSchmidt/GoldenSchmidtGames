import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { LT, occupied, type Rider, type TrailsGame } from "../shared/matches/lightTrails";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type LTS = MatchState<TrailsGame>;
const make = (count: number, seed = 4) => createMatch("trails", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as LTS;
const seq = new Map<string, number>();
function command(s: LTS, id: string, n: number) {
  const p = s.players.find(q => q.id === id)!, next = (seq.get(`${s.seed}${id}`) ?? 0) + 1; seq.set(`${s.seed}${id}`, next);
  return setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, cn: p.usedN + 1, n }, next, s.time);
}
/** Puts riders on chosen cells for exact collision scenarios (authoritative fixture). */
function place(s: LTS, layout: Record<string, [number, number, number]>) {
  for (const [id, [x, y, dir]] of Object.entries(layout)) Object.assign(s.game.riders[id], { x, y, dir, path: [[x, y]], queue: [], alive: true } satisfies Partial<Rider>);
}
const tick = (s: LTS, moves = 1) => advanceMatch(s, s.game.roundStart + (s.game.move + moves) * LT.moveMs);

// Faire Startplätze: innerhalb der Arena, verschieden, je Durchgang rotiert.
for (const count of [2, 3, 4, 5, 6]) {
  const s = make(count), cells = new Set(Object.values(s.game.riders).map(r => `${r.x},${r.y}`));
  assert.equal(cells.size, count);
  assert.ok(Object.values(s.game.riders).every(r => r.x >= 3 && r.y >= 4 && r.x <= LT.cols - 4 && r.y <= LT.rows - 5));
}

// Gleichmäßige Bewegung, nur 90-Grad-Kurven, keine Wende, höchstens zwei vorgemerkte Kurven.
{
  const s = make(2);
  place(s, { p0: [5, 10, 1], p1: [15, 25, 3] });
  tick(s, 2);
  assert.deepEqual([s.game.riders.p0.x, s.game.riders.p0.y], [7, 10]);
  command(s, "p0", 3); // Wende verboten
  command(s, "p0", 1); // gleiche Richtung ignoriert
  assert.equal(s.game.riders.p0.queue.length, 0);
  command(s, "p0", 4); command(s, "p0", 4); command(s, "p0", 4); // links, links (U-Turn über zwei Schritte), dritte verworfen
  assert.deepEqual(s.game.riders.p0.queue, [0, 3]);
  tick(s); assert.deepEqual([s.game.riders.p0.x, s.game.riders.p0.y, s.game.riders.p0.dir], [7, 9, 0]);
  tick(s); assert.deepEqual([s.game.riders.p0.x, s.game.riders.p0.y, s.game.riders.p0.dir], [6, 9, 3]);
  assert.deepEqual(s.game.riders.p0.path, [[5, 10], [7, 10], [7, 9]], "Spur als Eckpunkte");
  assert.ok(occupied(s.game).has(10 * LT.cols + 6), "Spur blockiert dauerhaft");
  // Öffentliche Sicht verbirgt die vorgemerkten Kurven anderer Spieler.
  command(s, "p0", 0);
  assert.deepEqual((publicMatch(s, "p1").game as TrailsGame).riders.p0.queue, []);
  assert.deepEqual((publicMatch(s, "p0").game as TrailsGame).riders.p0.queue, [0]);
}

// Kollisionen: Wand, eigene und fremde Spur, Kopf-an-Kopf gleichzeitig mit gleichem Rang.
{
  const s = make(3);
  place(s, { p0: [0, 5, 3], p1: [10, 10, 1], p2: [13, 10, 3] });
  tick(s);
  assert.equal(s.game.riders.p0.alive, false, "Wand");
  assert.equal(s.game.riders.p1.alive && s.game.riders.p2.alive, true);
  tick(s);
  assert.equal(s.game.riders.p1.alive && s.game.riders.p2.alive, false, "Beide in dasselbe Feld");
  assert.equal(s.game.riders.p1.diedAt, s.game.riders.p2.diedAt);
  assert.equal(s.game.phase, "pause");
  // p0 schied einen Zug früher aus: p1 und p2 bekommen je +1, kein Überlebensbonus.
  assert.deepEqual(s.game.history[0].points, { p0: 0, p1: 1, p2: 1 });
  assert.equal(s.game.history[0].survivor, undefined);
}
{
  const s = make(2);
  place(s, { p0: [5, 5, 1], p1: [10, 20, 0] });
  for (const n of [5, 5, 5, 5]) { command(s, "p0", n); tick(s); } // vierte Rechtskurve führt in die eigene Spur
  assert.equal(s.game.riders.p0.alive, false);
  assert.deepEqual(s.game.history[0], { points: { p0: 0, p1: 1 + LT.survivorBonus }, survivor: "p1" });
  // Gegenseitiger Platztausch ist ebenfalls ein Zusammenstoß.
  const t = make(2, 9);
  place(t, { p0: [8, 8, 1], p1: [9, 8, 3] });
  tick(t);
  assert.equal(t.game.riders.p0.alive || t.game.riders.p1.alive, false);
  const u = make(2, 10);
  place(u, { p0: [8, 8, 1], p1: [12, 20, 0] });
  u.game.riders.p1.path = [[9, 4], [9, 12]]; // fremde Spur quer im Weg
  tick(u);
  assert.equal(u.game.riders.p0.alive, false, "Fremde Spur");
}

// Schrumpfen ab 12 s, Spieler auf dem neuen Wandring scheiden im selben Schritt aus.
{
  const t = make(2, 12);
  place(t, { p0: [0, 20, 2], p1: [10, 3, 1] });
  // Fixture: die Runde läuft bereits knapp 12 Sekunden.
  t.game.roundStart = t.time - LT.shrinkAfter + LT.moveMs; t.game.move = Math.floor(LT.shrinkAfter / LT.moveMs) - 1;
  advanceMatch(t, t.time + LT.moveMs - 50);
  assert.equal(t.game.border, 0, "Vor 12 s kein Schrumpfen");
  advanceMatch(t, t.time + LT.moveMs);
  assert.equal(t.game.border, 1);
  assert.equal(t.game.riders.p0.alive, false, "Ring schließt über dem Gleiter");
}

// Drei Durchgänge, Punkte und Gesamtsieg; Aufgeben zählt als Ausscheiden.
{
  const s = make(3);
  place(s, { p0: [2, 10, 3], p1: [10, 10, 1], p2: [10, 20, 1] });
  tick(s, 3); // p0 in die Wand
  tick(s);
  removeMatchPlayer(s, "p1"); // Aufgeben einen Zug später
  assert.equal(s.game.phase, "pause");
  assert.deepEqual(s.game.history[0].points, { p0: 0, p1: 1, p2: 2 + LT.survivorBonus });
  advanceMatch(s, s.time + LT.pause + 50);
  assert.equal(s.game.round, 2);
  assert.equal(s.game.riders.p1.alive, false, "Ausgeschiedene starten nicht neu");
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart mitten im Spiel, Ergebnis.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 900 + count, 0, "free-minigame", { miniId: "trails" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 6000 && g.phase !== "finished"; i++) {
    now += 50; if (i === 300) g = JSON.parse(JSON.stringify(g));
    g = tickParty(driver.step(g, now), now);
  }
  assert.equal(g.phase, "finished", `${count} Bots`);
  const results = partyMiniResults(g);
  assert.ok(results.every(r => r.participated));
  assert.deepEqual(g.winners, results.filter(r => r.place === 1).map(r => r.player.id));
}
// Bots allein: Ergebnisse sind deterministisch bei gleichem Startwert.
{
  const run = () => { const s = make(4, 77); for (let t = 50, n = 0; !s.done && t < 200000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = run(), b = run();
  assert.deepEqual(a.game.history, b.game.history);
  assert.equal(a.game.history.length, LT.rounds);
  assert.deepEqual(matchStandings(a), matchStandings(b));
}
console.log("Light Trails erfolgreich: Startplätze, Rasterbewegung, 90°-Kurven, Kollisionen inkl. gleichzeitiger Crashs, Schrumpfen, Punkte, Aufgeben, 3 Durchgänge, Bots mit 2/4/6 Spielern und Determinismus.");
