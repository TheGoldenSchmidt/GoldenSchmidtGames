import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { collideBoxes, fixtureBox, stepBodies, type RigidBody } from "../shared/matches/physics2d";
import { bodyTop, pieceCells, snapX, TW, type TowerBody, type TowerGame, type TowerView } from "../shared/matches/towerTumble";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type TS = MatchState<TowerGame>;
const make = (count = 2, seed = 2) => createMatch("tower", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as TS;
const seqs = new WeakMap<TS, Map<string, number>>();
function send(s: TS, id: string, values: Partial<MatchInput>, rotate = false, arrow?: -1 | 1, taps = 1) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ...values, ca: p.usedA + (rotate ? 1 : 0), cb: p.usedB, cn: p.usedN + (arrow ? taps : 0), n: arrow ?? 0 }, n, s.time);
}
/** Arrow taps, each in its own packet like the device's repeat timer. */
const tap = (s: TS, id: string, dir: -1 | 1, times = 1, values: Partial<MatchInput> = {}) => { for (let i = 0; i < times; i++) { send(s, id, values, false, dir); advanceMatch(s, s.time + 50); } };
const run = (s: TS, ms: number, each?: () => void) => { const end = s.time + ms; while (s.time < end && !s.done) { each?.(); advanceMatch(s, s.time + 50); } };
const body = (id: number, k: TowerBody["k"], r: number, x: number, y: number): TowerBody => ({ id, k, r, x, y, a: 0, vx: 0, vy: 0, w: 0 });
/** Lets a prepared tower settle without new pieces (the falling piece is parked far above). */
function settleTower(s: TS, id: string, ms = 3000) {
  const t = s.game.towers[id]; t.asleep = false; t.calm = 0;
  for (let i = 0; i < ms / 50; i++) { if (t.piece) t.piece.y = 99; t.spawnAt = Infinity; advanceMatch(s, s.time + 50); }
  return t;
}

// Physik-Kern: Kisten liegen ruhig, Kontakte haben Normalen von A nach B, Warmstart bleibt JSON.
{
  const ground: RigidBody = { id: 0, x: 0, y: -.5, a: 0, vx: 0, vy: 0, w: 0, invMass: 0, invI: 0, fixtures: [{ x: 0, y: 0, hw: 5, hh: .5 }] };
  const box = (id: number, y: number): RigidBody => ({ id, x: 0, y, a: 0, vx: 0, vy: 0, w: 0, invMass: 1, invI: 6, fixtures: [{ x: 0, y: 0, hw: .5, hh: .5 }] });
  const stack = [ground, box(1, .5), box(2, 1.5), box(3, 2.5)];
  let warm: number[] = [];
  for (let i = 0; i < 300; i++) warm = stepBodies(stack, warm, 1 / 60, TW);
  assert.ok(stack.slice(1).every((b, i) => Math.abs(b.x) < .02 && Math.abs(b.y - (i + .5)) < .05 && Math.abs(b.a) < .02), "Dreierstapel bleibt stehen");
  assert.deepEqual(JSON.parse(JSON.stringify(warm)), warm);
  const contacts = collideBoxes(fixtureBox(ground, ground.fixtures[0]), fixtureBox(stack[1], stack[1].fixtures[0]));
  assert.equal(contacts.length, 2); assert.ok(contacts.every(c => c.n.y > .99));
}

// Steine: vier Zellen um den Schwerpunkt, Vierteldrehungen, Halbzellenraster.
{
  for (const k of ["I", "O", "T", "L", "J", "S", "Z"] as const) for (let r = 0; r < 4; r++) {
    const cells = pieceCells(k, r);
    assert.equal(cells.length, 4);
    assert.ok(Math.abs(cells.reduce((n, c) => n + c[0], 0)) < 1e-9 && Math.abs(cells.reduce((n, c) => n + c[1], 0)) < 1e-9, "Schwerpunkt im Ursprung");
    const x = snapX(k, r, .37), edges = cells.map(([cx]) => x + cx - .5);
    assert.ok(edges.every(e => Math.abs(e * 2 - Math.round(e * 2)) < 1e-9), `${k}${r}: Kanten auf dem Halbzellenraster`);
  }
  assert.deepEqual(pieceCells("I", 1).map(c => c[0]), [0, 0, 0, 0], "I senkrecht nach einer Drehung");
}

// Alle bekommen dieselbe Steinfolge (7er-Beutel); Start gleichzeitig.
{
  const s = make(3);
  run(s, 100);
  const kinds = s.players.map(p => s.game.towers[p.id].piece!.k);
  assert.equal(new Set(kinds).size, 1, "Gleicher erster Stein");
  run(s, 30000, () => s.players.forEach(p => send(s, p.id, { ha: true })));
  assert.ok(s.game.sequence.length >= 7);
  for (let i = 0; i + 7 <= s.game.sequence.length; i += 7) assert.equal(new Set(s.game.sequence.slice(i, i + 7)).size, 7, "Jeder Beutel enthält alle sieben Formen");
}

// Steuerung: Pfeile verschieben um eine halbe Zelle, Drehen, schnelles Fallen, Landen wird zum Körper.
{
  const s = make(2);
  run(s, 100);
  const t = s.game.towers.p0, piece = t.piece!, y0 = piece.y, x0 = piece.x;
  tap(s, "p0", -1); run(s, 100);
  assert.ok(Math.abs(piece.x - (x0 - .5)) < 1e-9, `Ein Tipp links = halbe Zelle (${piece.x})`);
  tap(s, "p0", 1, 3); run(s, 150);
  assert.ok(Math.abs(piece.x - (x0 + 1)) < 1e-9, `Drei Tipps rechts = 1,5 Zellen (${piece.x})`);
  piece.y = 40; // Fixture: genug Fallhöhe für die vielen Tipps
  tap(s, "p0", 1, 40); run(s, 300);
  assert.ok(Math.abs(piece.x - snapX(piece.k, piece.r, TW.laneHalf)) < 1e-9 && piece.x <= TW.laneHalf, "Rechts außen ist Schluss");
  send(s, "p0", {}, false, -1, 3); advanceMatch(s, s.time + 50); run(s, 200);
  assert.ok(Math.abs(piece.x - (snapX(piece.k, piece.r, TW.laneHalf) - 1.5)) < 1e-9, "Drei Tipps im selben Paket zählen alle");
  const held = piece.x;
  send(s, "p0", {}, false, 7 as 1); run(s, 200);
  assert.equal(piece.x, held, "Unbekannte Richtungen werden ignoriert");
  tap(s, "p0", -1, Math.round((piece.tx - x0) * 2)); run(s, 300);
  assert.ok(Math.abs(piece.x - x0) < 1e-9 && t.piece === piece, "Zurück in der Mitte");
  piece.y = y0;
  const r = piece.r; send(s, "p0", {}, true); advanceMatch(s, s.time + 50);
  assert.equal(piece.r, (r + 1) % 4, "Tippen dreht um 90°");
  const slow = y0 - piece.y, at = s.time;
  send(s, "p0", { ha: true }); run(s, 200);
  assert.ok(y0 - piece.y - slow > TW.fastFall * (s.time - at) / 1000 * .8, "Gedrückt halten lässt schnell fallen");
  run(s, 3000, () => send(s, "p0", { ha: true }));
  assert.ok(t.placed >= 1 && t.bodies.length >= 1, "Gelandeter Stein wird Teil der Simulation");
  // Neben den Sockel gesteuert: der Stein fällt ins Leere, zählt als verloren, der nächste kommt.
  const lost = t.lost;
  for (let i = 0; i < 8000 / 50 && t.lost === lost; i++) send(s, "p0", { ha: t.piece !== undefined && t.piece.x > 4 }, false, 1), advanceMatch(s, s.time + 50);
  assert.ok(t.lost > lost && t.piece, "Daneben gesteuerter Stein ist verloren, es geht weiter");
}

// Physik im Turm: überstehender Stein kippt herunter, gut gestützter bleibt; Verlust wird gezählt.
{
  const s = make(2);
  run(s, 50);
  const t = s.game.towers.p0;
  // Waagrechtes I mit Schwerpunkt weit neben dem Sockel: kippt und fällt.
  t.bodies = [body(1, "I", 0, TW.baseHalf + 1.2, .5)]; t.nextId = 2;
  settleTower(s, "p0", 4000);
  assert.equal(t.bodies.length, 0); assert.equal(t.lost, 1, "Überstehender Stein fällt herunter");
  // Quadrat mittig und ein darauf liegendes I mit Schwerpunkt über dem Quadrat: bleibt liegen.
  t.bodies = [body(2, "O", 0, 0, 1), body(3, "I", 0, .5, 2.5)]; t.nextId = 4;
  settleTower(s, "p0");
  assert.equal(t.bodies.length, 2); assert.ok(Math.abs(t.bodies[1].a) < .05 && Math.abs(t.bodies[1].y - 2.5) < .1, "Gestützter Stein bleibt liegen");
  assert.equal(t.asleep, true, "Ruhender Turm schläft und kriecht nicht");
  assert.ok(Math.abs(t.height - 3) < .1, `Höhe zählt ruhende Steine (${t.height})`);
}

// Ziel: zwei Sekunden über der Linie gewinnt; unter die Linie fallen setzt die Zeit zurück.
{
  const s = make(2);
  run(s, 50);
  const t = s.game.towers.p1;
  t.bodies = Array.from({ length: 5 }, (_, i) => body(i + 1, "I", 1, 0, 2 + i * 4)); t.nextId = 6;
  for (const b of t.bodies) assert.ok(bodyTop(b) <= 20);
  t.asleep = false; t.calm = 0;
  for (let i = 0; i < 10; i++) { s.game.towers.p0.spawnAt = Infinity; s.game.towers.p0.piece = undefined; t.spawnAt = Infinity; t.piece = undefined; advanceMatch(s, s.time + 50); }
  if (t.height >= TW.goal) {
    assert.ok(t.holdSince !== undefined && !s.done, "Halten läuft");
    // Fällt der Turm vorher, startet die Haltezeit neu – hier bleibt er (senkrechte Säule) stehen.
    run(s, TW.holdMs + 200, () => { t.spawnAt = Infinity; t.piece = undefined; });
    assert.equal(s.done, true); assert.equal(s.game.winner, "p1");
    const table = matchStandings(s);
    assert.equal(table[0].id, "p1"); assert.equal(table[0].place, 1);
  } else assert.fail(`Säule sollte über der Linie stehen (${t.height})`);
  // Haltezeit wird bei Einsturz zurückgesetzt.
  const u = make(2); run(u, 50);
  const v = u.game.towers.p0; v.holdSince = u.time; v.bodies = []; v.asleep = false;
  advanceMatch(u, u.time + 50);
  assert.equal(v.holdSince, undefined);
}

// Zeitablauf: Höhe entscheidet, gleiche Höhe teilt den Platz; Aufgeben beendet bei einem Rest.
{
  const s = make(3);
  run(s, 50);
  for (const id of ["p0", "p1", "p2"]) { const t = s.game.towers[id]; t.spawnAt = Infinity; t.piece = undefined; }
  s.game.towers.p0.bodies = [body(1, "O", 0, 0, 1)]; s.game.towers.p1.bodies = [body(1, "O", 0, 0, 1)]; s.game.towers.p2.bodies = [];
  for (const t of Object.values(s.game.towers)) { t.asleep = false; t.calm = 0; }
  run(s, TW.regular + 1000, () => { for (const t of Object.values(s.game.towers)) { t.spawnAt = Infinity; t.piece = undefined; } });
  assert.equal(s.done, true); assert.equal(s.game.winner, undefined);
  const table = matchStandings(s);
  assert.deepEqual(table.map(r => r.place), [1, 1, 3], "Gleiche Höhe teilt Platz 1");
  const q = make(2); run(q, 100);
  removeMatchPlayer(q, "p0");
  assert.equal(q.done, true); assert.equal(matchStandings(q)[0].id, "p1");
}

// Öffentliche Sicht: Körper gepackt, ohne Geschwindigkeiten und Warmstart; Folge nur bis zum nächsten Stein.
{
  const s = make(2); run(s, 2000, () => send(s, "p0", { ha: true }));
  const view = publicMatch(s, "p1").game as unknown as { towers: Record<string, TowerView>; sequence: string[] };
  const t = view.towers.p0 as TowerView & { bodies?: unknown; warm?: unknown };
  assert.equal(t.bodies, undefined); assert.equal(t.warm, undefined);
  assert.ok(Array.isArray(t.packed));
  assert.ok(view.sequence.length <= Math.max(s.game.towers.p0.next, s.game.towers.p1.next) + 1, "Keine Vorschau weit in die Zukunft");
}

// Determinismus und Neustart aus JSON: gleiche Eingaben → gleicher Zustand, auch mit Unterbrechung.
{
  const play = (restartAt?: number) => {
    let s = make(4, 9);
    for (let t = 50, n = 0; t <= 30000; t += 50) {
      if (t === restartAt) s = JSON.parse(JSON.stringify(s));
      for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t);
      advanceMatch(s, t);
    }
    return s;
  };
  const a = play(), b = play(12000);
  assert.deepEqual(a.game, b.game, "Neustart setzt die Physik exakt fort");
  assert.ok(Object.values(a.game.towers).some(t => t.placed >= 5), "Bots bauen");
}

// Komplette Partien mit Bots über die Party (2, 4, 6) inklusive Neustart.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 50 + count, 0, "free-minigame", { miniId: "tower" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) { now += 50; if (i === 400) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
// Survival: keine Ziellinie, drei verlorene Steine = raus, Letzter gewinnt, Zeitablauf nach Höhe, Steine werden schneller.
{
  const survive = (count = 3, seed = 4) => createMatch("towersurvival", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as TS;
  const s = survive();
  assert.equal(s.game.survival, true);
  // Steine neben den Sockel steuern: jeder zählt als verloren.
  const loseOne = (id: string) => { const before = s.game.towers[id].lost; for (let i = 0; i < 400 && s.game.towers[id].lost === before && !s.done; i++) { if (s.game.towers[id].piece) send(s, id, { ha: true }, false, 1, 1); advanceMatch(s, s.time + 50); } };
  loseOne("p0"); loseOne("p0");
  assert.equal(s.game.towers.p0.outAt, undefined, "Zwei verlorene Steine: noch dabei");
  loseOne("p0");
  assert.ok(s.game.towers.p0.outAt !== undefined, "Drei verlorene Steine: raus");
  assert.ok(s.events.some(e => e.kind === "out" && e.ids[0] === "p0"));
  run(s, 600);
  assert.equal(s.game.towers.p0.piece, undefined, "Ausgeschiedene bauen nicht weiter");
  loseOne("p1"); loseOne("p1"); loseOne("p1");
  assert.equal(s.done, true, "Nur noch einer baut");
  assert.equal(s.game.winner, "p2");
  assert.deepEqual(matchStandings(s).map(r => r.id), ["p2", "p1", "p0"], "Später raus = besser");
  // Kein Ziel: Höhe über der Ziellinie beendet nichts.
  const high = survive(2, 7);
  high.game.towers.p0.bodies = Array.from({ length: 20 }, (_, i) => body(i + 1, "O", 0, 0, 1 + i * 2));
  high.game.towers.p0.asleep = true;
  run(high, 3000);
  assert.equal(high.done, false); assert.equal(high.game.towers.p0.finishedAt, undefined);
  assert.ok(high.game.towers.p0.best > TW.goal, "Höhe zählt weiter");
  // Zeitablauf: höchster Turm vorne, gleiche Höhe teilt.
  const timed = survive(2, 8);
  timed.game.towers.p1.bodies = [body(1, "O", 0, 0, 1)]; timed.game.towers.p1.asleep = true;
  advanceMatch(timed, TW.survivalMs);
  assert.equal(timed.done, true); assert.equal(matchStandings(timed)[0].id, "p1");
  // Steine fallen mit der Zeit schneller.
  const fast = survive(2, 9); fast.time = TW.survivalMs - 6000; advanceMatch(fast, fast.time + 100);
  const y0 = fast.game.towers.p0.piece!.y; advanceMatch(fast, fast.time + 100);
  assert.ok(y0 - fast.game.towers.p0.piece!.y > TW.fall * .1 * 1.5, "Schnellerer Fall gegen Ende");
}
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 60 + count, 0, "free-minigame", { miniId: "towersurvival" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4500 && g.phase !== "finished"; i++) { now += 50; if (i === 300) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `Survival ${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}

console.log("Tower Tumble erfolgreich: Survival (drei Verluste, Letzter, Zeitablauf, schneller), Physik-Kern, Steinformen und Raster, gleiche Steinfolge, Verschieben, Drehen, schnelles Fallen, Landen, Kippen und Verlust, Schlafen, Höhe, Ziel mit Haltezeit, Zeitablauf und Gleichstand, Aufgeben, öffentliche Sicht, Determinismus, JSON-Neustart und Bots mit 2, 4 und 6 Spielern.");
