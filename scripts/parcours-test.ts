import assert from "node:assert/strict";
import { advanceMatch, botMatchInput, createMatch, matchStandings, publicMatch, removeMatchPlayer, setMatchControl, type MatchId } from "../shared/matches/framework";
import { PC, shownRacer, type ParcoursGame, type Racer } from "../shared/matches/parcours";
import { BLINK_WARN, blinkOpen, blinkWarn, course, COURSE_IDS, FINAL_IDS, gooAt, RETIRED_COURSE_IDS, sweeperAngle, windAt, type CourseId } from "../shared/matches/parcoursCourses";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "../shared/matches/types";
import { createPartyGame, partyMiniResults, tickParty } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";

type PS = MatchState<ParcoursGame>;
const ALL = [...COURSE_IDS, ...RETIRED_COURSE_IDS, ...FINAL_IDS];
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
for (const id of ALL) {
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
  put(r, 0, 0, 27.5, { checkpoint: 2 });
  run(s, 1800, () => send(s, "p0", forward));
  assert.ok(r.respawnAt > 0 || r.falls > 0, "In den Graben gefallen");
  run(s, PC.respawnMs + 200, () => send(s, "p0"));
  assert.ok(Math.abs(r.z - c.checkpoints[2].z) < .5 && r.respawnAt === 0, `Zurück am Kontrollpunkt (${r.z})`);
  put(r, 0, 0, 26.2, { checkpoint: 2 }); r.falls = 0;
  run(s, 1500, () => send(s, "p0", forward, r.z > 29.3 && r.grounded ? "a" : undefined));
  assert.equal(r.falls, 0, "Über den Graben gesprungen"); assert.ok(r.z > 32);
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
  const c = course("kreiselkurs"), low = c.sweepers[0], high = c.sweepers.findLast(sw => sw.y0 >= 1)!;
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

// Festhalten: an zu hoher Kante hängen und hochklettern (Festhalten oder Stick zur Wand); sonst kommt man nicht hoch.
{
  const s = make("wippenwerk"); park(s); const r = s.game.racers.p0, c = course("wippenwerk"), wall = c.boxes.find(b => b.look === "ledge")!;
  put(r, 0, 0, wall.z0 - .4);
  run(s, 1500, () => send(s, "p0", {}, r.grounded ? "a" : undefined));
  assert.ok(r.z < wall.z0 && r.y < 1, "Zu hoch zum Springen");
  // Springen und den Stick zur Wand drücken: festhalten, dann klettern (dauert einen Moment, kein Sprung nach oben).
  put(r, 0, 0, wall.z0 - .8); send(s, "p0", forward, "a");
  let hung = false, climbed = false, maxY = 0;
  run(s, 1800, () => { hung ||= r.pose === "hang"; climbed ||= r.pose === "climb"; if (r.pose === "climb") maxY = Math.max(maxY, r.y); send(s, "p0", forward); });
  assert.ok(hung || climbed, "Hält sich an der Kante"); assert.ok(climbed, "Klettert hoch");
  assert.ok(r.grounded && Math.abs(r.y - wall.y1) < .01 && r.z > wall.z0, "Oben angekommen");
  assert.ok(maxY <= wall.y1 + .03, "Kein Hochspringen über die Kante");
  // Mit Festhalten hängen bleiben, mit dem Stick zur Wand hochklettern.
  put(r, 0, 0, wall.z0 - .8); send(s, "p0", { ha: true }, "a");
  run(s, 800, () => send(s, "p0", { ha: true }));
  assert.equal(r.pose, "hang", "Hängt an der Kante");
  run(s, 100, () => send(s, "p0", { ...forward, ha: true }));
  assert.equal(r.pose, "climb", "Klettern beginnt");
  run(s, PC.climbMs + 100, () => send(s, "p0", { ...forward, ha: true }));
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
  const xOf = (d: number) => row.xs[row.doors.indexOf(d)];
  put(r, xOf(fake), 0, row.z - 1.5); run(s, 1200, () => send(s, "p0", forward));
  assert.ok(r.z < row.z && s.game.doors[fake] === "2", "Scheintür hält und ist als massiv markiert");
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

// Klappen und wechselnde Griffe: Warnung vor dem Öffnen, offen trägt nichts, man fällt; am Griff hängend fällt man mit.
{
  const c = course("fallklappen"), trap = c.boxes.find(b => b.blink)!;
  let t = 0; while (!blinkOpen(trap, t)) t += 50;
  assert.ok(blinkWarn(trap, t - BLINK_WARN / 2) > .3 && blinkWarn(trap, t - BLINK_WARN - 100) === 0, "Warnung kurz vor dem Öffnen");
  const s = make("fallklappen"); park(s); const r = s.game.racers.p0;
  s.time = t - 200; put(r, (trap.x0 + trap.x1) / 2, 0, (trap.z0 + trap.z1) / 2); run(s, 150, () => send(s, "p0"));
  assert.ok(r.grounded, "Geschlossene Klappe trägt");
  run(s, 600, () => send(s, "p0"));
  assert.ok(!r.grounded && r.y < -.5, "Offene Klappe: man fällt");
  // Finale-Klappen bleiben die ersten Sekunden zu.
  const f = course("standhaft");
  assert.ok(f.boxes.every(b => !blinkOpen(b, 11000)), "Finale: erst nach 12 s öffnet sich etwas");
}

// Kanten über Sprunghöhe: Springen allein bringt nicht hoch (auch nicht an der Kletterwand), zur Wand drücken schon.
{
  const s = make("kletterwand"); park(s); const r = s.game.racers.p0, hold = course("kletterwand").boxes.find(b => b.look === "hold" && b.y1 < 2)!;
  put(r, (hold.x0 + hold.x1) / 2, 0, hold.z0 - .4);
  run(s, 1500, () => send(s, "p0", {}, r.grounded ? "a" : undefined));
  assert.ok(r.y < 1, `Ohne Festhalten nicht hoch (${r.y})`);
  // A moment in which the hold stays for the whole climb.
  let t = 0; while ([0, 500, 1000, 1500, 2000].some(d => blinkOpen(hold, t + d))) t += 50;
  s.time = t; put(r, (hold.x0 + hold.x1) / 2, 0, hold.z0 - .6); send(s, "p0", forward, "a");
  run(s, 1800, () => send(s, "p0", forward));
  assert.ok(r.grounded && Math.abs(r.y - hold.y1) < .02, `Hochgeklettert (${r.y})`);
}

// Drehbalken sind fest: wer getroffen wird, fliegt vor dem Balken her und nach außen; der Balken fährt nicht durch.
{
  const c = course("standhaft"), bar = c.sweepers[0], s = make("standhaft"); park(s, "p1"); put(s.game.racers.p1, -5, 0, 0);
  const r = s.game.racers.p0; s.time = 4000;
  const a = sweeperAngle(bar, s.time + 50), ux = Math.cos(a), uz = Math.sin(a), side = bar.speed > 0 ? 1 : -1;
  // Just ahead of the bar at 3 m from the axis.
  put(r, bar.x + ux * 3 - uz * .4 * side, 0, bar.z + uz * 3 + ux * .4 * side);
  const from = Math.hypot(r.x - bar.x, r.z - bar.z);
  let minGap = Infinity, hit = false;
  run(s, 900, () => {
    hit ||= r.pose === "stun";
    const b = sweeperAngle(bar, s.time), along = (r.x - bar.x) * Math.cos(b) + (r.z - bar.z) * Math.sin(b);
    if (Math.abs(along) < bar.length && r.y < bar.y1) minGap = Math.min(minGap, Math.hypot(r.x - bar.x - Math.cos(b) * along, r.z - bar.z - Math.sin(b) * along));
    s.players.forEach(p => send(s, p.id));
  });
  assert.ok(hit, "Getroffen"); assert.ok(minGap >= PC.barReach - .05, `Balken fährt nicht durch (${minGap})`);
  assert.ok(Math.hypot(r.x - bar.x, r.z - bar.z) > from + .5 || r.pose === "out", "Nach außen geschleudert");
}

// Schieber schieben: wer vor einem fahrenden Schieber steht, wird weggestoßen.
{
  const c = course("tuerenlotto"), pusher = c.boxes.find(b => b.look === "pusher")!, s = make("tuerenlotto"); park(s);
  const r = s.game.racers.p0;
  // A moment in which the pusher moves fast towards +x, the racer right in front of it.
  let t = 0; while (Math.cos(2 * Math.PI * t / pusher.move!.period + pusher.move!.phase) < .9) t += 50;
  s.time = t; const x1 = pusher.x1 + pusher.move!.amp * Math.sin(2 * Math.PI * (t + 50) / pusher.move!.period + pusher.move!.phase);
  put(r, x1 + .3, 0, (pusher.z0 + pusher.z1) / 2); run(s, 100, () => send(s, "p0"));
  assert.ok(s.events.some(e => e.kind === "shove" && e.ids[0] === "p0"), "Weggeschoben"); assert.ok(r.vx > 2 || r.x > x1 + 1, `Stoß nach außen (${r.vx})`);
}

// Gänge im Türenlotto: je Reihe die geplanten Arten; Falltür lässt fallen, massiver Ausgang wird markiert.
{
  const s = make("tuerenlotto"); park(s); const r = s.game.racers.p0, c = course("tuerenlotto"), sec = s.game;
  for (const row of c.laneRows!) {
    const kind = row.lanes.map(l => sec.secretDoors![l.front] === "0" ? "shut" : sec.secretTiles![l.floor] === "0" ? "trap" : sec.secretDoors![l.exit] === "1" ? "through" : "dead");
    assert.equal(kind.filter(k => k === "through").length, row.through); assert.equal(kind.filter(k => k === "dead").length, row.dead); assert.equal(kind.filter(k => k === "trap").length, row.trap);
  }
  const row = c.laneRows![0], trap = row.lanes.find(l => sec.secretTiles![l.floor] === "0")!, dead = row.lanes.find(l => sec.secretDoors![l.front] === "1" && sec.secretTiles![l.floor] === "1" && sec.secretDoors![l.exit] === "0")!;
  put(r, trap.x, 0, row.z - 1.2); run(s, 1400, () => send(s, "p0", forward));
  assert.equal(sec.tiles[trap.floor], "2", "Falltür gibt nach"); assert.ok(r.falls > 0 || r.respawnAt > 0 || r.y < -1, "Durch die Falltür gefallen");
  assert.ok(s.events.some(e => e.kind === "tile" && e.text === "Falltür!"));
  run(s, PC.respawnMs + 200, () => send(s, "p0"));
  put(r, dead.x, 0, row.z - 1.2); run(s, 2000, () => send(s, "p0", forward));
  assert.equal(sec.doors[dead.front], "1"); assert.equal(sec.doors[dead.exit], "2", "Sackgasse: Ausgang massiv und markiert");
  assert.ok(r.z < row.exitZ && r.z > row.z, "Steht in der Sackgasse");
}

// Wind: treibt seitlich, nur solange er bläst; Gegenwind bremst auf der Rampe.
{
  const c = course("windkanal"), side = c.winds[0];
  let on = 0; while (((on / side.period + side.phase) % 1) >= side.on) on += 50;
  let off = on; while (((off / side.period + side.phase) % 1) < side.on) off += 50;
  assert.ok(windAt(c, 0, 1, 8, on).vx > 2 && windAt(c, 0, 1, 8, off).vx === 0);
  const s = make("windkanal"); park(s); const r = s.game.racers.p0;
  s.time = on; put(r, 0, 0, 8); run(s, 300, () => send(s, "p0"));
  assert.ok(r.x > .5, `Seitenwind treibt (${r.x})`);
}

// Finale: Sturz = raus (kein Kontrollpunkt), wer zuletzt steht, gewinnt; Balken ruhen am Anfang; schwächere Stöße.
{
  const c = course("standhaft");
  assert.equal(sweeperAngle(c.sweepers[0], 0), sweeperAngle(c.sweepers[0], 2900), "Balken ruhen bis 3 s");
  const s = make("standhaft", 3);
  run(s, 200, () => s.players.forEach(p => send(s, p.id)));
  put(s.game.racers.p1, 0, 0, 40, { grounded: false, pose: "air" });
  run(s, 1500, () => s.players.forEach(p => send(s, p.id)));
  assert.equal(s.game.racers.p1.pose, "out", "Sturz im Finale = raus"); assert.equal(s.game.racers.p1.respawnAt, 0);
  assert.equal(s.done, false);
  put(s.game.racers.p2, 0, 0, 40, { grounded: false, pose: "air" });
  run(s, 1500, () => s.players.forEach(p => send(s, p.id)));
  assert.equal(s.done, true, "Eine Person steht noch: Ende");
  const table = matchStandings(s);
  assert.deepEqual(table.map(r => r.id), ["p0", "p2", "p1"], "Später gefallen = besser");
  assert.ok(s.events.some(e => e.kind === "finale" && e.ids[0] === "p0"));
}

// Zuschauen: eigene Figur, solange sie läuft; danach die gewählte oder die führende, die noch läuft.
{
  const s = make("kreiselkurs", 3), g = s.game;
  g.racers.p1.best = 20; g.racers.p2.best = 10;
  assert.equal(shownRacer(g, s.players, "p0").id, "p0");
  g.racers.p0.pose = "done";
  assert.equal(shownRacer(g, s.players, "p0").id, "p1", "Führende Person");
  assert.equal(shownRacer(g, s.players, "p0", 2).id, "p2", "Gewählte Person");
  g.racers.p2.pose = "out";
  assert.equal(shownRacer(g, s.players, "p0", 2).id, "p1", "Ausgeschiedene nicht");
  assert.equal(shownRacer(g, s.players, "zuschauer").id, "p1");
}

// Komplette Partien mit Bots über die Party (2, 4, 6 je Lauf und Finale), JSON-Neustart, Determinismus.
for (const id of ALL) for (const count of [2, 4, 6]) {
  const players = Array.from({ length: count }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, bot: true }));
  let g = createPartyGame(players, undefined, true, 90 + count, 0, "free-minigame", { miniId: id });
  const driver = new PartyBotDriver(); let now = 0;
  for (let i = 0; i < 4000 && g.phase !== "finished"; i++) { now += 50; if (i === 120) g = JSON.parse(JSON.stringify(g)); g = tickParty(driver.step(g, now), now); }
  assert.equal(g.phase, "finished", `${id}: ${count} Bots`);
  assert.ok(partyMiniResults(g).every(r => r.participated));
}
for (const id of ALL) {
  const play = (restart: boolean) => { let s = make(id, 4, 61); for (let t = 50, n = 0; !s.done && t < 130000; t += 50) { if (restart && t === 3000) s = JSON.parse(JSON.stringify(s)); for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++n, t); advanceMatch(s, t); } return s; };
  const a = play(false), b = play(true);
  assert.deepEqual(a.game.order, b.game.order, `${id}: deterministisch auch nach Neustart`); assert.equal(a.time, b.time);
}
console.log("Hindernis-Parcours erfolgreich (8 Läufe und Finale; Drehbalken fest, Schieber stoßen, Gänge mit Sackgassen und Falltüren, Klettern): Start und Geheimnisse, Klappen mit Warnung, Kanten ohne Hochrutschen, Wind, Finale mit Ausscheiden, Zuschauen, Laufen, Sprunghöhe, Graben und Kontrollpunkt, Hechten, Drehbalken (Springen und Ducken), Festhalten an Kanten und an anderen, Türen, Geisterplatten, Wippen, Förderband, Glibber, Zielreihenfolge und Zielschluss, Aufgeben, Bots in allen Läufen, JSON-Neustart und Determinismus.");
