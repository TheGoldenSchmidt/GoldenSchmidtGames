import assert from "node:assert/strict";
import { botLevels, botTurn } from "./bot";
import { CENTER, cells, deerLine, movesFrom, newGame, nextPositions, play, type Color, type Game, type Kind } from "./rules";

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

const sharedTarget: Game = { ...newGame(3), board: {
  "5:-1": piece("monkey", "blue", "monkey"), "5:-2": piece("opponent", "gray")
} };
assert.deepEqual(moves(sharedTarget, "5:-1").filter(move => move.to === CENTER), [
  { to: CENTER }, { to: CENTER, capture: "5:-2" }
]);
assert.equal(play(sharedTarget, "5:-1", CENTER, 0).board["5:-2"]?.id, "opponent");
assert.equal(play(sharedTarget, "5:-1", CENTER, 1).board["5:-2"], undefined);

const hangingRoutes: Game = { ...newGame(3), board: {
  "1:-1": piece("climber", "blue", "monkey"),
  "1:0": piece("upper"), "2:-1": piece("left"), "2:1": piece("right")
} };
assert.deepEqual(moves(hangingRoutes, "1:-1").filter(move => move.to === "2:2"), [
  { to: "2:2", first: "1:0" }, { to: "2:2", first: "2:-1" }
]);
assert.equal(play(hangingRoutes, "1:-1", "2:2", 1).board["2:2"]?.id, "climber");
assert.equal(nextPositions(hangingRoutes).filter(position => position.board["2:2"]?.id === "climber").length, 1);

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

for (const [turn, row, behind, ahead] of [["blue", 5, 4, 7], ["gray", 7, 8, 5]] as const) {
  const start = `${row}:0`;
  const game: Game = { ...newGame(3), turn, board: {
    [start]: piece("runner", turn, "deer"),
    [`${row}:-3`]: piece("blocker", turn)
  } };
  const targets = moves(game, start).map(move => move.to);
  assert.ok(targets.includes(`${row}:-2`));
  assert.ok(targets.includes(`${row}:5`));
  assert.ok(targets.includes(CENTER));
  assert.ok(!targets.includes(`${row}:-3`));
  assert.ok(!targets.includes(`${row}:-4`));
  assert.ok(!targets.includes(`${behind}:0`));

  const across: Game = { ...game, board: { [`${row}:3`]: piece("runner", turn, "deer") } };
  assert.ok(moves(across, `${row}:3`).some(move => move.to === `${ahead}:3`));
  const beyondCenter: Game = { ...game, board: { [`${ahead}:0`]: piece("runner", turn, "deer") } };
  assert.ok(!moves(beyondCenter, `${ahead}:0`).some(move => move.to === CENTER));
}

const chargeProtection: Game = { ...newGame(3), board: {
  "4:-3": piece("runner", "blue", "deer"), "4:1": piece("monkey", "gray", "monkey"),
  "2:-2": piece("blue-rabbit"), "10:2": piece("gray-rabbit", "gray")
} };
const charged = play(chargeProtection, "4:-3", "4:0");
assert.equal(charged.board["4:0"]?.id, "runner");
assert.equal(charged.chargedDeer, "runner");
assert.ok(nextPositions(chargeProtection).some(position => position.chargedDeer === "runner"));
assert.ok(!moves(charged, "4:1").some(move => move.capture === "4:0"));
const afterReply = play(charged, "10:2", "9:2");
assert.equal(afterReply.turn, "blue");
const afterRound = play(afterReply, "2:-2", "3:-2");
assert.equal(afterRound.turn, "gray");
assert.ok(moves(afterRound, "4:1").some(move => move.capture === "4:0"));
assert.equal(play(chargeProtection, "4:-3", "4:-2").chargedDeer, undefined);

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
