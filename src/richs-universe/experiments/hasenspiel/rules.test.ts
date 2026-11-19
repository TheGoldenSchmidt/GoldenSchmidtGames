import assert from "node:assert/strict";
import { CENTER, cells, deerLine, movesFrom, newGame, play, type Color, type Game, type Kind } from "./rules";

const piece = (id: string, color: Color = "blue", kind: Kind = "rabbit") => ({ id, color, kind });
const moves = (game: Game, id: string) => movesFrom(game, cells.find(cell => cell.id === id)!);

for (const level of [1, 2, 3] as const) {
  const game = newGame(level);
  for (const color of ["blue", "gray"] as const) {
    const team = Object.values(game.board).filter(member => member?.color === color);
    assert.equal(team.length, 16);
    assert.equal(team.filter(member => member?.kind === "deer").length, level === 3 ? 2 : 0);
    assert.equal(team.filter(member => member?.kind === "monkey").length, level === 3 ? 2 : 0);
  }
}

const lateral: Game = { ...newGame(2), board: { "3:-2": piece("rabbit") } };
assert.deepEqual(moves(lateral, "3:-2"), [{ to: "3:-1" }]);
assert.deepEqual(moves({ ...lateral, level: 1 }, "3:-2"), []);

const trio: Game = { ...newGame(2), board: {
  [CENTER]: piece("attacker"),
  "7:-1": piece("left", "gray"),
  "7:0": piece("middle", "gray"),
  "7:1": piece("right", "gray")
} };
assert.equal(moves(trio, CENTER).some(move => move.capture === "7:0"), false);
assert.equal(moves({ ...trio, level: 1 }, CENTER).some(move => move.capture === "7:0"), true);

const double: Game = { ...newGame(3), board: {
  "3:-2": piece("attacker"), "3:-3": piece("ally"), "4:-2": piece("enemy", "gray")
} };
const jumped = play(double, "3:-2", "5:-2");
assert.equal(jumped.board["5:-2"]?.id, "attacker");
assert.equal(jumped.board["3:-3"]?.id, "ally");
assert.equal(jumped.board["4:-2"], undefined);
assert.deepEqual(jumped.previous.blue, { mover: "attacker", crossed: "ally" });
assert.equal(moves({ ...double, level: 2 }, "3:-2").some(move => move.via), false);

const deer: Game = { ...newGame(3), board: {
  "4:-3": piece("left", "blue", "deer"), "4:3": piece("right", "blue", "deer"),
  "4:0": piece("trapped", "gray"), "4:4": piece("outside", "gray")
} };
const fenced = play(deer, "4:3", "4:2");
assert.deepEqual(fenced.frozen, []);
const activated = play({ ...deer, board: { ...deer.board, "4:-4": deer.board["4:-3"], "4:-3": undefined } }, "4:3", "4:2");
assert.equal(deerLine(activated.board, "blue").between.length, 5);
assert.deepEqual(activated.frozen, []);

// Moving from seven intervening fields to six activates the line and immobilizes a rabbit once.
const wide: Game = { ...newGame(3), board: {
  "4:-4": piece("left", "blue", "deer"), "4:4": piece("right", "blue", "deer"),
  "4:1": piece("trapped", "gray"), "4:0": piece("inside", "gray")
} };
const blocked = play(wide, "4:4", "4:3");
assert.deepEqual(blocked.frozen, ["inside", "trapped"]);
assert.deepEqual(moves(blocked, "4:1"), []);
const afterPass = play(blocked);
assert.deepEqual(afterPass.frozen, []);
assert.ok(moves({ ...afterPass, turn: "gray" }, "4:1").some(move => move.to === "3:1"));
assert.ok(!moves({ ...afterPass, turn: "gray" }, "4:1").some(move => move.to === "4:0"));

const monkey: Game = { ...newGame(3), board: {
  "5:-4": piece("monkey", "blue", "monkey"),
  "5:-3": piece("first", "gray"), "5:-1": piece("second", "gray")
} };
const hung = play(monkey, "5:-4", "5:0");
assert.equal(hung.board["5:0"]?.id, "monkey");
assert.equal(hung.board["5:-3"]?.id, "first");
assert.equal(hung.board["5:-1"]?.id, "second");
assert.equal(moves({ ...monkey, board: {
  ...monkey.board, "5:-1": undefined, "5:0": piece("second", "gray")
} }, "5:-4").some(move => move.to === "5:1"), false);
assert.ok(moves({ ...monkey, board: { "5:-4": monkey.board["5:-4"] } }, "5:-4").some(move => move.to === "4:-4"));

console.log("Hasenspiel: Stufen 1–3 geprüft");
