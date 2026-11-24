import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction, createPartyGame, partyOptions, tickParty, type PartyGame } from "../shared/party";
import { boardDistances, goalField, partyBoard, ROLL_BOARD_IDS, ROLL_BOARDS, rollBoard, shopFields, stationsOf } from "../shared/partyBoard";
import { botBoardAction } from "../shared/partyBots";

// Every board: valid links, everything reachable from the start, the goal only at the end.
for (const id of ROLL_BOARD_IDS) {
  const board = ROLL_BOARDS[id], state = { mode: "roll-it-up" as const, options: { rounds: 8, board: id } };
  assert.equal(rollBoard(state).id, id);
  board.fields.forEach((f, i) => {
    assert.equal(f.id, i, `${id}: Feld ${i} am richtigen Platz`);
    assert.ok(f.x > 5 && f.x < 95 && f.y > 5 && f.y < 95, `${id}: Feld ${i} liegt in der Schale`);
    for (const n of f.next) assert.ok(board.fields[n], `${id}: Verbindung ${i} → ${n}`);
    if (i !== board.goal) assert.ok(f.next.length > 0, `${id}: Feld ${i} führt weiter`);
  });
  assert.equal(board.fields[board.goal].next.length, 0);
  assert.equal(board.stations.length, 6); assert.equal(new Set(board.stations.map(s => s.field)).size, 6);
  for (const [from, to] of Object.entries(board.tunnels)) { assert.equal(board.fields[Number(from)].type, "tunnel"); assert.equal(board.tunnels[to], Number(from), `${id}: Rohrpost paarweise`); }
  const full = { position: 0, supplies: board.stations.map(s => s.field) }, none = { position: 0, supplies: [] };
  for (const f of board.fields) if (f.id !== board.goal) {
    const reach = boardDistances(state, { ...none, position: f.id });
    for (const s of board.stations) assert.ok(reach.has(s.field), `${id}: Station ${s.name} von Feld ${f.id} erreichbar`);
    assert.ok(!reach.has(board.goal), `${id}: Ziel ohne Set gesperrt (Feld ${f.id})`);
    assert.ok(boardDistances(state, { ...full, position: f.id }).has(board.goal), `${id}: Ziel mit Set erreichbar (Feld ${f.id})`);
  }
}

// The Grinder offers far more choices than the Bauschale.
const forks = (id: "bauschale" | "grinder") => ROLL_BOARDS[id].fields.filter(f => f.next.length > 1).length;
assert.ok(forks("grinder") >= 2 * forks("bauschale"), `Grinder ${forks("grinder")} Gabelungen, Bauschale ${forks("bauschale")}`);

// Options: the board is stored for Roll It Up!; unknown boards are refused.
assert.deepEqual(partyOptions({ rounds: 8, board: "grinder" }), { rounds: 8, classic: true, board: "grinder" });
assert.deepEqual(partyOptions({ rounds: 8, board: "bauschale" }), { rounds: 8, classic: true });
assert.throws(() => partyOptions({ rounds: 8, board: "mond" as never }));

// Rohrpost: landing on a tube field sends the figure to its partner.
let now = 100000;
function grinderGame(seed = 5) {
  let g = createPartyGame([{ id: "a", name: "Ada" }, { id: "b", name: "Ben" }], { rounds: 8, board: "grinder" }, true, seed, now, "roll-it-up");
  g = structuredClone(g); g.opening = false; g.mini = undefined; g.phase = "turn"; g.turn = 0;
  return g;
}
let g = grinderGame();
const p = activePartyPlayer(g); p.position = 6;
// A random state whose first die roll is a 1 (same generator as the room).
for (let r = 0; ; r++) if (Math.floor(((Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296 * 6) === 0) { g.rng = r; break; }
g = applyPartyAction(g, p.id, { type: "roll" }, now);
for (let i = 0; i < 20 && g.phase === "moving"; i++) g = tickParty(g, g.movement!.arriveAt);
assert.equal(activePartyPlayer(g).position, 19, "Rohrpost 7 → 19");
assert.match(g.log.join("\n"), /Rohrpost zu Feld 19/);

// Compass: only the board's own shops are valid destinations.
assert.deepEqual(shopFields({ mode: "roll-it-up", options: { rounds: 8, board: "grinder" } }), [12, 21]);
g = grinderGame(); activePartyPlayer(g).items = ["compass"];
assert.throws(() => applyPartyAction(g, activePartyPlayer(g).id, { type: "item", index: 0, destination: 6 }, now));
g = applyPartyAction(g, activePartyPlayer(g).id, { type: "item", index: 0, destination: 21 }, now);
assert.equal(activePartyPlayer(g).position, 21);

// Complete bot games on the Grinder end at the lounge with a full set.
const rounds: number[] = [];
for (const n of [2, 4, 6]) for (let seed = 1; seed <= 8; seed++) {
  let game: PartyGame = createPartyGame(Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), { rounds: 8, board: "grinder" }, true, seed * 13 + n, now, "roll-it-up");
  let guard = 0, rnd = seed * 7919;
  const r = () => { rnd = (rnd * 1103515245 + 12345) >>> 0; return rnd / 2 ** 32; };
  while (game.phase !== "finished" && guard++ < 20000) {
    now += 50;
    if (game.phase === "mini-intro") { game.mini!.id = "dash"; for (const q of game.players) if (game.phase === "mini-intro") game = applyPartyAction(game, q.id, { type: "ready" }, now); continue; }
    if (game.phase === "mini-play") { now = game.mini!.startAt + 100; for (const q of game.players) { game.mini!.runs[q.id].score = Math.floor(r() * 100); game.mini!.runs[q.id].lastInput = now; } for (const q of game.players) if (game.phase === "mini-play") game = applyPartyAction(game, q.id, { type: "finish" }, now); continue; }
    if (game.phase === "mini-result") { for (const q of game.players) if (game.phase === "mini-result") game = applyPartyAction(game, q.id, { type: "next" }, now); continue; }
    if (game.phase === "moving") { game = tickParty(game, game.movement!.arriveAt); continue; }
    const action = botBoardAction(game); assert.ok(action, game.phase);
    game = applyPartyAction(game, activePartyPlayer(game).id, action, now);
    assert.ok(game.players.every(q => q.position >= 0 && q.position < partyBoard(game).length));
  }
  assert.equal(game.phase, "finished", `Grinder ${n} Spieler, Seed ${seed}`);
  const winner = game.players.find(q => q.id === game.winners[0])!;
  assert.equal(winner.position, goalField(game)); assert.equal(winner.supplies!.length, stationsOf(game).length);
  rounds.push(game.round);
}
rounds.sort((a, b) => a - b);
console.log(`Roll-It-Up-Bretter erfolgreich: Verbindungen, Erreichbarkeit, Zielsperre, ${forks("grinder")} Gabelungen im Grinder (Bauschale ${forks("bauschale")}), Rohrpost, Kompass-Shops und ${rounds.length} Bot-Partien (Runden Median ${rounds[rounds.length >> 1]}).`);
