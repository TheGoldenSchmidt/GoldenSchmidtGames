import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { FL, type LavaGame } from "../shared/matches/floorIsLava";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type LS = MatchState<LavaGame>;
const make = (count: number, seed = 8) => createMatch("lava", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as LS;
const seqs = new Map<string, number>();
function send(s: LS, id: string, values: Partial<MatchInput>) {
  const p = s.players.find(q => q.id === id)!, k = `${s.seed}${id}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
const jump = (s: LS, id: string) => send(s, id, { ca: s.players.find(p => p.id === id)!.usedA + 1 });
const put = (s: LS, id: string, x: number, y: number) => Object.assign(s.game.runners[id], { x, y, vx: 0, vy: 0, alive: true, invulnUntil: 0, airUntil: 0, jumpReady: 0 });
/** Fixture: an idle opponent that cannot fall, so the round keeps running. */
const park = (s: LS, id: string) => { s.game.runners[id].invulnUntil = 1e12; };
const tile = (s: LS, x: number, y: number) => s.game.tiles[Math.floor(y) * FL.cols + Math.floor(x)];
const step = (s: LS, ms: number) => advanceMatch(s, s.time + ms);
const noRegen = (s: LS) => { s.game.regen = "0".repeat(FL.cols * FL.rows); };

// Startplätze im Feld, verschieden, gleich weit von der Mitte.
for (const count of [2, 4, 6]) {
  const s = make(count), runners = Object.values(s.game.runners);
  assert.equal(new Set(runners.map(r => `${r.x.toFixed(2)},${r.y.toFixed(2)}`)).size, count);
  assert.ok(runners.every(r => tile(s, r.x, r.y) === "1"));
}

// Platten: Betreten startet 0,8 s, danach weg; regenerierbare Platten nach 2,5 s zurück.
{
  const s = make(2); noRegen(s);
  put(s, "p0", 4.5, 6.5); put(s, "p1", 1.5, 1.5); park(s, "p1");
  step(s, 50);
  assert.equal(tile(s, 4.5, 6.5), "2");
  step(s, FL.crackMs - 100);
  assert.equal(tile(s, 4.5, 6.5), "2");
  step(s, 100);
  assert.equal(tile(s, 4.5, 6.5), "0");
  assert.equal(s.game.runners.p0.lives, FL.lives - 1, "Lava kostet ein Leben");
  const r = make(2, 3);
  r.game.regen = "1".repeat(FL.cols * FL.rows);
  put(r, "p0", 4.5, 6.5); put(r, "p1", 1.5, 1.5); park(r, "p1");
  step(r, 50); r.game.runners.p0.x = 2.5; park(r, "p0"); // weggehen, bevor die Platte fällt
  step(r, FL.crackMs);
  assert.equal(tile(r, 4.5, 6.5), "3");
  step(r, FL.regenMs);
  assert.equal(tile(r, 4.5, 6.5), "1", "Regeneriert");
}

// Sprung: kleine Lücke überwinden, in der Luft kein Lavaschaden, Abklingzeit 3 s.
{
  const s = make(2); noRegen(s);
  put(s, "p0", 4.5, 6.5); put(s, "p1", 1.5, 1.5); park(s, "p1");
  s.game.tiles = s.game.tiles.split("").map((t, i) => i === 6 * FL.cols + 5 ? "0" : t).join("");
  send(s, "p0", { x: 1, ca: 1 }); // laufen und springen im selben Paket
  step(s, FL.jumpMs - 50);
  assert.ok(s.game.runners.p0.x > 6.05, `Über die Lücke (${s.game.runners.p0.x})`);
  assert.equal(s.game.runners.p0.lives, FL.lives, "Kein Schaden in der Luft");
  park(s, "p0"); // für die Abklingzeit-Prüfung nicht in die Lava fallen
  const before = s.game.runners.p0.airUntil;
  jump(s, "p0"); step(s, 100);
  assert.equal(s.game.runners.p0.airUntil, before, "Abklingzeit");
  step(s, FL.jumpCooldown);
  jump(s, "p0");
  assert.ok(s.game.runners.p0.airUntil > before);
}

// Lava ohne Sprung: Leben weg, sicherer Respawn mit kurzem Schutz; zweites Leben → raus.
{
  const s = make(2); noRegen(s);
  put(s, "p0", 4.5, 6.5); put(s, "p1", 1.5, 1.5); park(s, "p1");
  s.game.tiles = s.game.tiles.split("").map((t, i) => i === 6 * FL.cols + 4 ? "0" : t).join("");
  step(s, 50);
  const r = s.game.runners.p0;
  assert.equal(r.lives, 1); assert.ok(r.invulnUntil > s.time);
  assert.equal(tile(s, r.x, r.y), "1", "Respawn auf intakter Platte");
  r.invulnUntil = 0;
  s.game.tiles = s.game.tiles.split("").map((t, i) => i === Math.floor(r.y) * FL.cols + Math.floor(r.x) ? "0" : t).join("");
  step(s, 50);
  assert.equal(r.alive, false);
}

// Rand verschwindet ab 10 s, Rundenende nach 20 s: Überlebende teilen Platz und Bonus.
{
  const s = make(3); noRegen(s);
  put(s, "p0", 4.5, 6.5); put(s, "p1", 3.5, 6.5); put(s, "p2", .5, .5);
  s.game.runners.p2.lives = 1;
  // Platten unter den Figuren bleiben für den Test intakt.
  const keep = () => { s.game.tiles = s.game.tiles.split("").map((t, i) => [6 * FL.cols + 4, 6 * FL.cols + 3].includes(i) ? "1" : t).join(""); s.game.timers = {}; };
  for (let t = 0; t < FL.ringAt[0]; t += 500) { keep(); step(s, 500); }
  keep(); step(s, 100);
  assert.equal(tile(s, .5, .5), "0"); assert.equal(s.game.runners.p2.alive, false, "Der Rand nimmt Spieler mit");
  for (let t = s.time - s.game.roundStart; t < FL.roundMax; t += 500) { keep(); step(s, 500); }
  assert.equal(s.game.phase, "pause");
  assert.deepEqual(s.game.history[0].winners.sort(), ["p0", "p1"]);
  assert.deepEqual(s.game.history[0].points, { p0: 1 + FL.winBonus / 2, p1: 1 + FL.winBonus / 2, p2: 0 });
}

// Gleichzeitig ausgeschieden: gleicher Rang, letzter Überlebender bekommt +3.
{
  const s = make(3); noRegen(s);
  put(s, "p0", 4.5, 6.5); put(s, "p1", 2.5, 2.5); put(s, "p2", 6.5, 10.5);
  for (const id of ["p1", "p2"]) s.game.runners[id].lives = 1;
  s.game.tiles = s.game.tiles.split("").map((t, i) => [2 * FL.cols + 2, 10 * FL.cols + 6].includes(i) ? "0" : t).join("");
  step(s, 50);
  assert.deepEqual(s.game.history[0].points, { p0: 2 + FL.winBonus, p1: 0, p2: 0 });
}

// Drei Durchgänge, Gesamtgleichstand → Stechrunde; Aufgeben.
{
  const s = make(2); noRegen(s);
  s.game.round = FL.rounds; s.game.points = { p0: 3, p1: 0 };
  s.game.runners.p0.alive = false; s.game.runners.p0.outAt = s.time;
  step(s, 50);
  assert.equal(s.game.points.p1, 1 + FL.winBonus, "Letzter Durchgang: +1 und Sieg");
  step(s, FL.pause + 50);
  assert.equal(s.done, true); assert.equal(matchStandings(s)[0].id, "p1");
  const tie = make(2, 5);
  tie.game.round = FL.rounds; tie.game.points = { p0: 4, p1: 0 };
  tie.game.runners.p0.alive = false; tie.game.runners.p0.outAt = tie.time;
  step(tie, 50); step(tie, FL.pause + 50);
  assert.equal(tie.game.tiebreak, true, "Stechrunde bei Gleichstand");
  tie.game.runners.p1.alive = false; tie.game.runners.p1.outAt = tie.time;
  step(tie, 50);
  assert.equal(tie.game.tiebreakWinner, "p0");
  step(tie, FL.pause + 50);
  assert.equal(tie.done, true);
  assert.deepEqual(matchStandings(tie).map(r => [r.id, r.place]), [["p0", 1], ["p1", 2]]);
  const quit = make(3); removeMatchPlayer(quit, "p1");
  assert.equal(quit.game.runners.p1.alive, false);
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 80 + count, 0, "free-minigame", { miniId: "lava" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) { now += 50; if (i === 150) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 51); for (let t = 50, n = 0; !s.done && t < 200000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.points, b.game.points); assert.equal(a.time, b.time);
}
console.log("Floor is Lava erfolgreich: Startplätze, Plattenzustände, Regeneration, Sprung über Lücken, Abklingzeit, Lava, sicherer Respawn, Randabbruch, Zeitablauf mit geteilter Platzierung, gleichzeitiges Ausscheiden, Stechrunde, Aufgeben, Bots und Determinismus.");
