import assert from "node:assert/strict";
import { boardGame, settleMovement } from "./party-fixtures";
import { activePartyPlayer, applyPartyAction as act, applyPartyControl, BOARD, DUEL, duelTargets, partyMiniResults, publicParty, tickParty, type PartyGame } from "../shared/party";
import { partyBoard } from "../shared/partyBoard";
import { advanceMatch } from "../shared/matches/framework";
import { NEUTRAL_MATCH_INPUT } from "../shared/matches/types";
import { PartyBotDriver } from "../shared/partyBots";

const players = [{ id: "a", name: "Ada" }, { id: "b", name: "Ben" }, { id: "c", name: "Cleo" }];
let now = 200000;
/** A board game whose active player is about to land on duel field 8. */
function toDuelField(seed = 31, coins = 10): PartyGame {
  let g = boardGame(players, { rounds: 5 }, true, seed, now);
  g.players.forEach(p => p.coins = coins);
  const p = activePartyPlayer(g);
  p.position = 7; g.steps = 1; g.path = [7]; g.phase = "moving"; g.movement = { destination: 8, departAt: now, arriveAt: now + 300 };
  g = settleMovement(tickParty(g, now + 300)); now += 400;
  return g;
}

// Die vier früheren Aussichtsfelder sind Duellfelder; Roll It Up behält schlichte Felder.
assert.deepEqual(BOARD.filter(f => f.type === "duel").map(f => f.id), [8, 18, 27, 31]);
assert.equal(BOARD.some(f => f.type === "safe"), false);
assert.equal(partyBoard({ mode: "roll-it-up" }).some(f => f.type === "duel"), false, "Roll It Up ohne Duelle");

// Landen: Herausforderung wählen, Einsatz zwischen 1 und dem Kleinsten aus 10 und beiden Münzständen.
{
  let g = toDuelField();
  assert.equal(g.phase, "duel");
  const challenger = activePartyPlayer(g), other = g.players.find(p => p.id !== challenger.id)!;
  other.coins = 4;
  assert.equal(duelTargets(g).find(t => t.id === other.id)!.max, 4);
  assert.throws(() => act(g, other.id, { type: "duel", target: challenger.id, stake: 2 }, now), /nicht am Zug/);
  assert.throws(() => act(g, challenger.id, { type: "duel", target: other.id, stake: 5 }, now), /zwischen 1 und 4/);
  assert.throws(() => act(g, challenger.id, { type: "duel", target: challenger.id, stake: 1 }, now));
  g = act(g, challenger.id, { type: "duel", target: other.id, stake: 3 }, now += 100);
  assert.equal(g.phase, "mini-intro"); assert.ok((DUEL.minis as readonly string[]).includes(g.mini!.id), "Spiel aus dem Duell-Pool");
  assert.equal(g.players.find(p => p.id === challenger.id)!.coins, 7); assert.equal(g.players.find(p => p.id === other.id)!.coins, 1, "Beide zahlen den Einsatz");
  // Spectators are ready and done; only the duelists play.
  const watcher = g.players.find(p => p.id !== challenger.id && p.id !== other.id)!;
  assert.equal(g.mini!.runs[watcher.id].ready, true); assert.equal(g.mini!.runs[watcher.id].done, true);
  g = act(g, challenger.id, { type: "ready" }, now += 100);
  assert.equal(g.phase, "mini-intro", "Wartet auf den Gegner");
  g = act(g, other.id, { type: "ready" }, now += 100);
  assert.equal(g.phase, "mini-play");
  assert.deepEqual(g.mini!.match!.players.map(p => p.id).sort(), [challenger.id, other.id].sort(), "Nur die beiden im Match");
  now = g.mini!.startAt + 100;
  assert.throws(() => applyPartyControl(g, watcher.id, { ...NEUTRAL_MATCH_INPUT, x: 1 }, 1, now), "Zuschauer steuern nicht");
  assert.throws(() => act(g, watcher.id, { type: "finish" }, now), /schaust/);
  // Everyone watches the same match live.
  assert.ok(publicParty(g, watcher.id, now).mini!.match, "Zuschauer sehen das Match");
  // The opponent plays and the challenger gives up: the opponent takes the pot.
  g = applyPartyControl(g, other.id, { ...NEUTRAL_MATCH_INPUT, x: .5, cn: 0 }, 1, now);
  g = applyPartyControl(g, challenger.id, { ...NEUTRAL_MATCH_INPUT, x: .5 }, 1, now + 30);
  g = act(g, challenger.id, { type: "finish" }, now += 100);
  assert.equal(g.phase, "mini-result"); assert.equal(g.duel!.winner, other.id);
  assert.equal(g.players.find(p => p.id === other.id)!.coins, 7, "Gewinner bekommt den Pott (2 × 3)");
  assert.equal(g.players.find(p => p.id === challenger.id)!.coins, 7);
  assert.ok(partyMiniResults(g).every(r => r.coins === 0), "Keine 10/4/2-Münzen im Duell");
  assert.equal(g.players.find(p => p.id === other.id)!.wins, 0, "Duelle zählen nicht als Minispielsieg");
  assert.throws(() => act(g, other.id, { type: "next" }, now), /nicht am Zug/);
  g = act(g, challenger.id, { type: "next" }, now += 100);
  assert.equal(g.phase, "summary"); assert.equal(g.duel, undefined); assert.equal(g.mini, undefined);
  assert.match(g.log.at(-1)!, /gewinnt das Duell/);
}

// Unentschieden (niemand spielt): Einsätze zurück. Verzicht ist möglich. Ohne Münzen kein Duell.
{
  let g = toDuelField(32);
  const challenger = activePartyPlayer(g), other = g.players.find(p => p.id !== challenger.id)!;
  g = act(g, challenger.id, { type: "duel", target: other.id, stake: 10 }, now += 100);
  for (const p of [challenger, other]) g = act(g, p.id, { type: "ready" }, now += 100);
  g = tickParty(g, g.deadline + 1);
  assert.equal(g.phase, "mini-result"); assert.equal(g.duel!.draw, true);
  assert.equal(g.players.find(p => p.id === challenger.id)!.coins, 10); assert.equal(g.players.find(p => p.id === other.id)!.coins, 10);
  let h = toDuelField(33);
  h = act(h, activePartyPlayer(h).id, { type: "duel" }, now += 100);
  assert.equal(h.phase, "summary"); assert.match(h.log.at(-1)!, /verzichtet/);
  const poor = toDuelField(34, 0);
  assert.equal(poor.phase, "summary", "Ohne Münzen kein Duell"); assert.match(poor.log.at(-1)!, /kein Duell/i);
  // Online deadline or passive challenger: the duel is skipped.
  let p = toDuelField(35); activePartyPlayer(p).passive = true; p = tickParty(p, now += 100);
  assert.equal(p.phase, "summary");
}

// Bots fordern heraus, spielen und schließen das Duell ab; vollständige Partie mit Bots.
{
  let g = toDuelField(36);
  for (const p of g.players) p.bot = true;
  const driver = new PartyBotDriver();
  let guard = 0;
  while (g.phase !== "summary" && guard++ < 4000) { now += 50; g = tickParty(driver.step(g, now), now); if (g.mini?.match && g.phase === "mini-play") advanceMatch(g.mini.match, now - g.mini.startAt); }
  assert.equal(g.phase, "summary", "Bot-Duell läuft durch");
  assert.ok(g.log.some(line => /fordert .* zum Duell/.test(line)));
  const total = g.players.reduce((n, p) => n + p.coins, 0);
  assert.equal(total, 30, "Münzen bleiben erhalten (Pott geht vollständig an Sieger oder zurück)");
}
console.log("Duellfelder erfolgreich: vier Duellfelder, Herausforderung mit Einsatzgrenzen, Pott, Zuschauen, nur Duellanten im Match, Gewinner nimmt den Pott, Unentschieden, Verzicht, ohne Münzen, Frist und Bots.");
