import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import { ANCHORS, castHook, HW, PLATFORMS, ZONES, type Bot, type HookGame } from "../shared/matches/hookWars";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type HS = MatchState<HookGame>;
const make = (count = 2, seed = 4) => createMatch("hooks", Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as HS;
const seqs = new WeakMap<HS, Map<string, number>>();
function send(s: HS, id: string, values: Partial<MatchInput>) {
  const own = seqs.get(s) ?? new Map<string, number>(); seqs.set(s, own);
  const p = s.players.find(q => q.id === id)!, n = (own.get(id) ?? 0) + 1; own.set(id, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
/** Fires the hook towards a world point (screen y is inverted) and keeps holding it. */
const hookAt = (s: HS, id: string, x: number, y: number) => {
  const b = s.game.bots[id], dx = x - b.x, dy = -(y - b.y), n = Math.hypot(dx, dy) || 1;
  send(s, id, { ax: dx / n, ay: dy / n, hb: true, cb: s.players.find(p => p.id === id)!.usedB + 1 });
};
const put = (s: HS, id: string, x: number, y: number, extra: Partial<Bot> = {}) => Object.assign(s.game.bots[id], { x, y, vx: 0, vy: 0, out: false, hook: undefined, grounded: false, ...extra });
const step = (s: HS, ms: number) => advanceMatch(s, s.time + ms);
/** Fixture: no core spawns unless a test wants them. */
const quiet = (s: HS) => { s.game.nextCore = Infinity; s.game.cores = []; };

// Faire Anordnung: Zonen und Anker spiegelbildlich, jede Zone auf einer Plattform.
for (let i = 0; i < ZONES.length; i += 2) { const [ax, ay] = ZONES[i], [bx, by] = ZONES[i + 1]; assert.ok(Math.abs(ax + bx - 20) < 1e-9 && ay === by); }
assert.ok(ZONES.every(([x, y]) => PLATFORMS.some(p => p.y === y && x - HW.zoneW / 2 >= p.x0 && x + HW.zoneW / 2 <= p.x1)));
for (const [x, y] of ANCHORS) assert.ok(ANCHORS.some(([u, v]) => Math.abs(u + x - 20) < 1e-9 && v === y), "Anker gespiegelt");

// Haken: nächster Anker auf dem Strahl, Reichweite, Gegner vor dem Anker.
{
  const s = make(); quiet(s);
  const b = put(s, "p0", 10, 9.4), other = put(s, "p1", 3, 1.9);
  assert.equal(castHook(s.game, b, 0, 1).hit?.index, ANCHORS.findIndex(([x, y]) => x === 10 && y === 13.3));
  assert.equal(castHook(s.game, b, 1, 0).hit, undefined, "Kein Anker in Reichweite");
  put(s, "p1", 10, 11.5);
  assert.equal(castHook(s.game, b, 0, 1).hit?.id, "p1", "Gegner liegt näher als der Anker");
  void other;
}

// Seil: Länge wird gehalten und eingezogen, Schwung bleibt, Loslassen löst.
{
  const s = make(); quiet(s);
  put(s, "p0", 7, 9.5); put(s, "p1", 18, 1.9);
  hookAt(s, "p0", 10, 13.3);
  const bot = s.game.bots.p0;
  assert.ok(bot.hook, "Am Anker eingehakt");
  const start = bot.hook!.length;
  for (let i = 0; i < 6; i++) { send(s, "p0", { hb: true }); step(s, 50); }
  const [ax, ay] = ANCHORS[bot.hook!.index];
  assert.ok(bot.hook!.length < start, "Wird herangezogen");
  assert.ok(Math.hypot(bot.x - ax, bot.y - ay) <= bot.hook!.length + 1e-6, "Seillänge eingehalten");
  assert.ok(Math.abs(bot.vx) > .5, "Schwingt");
  send(s, "p0", { hb: false }); step(s, 50);
  assert.equal(bot.hook, undefined, "Loslassen löst das Seil");
  assert.ok(Math.abs(bot.vx) > .3, "Schwung bleibt nach dem Lösen");
}

// Plattformen von oben begehbar, von unten durchspringbar; Sprung per Stick nach oben.
{
  const s = make(); quiet(s);
  put(s, "p0", 3, 3); put(s, "p1", 18, 1.9);
  step(s, 400);
  assert.ok(s.game.bots.p0.grounded && Math.abs(s.game.bots.p0.y - (1.5 + HW.radius)) < 1e-9, "Landung auf der Plattform");
  send(s, "p0", { y: -1 }); step(s, 50);
  assert.ok(s.game.bots.p0.vy > 0 || s.game.bots.p0.y > 1.5 + HW.radius, "Sprung");
  put(s, "p0", 3, 5.2, { vy: 7 }); step(s, 200);
  assert.ok(s.game.bots.p0.y > 6, "Von unten durch die Plattform");
}

// Kerne: höchstens einer, nur in der eigenen Zone abgeben, Absturz verliert den Kern.
{
  const s = make(); quiet(s);
  put(s, "p0", 10, 9.4); put(s, "p1", 18, 1.9);
  s.game.cores = [{ id: 1, x: 10, y: 9.6, vy: 0 }, { id: 2, x: 10.2, y: 9.6, vy: 0 }];
  step(s, 50);
  assert.equal(s.game.bots.p0.core, true); assert.equal(s.game.cores.length, 1, "Nur ein Kern gleichzeitig");
  const [ox, oy] = ZONES[1];
  put(s, "p0", ox, oy + HW.radius, { core: true, grounded: true }); step(s, 50);
  assert.equal(s.game.bots.p0.delivered, 0, "Fremde Zone zählt nicht");
  const [zx, zy] = ZONES[0];
  put(s, "p0", zx, zy + HW.radius, { core: true, grounded: true }); step(s, 50);
  assert.equal(s.game.bots.p0.delivered, 1); assert.equal(s.game.bots.p0.core, false);
  put(s, "p0", 7, -1.5, { core: true }); step(s, 400);
  assert.equal(s.game.bots.p0.out, true); assert.equal(s.game.bots.p0.core, false, "Absturz kostet den Kern");
  step(s, HW.respawnMs);
  assert.equal(s.game.bots.p0.out, false);
  assert.ok(Math.abs(s.game.bots.p0.x - zx) < 2, "Neustart neben der eigenen Zone");
}

// Gegner treffen: heranziehen, Kern fällt, 4 s Abklingzeit nur nach Treffern.
{
  const s = make(); quiet(s);
  put(s, "p0", 2, 6 + HW.radius, { grounded: true }); put(s, "p1", 5, 6 + HW.radius, { core: true, grounded: true });
  hookAt(s, "p0", 5, 6 + HW.radius);
  assert.equal(s.game.bots.p1.core, false); assert.equal(s.game.cores.length, 1, "Kern fällt heraus");
  assert.ok(s.game.bots.p1.vx < -5, "Zum Werfer gezogen");
  const until = s.game.bots.p0.nextYank;
  assert.equal(until, s.time + HW.hitCooldown);
  step(s, 400); put(s, "p1", 5, 6 + HW.radius, { core: true, grounded: true });
  hookAt(s, "p0", 5, 6 + HW.radius);
  assert.equal(s.game.bots.p1.core, true, "Abklingzeit nach einem Treffer");
  const miss = make(); quiet(miss);
  put(miss, "p0", 2, 6 + HW.radius); put(miss, "p1", 18, 1.9);
  hookAt(miss, "p0", 2, 0); // ins Leere
  assert.equal(miss.game.bots.p0.nextYank, 0, "Fehlschuss löst keine 4 s aus");
}

// Kernerscheinen: alle 6 s, höchstens 3 gleichzeitig.
{
  const s = make(); s.game.cores = [];
  for (const b of Object.values(s.game.bots)) b.out = true, b.respawnAt = Infinity;
  advanceMatch(s, 40000);
  assert.equal(s.game.cores.length, HW.maxCores);
}

// Sieg: meiste Kerne nach 90 s; Gleichstand → nächste Abgabe der Gleichauf-Liegenden; Aufgeben.
{
  const s = make(3); quiet(s);
  s.game.bots.p0.delivered = 3; s.game.bots.p1.delivered = 3; s.game.bots.p2.delivered = 1;
  for (const b of Object.values(s.game.bots)) b.out = true, b.respawnAt = Infinity;
  advanceMatch(s, HW.regular);
  assert.deepEqual(s.game.overtime, ["p0", "p1"]);
  const [zx, zy] = ZONES[2];
  put(s, "p2", zx, zy + HW.radius, { core: true, grounded: true }); step(s, 50);
  assert.equal(s.done, false, "Abgabe eines Außenseiters entscheidet nicht");
  const [ax, ay] = ZONES[1];
  put(s, "p1", ax, ay + HW.radius, { core: true, grounded: true }); step(s, 50);
  assert.equal(s.done, true); assert.equal(s.game.winner, "p1");
  assert.equal(matchStandings(s)[0].id, "p1");
  const tie = make(2); quiet(tie);
  for (const b of Object.values(tie.game.bots)) b.out = true, b.respawnAt = Infinity;
  advanceMatch(tie, 999999);
  assert.deepEqual(matchStandings(tie).map(r => r.place), [1, 1]);
  const quit = make(3); removeMatchPlayer(quit, "p1"); step(quit, 3000);
  assert.equal(quit.game.bots.p1.out, true);
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 10 + count, 0, "free-minigame", { miniId: "hooks" });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 2600 && g.phase !== "finished"; i++) { now += 50; if (i === 300) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
{
  const play = () => { const s = make(4, 81); for (let t = 50, n = 0; !s.done && t < 125000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.bots, b.game.bots); assert.equal(a.time, b.time);
}
console.log("Hook Wars erfolgreich: faire Spiegelung, Hakenstrahl, Seil mit Einziehen und Schwung, Lösen, Plattformen, Sprung, Kerntragen, eigene Zone, Absturz und Respawn, Gegnertreffer mit Kernverlust und 4-s-Abklingzeit, Kernerscheinen, 90-s-Entscheid, Verlängerung, Aufgeben, Bots und Determinismus.");
