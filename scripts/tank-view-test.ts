import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, MATCH_MODULES, publicMatch, setMatchControl } from "../shared/matches/framework";
import { TT, type TankGame } from "../shared/matches/tankTrouble";
import { canSee, sightPolygon, TV } from "../shared/matches/tankView";
import { wallRects } from "../shared/matches/tankTrouble";
import type { MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type TS = MatchState<TankGame>;
const make = (count: number, seed = 5) => createMatch("tankview", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as TS;
/** Fixture: only the outer border, no maze inside. */
function open(s: TS) {
  s.game.h = Array.from({ length: (TT.rows + 1) * TT.cols }, (_, i) => Math.floor(i / TT.cols) % TT.rows === 0 ? "1" : "0").join("");
  s.game.v = Array.from({ length: TT.rows * (TT.cols + 1) }, (_, i) => i % (TT.cols + 1) % TT.cols === 0 ? "1" : "0").join("");
  s.game.nextPower = Infinity;
}
/** Fixture: one vertical wall of the given kind between column 1 and 2 in row 2. */
function wall(s: TS, kind: "1" | "2" | "3") { const i = 2 + 2 * (TT.cols + 1); s.game.v = s.game.v.slice(0, i) + kind + s.game.v.slice(i + 1); }
const put = (s: TS, id: string, x: number, y: number) => Object.assign(s.game.tanks[id], { x, y, alive: true, hp: TT.hp });
const cell = (c: number) => (c + .5) * TT.cell;

// Gleiche Regeln wie Tank Trouble, eigenes Modul.
{
  const view = MATCH_MODULES.tankview, base = MATCH_MODULES.tanks;
  assert.equal(view.id, "tankview"); assert.equal(view.step, base.step); assert.equal(view.press, base.press); assert.equal(view.standings, base.standings);
  assert.deepEqual(view.meta.players, base.meta.players);
}

// Sichtlinie: freie Sicht zeigt den Gegner, jede Mauerart verdeckt ihn, Reichweite begrenzt.
{
  const s = make(3); open(s);
  put(s, "p0", cell(1), cell(2)); put(s, "p1", cell(3), cell(2)); put(s, "p2", cell(1), cell(2) + TV.sight + .5);
  let v = publicMatch(s, "p0").game as TankGame;
  assert.ok(v.tanks.p0 && v.tanks.p1, "Freie Sicht: Gegner sichtbar");
  assert.equal(v.tanks.p2, undefined, "Außer Reichweite unsichtbar");
  for (const kind of ["1", "2", "3"] as const) {
    open(s); wall(s, kind);
    v = publicMatch(s, "p0").game as TankGame;
    assert.equal(v.tanks.p1, undefined, `Mauer ${kind} verdeckt den Gegner`);
    assert.ok(!canSee(wallRects(s.game), s.game.tanks.p0, s.game.tanks.p1));
  }
  // Die Gegenseite sieht ebenfalls nichts; die Regeln selbst kennen alle Panzer.
  assert.equal((publicMatch(s, "p1").game as TankGame).tanks.p0, undefined);
  assert.ok(s.game.tanks.p1, "Autorität behält alle Panzer");
  // Kugeln: eigene immer, fremde nur in Sicht.
  s.game.bullets = [
    { id: 1, owner: "p0", x: cell(3), y: cell(2), vx: 0, vy: 0, bounces: 0, born: s.time, extra: false },
    { id: 2, owner: "p1", x: cell(3), y: cell(2), vx: 0, vy: 0, bounces: 0, born: s.time, extra: false },
    { id: 3, owner: "p1", x: cell(1), y: cell(3), vx: 0, vy: 0, bounces: 0, born: s.time, extra: false }
  ];
  v = publicMatch(s, "p0").game as TankGame;
  assert.deepEqual(v.bullets.map(b => b.id), [1, 3], "Eigene Kugel immer, fremde nur bei freier Sicht");
  // Wracks verraten keinen Standort.
  open(s); wall(s, "1"); s.game.tanks.p1.alive = false;
  assert.equal((publicMatch(s, "p0").game as TankGame).tanks.p1, undefined);
  // Zuschauer sehen alles.
  assert.ok((publicMatch(s, "zuschauer").game as TankGame).tanks.p1);
}

// Sichtbereich: ein Panzer, der halb um die Ecke ragt oder knapp am Rand steht, ist sichtbar; die Leuchtfläche passt dazu.
{
  const s = make(2); open(s); wall(s, "1");
  const w = wallRects(s.game).find(r => r.axis === "v" && r.index === 2 + 2 * (TT.cols + 1))!;
  put(s, "p0", cell(1), cell(2));
  // Sichtgrenze verläuft über die untere Mauerecke; Mitte knapp dahinter, Rand ragt heraus.
  const slope = (w.y1 - cell(2)) / (w.x0 - cell(1)), edgeY = cell(2) + slope * (cell(3) - cell(1));
  put(s, "p1", cell(3), edgeY - TT.tank * .7);
  assert.ok(!canSee(wallRects(s.game), s.game.tanks.p0, s.game.tanks.p1), "Mitte verdeckt");
  assert.ok((publicMatch(s, "p0").game as TankGame).tanks.p1, "Halb sichtbarer Panzer erscheint");
  put(s, "p1", cell(3), edgeY - TT.tank * 2.2);
  assert.equal((publicMatch(s, "p0").game as TankGame).tanks.p1, undefined, "Ganz verdeckter Panzer bleibt unsichtbar");
  open(s); put(s, "p1", cell(1) + TV.sight + TT.tank * .5, cell(2));
  assert.ok((publicMatch(s, "p0").game as TankGame).tanks.p1, "Vorderkante in Reichweite reicht");
  const ring = sightPolygon(wallRects(s.game), cell(1), cell(2));
  assert.equal(ring.length, TV.rays);
  assert.ok(ring.every(d => d > 0 && d <= TV.sight + 1e-9));
  assert.ok(Math.abs(ring[0] - TV.sight) < 1e-9, "Nach rechts frei bis zur Reichweite");
  assert.ok(Math.abs(ring[TV.rays / 2] - (cell(1) - TT.wall)) < 1e-6, "Nach links bis zur Außenmauer");
}

// Bots sehen nur ihre Sicht: ohne Gegner in Sicht fahren sie Streife statt stehen zu bleiben.
{
  const s = make(2); open(s); wall(s, "1");
  put(s, "p0", cell(1), cell(2)); put(s, "p1", cell(3), cell(2));
  const intent = botMatchInput(s, "p0");
  assert.ok(Math.hypot(intent.x, intent.y) > .5, "Streife ohne Sicht");
  assert.equal(intent.ca, s.players[0].usedA, "Kein Schuss ins Blaue");
}

// Komplette Partien mit Bots über die Party: 2, 4, 6 Spieler, Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 70 + count, 0, "free-minigame", { miniId: "tankview" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 3000 && g.phase !== "finished"; i++) { now += 50; if (i === 200) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 33); for (let t = 50, n = 0; !s.done && t < 130000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.kills, b.game.kills); assert.equal(a.time, b.time);
  assert.ok(Object.values(a.game.kills).reduce((x, y) => x + y, 0) > 0, "Bots finden sich und schießen");
}
console.log("Tank Trouble – Turmsicht erfolgreich: gleiche Regeln, Sichtlinie durch alle Mauerarten, Reichweite, Kugel- und Wrackfilter, Zuschauer, Streife der Bots, Partien mit Bots und Determinismus.");
