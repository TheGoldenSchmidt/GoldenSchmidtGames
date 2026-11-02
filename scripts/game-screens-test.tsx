import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createKribbelnGame } from "../shared/kribbeln";
import { createQwixxGame } from "../shared/qwixx";
import { createDurakGame } from "../shared/durak";
import { KribbelnGameScreen } from "../src/screens/KribbelnGameScreen";
import { QwixxGameScreen } from "../src/screens/QwixxGameScreen";
import { DurakGameScreen } from "../src/screens/DurakGameScreen";
import type { RoomState } from "../shared/types";

const players = [{ id: "a", name: "Anna" }, { id: "b", name: "Ben" }];
// tsx verwendet außerhalb des Vite-Builds den klassischen JSX-Laufzeitpfad.
Object.assign(globalThis, { React });
const profile = { id: "a", username: "Anna" };
const room: RoomState = { code: "ABCDE", hostId: "a", players: players.map(p => ({ ...p, connected: true, ready: true, score: 0 })), config: { gameId: "kribbeln", playerCount: 2 }, phase: "playing" };
const exit = () => {};
room.kribbelnGame = createKribbelnGame(players);
assert.match(renderToString(<KribbelnGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Würfeln/);
room.kribbelnGame.finished = true; room.kribbelnGame.row = 10; room.kribbelnGame.winners = ["a"];
assert.match(renderToString(<KribbelnGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Partie beendet/);
room.game = createQwixxGame(players); room.game.phase = "finished"; room.game.winnerIds = ["a"];
assert.match(renderToString(<QwixxGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Fehlwürfe/);
room.durakGame = createDurakGame(players); room.durakGame.phase = "finished"; room.durakGame.durakId = "b";
assert.match(renderToString(<DurakGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Ben ist der Durak/);
console.log("Spieloberflächen erfolgreich: Start und Endansichten ohne Renderfehler");
