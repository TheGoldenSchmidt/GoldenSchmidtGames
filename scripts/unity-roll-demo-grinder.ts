import { writeFileSync } from "node:fs";
import { activePartyPlayer, applyPartyAction, type PartyGame } from "../shared/party";
import { goalField, stationsOf } from "../shared/partyBoard";
import { unityRollBoard, unityRollState } from "../src/unityRollItUp";
import { boardGame } from "./party-fixtures";

/**
 * Writes the Grinder preview of the Unity board (Resources/GSG/RollDemoGrinder.json): the board
 * message and prepared states (turn, walk, spoke fork, station, pneumatic tube, set complete,
 * someone else's turn). Run after changes to src/unityRollItUp.ts or the Grinder fields:
 * npx tsx scripts/unity-roll-demo-grinder.ts
 */
const now = 100000, extra = { serverNow: now, busy: false, connected: true, error: "", reduced: false };
const players = [{ id: "me", name: "Max", characterId: "rig_jonas" as const }, { id: "b1", name: "Ada", bot: true }, { id: "b2", name: "Ben", bot: true }];
const fresh = () => {
  const g = boardGame(players, { rounds: 8, board: "grinder" }, true, 23, now, "roll-it-up");
  g.order = players.map(p => p.id); g.turn = 0; g.phase = "turn";
  for (const p of g.players) { p.coins = 14; p.position = 0; p.supplies = []; }
  return g;
};
const me = (g: PartyGame) => g.players.find(p => p.id === "me")!;
const states = [];

// Turn on the start field with the first station in reach.
let g = fresh(); me(g).position = 1; me(g).supplies = [];
states.push(unityRollState(g, "me", extra));
// Walking: roll, the snapshot carries the step timings.
g = applyPartyAction(g, "me", { type: "roll" }, now);
states.push(unityRollState(g, "me", extra));
// Fork on the outer ring: stay on the ring or take the spoke inwards.
g = fresh(); me(g).position = 5; g.phase = "path"; g.steps = 3; g.dice = [4];
states.push(unityRollState(g, "me", extra));
// Station: buy the Grinder utensil while passing.
g = fresh(); me(g).position = stationsOf(g)[0].field; g.phase = "supply"; g.dice = [3];
states.push(unityRollState(g, "me", extra));
// Pneumatic tube: landed on field 7, the figure is already on the partner field.
g = fresh(); me(g).position = 19; g.phase = "summary"; g.dice = [2]; g.log.push("Max saust durch die Rohrpost zu Feld 19.");
states.push(unityRollState(g, "me", extra));
// Inner ring with the full set: the way to the lounge is open.
g = fresh(); me(g).position = 30; me(g).supplies = stationsOf(g).map(s => s.field); g.phase = "path"; g.steps = 1; g.dice = [1];
states.push(unityRollState(g, "me", extra));
// Someone else's turn.
g = fresh(); g.turn = 1; g.players[1].position = 33;
states.push(unityRollState(g, "me", extra));

if (states.some(s => s.phase === "path" && s.paths.length < 2)) throw new Error("Gabelung ohne Wahl");
if (activePartyPlayer(fresh()).id !== "me" || goalField(g) !== 44) throw new Error("Unerwarteter Grinder-Aufbau");
const target = "unity/GoldenSchmidtUnity/Assets/GSG/Resources/GSG/RollDemoGrinder.json";
writeFileSync(target, JSON.stringify({ board: unityRollBoard(fresh()), states }, null, 1) + "\n");
console.log(`${target}: ${states.length} Zustände (${states.map(s => s.phase).join(", ")})`);
