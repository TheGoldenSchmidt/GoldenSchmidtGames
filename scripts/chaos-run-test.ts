import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, setMatchControl } from "../shared/matches/framework";
import { CR, courseLayout, hammerLow, platformY, wallClosed, type ModuleKind, type RunGame } from "../shared/matches/chaosRun";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type RS = MatchState<RunGame>;
const make = (count = 2, seed = 4) => createMatch("chaosrun", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as RS;
/** Fixture: a one-module course of the given kind. */
function course(kind: ModuleKind, phase = 0, count = 2) {
  const s = make(count);
  s.game.course = [{ kind, x0: CR.start, length: CR.moduleLength, phase }];
  s.game.length = CR.start + CR.moduleLength + CR.finishRun;
  return s;
}
const seqs = new WeakMap<RS, Map<string, number>>();
function send(s: RS, id: string, values: Partial<MatchInput>) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
const jump = (s: RS, id: string, hold = false) => send(s, id, { ha: hold, ca: s.players.find(p => p.id === id)!.usedA + 1 });
const slide = (s: RS, id: string) => send(s, id, { cb: s.players.find(p => p.id === id)!.usedB + 1 });
const step = (s: RS, ms: number) => advanceMatch(s, s.time + ms);
const runTo = (s: RS, id: string, x: number) => { for (let i = 0; i < 400 && s.game.runners[id].x < x; i++) step(s, 50); };
const run = (s: RS, id: string) => s.game.runners[id];

// Strecke: alle sechs Modultypen, gleicher Startwert → gleiche Strecke.
for (let seed = 1; seed < 30; seed++) {
  const s = make(2, seed), kinds = new Set(s.game.course.map(m => m.kind));
  assert.equal(kinds.size, 6, `alle Module (Startwert ${seed})`);
  assert.deepEqual(make(2, seed).game.course, s.game.course);
  assert.equal(s.game.length, CR.start + CR.modules * CR.moduleLength + CR.finishRun);
}

// Gleiche Grundgeschwindigkeit, keine Spieler-zu-Spieler-Kollision.
{
  const s = course("hammer", .5, 3);
  s.game.course = []; s.game.length = 200;
  step(s, 2000);
  const xs = Object.values(s.game.runners).map(r => r.x);
  assert.ok(xs.every(x => Math.abs(x - xs[0]) < 1e-9), "Alle gleich schnell, niemand blockiert");
}

// Lücke: Sprung rettet, ohne Sprung Sturz und Neustart am Checkpoint.
{
  const s = course("gap");
  const [a] = courseLayout(s.game.course).gaps[0];
  runTo(s, "p0", a - .6); jump(s, "p0");
  let fell = false;
  for (let i = 0; i < 40 && !fell; i++) { step(s, 50); fell = run(s, "p1").fallen; }
  assert.ok(fell, "Ohne Sprung in die Lücke");
  assert.ok(run(s, "p0").x > a + 2 && !run(s, "p0").fallen, "Mit Sprung über die Lücke");
  advanceMatch(s, run(s, "p1").respawnAt + 50);
  assert.ok(Math.abs(run(s, "p1").x - (CR.start + .5)) < .7, `Neustart am Checkpoint (${run(s, "p1").x})`);
}

// Halten springt höher; Wand nur mit hohem Sprung überwindbar.
{
  const apex = (hold: boolean) => {
    const s = course("gap"); s.game.course = []; s.game.length = 200;
    step(s, 200); jump(s, "p0", hold);
    let top = 0; for (let i = 0; i < 30; i++) { step(s, 50); top = Math.max(top, run(s, "p0").y); if (hold && i === 4) send(s, "p0", { ha: false }); }
    return top;
  };
  const tap = apex(false), high = apex(true);
  assert.ok(high > tap + .3 && tap < 1.7 && high > 1.7, `Hochsprung ${high.toFixed(2)} > ${tap.toFixed(2)}`);
}

// Niedriger Balken: Rutschen passt darunter, aufrecht gibt es Rückstoß.
{
  const s = course("beam");
  const [b0, b1] = courseLayout(s.game.course).beams[0];
  runTo(s, "p0", b0 - 1.1); slide(s, "p0");
  runTo(s, "p0", b1 + .5);
  assert.ok(run(s, "p0").x > b1, "Unter dem Balken durchgerutscht");
  assert.ok(run(s, "p1").x < b1 || run(s, "p1").stunUntil > 0, "Aufrecht gestoppt");
  const t = course("beam");
  runTo(t, "p1", b0 - .1); step(t, 100);
  assert.ok(run(t, "p1").stunUntil > t.time - 100 && run(t, "p1").vx < CR.speed, "Rückstoß und Bremsung");
}

// Hammer mit vorhersehbarem Zyklus; Wand nur geschlossen gefährlich.
{
  const s = course("hammer", 0);
  const h = courseLayout(s.game.course).hammers[0];
  assert.equal(hammerLow(0, 100), true); assert.equal(hammerLow(0, CR.hammerPeriod * .6), false);
  // Ankunft so legen, dass der Hammer gerade tief schwingt.
  const arrive = (h.x - 1) / CR.speed * 1000;
  s.game.course[0].phase = 1 - ((arrive / CR.hammerPeriod) % 1);
  runTo(s, "p1", h.x + .2);
  assert.ok(run(s, "p1").stunUntil > 0, "Hammer trifft");
  const w = course("wall", 0);
  const wall = courseLayout(w.game.course).walls[0];
  assert.equal(wallClosed(0, 100), true); assert.equal(wallClosed(0, CR.wallPeriod * .7), false);
  // Ankunft mitten in der offenen Hälfte des Zyklus.
  w.game.course[0].phase = 1.75 - (((wall.x - 1) / CR.speed * 1000 / CR.wallPeriod) % 1);
  runTo(w, "p0", wall.x + 1);
  assert.ok(run(w, "p0").x > wall.x && run(w, "p0").stunUntil === 0, "Offene Wand passierbar");
}

// Einstürzende Brücke je Läufer; bewegliche Plattform trägt.
{
  const s = course("bridge");
  const [b0] = courseLayout(s.game.course).bridges[0];
  run(s, "p0").x = b0 - 3; // p0 läuft vorneweg, p1 hat die Brücke noch nicht erreicht
  runTo(s, "p0", b0 + 2);
  const tile = run(s, "p0").bridge["0"];
  assert.ok(tile !== undefined && Math.abs(tile - (s.time - (2 / CR.speed) * 1000) - CR.bridgeCollapse) < 120, "Platte fällt 0,6 s nach dem Betreten");
  assert.deepEqual(run(s, "p1").bridge, {}, "Andere Läufer haben eigene Brücken");
  const p = course("platform", 0);
  const pl = courseLayout(p.game.course).platforms[0];
  step(p, 1000);
  // Fixture: knapp über der Plattform fallend – sie fängt den Läufer auf und trägt ihn mit.
  Object.assign(run(p, "p0"), { x: pl.x0 + .2, y: platformY(pl.phase, p.time) + .2, vy: -1 });
  let landed = false;
  for (let i = 0; i < 6 && !landed; i++) { step(p, 50); landed = run(p, "p0").grounded && Math.abs(run(p, "p0").y - platformY(pl.phase, p.time)) < 1e-9; }
  assert.ok(landed, `Landung auf der Plattform (y ${run(p, "p0").y.toFixed(2)}, Plattform ${platformY(pl.phase, p.time).toFixed(2)})`);
  step(p, 150);
  assert.ok(Math.abs(run(p, "p0").y - platformY(pl.phase, p.time)) < 1e-9, "Plattform trägt den Läufer mit");
}

// Ziel, Rangliste nach Zielzeit, Zeitablauf nach Fortschritt und Zeitpunkt.
{
  const s = course("gap");
  s.game.course = []; s.game.length = 30;
  run(s, "p1").x = 3;
  step(s, 6000);
  assert.ok(run(s, "p1").finishAt! < run(s, "p0").finishAt!);
  assert.equal(s.done, true);
  assert.deepEqual(matchStandings(s).map(r => [r.id, r.place]), [["p1", 1], ["p0", 2]]);
  const t = course("gap");
  t.game.course = []; t.game.length = 10000;
  run(t, "p0").x = 50; run(t, "p1").x = 50;
  advanceMatch(t, 5000);
  run(t, "p1").best = run(t, "p0").best; run(t, "p1").bestAt = run(t, "p0").bestAt + 100;
  advanceMatch(t, 999999);
  assert.equal(t.done, true);
  assert.equal(matchStandings(t)[0].id, "p0", "Gleicher Fortschritt: früher erreicht gewinnt");
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 20 + count, 0, "free-minigame", { miniId: "chaosrun" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 2500 && g.phase !== "finished"; i++) { now += 50; if (i === 400) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 61); for (let t = 50, n = 0; !s.done && t < 95000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.runners, b.game.runners);
}
console.log("Chaos Run erfolgreich: Modulstrecke, gleiche Geschwindigkeit ohne Spielerkollision, Lücke, Checkpoint-Neustart, Hochsprung, Wand, Balken mit Rutschen, Hammerzyklus, Brücke je Läufer, Plattform, Ziel, Zeitablauf, Gleichstand nach Zeitpunkt, Bots und Determinismus.");
