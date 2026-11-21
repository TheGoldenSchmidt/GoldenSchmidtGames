import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { NP, type Ball, type PongGame } from "../shared/matches/neonPong";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";
import { miniPool } from "../shared/minigameCatalog";

type PS = MatchState<PongGame>;
const make = (count: number, seed = 3) => createMatch("pong", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as PS;
const seqs = new Map<string, number>();
function steer(s: PS, id: string, x: number) {
  const k = `${s.seed}:${id}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, x }, n, s.time);
}
const ball = (values: Partial<Ball>): Ball => ({ id: 99, x: 0, y: 0, vx: 0, vy: 0, speed: 8, lastTeam: -1, curve: 0, extra: false, ...values });
/** Keeps all paddles alive at their spot and advances. */
function run(s: PS, ms: number, xs: Record<string, number> = {}) {
  const end = s.time + ms;
  while (s.time < end && !s.done) { for (const p of s.players) steer(s, p.id, xs[p.id] ?? 0); advanceMatch(s, s.time + 50); }
}

// Spielerzahl und Teams: nur 1v1 oder 2v2; im Pool nur bei 2 oder 4 Spielern.
assert.throws(() => make(3), /2 oder 4/);
assert.deepEqual(make(2).players.map(p => p.team), [0, 1]);
assert.deepEqual(make(4).players.map(p => p.team), [0, 1, 0, 1]);
for (const n of [3, 5, 6]) assert.ok(!miniPool(n, true).includes("pong"));
for (const n of [2, 4]) assert.ok(miniPool(n, false).includes("pong"));

// Schläger: absolute Fingerposition, für Team oben gespiegelt, Geschwindigkeitsgrenze, überlappende 2v2-Bereiche.
{
  const s = make(2);
  s.game.serveAt = Infinity;
  run(s, 1000, { p0: -1, p1: -1 });
  const [bottom, top] = s.game.paddles;
  assert.ok(Math.abs(bottom.x - bottom.min) < 1e-9, "Unten: Finger links = Welt links");
  assert.ok(Math.abs(top.x - top.max) < 1e-9, "Oben: Finger links = aus eigener Sicht links");
  const before = bottom.x;
  steer(s, "p0", 1); advanceMatch(s, s.time + 50);
  assert.ok(Math.abs(bottom.x - before - NP.paddleSpeed * .05) < 1e-9, "Höchstgeschwindigkeit");
  const duo = make(4), [a, , c] = duo.game.paddles;
  assert.ok(a.max > c.min, "Bereiche überlappen in der Mitte");
  assert.equal(a.max, NP.duoOverlap);
}

// Abprallwinkel nach Trefferpunkt, Beschleunigung bis zum Maximum, Wände, kein Durchtunneln.
{
  const s = make(2);
  s.game.serveAt = Infinity; s.game.nextPower = Infinity;
  const paddle = s.game.paddles[0];
  s.game.balls = [ball({ x: paddle.x, y: 5, vy: 8 })];
  run(s, 400, { p0: 0 });
  assert.equal(s.game.balls.length, 1);
  assert.ok(s.game.balls[0].vy < 0 && Math.abs(s.game.balls[0].vx) < 1e-6, "Mitte: gerade zurück");
  assert.equal(s.game.balls[0].speed, 8 + NP.speedUp);
  s.game.balls = [ball({ x: paddle.x + 1.0, y: 5, vy: 8 })];
  run(s, 400, { p0: 0 });
  const angle = Math.atan2(s.game.balls[0].vx, -s.game.balls[0].vy);
  assert.ok(angle > .8 && angle <= NP.maxAngle + 1e-9, `Rand: steiler Winkel ${angle}`);
  s.game.balls = [ball({ x: paddle.x, y: 2, vy: 30, speed: NP.maxSpeed })];
  run(s, 400, { p0: 0 });
  assert.ok(s.game.balls.length === 1 && s.game.balls[0].vy < 0, "Höchsttempo prallt ab");
  assert.equal(s.game.balls[0].speed, NP.maxSpeed, "Nicht schneller als das Maximum");
  s.game.balls = [ball({ x: 4.0, y: 0, vx: 6, vy: .5, speed: 6 })];
  advanceMatch(s, s.time + 150);
  assert.ok(s.game.balls[0].vx < 0 && Math.abs(s.game.balls[0].x) <= NP.halfW, "Wandabpraller");
}

// Schräge Bälle: Trefferfläche wie der gezeichnete Ball, späte Rettung innerhalb der Laufzeit, Kurven nie flach.
{
  const s = make(2);
  s.game.serveAt = Infinity; s.game.nextPower = Infinity;
  const paddle = s.game.paddles[0], half = NP.paddleSolo / 2;
  // Gezeichneter Ball berührt die Schlägerkante: zählt als Treffer.
  s.game.balls = [ball({ x: paddle.x + half + NP.ball * 1.15, y: 5, vy: 8 })];
  run(s, 400, { p0: 0 });
  assert.ok(s.game.balls.length === 1 && s.game.balls[0].vy < 0, "Kantentreffer");
  // Steiler Ball knapp neben dem Schläger: Der Finger war fast dort, seine Eingabe kommt eine halbe Laufzeit zu spät – der Ball wird noch gerettet.
  const angle = NP.maxAngle, speed = 12, steep = () => ball({ x: -.5, y: 4.5, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, speed });
  const lateTry = (start: number) => {
    const m = make(2, 5); m.game.serveAt = Infinity; m.game.nextPower = Infinity;
    const range = m.game.paddles[0].max - m.game.paddles[0].min;
    run(m, 200, { p0: start / range * 2 }); m.game.balls = [steep()];
    let crossed = false;
    while (m.time < 3000 && m.game.balls.length && !crossed && m.game.score[1] === 0) { run(m, 50, { p0: start / range * 2 }); crossed = !!m.game.balls[0]?.late || m.game.balls[0]?.y > 6.8; }
    const passed = m.game.balls[0] && structuredClone(m.game.balls[0]);
    // Now the finger arrives at the crossing point.
    run(m, 100, { p0: 3.17 / range * 2 });
    return { m, passed };
  };
  const near = lateTry(1.5);
  assert.ok(near.passed?.late && near.passed.late.ids.includes("p0"), "Ball verpasst den Schläger knapp");
  assert.deepEqual(near.m.game.score, [0, 0], "Späte Rettung");
  assert.ok(near.m.game.balls[0].vy < 0 && near.m.game.balls[0].lastTeam === 0);
  // Weit daneben: auch ein schneller Finger rettet nachträglich nichts mehr.
  const far = lateTry(0);
  assert.equal(far.passed?.late, undefined, "Weit daneben: kein spätes Fenster");
  run(far.m, 600, { p0: 3.17 / (far.m.game.paddles[0].max - far.m.game.paddles[0].min) * 2 });
  assert.deepEqual(far.m.game.score, [0, 1], "Weit daneben ist ein Tor");
  // Ohne Bewegung oder nach Ablauf des Fensters zählt das Tor.
  const miss = make(2, 5);
  miss.game.serveAt = Infinity; miss.game.nextPower = Infinity;
  miss.game.balls = [ball({ x: -.5, y: 4.5, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed, speed })];
  run(miss, 900, { p0: 0 });
  assert.deepEqual(miss.game.score, [0, 1], "Kein Treffer ohne Schläger");
  const curve = make(2, 6);
  curve.game.serveAt = Infinity; curve.game.nextPower = Infinity;
  curve.game.balls = [ball({ x: 0, y: 0, vx: 1, vy: -8, curve: 40, lastTeam: 0 })];
  advanceMatch(curve, curve.time + 300);
  const b = curve.game.balls[0];
  assert.ok(Math.abs(Math.atan2(Math.abs(b.vx), Math.abs(b.vy))) <= NP.maxFlight + 1e-6, "Kurvenball bleibt steil genug");
}

// Tore, Aufschlag zum Team mit Gegentor, Mehrball zählt jeden Ball, Aufschlag erst nach allen Bällen.
{
  const s = make(2);
  s.game.serveAt = Infinity; s.game.nextPower = Infinity;
  s.game.balls = [ball({ id: 1, x: 4, y: 6, vy: 12, speed: 12 }), ball({ id: 2, x: -4, y: 7.5, vy: 12, speed: 12, extra: true })];
  run(s, 100, { p0: 0 });
  assert.deepEqual(s.game.score, [0, 1]);
  assert.equal(s.game.balls.length, 1, "Ein Ball noch im Spiel");
  assert.equal(s.game.serveAt, Infinity, "Kein Aufschlag während Mehrball");
  run(s, 400, { p0: 0 });
  assert.deepEqual(s.game.score, [0, 2]);
  assert.equal(s.game.serveTo, 0);
  const serveAt = s.game.serveAt;
  run(s, NP.serveDelay + 100, { p0: 0 });
  assert.ok(s.game.balls.length === 1 && s.game.balls[0].vy > 0 && s.time >= serveAt, "Aufschlag Richtung Gegentor-Team");
}

// Power-ups: Ballkontakt aktiviert, höchstens ein Effekt pro Team, Dauer und Wirkung.
{
  const s = make(2);
  s.game.serveAt = Infinity; s.game.nextPower = Infinity;
  s.game.power = { kind: "wide", x: 0, y: 0 };
  s.game.balls = [ball({ x: 0, y: 1, vy: -8, lastTeam: 0 })];
  advanceMatch(s, s.time + 200);
  assert.equal(s.game.effects[0]?.kind, "wide");
  s.game.power = { kind: "multi", x: 0, y: -2 };
  s.game.balls = [ball({ x: 0, y: -1, vy: -8, lastTeam: 0 })];
  advanceMatch(s, s.time + 200);
  assert.ok(s.game.power, "Zweiter Effekt desselben Teams wird nicht ausgelöst");
  advanceMatch(s, s.time + NP.wideMs);
  assert.equal(s.game.effects[0], undefined, "Breiter Schläger endet nach 5 s");
  s.game.power = { kind: "multi", x: 0, y: 0 };
  s.game.balls = [ball({ x: 0, y: .5, vy: -8, lastTeam: 1 })];
  advanceMatch(s, s.time + 100);
  assert.equal(s.game.balls.length, 3, "Drei Bälle");
  assert.equal(s.game.effects[1]?.kind, "multi");
  const slow = make(2, 8);
  slow.game.serveAt = Infinity; slow.game.nextPower = Infinity;
  slow.game.effects[0] = { kind: "slow", until: Infinity };
  slow.game.balls = [ball({ id: 1, x: -2, y: 0, vy: 8 }), ball({ id: 2, x: 2, y: 0, vy: -8 })];
  advanceMatch(slow, slow.time + 100);
  assert.ok(Math.abs(slow.game.balls[0].y - 8 * .1 * NP.slowFactor) < 1e-6 && Math.abs(slow.game.balls[1].y + .8) < 1e-6, "Zeitlupe nur Richtung sammelndes Team");
  const curve = make(2, 9);
  curve.game.serveAt = Infinity; curve.game.nextPower = Infinity;
  curve.game.effects[0] = { kind: "curve", until: Infinity };
  curve.game.balls = [ball({ x: curve.game.paddles[0].x + .5, y: 6, vy: 8 })];
  run(curve, 300, { p0: 0 });
  assert.ok(curve.game.balls[0].curve !== 0, "Kurvenball nach Treffer");
}

// Siegbedingungen: 7 Tore, Zeitablauf mit Vorsprung, Golden Goal, Gleichstand am Ende, Aufgeben.
{
  const s = make(2);
  s.game.score = [6, 3]; s.game.serveAt = Infinity; s.game.nextPower = Infinity;
  s.game.balls = [ball({ x: 0, y: -7.9, vy: -12, speed: 12, lastTeam: 0 })];
  advanceMatch(s, s.time + 100);
  assert.equal(s.done, true); assert.equal(s.game.winner, 0);
  assert.deepEqual(matchStandings(s).map(r => [r.id, r.place, r.score]), [["p0", 1, 7], ["p1", 2, 3]]);
  const timed = make(4);
  timed.game.score = [3, 2]; timed.game.serveAt = Infinity; timed.game.nextPower = Infinity;
  advanceMatch(timed, NP.regular);
  assert.equal(timed.done, true);
  assert.deepEqual(matchStandings(timed).map(r => r.place), [1, 1, 3, 3], "Team teilt die Platzierung");
  const golden = make(2);
  golden.game.score = [4, 4]; golden.game.serveAt = Infinity; golden.game.nextPower = Infinity;
  advanceMatch(golden, NP.regular);
  assert.equal(golden.done, false); assert.equal(golden.game.golden, true);
  golden.game.balls = [ball({ x: 0, y: 7.9, vy: 12, speed: 12 })];
  advanceMatch(golden, golden.time + 100);
  assert.equal(golden.done, true); assert.equal(golden.game.winner, 1);
  const tie = make(2);
  tie.game.score = [2, 2]; tie.game.serveAt = Infinity; tie.game.nextPower = Infinity;
  advanceMatch(tie, 999999);
  assert.equal(tie.done, true);
  assert.deepEqual(matchStandings(tie).map(r => r.place), [1, 1], "Ohne Golden Goal geteilter Sieg");
  const quit = make(4);
  removeMatchPlayer(quit, "p0");
  assert.equal(quit.done, false, "Mitspieler verteidigt allein weiter");
  removeMatchPlayer(quit, "p2");
  assert.equal(quit.done, true); assert.equal(quit.game.winner, 1);
}

// Komplette Partien mit Bots über die Party: 1v1 und 2v2, Neustart mitten im Spiel, Determinismus.
for (const count of [2, 4]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 40 + count, 0, "free-minigame", { miniId: "pong" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) {
    now += 50; if (i === 700) g = JSON.parse(JSON.stringify(g));
    g = tickParty(driver.step(g, now), now);
  }
  assert.equal(g.phase, "finished", `${count} Bots`);
  const results = partyMiniResults(g);
  assert.ok(results.every(r => r.participated));
  assert.deepEqual(g.winners, results.filter(r => r.place === 1).map(r => r.player.id));
}
{
  const play = () => { const s = make(4, 21); for (let t = 50, n = 0; !s.done && t < 130000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.score, b.game.score); assert.equal(a.time, b.time);
}
console.log("Neon Pong erfolgreich: 1v1/2v2 und Pool, gespiegelte Schläger, Tempo, Abprallwinkel, Beschleunigung, Wände, Tore, Mehrball, Power-ups, ein Effekt pro Team, 7 Tore, Zeitablauf, Golden Goal, Gleichstand, Aufgeben, Bots und Determinismus.");
