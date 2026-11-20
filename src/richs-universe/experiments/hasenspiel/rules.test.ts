import assert from "node:assert/strict";
import { botLevels, botTurn } from "./bot";
import { CENTER, cells, wallFields, movesFrom, newGame, nextPositions, play, type Color, type Game, type Kind } from "./rules";

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

for (const level of [1, 2, 3] as const) {
  for (const [turn, from, to] of [["blue", 5, 7], ["gray", 7, 5]] as const) {
    for (const x of [-5, -4, -3, 3, 4, 5]) {
      const start = `${from}:${x}`;
      const end = `${to}:${x}`;
      const game = { ...newGame(level), turn, board: { [start]: piece("crossing", turn) } };
      assert.equal(play(game, start, end).board[end]?.id, "crossing");
      assert.ok(!moves(game, start).some(move => move.to === CENTER));
      assert.ok(!moves(game, start).some(move => move.to === `${to}:${x + 1}`));
    }
    for (const x of [-2, -1, 0, 1, 2]) {
      const start = `${from}:${x}`;
      const game = { ...newGame(level), turn, board: { [start]: piece("central", turn) } };
      assert.ok(moves(game, start).some(move => move.to === CENTER));
      assert.ok(!moves(game, start).some(move => move.to === `${to}:${x}`));
    }
  }
}

const crossingJump: Game = { ...newGame(), board: {
  "5:3": piece("attacker"), "7:3": piece("defender", "gray")
} };
const crossed = play(crossingJump, "5:3", "7:4");
assert.equal(crossed.board["7:4"]?.id, "attacker");
assert.equal(crossed.board["7:3"], undefined);

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

for (const field of ["3:-3", "3:3", "9:-3", "9:3"]) {
  assert.equal(newGame(3).board[field]?.kind, "deer");
}

const runner: Game = { ...newGame(3), board: {
  "4:0": piece("runner", "blue", "deer"),
  "4:-2": piece("obstacle", "gray"), "4:4": piece("jumper", "gray", "monkey")
} };
const targets = moves(runner, "4:0").map(move => move.to);
for (const field of ["4:-1", "4:1", "4:2", "4:3", "3:0", "5:0", "3:1", "5:-1"]) {
  assert.ok(targets.includes(field), field);
}
for (const field of ["4:-2", "4:-3", "4:4"]) assert.ok(!targets.includes(field), field);
assert.deepEqual(play(runner, "4:0", "4:2").restingDeer, []);
const rested = play(runner, "4:0", "4:3");
assert.deepEqual(rested.restingDeer, ["runner"]);
assert.ok(!moves(rested, "4:4").some(move => move.capture === "4:3"));
const reply = play(rested, "4:4", "5:4");
assert.equal(reply.turn, "blue");
assert.deepEqual(moves(reply, "4:3"), []);
const afterRest = play(reply);
assert.deepEqual(afterRest.restingDeer, []);
assert.ok(moves({ ...afterRest, turn: "blue" }, "4:3").length > 0);

const wallSetup: Game = { ...newGame(3), board: {
  "4:-4": piece("left", "blue", "deer"), "3:2": piece("right", "blue", "deer"),
  "4:-2": piece("blue-inside", "blue", "monkey"), "4:1": piece("gray-inside", "gray", "monkey"),
  "3:-1": piece("blue-reserve"), "9:1": piece("gray-reserve", "gray")
} };
const formed = play(wallSetup, "3:2", "4:3");
assert.deepEqual([...wallFields(formed.board)], ["4:-3", "4:-2", "4:-1", "4:0", "4:1", "4:2"]);
assert.deepEqual(formed.frozen, ["gray-inside"]);
assert.equal(wallFields({
  ...formed.board, "4:3": piece("right", "gray", "deer")
}).size, 0);
assert.deepEqual(moves(formed, "4:1"), []);
const grayMoved = play(formed, "9:1", "8:1");
assert.deepEqual(grayMoved.frozen, []);
assert.ok(moves(grayMoved, "4:-2").some(move => move.to === "5:-2"));
assert.ok(moves(grayMoved, "3:-1").some(move => move.to === "4:-1"));
const blueMoved = play(grayMoved, "3:-1", "4:-4");
assert.equal(blueMoved, grayMoved);
const thawed = play(grayMoved, "4:3", "5:3");
assert.deepEqual(thawed.frozen, []);
assert.equal(wallFields(thawed.board).size, 0);
const stillWall = { ...formed, frozen: [] };
assert.ok(moves(stillWall, "4:1").some(move => move.to === "4:2"));
assert.ok(!moves(stillWall, "4:1").some(move => move.to === "3:1"));

const traverseWall: Game = { ...newGame(3), board: {
  "4:-4": piece("left", "gray", "deer"), "4:4": piece("right", "gray", "deer"),
  "3:-2": piece("climber", "blue", "monkey"),
  "3:-1": piece("hold"), "4:-1": piece("wall-hold", "gray"), "4:0": piece("next-hold")
} };
assert.ok(moves(traverseWall, "3:-2").some(move => move.to === "5:0" && !move.capture));
assert.ok(!moves({ ...traverseWall, board: { ...traverseWall.board,
  "3:-2": piece("rabbit")
} }, "3:-2").some(move => move.to === "5:0"));

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

for (const [color, from, across, obstacle] of [
  ["blue", "5:0", "7:0", "8:0"],
  ["gray", "7:0", "5:0", "4:0"]
] as const) {
  const game: Game = { ...newGame(3), turn: color, board: {
    [from]: piece("runner", color, "deer"), [obstacle]: piece("obstacle")
  } };
  assert.equal(play(game, from, across).board[across]?.id, "runner");
  assert.ok(!moves(game, from).some(move => move.to === obstacle));
  const occupied = { ...game, board: { ...game.board, [across]: piece("blocker") } };
  assert.ok(moves(occupied, from).some(move => move.to === CENTER));
  assert.ok(!moves(occupied, from).some(move => move.to === across));
}

for (const level of [1, 2, 3] as const) {
  const game: Game = { ...newGame(level), turn: "gray" };
  for (const strength of botLevels) {
    const next = botTurn(game, strength, () => 0);
    assert.ok(nextPositions(game).some(position => JSON.stringify(position) === JSON.stringify(next)));
    assert.equal(next.turn, "blue");
    const blocked: Game = { ...game, board: {} };
    assert.equal(botTurn(blocked, strength).passes, 1);
    const finished: Game = { ...game, result: "blue" };
    assert.equal(botTurn(finished, strength), finished);
  }
}

const threat: Game = { ...newGame(2), turn: "gray", held: 2, board: {
  [CENTER]: piece("leader"), "7:0": piece("defender", "gray"), "7:4": piece("reserve", "gray")
} };
for (const strength of ["Mittel", "Schwer"] as const) {
  assert.equal(botTurn(threat, strength).board[CENTER], undefined);
}

console.log("Hasenspiel: Stufen 1–3 geprüft");
