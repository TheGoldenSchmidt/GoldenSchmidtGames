import assert from "node:assert/strict";
import { createPartyGame, tickParty, activePartyPlayer, applyPartyAction, publicParty, type PartyAction, type PartyGame } from "../shared/party";
import { boardDistances, boardPathTo, boardRoute, hasFullSet, JAYSPOT, partyBoard, partyPaths, STATIONS } from "../shared/partyBoard";
import { botBoardAction, PartyBotDriver } from "../shared/partyBots";
import { boardGame, settleMovement } from "./party-fixtures";

const players = [{id:"a",name:"Ada"},{id:"b",name:"Ben"}];
const make = () => boardGame(players,{rounds:5},true,17,100000,"roll-it-up");
const command = (g:PartyGame, action:PartyAction) => {
 if(g.phase==="mini-result"&&action.type==="next"){for(const p of g.players)if(g.phase==="mini-result"&&!p.passive)g=applyPartyAction(g,p.id,action,100000);return g;}
 return settleMovement(applyPartyAction(g,activePartyPlayer(g).id,action,100000));
};

// Guidance follows the directed game graph and never promises an unavailable goal.
const guide = make(), traveler = activePartyPlayer(guide);
traveler.position=8;traveler.supplies=[2,7,17];
const unchanged=structuredClone(guide);
assert.deepEqual(boardRoute(guide,traveler,9,4).fields,[9,10,11,12]);
assert.deepEqual(boardRoute(guide,traveler,30,4).fields,[30,31,12,13]);
assert.deepEqual(boardRoute(guide,traveler,30,4).stations,[{...STATIONS[2],steps:3,owned:false}]);
assert.equal(boardRoute(guide,traveler,9,12).junction,true);
assert.equal(boardRoute(guide,traveler,9,12).fields.at(-1),18);
assert.deepEqual(boardRoute(guide,traveler,JAYSPOT,4).fields,[]);
assert.deepEqual(boardRoute(guide,traveler,9,Infinity).fields,[]);
assert.deepEqual(boardRoute(guide,traveler,9,0).fields,[]);
assert.equal(boardDistances(guide,traveler).get(12),3);
assert.equal(boardDistances(guide,traveler).has(JAYSPOT),false);
assert.deepEqual(boardPathTo(guide,traveler,JAYSPOT),[]);
assert.deepEqual(boardPathTo(guide,traveler,8),[8]);
assert.deepEqual(guide,unchanged);
traveler.supplies=STATIONS.map(s=>s.field);
assert.equal(boardDistances(guide,traveler).get(JAYSPOT),3);
assert.deepEqual(boardPathTo(guide,traveler,JAYSPOT),[8,30,31,JAYSPOT]);
assert.deepEqual(boardRoute(guide,traveler,30,4).fields,[30,31]);
assert.equal(boardRoute(guide,traveler,30,4).junction,true);
traveler.position=31;
assert.deepEqual(boardRoute(guide,traveler,JAYSPOT,8).fields,[JAYSPOT]);
// Buying the final missing station could open a fork later in the same move.
traveler.position=26;traveler.supplies=STATIONS.filter(s=>s.field!==27).map(s=>s.field);
assert.equal(boardRoute(guide,traveler,27,20).junction,true);
assert.equal(boardRoute(guide,traveler,27,20).fields.at(-1),8);

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
const late=make(); late.round=5; late.phase="mini-result";late.mini=createPartyGame(players,undefined,true,17,100000,"roll-it-up").mini!;
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
  if(match.phase==="mini-result"){for(const p of match.players)if(match.phase==="mini-result")match=applyPartyAction(match,p.id,{type:"next"},100000);continue;}
  const action=botBoardAction(match);
  assert.ok(action,match.phase);
  match=command(match,action);
}
assert.equal(match.phase,"finished");
assert.equal(activePartyPlayer(match).position,JAYSPOT);
assert.ok(hasFullSet(activePartyPlayer(match)));
assert.deepEqual(match.winners,[activePartyPlayer(match).id]);


// Every human acknowledges independently; repeated confirmations and elapsed time cannot skip anyone.
let results=structuredClone(late);
results=applyPartyAction(results,players[1].id,{type:"next"},100000);
assert.equal(results.phase,"mini-result");
assert.deepEqual(results.mini!.resultReady,[players[1].id]);
assert.equal(tickParty(results,1000000).phase,"mini-result");
results=applyPartyAction(results,players[1].id,{type:"next"},100001);
assert.equal(results.mini!.resultReady!.length,1);
assert.equal(applyPartyAction(results,players[0].id,{type:"next"},100002).phase,"turn");
const bots=structuredClone(late);bots.players[1].bot=true;
assert.equal(applyPartyAction(bots,players[0].id,{type:"next"},100002).phase,"turn");
const absent=structuredClone(results);absent.players[0].passive=true;
assert.equal(tickParty(absent,100003).phase,"turn");

const botTurn=structuredClone(bots);botTurn.turn=botTurn.order.indexOf(players[1].id);
assert.equal(new PartyBotDriver().step(botTurn,1000000,true),botTurn,"Bots warten ohne wiederholte Bestätigungen");
console.log("Roll It Up! – Käufe, Wege, Sofortsieg und Ergebnisbestätigung aller aktiven Menschen geprüft.");
