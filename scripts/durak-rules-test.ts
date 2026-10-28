import assert from "node:assert/strict";
import {
  attackDurak,
  canBeatDurak,
  canTransferDurak,
  createDurakGame,
  defendDurak,
  finishDurakBout,
  takeDurak,
  transferDurak
} from "../shared/durak";
import type { DurakCard, DurakGameState } from "../shared/types";

const card = (suit: DurakCard["suit"], rank: DurakCard["rank"]): DurakCard => ({ id: `${suit}-${rank}`, suit, rank });

assert.equal(canBeatDurak(card("clubs", "6"), card("clubs", "7"), "spades"), true);
assert.equal(canBeatDurak(card("clubs", "A"), card("spades", "6"), "spades"), true);
assert.equal(canBeatDurak(card("spades", "6"), card("clubs", "A"), "spades"), false);

const created = createDurakGame([
  { id: "p1", name: "Anna" },
  { id: "p2", name: "Ben" },
  { id: "p3", name: "Cem" }
], () => 0.42);
assert.equal(Object.values(created.hands).every((hand) => hand.length === 6), true, "Alle beginnen mit sechs Karten");
assert.equal(created.deck.length, 18, "Bei drei Spielern bleiben 18 Karten im Stapel");

function transferState(): DurakGameState {
  return {
    playerOrder: ["p1", "p2", "p3"],
    playerNames: { p1: "Anna", p2: "Ben", p3: "Cem" },
    hands: {
      p1: [card("clubs", "6"), card("diamonds", "9")],
      p2: [card("hearts", "6"), card("clubs", "9")],
      p3: [card("spades", "7"), card("diamonds", "8"), card("hearts", "9")]
    },
    handCounts: { p1: 2, p2: 2, p3: 3 },
    deck: [card("spades", "A")],
    trumpSuit: "spades",
    trumpCard: card("spades", "A"),
    attackerId: "p1",
    defenderId: "p2",
    phase: "attack",
    table: [],
    maxAttackCards: 2,
    defenderTakes: false,
    finishedPlayerIds: [],
    durakId: null,
    log: []
  };
}

let game = attackDurak(transferState(), "p1", "clubs-6");
assert.equal(game.phase, "defend");
assert.equal(canTransferDurak(game, "p2", "hearts-6"), true, "Gleicher Wert darf weitergeschoben werden");
game = transferDurak(game, "p2", "hearts-6");
assert.equal(game.attackerId, "p2");
assert.equal(game.defenderId, "p3");
assert.equal(game.table.length, 2);
game = defendDurak(game, "p3", "clubs-6", "spades-7");
assert.equal(game.phase, "defend", "Alle offenen Angriffe müssen gedeckt werden");
game = takeDurak(game, "p3");
assert.equal(game.defenderTakes, true);
game = finishDurakBout(game, "p2");
assert.equal(game.hands.p3.some((entry) => entry.id === "clubs-6"), true, "Beim Aufnehmen kommen Tischkarten auf die Hand");
assert.equal(game.attackerId, "p1", "Nach dem Aufnehmen wird der Verteidiger übersprungen");

const twoPlayer = transferState();
twoPlayer.playerOrder = ["p1", "p2"];
twoPlayer.hands.p1.push(card("diamonds", "8"));
twoPlayer.handCounts.p1 = 3;
delete twoPlayer.hands.p3;
delete twoPlayer.handCounts.p3;
delete twoPlayer.playerNames.p3;
const twoPlayerAttack = attackDurak(twoPlayer, "p1", "clubs-6");
assert.equal(canTransferDurak(twoPlayerAttack, "p2", "hearts-6"), true, "Weiterschieben funktioniert auch bei zwei Spielern");
const transferredBack = transferDurak(twoPlayerAttack, "p2", "hearts-6");
assert.equal(transferredBack.defenderId, "p1", "Beim Duell geht der Angriff an den ursprünglichen Angreifer zurück");

console.log("Durak-Regeltests erfolgreich: Karten, Trumpf, Angriff, Decken, Aufnehmen und Weiterschieben");
