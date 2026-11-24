import {boardGame,settleMovement} from "./party-fixtures";
import assert from "node:assert/strict";
import { activePartyPlayer, applyPartyAction as act, BOARD, bonusLeaders, bonusTrophies, createPartyGame, duelTargets, createPartyPractice, ITEM_IDS, ITEMS, partyMiniResults, partyOptions, partyStanding, pickBonusTrophies, publicParty, tickParty, TROPHY_PRICE, type PartyGame, type PartyAction } from "../shared/party";
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
g=make();activePartyPlayer(g).position=5;activePartyPlayer(g).coins=30;g.rng=0;g=command(g,{type:"roll"});assert.equal(g.phase,"trophy");assert.equal(g.steps,1);g=command(g,{type:"trophy",buy:true});assert.ok([15,24].includes(g.trophyField),"Trophäenstand zieht zu einem anderen Shop");assert.equal(activePartyPlayer(g).trophies,1);assert.equal(activePartyPlayer(g).coins,30-TROPHY_PRICE+3);assert.equal(activePartyPlayer(g).position,7);
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
g=make();activePartyPlayer(g).items=["compass"];g=command(g,{type:"item",index:0,destination:15});assert.equal(activePartyPlayer(g).position,15);assert.equal(activePartyPlayer(g).trophies,0);assert.equal(g.phase,"turn","Kompass zu einem Shop ohne Trophäenstand");
// Kompass direkt zum Trophäenstand: Kauf vor dem Wurf, danach normal würfeln.
g=make();activePartyPlayer(g).items=["compass"];activePartyPlayer(g).coins=TROPHY_PRICE+2;g=command(g,{type:"item",index:0,destination:g.trophyField});assert.equal(g.phase,"trophy");g=command(g,{type:"trophy",buy:true});assert.equal(activePartyPlayer(g).trophies,1);assert.equal(activePartyPlayer(g).coins,2);assert.equal(g.phase,"turn");assert.throws(()=>command(g,{type:"item",index:0}));g=command(g,{type:"roll"});assert.notEqual(g.phase,"turn");
g=make();activePartyPlayer(g).items=["compass"];activePartyPlayer(g).coins=TROPHY_PRICE;g=command(g,{type:"item",index:0,destination:g.trophyField});g=command(g,{type:"trophy",buy:false});assert.equal(g.phase,"turn");assert.equal(activePartyPlayer(g).trophies,0);
g=make();activePartyPlayer(g).items=["compass"];activePartyPlayer(g).coins=TROPHY_PRICE-1;g=command(g,{type:"item",index:0,destination:g.trophyField});assert.equal(g.phase,"turn","Zu wenig Münzen: kein Angebot");
for(let event=0;event<6;event++){g=make();g.events=[event];activePartyPlayer(g).position=2;g.rng=0;g=command(g,{type:"roll"});assert.equal(g.events.length,0);assert.ok(g.log.length>1);assert.ok(g.players.every(p=>p.coins>=0));}

let privacy=createPartyPractice("dash",now);
privacy.mini!.runs.spectator.score=999;assert.equal(publicParty(privacy,"practice",now).mini!.runs.spectator.score,0);

// Vollständige Partien: jede Spielerzahl, jede angebotene Rundenzahl, feste Seeds.
let completed=0;
for(let count=2;count<=6;count++)for(let rounds=5;rounds<=15;rounds++){
  let game=createPartyGame(Array.from({length:count},(_,i)=>({id:`p${i}`,name:`P${i}`})),{rounds},true,count*100+rounds,now);
  let actions=0;
  while(game.phase!=="finished"&&actions++<5000){const player=activePartyPlayer(game).id;let a:PartyAction;
    switch(game.phase){case "moving":game=tickParty(game,now=Math.max(now,game.movement!.arriveAt));continue;case "turn":a={type:"roll"};break;case "path":a={type:"path",destination:BOARD[activePartyPlayer(game).position].next[actions%2]??BOARD[activePartyPlayer(game).position].next[0]};break;case "trophy":a={type:"trophy",buy:true};break;case "shop":a={type:"shop"};break;case "gift":a={type:"gift",accept:true,replace:0};break;case "duel":{const target=duelTargets(game)[0];a=actions%3&&target?{type:"duel",target:target.id,stake:Math.min(2,target.max)}:{type:"duel"};break;}case "summary":a={type:"next"};break;case "mini-result":for(const p of game.players)if(game.phase==="mini-result")game=act(game,p.id,{type:"next"},now+=100);continue;
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
assert.deepEqual(partyOptions({rounds:9,tempo:"fast",analog:true} as never),{rounds:9,classic:true},"Alte Felder werden ignoriert");
// Ergebnisse: alle Menschen bestätigen, Bots blockieren nie.
{let r=boardGame([{id:"a",name:"A"},{id:"b",name:"B"},{id:"c",name:"C",bot:true}],{rounds:5},true,31,now);
  r.phase="summary";r.turn=r.order.length-1;r=act(r,activePartyPlayer(r).id,{type:"next"},now+=100);assert.equal(r.phase,"mini-intro");
  for(const p of r.players)r=act(r,p.id,{type:"ready"},now+=100);now=r.mini!.startAt+50;for(const p of r.players)if(r.phase==="mini-play")r=act(r,p.id,{type:"finish"},now+=100);
  assert.equal(r.phase,"mini-result");r=act(r,"b",{type:"next"},now+=100);assert.equal(r.phase,"mini-result","Eine Bestätigung reicht nicht");
  r=tickParty(r,now+=100);assert.equal(r.phase,"mini-result");r=act(r,"a",{type:"next"},now+=100);assert.equal(r.phase,"turn","Alle Menschen bestätigt");}
// Bonus-Trophäen: Minispiel-Ass immer, dazu eine aus dem Startwert; Anführer und Vergabe.
{const picks=new Set<string>();for(let seed=1;seed<60;seed++){const p=pickBonusTrophies(seed);assert.equal(p[0],"minis");assert.notEqual(p[1],"minis");picks.add(p[1]);}assert.equal(picks.size,5,"Alle anderen Bonus-Trophäen kommen vor");
  let b=createPartyGame(players,{rounds:5},true,7,now);assert.deepEqual(b.bonusPicks,pickBonusTrophies(7));assert.equal(bonusTrophies(b).length,2);
  assert.deepEqual(bonusLeaders(b,"minis").players,[],"Wert 0: niemand führt");b.players[0].wins=2;assert.deepEqual(bonusLeaders(b,"minis").players.map(p=>p.id),["a"]);
  const old=structuredClone(b);delete old.bonusPicks;assert.equal(bonusTrophies(old).length,3,"Ältere Räume behalten drei Bonus-Trophäen");}
// The visible reward must equal the actual change, including ties and memory tiebreaks.
for(const scores of [[4,3,3,0],[3,3,3,0]]) {
  let payout=createPartyPractice("dash",now);
  const base=payout.mini!.runs.practice;
  payout.players=["practice","second","third","absent"].map((id,i)=>({...payout.players[0],id,name:id,passive:false,coins:10}));
  payout.order=payout.players.map(p=>p.id);
  payout.online=true;
  payout.mini!.runs=Object.fromEntries(payout.players.map((p,i)=>[p.id,{...base,done:i>0,score:scores[i],lastInput:i===3?0:now+4000}]));
  payout=act(payout,"practice",{type:"finish"},now+4001);
  assert.equal(payout.phase,"mini-result");
  assert.deepEqual(partyMiniResults(payout).map(r=>[r.place,r.coins]),[[1,10],[2,4],[3,2],[0,0]]);
  assert.deepEqual(payout.players.map(p=>p.coins),[20,14,12,10]);
  for(const result of partyMiniResults(publicParty(payout,"practice",now+4002)))assert.equal(result.coins,result.player.coins-10);
}
console.log(`Inselparty-Regeltests erfolgreich: Felder, Items, Kompass zum Trophäenstand, Trophäen, Bonus-Trophäen, gemeinsame Ergebnisbestätigung, Belohnungsanzeige, Datenschutz und ${completed} vollständige Partien`);
