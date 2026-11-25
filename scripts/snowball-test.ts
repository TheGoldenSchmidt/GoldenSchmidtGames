import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { SB, SNOW_TREES, SNOW_WALLS, throwTarget, type SnowGame } from "../shared/matches/snowball";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";
import { miniPool } from "../shared/minigameCatalog";

type SS = MatchState<SnowGame>;
const make = (count = 2, seed = 3) => createMatch("snowball", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as SS;
const seqs = new WeakMap<SS, Map<string, number>>();
function send(s: SS, id: string, values: Partial<MatchInput>, throwIt = false) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ...values, ca: p.usedA + (throwIt ? 1 : 0), cb: p.usedB, cn: p.usedN }, n, s.time);
}
const run = (s: SS, ms: number, each?: () => void) => { const end = s.time + ms; while (s.time < end && !s.done) { each?.(); advanceMatch(s, s.time + 50); } };
const put = (s: SS, id: string, x: number, y: number) => Object.assign(s.game.players[id], { x, y, hitAt: -1e9 });
/** Open lane in the arena without walls or trees between x 1…10 at y = 8.3. */
const LANE = 8.3;

// Pool, Startplätze, Arena.
{
  for (const n of [2, 3, 4, 5, 6]) assert.ok(miniPool(n, false).includes("snowball"));
  for (const count of [2, 4, 6]) {
    const s = make(count), all = Object.values(s.game.players);
    assert.equal(new Set(all.map(p => `${p.x},${p.y}`)).size, count);
    assert.ok(all.every(p => p.balls === 1 && p.hits === 0));
  }
  assert.ok(SNOW_WALLS.every(w => !(LANE > w.y0 - .6 && LANE < w.y1 + .6 && w.x0 < 10)), "Testgasse frei von Mauern");
  assert.ok(SNOW_TREES.every(t => Math.abs(t.y - LANE) > 1 || t.x > 10), "Testgasse frei von Bäumen");
}

// Laufen, 10 % langsamer je Treffer.
{
  const s = make(); put(s, "p0", 2, LANE); put(s, "p1", 20, 20);
  run(s, 500, () => send(s, "p0", { x: 1 }));
  const fresh = s.game.players.p0.x - 2;
  assert.ok(Math.abs(fresh - SB.speed * .5) < .05, `Grundtempo ${fresh}`);
  const t = make(); put(t, "p0", 2, LANE); put(t, "p1", 20, 20); t.game.players.p0.hits = 2;
  run(t, 500, () => send(t, "p0", { x: 1 }));
  assert.ok(Math.abs((t.game.players.p0.x - 2) - fresh * .8) < .05, "Zwei Treffer = 20 % langsamer");
}

// Formen: stillstehen und halten, Bewegung bricht ab, höchstens zwei Bälle.
{
  const s = make(); put(s, "p0", 2, LANE); put(s, "p1", 20, 20);
  run(s, SB.formMs - 100, () => send(s, "p0", { hb: true }));
  assert.equal(s.game.players.p0.balls, 1, "Noch nicht fertig");
  send(s, "p0", { hb: true, x: 1 }); advanceMatch(s, s.time + 50);
  assert.equal(s.game.players.p0.form, 0, "Laufen bricht das Formen ab");
  run(s, SB.formMs + 100, () => send(s, "p0", { hb: true }));
  assert.equal(s.game.players.p0.balls, 2, "Ball geformt");
  assert.ok(s.events.some(e => e.kind === "formed"));
  run(s, SB.formMs * 2, () => send(s, "p0", { hb: true }));
  assert.equal(s.game.players.p0.balls, SB.maxBalls, "Höchstens zwei");
}

// Schneehaufen: drüberlaufen hebt einen Ball auf, Haufen kommt wieder.
{
  const s = make(); const pile = s.game.piles[0];
  s.game.players.p0.balls = 0; put(s, "p0", pile.x, pile.y); put(s, "p1", 20, 20);
  advanceMatch(s, s.time + 50);
  assert.equal(s.game.players.p0.balls, 1); assert.ok(pile.readyAt > s.time);
  advanceMatch(s, s.time + 50);
  assert.equal(s.game.players.p0.balls, 1, "Leerer Haufen gibt nichts");
  run(s, SB.pileRespawn);
  assert.equal(s.game.players.p0.balls, 2, "Wieder aufgefüllt");
}

// Werfen und Treffen: Ball braucht Vorrat, fliegt in Zielrichtung, dritter Treffer = Schneemann; Mauern halten Bälle auf.
{
  const s = make(3); put(s, "p0", 2, LANE); put(s, "p1", 7, LANE); put(s, "p2", 20, 20);
  const thrower = s.game.players.p0, target = s.game.players.p1;
  thrower.balls = 2;
  send(s, "p0", { ax: 1, ay: 0 }, true); advanceMatch(s, s.time + 50);
  assert.equal(thrower.balls, 1); assert.equal(s.game.balls.length, 1);
  run(s, 500);
  assert.equal(target.hits, 1); assert.equal(thrower.dealt, 1);
  assert.ok(s.events.some(e => e.kind === "hit" && e.ids[0] === "p1" && e.ids[1] === "p0"));
  // Schutzzeit nach einem Treffer: sofort nachgeworfen zählt nicht doppelt.
  thrower.balls = 2; target.hitAt = s.time;
  send(s, "p0", { ax: 1, ay: 0 }, true); run(s, 250);
  assert.equal(target.hits, 1, "Kurze Schutzzeit");
  // Loslassen ohne Zielrichtung im selben Paket: Wurf geht in die zuletzt gezielte Richtung, nicht in die Laufrichtung.
  const aimed = make(3); put(aimed, "p0", 2, LANE); put(aimed, "p1", 7, LANE); put(aimed, "p2", 20, 20);
  aimed.game.players.p0.balls = 1; aimed.game.players.p0.fx = 0; aimed.game.players.p0.fy = 1;
  send(aimed, "p0", { ax: 1, ay: 0 }); advanceMatch(aimed, aimed.time + 50);
  send(aimed, "p0", {}, true); advanceMatch(aimed, aimed.time + 50);
  assert.ok(aimed.game.balls[0].vx > 0 && Math.abs(aimed.game.balls[0].vy) < 1e-9, "Wurf in Zielrichtung");
  run(aimed, 500);
  assert.equal(aimed.game.players.p1.hits, 1, "Trifft das anvisierte Ziel");
  // Ohne Ball kein Wurf.
  const empty = make(); put(empty, "p0", 2, LANE); empty.game.players.p0.balls = 0;
  send(empty, "p0", { ax: 1 }, true); advanceMatch(empty, empty.time + 50);
  assert.equal(empty.game.balls.length, 0);
  // Dritter Treffer: Schneemann, raus; Letzter übrig gewinnt.
  const end = make(2); put(end, "p0", 2, LANE); put(end, "p1", 7, LANE);
  end.game.players.p1.hits = 2; end.game.players.p0.balls = 1;
  send(end, "p0", { ax: 1, ay: 0 }, true); run(end, 600);
  assert.ok(end.game.players.p1.outAt !== undefined && end.events.some(e => e.kind === "frozen"));
  assert.equal(end.done, true); assert.equal(end.game.winner, "p0");
  assert.deepEqual(matchStandings(end).map(r => r.id), ["p0", "p1"]);
  // Eine Mauer zwischen Werfer und Ziel hält den Ball auf.
  const wall = SNOW_WALLS[0], wallY = (wall.y0 + wall.y1) / 2, cover = make(2);
  put(cover, "p0", (wall.x0 + wall.x1) / 2, wallY - 2.5); put(cover, "p1", (wall.x0 + wall.x1) / 2, wallY + 2);
  cover.game.players.p0.balls = 1; send(cover, "p0", { ax: 0, ay: 1 }, true); run(cover, 800);
  assert.equal(cover.game.players.p1.hits, 0, "Mauer schützt");
}

// Einfachere Bedienung: Antippen formt bis zu zwei Bälle im Stand (Laufen pausiert), Wurf rastet auf Gegner nahe der Zielrichtung ein,
// Antippen ohne Zielen wirft auf den Nächsten in Sicht, laufende Ziele werden vorgehalten.
{
  const tapForm = make(); put(tapForm, "p0", 2, LANE); put(tapForm, "p1", 20, 20); tapForm.game.players.p0.balls = 0;
  const pressB = (s: SS) => { const p = s.players[0], own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own); const n = (own.get("p0") ?? 0) + 1; own.set("p0", n); setMatchControl(s, "p0", { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB + 1, cn: p.usedN }, n, s.time); };
  pressB(tapForm); advanceMatch(tapForm, tapForm.time + 50);
  assert.equal(tapForm.game.players.p0.forming, true, "Antippen startet das Formen");
  run(tapForm, SB.formMs / 2, () => send(tapForm, "p0", { x: 1 }));
  assert.equal(tapForm.game.players.p0.balls, 0, "Laufen pausiert");
  run(tapForm, SB.formMs * 2 + 200, () => send(tapForm, "p0"));
  assert.equal(tapForm.game.players.p0.balls, SB.maxBalls, "Im Stand ohne Halten bis zu zwei Bälle");
  assert.equal(tapForm.game.players.p0.forming, false, "Danach hört es auf");
  const shot = (p1: [number, number], aim: Partial<MatchInput>, p1Input: Partial<MatchInput> = {}, bot = false) => {
    const s = make(3); put(s, "p0", 2, LANE); put(s, "p1", ...p1); put(s, "p2", 20, 20);
    if (bot) s.players[0].bot = true;
    s.game.players.p0.balls = 1; s.game.players.p0.fx = 0; s.game.players.p0.fy = 1;
    send(s, "p1", p1Input); advanceMatch(s, s.time + 50);
    send(s, "p1", p1Input); send(s, "p0", aim, true); advanceMatch(s, s.time + 50);
    run(s, 900, () => { send(s, "p0"); send(s, "p1", p1Input); });
    return s.game.players.p1.hits;
  };
  // Bots: weite Zielhilfe mit Vorhalt.
  assert.equal(shot([7, LANE + 1.2], { ax: 1, ay: 0 }, {}, true), 1, "Bot-Zielhilfe: knapp daneben gezielt trifft trotzdem");
  assert.equal(shot([7, LANE + 3], { ax: 1, ay: 0 }, {}, true), 0, "Weit daneben bleibt daneben");
  assert.equal(shot([9, LANE - 1.8], { ax: 1, ay: -.25 }, { y: 1 }, true), 1, "Bots halten laufende Ziele vor");
  // Menschen (Rückmeldung Nov. 2026): rastet nur bis ±11° ein und hält nicht vor.
  assert.equal(shot([7, LANE + .8], { ax: 1, ay: 0 }), 1, "Innerhalb von ±11° rastet der Wurf ein");
  assert.equal(shot([7, LANE + 1.2], { ax: 1, ay: 0 }), 0, "Knapp außerhalb von ±11° bleibt daneben");
  assert.equal(shot([9, LANE - 1.8], { ax: 1, ay: -.25 }, { y: 1 }), 0, "Kein Vorhalt auf laufende Ziele");
  assert.equal(shot([7, LANE], {}), 1, "Antippen ohne Zielen: Wurf auf den Nächsten in Sicht, nicht in Blickrichtung");
  const g = make(3).game; put({ game: g } as SS, "p0", 2, LANE);
  assert.equal(throwTarget(g, g.players.p0, 1, 0)?.id, undefined, "Kein Gegner in Reichweite und Sicht: keine Markierung");
}

// Zeitablauf: weniger Treffer kassiert = besser; Aufgeben.
{
  const s = make(3); s.game.players.p0.hits = 2; s.game.players.p1.hits = 1;
  for (const id of ["p0", "p1", "p2"]) put(s, id, ...(id === "p0" ? [2, 2] : id === "p1" ? [20, 2] : [11, 20]) as [number, number]);
  advanceMatch(s, SB.maxMs);
  assert.equal(s.done, true);
  assert.deepEqual(matchStandings(s).map(r => r.id), ["p2", "p1", "p0"]);
  const quit = make(2); removeMatchPlayer(quit, "p1"); assert.equal(quit.done, true);
}

// Bots über die Party (2, 4, 6) mit Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 30 + count, 0, "free-minigame", { miniId: "snowball" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 3000 && g.phase !== "finished"; i++) { now += 50; if (i === 120) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = (restartAt?: number) => { let s = make(4, 12); for (let t = 50, n = 0; !s.done && t < 125000; t += 50) { if (t === restartAt) s = JSON.parse(JSON.stringify(s)); for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play(6000);
  assert.deepEqual(a.game, b.game, "Neustart aus JSON setzt exakt fort");
  assert.ok(Object.values(a.game.players).some(p => p.dealt > 0), "Bots treffen");
}
console.log("Schneeballschlacht erfolgreich: Pool, Startplätze, Laufen und 10 % Verlangsamung je Treffer, Formen (Stillstand, Abbruch, höchstens zwei, Antippen statt Halten), Zielhilfe mit Vorhalt nur für Bots, Menschen ±11° ohne Vorhalt, Antippen wirft auf den Nächsten, Schneehaufen, Werfen nur mit Ball, Treffer mit Schutzzeit, Schneemann nach drei Treffern, Mauerschutz, Zeitablauf, Aufgeben, Bots und JSON-Neustart.");
