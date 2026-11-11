import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, setMatchControl } from "../shared/matches/framework";
import { AM, launch, trajectory, type ArrowGame } from "../shared/matches/arrowMasters";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type AS = MatchState<ArrowGame>;
const make = (count = 2, seed = 3) => createMatch("arrows", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as AS;
const seqs = new WeakMap<AS, Map<string, number>>();
/** Aim like a bowstring: drag opposite to the shot. */
function aim(s: AS, id: string, angle: number, power: number) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ax: -Math.cos(angle) * power, ay: Math.sin(angle) * power }, n, s.time);
  advanceMatch(s, s.time + 50);
}
const toFlight = (s: AS) => advanceMatch(s, s.game.phaseStart + AM.aimMs);
const toEnd = (s: AS) => { for (let i = 0; i < 200 && s.game.phase === "flight"; i++) advanceMatch(s, s.time + 50); };
/** Finds an aim that hits a point, using the shared trajectory model. */
function solve(s: AS, id: string, gx: number, gy: number) {
  const from = launch(s.game.archers[id]);
  let best = { angle: 0, power: 0, miss: Infinity };
  for (let a = 0; a < 180; a++) for (let p = 20; p <= 100; p += 2) {
    const angle = a * Math.PI / 180, power = p / 100;
    const miss = Math.min(...trajectory(from, angle, power, s.game.wind, 2.5, 250).filter(([, y]) => y > 0).map(([x, y]) => Math.hypot(x - gx, y - gy)));
    if (miss < best.miss) best = { angle, power, miss };
  }
  return best;
}

// Zielphase: 10 s, eigenes Zielen verdeckt, letztes Zielen zählt, ohne Zielen kein Schuss.
{
  const s = make();
  aim(s, "p0", .9, .5); aim(s, "p0", .7, .6);
  assert.deepEqual(s.game.archers.p0.aim, { angle: s.game.archers.p0.aim!.angle, power: .6 });
  assert.ok(Math.abs(s.game.archers.p0.aim!.angle - .7) < 1e-9);
  assert.equal((publicMatch(s, "p1").game as ArrowGame).archers.p0.aim, undefined, "Zielen anderer bleibt verdeckt");
  assert.ok((publicMatch(s, "p0").game as ArrowGame).archers.p0.aim);
  advanceMatch(s, s.game.phaseStart + AM.aimMs - 50);
  assert.equal(s.game.phase, "aim");
  toFlight(s);
  assert.equal(s.game.phase, "flight");
  assert.equal(s.game.arrows.length, 1, "Nur wer gezielt hat, schießt");
  // Ballistik: Position folgt Winkel, Stärke, Schwerkraft und Wind.
  const arrow = s.game.arrows[0], from = launch(s.game.archers.p0), t0 = s.time;
  advanceMatch(s, t0 + 300);
  const [ex, ey] = trajectory(from, .7, .6, s.game.wind, (s.time - t0) / 1000, 1).at(-1)!;
  if (!arrow.done) assert.ok(Math.hypot(arrow.x - ex, arrow.y - ey) < .05, "Flugbahn entspricht dem Modell");
}

// Treffer: −1 Trefferpunkt und +2; Besiegen +1; gleichzeitige Treffer zählen; Eigentreffer ohne Punkte; Trefferpunkte pro Runde neu.
{
  const s = make(3, 11);
  s.game.wind = 0; s.game.targets = [];
  const victim = s.game.archers.p1;
  victim.hp = 2;
  for (const id of ["p0", "p2"]) { const b = solve(s, id, victim.x, victim.y + AM.bodyH / 2); assert.ok(b.miss < .2); aim(s, id, b.angle, b.power); }
  toFlight(s); toEnd(s);
  assert.equal(victim.hp, 0); assert.equal(victim.down, true);
  const p0 = s.game.points.p0, p2 = s.game.points.p2;
  assert.ok(p0 >= AM.hitPoints && p2 >= AM.hitPoints, "Beide Treffer zählen");
  assert.equal(p0 + p2, 2 * AM.hitPoints + AM.defeatBonus, "Ein Besiegen-Bonus");
  advanceMatch(s, s.game.phaseStart + AM.resultMs + 50);
  assert.equal(s.game.round, 2); assert.equal(victim.hp, AM.hp, "Wieder 3 Trefferpunkte");
  // Eigentreffer: steil nach oben ohne Wind.
  s.game.wind = 0; s.game.targets = [];
  aim(s, "p1", Math.PI / 2, .5);
  toFlight(s); toEnd(s);
  assert.equal(s.game.archers.p1.hp, AM.hp - 1); assert.equal(s.game.points.p1, 0, "Eigentreffer ohne Punkte");
}

// Zielscheiben +1, Hindernisse blockieren.
{
  const s = make(2, 5);
  s.game.wind = 0;
  const t = s.game.targets[0], b = solve(s, "p0", t.x, t.y);
  aim(s, "p0", b.angle, b.power);
  toFlight(s); toEnd(s);
  assert.equal(s.game.arrows[0].hit, "target"); assert.equal(s.game.points.p0, AM.targetPoints);
  const o = make(2, 6);
  o.game.wind = 0; o.game.targets = [];
  aim(o, "p0", .02, .9); // flach gegen den Mittelpfeiler
  toFlight(o); toEnd(o);
  assert.ok(o.game.arrows[0].done && !o.game.arrows[0].hit && o.game.arrows[0].x < 10.7, "Pfeiler stoppt den Pfeil");
}

// Wind wechselt zwischen den Runden, gleicher Startwert → gleicher Wind.
{
  const winds = new Set<number>(), s = make(2, 9);
  for (let r = 0; r < AM.rounds; r++) { winds.add(s.game.wind); toFlight(s); toEnd(s); advanceMatch(s, s.game.phaseStart + AM.resultMs + 50); }
  assert.ok(winds.size >= 3); assert.ok([...winds].every(w => Math.abs(w) <= AM.wind));
  assert.equal(make(2, 9).game.wind, make(2, 9).game.wind);
}

// Fünf Runden; Gleichstand → Präzisions-Stechen nur der Punktgleichen, der genauere Schuss gewinnt.
{
  const s = make(3, 21);
  for (let r = 0; r < AM.rounds; r++) { toFlight(s); toEnd(s); advanceMatch(s, s.game.phaseStart + AM.resultMs + 50); }
  assert.deepEqual(s.game.tiebreak, ["p0", "p1", "p2"], "0:0:0 → Stechen");
  const t = s.game.targets[0];
  const good = solve(s, "p1", t.x, t.y), bad = solve(s, "p2", t.x + 1.5, t.y);
  aim(s, "p1", good.angle, good.power); aim(s, "p2", bad.angle, bad.power);
  toFlight(s); toEnd(s); advanceMatch(s, s.game.phaseStart + AM.resultMs + 50);
  assert.equal(s.done, true); assert.equal(s.game.winner, "p1");
  assert.deepEqual(matchStandings(s).map(r => [r.id, r.place]).slice(0, 1), [["p1", 1]]);
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 30 + count, 0, "free-minigame", { miniId: "arrows" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 3000 && g.phase !== "finished"; i++) { now += 50; if (i === 250) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 41); for (let t = 50, n = 0; !s.done && t < 150000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.points, b.game.points); assert.equal(a.time, b.time);
}
console.log("Arrow Masters erfolgreich: verdeckte Zielphase, letzter Zielwert, gleichzeitiger Abschuss, Ballistik mit Wind, Gegnertreffer, Besiegen-Bonus, gleichzeitige Treffer, Eigentreffer, Zielscheiben, Hindernisse, Windwechsel, Präzisions-Stechen, Bots und Determinismus.");
