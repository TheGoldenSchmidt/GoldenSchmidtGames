import assert from "node:assert/strict";
import { ACTION_MINI_IDS, advanceArena, ARENA_META, bridgeCenter, checkedInput, createArena, NEUTRAL_INPUT, setArenaControl, type ArenaId, type ArenaState } from "../shared/partyArena";
import { applyPartyAction, applyPartyControl, createPartyGame, createPartyPractice, publicParty, tickParty } from "../shared/party";
import { tiltAxes } from "../src/lib/partyTilt";

const make=(id:ArenaId)=>createArena(id,[{id:"a",style:0},{id:"b",style:1}],1234);
function drive(s:ArenaState,input=NEUTRAL_INPUT,duration=1000,id="a") {const end=s.time+duration;let seq=s.actors.find(a=>a.id===id)!.inputSeq;while(s.time<end){setArenaControl(s,id,input,++seq);advanceArena(s,s.time+50);}return s;}
for(const bad of [{x:NaN,z:0,jump:false,punch:false},{x:Infinity,z:0,jump:false,punch:false},{x:2,z:0,jump:false,punch:false},{x:0,z:"0",jump:false,punch:false},{x:0,z:0,jump:1,punch:false},null])assert.throws(()=>checkedInput(bad));
assert.ok(Math.abs(Math.hypot(...Object.values(checkedInput({x:1,z:1,jump:false,punch:false})).slice(0,2) as [number,number])-1)<1e-9);
let s=make("dash"),a=s.actors[0];
setArenaControl(s,"a",{...NEUTRAL_INPUT,x:1},1);setArenaControl(s,"a",NEUTRAL_INPUT,1);assert.equal(a.input.x,1,"Doppelte Eingabe darf die Steuerung nicht überschreiben");
assert.throws(()=>setArenaControl(s,"foreign",NEUTRAL_INPUT,1));assert.throws(()=>setArenaControl(s,"a",NEUTRAL_INPUT,-1));
advanceArena(s,1000);const stopped=a.x;advanceArena(s,2000);assert.ok(Math.abs(a.x-stopped)<.05,"Verlorene Verbindung lässt die Figur nicht dauerhaft weiterlaufen");
s=make("dash");a=s.actors[0];a.x=5;a.z=4;drive(s,{...NEUTRAL_INPUT,jump:true},250);assert.ok(a.y>1);drive(s,{...NEUTRAL_INPUT,jump:true},1000);assert.equal(a.y,0,"Gehaltene Sprungtaste erzeugt keinen zweiten Sprung");drive(s,NEUTRAL_INPUT,100);drive(s,{...NEUTRAL_INPUT,jump:true},100);assert.ok(a.y>0);
// Height-sensitive pickups and respawn.
s=make("dash");a=s.actors[0];s.pickups=[{id:0,x:a.x,z:a.z,y:1.4,value:3,readyAt:0}];advanceArena(s,50);assert.equal(a.score,0);drive(s,{...NEUTRAL_INPUT,jump:true},300);assert.equal(a.score,3);const readyAt=s.pickups[0].readyAt;assert.ok(readyAt>3000);
s=make("dash");a=s.actors[0];s.pickups=[{id:0,x:a.x,z:a.z,y:.5,value:1,readyAt:0}];s.actors[1].x=a.x;s.actors[1].z=a.z;advanceArena(s,50);assert.equal(s.actors.reduce((sum,p)=>sum+p.score,0),1,"Ein Schatz kann in einer gemeinsamen Arena nur einmal gesammelt werden");
// Crate damage, facing, cooldown, respawn and punches against jumping opponents.
s=make("crates");a=s.actors[0];a.x=0;a.z=1.5;a.heading=Math.PI;s.crates=[{id:0,x:0,z:0,hp:2,readyAt:0}];
drive(s,{...NEUTRAL_INPUT,punch:true},50);assert.equal(s.crates[0].hp,1);assert.equal(a.score,1);drive(s,{...NEUTRAL_INPUT,punch:true},800);assert.equal(s.crates[0].hp,1);drive(s,NEUTRAL_INPUT,50);drive(s,{...NEUTRAL_INPUT,punch:true},50);assert.equal(s.crates[0].hp,0);assert.equal(a.score,5);advanceArena(s,s.time+3600);assert.equal(s.crates[0].hp,2);
s=make("crates");a=s.actors[0];const b=s.actors[1];a.x=0;a.z=1.5;a.heading=Math.PI;b.x=0;b.z=.2;b.y=1.1;b.vy=0;s.crates=[];drive(s,{...NEUTRAL_INPUT,punch:true},50);assert.equal(b.stunnedUntil,0);b.y=0;drive(s,NEUTRAL_INPUT,700);drive(s,{...NEUTRAL_INPUT,punch:true},50);assert.ok(b.stunnedUntil>s.time);
// Hurdles block running, but a well-timed jump crosses them.
s=make("hurdles");a=s.actors[0];a.x=0;a.z=-1;drive(s,{...NEUTRAL_INPUT,z:-1},1000);assert.ok(a.z>-2);drive(s,{...NEUTRAL_INPUT,z:-1,jump:true},700);assert.ok(a.z<-2.4);
a.x=6.2;advanceArena(s,s.time+50);assert.ok(a.falls>0);assert.ok(a.score>=0);
s=make("hurdles");a=s.actors[0];a.z=-20.9;a.checkpoint=5;a.score=50;drive(s,{...NEUTRAL_INPUT,z:-1},200);assert.equal(a.finished,true);assert.equal(a.score,80);const end=a.z;drive(s,{...NEUTRAL_INPUT,z:1},1000);assert.equal(a.z,end);
// Waves hurt only once, and jumping avoids the collision.
s=make("shock");a=s.actors[0];a.x=2;a.z=0;a.score=10;advanceArena(s,1500);assert.ok(a.score<10);const waveScore=a.score;advanceArena(s,1700);assert.equal(a.score,waveScore);
s=make("shock");a=s.actors[0];a.x=2;a.z=0;a.score=10;advanceArena(s,1050);drive(s,{...NEUTRAL_INPUT,jump:true},400);assert.equal(a.score,10);assert.equal(a.stunnedUntil,0);
// The narrow bridge checks its curved surface and preserves checkpoints after a fall.
s=make("balance");a=s.actors[0];a.z=-8;a.x=bridgeCenter(a.z);a.checkpoint=2;a.score=20;advanceArena(s,50);assert.equal(a.falls,0);a.x+=2;advanceArena(s,100);assert.equal(a.falls,1);assert.equal(a.checkpoint,2);assert.equal(a.score,18);assert.ok(Math.abs(a.x-bridgeCenter(a.z))<.01);
drive(s,{...NEUTRAL_INPUT,jump:true},1200);assert.equal(a.y,0,"Balance-Spiele haben keinen Sprungknopf");
s=make("tilt");a=s.actors[0];a.score=1;a.x=-2.5;a.z=-1;advanceArena(s,50);assert.equal(a.falls,1);assert.equal(a.score,0);assert.ok(a.respawnAt>s.time);drive(s,{...NEUTRAL_INPUT,x:1},200);assert.equal(a.x,0,"Während der Rückkehr ist die Figur nicht steuerbar");
// Complete deterministic simulations of every arena, including all six players.
for(const mini of ACTION_MINI_IDS){
  const inputs=Array.from({length:6},(_,i)=>({id:`p${i}`,style:i}));
  const run=()=>{const state=createArena(mini,inputs,77);for(let step=0;step<ARENA_META[mini].seconds*20;step++){for(const [i,p] of state.actors.entries())setArenaControl(state,p.id,{x:Math.sin(step*.09+i),z:Math.cos(step*.07+i),jump:step%14===0,punch:step%16===0},step+1);advanceArena(state,state.time+50);}return state;};
  const first=run();assert.deepEqual(first,run(),`${mini}: deterministischer Replay`);assert.ok(first.actors.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isFinite(p.y)&&p.score>=0));
}
// Input validation and scoring through the actual party reducer.
let game=createPartyPractice("dash",100000),start=game.mini!.startAt;
assert.throws(()=>applyPartyControl(game,"practice",NEUTRAL_INPUT,1,start-1));assert.throws(()=>applyPartyControl(game,"spectator",NEUTRAL_INPUT,1,start+1));
game=applyPartyControl(game,"practice",{...NEUTRAL_INPUT,x:1},1,start+100);game=tickParty(game,start+300);assert.ok(game.mini!.runs.practice.lastInput>0);assert.ok(game.mini!.arena!.actors[0].x>0);
game.pausedAt=start+300;const paused=structuredClone(game.mini!.arena);game=tickParty(game,start+5000);assert.deepEqual(game.mini!.arena,paused);assert.throws(()=>applyPartyControl(game,"practice",NEUTRAL_INPUT,2,start+5000));
game.pausedAt=0;game=tickParty(game,game.deadline+1);assert.equal(game.phase,"mini-result");assert.equal(publicParty(game,"practice").rng,0);
const online=createPartyGame([{id:"a",name:"A"},{id:"b",name:"B"}],{analog:true},true,4,100000);assert.equal(online.options.analog,false);
// Neutral calibration and correct landscape-axis mapping.
assert.deepEqual(tiltAxes({beta:35,gamma:4},{beta:35,gamma:4},0),{x:0,z:0});
assert.deepEqual(tiltAxes({beta:35,gamma:22},{beta:35,gamma:4},0),{x:1,z:0});
const landscape=tiltAxes({beta:53,gamma:4},{beta:35,gamma:4},90);assert.ok(Math.abs(landscape.x-1)<1e-9);assert.equal(landscape.z,0);
console.log("3D-Arenen erfolgreich: Steuerung, Sprünge, Treffer, Physik, Hindernisse, Wellen, Balance, Sensorachsen, Replay, Pause und serverseitige Wertung");
