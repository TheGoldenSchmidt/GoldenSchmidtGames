import {boardGame} from "./party-fixtures";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { createKribbelnGame, KRIBBEL_DICE_FACES, KRIBBEL_ROWS } from "../shared/kribbeln";
import { createQwixxGame } from "../shared/qwixx";
import { createDurakGame } from "../shared/durak";
import { KribbelnGameScreen } from "../src/screens/KribbelnGameScreen";
import { KribbelnDice } from "../src/components/KribbelnDice";
import { KribbelnTask } from "../src/components/KribbelnTask";
import { QwixxGameScreen } from "../src/screens/QwixxGameScreen";
import { QwixxDice } from "../src/components/QwixxDice";
import { DurakGameScreen } from "../src/screens/DurakGameScreen";
import type { RoomState } from "../shared/types";
import { InstallPrompt } from "../src/components/InstallPrompt";
import { PartyGameScreen } from "../src/screens/PartyGameScreen";
import { createPartyGame, createPartyPractice, publicParty } from "../shared/party";
import { PartyMini } from "../src/components/PartyMini";
import { ACTION_MINI_IDS } from "../shared/partyArena";
import { MATCH_IDS, MATCH_MODULES } from "../shared/matches/framework";
import { LocalSetupScreen } from "../src/screens/LocalSetupScreen";
import { MinigameSettings } from "../src/components/MinigameSettings";
import { applyPartyAction } from "../shared/party";

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
assert.match(startScreen, /Würfelbecher schütteln/);
assert.equal((startScreen.match(/data-die-index=/g) ?? []).length, 6);
assert.equal((startScreen.match(/die-face die-face--/g) ?? []).length, 36);
const physicalDice = KRIBBEL_DICE_FACES.map(faces => ({ ...faces[0] }));
const dice = renderToString(<KribbelnDice dice={physicalDice} kept={[0, 2]} disabled={false} rollKey="1" onToggle={() => {}} />);
assert.equal((dice.match(/aria-pressed="true"/g) ?? []).length, 2);
assert.equal((dice.match(/die-face die-face--/g) ?? []).length, 36);
assert.match(dice, /Grün 1/);
assert.match(dice, /✓ Bleibt/);
const fallingDice = renderToString(<KribbelnDice dice={physicalDice} kept={[]} disabled rolling rollKey="2" onToggle={() => {}} />);
assert.equal((fallingDice.match(/kribbel-face-color--/g) ?? []).length, 36);
assert.doesNotMatch(fallingDice, /kribbel-face--hidden|Grün 1|Rot 1/);
assert.match(fallingDice, /Würfel 1 fliegt/);
for (const row of KRIBBEL_ROWS) {
  const task = renderToString(<KribbelnTask task={row.task} label={row.label} dice={physicalDice} rolling previousBest={17} />);
  assert.match(task, /role="img"/); assert.match(task, /data-state="waiting"/);
  assert.doesNotMatch(task, /Aufgabe erfüllt/);
}
room.kribbelnGame.finished = true; room.kribbelnGame.row = 10; room.kribbelnGame.winners = ["a"];
assert.match(renderToString(<KribbelnGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Partie beendet/);
room.game = createQwixxGame(players);
const qwixxStart = renderToString(<QwixxGameScreen profile={profile} initialRoom={room} onExit={exit} />);
assert.match(qwixxStart, /Würfelbecher schütteln/);
assert.equal((qwixxStart.match(/data-die-id=/g) ?? []).length, 6);
assert.equal((qwixxStart.match(/kribbel-face-color--white/g) ?? []).length, 12);
const qwixxDice = renderToString(<QwixxDice dice={{ white: [2, 3], colors: { red: null, yellow: 4, green: 5, blue: 6 } }} closedRows={["red"]} rolling inCup={false} cupRef={{ current: null }} rollKey="1-0-1" />);
assert.equal((qwixxDice.match(/die-face die-face--/g) ?? []).length, 36);
assert.equal((qwixxDice.match(/is-rolling/g) ?? []).length, 5);
assert.match(qwixxDice, /Roter Würfel entfernt/);
assert.doesNotMatch(qwixxDice, /antippen zum Behalten|aria-pressed/);
room.game.phase = "finished"; room.game.winnerIds = ["a"];
assert.match(renderToString(<QwixxGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Fehlwürfe/);
room.durakGame = createDurakGame(players); room.durakGame.phase = "finished"; room.durakGame.durakId = "b";
assert.match(renderToString(<DurakGameScreen profile={profile} initialRoom={room} onExit={exit} />), /Ben ist der Durak/);
room.config.gameId="party";
room.partyGame=boardGame(players,{rounds:5},true,123);
const partyStart=renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>);
assert.match(partyStart,/Inselparty/);assert.match(partyStart,/Inselkarte/);assert.match(partyStart,/Trophäenstand/);
room.partyGame.phase="finished";room.partyGame.winners=["a"];
assert.match(renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>),/Die Insel feiert euch/);
room.config.gameId="roll-it-up";
room.partyGame=boardGame(players,{rounds:5},true,123,100000,"roll-it-up");
room.partyGame.turn=room.partyGame.order.indexOf(profile.id);
room.partyGame.phase="supply";
room.partyGame.players.find(p=>p.id===profile.id)!.position=2;
const purchase=renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>).replace(/<!--.*?-->/g,"");
assert.match(purchase,/Grinder kaufen · 8 Münzen/);
assert.doesNotMatch(purchase,/Trophäe/);
room.partyGame.phase="finished";room.partyGame.winners=[profile.id];
assert.match(renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>).replace(/<!--.*?-->/g,""),/Anna gewinnt Roll It Up!/);
for(const id of ["targets","colors","memory","timing","trail","risk",...ACTION_MINI_IDS] as const){const practice=createPartyPractice(id);assert.ok(renderToString(<PartyMini game={publicParty(practice,"practice")} id="practice" now={Date.now()} send={()=>{}}/>).length>100);}
// Neue Match-Spiele: Bühne mit HUD, Zwischenstand, Spielfeld und Touch-Steuerung (Übung gegen Bots).
for(const id of MATCH_IDS){const practice=createPartyPractice(id),html=renderToString(<PartyMini game={publicParty(practice,"practice")} id="practice" now={practice.mini!.startAt-1000} send={()=>{}}/>);assert.match(html,/match-stage/);assert.match(html,/Zwischenstand/);assert.match(html,new RegExp(MATCH_MODULES[id].meta.name));}
const localSetup=renderToString(<LocalSetupScreen onBack={exit} onStart={exit}/>);assert.doesNotMatch(localSetup,/Inselparty|Roll It Up!/);assert.match(localSetup,/Qwixx/);
for(const mode of ["free-minigame","goldenschmidt"] as const) {
  room.config.gameId=mode;room.partyGame=createPartyGame(players,undefined,true,123,100000,mode,{rounds:1,miniId:"dash"});
  const start=renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>);
  assert.match(start,mode==="goldenschmidt"?/Was setzt du auf deinen Sieg/:/Schatzsprint/);
  assert.doesNotMatch(start,/Trophäen|Münzen aus dem Minispiel|10 · Platz/);
  if(mode==="goldenschmidt") for(const p of players)room.partyGame=applyPartyAction(room.partyGame,p.id,{type:"bet",value:1},100000);
  for(const p of players)room.partyGame=applyPartyAction(room.partyGame,p.id,{type:"ready"},100000);
  for(const p of players)room.partyGame=applyPartyAction(room.partyGame,p.id,{type:"finish"},104000);
  const result=renderToString(<PartyGameScreen profile={profile} initialRoom={room} onExit={exit}/>);
  assert.match(result,/Zurück zu GSG/);assert.doesNotMatch(result,/Die Insel feiert|Trophäen/);
  assert.match(renderToString(<MinigameSettings mode={mode} disabled={false} onChange={exit}/>),mode==="goldenschmidt"?/Anzahl Minispiele/:/Direkt ins Minispiel/);
}
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
