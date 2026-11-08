import assert from "node:assert/strict";
import { createPartyGame, selectPartyTestMini, tickParty } from "../shared/party";
import { PartyBotDriver, botArenaInput } from "../shared/partyBots";
import { ACTION_MINI_IDS, advanceArena, checkedInput, createArena, setArenaControl } from "../shared/partyArena";

for(const id of ACTION_MINI_IDS){
  const arena=createArena(id,[{id:"bot",style:0}],42);
  for(let now=50;now<=30000;now+=50){const a=arena.actors[0];setArenaControl(arena,a.id,checkedInput(botArenaInput(arena,a)),a.inputSeq+1);advanceArena(arena,now);}
  assert.ok(arena.actors[0].played,`${id}: Bot nimmt teil`);
  assert.ok(arena.actors[0].score>0,`${id}: Bot erzielt echte Punkte`);
  if(id==="hurdles"||id==="balance")assert.ok(arena.actors[0].finished,`${id}: Ziel erreicht`);
}
const players=Array.from({length:6},(_,i)=>({id:`bot${i}`,name:`Bot ${i}`,bot:true}));
let now=1000,g=createPartyGame(players,{rounds:5},true,42,now);
const driver=new PartyBotDriver();
let rounds=new Set<number>(),minis=new Set<string>();
for(let n=0;n<12000&&g.phase!=="finished";n++){
  now+=50;g=tickParty(driver.step(g,now,true),now);rounds.add(g.round);if(g.mini)minis.add(g.mini.id);
}
assert.equal(g.phase,"finished","Bots spielen eine vollständige Partie bis zur Siegerehrung");
assert.equal(rounds.size,5);assert.equal(minis.size,5);assert.ok(g.winners.length>0);
assert.ok(g.players.every(p=>p.coins>=0&&p.wins>=0));
const paused={...g,phase:"turn" as const,pausedAt:now};assert.equal(driver.step(paused,now+1000),paused);
const fresh=createPartyGame([{id:"human",name:"Du"},{id:"bot",name:"Bot",bot:true}],{rounds:5},true,9,now);
fresh.order=["bot","human"];fresh.turn=0;
const skipped=driver.skipTurns(fresh,now);
assert.equal(skipped.order[skipped.turn],"human");assert.equal(skipped.phase,"turn");
const mini=selectPartyTestMini(skipped,"crates",now);
assert.equal(mini.phase,"mini-intro");assert.equal(mini.mini!.id,"crates");assert.ok(mini.phaseId>skipped.phaseId);
assert.equal(mini.players[0].characterId,skipped.players[0].characterId);
const repeated=selectPartyTestMini(mini,"crates",now+1000);assert.equal(repeated.mini!.arenaSeed,mini.mini!.arenaSeed);
console.log("Bots: alle sechs Arenen mit echten Punkten, Ziele, komplette 5-Runden-Partie, Pause und Testwechsel geprüft.");
