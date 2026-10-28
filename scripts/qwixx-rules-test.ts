import assert from "node:assert/strict";
import {
  canMark,
  createQwixxGame,
  activePlayerId,
  rollQwixx,
  sheetScoreBreakdown,
  sheetScore,
  submitColorChoice,
  submitWhiteChoice
} from "../shared/qwixx";
import type { QwixxDice } from "../shared/types";

const players = [
  { id: "p1", name: "Ada" },
  { id: "p2", name: "Ben" }
];

const firstDice: QwixxDice = {
  white: [3, 4],
  colors: { red: 2, yellow: 5, green: 1, blue: 6 }
};

let game = createQwixxGame(players);
game = rollQwixx(game, "p1", firstDice);
assert.equal(game.phase, "white-choice");
assert.equal(game.dice!.white[0] + game.dice!.white[1], 7);

game = submitWhiteChoice(game, "p1", "red");
assert.equal(game.phase, "white-choice", "Die weiße Aktion wartet auf alle Spieler");
game = submitWhiteChoice(game, "p2", "yellow");
assert.equal(game.phase, "color-choice");
assert.deepEqual(game.sheets.p1.marks.red, [5]);
assert.deepEqual(game.sheets.p2.marks.yellow, [5]);

game = submitColorChoice(game, "p1", { color: "blue", whiteIndex: 0 });
assert.equal(game.phase, "awaiting-roll");
assert.equal(game.turnIndex, 1);
assert.deepEqual(game.sheets.p1.marks.blue, [3]);

const closingDice: QwixxDice = {
  white: [6, 6],
  colors: { red: 1, yellow: 1, green: 1, blue: 1 }
};

let closingGame = createQwixxGame(players);
closingGame.sheets.p1.marks.red = [0, 1, 2, 3, 4];
assert.equal(canMark(closingGame.sheets.p1, "red", 12, closingGame.closedRows), true);
assert.equal(canMark(closingGame.sheets.p2, "red", 12, closingGame.closedRows), false);

closingGame = rollQwixx(closingGame, "p1", closingDice);
closingGame = submitWhiteChoice(closingGame, "p1", "red");
closingGame = submitWhiteChoice(closingGame, "p2", null);
assert.deepEqual(closingGame.closedRows, ["red"]);
assert.deepEqual(closingGame.sheets.p1.locks, ["red"]);
assert.equal(sheetScore(closingGame.sheets.p1), 28, "Sechs Kreuze plus Schloss ergeben 28 Punkte");
assert.deepEqual(
  sheetScoreBreakdown(closingGame.sheets.p1),
  { colors: { red: 28, yellow: 0, green: 0, blue: 0 }, failedThrowPenalty: 0, total: 28 },
  "Die Endabrechnung weist jede Farbe einzeln aus"
);

closingGame = submitColorChoice(closingGame, "p1", null);
closingGame.sheets.p2.marks.yellow = [0, 1, 2, 3, 4];
closingGame = rollQwixx(closingGame, "p2", closingDice);
closingGame = submitWhiteChoice(closingGame, "p1", null);
closingGame = submitWhiteChoice(closingGame, "p2", "yellow");
assert.equal(closingGame.phase, "finished", "Zwei geschlossene Reihen beenden die Partie");

let penaltyGame = createQwixxGame(players);
const lowDice: QwixxDice = {
  white: [1, 1],
  colors: { red: 1, yellow: 1, green: 1, blue: 1 }
};
penaltyGame = rollQwixx(penaltyGame, "p1", lowDice);
penaltyGame = submitWhiteChoice(penaltyGame, "p1", null);
penaltyGame = submitWhiteChoice(penaltyGame, "p2", null);
penaltyGame = submitColorChoice(penaltyGame, "p1", null);
assert.equal(penaltyGame.sheets.p1.failedThrows, 1);
assert.equal(sheetScore(penaltyGame.sheets.p1), -5);

let endByPenalty = createQwixxGame(players);
for (let turn = 0; turn < 7; turn += 1) {
  const active = activePlayerId(endByPenalty);
  endByPenalty = rollQwixx(endByPenalty, active, lowDice);
  endByPenalty = submitWhiteChoice(endByPenalty, "p1", null);
  endByPenalty = submitWhiteChoice(endByPenalty, "p2", null);
  endByPenalty = submitColorChoice(endByPenalty, active, null);
}
assert.equal(endByPenalty.sheets.p1.failedThrows, 4);
assert.equal(endByPenalty.phase, "finished", "Der vierte Fehlwurf beendet die Partie");

console.log("Qwixx-Regeltests erfolgreich: Reihenfolge, gemeinsame Aktion, Farbaktion, Schloss, Wertung, Fehlwürfe und Spielende");
