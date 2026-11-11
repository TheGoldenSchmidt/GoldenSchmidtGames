import assert from "node:assert/strict";
import { availableBets, checkMinigameSetup, minigameOptions } from "../shared/minigameModes";
import { miniPool, PLAYABLE_MINI_IDS } from "../shared/minigameCatalog";
import { ACTION_MINI_IDS } from "../shared/partyArena";
import { applyPartyAction, applyPartyControl, createPartyGame, publicParty, tickParty, type PartyGame } from "../shared/party";
import { PartyBotDriver } from "../shared/partyBots";
import { NEUTRAL_MATCH_INPUT } from "../shared/matches/types";

const players = [{ id: "a", name: "Anna" }, { id: "b", name: "Ben" }];
const now = 100_000;
const total = PLAYABLE_MINI_IDS.length;
for (const rounds of [0, -1, total + 1, 2.5, NaN, Infinity]) assert.throws(() => minigameOptions({ rounds }));
assert.throws(() => minigameOptions({ classic: "ja" as never }));
assert.throws(() => minigameOptions({ miniId: "missing" as never }));
assert.equal(minigameOptions({ rounds: 1 }).rounds, 1);
assert.equal(minigameOptions({ rounds: 14 }).rounds, 14);
assert.equal(minigameOptions({ rounds: total }).rounds, total);
// Klassische Minispiele lassen sich ausschließen; Rundenzahl und Spielerzahl müssen zum Pool passen.
assert.ok(miniPool(2, false).length >= 1 && miniPool(2, false).every(id => !ACTION_MINI_IDS.includes(id as never)));
assert.equal(miniPool(2, true).length, total);
assert.throws(() => checkMinigameSetup("goldenschmidt", minigameOptions({ rounds: miniPool(2, false).length + 1, classic: false }), 2));
checkMinigameSetup("goldenschmidt", minigameOptions({ rounds: miniPool(2, false).length, classic: false }), 2);

function play(current: PartyGame, winner?: string, participate = true) {
  let g = current;
  for (const p of g.players.filter(p => !p.passive)) g = applyPartyAction(g, p.id, { type: "ready" }, now);
  assert.equal(g.phase, "mini-play");
  if (participate) {
    for (const p of g.players.filter(p => !p.passive)) g = applyPartyControl(g, p.id, g.mini!.match ? { ...NEUTRAL_MATCH_INPUT, x: .1 } : {x: .1, z: 0, jump: false, punch: false}, 1, g.mini!.startAt + 100);
    // Authoritative fixture for exact rankings; clients cannot set these scores.
    if (g.mini!.arena) for (const actor of g.mini!.arena!.actors) actor.score = actor.id === winner ? 100 : 1;
    g = tickParty(g, g.mini!.startAt + 100);
  }
  // Match games end by giving up; whoever stays longest ranks first.
  const order = g.players.filter(p => !p.passive).sort((a, b) => Number(a.id === winner) - Number(b.id === winner));
  for (const p of order) if (g.phase === "mini-play") g = applyPartyAction(g, p.id, { type: "finish" }, g.mini!.startAt + 100);
  return g;
}

for (const miniId of PLAYABLE_MINI_IDS) {
  let g = createPartyGame(players, undefined, true, 123, now, "free-minigame", { miniId });
  assert.equal(g.phase, "mini-intro"); assert.equal(g.opening, false); assert.equal(g.mini!.id, miniId);
  assert.throws(() => applyPartyAction(g, "a", { type: "bet", value: 1 }, now));
  g = play(g, "a");
  assert.equal(g.phase, "finished"); assert.deepEqual(g.winners, ["a"]);
  assert.equal(g.competition!.history.length, 1); assert.ok(g.players.every(p => p.coins === 0));
}
assert.deepEqual(play(createPartyGame(players, undefined, true, 123, now, "free-minigame"), undefined, false).winners, []);

for (const [rounds, classic] of [[1, true], [5, true], [14, true], [total, true], [miniPool(2, false).length, false]] as const) {
  let g = createPartyGame(players, undefined, true, 123, now, "goldenschmidt", { rounds, classic });
  if (!classic) assert.ok(g.miniBag.concat(g.mini!.id).every(id => !ACTION_MINI_IDS.includes(id as never)), "Ohne Klassiker nur neue Spiele");
  const replay = createPartyGame(players, undefined, true, 123, now, "goldenschmidt", { rounds, classic });
  assert.equal(g.mini!.id, replay.mini!.id); assert.deepEqual(g.miniBag, replay.miniBag);
  const selected = new Set<string>();
  for (let round = 1; round <= rounds; round++) {
    assert.equal(g.phase, "mini-bet"); assert.equal(g.round, round);
    assert.ok(!selected.has(g.mini!.id)); selected.add(g.mini!.id);
    assert.throws(() => applyPartyAction(g, "a", { type: "ready" }, now));
    assert.throws(() => applyPartyAction(g, "a", { type: "bet", value: rounds + 1 }, now));
    if (round > 1) assert.throws(() => applyPartyAction(g, "a", { type: "bet", value: 1 }, now));
    const original = structuredClone(g);
    g = applyPartyAction(g, "a", { type: "bet", value: round }, now);
    assert.deepEqual(original.competition!.bets, {});
    assert.throws(() => applyPartyAction(g, "a", { type: "bet", value: round }, now));
    const hidden = publicParty(g, "b", now), own = publicParty(g, "a", now);
    assert.equal(hidden.competition!.bets.a, undefined);
    assert.deepEqual(hidden.competition!.used.a, Array.from({ length: round - 1 }, (_, i) => i + 1));
    assert.equal(own.competition!.bets.a, round); assert.ok(hidden.competition!.locked.includes("a"));
    assert.deepEqual(hidden.miniBag, []); assert.equal(hidden.rng, 0);
    assert.equal(tickParty(g, now + 1_000_000).phase, "mini-bet", "Kein automatischer Einsatz");
    g = applyPartyAction(g, "b", { type: "bet", value: round }, now);
    assert.equal(g.phase, "mini-intro"); assert.equal(publicParty(g, "b", now).competition!.bets.a, round);
    g = play(g, "a");
    assert.equal(g.competition!.scores.a, round * (round + 1) / 2);
    assert.equal(g.competition!.scores.b, 0);
    assert.deepEqual(g.competition!.history.at(-1)!.points, { a: round, b: 0 });
    assert.ok(g.players.every(p => p.coins === 0));
    if (round < rounds) { assert.equal(g.phase, "mini-result"); g = applyPartyAction(g, "b", { type: "next" }, now); }
  }
  assert.equal(g.phase, "finished"); assert.deepEqual(g.winners, ["a"]);
  assert.deepEqual(availableBets(g.competition!, "a"), []);
  assert.deepEqual(availableBets(g.competition!, "b"), [], "Auch verlorene Einsätze sind verbraucht");
  assert.equal(g.competition!.history.length, rounds);
  assert.throws(() => applyPartyAction(g, "a", { type: "next" }, now));
}

let tie = createPartyGame(players, undefined, true, 321, now, "goldenschmidt", { rounds: 2 });
tie = applyPartyAction(tie, "a", { type: "bet", value: 1 }, now);
tie = applyPartyAction(tie, "b", { type: "bet", value: 2 }, now);
tie = play(tie, "a"); tie = applyPartyAction(tie, "a", { type: "next" }, now);
tie = applyPartyAction(tie, "a", { type: "bet", value: 2 }, now);
tie = applyPartyAction(tie, "b", { type: "bet", value: 1 }, now);
tie = play(tie, "b"); assert.deepEqual(tie.winners, ["a", "b"]);

let paused = createPartyGame(players, undefined, true, 123, now, "goldenschmidt", { rounds: 2 });
paused = applyPartyAction(paused, "a", { type: "bet", value: 2 }, now);
paused.pausedAt = now; paused.disconnected.b = now;
assert.throws(() => applyPartyAction(paused, "b", { type: "bet", value: 1 }, now));
paused = tickParty(paused, now + 60_000);
paused = applyPartyAction(paused, "a", { type: "resume" }, now + 60_000);
paused = tickParty(paused, now + 60_000);
assert.equal(paused.phase, "mini-intro"); assert.deepEqual(paused.competition!.bets, { a: 2 });

let bots = createPartyGame([players[0], { ...players[1], bot: true }], undefined, true, 123, now, "goldenschmidt", { rounds: 2 });
bots = new PartyBotDriver().step(bots, now, true);
assert.deepEqual(bots.competition!.locked, ["b"]);
assert.equal(publicParty(bots, "a", now).competition!.bets.b, undefined);
bots = applyPartyAction(bots, "a", {type:"bet",value:1}, now);
bots = play(bots, "a");
bots.turn = bots.order.indexOf("b");
assert.equal(new PartyBotDriver().step(bots, now, true).phase, "mini-result", "Bots überspringen die gemeinsame Wertung nicht");
bots.players[1].passive = true;
assert.equal(tickParty(bots, now + 1_000_000).phase, "mini-result", "Auch bei passivem Spieler startet nur der Host die nächste Runde");
console.log("Minispielmodi erfolgreich: alle Arenen und Match-Spiele, 1/5/14/alle Runden, Klassiker abschaltbar, einmalige verdeckte Einsätze, eigene Gewinnpunkte, Gleichstand, Pause und Bots.");
