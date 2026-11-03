import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createKribbelnGame } from "../shared/kribbeln";
import { createQwixxGame } from "../shared/qwixx";
import { createDurakGame } from "../shared/durak";
import { KribbelnGameScreen } from "../src/screens/KribbelnGameScreen";
import { KribbelnDice } from "../src/components/KribbelnDice";
import { QwixxGameScreen } from "../src/screens/QwixxGameScreen";
import { DurakGameScreen } from "../src/screens/DurakGameScreen";
import type { RoomState } from "../shared/types";
import { InstallPrompt } from "../src/components/InstallPrompt";
import { PartyGameScreen } from "../src/screens/PartyGameScreen";
import { createPartyGame, createPartyPractice, publicParty } from "../shared/party";
import { PartyMini } from "../src/components/PartyMini";
import { ACTION_MINI_IDS } from "../shared/partyArena";
import { LocalSetupScreen } from "../src/screens/LocalSetupScreen";

const players = [{ id: "a", name: "Anna" }, { id: "b", name: "Ben" }];
// tsx verwendet außerhalb des Vite-Builds den klassischen JSX-Laufzeitpfad.
Object.assign(globalThis, { React });
const profile = { id: "a", username: "Anna" };
const room: RoomState = { code: "ABCDE", hostId: "a", players: players.map(p => ({ ...p, connected: true, ready: true, score: 0 })), config: { gameId: "kribbeln", playerCount: 2 }, phase: "playing" };
const exit = () => {};
room.kribbelnGame = createKribbelnGame(players);
const startScreen = renderToString(<KribbelnGameScreen profile={profile} initialRoom={room} onExit={exit} />);
assert.match(startScreen, /Würfeln/);
assert.match(startScreen.replace(/<!--.*?-->/g, ""), /Runde 1 \/ 10/);
assert.match(startScreen, /Würfelkiste/);
assert.equal((startScreen.match(/kribbel-die-placeholder/g) ?? []).length, 6);
const dice = renderToString(<KribbelnDice dice={Array.from({length: 6}, (_, i) => ({ color: "green", value: i + 1 }))} kept={[0, 2]} disabled={false} rollKey="1" onToggle={() => {}} />);
assert.equal((dice.match(/aria-pressed="true"/g) ?? []).length, 2);
assert.equal((dice.match(/die-face die-face--/g) ?? []).length, 36);
assert.match(dice, /Grün 1/);
assert.match(dice, /✓ Bleibt/);
room.kribbelnGame.finished = true; room.kribbelnGame.row = 10; room.kribbelnGame.winners = ["a"];
assert.match(renderToString(<KribbelnGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Partie beendet/);
room.game = createQwixxGame(players); room.game.phase = "finished"; room.game.winnerIds = ["a"];
assert.match(renderToString(<QwixxGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Fehlwürfe/);
room.durakGame = createDurakGame(players); room.durakGame.phase = "finished"; room.durakGame.durakId = "b";
assert.match(renderToString(<DurakGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Ben ist der Durak/);
room.partyGame=createPartyGame(players,{rounds:5},true,123);
const partyStart=renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>);
assert.match(partyStart,/Inselparty/);assert.match(partyStart,/Inselkarte/);assert.match(partyStart,/Trophäenstand/);
room.partyGame.phase="finished";room.partyGame.winners=["a"];
assert.match(renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>),/Die Insel feiert euch/);
for(const id of ["targets","colors","memory","timing","trail","risk",...ACTION_MINI_IDS] as const){const practice=createPartyPractice(id);assert.ok(renderToString(<PartyMini game={publicParty(practice,"practice")} id="practice" now={Date.now()} send={()=>{}}/>).length>100);}
const localSetup=renderToString(<LocalSetupScreen onBack={exit} onStart={exit}/>);assert.doesNotMatch(localSetup,/Inselparty/);assert.match(localSetup,/Qwixx/);
// Ohne beforeinstallprompt muss die Installationshilfe trotzdem erreichbar bleiben.
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
try {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Android Chrome", platform: "Linux", maxTouchPoints: 1 } });
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
  assert.match(renderToString(<InstallPrompt />), /Als App installieren/);
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "iPhone Safari", platform: "iPhone", maxTouchPoints: 1 } });
  assert.match(renderToString(<InstallPrompt />), /Als App installieren/);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: true }) } });
  assert.equal(renderToString(<InstallPrompt />), "", "In der App-Ansicht keine erneute Installation anbieten");
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator); else Reflect.deleteProperty(globalThis, "navigator");
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow); else Reflect.deleteProperty(globalThis, "window");
}
console.log("Spieloberflächen erfolgreich: Start und Endansichten ohne Renderfehler");
