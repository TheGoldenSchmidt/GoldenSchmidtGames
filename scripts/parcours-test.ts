import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl, type MatchId } from "../shared/matches/framework";
import { PC, type ParcoursGame, type Racer } from "../shared/matches/parcours";
import { course, COURSE_IDS, gooAt, sweeperAngle, type CourseId } from "../shared/matches/parcoursCourses";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type PS = MatchState<ParcoursGame>;
const make = (id: CourseId, count = 2, seed = 4) => createMatch(id as MatchId, Array.from({ length: count }, (_, i) => ({ id: `p${i}`, style: i })), seed) as PS;
const seqs = new Map<string, number>();
/** Sends held input plus optional taps (a = jump, b = dive). */
function send(s: PS, id: string, values: Partial<MatchInput> = {}, tap?: "a" | "b") {
  const p = s.players.find(q => q.id === id)!, k = `${s.id}${s.seed}${id}`, n = (seqs.get(k) ?? 0) + 1; seqs.set(k, n);
  setMatchControl(s, id, { ...NEUTRAL_MATCH_INPUT, ...values, ca: p.usedA + (tap === "a" ? 1 : 0), cb: p.usedB + (tap === "b" ? 1 : 0), cn: p.usedN }, n, s.time);
}
const run = (s: PS, ms: number, each?: () => void) => { const end = s.time + ms; while (s.time < end && !s.done) { each?.(); advanceMatch(s, s.time + 50); } };
const put = (r: Racer, x: number, y: number, z: number, extra: Partial<Racer> = {}) => Object.assign(r, { x, y, z, vx: 0, vy: 0, vz: 0, pose: "run", grounded: true, ground: -1, respawnAt: 0, hang: undefined, ...extra });
/** Fixture: keep the second racer out of the way. */
const park = (s: PS, id = "p1") => put(s.game.racers[id], 4.4, 0, 2);
const forward = { y: -1 };

// Start: alle nebeneinander am ersten Kontrollpunkt, auf dem Boden, Geheimnisse nicht in der Sicht.
for (const id of COURSE_IDS) {
  const s = make(id, 6), c = course(id), racers = Object.values(s.game.racers);
  assert.equal(new Set(racers.map(r => r.x.toFixed(2))).size, 6, `${id}: verschiedene Startplätze`);
  run(s, 300);
  assert.ok(racers.every(r => r.grounded && Math.abs(r.y - c.checkpoints[0].y) < .05), `${id}: alle stehen`);
  const view = publicMatch(s, "p0").game as ParcoursGame;
  assert.equal(view.secretDoors, undefined); assert.equal(view.secretTiles, undefined);
  assert.ok(s.game.secretDoors !== undefined && s.game.secretTiles !== undefined, "Autorität kennt die Geheimnisse");
}

// Laufen: Stick nach vorn läuft mit voller Geschwindigkeit, ohne Eingabe bleibt man stehen; Springen ≈ 1,5 m.
{
  // Free stretch before the first door row of Türenlotto.
  const s = make("tuerenlotto"); park(s);
  const r = s.game.racers.p0; put(r, 0, 0, -1.5);
  run(s, 1000, () => send(s, "p0", forward));
  assert.ok(r.z > -1.5 + PC.run * .8, `Läuft vorwärts (${r.z})`); assert.ok(Math.abs(r.face) < .01);
  const z = r.z; run(s, 600, () => send(s, "p0"));
  assert.ok(r.z - z < 1, "Bremst ohne Eingabe");
  send(s, "p0", {}, "a"); let top = 0; run(s, 900, () => { top = Math.max(top, r.y); send(s, "p0"); });
  assert.ok(top > 1.3 && top < 1.7, `Sprunghöhe ${top}`); assert.ok(r.grounded, "Wieder gelandet");
}

// Graben (Türenlotto): ohne Sprung hinein und zurück zum Kontrollpunkt, mit Sprung darüber.
{
  const s = make("tuerenlotto"); park(s); const r = s.game.racers.p0, c = course("tuerenlotto");
  put(r, 0, 0, 26, { checkpoint: 2 });
  run(s, 1500, () => send(s, "p0", forward));
  assert.ok(r.respawnAt > 0 || r.falls > 0, "In den Graben gefallen");
  run(s, PC.respawnMs + 200, () => send(s, "p0"));
  assert.ok(Math.abs(r.z - c.checkpoints[2].z) < .5 && r.respawnAt === 0, `Zurück am Kontrollpunkt (${r.z})`);
  put(r, 0, 0, 26.2, { checkpoint: 2 }); r.falls = 0;
  run(s, 1500, () => send(s, "p0", forward, r.z > 26.9 && r.grounded ? "a" : undefined));
  assert.equal(r.falls, 0, "Über den Graben gesprungen"); assert.ok(r.z > 29.5);
}

// Hechten: weiter Satz nach vorn, danach kurz am Boden; nur einmal pro Sprung.
{
  const s = make("tuerenlotto"); park(s); const r = s.game.racers.p0;
  put(r, 0, 0, -1.5); run(s, 100, () => send(s, "p0"));
  send(s, "p0", {}, "b"); run(s, 50);
  assert.equal(r.pose, "dive"); assert.ok(r.vz > PC.dive * .9);
  run(s, 700, () => send(s, "p0"));
  assert.equal(r.pose, "prone", "Nach dem Hechten kurz liegen"); assert.ok(r.z > 1, `Weite ${r.z + 1.5}`);
  run(s, PC.proneMs + 100, () => send(s, "p0"));
  assert.equal(r.pose, "run", "Wieder auf den Beinen");
  // Sprung und Hechten in der Luft verlängern; ein zweites Hechten in derselben Luftphase geht nicht.
  put(r, 0, 0, -1.5); send(s, "p0", forward, "a"); run(s, 200); send(s, "p0", forward, "b"); run(s, 100);
  assert.equal(r.pose, "dive"); const vz = r.vz; send(s, "p0", forward, "b"); run(s, 50);
  assert.ok(r.vz <= vz + 1e-9, "Nur einmal hechten pro Luftphase");
}

// Drehbalken: niedrige umhauen, Sprung darüber; hohe umhauen, Ducken darunter.
{
  const c = course("kreiselkurs"), low = c.sweepers[0], high = c.sweepers[1];
  const at = (s: PS, sw: typeof low, ahead = 0) => { const a = sweeperAngle(sw, s.time + 50 + ahead); return { x: sw.x + Math.cos(a) * 2.5, z: sw.z + Math.sin(a) * 2.5 }; };
  const s = make("kreiselkurs"); park(s); const r = s.game.racers.p0;
  let p = at(s, low); put(r, p.x, 0, p.z); run(s, 50, () => send(s, "p0"));
  assert.equal(r.pose, "stun", "Niedriger Balken haut um"); assert.ok(Math.hypot(r.vx, r.vz) > PC.knock * .8);
  const t = make("kreiselkurs"); park(t); const q = t.game.racers.p0;
  p = at(t, low, 250); put(q, p.x, .9, p.z, { grounded: false, pose: "air", vy: 2 }); run(t, 50, () => send(t, "p0"));
  assert.notEqual(q.pose, "stun", "Über den niedrigen Balken gesprungen");
  const u = make("kreiselkurs"); park(u); const d = u.game.racers.p0;
  p = at(u, high); put(d, p.x, 0, p.z); run(u, 50, () => send(u, "p0"));
  assert.equal(d.pose, "stun", "Hoher Balken trifft Stehende");
  const v = make("kreiselkurs"); park(v); const e = v.game.racers.p0;
  p = at(v, high, 100); put(e, p.x, 0, p.z); send(v, "p0", { hb: true }); run(v, 50, () => send(v, "p0", { hb: true }));
  assert.ok(e.duck && e.pose !== "stun", "Geduckt unter dem hohen Balken durch");
}

// Festhalten: an zu hoher Kante hängen und hochziehen; ohne Festhalten kommt man nicht hoch.
{
  const s = make("wippenwerk"); park(s); const r = s.game.racers.p0, c = course("wippenwerk"), wall = c.boxes.find(b => b.look === "ledge")!;
  put(r, 0, 0, wall.z0 - .8);
  run(s, 1500, () => send(s, "p0", forward, r.grounded ? "a" : undefined));
  assert.ok(r.z < wall.z0 && r.y < 1, "Zu hoch zum Springen");
  put(r, 0, 0, wall.z0 - .8); send(s, "p0", { ...forward, ha: true }, "a");
  run(s, 800, () => send(s, "p0", { ha: true }));
  assert.equal(r.pose, "hang", "Hängt an der Kante");
  run(s, 200, () => send(s, "p0", { ...forward, ha: true }));
  assert.ok(r.grounded && Math.abs(r.y - wall.y1) < .01 && r.z > wall.z0, "Hochgezogen");
  // Loslassen lässt fallen.
  put(r, 0, 0, wall.z0 - .8); send(s, "p0", { ha: true }, "a"); run(s, 800, () => send(s, "p0", { ha: true }));
  assert.equal(r.pose, "hang"); run(s, 300, () => send(s, "p0"));
  assert.notEqual(r.pose, "hang", "Loslassen = fallen");
}

// Andere festhalten: bremst die gehaltene Person, nur von vorn, höchstens 2 s.
{
  const s = make("tuerenlotto"); const a = s.game.racers.p0, b = s.game.racers.p1;
  put(a, 0, 0, -1.5); put(b, 0, 0, -.7);
  run(s, 100, () => { send(s, "p0", { ha: true }); send(s, "p1"); });
  assert.equal(a.grab, "p1", "Festgehalten");
  run(s, 800, () => { send(s, "p0", { ha: true }); send(s, "p1", forward); });
  assert.ok(b.vz < PC.run * PC.grabSlow * 1.05, `Gebremst (${b.vz})`);
  run(s, PC.grabMs, () => { send(s, "p0", { ha: true }); send(s, "p1", forward); });
  assert.equal(a.grab, undefined, "Nach höchstens 2 s losgelassen");
}

// Türen: echte brechen beim Anlaufen auf (öffentlich), Scheintüren bleiben massiv; je Reihe mindestens eine echte.
{
  const s = make("tuerenlotto"); park(s); const r = s.game.racers.p0, c = course("tuerenlotto"), row = c.doorRows[0];
  for (const dr of c.doorRows) assert.equal(dr.doors.filter(d => s.game.secretDoors![d] === "1").length, dr.real);
  const real = row.doors.find(d => s.game.secretDoors![d] === "1")!, fake = row.doors.find(d => s.game.secretDoors![d] === "0")!;
  const xOf = (d: number) => -4 + 2 * row.doors.indexOf(d);
  put(r, xOf(fake), 0, row.z - 1.5); run(s, 1200, () => send(s, "p0", forward));
  assert.ok(r.z < row.z && s.game.doors[fake] === "0", "Scheintür hält");
  put(r, xOf(real), 0, row.z - 1.5); run(s, 1200, () => send(s, "p0", forward));
  assert.equal(s.game.doors[real], "1"); assert.ok(r.z > row.z + .4, "Durch die echte Tür");
  assert.equal((publicMatch(s, "p1").game as ParcoursGame).doors[real], "1", "Offene Tür sehen alle");
}

// Geisterpfad: tragende Platte wird sichtbar, falsche gibt nach und bleibt als falsch markiert.
{
  const s = make("geisterpfad"); park(s); const r = s.game.racers.p0, c = course("geisterpfad"), row = c.tileRows[0];
  const good = row.tiles.find(i => s.game.secretTiles![i] === "1")!, bad = row.tiles.find(i => s.game.secretTiles![i] === "0")!;
  const xOf = (i: number) => -3.6 + 1.8 * row.tiles.indexOf(i);
  put(r, xOf(good), .05, row.z + .9, { grounded: false, pose: "air" }); run(s, 200, () => send(s, "p0"));
  assert.equal(s.game.tiles[good], "1"); assert.ok(r.grounded, "Tragende Platte trägt");
  put(r, xOf(bad), .05, row.z + .9, { grounded: false, pose: "air" }); run(s, 300, () => send(s, "p0"));
  assert.equal(s.game.tiles[bad], "2", "Falsche Platte gibt nach"); assert.ok(r.y < -.5);
  assert.equal((publicMatch(s, "p1").game as ParcoursGame).tiles[bad], "2");
}

// Wippen neigen sich zur belasteten Seite und lassen einen rutschen; Förderband schiebt zurück.
{
  const s = make("wippenwerk"); park(s); const r = s.game.racers.p0, saw = course("wippenwerk").boxes.find(b => b.seesaw === 0)!;
  put(r, 2, 0, (saw.z0 + saw.z1) / 2); run(s, 1500, () => send(s, "p0"));
  assert.ok(s.game.tilt[0] > .2, `Wippe neigt sich (${s.game.tilt[0]})`);
  assert.ok(r.x > 2.1 || r.respawnAt > 0 || r.falls > 0, "Rutscht zur tiefen Seite");
  const b = make("glibberflut"); park(b); const q = b.game.racers.p0, belt = course("glibberflut").boxes.find(x => x.belt)!;
  put(q, 0, belt.y1, (belt.z0 + belt.z1) / 2); const z = q.z; run(b, 500, () => send(b, "p0"));
  assert.ok(q.z < z - 1.2, `Band schiebt zurück (${z - q.z})`);
}

// Glibber: wer darunter gerät, scheidet aus; steigt mit der Zeit.
{
  const s = make("glibberflut"), c = course("glibberflut");
  assert.ok(gooAt(c, 60000) > gooAt(c, 10000));
  put(s.game.racers.p1, 0, 0, 2); s.time = 30000; run(s, 100);
  assert.equal(s.game.racers.p1.pose, "out", "Vom Glibber erwischt");
  assert.equal(matchStandings(s).at(-1)!.id, "p1");
}

// Ziel: Reihenfolge zählt, 20 s Zielschluss nach der ersten Ankunft; Aufgeben.
{
  const s = make("kreiselkurs", 3), c = course("kreiselkurs");
  put(s.game.racers.p1, 0, c.finishY, c.finishZ - .3); put(s.game.racers.p0, 1, c.finishY, c.finishZ - .6); put(s.game.racers.p2, 0, 0, 3);
  run(s, 500, () => { send(s, "p0", forward); send(s, "p1", forward); send(s, "p2"); });
  assert.deepEqual(s.game.order, ["p1", "p0"]);
  const table = matchStandings(s);
  assert.deepEqual(table.map(r => r.id), ["p1", "p0", "p2"]); assert.deepEqual(table.map(r => r.place), [1, 2, 3]);
  run(s, PC.finishGrace + 200, () => send(s, "p2"));
  assert.equal(s.done, true, "Zielschluss");
  const quit = make("kreiselkurs", 3); removeMatchPlayer(quit, "p1");
  assert.equal(quit.game.racers.p1.pose, "out");
}

// Komplette Partien mit Bots über die Party (2, 4, 6 je Lauf), JSON-Neustart, Determinismus.
for (const id of COURSE_IDS) for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 90 + count, 0, "free-minigame", { miniId: id });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) { now += 50; if (i === 120) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${id}: ${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
for (const id of COURSE_IDS) {
  const play = (restart: boolean) => { let s = make(id, 4, 61); for (let t = 50, n = 0; !s.done && t < 130000; t += 50) { if (restart && t === 3000) s = JSON.parse(JSON.stringify(s)); for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(false), b = play(true);
  assert.deepEqual(a.game.order, b.game.order, `${id}: deterministisch auch nach Neustart`); assert.equal(a.time, b.time);
}
console.log("Hindernis-Parcours erfolgreich: Start und Geheimnisse, Laufen, Sprunghöhe, Graben und Kontrollpunkt, Hechten, Drehbalken (Springen und Ducken), Festhalten an Kanten und an anderen, Türen, Geisterplatten, Wippen, Förderband, Glibber, Zielreihenfolge und Zielschluss, Aufgeben, Bots in allen fünf Läufen, JSON-Neustart und Determinismus.");
