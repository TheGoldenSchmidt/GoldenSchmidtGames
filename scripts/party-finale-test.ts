import { boardGame, settleMovement } from "./party-fixtures";
import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction as act, BONUS_TROPHIES, createPartyGame, fieldLabel, FINAL_ROUNDS, isFinalStretch, ITEM_IDS, ITEMS, publicParty, TROPHY_SHOPS, type PartyAction, type PartyGame } from "../shared/party";
import { fieldName, partyPaths } from "../shared/partyBoard";

const players = [{ id: "a", name: "Ada" }, { id: "b", name: "Ben" }];
let now = 200000;
const make = (seed = 31) => boardGame(players, { rounds: 5 }, true, seed, now);
const byId = (g: PartyGame, id: string) => g.players.find(p => p.id === id)!;
function command(g: PartyGame, action: PartyAction) {
  const next = settleMovement(act(g, activePartyPlayer(g).id, action, now += 100));
  now = Math.max(now, next.movement?.arriveAt ?? now);
  return next;
}

// Trophy stand: after a purchase it moves to one of the two other shops, drawn from the room's random state.
for (const from of TROPHY_SHOPS) {
  const seen = new Set<number>();
  for (let seed = 0; seed < 40; seed++) {
    let g = make();
    g.trophyField = from; activePartyPlayer(g).position = from - 1; activePartyPlayer(g).coins = 30; g.rng = 0;
    g = command(g, { type: "roll" });
    assert.equal(g.phase, "trophy");
    g.rng = seed * 2654435761 >>> 0;
    g = command(g, { type: "trophy", buy: true });
    assert.notEqual(g.trophyField, from, "Der Trophäenstand bleibt nicht am selben Shop");
    assert.ok((TROPHY_SHOPS as readonly number[]).includes(g.trophyField));
    assert.ok(g.log.some(line => line.includes(`zieht weiter zu Feld ${g.trophyField}`)));
    seen.add(g.trophyField);
  }
  assert.equal(seen.size, 2, `Von Feld ${from} sind beide anderen Shops möglich`);
}
let declined = make(); declined.trophyField = 6; activePartyPlayer(declined).position = 5; activePartyPlayer(declined).coins = 30; declined.rng = 0;
declined = command(declined, { type: "roll" }); declined = command(declined, { type: "trophy", buy: false });
assert.equal(declined.trophyField, 6, "Ohne Kauf bleibt der Trophäenstand stehen");

// The last three rounds: only Inselparty, never during the opening.
let g = make();
for (let round = 1; round <= 5; round++) { g.round = round; assert.equal(isFinalStretch(g), round > 5 - FINAL_ROUNDS, `Runde ${round}`); }
g.round = 5; g.opening = true; assert.equal(isFinalStretch(g), false);
const tray = boardGame(players, { rounds: 5 }, true, 4, now, "roll-it-up"); tray.round = 5; assert.equal(isFinalStretch(tray), false);
g = make(); g.round = 3;
assert.equal(fieldLabel(g, "coin"), "+6 Münzen"); assert.equal(fieldLabel(g, "bad"), "−6 Münzen"); assert.equal(fieldLabel(g, "shop"), "Shop");
assert.equal(fieldName(g, 1), "+6 Münzen"); g.round = 2; assert.equal(fieldName(g, 1), "+3 Münzen");

// Plus and minus fields count double in the last rounds; the harbour bonus stays at 3.
for (const [round, coin, bad] of [[2, 13, 7], [3, 16, 4]] as const) {
  // A random state of 0 rolls a 2.
  let plus = make(); plus.round = round; activePartyPlayer(plus).position = 9; plus.rng = 0;
  plus = command(plus, { type: "roll" }); assert.equal(activePartyPlayer(plus).position, 11); assert.equal(activePartyPlayer(plus).coins, coin);
  let minus = make(); minus.round = round; activePartyPlayer(minus).position = 3; minus.rng = 0;
  minus = command(minus, { type: "roll" }); assert.equal(activePartyPlayer(minus).position, 5); assert.equal(activePartyPlayer(minus).coins, bad);
  assert.equal(activePartyPlayer(minus).lost, 10 - bad, "Verlorene Münzen werden gezählt");
}
let harbour = make(); harbour.round = 4; activePartyPlayer(harbour).position = 27; harbour.rng = 0;
harbour = command(harbour, { type: "roll" }); assert.equal(activePartyPlayer(harbour).coins, 19, "Hafen +3, Münzfeld +6");

// Start of the last rounds: the last places receive a random item, or its price with a full inventory.
function enterFinal(setup: (g: PartyGame) => void, seed = 31) {
  let game = make(seed); game.round = 5 - FINAL_ROUNDS; game.phase = "mini-result"; setup(game);
  game = command(game, { type: "next" });
  assert.equal(game.round, 5 - FINAL_ROUNDS + 1); assert.equal(game.phase, "turn");
  return game;
}
g = enterFinal(game => { byId(game, "a").coins = 30; byId(game, "b").coins = 5; });
assert.equal(g.finalStretch?.round, 3); assert.equal(g.finalStretch.help.length, 1);
const help = g.finalStretch.help[0];
assert.equal(help.id, "b"); assert.ok(help.item && ITEM_IDS.includes(help.item)); assert.deepEqual(byId(g, "b").items, [help.item]);
assert.equal(byId(g, "a").items.length, 0); assert.equal(byId(g, "b").coins, 5);
assert.ok(g.log.some(line => line.includes("Die letzten 3 Runden beginnen")));
g = enterFinal(game => { byId(game, "a").coins = 30; byId(game, "b").coins = 5; byId(game, "b").items = ["shield", "shield", "shield"]; });
const paid = g.finalStretch!.help[0];
assert.equal(paid.item, undefined); assert.ok(paid.coins && Object.values(ITEMS).some(item => item.price === paid.coins));
assert.equal(byId(g, "b").coins, 5 + paid.coins!); assert.equal(byId(g, "b").items.length, 3);
g = enterFinal(game => { for (const p of game.players) p.coins = 12; });
assert.deepEqual(g.finalStretch!.help.map(entry => entry.id).sort(), ["a", "b"], "Gleichstand: alle Letztplatzierten erhalten Rückenwind");
const sameSeed = enterFinal(game => { for (const p of game.players) p.coins = 12; });
assert.deepEqual(sameSeed.finalStretch, g.finalStretch, "Deterministisch über den Zufallsstand des Raums");
let later = make(); later.round = 3; later.phase = "mini-result"; later = command(later, { type: "next" });
assert.equal(later.finalStretch, undefined, "Rückenwind nur zu Beginn der letzten Runden");
let rollItUp = boardGame(players, { rounds: 5 }, true, 4, now, "roll-it-up"); rollItUp.round = 2; rollItUp.phase = "mini-result"; rollItUp.mini = createPartyGame(players, undefined, true, 4, now, "roll-it-up").mini!;
for (const player of players) rollItUp = act(rollItUp, player.id, { type: "next" }, now);
assert.equal(rollItUp.round, 3); assert.equal(rollItUp.finalStretch, undefined);

// Bonus trophies at the end: they count like bought trophies and can decide the winner.
function finish(setup: (g: PartyGame) => void) {
  let game = make(); game.round = 5; game.phase = "summary"; game.turn = game.order.length - 1; setup(game);
  game = command(game, { type: "next" });
  for (const p of game.players) game = act(game, p.id, { type: "ready" }, now += 100);
  now = game.mini!.startAt + 100;
  // Nobody sends an input, so the last minigame changes no wins or coins.
  for (const p of game.players) if (game.phase === "mini-play") game = act(game, p.id, { type: "finish" }, now += 100);
  assert.equal(game.phase, "finished");
  return game;
}
// Older rooms (and these checks) use the former three bonus trophies.
g = finish(game => {
  game.bonusPicks = ["minis", "walker", "unlucky"];
  Object.assign(byId(game, "a"), { trophies: 2, coins: 10, wins: 1, walked: 30, lost: 0 });
  Object.assign(byId(game, "b"), { trophies: 1, coins: 10, wins: 4, walked: 41, lost: 0 });
});
assert.deepEqual(g.bonus!.map(b => [b.id, b.winners, b.value]), [["minis", ["b"], 4], ["walker", ["b"], 41], ["unlucky", [], 0]]);
assert.equal(byId(g, "a").trophies, 2); assert.equal(byId(g, "b").trophies, 3);
assert.deepEqual(g.winners, ["b"], "Bonus-Trophäen zählen für den Sieg");
g = finish(game => {
  game.bonusPicks = ["minis", "walker", "unlucky"];
  Object.assign(byId(game, "a"), { trophies: 1, coins: 10, wins: 3, walked: 20, lost: 7 });
  Object.assign(byId(game, "b"), { trophies: 1, coins: 10, wins: 3, walked: 25, lost: 7 });
});
assert.deepEqual(g.bonus!.find(b => b.id === "minis")!.winners, ["a", "b"]);
assert.deepEqual(g.bonus!.find(b => b.id === "unlucky")!.winners, ["a", "b"]);
assert.equal(byId(g, "a").trophies, 3); assert.equal(byId(g, "b").trophies, 4); assert.deepEqual(g.winners, ["b"]);
assert.equal(g.log.filter(line => line.startsWith("Bonus-Trophäe")).length, 3);
assert.deepEqual(publicParty(g, "a", now).bonus, g.bonus, "Alle Geräte sehen dieselben Bonus-Trophäen");
assert.equal(BONUS_TROPHIES.length, 6);

// A whole party records walked fields and awards the bonus trophies exactly once.
let full = createPartyGame(Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { rounds: 5 }, true, 77, now);
let bought = 0;
for (let n = 0; n < 5000 && full.phase !== "finished"; n++) {
  const player = activePartyPlayer(full).id;
  if (full.phase === "moving") { full = settleMovement(full); continue; }
  if (full.phase === "mini-intro") { for (const p of full.players) if (!full.mini!.runs[p.id].ready) full = act(full, p.id, { type: "ready" }, now += 100); continue; }
  if (full.phase === "mini-play") { for (const p of full.players) if (!full.mini!.runs[p.id].done && full.phase === "mini-play") full = act(full, p.id, { type: "finish" }, now += 100); continue; }
  if (full.phase === "mini-result") { for (const p of full.players) if (full.phase === "mini-result") full = act(full, p.id, { type: "next" }, now += 100); continue; }
  const action: PartyAction = full.phase === "turn" ? { type: "roll" } : full.phase === "path" ? { type: "path", destination: partyPaths(full, activePartyPlayer(full)).at(-1)! } : full.phase === "trophy" ? { type: "trophy", buy: true } : full.phase === "gift" ? { type: "gift", accept: false } : full.phase === "duel" ? { type: "duel" } : full.phase === "shop" ? { type: "shop" } : { type: "next" };
  const before = activePartyPlayer(full).trophies;
  full = act(full, player, action, now += 100);
  bought += full.players.find(p => p.id === player)!.trophies - before;
}
assert.equal(full.phase, "finished"); assert.deepEqual(full.bonus!.map(b => b.id), full.bonusPicks); assert.equal(full.bonus!.length, 2); assert.ok(full.finalStretch);
assert.ok(full.players.every(p => (p.walked ?? 0) > 0));
const bonusCount = full.bonus!.reduce((sum, b) => sum + b.winners.length, 0);
assert.equal(full.players.reduce((sum, p) => sum + p.trophies, 0), bonusCount + bought);

console.log("Inselparty-Finale erfolgreich: wechselnder Trophäenstand, letzte drei Runden mit doppelten Feldern und Rückenwind, Bonus-Trophäen mit Gleichstand und Sieg sowie eine vollständige Partie.");
