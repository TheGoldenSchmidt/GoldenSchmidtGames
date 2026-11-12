import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { BA, spiral, type Bomb, type BombGame } from "../shared/matches/bombArena";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type BS = MatchState<BombGame>;
const make = (count: number, seed = 6) => createMatch("bombs", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as BS;
/** Fixture: no crates, all bombers vulnerable. */
function clear(s: BS) { s.game.cells = s.game.cells.replace(/2/g, "0"); for (const b of Object.values(s.game.bombers)) b.invulnUntil = 0; }
const seqs = new Map<string, number>();
function send(s: BS, id: string, values: Partial<MatchInput>) {
  const p = s.players.find(q => q.id === id)!, k = `${s.seed}${id}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
const bomb = (s: BS, id: string) => send(s, id, { ca: s.players.find(p => p.id === id)!.usedA + 1 });
const put = (s: BS, id: string, x: number, y: number) => Object.assign(s.game.bombers[id], { cx: x, cy: y, tx: x, ty: y, progress: 0, alive: true });
const step = (s: BS, ms: number) => advanceMatch(s, s.time + ms);
const cell = (s: BS, x: number, y: number) => s.game.cells[y * BA.cols + x];

// Arena: Rand und Säulen fest, Startbereiche frei, gleicher Startwert → gleiche Arena.
for (let seed = 1; seed < 30; seed++) {
  const s = make(6, seed);
  assert.equal(make(6, seed).game.cells, s.game.cells);
  for (let x = 0; x < BA.cols; x++) assert.ok(cell(s, x, 0) === "1" && cell(s, x, BA.rows - 1) === "1");
  for (let y = 2; y < BA.rows - 1; y += 2) for (let x = 2; x < BA.cols - 1; x += 2) assert.equal(cell(s, x, y), "1");
  for (const b of Object.values(s.game.bombers)) {
    assert.equal(cell(s, b.cx, b.cy), "0");
    assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => cell(s, b.cx + dx, b.cy + dy) === "0").length >= 1, "Startplatz mit Ausweg");
  }
  assert.ok(s.game.cells.includes("2"));
}

// Bewegung: ein Feld pro Schritt, Mauern und Bomben blockieren, eigene Bombe darf verlassen werden, Umkehren.
{
  const s = make(2); clear(s);
  put(s, "p0", 1, 1);
  send(s, "p0", { x: 1 }); step(s, BA.moveMs + 50);
  assert.ok(s.game.bombers.p0.cx >= 2, "Ein Feld je Schrittzeit");
  put(s, "p0", 2, 1);
  send(s, "p0", { y: 1 }); step(s, BA.moveMs * 2);
  assert.deepEqual([s.game.bombers.p0.cx, s.game.bombers.p0.cy, s.game.bombers.p0.ty], [2, 1, 1], "Säule (2,2) blockiert");
  put(s, "p0", 1, 3);
  bomb(s, "p0");
  assert.equal(s.game.bombs.length, 1);
  send(s, "p0", { y: 1 }); step(s, BA.moveMs + 50);
  assert.equal(s.game.bombers.p0.cy, 4, "Eigene Bombe verlassen");
  send(s, "p0", { y: -1 }); step(s, BA.moveMs + 50);
  assert.equal(s.game.bombers.p0.cy, 4, "Danach blockiert die Bombe");
  put(s, "p1", 3, 1);
  send(s, "p1", { x: 1 }); step(s, 100);
  const mid = s.game.bombers.p1.progress;
  send(s, "p1", { x: -1 }); step(s, 50);
  assert.ok(s.game.bombers.p1.tx === 3 && s.game.bombers.p1.cx === 4 && s.game.bombers.p1.progress > 1 - mid - .01, "Umkehren mitten im Schritt");
}

// Bomben: nur eine aktiv, 2 s Zünder, Kreuz mit Reichweite 2, feste Mauern stoppen, Kisten verschwinden und stoppen.
{
  const s = make(2); clear(s);
  put(s, "p0", 3, 3); put(s, "p1", 9, 13);
  s.game.cells = s.game.cells.slice(0, 3 * BA.cols + 4) + "2" + s.game.cells.slice(3 * BA.cols + 5); // Kiste rechts
  bomb(s, "p0"); bomb(s, "p0");
  assert.equal(s.game.bombs.length, 1, "Nur eine Bombe zu Beginn");
  send(s, "p0", { y: -1 }); step(s, 400); send(s, "p0", { x: -1 }); step(s, 400);
  step(s, BA.fuse - 900);
  assert.equal(s.game.bombs.length, 1);
  step(s, 100);
  assert.equal(s.game.bombs.length, 0);
  const flames = s.game.flames.map(f => `${f.x},${f.y}`).sort();
  assert.ok(flames.includes("3,3") && flames.includes("3,4") && flames.includes("3,5") && flames.includes("4,3"));
  assert.ok(!flames.includes("5,3"), "Kiste stoppt die Ausbreitung");
  assert.ok(!flames.includes("3,6"), "Reichweite 2");
  assert.equal(cell(s, 4, 3), "0", "Kiste zerstört");
}

// Kettenreaktion im selben Schritt; eine Explosionsgruppe schadet nur einmal.
{
  const s = make(2); clear(s);
  put(s, "p0", 9, 13); put(s, "p1", 3, 5);
  const mk = (id: number, x: number, y: number, at: number): Bomb => ({ id, x, y, owner: "p0", at, range: 2, passFor: [] });
  s.game.bombs = [mk(1, 3, 3, s.time + 100), mk(2, 3, 5, s.time + 1900), mk(3, 1, 5, s.time + 1900)];
  step(s, 100);
  assert.equal(s.game.bombs.length, 0, "Bombe 2 und 3 explodieren sofort mit");
  assert.equal(new Set(s.game.flames.map(f => f.group)).size, 1);
  assert.equal(s.game.bombers.p1.lives, BA.lives - 1, "Nur ein Schaden trotz mehrerer Flammen");
}

// Schaden, sicherer Respawn, K.o. +2 nur durch gegnerische Bomben, Eigentreffer ohne Punkte.
{
  const s = make(3); clear(s);
  put(s, "p0", 5, 7); put(s, "p1", 5, 9); put(s, "p2", 1, 13);
  bomb(s, "p0"); send(s, "p0", { x: 1 }); step(s, 300); send(s, "p0", { y: -1 }); step(s, 400); send(s, "p0", {});
  step(s, BA.fuse);
  const p1 = s.game.bombers.p1;
  assert.equal(p1.lives, 1); assert.ok(p1.invulnUntil > s.time);
  assert.ok(!s.game.flames.some(f => f.x === p1.cx && f.y === p1.cy), "Sicherer Respawn");
  put(s, "p1", 5, 9); p1.invulnUntil = 0;
  put(s, "p0", 7, 9); bomb(s, "p0"); send(s, "p0", { y: 1 }); step(s, 400); send(s, "p0", {});
  step(s, BA.fuse);
  assert.equal(p1.alive, false); assert.equal(s.game.points.p0, BA.knockout);
  const self = make(2, 3); clear(self);
  put(self, "p0", 5, 7); self.game.bombers.p0.lives = 1; put(self, "p1", 1, 1);
  bomb(self, "p0"); step(self, BA.fuse + 50);
  assert.equal(self.game.bombers.p0.alive, false); assert.equal(self.game.points.p1, BA.roundWin, "Nur der Durchgangssieg, kein K.o.-Punkt");
}

// Power-ups: Reichweite, Bomben, Tempo, Kick.
{
  const s = make(2); clear(s);
  put(s, "p0", 1, 1); put(s, "p1", 9, 13);
  s.game.items = [{ x: 2, y: 1, kind: "range" }, { x: 3, y: 1, kind: "bomb" }, { x: 4, y: 1, kind: "speed" }, { x: 5, y: 1, kind: "kick" }];
  for (let i = 0; i < 6; i++) { send(s, "p0", { x: 1 }); step(s, BA.moveMs); }
  const b = s.game.bombers.p0;
  assert.deepEqual([b.range, b.maxBombs, b.speed, b.kick], [3, 2, 1, true]);
  put(s, "p0", 3, 1);
  bomb(s, "p0"); send(s, "p0", { x: -1 }); step(s, 400); bomb(s, "p0");
  assert.equal(s.game.bombs.length, 2, "Zwei Bomben nach Power-up");
  const k = make(2, 4); clear(k);
  put(k, "p0", 1, 1); put(k, "p1", 9, 13); k.game.bombers.p0.kick = true;
  k.game.bombs = [{ id: 1, x: 2, y: 1, owner: "p1", at: k.time + 1500, range: 1, passFor: [] }];
  send(k, "p0", { x: 1 }); step(k, 600);
  assert.ok(k.game.bombs[0].x > 3, "Gekickte Bombe rutscht");
}

// Schrumpfen ab 25 s, Umweltschaden ohne Punkte; Zeitablauf: mehr Leben gewinnen, Gleichstand teilt den Bonus.
{
  const s = make(2); clear(s);
  put(s, "p0", 1, 1); put(s, "p1", 5, 7);
  advanceMatch(s, BA.shrinkAfter - 50);
  assert.equal(s.game.shrunk, 0);
  advanceMatch(s, BA.shrinkAfter + 50);
  assert.equal(cell(s, 1, 1), "3"); assert.equal(s.game.bombers.p0.lives, 1, "Von der Wand erwischt");
  assert.equal(s.game.points.p1, 0);
  assert.deepEqual(spiral()[0], [1, 1]);
  const t = make(3); clear(t);
  put(t, "p0", 5, 7); put(t, "p1", 5, 9); put(t, "p2", 3, 7);
  t.game.bombers.p2.lives = 1;
  advanceMatch(t, BA.roundMax);
  assert.equal(t.game.phase, "pause");
  assert.deepEqual(t.game.history[0].winners.sort(), ["p0", "p1"]);
  assert.equal(t.game.points.p0, BA.roundWin / 2);
}

// Zwei Durchgänge, Gesamtgleichstand → Sudden Death; Aufgeben.
{
  const s = make(2); clear(s);
  s.game.points = { p0: 5, p1: 2 };
  s.game.round = BA.rounds; put(s, "p0", 5, 7); put(s, "p1", 5, 9);
  s.game.bombers.p1.alive = false;
  step(s, 50); step(s, BA.pause + 50);
  assert.equal(s.done, true, "Eindeutiger Sieger: kein Sudden Death");
  assert.equal(matchStandings(s)[0].id, "p0");
  const tie = make(2, 9); clear(tie);
  tie.game.points = { p0: 3, p1: 0 }; tie.game.round = BA.rounds;
  tie.game.bombers.p0.alive = false;
  step(tie, 50);
  assert.equal(tie.game.points.p1, 3);
  step(tie, BA.pause + 50);
  assert.equal(tie.game.sudden, true, "Gleichstand: Sudden Death");
  assert.ok(Object.values(tie.game.bombers).every(b => b.lives === 1));
  tie.game.bombers.p0.alive = false; step(tie, 50);
  assert.equal(tie.game.suddenWinner, "p1");
  step(tie, BA.pause + 50);
  assert.equal(tie.done, true);
  assert.deepEqual(matchStandings(tie).map(r => [r.id, r.place]), [["p1", 1], ["p0", 2]]);
  const quit = make(3); removeMatchPlayer(quit, "p2");
  assert.equal(quit.game.bombers.p2.alive, false);
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart und Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 70 + count, 0, "free-minigame", { miniId: "bombs" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 5000 && g.phase !== "finished"; i++) { now += 50; if (i === 250) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 41); for (let t = 50, n = 0; !s.done && t < 200000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.points, b.game.points); assert.equal(a.time, b.time);
}
console.log("Bomb Arena erfolgreich: Arena, Rasterbewegung, Blockaden, Bomben, Kreuzflammen, Kisten, Kettenreaktion, Einfachschaden, sicherer Respawn, K.o.-Punkte, Power-ups, Kick, Schrumpfen, Zeitablauf, geteilter Bonus, Sudden Death, Aufgeben, Bots und Determinismus.");
