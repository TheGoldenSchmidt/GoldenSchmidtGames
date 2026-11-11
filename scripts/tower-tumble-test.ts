import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { landingY, settle, TW, type Block, type TowerGame } from "../shared/matches/towerTumble";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type TS = MatchState<TowerGame>;
const make = (count = 2, seed = 2) => createMatch("tower", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as TS;
const rect = (id: number, x: number, y: number, w: number, h: number, owner = "p0"): Block => ({ id, owner, kind: "box", parts: [{ dx: 0, dy: 0, w, h }], x, y, w, h });
const seqs = new WeakMap<TS, Map<string, number>>();
function send(s: TS, id: string, x: number, drop: boolean) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, x, ca: p.usedA + (drop ? 1 : 0) }, n, s.time);
}
/** Drops the current block with its left edge at world x (converted to the finger position). */
function dropAt(s: TS, worldX: number, shape?: { w: number; h: number; parts: Block["parts"] }) {
  const g = s.game, current = g.current!;
  if (shape) current.shape = { kind: "test", ...shape };
  const x = worldX / (TW.width - current.shape.w) * 2 - 1;
  send(s, current.owner, x, false); advanceMatch(s, s.time + 50); send(s, current.owner, x, true);
  for (let i = 0; i < 200 && g.phase !== "result"; i++) advanceMatch(s, s.time + 50);
}
const nextTurn = (s: TS) => advanceMatch(s, s.game.phaseStart + TW.resultMs + 50);

// Stabilität nach statischem Gleichgewicht.
{
  assert.equal(settle([rect(1, 4, 0, 2, 1)]).fallen.length, 0, "Auf dem Sockel stabil");
  assert.equal(settle([rect(1, 6.5, 0, 2, 1)]).fallen.length, 1, "Schwerpunkt neben dem Sockel → kippt");
  // Brett über zwei Säulen: Auflage reicht über beide, also stabil.
  assert.equal(settle([rect(1, 3, 0, .8, 1.6), rect(2, 6.2, 0, .8, 1.6), rect(3, 3, 1.6, 4, .5)]).fallen.length, 0);
  // Überhang: Schwerpunkt jenseits der Kante fällt, ein Gegengewicht rettet ihn.
  const overhang = [rect(1, 4, 0, 2, 1), rect(2, 5.4, 1, 2, .5)];
  assert.deepEqual(settle(overhang).fallen.map(b => b.id), [2]);
  assert.equal(settle([...overhang, rect(3, 4.2, 1, 1, 1)]).fallen.length, 1, "Getrennter Stein trägt nicht mit");
  assert.equal(settle([rect(1, 4, 0, 2, 1), rect(2, 4.8, 1, 2.6, .5), rect(3, 4.8, 1.5, .6, 1.6)]).fallen.length, 0, "Last über der Auflage hält den Überhang");
  // Last oben bringt einen unteren Stein zum Kippen: alles darüber fällt mit.
  const chain = [rect(1, 4, 0, 1, 1), rect(2, 4.6, 1, 1, 1), rect(3, 5.3, 2, 1.5, .6)];
  assert.equal(settle(chain).fallen.length, 2);
  assert.equal(landingY([rect(1, 4, 0, 2, 1)], { parts: [{ dx: 0, dy: 0, w: 1, h: 1 }] }, 5.5), 1);
  assert.equal(landingY([], { parts: [{ dx: 0, dy: 0, w: 1, h: 1 }] }, 8), -Infinity, "Neben dem Sockel kein Halt");
  const ell = { parts: [{ dx: 0, dy: 0, w: .6, h: 1.2 }, { dx: .6, dy: 0, w: 1.4, h: .5 }] };
  assert.equal(landingY([rect(1, 4.7, 0, 1, 1)], ell, 4.2), 1, "Zusammengesetzte Form landet auf dem höchsten Teil");
}

// Zugreihenfolge: jeder genau 3 Steine, die Reihenfolge rotiert je Durchgang.
{
  const s = make(3);
  assert.deepEqual(s.game.turns, ["p0", "p1", "p2", "p1", "p2", "p0", "p2", "p0", "p1"]);
  assert.equal(s.game.current!.owner, "p0");
  // Nur die Person am Zug bewegt und lässt fallen.
  send(s, "p1", .5, true); advanceMatch(s, s.time + 50);
  assert.equal(s.game.phase, "aim");
}

// Wertung: stabil +1, Rekordhöhe +1, Abrutschen 0, Einsturz −2 und neuer Turm, automatischer Fall nach 5 s.
{
  const s = make(2), box = { w: 1, h: 1, parts: [{ dx: 0, dy: 0, w: 1, h: 1 }] };
  dropAt(s, 4.5, box);
  assert.equal(s.game.last!.outcome, "stable"); assert.equal(s.game.points.p0, 2, "Stabil + erste Rekordhöhe");
  nextTurn(s);
  dropAt(s, 8.5, box);
  assert.equal(s.game.last!.outcome, "slip"); assert.equal(s.game.points.p1, 0);
  nextTurn(s);
  dropAt(s, 4.5, { w: .7, h: .3, parts: [{ dx: 0, dy: 0, w: .7, h: .3 }] });
  assert.equal(s.game.points.p1, 1, "Stabil, aber kein deutlicher Rekord");
  nextTurn(s);
  // Ein überhängendes Brett trägt sich gerade noch; ein schwerer Stein auf seinem Ende kippt es samt Last → Einsturz.
  s.game.blocks = [rect(1, 4.5, 0, 1, 1, "p0"), rect(90, 4.0, 1, 2, .5, "p1")];
  assert.equal(settle(s.game.blocks).fallen.length, 0, "Vorher stabil");
  dropAt(s, 5.8, { w: 2, h: 1, parts: [{ dx: 0, dy: 0, w: 2, h: 1 }] });
  assert.equal(s.game.last!.outcome, "collapse"); assert.equal(s.game.blocks.length, 0, "Neuer Turm");
  assert.equal(s.game.points[s.game.last!.owner], (s.game.last!.owner === "p0" ? 2 : 1) - TW.collapsePenalty);
  nextTurn(s);
  const owner = s.game.current!.owner, start = s.game.phaseStart;
  advanceMatch(s, start + TW.aimMs + 50);
  assert.notEqual(s.game.phase, "aim", "Fällt nach 5 s automatisch");
  void owner;
}

// Gleichstand: größerer eigener Höhenbeitrag, sonst Stechrunde; Aufgeben überspringt Züge.
{
  const s = make(2);
  s.game.turn = s.game.turns.length - 1; s.game.points = { p0: 3, p1: 3 }; s.game.bestGain = { p0: 1, p1: 1 };
  s.game.phase = "result"; s.game.current = undefined; s.game.phaseStart = s.time;
  nextTurn(s);
  assert.deepEqual(s.game.tiebreak, ["p0", "p1"]);
  dropAt(s, 4.5, { w: .6, h: .6, parts: [{ dx: 0, dy: 0, w: .6, h: .6 }] }); nextTurn(s);
  dropAt(s, 4.4, { w: .8, h: 1.6, parts: [{ dx: 0, dy: 0, w: .8, h: 1.6 }] }); nextTurn(s);
  assert.equal(s.done, true); assert.equal(s.game.winner, "p1");
  assert.equal(matchStandings(s)[0].id, "p1");
  const quit = make(3);
  removeMatchPlayer(quit, "p1");
  dropAt(quit, 4.5); nextTurn(quit);
  assert.equal(quit.game.current!.owner, "p2", "Züge Ausgeschiedener entfallen");
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 50 + count, 0, "free-minigame", { miniId: "tower" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 5000 && g.phase !== "finished"; i++) { now += 50; if (i === 200) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 71); for (let t = 50, n = 0; !s.done && t < 240000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.points, b.game.points); assert.deepEqual(a.game.blocks, b.game.blocks);
}
console.log("Tower Tumble erfolgreich: Gleichgewichtskriterium (Sockel, Brücke, Überhang, Gegengewicht, Kettenkippen), Landung, Zugreihenfolge mit Rotation, Zugrecht, Punkte, Rekord, Abrutschen, Einsturz mit neuem Turm, automatischer Fall, Stechrunde, Aufgeben, Bots und Determinismus.");
