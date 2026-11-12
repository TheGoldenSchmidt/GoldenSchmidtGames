import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, checkedMatchInput, createMatch, INPUT_HOLD, inputOf, MATCH_MODULES, matchStandings, publicMatch, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { emit, NEUTRAL_MATCH_INPUT, presence, rank, type MatchInput, type MatchModule, type MatchState } from "../shared/matches/types";

/**
 * Simple test game ("Tippzähler") that validates the framework without any
 * real game rules: every tap scores, the stick moves a dot, 5 points win.
 */
interface Counter { taps: Record<string, number>; dots: Record<string, number>; secret: number }
const counter: MatchModule<Counter> = {
  id: "counter",
  meta: { name: "Tippzähler", seconds: 10, players: [2, 3, 4], hz: 10, instruction: "", controls: "", look: { icon: "", action: "", hint: "", goal: "" } },
  create: s => ({ taps: Object.fromEntries(s.players.map(p => [p.id, 0])), dots: Object.fromEntries(s.players.map(p => [p.id, 0])), secret: 42 }),
  step(s) {
    for (const p of s.players) s.game.dots[p.id] += inputOf(s, p).x;
    if (Object.values(s.game.taps).some(n => n >= 5)) s.done = true;
  },
  press(s, p, kind) { if (kind === "a") { s.game.taps[p.id]++; emit(s, "tap", "+1", [p.id]); } },
  standings: s => rank(s.players.map(p => ({ id: p.id, score: s.game.taps[p.id], keys: [presence(p), s.game.taps[p.id]] }))),
  view: s => { s.game.secret = 0; },
  bot: () => ({ pressA: true, x: .5 })
};
(MATCH_MODULES as Record<string, MatchModule<any>>).counter = counter;
const players = ["a", "b", "c"].map((id, i) => ({ id, style: i }));
const make = () => createMatch("counter" as never, players, 7) as MatchState<Counter>;
const packet = (values: Partial<MatchInput>): MatchInput => ({ ...NEUTRAL_MATCH_INPUT, ...values });

// Spielerzahl wird geprüft.
assert.throws(() => createMatch("counter" as never, players.slice(0, 1), 1), /braucht 2–4 Spieler/);
assert.throws(() => createMatch("counter" as never, [...players, { id: "d", style: 3 }, { id: "e", style: 4 }], 1));

// Eingabeprüfung: Grenzen, Typen und Zähler.
for (const bad of [null, {}, packet({ x: 2 }), packet({ ax: NaN }), packet({ ca: -1 }), packet({ cb: 1.5 }), packet({ n: Infinity }), { ...packet({}), ha: "ja" }, packet({ held: 99999 })]) assert.throws(() => checkedMatchInput(bad));
const long = checkedMatchInput(packet({ x: 1, y: 1 }));
assert.ok(Math.abs(Math.hypot(long.x, long.y) - 1) < 1e-9, "Stick wird auf Länge 1 begrenzt");

// Folgenummern: alte und doppelte Pakete bleiben wirkungslos.
let s = make();
assert.throws(() => setMatchControl(s, "zz", packet({}), 1, 0), /gehört nicht/);
assert.throws(() => setMatchControl(s, "a", packet({}), 0, 0), /Eingabefolge/);
assert.equal(setMatchControl(s, "a", packet({ ca: 1 }), 1, 0), true);
assert.equal(setMatchControl(s, "a", packet({ ca: 1 }), 1, 0), false);
assert.equal(s.game.taps.a, 1);
// Verlorenes Paket: der nächste Zähler trägt den Tipp nach.
setMatchControl(s, "a", packet({ ca: 3 }), 3, 0);
assert.equal(s.game.taps.a, 3);
// Zurücklaufende Zähler werden ignoriert, Fluten auf drei Tipps je Paket begrenzt.
setMatchControl(s, "a", packet({ ca: 2 }), 4, 0);
assert.equal(s.game.taps.a, 3);
setMatchControl(s, "b", packet({ ca: 50 }), 1, 0);
assert.equal(s.game.taps.b, 3);
assert.equal(s.players.find(p => p.id === "b")!.usedA, 50);

// Eingaben laufen nach INPUT_HOLD auf neutral aus (Verbindungsabbruch).
s = make();
setMatchControl(s, "a", packet({ x: 1 }), 1, 0);
advanceMatch(s, INPUT_HOLD);
const moved = s.game.dots.a;
assert.equal(moved, INPUT_HOLD / 50);
advanceMatch(s, INPUT_HOLD + 500);
assert.equal(s.game.dots.a, moved, "Ohne neue Pakete bewegt sich nichts weiter");
assert.equal(inputOf(s, s.players[0]).x, 0);

// Feste Schritte, Determinismus und harte Zeitgrenze.
const one = make(), two = make();
advanceMatch(one, 3333); for (let t = 0; t <= 3333; t += 7) advanceMatch(two, t);
assert.deepEqual(one, two);
assert.equal(one.time, 3300);
advanceMatch(one, 999999);
assert.equal(one.time, 10000); assert.equal(one.done, true);
assert.equal(setMatchControl(one, "a", packet({ ca: 1 }), 1, 10000), false, "Nach Spielende keine Wirkung");

// Laufzeitmessung bleibt begrenzt.
s = make();
setMatchControl(s, "a", packet({ echo: 1000, held: 20 }), 1, 0, 1100);
assert.ok(s.players[0].rtt > 80 && s.players[0].rtt < 120);
for (let i = 2; i < 40; i++) setMatchControl(s, "a", packet({ echo: 0, held: 0 }), i, 0, 4000);
assert.ok(s.players[0].rtt >= 290 && s.players[0].rtt <= 300, "Laufzeit höchstens 300 ms");

// Öffentliche Sicht: kein Zufallszustand, keine fremden Eingaben, Modulgeheimnisse verborgen.
s = make();
setMatchControl(s, "b", packet({ x: .7 }), 1, 0, 50);
const view = publicMatch(s, "a");
assert.equal(view.rng, 0); assert.equal(view.game.secret, 0);
assert.equal(view.players[1].input, undefined, "Fremde Eingaben werden nicht übertragen");
assert.deepEqual(Object.keys(view.players[1]).sort(), ["gone", "id", "style", "team"]);
assert.equal(publicMatch(s, "b").players[1].input.x, .7);
assert.equal(s.game.secret, 42, "Die Autorität behält ihren Zustand");
// Öffentliche Zahlen sind gerundet, Ereignisse auf die letzten 1,5 s begrenzt.
s.game.dots.a = 1 / 3; s.time = 5000; s.events = [{ seq: 1, at: 1000, kind: "x", text: "", ids: [] }, { seq: 2, at: 4800, kind: "y", text: "", ids: [] }];
const lean = publicMatch(s, "a");
assert.equal(lean.game.dots.a, .333); assert.deepEqual(lean.events.map(e => e.seq), [2]);

// Aufgeben und Rangliste: später Ausgeschiedene stehen vor früher Ausgeschiedenen.
s = make();
setMatchControl(s, "a", packet({ ca: 2 }), 1, 0);
removeMatchPlayer(s, "a"); removeMatchPlayer(s, "b");
assert.deepEqual(matchStandings(s).map(r => [r.id, r.place]), [["c", 1], ["b", 2], ["a", 3]]);
assert.equal(setMatchControl(s, "a", packet({ ca: 9 }), 5, 0), false);

// Geteilte Plätze bei Gleichstand.
assert.deepEqual(rank([{ id: "x", score: 3, keys: [3] }, { id: "y", score: 3, keys: [3] }, { id: "z", score: 1, keys: [1] }]).map(r => r.place), [1, 1, 3]);

// Bots senden normale, gültige Eingaben aus ihrer öffentlichen Sicht.
s = make();
for (let i = 1; i <= 5; i++) setMatchControl(s, "c", botMatchInput(s, "c"), i, 0);
advanceMatch(s, 50);
assert.equal(s.game.taps.c, 5); assert.equal(s.done, true);
assert.deepEqual(JSON.parse(JSON.stringify(s)), s, "Zustand ist verlustfrei serialisierbar (Neustart)");
console.log("Match-Framework erfolgreich: Spielerzahl, Eingabeprüfung, Folgenummern, Zähler, Ablauf, Determinismus, Zeitgrenze, Laufzeit, Sicht, Aufgeben, Gleichstand und Bots.");
