import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, MATCH_MODULES, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { locate, NR, TRACK, trackPoint, type RacerGame } from "../shared/matches/neonRacer";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";
import { miniPool } from "../shared/minigameCatalog";
import { screenRoll, steerFromRoll } from "../src/matches/useWheelTilt";

type RS = MatchState<RacerGame>;
const make = (count = 2, seed = 4, id: "racer" | "racertilt" = "racer") => createMatch(id, Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as RS;
const seqs = new WeakMap<RS, Map<string, number>>();
function send(s: RS, id: string, values: Partial<MatchInput>, use = false) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ...values, ca: p.usedA + (use ? 1 : 0), cb: p.usedB, cn: p.usedN }, n, s.time);
}
const run = (s: RS, ms: number, each?: () => void) => { const end = s.time + ms; while (s.time < end && !s.done) { each?.(); advanceMatch(s, s.time + 50); } };
/** Places a car on the centre line at `along`, facing the driving direction. */
function put(s: RS, id: string, along: number, off = 0, v = 0) {
  const at = trackPoint(along, off), c = s.game.cars[id];
  Object.assign(c, { x: at.x, y: at.y, a: at.a, v, side: 0, seg: locate(at.x, at.y, at.i).seg, prog: along, spinUntil: 0, boostUntil: 0, shieldUntil: 0 });
  return c;
}

// Spielerzahl, Pool, gleiche Regeln für die Kipp-Variante.
{
  for (const n of [2, 3, 4, 5, 6]) assert.ok(miniPool(n, false).includes("racer") && miniPool(n, false).includes("racertilt"));
  assert.throws(() => make(1));
  assert.equal(MATCH_MODULES.racertilt.step, MATCH_MODULES.racer.step);
  assert.notEqual(MATCH_MODULES.racertilt.meta.name, MATCH_MODULES.racer.meta.name);
}

// Startaufstellung: hinter der Startlinie, auf der Strecke, alle verschieden, Blick in Fahrtrichtung.
for (const count of [2, 4, 6]) {
  const s = make(count), cars = Object.values(s.game.cars);
  assert.equal(new Set(cars.map(c => `${c.x.toFixed(2)},${c.y.toFixed(2)}`)).size, count);
  for (const c of cars) {
    assert.ok(c.prog < 0, "Hinter der Startlinie");
    assert.ok(Math.abs(locate(c.x, c.y, c.seg).off) < NR.halfWidth - NR.car, "Auf der Strecke");
  }
  assert.equal(s.game.boxes.length, NR.boxRows.length * NR.boxLanes.length);
}

// Gas, Höchsttempo, Bremse, Rückwärts, Lenken.
{
  const s = make(2); s.game.boxes = [];
  // On the start straight.
  put(s, "p0", 1); put(s, "p1", 120);
  run(s, 1750, () => send(s, "p0", { ha: true }));
  const c = s.game.cars.p0;
  assert.ok(c.v > NR.maxSpeed * .9 && c.v <= NR.maxSpeed + 1e-9, `Höchsttempo ${c.v}`);
  assert.ok(c.prog > 12, `Fortschritt entlang der Strecke (${c.prog})`);
  run(s, 1500, () => send(s, "p0", { hb: true }));
  assert.ok(c.v < 0 && c.v >= -NR.reverse - 1e-9, "Bremsen, dann rückwärts");
  const t = make(2); t.game.boxes = [];
  const car = put(t, "p0", 20, 0, 10), a0 = car.a;
  send(t, "p0", { x: 1, ha: true }); advanceMatch(t, t.time + 50); send(t, "p0", { x: 1, ha: true }); advanceMatch(t, t.time + 50);
  assert.ok(Math.atan2(Math.sin(car.a - a0), Math.cos(car.a - a0)) > .1, "Lenkrad rechts dreht nach rechts (y unten)");
}

// Wände: das Auto bleibt auf der Strecke und verliert Tempo.
{
  const s = make(2); s.game.boxes = [];
  const c = put(s, "p0", 30, 0, 15); c.a += 1.2;
  put(s, "p1", 150);
  run(s, 700, () => send(s, "p0", { ha: true }));
  assert.ok(Math.abs(locate(c.x, c.y, c.seg).off) <= NR.halfWidth - NR.car + 1e-6, "Nicht durch die Wand");
  assert.ok(s.events.some(e => e.kind === "wall" && e.ids[0] === "p0"));
}

// Runden und Ziel: drei Runden, erster im Ziel, 15 s für die anderen, Rangliste.
{
  const s = make(3); s.game.boxes = [];
  put(s, "p0", NR.laps * TRACK.length - 3, 0, 15); put(s, "p1", 2 * TRACK.length + 50); put(s, "p2", 100);
  run(s, 500, () => send(s, "p0", { ha: true }));
  assert.ok(s.game.cars.p0.finishAt !== undefined && s.game.firstFinish === s.game.cars.p0.finishAt);
  assert.equal(s.done, false, "Die anderen fahren weiter");
  run(s, NR.finishGrace + 200);
  assert.equal(s.done, true);
  assert.deepEqual(matchStandings(s).map(r => [r.id, r.place]), [["p0", 1], ["p1", 2], ["p2", 3]]);
  // Rückwärts über die Startlinie zählt nicht als Runde.
  const back = make(2); back.game.boxes = [];
  const c = put(back, "p0", 5, 0, 0); put(back, "p1", 150);
  run(back, 2000, () => send(back, "p0", { hb: true }));
  assert.ok(c.prog < 5 && c.prog > -TRACK.length / 2, `Rückwärts: Fortschritt sinkt (${c.prog})`);
}

// Items: Kiste einsammeln, Turbo, Blaster (drei Schüsse, Treffer = Schleudern), Schild blockt, Lenkrakete verfolgt.
{
  const s = make(2, 6); s.game.boxes = [{ id: 900, ...trackPoint(2), readyAt: 0 }];
  put(s, "p0", 1, 0, 3); put(s, "p1", 200);
  run(s, 300, () => send(s, "p0", { ha: true }));
  const c = s.game.cars.p0;
  assert.ok(c.item, "Kiste gibt ein Item"); assert.ok(s.game.boxes[0].readyAt > s.time, "Kiste kommt später wieder");
  c.item = "boost"; send(s, "p0", { ha: true }, true); run(s, 450, () => send(s, "p0", { ha: true }));
  assert.ok(c.v > NR.maxSpeed + 1, `Turbo über Höchsttempo (${c.v})`); assert.equal(c.item, undefined);
  // Blaster: Ziel direkt voraus.
  const g = make(2, 7); g.game.boxes = [];
  const shooter = put(g, "p0", 2, 0, 0), target = put(g, "p1", 14, 0, 0);
  shooter.item = "gun"; shooter.ammo = NR.shots;
  send(g, "p0", {}, true); advanceMatch(g, g.time + 50);
  assert.equal(shooter.ammo, NR.shots - 1);
  run(g, 600);
  assert.ok(target.spinUntil > g.time - 600 && g.events.some(e => e.kind === "hit" && e.ids[0] === "p1" && e.ids[1] === "p0"), "Treffer lässt schleudern");
  for (let i = 0; i < 2; i++) { run(g, NR.shotGap + 50); send(g, "p0", {}, true); advanceMatch(g, g.time + 50); }
  assert.equal(shooter.item, undefined, "Nach drei Schüssen leer");
  // Schild blockt.
  const h = make(2, 8); h.game.boxes = [];
  const a = put(h, "p0", 2), b = put(h, "p1", 14); b.shieldUntil = 1e9;
  a.item = "gun"; a.ammo = 3; send(h, "p0", {}, true); run(h, 600);
  assert.equal(b.spinUntil, 0, "Schild schützt"); assert.ok(h.events.some(e => e.kind === "block"));
  // Lenkrakete auf das Auto vor dir, auch um die Kurve.
  const m = make(3, 9); m.game.boxes = [];
  const m0 = put(m, "p0", 60), m1 = put(m, "p1", 85, 1.5), m2 = put(m, "p2", 10);
  m0.item = "missile"; send(m, "p0", {}, true); advanceMatch(m, m.time + 50);
  assert.equal(m.game.shots[0]?.target, "p1", "Ziel ist das nächste Auto voraus");
  run(m, 3000);
  assert.ok(m1.spinUntil > 0 && m2.spinUntil === 0, "Rakete trifft das Ziel");
}

// Kippsteuerung: Rollwinkel in der Bildschirmebene für jede Ausrichtung, Ruhelage, Totzone und Vollausschlag.
{
  const deg = (r: number | undefined) => Math.round((r ?? NaN) * 180 / Math.PI) + 0;
  // Hochkant aufrecht (beta 90): keine Drehung.
  assert.equal(deg(screenRoll(90, 0, 0)), 0);
  // Quer (Oberkante links, Bildschirmwinkel 90), aufrecht: gamma -90.
  assert.equal(deg(screenRoll(0, -90, 90)), 0);
  // Im Uhrzeigersinn gedreht (beta > 0) lenkt nach rechts.
  assert.equal(deg(screenRoll(20, -90, 90)), 20, "Im Uhrzeigersinn = rechts");
  assert.equal(deg(screenRoll(-20, -90, 90)), -20);
  // Andersherum quer (Bildschirmwinkel 270): gleiches Verhalten.
  assert.equal(deg(screenRoll(0, 90, 270)), 0);
  assert.equal(deg(screenRoll(-20, 90, 270)), 20);
  // Nach hinten gekippt (45°) bleibt die Lenkung erhalten; flach liegend gibt es keinen Rollwinkel.
  const tilted = screenRoll(14, -45, 90)!;
  assert.ok(tilted > .2, `Schräg gehalten lenkt rechts (${tilted})`);
  assert.equal(screenRoll(0, 0, 90), undefined);
  assert.equal(steerFromRoll(.02, 0), 0, "Totzone");
  assert.equal(steerFromRoll(1, 0), 1); assert.equal(steerFromRoll(-1, 0), -1);
  assert.ok(Math.abs(steerFromRoll(.3, .1) - steerFromRoll(.2, 0)) < 1e-9, "Relativ zur Ruhelage");
}

// Aufgeben, Bots über die Party (2, 4, 6) mit Neustart, Determinismus.
{
  const s = make(2); removeMatchPlayer(s, "p1"); assert.equal(s.done, true);
}
for (const id of ["racer", "racertilt"] as const) for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 90 + count, 0, "free-minigame", { miniId: id });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) { now += 50; if (i === 500) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${id} ${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
  const race = g.mini!.match as RS;
  assert.ok(Object.values(race.game.cars).some(c => c.finishAt !== undefined), "Bots kommen ins Ziel");
}
{
  const play = (restartAt?: number) => { let s = make(4, 21); for (let t = 50, n = 0; !s.done && t < 160000; t += 50) { if (t === restartAt) s = JSON.parse(JSON.stringify(s)); for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play(30000);
  assert.deepEqual(a.game, b.game, "Neustart aus JSON setzt exakt fort");
  assert.ok(a.events.length || a.eventSeq > 0);
}
console.log("Neon Racer erfolgreich: Pool und Kipp-Variante, Startaufstellung, Gas/Höchsttempo/Bremse/Rückwärts/Lenken, Wände, Runden und Ziel mit Nachlaufzeit, Rückwärts ohne Runde, Kisten, Turbo, Blaster mit Schleudern, Schild, Lenkrakete, Aufgeben, Kippsteuerung, Bots mit 2/4/6 und JSON-Neustart.");
