import assert from "node:assert/strict";
import { applyPartyAction, applyPartyUnity, createPartyGame, partyMiniResults, tickParty, type PartyGame } from "../shared/party";
import { advanceMatch, botMatchInput, createMatch, publicMatch, setMatchControl } from "../shared/matches/framework";
import { FL, FLOOR_TILES, type LavaGame } from "../shared/matches/floorIsLava";
import type { LavaHostGame } from "../shared/matches/lavaHost";
import { checkedLavaSnap, lavaFromSnap, lavaSnapshot, type LavaSnap } from "../shared/matches/lavaSnap";
import { defaultLook, isMiniLook, lookChoices, matchIdForLook } from "../shared/minigameLooks";
import { isPlayableMini, miniPool } from "../shared/minigameCatalog";
import type { MatchState } from "../shared/matches/types";

// Pilot Floor is Lava with Unity: A = the room computes, Unity draws; B = the host's Unity scene computes.
const plain = (value: unknown): boolean => value === null ? false : Array.isArray(value) ? value.every(plain) : typeof value === "object" ? Object.values(value as object).every(plain) : value !== undefined;

// Choices: web stays the default during the pilot; the host simulation is its own rules module, never drawn on its own.
assert.deepEqual(defaultLook("lava"), { renderer: "web", view: "third" });
assert.deepEqual(Object.keys(lookChoices("lava")!).sort(), ["unity", "unity-host", "web"]);
assert.ok(isMiniLook("lava", { renderer: "unity-host", view: "third" }));
assert.equal(matchIdForLook("lava", { renderer: "unity-host", view: "third" }), "lavahost");
assert.equal(matchIdForLook("lava", { renderer: "unity", view: "third" }), "lava");
assert.ok(!isPlayableMini("lavahost") && !miniPool(4, true).includes("lavahost" as never));

// Variant A: the snapshot of the room's state is flat (JsonUtility) and follows the rules.
{
  const s = createMatch("lava", ["a", "b", "c"].map((id, i) => ({ id, style: i })), 7) as MatchState<LavaGame>;
  let seq = 0;
  for (let t = 50; t <= 3000; t += 50) { for (const p of s.players) setMatchControl(s, p.id, botMatchInput(s, p.id), ++seq, t); advanceMatch(s, t); }
  let snap = lavaSnapshot(s);
  assert.ok(plain(snap), "Schnappschuss ohne leere Werte");
  assert.equal(snap.tiles.length, FLOOR_TILES * FL.floors); assert.equal(snap.regen.length, snap.tiles.length);
  assert.deepEqual(snap.runners.map(r => r.id), ["a", "b", "c"]);
  assert.ok(snap.runners.every(r => r.h >= 0 && r.h <= 1 && r.jump >= 0 && r.jump <= 1));
  // A jump lifts the figure, a hole lets it drop one floor (h counts down from 1).
  const r = s.game.runners.a; r.airUntil = s.time + FL.jumpMs / 2; r.jumpReady = s.time + FL.jumpCooldown;
  snap = lavaSnapshot(s);
  assert.ok(snap.runners[0].air && snap.runners[0].h > .2 && snap.runners[0].jump > .9);
  r.airUntil = r.dropUntil = s.time + FL.dropMs; r.floor = 1;
  snap = lavaSnapshot(s);
  assert.equal(snap.runners[0].act, "drop"); assert.equal(snap.runners[0].floor, 1); assert.ok(snap.runners[0].h > .99);
  // The same snapshot passes the host check unchanged (B uses the same format).
  assert.deepEqual(checkedLavaSnap(JSON.parse(JSON.stringify(snap)), ["a", "b", "c"]), snap);
}

// Host check: unknown players, broken tiles and wild numbers are refused or clamped.
const base = (ids: string[]): LavaSnap => ({ type: "snap", time: 1000, round: 1, phase: "play", tiebreak: false, roundTime: 1000, rings: 0,
  tiles: "1".repeat(FLOOR_TILES * FL.floors), regen: "0".repeat(FLOOR_TILES * FL.floors), done: false, tiebreakWinner: "",
  runners: ids.map((id, i) => ({ id, x: 2 + i, y: 3, floor: 0, h: 0, vx: 0, vy: 0, fx: 0, fy: 1, alive: true, air: false, act: "", points: i, gain: 0, won: false, jump: 0, shove: 0, dive: 0 })) });
assert.throws(() => checkedLavaSnap({ ...base(["a"]), runners: base(["x"]).runners }, ["a"]), /Unbekannter Läufer/);
assert.throws(() => checkedLavaSnap({ ...base(["a"]), tiles: "9".repeat(FLOOR_TILES * FL.floors) }, ["a"]), /Platten/);
assert.throws(() => checkedLavaSnap({ ...base(["a", "a"]) }, ["a", "b"]), /Unbekannter Läufer/);
assert.throws(() => checkedLavaSnap({ ...base(["a"]), runners: [{ ...base(["a"]).runners[0], x: Number.NaN }] }, ["a"]), /Unity-Zustand/);
{
  const wild = checkedLavaSnap({ ...base(["a"]), runners: [{ ...base(["a"]).runners[0], x: 99, points: 1e9, act: "teleport" }], tiebreakWinner: "x" }, ["a"]);
  assert.equal(wild.runners[0].x, FL.cols + 2); assert.equal(wild.runners[0].points, 100); assert.equal(wild.runners[0].act, ""); assert.equal(wild.tiebreakWinner, "");
}
// The web fallback draws a reported snapshot with the normal Floor is Lava shape.
{
  const lava = lavaFromSnap(base(["a", "b"]), ["a", "b"], 5000);
  assert.equal(lava.runners.b.x, 3); assert.equal(lava.points.b, 1); assert.equal(lava.roundStart, 4000);
  assert.equal(lavaFromSnap(undefined, ["a"], 0).tiles.length, FLOOR_TILES * FL.floors);
}

// Variant B through the party: only the host chooses it, only online, only the host reports.
const people = [{ id: "h", name: "Host" }, { id: "m", name: "Mia" }, { id: "b", name: "Bot", bot: true }];
const room = () => createPartyGame(people, undefined, true, 11, 0, "free-minigame", { miniId: "lava" });
{
  const offline = createPartyGame(people.slice(0, 2), undefined, false, 11, 0, "free-minigame", { miniId: "lava" });
  assert.throws(() => applyPartyAction(offline, "h", { type: "look", renderer: "unity-host", view: "third" }, 1), /nur online/);
}
let g: PartyGame = room();
assert.deepEqual(g.mini!.look, { renderer: "web", view: "third" });
g = applyPartyAction(g, "h", { type: "look", renderer: "unity-host", view: "third" }, 1);
assert.equal(g.mini!.unityHost, "h");
for (const p of people) g = applyPartyAction(g, p.id, { type: "ready" }, 2);
assert.equal(g.phase, "mini-play"); assert.equal(g.mini!.id, "lava"); assert.equal(g.mini!.match!.id, "lavahost");
const relay = () => g.mini!.match!.game as LavaHostGame, start = g.mini!.startAt;
assert.equal(relay().host, "h");
// The host sees everyone's inputs for its simulation, the others do not.
g = tickParty(g, start + 500);
assert.ok((publicMatch(g.mini!.match!, "h").game as LavaHostGame).inputs?.length === 3);
assert.equal((publicMatch(g.mini!.match!, "m").game as LavaHostGame).inputs, undefined);
assert.throws(() => applyPartyUnity(g, "m", { seq: 1, snap: base(["h", "m", "b"]) }, start + 600), /Nur das Host-Handy/);
g = applyPartyUnity(g, "h", { seq: 1, snap: { ...base(["h", "m", "b"]), runners: base(["h", "m", "b"]).runners.map(r => ({ ...r, points: r.id === "m" ? 4 : 1 })) } }, start + 600);
assert.equal(relay().points.m, 4); assert.ok(g.mini!.match!.players.every(p => p.played), "Bots und Menschen nehmen teil");
// Old reports are ignored, the others get the snapshot in their view.
const before = relay().points.m;
g = applyPartyUnity(g, "h", { seq: 1, snap: { ...base(["h", "m", "b"]), runners: base(["h", "m", "b"]).runners.map(r => ({ ...r, points: 0 })) } }, start + 700);
assert.equal(relay().points.m, before);
assert.equal((publicMatch(g.mini!.match!, "m").game as LavaHostGame).snap?.runners.length, 3);
// The host's final report ends the match; the reported points decide.
g = applyPartyUnity(g, "h", { seq: 2, snap: { ...base(["h", "m", "b"]), phase: "done", done: true, runners: base(["h", "m", "b"]).runners.map(r => ({ ...r, points: r.id === "m" ? 7 : r.id === "b" ? 5 : 1 })) }, done: true }, start + 800);
g = tickParty(g, start + 850);
// A free minigame ends with its only match.
assert.equal(g.phase, "finished");
assert.deepEqual(partyMiniResults(g).map(r => [r.player.id, r.place]), [["m", 1], ["b", 2], ["h", 3]]);
assert.throws(() => applyPartyUnity(g, "h", { seq: 3, done: true }, start + 900), /rechnet kein Host-Handy/);

// Without Unity on the host, the room computes with floorIsLava.ts from then on and Unity only draws.
{
  let f = room();
  f = applyPartyAction(f, "h", { type: "look", renderer: "unity-host", view: "third" }, 1);
  for (const p of people) f = applyPartyAction(f, p.id, { type: "ready" }, 2);
  const at = f.mini!.startAt + 3000;
  f = applyPartyUnity(f, "h", { seq: 1, fail: true }, at);
  assert.equal(f.mini!.match!.id, "lava"); assert.deepEqual(f.mini!.look, { renderer: "unity", view: "third" });
  assert.equal(f.mini!.startAt, at); assert.ok(f.deadline > at + 60000);
  f = tickParty(f, at + 2000);
  assert.equal(f.phase, "mini-play"); assert.ok(f.mini!.match!.time >= 1950);
}
// The time limit also ends a host simulation that never reports.
{
  let f = room();
  f = applyPartyAction(f, "h", { type: "look", renderer: "unity-host", view: "third" }, 1);
  for (const p of people) f = applyPartyAction(f, p.id, { type: "ready" }, 2);
  f = tickParty(f, f.deadline + 10);
  assert.equal(f.phase, "finished");
}
console.log("Floor-is-Lava-Pilot erfolgreich: Ansichtswahl, Unity-Schnappschuss (A), Host-Prüfung, Web-Rückfall, Host-Rechnung über die Party mit Eingaben, Wertung, Ende, alte Meldungen, Ausfall und Zeitlimit (B).");
