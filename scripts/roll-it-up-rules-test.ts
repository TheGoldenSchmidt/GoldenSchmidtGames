import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction, publicParty, type PartyAction, type PartyGame } from "../shared/party";
import { hasFullSet, JAYSPOT, partyBoard, partyPaths, STATIONS } from "../shared/partyBoard";
import { botBoardAction } from "../shared/partyBots";
import { boardGame, settleMovement } from "./party-fixtures";

const players = [{id:"a",name:"Ada"},{id:"b",name:"Ben"}];
const make = () => boardGame(players,{rounds:5},true,17,100000,"roll-it-up");
const command = (g:PartyGame, action:PartyAction) => settleMovement(applyPartyAction(g,activePartyPlayer(g).id,action,100000));

function approach(g:PartyGame, field:number) {
  activePartyPlayer(g).position=field-1;
  g.phase="turn"; g.rng=0; // A two-step roll, with one step left at the station.
  return command(g,{type:"roll"});
}
let g=make();
const id=activePartyPlayer(g).id, other=g.players.find(p=>p.id!==id)!;
activePartyPlayer(g).coins=100;
for (const station of STATIONS) {
  g=approach(g,station.field);
  assert.equal(g.phase,"supply");
  assert.equal(g.steps,1);
  assert.throws(()=>applyPartyAction(g,other.id,{type:"supply",buy:true}));
  assert.throws(()=>command(g,{type:"trophy",buy:true}));
  assert.throws(()=>command(g,{type:"supply",buy:1} as unknown as PartyAction));
  const declined=command(g,{type:"supply",buy:false});
  assert.equal(activePartyPlayer(declined).supplies!.length,activePartyPlayer(g).supplies!.length);
  g=command(g,{type:"supply",buy:true});
  assert.equal(activePartyPlayer(g).coins,activePartyPlayer(declined).coins-station.price);
  assert.ok(activePartyPlayer(g).supplies!.includes(station.field));
  assert.equal(g.players.find(p=>p.id===other.id)!.supplies!.length,0);
  assert.notEqual(approach(structuredClone(g),station.field).phase,"supply");
}
assert.ok(hasFullSet(activePartyPlayer(g)));
assert.deepEqual(publicParty(g,id).players.find(p=>p.id===id)!.supplies,STATIONS.map(s=>s.field));
for (const gate of [31,33]) {
  const attempt=structuredClone(g);
  activePartyPlayer(attempt).position=gate;
  attempt.steps=4; attempt.phase="path";
  assert.deepEqual(botBoardAction(attempt),{type:"path",destination:JAYSPOT});
  const win=command(attempt,{type:"path",destination:JAYSPOT});
  assert.equal(win.phase,"finished");
  assert.equal(win.steps,0);
  assert.deepEqual(win.winners,[id]);
  assert.throws(()=>command(win,{type:"roll"}));
  activePartyPlayer(attempt).supplies!.pop();
  assert.ok(!partyPaths(attempt,activePartyPlayer(attempt)).includes(JAYSPOT));
  assert.throws(()=>command(attempt,{type:"path",destination:JAYSPOT}));
}
const poor=make(); activePartyPlayer(poor).coins=0;
assert.notEqual(approach(poor,2).phase,"supply");
const late=make(); late.round=5; late.phase="mini-result";
assert.equal(command(late,{type:"next"}).round,6);
const board=partyBoard(g);
for (const [i,s] of STATIONS.entries()) {
  const a=board[s.field], b=board[STATIONS[(i+1)%6].field];
  assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-39)<1e-9);
}
// Play from the opening to the bench using only legal commands and the room clock.
let match=make();
for(let turns=0;match.phase!=="finished" && turns<1500;turns++) {
  if(match.phase==="mini-intro" || match.phase==="mini-play") {
    const action:PartyAction = match.phase==="mini-intro" ? {type:"ready"} : {type:"finish"};
    // In match games giving up can end the game for everyone before the last player acts.
    const phase=match.phase;
    for(const p of match.players) if(match.phase===phase) match=applyPartyAction(match,p.id,action,100000);
    continue;
  }
  const action=botBoardAction(match);
  assert.ok(action,match.phase);
  match=command(match,action);
}
assert.equal(match.phase,"finished");
assert.equal(activePartyPlayer(match).position,JAYSPOT);
assert.ok(hasFullSet(activePartyPlayer(match)));
assert.deepEqual(match.winners,[activePartyPlayer(match).id]);

console.log("Roll It Up! – Käufe, sechs Stationen, Hügelwege und Sofortsieg geprüft.");
