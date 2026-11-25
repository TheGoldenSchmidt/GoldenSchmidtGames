import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction, type PartyGame } from "../shared/party";
import { goalField, stationsOf } from "../shared/partyBoard";

const JAYSPOT = goalField({ mode: "roll-it-up" }), STATIONS = stationsOf({ mode: "roll-it-up" });
import { unityRollAction, unityRollBoard, unityRollState } from "../src/unityRollItUp";
import { boardGame, settleMovement } from "./party-fixtures";

// The Unity board for Roll It Up! only draws and sends decisions; the rules stay in shared/party.ts.
const players = [{ id: "a", name: "Ada", characterId: "rig_amara" as const }, { id: "b", name: "Ben", bot: true }];
const make = () => boardGame(players, { rounds: 5 }, true, 17, 100000, "roll-it-up");
const extra = { serverNow: 100000, busy: false, connected: true, error: "", reduced: false };

// Static board: every field once, positions inside the bowl, stations and the Jayspot marked.
const board = unityRollBoard();
assert.equal(board.fields.length, JAYSPOT + 1);
assert.ok(board.fields.every(f => Math.abs(f.x) <= 1 && Math.abs(f.z) <= 1));
assert.deepEqual(board.fields.filter(f => f.type === "station").map(f => f.id), STATIONS.map(s => s.field));
assert.equal(board.fields[JAYSPOT].type, "jayspot");
assert.equal(board.fields[0].type, "start");
assert.deepEqual(board.fields[8].next, [9, 30]);
assert.ok(board.fields.every(f => f.next.every(n => n >= 0 && n <= JAYSPOT)));
// Flat data for Unity's JsonUtility: no maps, no undefined values.
const plain = (value: unknown): boolean => value === null ? false : Array.isArray(value) ? value.every(plain) : typeof value === "object" ? Object.values(value as object).every(plain) : value !== undefined;
assert.ok(plain(board), "Brett ohne leere Werte");
assert.equal(board.board, "bauschale");
assert.deepEqual(board.tunnels, []);
// The Grinder: board id for the scenery, each pneumatic tube once, tube fields typed for the symbol.
const grinder = unityRollBoard({ mode: "roll-it-up", options: { rounds: 8, board: "grinder" as const } });
assert.equal(grinder.board, "grinder");
assert.equal(grinder.name, "Der Grinder");
assert.deepEqual(grinder.tunnels, [7, 19, 33, 39]);
assert.ok(grinder.tunnels.every(id => grinder.fields[id].type === "tunnel"));
assert.equal(grinder.fields[goalField({ mode: "roll-it-up", options: { rounds: 8, board: "grinder" as const } })].type, "jayspot");
assert.ok(plain(grinder), "Grinder ohne leere Werte");

let g: PartyGame = make();
const active = activePartyPlayer(g).id, other = g.players.find(p => p.id !== active)!.id;
assert.equal(g.phase, "turn");
let state = unityRollState(g, active, extra);
assert.ok(plain(state), "Zustand ohne leere Werte");
assert.equal(state.canAct, true);
assert.equal(unityRollState(g, other, extra).canAct, false);
assert.equal(state.players.length, 2);
assert.equal(state.players.find(p => p.id === "a")!.characterId, "rig_amara");
assert.equal(state.diceKey, "");
assert.equal(state.moving, false);
assert.ok(STATIONS.some(s => s.field === state.objectiveField), "Ziel ist die nächste fehlende Station");

// Only board decisions of the own turn pass; everything else is dropped before the room authority.
assert.deepEqual(unityRollAction(g, active, { type: "roll" }), { type: "roll" });
assert.equal(unityRollAction(g, other, { type: "roll" }), undefined, "Fremder Zug");
assert.equal(unityRollAction(g, active, { type: "next" }), undefined, "Falsche Phase");
assert.equal(unityRollAction(g, active, { type: "abort" }), undefined, "Keine Raumsteuerung aus Unity");
assert.equal(unityRollAction(g, active, { type: "item", index: 0 }), undefined, "Items über das App-Inventar");
assert.equal(unityRollAction(g, active, "roll"), undefined);

// Rolling: the snapshot carries the authoritative dice and step timings for the walk.
g = applyPartyAction(g, active, unityRollAction(g, active, { type: "roll" })!, 100000);
state = unityRollState(g, active, extra);
assert.equal(state.phase, "moving");
assert.equal(state.moving, true);
assert.ok(state.diceKey.length > 0 && state.dice.length === 1);
assert.ok(state.arriveAt > state.departAt && state.moveTo === state.players.find(p => p.active)!.position + 1);
assert.ok(state.status.includes("Schritt"));

// Fork: every choice comes with its preview route from the current field.
const fork = make(), forkPlayer = activePartyPlayer(fork);
forkPlayer.position = 7; forkPlayer.supplies = [7];
let at8 = applyPartyAction(fork, forkPlayer.id, { type: "roll" }, 100000);
at8.steps = 4; at8.movement = { destination: 8, departAt: 100000, arriveAt: 100300 };
at8 = settleMovement(at8);
assert.equal(at8.phase, "path");
state = unityRollState(at8, forkPlayer.id, extra);
assert.deepEqual(state.paths.map(p => p.field), [9, 30]);
assert.ok(state.paths.every(p => p.route[0] === 8 && p.route.length >= 2));
assert.deepEqual(unityRollAction(at8, forkPlayer.id, { type: "path", destination: 30 }), { type: "path", destination: 30 });

// Station purchase and the shop only offer what the rules allow.
const shop = make(), shopper = activePartyPlayer(shop);
shop.phase = "shop";
state = unityRollState(shop, shopper.id, extra);
assert.equal(state.shop.length, 5);
assert.equal(unityRollAction(shop, shopper.id, { type: "shop", item: "rocket" }), undefined, "Unbekanntes Item");
assert.deepEqual(unityRollAction(shop, shopper.id, { type: "shop", item: "" }), { type: "shop" });
assert.deepEqual(unityRollAction(shop, shopper.id, { type: "shop", item: "sprint", replace: 1 }), { type: "shop", item: "sprint", replace: 1 });

console.log("Unity-Brücke Roll It Up! erfolgreich: Brett, Zustand, Bewegung, Gabelung, Shop und Aktionsprüfung");

// Every Unity catalog entry, including pending WebGL releases, has a loadable source scene.
{
  const { readFileSync } = await import("node:fs");
  const { UNITY_GAME_CATALOG, UNITY_GAMES, isUnityGame, unityGameUrl } = await import("../src/unityGames");
  const root = new URL("../unity/GoldenSchmidtUnity/", import.meta.url);
  const switchSource = readFileSync(new URL("Assets/GSG/Scripts/Runtime/Common/GameSwitch.cs", root), "utf8");
  const buildSettings = readFileSync(new URL("ProjectSettings/EditorBuildSettings.asset", root), "utf8").replaceAll("\r\n", "\n");
  const { UNITY_MATCH_SCENES } = await import("../src/unityMatch");
  const ids = [...UNITY_GAME_CATALOG.map(game => game.id), "rollitup"];
  // Unity renderings of room matches need their scene in the build too.
  for (const id of new Set(Object.values(UNITY_MATCH_SCENES))) if (!ids.includes(id)) ids.push(id);
  assert.equal(new Set(ids).size, ids.length, "Unity-IDs eindeutig");
  for (const id of ids) {
    const match = switchSource.match(new RegExp(`\\{ "${id}", "([A-Za-z]+)" \\}`));
    assert.ok(match, `${id}: Szene in GameSwitch`);
    const scenePath = `Assets/GSG/Scenes/${match[1]}.unity`;
    const meta = readFileSync(new URL(`${scenePath}.meta`, root), "utf8");
    const guid = /guid: ([a-f0-9]{32})/.exec(meta)?.[1];
    assert.ok(guid, `${id}: gültige Szenen-GUID`);
    assert.ok(buildSettings.includes(`- enabled: 1\n    path: ${scenePath}\n    guid: ${guid}`), `${id}: aktive Szene im Build-Projekt`);
    assert.match(readFileSync(new URL(scenePath, root), "utf8"), /^%YAML/m);
  }
  for (const game of UNITY_GAME_CATALOG) assert.equal(isUnityGame(game.id), !("pendingBuild" in game), `${game.id}: Galerie folgt dem Build-Stand`);
  assert.equal(unityGameUrl("sumo", "rig_lena", true), "/unity/spiele/index.html?spiel=sumo&figur=rig_lena&ruhig=1");
  console.log(`Unity-Spielliste erfolgreich: ${ids.length} Quellszenen, ${UNITY_GAMES.length} Spiele in der Galerie`);
}

// Unity runs: the exported course data matches the current parcours courses.
{
  const { readFileSync } = await import("node:fs");
  const { flatCourse, UNITY_COURSE_DIR, UNITY_COURSE_IDS } = await import("./unity-export-courses");
  for (const id of UNITY_COURSE_IDS) {
    const stored = JSON.parse(readFileSync(new URL(`${id}.json`, UNITY_COURSE_DIR), "utf8"));
    assert.deepEqual(stored, JSON.parse(JSON.stringify(flatCourse(id))), `${id}: Unity-Strecke veraltet – npx tsx scripts/unity-export-courses.ts`);
  }
  console.log(`Unity-Strecken aktuell: ${UNITY_COURSE_IDS.length} Läufe`);
}
