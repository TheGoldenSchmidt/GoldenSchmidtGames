import assert from "node:assert/strict";
import { createQwixxGame, canMark, rollQwixx, submitWhiteChoice, submitColorChoice, availableColorChoices } from "../shared/qwixx";
import { createDurakGame, canBeatDurak, attackDurak, defendDurak, throwInDurak, finishDurakBout, takeDurak, transferDurak, cheatThrowInDurak, accuseDurak } from "../shared/durak";
import { createKribbelnGame, rollKribbeln, submitKribbeln, kribbelTaskMet, KRIBBEL_COLORS, rankKribbelnResults } from "../shared/kribbeln";
import type { DurakCard, DurakGameState } from "../shared/types";

const players = [{ id: "a", name: "A" }, { id: "b", name: "B" }];
const q = createQwixxGame(players);
assert.throws(() => createQwixxGame(players.slice(0, 1)));
assert.throws(() => rollQwixx(q, "b"));
assert.throws(() => submitWhiteChoice(q, "a", null));
assert.throws(() => submitColorChoice(q, "a", null));
assert.deepEqual(availableColorChoices(q, "a"), []);
for (const color of ["red", "yellow", "green", "blue"] as const) {
  for (let marked = 0; marked < 10; marked++) {
    const sheet = structuredClone(q.sheets.a);
    sheet.marks[color] = Array.from({ length: marked }, (_, i) => i);
    for (let index = 0; index < 11; index++) {
      const value = color === "green" || color === "blue" ? 12 - index : 2 + index;
      assert.equal(canMark(sheet, color, value, []), index >= marked && (index !== 10 || marked >= 5));
      assert.equal(canMark(sheet, color, value, [color]), false);
    }
  }
}
let qr = rollQwixx(q, "a", { white: [3, 4], colors: { red: 2, yellow: 3, green: 4, blue: 5 } });
assert.throws(() => submitWhiteChoice(qr, "outsider", null));
qr = submitWhiteChoice(qr, "a", "red");
assert.throws(() => submitWhiteChoice(qr, "a", null));
qr = submitWhiteChoice(qr, "b", null);
assert.throws(() => submitColorChoice(qr, "b", null));
assert.ok(availableColorChoices(qr, "a").length > 0);

const suits = ["clubs", "diamonds", "hearts", "spades"] as const;
const ranks = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const card = (suit: DurakCard["suit"], rank: DurakCard["rank"]): DurakCard => ({ id: `${suit}-${rank}`, suit, rank });
for (const trump of suits) for (const aSuit of suits) for (const dSuit of suits) for (const ar of ranks) for (const dr of ranks) {
  assert.equal(canBeatDurak(card(aSuit, ar), card(dSuit, dr), trump), aSuit === dSuit ? ranks.indexOf(dr) > ranks.indexOf(ar) : dSuit === trump && aSuit !== trump);
}
assert.throws(() => createDurakGame([]));
for (let count = 2; count <= 6; count++) {
  const game = createDurakGame(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `P${i}` })));
  assert.equal(new Set([...game.deck, ...Object.values(game.hands).flat()].map(c => c.id)).size, 36);
  assert.equal(game.deck.length, 36 - count * 6);
}
function duel(): DurakGameState {
  const game = createDurakGame(players);
  Object.assign(game, { attackerId: "a", defenderId: "b", deck: [], trumpSuit: "spades", maxAttackCards: 2,
    hands: { a: [card("clubs", "6"), card("hearts", "8")], b: [card("clubs", "7"), card("hearts", "9")] }, handCounts: { a: 2, b: 2 } });
  return game;
}
let d = duel();
assert.throws(() => attackDurak(d, "b", "clubs-7"));
assert.throws(() => attackDurak(d, "a", "missing"));
d = attackDurak(d, "a", "clubs-6");
assert.throws(() => defendDurak(d, "b", "clubs-6", "hearts-9"));
assert.throws(() => transferDurak(d, "b", "clubs-7"));
d = defendDurak(d, "b", "clubs-6", "clubs-7");
assert.throws(() => throwInDurak(d, "a", "hearts-8"));
assert.throws(() => finishDurakBout(d, "b"));
d = finishDurakBout(d, "a");
assert.equal(d.attackerId, "b");
assert.equal(d.table.length, 0);
let end = duel();
end.hands.a = [card("clubs", "6")]; end.hands.b = [card("clubs", "7")];
end = finishDurakBout(defendDurak(attackDurak(end, "a", "clubs-6"), "b", "clubs-6", "clubs-7"), "a");
assert.equal(end.phase, "finished"); assert.equal(end.durakId, null);
let loser = duel(); loser.hands.a = [card("clubs", "6")];
loser = finishDurakBout(takeDurak(attackDurak(loser, "a", "clubs-6"), "b"), "a");
assert.equal(loser.durakId, "b");
let cheat = duel(); cheat.cheatMode = true;
cheat = defendDurak(attackDurak(cheat, "a", "clubs-6"), "b", "clubs-6", "clubs-7");
cheat = cheatThrowInDurak(cheat, "a", "hearts-8");
assert.equal(cheat.table[1].attackIllegal, true);
assert.equal(accuseDurak(cheat, "b", "hearts-8").cheatBannedPlayerIds.includes("a"), true);
assert.throws(() => accuseDurak(cheat, "a", "hearts-8"));
const falseCall = accuseDurak(cheat, "b", "clubs-6");
assert.throws(() => accuseDurak(falseCall, "b", "hearts-8"));

assert.throws(() => createKribbelnGame([]));
// Jede der 46.656 möglichen Farbkombinationen gegen unabhängig gezählte Bedingungen.
for (let code = 0; code < 46656; code++) {
  let encoded = code;
  const counts = Array(6).fill(0);
  const dice = Array.from({ length: 6 }, () => { const index = encoded % 6; encoded = Math.floor(encoded / 6); counts[index]++; return { color: KRIBBEL_COLORS[index], value: 1 }; });
  const expected = [counts[2] === 1, counts[1] === 0, counts.filter(n => n > 0).length === 3, counts[3] > counts[0], counts.includes(4), counts.filter(n => n === 2).length === 2];
  expected.forEach((value, task) => assert.equal(kribbelTaskMet(task, dice), value));
}
assert.deepEqual(rankKribbelnResults({ a: null, b: null }), { a: 0, b: 0 });
let k = createKribbelnGame(players);
assert.throws(() => submitKribbeln(k, "a", "score"));
assert.throws(() => rollKribbeln(k, "a", [0]));
assert.throws(() => rollKribbeln(k, "a", [7]));
k = rollKribbeln(k, "a", [], () => 0);
assert.throws(() => submitKribbeln(k, "b", "score"));
k = submitKribbeln(k, "a", "score");
assert.equal(k.results.a[0], 6);
assert.equal(k.results.b[0], -1);
assert.equal(JSON.parse(JSON.stringify(k)).results.b[0], -1);
console.log("Erweiterte Regeln erfolgreich: Qwixx-Felder, Durak-Kartenmatrix, Schummelmodus, Spielenden und alle Kribbeln-Farbkombinationen");
