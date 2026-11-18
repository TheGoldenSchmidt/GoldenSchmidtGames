import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { decodeTrail, encodeTrail, LT, type Rider, type TrailsGame } from "../shared/matches/lightTrails";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type LTS = MatchState<TrailsGame>;
const make = (count: number, seed = 4) => createMatch("trails", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as LTS;
const seq = new Map<string, number>();
function send(s: LTS, id: string, values: Partial<MatchInput> = {}) {
  const p = s.players.find(q => q.id === id)!, next = (seq.get(`${s.seed}${id}`) ?? 0) + 1; seq.set(`${s.seed}${id}`, next);
  return setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, next, s.time);
}
/** Puts riders on chosen spots for exact scenarios (authoritative fixture). */
function place(s: LTS, layout: Record<string, [number, number, number]>) {
  for (const [id, [x, y, a]] of Object.entries(layout)) Object.assign(s.game.riders[id], { x, y, a, pts: [x, y], lastA: a, alive: true } satisfies Partial<Rider>);
}
const run = (s: LTS, ms: number, each?: () => void) => { const end = s.time + ms; while (s.time < end && !s.done) { each?.(); advanceMatch(s, s.time + 50); } };

// Faire Startplätze: im Feld, verschieden, Blick entlang des Rings; je Durchgang rotiert.
for (const count of [2, 3, 4, 5, 6]) {
  const s = make(count), riders = Object.values(s.game.riders);
  assert.equal(new Set(riders.map(r => `${r.x.toFixed(2)},${r.y.toFixed(2)}`)).size, count);
  assert.ok(riders.every(r => r.x >= 5 && r.y >= 6 && r.x <= LT.w - 5 && r.y <= LT.h - 6));
}

// Stetige Bewegung: gleiche Geschwindigkeit, Stick dreht höchstens mit der Lenkrate, Halteknöpfe lenken voll, ohne Eingabe geradeaus.
{
  const s = make(2); place(s, { p0: [8, 30, 0], p1: [22, 10, Math.PI] });
  run(s, 1000, () => { send(s, "p0"); send(s, "p1"); });
  const r = s.game.riders.p0;
  assert.ok(Math.abs(r.y - (30 - LT.speed)) < .01 && Math.abs(r.x - 8) < 1e-9, "Geradeaus mit fester Geschwindigkeit");
  // Stick nach rechts: dreht stufenlos, nicht in einem Sprung.
  send(s, "p0", { x: 1 }); run(s, 100, () => { send(s, "p0", { x: 1 }); send(s, "p1"); });
  assert.ok(r.a > .2 && r.a < LT.turn * .15 + 1e-9, `Dreht stufenlos (${r.a})`);
  run(s, 600, () => { send(s, "p0", { x: 1 }); send(s, "p1"); });
  assert.ok(Math.abs(r.a - Math.PI / 2) < 1e-6, "Hält die Stickrichtung");
  // Links halten: volle Lenkrate.
  const a = r.a; run(s, 200, () => { send(s, "p0", { ha: true }); send(s, "p1"); });
  assert.ok(Math.abs(a - r.a - LT.turn * .2) < .02, "Volle Lenkung beim Halten");
  assert.ok(r.pts.length > 4, "Kurven hinterlassen Spurpunkte");
  // Öffentliche Sicht: Spur als kurze Zeichenkette, keine Zahlenliste.
  const view = publicMatch(s, "p1").game as TrailsGame;
  assert.equal((view.riders.p0 as Partial<Rider>).pts, undefined);
  const decoded = decodeTrail(view.trails!.p0);
  assert.equal(decoded.length, r.pts.length); assert.ok(decoded.every((v, i) => Math.abs(v - r.pts[i]) <= .026));
  assert.ok(view.trails!.p0.length === r.pts.length * 2);
  assert.equal(decodeTrail(encodeTrail([0, 1.25, 47.95])).map(v => Math.round(v * 100) / 100).join(), "0,1.25,47.95");
}

// Kollisionen: Wand, fremde Spur, eigene Spur nach einer Schleife, Kopf an Kopf gleichzeitig mit gleichem Rang.
{
  const s = make(3); place(s, { p0: [1, 20, -Math.PI / 2], p1: [10, 10, Math.PI / 2], p2: [20, 40, 0] });
  run(s, 300, () => s.players.forEach(p => send(s, p.id)));
  assert.equal(s.game.riders.p0.alive, false, "Wand");
  const t = make(2, 9); place(t, { p0: [10, 30, 0], p1: [2, 20, Math.PI / 2] });
  // p1 crosses p0's path first; p0 then runs into p1's trail.
  run(t, 1600, () => t.players.forEach(p => send(t, p.id)));
  assert.equal(t.game.riders.p0.alive, false, "Fremde Spur"); assert.equal(t.game.riders.p1.alive, true);
  const u = make(2, 10); place(u, { p0: [15, 30, 0], p1: [3, 5, Math.PI] });
  // Holding right: a full loop back into the own trail (the newest stretch never counts).
  run(u, 400, () => u.players.forEach(p => send(u, p.id)));
  assert.equal(u.game.riders.p0.alive, true, "Kein Crash mit der eigenen frischen Spur");
  run(u, 2600, () => { send(u, "p0", { hb: true }); send(u, "p1"); });
  assert.equal(u.game.riders.p0.alive, false, "Eigene Spur nach einer Schleife");
  const v = make(3, 11); place(v, { p0: [10, 20, Math.PI / 2], p1: [16, 20, -Math.PI / 2], p2: [25, 44, 0] });
  run(v, 600, () => v.players.forEach(p => send(v, p.id)));
  assert.equal(v.game.riders.p0.alive || v.game.riders.p1.alive, false, "Kopf an Kopf");
  assert.equal(v.game.riders.p0.diedAt, v.game.riders.p1.diedAt);
  run(v, 100, () => v.players.forEach(p => send(v, p.id)));
  assert.equal(v.game.phase, "pause");
  assert.deepEqual(v.game.history[0].points, { p0: 0, p1: 0, p2: 2 + LT.survivorBonus }, "Gleichzeitig: gleicher Rang");
}

// Schrumpfen ab 14 s: der Rand wächst stetig, wer zu nah am Rand fährt, scheidet aus.
{
  const s = make(2, 12);
  // Fixture: p0 drives down close to the left wall, p1 down the middle.
  s.game.roundStart = s.time - LT.shrinkAfter + 200; place(s, { p0: [1, 5, Math.PI], p1: [15, 3, Math.PI] });
  run(s, 100, () => s.players.forEach(p => send(s, p.id)));
  assert.equal(s.game.border, 0, "Vor 14 s kein Schrumpfen");
  run(s, 2500, () => s.players.forEach(p => send(s, p.id)));
  assert.ok(s.game.border > .5, `Rand wächst (${s.game.border})`);
  assert.equal(s.game.riders.p0.alive, false, "Rand erwischt den Gleiter");
}

// Drei Durchgänge, Punkte, Aufgeben zählt als Ausscheiden, Ausgeschiedene starten nicht neu.
{
  const s = make(3); place(s, { p0: [1, 10, -Math.PI / 2], p1: [10, 10, Math.PI], p2: [20, 10, Math.PI] });
  run(s, 200, () => s.players.forEach(p => send(s, p.id)));
  assert.equal(s.game.riders.p0.alive, false);
  removeMatchPlayer(s, "p1");
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
// Bots allein: deterministisch bei gleichem Startwert; Rechenzeit und Sichtgröße bleiben klein.
{
  let maxView = 0;
  const play = () => { const s = make(6, 77); const t0 = performance.now(); for (let t = 50, n = 0; !s.done && t < 200000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); if (t % 2000 === 0) maxView = Math.max(maxView, JSON.stringify(publicMatch(s, "p0")).length); } return { s, ms: performance.now() - t0 }; };
  const a = play(), b = play();
  assert.deepEqual(a.s.game.history, b.s.game.history);
  assert.equal(a.s.game.history.length, LT.rounds);
  assert.deepEqual(matchStandings(a.s), matchStandings(b.s));
  console.log(`Light Trails mit 6 Bots: ${Math.round(a.ms)} ms Rechenzeit für ${Math.round(a.s.time / 1000)} s Spiel, größte Sicht ${maxView} Zeichen`);
  assert.ok(maxView < 16000, `Sicht bleibt klein (${maxView})`);
}
console.log("Light Trails erfolgreich: Startplätze, stetige Bewegung mit Stick und Halteknöpfen, kompakte Spur in der Sicht, Kollisionen (Wand, fremde und eigene Spur, Kopf an Kopf), Schrumpfen, Punkte, Aufgeben, 3 Durchgänge, Bots mit 2/4/6 Spielern und Determinismus.");
