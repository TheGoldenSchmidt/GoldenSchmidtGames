import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import type { Ack, RoomState } from "../shared/types";
import {CHARACTERS,isCharacterId} from "../shared/characters";
import { activePartyPlayer } from "../shared/party";

const server=createSpielraumServer(),port=await server.listen(0),clients:Socket[]=[];
const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:["websocket"],forceNew:true,reconnection:false});clients.push(s);await new Promise<void>((resolve,reject)=>{s.once("connect",resolve);s.once("connect_error",reject);});return s;};
const emit=(s:Socket,event:string,payload?:unknown)=>new Promise<Ack<RoomState>>((resolve,reject)=>{const done=(err:Error|null,ack:Ack<RoomState>)=>err?reject(err):resolve(ack);if(payload===undefined)s.timeout(3000).emit(event,done);else s.timeout(3000).emit(event,payload,done);});
const request=async(s:Socket,event:string,payload?:unknown)=>{const ack=await emit(s,event,payload);assert.ok(ack.ok,ack.error);return ack.data!;};
try{
  const host=await connect(),other=await connect(),id=randomUUID();
  for(const characterId of [undefined,"kenny_mccormick","eric_cartman_3","../../secret",null,12]){
    assert.equal((await emit(host,"room:create",{playerId:id,characterId})).ok,false,"Create requires an approved figure");
    assert.equal((await emit(host,"party:test-create",{playerId:id,characterId,bots:1,seed:42})).ok,false,"Test room requires an approved figure");
  }
  assert.equal((await emit(host,"party:test-create",{characterId:"alpha_rick_prime",playerId:id,bots:0,seed:42})).ok,false);
  assert.equal((await emit(host,"party:test-create",{characterId:"alpha_rick_prime",playerId:id,bots:6,seed:42})).ok,false);
  assert.equal((await emit(host,"party:test-create",{characterId:"alpha_rick_prime",playerId:id,bots:1,seed:-1})).ok,false);
  let room=await request(host,"party:test-create",{characterId:"alpha_rick_prime",playerId:id,name:"Testerin",bots:5,seed:42});
  assert.ok(room.players.every(p=>isCharacterId(p.characterId)),"All bots use the approved roster");
  assert.equal(room.players.length,6);assert.equal(room.players.filter(p=>p.bot&&p.ready).length,5);
  assert.equal((await emit(other,"room:join",{characterId:"alpha_rick_prime",code:room.code,playerId:room.players[1].id})).ok,false);
  assert.equal((await emit(other,"room:join",{characterId:"alpha_rick_prime",code:room.code,playerId:randomUUID()})).ok,false);
  assert.equal((await emit(host,"room:configure",{gameId:"durak"})).ok,false);
  assert.equal((await emit(host,"room:character",{characterId:"unknown"})).ok,false);
  room=await request(host,"room:character",{characterId:"alpha_eric_cartman"});
  await request(host,"room:configure",{party:{rounds:5,tempo:"fast"}});
  room=await request(host,"room:ready");assert.equal(room.phase,"playing");
  const token=room.partyToken!,code=room.code;
  assert.equal(room.partyGame!.players.find(p=>p.id===id)!.characterId,"alpha_eric_cartman");
  assert.equal((await emit(host,"room:character",{characterId:"alpha_rick_prime"})).ok,false);
  const command=(command:string,miniId?:string)=>request(host,"party:test-command",{command,miniId,token,phaseId:room.partyGame!.phaseId});
  const original=structuredClone(room.partyGame!);
  assert.equal((await emit(host,"party:test-command",{command:"restart",token:"wrong",phaseId:original.phaseId})).ok,false);
  assert.equal((await emit(host,"party:test-command",{command:"restart",token,seq:-1})).ok,false);
  room=await command("skip-bots");assert.equal(activePartyPlayer(room.partyGame!).id,id);
  room=await command("mini","crates");assert.equal(room.partyGame!.phase,"mini-intro");
  const repeatPacket={command:"mini",miniId:"crates",token,phaseId:0,seq:(room.partyTest!.commandSeq??0)+1};
  room=await request(host,"party:test-command",repeatPacket);const miniPhase=room.partyGame!.phaseId;
  room=await request(host,"party:test-command",repeatPacket);assert.equal(room.partyGame!.phaseId,miniPhase,"Doppelte Testaktion verändert die Partie nicht; vergangene Bot-Phasen blockieren die Auswahl nicht");
  assert.equal((await emit(host,"party:test-command",{command:"mini",miniId:"unknown",token,phaseId:room.partyGame!.phaseId})).ok,false);
  room=await request(host,"party:action",{action:{type:"ready"},seq:1,token,phaseId:room.partyGame!.phaseId});
  // Die Bots müssen selbst bereit werden und anschließend normale Steuerung senden.
  const until=Date.now()+7000;
  do{await new Promise(r=>setTimeout(r,120));room=await request(host,"qwixx:state");}while(!room.partyGame!.mini?.arena?.actors.some(a=>a.id!==id&&a.played)&&Date.now()<until);
  assert.equal(room.partyGame!.phase,"mini-play");
  assert.equal(room.partyGame!.mini!.arena!.actors.find(a=>a.id===id)!.characterId,"alpha_eric_cartman");
  assert.ok(room.partyGame!.mini!.arena!.actors.some(a=>a.id!==id&&a.played),"Bots bewegen sich über den echten Server");
  room=await command("restart");assert.equal(room.partyGame!.phase,"turn");assert.deepEqual(room.partyGame!.order,original.order);assert.equal(room.partyToken,token);
  host.disconnect();await new Promise(r=>setTimeout(r,100));host.connect();await new Promise<void>(r=>host.once("connect",r));
  room=await request(host,"room:join",{characterId:"alpha_rick_prime",code,playerId:id,partyToken:token});
  assert.equal(room.hostId,id,"Bot übernimmt niemals den Host");assert.equal(room.partyGame!.pausedAt,0);assert.equal(room.players[0].characterId,"alpha_eric_cartman");
  // Normale Räume haben Figurenwahl, aber keine Testwerkzeuge.
  const normalId=randomUUID();let normal=await request(other,"room:create",{characterId:"alpha_rick_prime",playerId:normalId,name:"Normal"});
  assert.equal((await emit(host,"room:join",{code:normal.code,playerId:randomUUID()})).ok,false,"Join requires a figure");
  for(const gameId of ["qwixx","durak","kribbeln","party"] as const){
    await request(other,"room:configure",{gameId,playerCount:2});
    for(const entry of CHARACTERS){const state=await request(other,"room:character",{characterId:entry.id});assert.equal(state.players[0].characterId,entry.id);}
  }
  await request(other,"room:character",{characterId:"alpha_eric_cartman"});
  const friend=await connect(),friendId=randomUUID();await request(friend,"room:join",{characterId:"alpha_rick_prime",code:normal.code,playerId:friendId});
  await request(friend,"room:character",{characterId:"alpha_rick_prime",playerId:normalId});
  await request(other,"room:ready");await request(friend,"room:ready");normal=await request(other,"qwixx:state");
  assert.equal(normal.partyTest,undefined);assert.equal(normal.partyGame!.players[0].characterId,"alpha_eric_cartman");
  assert.equal(normal.partyGame!.players.find(p=>p.id===friendId)!.characterId,"alpha_rick_prime","Figurenwahl betrifft ausschließlich die eigene Sitzung");
  assert.equal((await emit(other,"party:test-command",{command:"restart",token:normal.partyToken,phaseId:normal.partyGame!.phaseId})).ok,false);
  console.log("Online-Testmodus: Validierung, 5 Bots, Figurenwahl, Start, echte Bewegung, Neustart, Wiederbeitritt und Trennung von normalen Räumen geprüft.");
}finally{clients.forEach(s=>s.disconnect());await server.close();}
