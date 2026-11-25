import assert from "node:assert/strict";
import { applyPartyAction, applyPartyUnity, createPartyGame, partyMiniResults, tickParty, type PartyGame } from "../shared/party";
import { publicMatch } from "../shared/matches/framework";
import { FL, FLOOR_TILES } from "../shared/matches/floorIsLava";
import { checkedHostSnap, lavaFromHostSnap, type LavaHostGame, type LavaHostSnap } from "../shared/matches/lavaHost";
import { isMiniLook, lookChoices, matchIdForLook } from "../shared/minigameLooks";
import { isPlayableMini, miniPool } from "../shared/minigameCatalog";

// Pilot Floor is Lava "Unity · Host rechnet": the host's Unity scene computes, the room checks and relays.
assert.deepEqual(lookChoices("lava")!["unity-host"], ["third", "top"]);
assert.ok(isMiniLook("lava", { renderer: "unity-host", view: "top" }));
assert.equal(matchIdForLook("lava", { renderer: "unity-host", view: "third" }), "lavahost");
assert.equal(matchIdForLook("lava", { renderer: "unity", view: "third" }), "lava");
assert.ok(!isPlayableMini("lavahost") && !miniPool(4, true).includes("lavahost" as never));

const TILES = FLOOR_TILES * FL.floors;
const snap = (ids: string[], points: number[] = ids.map(() => 0), extra: Partial<LavaHostSnap> = {}): LavaHostSnap => ({
  type: "snap", time: 5000, done: false, round: 1, phase: "play", tiebreak: false, roundStart: 1000, rings: 0, tiles: "1".repeat(TILES), regen: "0".repeat(TILES),
  tiebreakWinner: -1, points, events: [{ seq: 1, kind: "jump", text: "", ids: [ids[0]] }], physical: true,
  runners: ids.map((id, i) => ({ id, x: 2 + i, y: 3, vx: 0, vy: 0, fx: 0, fy: 1, floor: 0, alive: true, h: 0, dropUntil: 0, airUntil: 0, shoveUntil: 0, slideUntil: 0, diveUntil: 0, proneUntil: 0, jumpReady: 5500, shoveReady: 0, diveReady: 0, invulnUntil: 0 })),
  ...extra
});

// Host check: players in seat order only, broken tiles, unknown events and wild numbers are refused or clamped.
assert.throws(() => checkedHostSnap(snap(["b", "a"]), ["a", "b"]), /Unbekannter Läufer/);
assert.throws(() => checkedHostSnap(snap(["a"]), ["a", "b"]), /Unbekannter Läufer/);
assert.throws(() => checkedHostSnap({ ...snap(["a"]), tiles: "9".repeat(TILES) }, ["a"]), /Platten/);
assert.throws(() => checkedHostSnap({ ...snap(["a"]), events: [{ seq: 1, kind: "teleport", text: "", ids: [] }] }, ["a"]), /Ereignis/);
assert.throws(() => checkedHostSnap({ ...snap(["a"]), runners: [{ ...snap(["a"]).runners[0], x: Number.NaN }] }, ["a"]), /Unity-Zustand/);
{
  const wild = checkedHostSnap({ ...snap(["a"], [1e9]), tiebreakWinner: 7, runners: [{ ...snap(["a"]).runners[0], x: 99, h: 40 }], events: [{ seq: 2, kind: "out", text: "x".repeat(200), ids: ["a", "zz"] }] }, ["a"]);
  assert.equal(wild.runners[0].x, FL.cols + 2); assert.equal(wild.runners[0].h, 8); assert.equal(wild.points[0], 100); assert.equal(wild.tiebreakWinner, 0);
  assert.equal(wild.events[0].text.length, 60); assert.deepEqual(wild.events[0].ids, ["a"]);
}
// The web fallback draws a reported snapshot on the room's clock.
{
  const lava = lavaFromHostSnap(snap(["a", "b"], [0, 2]), ["a", "b"], 8000);
  assert.equal(lava.runners.b.x, 3); assert.equal(lava.points.b, 2); assert.equal(lava.roundStart, 4000); assert.equal(lava.runners.a.jumpReady, 8500);
  assert.equal(lavaFromHostSnap(undefined, ["a"], 0).tiles.length, TILES);
}

// Through the party: only the host chooses it, only online, only the host reports.
const people = [{ id: "h", name: "Host" }, { id: "m", name: "Mia" }, { id: "b", name: "Bot", bot: true }];
const ids = people.map(p => p.id);
const room = () => createPartyGame(people, undefined, true, 11, 0, "free-minigame", { miniId: "lava" });
{
  const offline = createPartyGame(people.slice(0, 2), undefined, false, 11, 0, "free-minigame", { miniId: "lava" });
  assert.throws(() => applyPartyAction(offline, "h", { type: "look", renderer: "unity-host", view: "third" }, 1), /nur online/);
  assert.throws(() => applyPartyAction(room(), "b", { type: "look", renderer: "unity-host", view: "third" }, 1), /nur online/);
}
let g: PartyGame = room();
g = applyPartyAction(g, "h", { type: "look", renderer: "unity-host", view: "third" }, 1);
assert.equal(g.mini!.unityHost, "h");
for (const p of people) g = applyPartyAction(g, p.id, { type: "ready" }, 2);
assert.equal(g.phase, "mini-play"); assert.equal(g.mini!.id, "lava"); assert.equal(g.mini!.match!.id, "lavahost");
const relay = () => g.mini!.match!.game as LavaHostGame, start = g.mini!.startAt;
assert.equal(relay().host, "h");
// The host sees everyone's inputs for its simulation, the others do not.
g = tickParty(g, start + 500);
assert.equal((publicMatch(g.mini!.match!, "h").game as LavaHostGame).inputs?.length, 3);
assert.equal((publicMatch(g.mini!.match!, "m").game as LavaHostGame).inputs, undefined);
assert.throws(() => applyPartyUnity(g, "m", { seq: 1, snap: snap(ids) }, start + 600), /Nur das Host-Handy/);
g = applyPartyUnity(g, "h", { seq: 1, snap: snap(ids, [1, 4, 1]) }, start + 600);
assert.equal(relay().points.m, 4); assert.ok(g.mini!.match!.players.every(p => p.played), "Bots und Menschen nehmen teil");
// Old reports are ignored, the others get the snapshot in their view.
g = applyPartyUnity(g, "h", { seq: 1, snap: snap(ids, [0, 0, 0]) }, start + 700);
assert.equal(relay().points.m, 4);
assert.equal((publicMatch(g.mini!.match!, "m").game as LavaHostGame).snap?.runners.length, 3);
// The host's final report ends the match; the reported points decide.
g = applyPartyUnity(g, "h", { seq: 2, snap: snap(ids, [1, 7, 5], { phase: "done", done: true }), done: true }, start + 800);
g = tickParty(g, start + 850);
assert.equal(g.phase, "finished");
assert.deepEqual(partyMiniResults(g).map(r => [r.player.id, r.place]), [["m", 1], ["b", 2], ["h", 3]]);
assert.throws(() => applyPartyUnity(g, "h", { seq: 3, done: true }, start + 900), /rechnet kein Host-Handy/);

// Without Unity on the host, the room computes with floorIsLava.ts from then on and Unity only draws.
{
  let f = room();
  f = applyPartyAction(f, "h", { type: "look", renderer: "unity-host", view: "top" }, 1);
  for (const p of people) f = applyPartyAction(f, p.id, { type: "ready" }, 2);
  const at = f.mini!.startAt + 3000;
  f = applyPartyUnity(f, "h", { seq: 1, fail: true }, at);
  assert.equal(f.mini!.match!.id, "lava"); assert.deepEqual(f.mini!.look, { renderer: "unity", view: "top" });
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
console.log("Floor is Lava „Host rechnet“ erfolgreich: Ansichtswahl, Host-Prüfung, Web-Rückfall, Eingaben nur für den Host, Wertung, Ende, alte Meldungen, Ausfall und Zeitlimit.");
