import {boardGame,settleMovement} from "./party-fixtures";
import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction as act, BOARD, createPartyGame, createPartyPractice, ITEM_IDS, ITEMS, MINI_IDS, partyMiniResults, partyOptions, partyStanding, publicParty, tickParty, type PartyGame, type PartyAction, type MiniId } from "../shared/party";
import { ACTION_MINI_IDS } from "../shared/partyArena";

const players=[{id:"a",name:"Ada"},{id:"b",name:"Ben"}];
let now=100000;
function make(){return boardGame(players,{rounds:5},false,23,now);}
function command(g:PartyGame,a:PartyAction){const next=settleMovement(act(g,activePartyPlayer(g).id,a,now+=100));now=Math.max(now,next.movement?.arriveAt??now);return next;}
assert.equal(BOARD.length,34);assert.deepEqual(BOARD[8].next,[9,28]);assert.deepEqual(BOARD[18].next,[19,31]);assert.deepEqual(BOARD[30].next,[12]);assert.deepEqual(BOARD[33].next,[22]);
assert.throws(()=>partyOptions({rounds:4}));assert.throws(()=>partyOptions({rounds:16}));assert.throws(()=>createPartyGame(players.slice(0,1)));
let g=make(),id=activePartyPlayer(g).id;
assert.equal(activePartyPlayer(g).coins,10);assert.throws(()=>act(g,g.players.find(p=>p.id!==id)!.id,{type:"roll"},now));
g.rng=0;g=command(g,{type:"roll"});assert.equal(g.phase,"gift");assert.equal(activePartyPlayer(g).position,2);g=command(g,{type:"gift",accept:true});assert.equal(activePartyPlayer(g).items.length,1);
g=make();activePartyPlayer(g).position=5;activePartyPlayer(g).coins=30;g.rng=0;g=command(g,{type:"roll"});assert.equal(g.phase,"trophy");assert.equal(g.steps,1);g=command(g,{type:"trophy",buy:true});assert.ok([15,24].includes(g.trophyField),"Trophäenstand zieht zu einem anderen Shop");assert.equal(activePartyPlayer(g).trophies,1);assert.equal(activePartyPlayer(g).coins,13);assert.equal(activePartyPlayer(g).position,7);
g=make();g.phase="path";g.steps=3;activePartyPlayer(g).position=8;g=command(g,{type:"path",destination:28});assert.equal(activePartyPlayer(g).position,30);assert.equal(g.phase,"gift");assert.throws(()=>command(g,{type:"path",destination:99}));
g=make();activePartyPlayer(g).position=27;g.rng=0;g=command(g,{type:"roll"});assert.equal(activePartyPlayer(g).coins,16,"Hafenpassage und Münzfeld");
for(const item of ITEM_IDS){g=make();g.phase="shop";activePartyPlayer(g).coins=50;g=command(g,{type:"shop",item});assert.equal(activePartyPlayer(g).coins,50-ITEMS[item].price);assert.equal(activePartyPlayer(g).items[0],item);}
g=make();g.phase="shop";activePartyPlayer(g).coins=0;assert.throws(()=>command(g,{type:"shop",item:"double"}));
g=make();g.phase="shop";activePartyPlayer(g).coins=50;activePartyPlayer(g).items=["double","shield","magnet"];assert.throws(()=>command(g,{type:"shop",item:"sprint"}));g=command(g,{type:"shop",item:"sprint",replace:1});assert.equal(activePartyPlayer(g).items.length,3);assert.equal(activePartyPlayer(g).items[1],"sprint");
g=make();activePartyPlayer(g).items=["sprint","double"];g=command(g,{type:"item",index:0});assert.equal(g.boost,3);assert.throws(()=>command(g,{type:"item",index:0}));g.rng=0;g=command(g,{type:"roll"});assert.equal(g.path.length,6);
g=make();activePartyPlayer(g).items=["double"];g=command(g,{type:"item",index:0});g=command(g,{type:"roll"});assert.equal(g.dice.length,2);
g=make();activePartyPlayer(g).items=["shield"];activePartyPlayer(g).position=3;g=command(g,{type:"item",index:0});g.rng=0;g=command(g,{type:"roll"});assert.equal(activePartyPlayer(g).coins,10);assert.equal(activePartyPlayer(g).shield,false);
g=make();activePartyPlayer(g).items=["magnet"];const other=g.players.find(p=>p.id!==activePartyPlayer(g).id)!;other.coins=2;g=command(g,{type:"item",index:0,target:other.id});assert.equal(activePartyPlayer(g).coins,12);assert.equal(g.players.find(p=>p.id===other.id)!.coins,0);
g=make();activePartyPlayer(g).items=["magnet"];g.players.find(p=>p.id!==activePartyPlayer(g).id)!.shield=true;g=command(g,{type:"item",index:0,target:g.players.find(p=>p.id!==activePartyPlayer(g).id)!.id});assert.equal(activePartyPlayer(g).coins,10);
g=make();activePartyPlayer(g).items=["compass"];g=command(g,{type:"item",index:0,destination:15});assert.equal(activePartyPlayer(g).position,15);assert.equal(activePartyPlayer(g).trophies,0);
for(let event=0;event<6;event++){g=make();g.events=[event];activePartyPlayer(g).position=2;g.rng=0;g=command(g,{type:"roll"});assert.equal(g.events.length,0);assert.ok(g.log.length>1);assert.ok(g.players.every(p=>p.coins>=0));}

for(const mini of MINI_IDS){let test=createPartyPractice(mini,now);const start=test.mini!.startAt;
  const input=(value:number|string,time:number)=>{test=act(test,"practice",{type:"input",value},time);};
  assert.throws(()=>act(test,"practice",{type:"input",value:0},start-1));
  if(mini==="targets"){for(let i=0;i<12;i++)input(test.mini!.targets[i],start+i*2000+100);assert.equal(test.mini!.runs.practice.score,12);}
  if(mini==="colors"){for(let i=0;i<12;i++)input(test.mini!.prompts[i],start+i*100+100);assert.equal(test.mini!.runs.practice.score,12);}
  if(mini==="memory"){let time=start+100;for(let value=0;value<6;value++){for(const index of test.mini!.cards.flatMap((v,i)=>v===value?[i]:[])){input(index,time);time+=100;}}assert.equal(test.mini!.runs.practice.score,6);}
  if(mini==="timing"){for(let i=0;i<5;i++)input("stop",start+i*2400+1200);assert.equal(test.mini!.runs.practice.score,500);}
  if(mini==="trail"){const answer=[...test.mini!.trail];answer.forEach((v,i)=>input(v,start+6100+i*100));assert.equal(test.mini!.runs.practice.score,6);}
  if(mini==="risk"){test.mini!.risk=Array(20).fill(.6);for(let i=0;i<5;i++){input("open",start+100+i*200);input("bank",start+200+i*200);}assert.equal(test.mini!.runs.practice.score,15);}
  const view=publicParty(test,"practice",start+7000);assert.equal(view.rng,0);assert.equal(view.mini!.risk.length,0);assert.ok(view.mini!.cards.every((v,i)=>v===-1||test.mini!.runs.practice.opened.includes(i)||test.mini!.runs.practice.matched.includes(i)));
}
let privacy=createPartyPractice("trail",now);assert.equal(publicParty(privacy,"practice",privacy.mini!.startAt+1).mini!.trail.length,6);assert.equal(publicParty(privacy,"practice",privacy.mini!.startAt+6001).mini!.trail.length,0);
privacy.mini!.runs.spectator.score=999;assert.equal(publicParty(privacy,"practice",now).mini!.runs.spectator.score,0);

// Vollständige Partien: jede Spielerzahl, jede angebotene Rundenzahl, feste Seeds.
let completed=0;
for(let count=2;count<=6;count++)for(let rounds=5;rounds<=15;rounds++){
  let game=createPartyGame(Array.from({length:count},(_,i)=>({id:`p${i}`,name:`P${i}`})),{rounds},true,count*100+rounds,now);
  let actions=0;
  while(game.phase!=="finished"&&actions++<5000){const player=activePartyPlayer(game).id;let a:PartyAction;
    switch(game.phase){case "moving":game=tickParty(game,now=Math.max(now,game.movement!.arriveAt));continue;case "turn":a={type:"roll"};break;case "path":a={type:"path",destination:BOARD[activePartyPlayer(game).position].next[actions%2]??BOARD[activePartyPlayer(game).position].next[0]};break;case "trophy":a={type:"trophy",buy:true};break;case "shop":a={type:"shop"};break;case "gift":a={type:"gift",accept:true,replace:0};break;case "summary":case "mini-result":a={type:"next"};break;
    case "mini-intro":for(const p of game.players)if(!game.mini!.runs[p.id].ready)game=act(game,p.id,{type:"ready"},now+=100);continue;
    case "mini-play":for(const p of game.players)if(!game.mini!.runs[p.id].done)game=act(game,p.id,{type:"finish"},now+=100);continue;
    default:throw new Error(`Unerwartete Phase ${game.phase}`);}
    game=act(game,player,a,now+=100);assert.ok(game.players.every(p=>p.coins>=0&&p.items.length<=3&&p.position>=0&&p.position<34));
  }
  assert.equal(game.phase,"finished",`${count} Spieler / ${rounds} Runden`);assert.ok(game.winners.length>=1);assert.equal(game.round,rounds);completed++;
}
// Online-Fristen und Unterbrechung.
g=boardGame(players,{rounds:5},true,9,now);const before=g.deadline;g=tickParty(g,now+600000);assert.equal(g.phase,"turn");assert.equal(before,0);
g.pausedAt=now;g=tickParty(g,now+60001);assert.equal(g.resumeOffered,true);g=act(g,activePartyPlayer(g).id,{type:"resume"},now+60002);assert.equal(g.pausedAt,0);
assert.ok(partyStanding(g).length===2);
for(const analog of ["words","bridge"] as MiniId[]){
  let game=make();game.options.analog=true;game.phase="summary";game.turn=1;game.miniBag=[analog];game=command(game,{type:"next"});
  assert.equal(game.mini!.id,analog);
  const actor=game.players[0].id;
  assert.throws(()=>act(game,actor,{type:"ready"},now));
  game=act(game,actor,{type:"material",available:true},now);
  game=act(game,actor,{type:"ready"},now);
  game=tickParty(game,game.deadline+1);
  assert.equal(game.phase,"analog-confirm");
  for(const player of game.players)game=act(game,player.id,{type:"report",score:10},now+=100);
  assert.throws(()=>act(game,actor,{type:"report",score:-1},now));
  game=act(game,actor,{type:"confirm",accept:true},now);
  assert.equal(game.phase,"mini-result");assert.deepEqual(game.players.map(p=>p.coins).sort((a,b)=>a-b),[14,20],"Auch bei Gleichstand eindeutige Plätze");
  let replacement=make();replacement.options.analog=true;replacement.phase="summary";replacement.turn=1;replacement.miniBag=[analog];replacement=command(replacement,{type:"next"});replacement=act(replacement,replacement.players[0].id,{type:"material",available:false},now);assert.ok(ACTION_MINI_IDS.includes(replacement.mini!.id as typeof ACTION_MINI_IDS[number]));
}
for (const tempo of ["slow", "normal", "fast"] as const) assert.equal(partyOptions({tempo}).tempo, "normal");
assert.equal(partyOptions({analog:true}).analog,false,"Alte analoge Einstellungen werden nicht mehr aktiviert");
// The visible reward must equal the actual change, including ties and memory tiebreaks.
for(const scores of [[4,3,3,0],[3,3,3,0]]) {
  let payout=createPartyPractice("memory",now);
  const base=payout.mini!.runs.practice;
  payout.players=["practice","second","third","absent"].map((id,i)=>({...payout.players[0],id,name:id,passive:false,coins:10}));
  payout.online=true;
  payout.mini!.runs=Object.fromEntries(payout.players.map((p,i)=>[p.id,{...base,done:i>0,score:scores[i],attempts:i===0?2:3,lastInput:i===3?0:now+4000}]));
  payout=act(payout,"practice",{type:"finish"},now+4001);
  assert.equal(payout.phase,"mini-result");
  assert.deepEqual(partyMiniResults(payout).map(r=>[r.place,r.coins]),[[1,10],[2,4],[3,2],[0,0]]);
  assert.deepEqual(payout.players.map(p=>p.coins),[20,14,12,10]);
  for(const result of partyMiniResults(publicParty(payout,"practice",now+4002)))assert.equal(result.coins,result.player.coins-10);
}
console.log(`Inselparty-Regeltests erfolgreich: Felder, Items, Trophäen, 14 Minispiele, Belohnungsanzeige, Datenschutz und ${completed} vollständige Partien`);
