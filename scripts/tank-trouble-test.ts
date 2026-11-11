import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { TT, wallRects, type Bullet, type TankGame } from "../shared/matches/tankTrouble";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type TS = MatchState<TankGame>;
const make = (count: number, seed = 5) => createMatch("tanks", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as TS;
/** Fixture: only the outer border, no maze inside. */
function open(s: TS) {
  s.game.h = Array.from({ length: (TT.rows + 1) * TT.cols }, (_, i) => Math.floor(i / TT.cols) % TT.rows === 0 ? "1" : "0").join("");
  s.game.v = Array.from({ length: TT.rows * (TT.cols + 1) }, (_, i) => i % (TT.cols + 1) % TT.cols === 0 ? "1" : "0").join("");
  s.game.nextPower = Infinity;
  for (const t of Object.values(s.game.tanks)) t.shieldUntil = 0;
}
const seqs = new Map<string, number>();
function send(s: TS, id: string, values: Partial<MatchInput>) {
  const p = s.players.find(q => q.id === id)!, k = `${s.seed}${id}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
const shoot = (s: TS, id: string, angle: number) => send(s, id, { ax: Math.cos(angle), ay: Math.sin(angle), ca: s.players.find(p => p.id === id)!.usedA + 1 });
const put = (s: TS, id: string, x: number, y: number) => Object.assign(s.game.tanks[id], { x, y, alive: true, hp: TT.hp, shieldUntil: 0 });
const step = (s: TS, ms: number) => advanceMatch(s, s.time + ms);

// Labyrinth: geschlossener Rand, alle Zellen erreichbar, zerstörbare Mauern vorhanden, gleicher Startwert → gleiches Labyrinth.
for (let seed = 1; seed < 40; seed++) {
  const s = make(2, seed), g = s.game;
  assert.equal(make(2, seed).game.h, g.h);
  for (let c = 0; c < TT.cols; c++) assert.ok(g.h[c] === "1" && g.h[c + TT.rows * TT.cols] === "1");
  for (let r = 0; r < TT.rows; r++) assert.ok(g.v[r * (TT.cols + 1)] === "1" && g.v[TT.cols + r * (TT.cols + 1)] === "1");
  const seen = new Set([0]), queue = [0];
  while (queue.length) {
    const k = queue.shift()!, c = k % TT.cols, r = Math.floor(k / TT.cols);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr, n = nc + nr * TT.cols;
      if (nc < 0 || nr < 0 || nc >= TT.cols || nr >= TT.rows || seen.has(n)) continue;
      const edge = dc ? g.v[Math.max(c, nc) + r * (TT.cols + 1)] : g.h[c + Math.max(r, nr) * TT.cols];
      if (edge === "0") { seen.add(n); queue.push(n); }
    }
  }
  assert.equal(seen.size, TT.cols * TT.rows, "Alle Zellen ohne Zerstörung erreichbar");
  assert.ok(/[2]/.test(g.h + g.v), "Zerstörbare Mauern vorhanden");
}

// Bewegung und Mauern: Panzer bleiben im Feld und durchdringen keine Wand.
{
  const s = make(2); open(s);
  put(s, "p0", 1, 1);
  for (let i = 0; i < 40; i++) { send(s, "p0", { x: -1, y: -1 }); step(s, 50); }
  const t = s.game.tanks.p0;
  assert.ok(t.x >= TT.tank + TT.wall - 1e-6 && t.y >= TT.tank + TT.wall - 1e-6, `Wand hält (${t.x}, ${t.y})`);
  const maze = make(2, 7);
  for (let i = 0; i < 80; i++) { send(maze, "p0", { x: 1, y: .2 }); step(maze, 50); }
  const tank = maze.game.tanks.p0;
  assert.ok(!wallRects(maze.game).some(w => tank.x > w.x0 && tank.x < w.x1 && tank.y > w.y0 && tank.y < w.y1), "Mittelpunkt nie in einer Mauer");
}

// Schießen: Abklingzeit, höchstens zwei Kugeln, zwei Abpraller, dann weg.
{
  const s = make(2); open(s);
  put(s, "p0", 5.6, 8.8); put(s, "p1", 1, 16);
  shoot(s, "p0", 0); shoot(s, "p0", 0);
  assert.equal(s.game.bullets.length, 1, "Abklingzeit");
  step(s, TT.cooldown); shoot(s, "p0", Math.PI);
  step(s, TT.cooldown); shoot(s, "p0", -Math.PI / 2);
  assert.equal(s.game.bullets.length, 2, "Höchstens zwei gleichzeitig");
  // Waagrechter Schuss: Wand rechts, Wand links (2 Abpraller), dritte Wand → weg.
  const t = make(2, 8); open(t);
  put(t, "p0", 5.6, 3); put(t, "p1", 1, 16);
  shoot(t, "p0", 0);
  put(t, "p0", 5.6, 10); // aus der Flugbahn, sonst trifft der Rückpraller den Schützen
  const bullet = t.game.bullets[0];
  let bounces = 0;
  for (let i = 0; i < 120 && t.game.bullets.includes(bullet); i++) { step(t, 50); bounces = Math.max(bounces, bullet.bounces); }
  assert.equal(t.game.bullets.includes(bullet), false); assert.equal(bounces, TT.bounces + 1);
}

// Zerstörbare Mauer: zwei Treffer öffnen sie, die Kugeln werden dabei verbraucht.
{
  const s = make(2); open(s);
  const index = 3 + 5 * (TT.cols + 1); // senkrechte Mauer x = 3 Zellen, Zeile 5
  s.game.v = s.game.v.slice(0, index) + "2" + s.game.v.slice(index + 1);
  put(s, "p0", 3 * TT.cell - 1.2, 5.5 * TT.cell); put(s, "p1", 10, 16);
  shoot(s, "p0", 0); step(s, 600);
  assert.equal(s.game.v[index], "3"); assert.equal(s.game.bullets.length, 0);
  step(s, TT.cooldown); shoot(s, "p0", 0); step(s, 600);
  assert.equal(s.game.v[index], "0", "Neuer Schussweg");
}

// Schaden, Abschuss, Eigentreffer, Respawn mit Schutz, gleichzeitige Treffer.
{
  const s = make(2); open(s);
  put(s, "p0", 2, 8); put(s, "p1", 6, 8);
  for (let i = 0; i < 3; i++) { shoot(s, "p0", 0); step(s, TT.cooldown + 300); }
  assert.equal(s.game.tanks.p1.alive, false); assert.equal(s.game.kills.p0, 1); assert.equal(s.game.deaths.p1, 1);
  step(s, TT.respawn);
  const back = s.game.tanks.p1;
  assert.ok(back.alive && back.hp === TT.hp && back.shieldUntil > s.time, "Respawn mit Schutz");
  shoot(s, "p0", Math.atan2(back.y - s.game.tanks.p0.y, back.x - s.game.tanks.p0.x)); step(s, 400);
  assert.equal(s.game.tanks.p1.hp, TT.hp, "Schutz wehrt Treffer ab");
  const self = make(2, 11); open(self);
  put(self, "p0", 5.6, .9); put(self, "p1", 1, 16);
  self.game.tanks.p0.hp = 1;
  shoot(self, "p0", -Math.PI / 2); step(self, 600);
  assert.equal(self.game.tanks.p0.alive, false); assert.equal(self.game.kills.p0, 0, "Eigentreffer ohne Abschusspunkt"); assert.equal(self.game.deaths.p0, 1);
  const both = make(2, 12); open(both);
  put(both, "p0", 2, 8); put(both, "p1", 4, 8);
  both.game.tanks.p0.hp = 1; both.game.tanks.p1.hp = 1;
  const mk = (owner: string, x: number, vx: number): Bullet => ({ id: 100 + x, owner, x, y: 8, vx, vy: 0, bounces: 0, born: -1000, extra: false });
  both.game.bullets = [mk("p0", 3.4, TT.bulletSpeed), mk("p1", 2.6, -TT.bulletSpeed)];
  step(both, 50);
  assert.equal(both.game.tanks.p0.alive || both.game.tanks.p1.alive, false, "Gleichzeitige Treffer zählen beide");
  assert.deepEqual([both.game.kills.p0, both.game.kills.p1], [1, 1]);
}

// Power-ups: Schnellschuss, Dreifachschuss, Schild.
{
  const s = make(2); open(s);
  put(s, "p0", 3, 3); put(s, "p1", 9, 16);
  s.game.tanks.p0.power = { kind: "rapid", until: 99999 };
  for (let i = 0; i < 5; i++) { shoot(s, "p0", Math.PI / 2); step(s, 200); }
  assert.equal(s.game.bullets.filter(b => b.owner === "p0").length, TT.rapidBullets);
  const t = make(2, 2); open(t);
  put(t, "p0", 5.6, 3); put(t, "p1", 9, 16);
  t.game.tanks.p0.power = { kind: "triple", until: 99999 };
  shoot(t, "p0", Math.PI / 2);
  assert.equal(t.game.bullets.length, 3);
  const u = make(2, 3); open(u);
  put(u, "p0", 2, 8); put(u, "p1", 5, 8);
  u.game.tanks.p1.power = { kind: "shield", until: 99999 };
  shoot(u, "p0", 0); step(u, 600);
  assert.equal(u.game.tanks.p1.hp, TT.hp);
  u.game.powers = [{ id: 1, kind: "rapid", x: 2.5, y: 8 }];
  step(u, 50);
  assert.equal(u.game.tanks.p0.power?.kind, "rapid", "Aufsammeln durch Überfahren");
}

// Sieg: 7 Abschüsse, Zeitablauf, weniger Tode, Stechen, geteilter Platz, Aufgeben.
{
  const s = make(3); open(s);
  s.game.kills.p0 = 6; put(s, "p0", 2, 8); put(s, "p1", 4, 8); s.game.tanks.p1.hp = 1;
  shoot(s, "p0", 0); step(s, 400);
  assert.equal(s.done, true); assert.equal(s.game.winner, "p0");
  const timed = make(3); open(timed);
  Object.assign(timed.game.kills, { p0: 3, p1: 3, p2: 1 }); Object.assign(timed.game.deaths, { p0: 2, p1: 1, p2: 4 });
  advanceMatch(timed, TT.regular);
  assert.equal(timed.game.winner, "p1", "Gleich viele Abschüsse: weniger Tode");
  const over = make(3); open(over);
  Object.assign(over.game.kills, { p0: 3, p1: 3, p2: 1 });
  advanceMatch(over, TT.regular);
  assert.deepEqual(over.game.overtime, ["p0", "p1"]); assert.equal(over.done, false);
  put(over, "p2", 2, 8); put(over, "p0", 4, 8); over.game.tanks.p0.hp = 1;
  shoot(over, "p2", 0); advanceMatch(over, over.time + 400);
  assert.equal(over.done, false, "Abschuss eines Außenseiters entscheidet nicht");
  put(over, "p1", 2, 12); put(over, "p2", 4, 12); over.game.tanks.p2.hp = 1;
  shoot(over, "p1", 0); advanceMatch(over, over.time + 400);
  assert.equal(over.game.winner, "p1"); assert.equal(matchStandings(over)[0].id, "p1");
  const tie = make(2); open(tie);
  advanceMatch(tie, 999999);
  assert.deepEqual(matchStandings(tie).map(r => r.place), [1, 1]);
  const quit = make(3); removeMatchPlayer(quit, "p1");
  assert.equal(quit.game.tanks.p1.alive, false); advanceMatch(quit, 5000); assert.equal(quit.game.tanks.p1.alive, false, "Kein Respawn nach Aufgeben");
}

// Komplette Partien mit Bots über die Party: 2, 4, 6 Spieler, Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 60 + count, 0, "free-minigame", { miniId: "tanks" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 3000 && g.phase !== "finished"; i++) { now += 50; if (i === 200) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 31); for (let t = 50, n = 0; !s.done && t < 130000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.kills, b.game.kills); assert.equal(a.time, b.time);
}
console.log("Tank Trouble erfolgreich: Labyrinth, Mauerkollision, Abklingzeit, 2 Kugeln, 2 Abpraller, zerstörbare Mauern, Schaden, Eigentreffer, Respawnschutz, gleichzeitige Treffer, Power-ups, 7 Abschüsse, Zeitablauf, Stechen, Aufgeben, Bots und Determinismus.");
