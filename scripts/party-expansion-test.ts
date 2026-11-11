import assert from "node:assert/strict";
import {ACTOR_RADIUS,advanceArena,createArena,setArenaControl,NEUTRAL_INPUT,type ArenaState} from "../shared/partyArena";
import {COMMAND_ZONES,DUO_SWITCHES,HEX_PLATFORMS,hexCue,photoSpot,saysCue,wallCellPoint,wallHoles} from "../shared/arenaChallenges";
import {activePartyPlayer,applyPartyAction,createPartyGame,createPartyPractice,partyMiniResults,tickParty} from "../shared/party";
import {boardGame} from "./party-fixtures";
const players=Array.from({length:6},(_,i)=>({id:`p${i}`,style:i}));
const make=(id:Parameters<typeof createArena>[0],count=2)=>createArena(id,players.slice(0,count),71);
function drive(s:ArenaState,id:string,x:number,z:number,ms:number,jump=false){const end=s.time+ms;while(s.time<end){const a=s.actors.find(a=>a.id===id)!;setArenaControl(s,id,{x,z,jump,punch:false},a.inputSeq+1);advanceArena(s,s.time+50);}return s;}
// Solid bodies, six-way separation, and jump-height separation.
let s=make("walls",6);for(const a of s.actors){a.x=0;a.z=0;}advanceArena(s,100);
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)assert.ok(Math.hypot(s.actors[i].x-s.actors[j].x,s.actors[i].z-s.actors[j].z)>ACTOR_RADIUS*2-.005,"Six actors separate");
s=make("walls");s.actors[0].x=-1;s.actors[1].x=1;s.actors.forEach(a=>a.z=0);
for(let step=0;step<35;step++){setArenaControl(s,"p0",{...NEUTRAL_INPUT,x:1},step+1);setArenaControl(s,"p1",{...NEUTRAL_INPUT,x:-1},step+1);advanceArena(s,s.time+50);assert.ok(s.actors[0].x<s.actors[1].x);assert.ok(Math.hypot(s.actors[0].x-s.actors[1].x,s.actors[0].z-s.actors[1].z)>=ACTOR_RADIUS*2-.001);}
// One fall halves, two falls freeze the existing score and controls.
s=make("tilt");let a=s.actors[0];a.x=-2.5;a.z=-1;a.score=9;advanceArena(s,50);assert.equal(a.score,4);assert.equal(a.falls,1);
advanceArena(s,a.respawnAt);a.x=9;advanceArena(s,s.time+50);assert.equal(a.falls,2);assert.equal(a.eliminated,true);assert.equal(a.finished,true);assert.equal(a.score,4);assert.equal(setArenaControl(s,a.id,{...NEUTRAL_INPUT,x:1},99),false);advanceArena(s,s.time+2000);assert.equal(a.score,4);
// Safe holes in walls and two-hit elimination.
s=make("walls");s.time=4450;a=s.actors[0];Object.assign(a,wallCellPoint(wallHoles(s)[0]),{played:true});const bad=Array.from({length:9},(_,i)=>i).find(i=>!wallHoles(s).includes(i))!;Object.assign(s.actors[1],wallCellPoint(bad),{score:9});advanceArena(s,4500);assert.equal(a.score,10);assert.equal(s.actors[1].score,4);assert.equal(s.actors[1].falls,1);
// Sinking platforms honor the advertised color.
s=make("hex");s.time=3850;a=s.actors[0];Object.assign(a,HEX_PLATFORMS[hexCue(s)],{played:true});s.actors[1].x=a.x>0?-4.5:4.5;s.actors[1].z=0;s.actors[1].score=20;advanceArena(s,3900);assert.equal(a.falls,0);assert.equal(s.actors[1].falls,1);assert.equal(s.actors[1].score,10);advanceArena(s,5500);assert.equal(a.score,10);
// Photos rank distance to the changing camera spot.
s=make("photo",3);s.time=4450;const spot=photoSpot(s);s.actors.forEach((p,i)=>Object.assign(p,{x:spot.x+i*.9,z:spot.z,played:true}));advanceArena(s,4500);assert.deepEqual(s.actors.map(p=>p.score),[10,4,2]);
// Genuine commands and decoys both require their correct safe zone.
s=make("says");s.time=3950;a=s.actors[0];Object.assign(a,COMMAND_ZONES[saysCue(s).expected],{played:true});advanceArena(s,4000);assert.equal(a.score,10);
for(let round=1;round<30;round++){s.time=round*6000+3950;if(!saysCue(s).obey)break;}
const cue=saysCue(s);assert.equal(cue.obey,false);Object.assign(a,COMMAND_ZONES[cue.expected]);Object.assign(s.actors[1],COMMAND_ZONES[cue.target],{score:10,falls:0,respawnAt:0,eliminated:false,finished:false});advanceArena(s,s.time+50);assert.equal(a.score,20);assert.equal(s.actors[1].falls,1);
// Stacked surfaces support landing, jumping and solid sides.
s=make("stack",1);s.blocks=[{id:0,x:0,z:0,startAt:0,landAt:500,baseY:0}];s.time=500;a=s.actors[0];Object.assign(a,{x:0,z:0,y:2,vy:0});advanceArena(s,1000);assert.equal(a.y,1.1);assert.equal(a.grounded,true);drive(s,a.id,0,0,100,true);assert.ok(a.y>1.1);
Object.assign(a,{x:-2,z:0,y:0,vy:0,grounded:true});drive(s,a.id,1,0,1000);assert.ok(a.x<=-1.15,"Cannot walk into landed crates");
// Golf gates block closed portions but allow the announced opening.
s=make("golf",1);a=s.actors[0];Object.assign(a,{x:0,z:-2});drive(s,a.id,0,-1,1000);assert.ok(a.z>-3.5);Object.assign(a,{x:-3,z:-2,vz:0});drive(s,a.id,0,-1,1000);assert.ok(a.z<-3.5);Object.assign(a,{x:0,z:-21.8});advanceArena(s,s.time+50);assert.equal(a.finished,true);assert.ok(a.score>=30);
// Cooperative gates need both plates simultaneously; practice allows sequential plates.
s=make("duos");const plate=DUO_SWITCHES[0];Object.assign(s.actors[0],{x:plate.left,z:plate.z});Object.assign(s.actors[1],{x:0,z:2});advanceArena(s,50);assert.equal(s.gates![0],false);Object.assign(s.actors[1],{x:plate.right,z:plate.z});advanceArena(s,100);assert.equal(s.gates![0],true);assert.deepEqual(s.actors.map(a=>a.score),[10,10]);
s=make("duos",1);Object.assign(s.actors[0],{x:plate.left,z:plate.z});advanceArena(s,50);Object.assign(s.actors[0],{x:plate.right,z:plate.z});advanceArena(s,100);assert.equal(s.gates![0],true);
// The opening establishes a fixed order, without coin rewards.
let g=createPartyGame([{id:"a",name:"Ada"},{id:"b",name:"Ben"},{id:"c",name:"Clara"}],{rounds:5},true,9,1000);assert.equal(g.opening,true);assert.equal(g.phase,"mini-intro");for(const p of g.players)g=applyPartyAction(g,p.id,{type:"ready"},1000);
for(const [i,p] of g.players.entries()){g.mini!.runs[p.id].score=[4,20,10][i];g.mini!.runs[p.id].lastInput=g.mini!.startAt+1;}
for(const p of g.players)g=applyPartyAction(g,p.id,{type:"finish"},g.mini!.startAt+100);
assert.deepEqual(g.order,["b","c","a"]);assert.ok(g.players.every(p=>p.coins===10));g=applyPartyAction(g,"b",{type:"next"},5000);assert.equal(g.opening,false);assert.equal(g.deadline,0);
const order=[...g.order];g.phase="summary";g.turn=2;g=applyPartyAction(g,"a",{type:"next"},6000);for(const p of g.players)g=applyPartyAction(g,p.id,{type:"ready"},6000);for(const p of g.players)if(g.phase==="mini-play")g=applyPartyAction(g,p.id,{type:"finish"},10000);g=applyPartyAction(g,"b",{type:"next"},11000);assert.deepEqual(g.order,order);assert.equal(g.round,2);
// Arrival is authoritative: no field effect before the figure reaches it.
g=boardGame([{id:"a",name:"A"},{id:"b",name:"B"}],{rounds:5},true,9,20000);let p=activePartyPlayer(g);p.position=2;g.events=[0];g.rng=0;const id=p.id;g=applyPartyAction(g,id,{type:"roll"},25000);assert.equal(g.phase,"moving");assert.equal(activePartyPlayer(g).position,2);assert.equal(activePartyPlayer(g).coins,10);g=tickParty(g,g.movement!.arriveAt-1);assert.equal(activePartyPlayer(g).position,2);g=tickParty(g,g.movement!.arriveAt);assert.equal(activePartyPlayer(g).position,3);assert.equal(activePartyPlayer(g).coins,10);assert.deepEqual(g.events,[0]);g=tickParty(g,g.movement!.arriveAt);assert.equal(activePartyPlayer(g).position,4);assert.equal(activePartyPlayer(g).coins,15);assert.deepEqual(g.events,[]);
// Exact podium and zero reward for the remaining places.
g=createPartyPractice("memory",50000);const base=g.mini!.runs.practice;g.players=players.map((p,i)=>({...g.players[0],id:p.id,name:p.id,passive:false,coins:10}));g.order=g.players.map(p=>p.id);g.online=true;g.mini!.runs=Object.fromEntries(g.players.map((p,i)=>[p.id,{...base,done:i>0,score:100-i,lastInput:51000}]));g=applyPartyAction(g,"p0",{type:"finish"},55000);assert.deepEqual(partyMiniResults(g).map(r=>r.coins),[10,4,2,0,0,0]);
console.log("Insel-Erweiterung: Kollisionen, Sturzregeln, acht neue Mechaniken, Auftakt, feste Reihenfolge, 10/4/2/0 und Ankunft geprüft.");

let final=createPartyPractice("memory",70000);final.round=final.options.rounds;final.mini!.runs.practice.lastInput=74000;final.mini!.runs.practice.score=6;final=applyPartyAction(final,"practice",{type:"finish"},75000);assert.equal(final.phase,"finished","Last minigame finishes the party immediately");assert.ok(final.winners.length>0);

s=make("bumper");Object.assign(s.actors[0],{x:0,z:0,vx:4,vz:0});Object.assign(s.actors[1],{x:.8,z:0,vx:0,vz:0});advanceArena(s,50);assert.equal(s.actors[1].lastBumpedBy,"p0","Moving bumper receives the push credit");

let pausedMove=boardGame([{id:"a",name:"A"},{id:"b",name:"B"}],{rounds:5},true,2,90000);pausedMove.rng=0;pausedMove=applyPartyAction(pausedMove,activePartyPlayer(pausedMove).id,{type:"roll"},95000);const arrival=pausedMove.movement!.arriveAt;pausedMove.pausedAt=pausedMove.movement!.departAt+100;const pauseAt=pausedMove.pausedAt;pausedMove=tickParty(pausedMove,pauseAt+60001);assert.equal(activePartyPlayer(pausedMove).position,0);assert.equal(pausedMove.movement!.arriveAt,arrival);pausedMove=applyPartyAction(pausedMove,activePartyPlayer(pausedMove).id,{type:"resume"},pauseAt+60001);assert.equal(pausedMove.movement!.arriveAt,arrival+60001);pausedMove=tickParty(pausedMove,arrival+60000);assert.equal(activePartyPlayer(pausedMove).position,0,"Paused movement cannot apply an early field effect");
