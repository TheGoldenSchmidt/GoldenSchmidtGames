import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, removeMatchPlayer, setMatchControl } from "../shared/matches/framework";
import type { Fighter, RingGame } from "../shared/matches/ringCore";
import { SUMO, sumoRules } from "../shared/matches/sumoSmash";
import { BUMPER, ITEMS } from "../shared/matches/bumperMayhem";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type RS = MatchState<RingGame>;
const make = (id: "sumo" | "bumpercars", count: number) => createMatch(id, Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), 1) as RS;
const seqs = new Map<string, number>();
function send(s: RS, id: string, values: Partial<MatchInput>) {
  const p = s.players.find(q => q.id === id)!, k = `${s.id}${s.seed}${id}${s.players.length}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ca: p.usedA, cb: p.usedB, cn: p.usedN, ...values }, n, s.time);
}
const act = (s: RS, id: string, values: Partial<MatchInput> = {}) => send(s, id, { ...values, ca: s.players.find(p => p.id === id)!.usedA + 1 });
const put = (s: RS, id: string, x: number, y: number, heading = 0): Fighter => Object.assign(s.game.fighters[id], { x, y, vx: 0, vy: 0, heading, out: false, alive: true, shieldUntil: 0 });
const step = (s: RS, ms: number) => advanceMatch(s, s.time + ms);

for (const id of ["sumo", "bumpercars"] as const) {
  // Startplätze: gleich weit von der Mitte, alle verschieden, 3 Leben.
  for (const count of [2, 4, 6]) {
    const s = make(id, count), f = Object.values(s.game.fighters);
    const radii = f.map(x => Math.hypot(x.x, x.y));
    assert.ok(radii.every(r => Math.abs(r - radii[0]) < 1e-9)); assert.ok(f.every(x => x.lives === 3));
    assert.equal(new Set(f.map(x => `${x.x.toFixed(3)},${x.y.toFixed(3)}`)).size, count);
  }
  // Ring-Out mit Gutschrift, Respawn mit Schutz, Gutschrift verfällt nach 3 s.
  {
    const s = make(id, 3);
    put(s, "p2", -3, -3);
    const v = put(s, "p0", s.game.radius - .1, 0); v.vx = 6; v.lastHitBy = "p1"; v.lastHitAt = s.time;
    step(s, 100);
    assert.equal(v.out, true); assert.equal(v.lives, 2); assert.equal(s.game.fighters.p1.ringOuts, 1);
    const p2 = s.game.fighters.p2, fresh = make(id, 3);
    void fresh;
    {
      // Both games with three: the others keep playing; only the fallen one returns, on a free spot with protection.
      send(s, "p2", { x: 1 }); step(s, 600);
      assert.ok(Math.hypot(p2.x + 3, p2.y + 3) > .5, "Die anderen spielen weiter"); assert.equal(s.game.resetAt, undefined);
      step(s, 1400);
      assert.equal(v.out, false); assert.ok(v.shieldUntil > s.time && Math.hypot(v.x, v.y) < s.game.radius - 1, "Respawn mit Schutz innen");
      assert.ok(!s.events.some(e => e.kind === "reset"), "Kein Neustart für alle");
      // One on one: everyone back on the start places (Bumper Mayhem's turning posts may nudge a car right after the restart).
      const d = make(id, 2), fall = put(d, "p0", d.game.radius - .1, 0); fall.vx = 6; put(d, "p1", -1, 0);
      step(d, 100); assert.ok(d.game.resetAt !== undefined, "Zu zweit: Neustart");
      step(d, 2100); const start = make(id, 2);
      for (const pid of ["p0", "p1"]) assert.ok(Math.hypot(d.game.fighters[pid].x - start.game.fighters[pid].x, d.game.fighters[pid].y - start.game.fighters[pid].y) < (id === "bumpercars" ? .4 : 1e-6), `${pid} im Duell auf dem Startplatz`);
    }
    const late = put(s, "p0", s.game.radius - .1, 0); late.vx = 6; late.lastHitBy = "p1"; late.lastHitAt = s.time - 3100;
    step(s, 100);
    assert.equal(s.game.fighters.p1.ringOuts, 1, "Alte Berührung zählt nicht");
    assert.equal(matchStandings(s).find(r => r.id === "p1")!.score, 2, "+2 Punkte je Ring-Out");
  }
  // Gleichzeitige Ring-Outs, Ausscheiden bei 0 Leben, letzter Überlebender gewinnt.
  {
    const s = make(id, 3);
    for (const [pid, x] of [["p0", 1], ["p1", -1]] as const) { const f = put(s, pid, x * (s.game.radius - .1), 0); f.vx = x * 6; f.lives = 1; }
    put(s, "p2", 0, 0);
    step(s, 100);
    assert.equal(s.game.fighters.p0.alive || s.game.fighters.p1.alive, false);
    assert.equal(s.game.fighters.p0.outAt, s.game.fighters.p1.outAt);
    assert.equal(s.done, true); assert.equal(s.game.winner, "p2");
    assert.deepEqual(matchStandings(s).map(r => r.place), [1, 2, 2], "Gleichzeitig ausgeschieden: gleicher Rang");
  }
  // Schrumpfen, 75-Sekunden-Entscheid (Leben, dann Ring-Outs), Sudden Death.
  {
    const s = make(id, 3), start = s.game.radius;
    const hold = () => { for (const [i, f] of Object.values(s.game.fighters).entries()) Object.assign(f, { x: (i - 1) * 1.3, y: 0, vx: 0, vy: 0 }); };
    for (let t = 0; t < 40000; t += 1000) { hold(); step(s, 1000); }
    assert.equal(s.game.radius, start, "Vor Sekunde 40 kein Schrumpfen");
    for (let t = s.time; t < 74000; t += 1000) { hold(); step(s, 1000); }
    assert.ok(s.game.radius < start);
    Object.assign(s.game.fighters.p0, { lives: 3, ringOuts: 1 }); Object.assign(s.game.fighters.p1, { lives: 3, ringOuts: 1 }); Object.assign(s.game.fighters.p2, { lives: 1, ringOuts: 4 });
    hold(); advanceMatch(s, 75000);
    assert.deepEqual(s.game.sudden?.ids, ["p0", "p1"], "Gleich viele Leben und Ring-Outs: Sudden Death");
    assert.equal(s.game.fighters.p2.alive, false);
    const loser = put(s, "p1", s.game.radius - .1, 0); loser.vx = 5;
    step(s, 100);
    assert.equal(s.done, true); assert.equal(s.game.winner, "p0");
    const clear = make(id, 2);
    Object.assign(clear.game.fighters.p0, { lives: 2, ringOuts: 3 }); Object.assign(clear.game.fighters.p1, { lives: 2, ringOuts: 1 });
    for (let t = 0; t < 75000; t += 1000) { for (const f of Object.values(clear.game.fighters)) Object.assign(f, { vx: 0, vy: 0, x: f.id === "p0" ? -1 : 1, y: 0 }); step(clear, 1000); }
    assert.equal(clear.game.winner, "p0", "Gleiche Leben: mehr Ring-Outs gewinnt"); assert.equal(clear.game.sudden, undefined);
  }
  // Aufgeben.
  { const s = make(id, 3); removeMatchPlayer(s, "p1"); assert.equal(s.game.fighters.p1.alive, false); }
}

// Sumo: Stoß nach vorn, Rückstoß beim Gegner, Abklingzeit 2,5 s, Schutz nach Respawn.
{
  const s = make("sumo", 2);
  put(s, "p0", -1.2, 0, 0); put(s, "p1", 0, 0);
  act(s, "p0", { x: 1 }); step(s, 150);
  const victim = s.game.fighters.p1;
  assert.ok(victim.vx > SUMO.knock * .5, `Rückstoß ${victim.vx}`); assert.equal(victim.lastHitBy, "p0");
  const at = s.game.fighters.p0.actionAt;
  act(s, "p0", { x: 1 }); step(s, 50);
  assert.equal(s.game.fighters.p0.actionAt, at, "Abklingzeit");
  // The victim flew out: the restart from the start places comes first, then the cooldown is over.
  step(s, SUMO.cooldown + 400); act(s, "p0", { x: 1 });
  assert.ok(s.game.fighters.p0.actionAt > at);
  const t = make("sumo", 2);
  put(t, "p0", -1.2, 0, 0); put(t, "p1", 0, 0).shieldUntil = 99999;
  act(t, "p0", { x: 1 }); step(t, 150);
  assert.ok(Math.abs(t.game.fighters.p1.vx) < 1, "Geschützte Figur wird nicht weggestoßen");
}

// Bumper: Turbo erhöht das Tempo, Rammwirkung wächst mit der Geschwindigkeit, Pfosten werfen zurück, Abklingzeit 4 s.
{
  const drive = (turbo: boolean) => {
    const s = make("bumpercars", 2); s.game.obstacles = [];
    put(s, "p0", -4, 0, 0); put(s, "p1", 1, 0, Math.PI);
    for (let i = 0; i < 20 && s.game.fighters.p1.vx >= 0; i++) { if (turbo && i === 0) act(s, "p0", { x: 1 }); else send(s, "p0", { x: 1 }); step(s, 50); }
    return { s, top: Math.hypot(s.game.fighters.p0.vx, s.game.fighters.p0.vy), hit: s.game.fighters.p1.vx };
  };
  const normal = drive(false), boosted = drive(true);
  assert.ok(boosted.hit > normal.hit + .5, `Turbo rammt stärker (${boosted.hit} > ${normal.hit})`);
  assert.equal(boosted.s.game.fighters.p1.lastHitBy, "p0");
  const s = make("bumpercars", 2);
  put(s, "p0", -4.5, 0, 0); put(s, "p1", -3, -3);
  for (let i = 0; i < 30; i++) { send(s, "p0", { x: 1 }); step(s, 50); }
  assert.equal(s.game.fighters.p0.out, false);
  assert.ok(Math.hypot(s.game.fighters.p0.vx, s.game.fighters.p0.vy) <= BUMPER.maxSpeed + 1e-9, "Höchstgeschwindigkeit");
  const at = s.game.fighters.p0.actionAt;
  act(s, "p0", { x: 1 }); const first = s.game.fighters.p0.actionAt;
  step(s, 1000); act(s, "p0", { x: 1 });
  assert.ok(first > at && s.game.fighters.p0.actionAt === first, "Turbo-Abklingzeit");
  const post = make("bumpercars", 2), o = post.game.obstacles[0];
  put(post, "p1", -4, 3); const car = put(post, "p0", o.x - 1, o.y); car.vx = 4;
  step(post, 300);
  assert.ok(car.vx < 0, "Bewegliches Hindernis wirft zurück");
}

// Wurfweite: ein Treffer muss weit tragen, auch wenn das Opfer dagegenhält (Spielgefühl).
{
  const throwFrom = (id: "sumo" | "bumpercars", victimStick: Partial<MatchInput>, victimHeading: number) => {
    const s = make(id, 2); s.game.obstacles = []; s.game.radius = 99;
    put(s, "p0", id === "sumo" ? -1.2 : -4, 0, 0); put(s, "p1", 0, 0, victimHeading);
    let far = 0;
    for (let i = 0; i < 60; i++) {
      if (i === 0) act(s, "p0", { x: 1 }); else send(s, "p0", { x: far > .3 ? -1 : 1 });
      send(s, "p1", victimStick); step(s, 50); far = Math.max(far, s.game.fighters.p1.x);
    }
    return far;
  };
  const sumo = throwFrom("sumo", { x: -1 }, Math.PI);
  assert.ok(sumo > 4.5, `Sumo-Stoß wirft trotz Gegenhalten weit (${sumo.toFixed(2)})`);
  const side = throwFrom("bumpercars", {}, Math.PI / 2);
  assert.ok(side > 5, `Seitlicher Rammstoß schleudert weit (${side.toFixed(2)})`);
  const s = make("sumo", 2); put(s, "p0", -1.2, 0, 0); put(s, "p1", 0, 0);
  act(s, "p0", { x: 1 }); step(s, 100);
  assert.ok(s.game.fighters.p1.stunUntil > s.time, "Getroffene sind kurz ohne Kontrolle");
}

// Bumper Mayhem: Item-Kisten erscheinen, werden durch Hindurchfahren eingesammelt und wirken.
{
  const s = make("bumpercars", 3); s.game.obstacles = [];
  for (const [pid, x] of [["p0", 0], ["p1", 3], ["p2", -3]] as const) put(s, pid, x, 0);
  step(s, ITEMS.first + 50);
  assert.equal(s.game.items?.length, 1, "Erste Kiste erscheint");
  const item = s.game.items![0];
  assert.ok(Math.hypot(item.x, item.y) <= s.game.radius * ITEMS.spread + 1e-9, "Kiste innen");
  // Riesenauto: größer, rammt härter, wird kaum weggestoßen und gerät nicht ins Schleudern.
  s.game.items = [{ id: 90, kind: "mega", x: 0, y: 0 }]; put(s, "p0", 0, 0); step(s, 50);
  const mega = s.game.fighters.p0;
  assert.ok((mega.bigUntil ?? 0) > s.time && s.game.items.length === 0 && s.events.some(e => e.kind === "mega"));
  const hit = put(s, "p1", 1.4, 0, Math.PI); hit.vx = -5; put(s, "p0", 0, 0).bigUntil = s.time + 5000;
  step(s, 50);
  assert.ok(s.game.fighters.p0.stunUntil <= s.time, "Riesenauto schleudert nicht");
  // Schockwelle: Autos in der Nähe fliegen weg, Gutschrift für den Sammler.
  const w = make("bumpercars", 3); w.game.obstacles = []; w.game.nextItem = Infinity;
  put(w, "p0", 0, 0); put(w, "p1", 1.6, 0); put(w, "p2", -4, 0);
  w.game.items = [{ id: 91, kind: "wave", x: 0, y: 0 }]; step(w, 50);
  assert.ok(w.game.fighters.p1.vx > 3 && w.game.fighters.p1.lastHitBy === "p0", "Nachbar weggestoßen");
  assert.ok(Math.abs(w.game.fighters.p2.vx) < 1, "Außer Reichweite unberührt");
  // Ölfleck: erst nach kurzer Zeit scharf, eigene Spur harmlos, Fremde schleudern mit Gutschrift.
  const o = make("bumpercars", 2); o.game.obstacles = []; o.game.nextItem = Infinity;
  put(o, "p0", 0, 0); put(o, "p1", 3, 3);
  o.game.items = [{ id: 92, kind: "oil", x: 0, y: 0 }]; step(o, 50);
  assert.equal(o.game.slicks?.length, 1);
  step(o, ITEMS.oilArm + 50);
  assert.ok(o.game.fighters.p0.stunUntil <= o.time, "Eigener Fleck ist harmlos");
  put(o, "p0", 3, -3); put(o, "p1", 0, 0); step(o, 50);
  assert.ok(o.game.fighters.p1.stunUntil > o.time && o.game.fighters.p1.lastHitBy === "p0", "Fremde rutschen aus");
  step(o, ITEMS.oilMs);
  assert.equal(o.game.slicks?.length, 0, "Ölfleck trocknet");
  // Sudden Death räumt Kisten und Öl ab.
  const sd = make("bumpercars", 2); sd.game.items = [{ id: 93, kind: "oil", x: 5, y: 5 }];
  for (const f of Object.values(sd.game.fighters)) f.lives = 1;
  step(sd, 75000 + 100);
  assert.ok(sd.game.sudden === undefined || (sd.game.items?.length ?? 0) === 0);
}

// Komplette Partien mit Bots über die Party (2, 4, 6), Neustart, Determinismus.
for (const id of ["sumo", "bumpercars"] as const) {
  for (const count of [2, 4, 6]) {
    const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
    let g = createPartyGame(players, undefined, true, 90 + count, 0, "free-minigame", { miniId: id });
    const driver = new PartyBotDriver(); let now = 0;
    for (let i = 0; i < 3000 && g.phase !== "finished"; i++) { now += 50; if (i === 300) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
    assert.equal(g.phase, "finished", `${id} mit ${count} Bots`);
    assert.ok(partyMiniResults(g).every(r => r.participated));
  }
  const play = () => { const s = make(id, 4); for (let t = 50, n = 0; !s.done && t < 120000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(), b = play();
  assert.deepEqual(a.game.fighters, b.game.fighters); assert.equal(a.time, b.time);
}
// Head-on clash of two dashes: the list order never decides.
{
  const fighter = (id: string, x: number, vx: number) => ({ id, x, y: 0, vx, vy: 0, lives: 3, alive: true, out: false, respawnAt: 0, shieldUntil: 0, actionAt: 0, actionUntil: 10000, lastHitAt: -9999, ringOuts: 0, stunUntil: 0 } as Fighter);
  const clash = (va: number, vb: number, swap: boolean) => {
    const a = fighter("a", -.45, va), b = fighter("b", .45, -vb);
    return { victim: (swap ? sumoRules.collide(b, a, 100) : sumoRules.collide(a, b, 100))?.id, a, b };
  };
  for (const swap of [false, true]) {
    const even = clash(SUMO.dash, SUMO.dash, swap);
    assert.equal(even.victim, undefined, "Gleich schnelle Stöße: niemand gewinnt");
    assert.ok(even.a.vx < 0 && even.b.vx > 0, "Beide prallen zurück");
    assert.equal(clash(SUMO.dash, SUMO.dash * .7, swap).victim, "b", "Der schnellere Stoß gewinnt");
    assert.equal(clash(SUMO.dash * .7, SUMO.dash, swap).victim, "a");
  }
}
console.log("Sumo Smash und Bumper Mayhem erfolgreich: Startplätze, Ring-Out mit Gutschrift und Verfall, Respawnschutz, gleichzeitige Ring-Outs, letzter Überlebender, Schrumpfen, 75-s-Entscheid, Sudden Death, Stoß mit Rückstoß, Abklingzeiten, Turbo-Rammwirkung, Wurfweite, Hindernisse, Aufgeben, Bots und Determinismus.");
