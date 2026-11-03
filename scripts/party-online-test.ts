import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import { activePartyPlayer, type PartyAction } from "../shared/party";
import type { RoomState } from "../shared/types";

const server=createSpielraumServer(),port=await server.listen(0),url=`http://127.0.0.1:${port}`;
const sockets:Socket[]=[];
const request=<T=RoomState>(s:Socket,event:string,payload?:unknown)=>new Promise<T>((resolve,reject)=>{
  const cb=(error:Error|null,res:{ok:boolean;data?:T;error?:string})=>error?reject(error):!res.ok||!res.data?reject(new Error(res.error)):resolve(res.data);
  if(payload===undefined)s.timeout(4000).emit(event,cb);else s.timeout(4000).emit(event,payload,cb);
});
async function connect(){const s=io(url,{transports:["websocket"],forceNew:true,reconnection:false});sockets.push(s);await new Promise<void>((resolve,reject)=>{s.once("connect",()=>resolve());s.once("connect_error",reject);});return s;}
try{
  const host=await connect(),guest=await connect();const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let room=await request(host,"room:create",{playerId:a,name:"Ada"});await request(guest,"room:join",{playerId:b,name:"Ben",code:room.code});
  await assert.rejects(request(guest,"room:configure",{gameId:"party",playerCount:2}));
  await request(host,"room:configure",{gameId:"party",playerCount:2,party:{rounds:5,tempo:"fast",analog:true}});
  await request(host,"room:ready");room=await request(guest,"room:ready");
  assert.ok(room.partyGame);assert.equal(room.partyGame.options.rounds,5);assert.equal(room.partyGame.rng,0);assert.deepEqual(room.partyGame.events,[]);assert.deepEqual(room.partyGame.miniBag,[]);
  const guestToken=room.partyToken!;const hostRoom=await request(host,"qwixx:state"),hostToken=hostRoom.partyToken!;assert.notEqual(guestToken,hostToken);
  const byId:Record<string,Socket>={[a]:host,[b]:guest},tokens:Record<string,string>={[a]:hostToken,[b]:guestToken};
  const actor=activePartyPlayer(room.partyGame).id,actorSocket=byId[actor];
  await assert.rejects(request(actorSocket,"party:action",{seq:1,phaseId:room.partyGame.phaseId,token:"wrong",action:{type:"roll"}}));
  const packet={seq:1,phaseId:room.partyGame.phaseId,token:tokens[actor],action:{type:"roll"}};
  room=await request(actorSocket,"party:action",packet);const same=await request(actorSocket,"party:action",packet);assert.deepEqual(same.partyGame?.dice,room.partyGame?.dice);assert.equal(same.partyGame?.seq[actor],1);
  await assert.rejects(request(actorSocket,"party:action",{...packet,seq:2}));
  const command=async(action:PartyAction)=>{const id=activePartyPlayer(room.partyGame!).id;room=await request(byId[id],"party:action",{seq:(room.partyGame!.seq[id]??0)+1,phaseId:room.partyGame!.phaseId,token:tokens[id],action});};
  // Beide Brettzüge bis zur gemeinsamen Minispielrunde durchspielen.
  for(let count=0;count<30&&room.partyGame!.phase!=="mini-intro";count++){
    const g=room.partyGame!,p=activePartyPlayer(g);
    if(g.phase==="turn")await command({type:"roll"});
    else if(g.phase==="path")await command({type:"path",destination:p.position===8?9:19});
    else if(g.phase==="gift")await command({type:"gift",accept:false});
    else if(g.phase==="shop")await command({type:"shop"});
    else if(g.phase==="trophy")await command({type:"trophy",buy:false});
    else await command({type:"next"});
  }
  assert.equal(room.partyGame!.phase,"mini-intro");
  // Kein Eingabescore darf die Serverwertung ersetzen.
  await assert.rejects(request(host,"party:action",{seq:(room.partyGame!.seq[a]??0)+1,phaseId:room.partyGame!.phaseId,token:hostToken,action:{type:"report",score:999999}}));
  await assert.rejects(request(guest,"room:configure",{gameId:"qwixx",playerCount:2}));
  guest.disconnect();await new Promise(resolve=>setTimeout(resolve,50));
  const state=await request(host,"qwixx:state");assert.ok(state.partyGame!.pausedAt>0);
  const restored=await connect();await assert.rejects(request(restored,"room:join",{code:room.code,playerId:b,name:"Ben"}));
  const returned=await request(restored,"room:join",{code:room.code,playerId:b,name:"Ben",partyToken:guestToken});assert.equal(returned.partyGame!.pausedAt,0);assert.equal(returned.partyToken,guestToken);
  byId[b]=restored;room=returned;
  const sendAs=async(id:string,action:PartyAction)=>{room=await request(byId[id],"party:action",{seq:(room.partyGame!.seq[id]??0)+1,phaseId:room.partyGame!.phaseId,token:tokens[id],action});};
  // Both devices control separate figures in the same server-authoritative arena.
  await sendAs(a,{type:"ready"});await sendAs(b,{type:"ready"});
  assert.equal(room.partyGame!.mini!.arena!.actors.length,2);
  const start=room.partyGame!.mini!.startAt;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,start-Date.now()+75)));
  room=await request(host,"qwixx:state");
  const phaseId=room.partyGame!.phaseId,before=structuredClone(room.partyGame!.mini!.arena!);
  const packetFor=(id:string,input:unknown,seq=1)=>({token:tokens[id],phaseId,seq,input});
  await assert.rejects(request(host,"party:control",{...packetFor(a,{x:1,z:0,jump:false,punch:false}),token:"wrong"}));
  await assert.rejects(request(host,"party:control",packetFor(a,{x:99,z:0,jump:false,punch:false})));
  await assert.rejects(request(host,"party:control",{...packetFor(a,{x:1,z:0,jump:false,punch:false}),phaseId:phaseId-1}));
  for(let seq=1;seq<=5;seq++){
    await request<{accepted:boolean}>(host,"party:control",packetFor(a,{x:.8,z:0,jump:false,punch:false,score:999999},seq));
    await request<{accepted:boolean}>(restored,"party:control",packetFor(b,{x:.8,z:0,jump:false,punch:false},seq));
    await new Promise(resolve=>setTimeout(resolve,70));
  }
  room=await request(host,"qwixx:state");const after=room.partyGame!.mini!.arena!;
  for(const actor of after.actors){assert.ok(actor.x>before.actors.find(p=>p.id===actor.id)!.x+.05);assert.ok(actor.score<100,"Übertragener Rohscore wird ignoriert");}
  assert.equal(after.actors.find(p=>p.id===b)!.input.x,0,"Steuereingaben anderer Figuren werden nicht projiziert");
  const seqBefore=after.actors.find(p=>p.id===a)!.inputSeq;
  await new Promise(resolve=>setTimeout(resolve,30));await request(host,"party:control",packetFor(a,{x:-1,z:0,jump:false,punch:false},1));
  room=await request(host,"qwixx:state");assert.equal(room.partyGame!.mini!.arena!.actors.find(p=>p.id===a)!.inputSeq,seqBefore,"Veraltete Steuerung überschreibt keine neuere Eingabe");
  restored.disconnect();await new Promise(resolve=>setTimeout(resolve,60));room=await request(host,"qwixx:state");assert.ok(room.partyGame!.pausedAt>0);
  const pausedTime=room.partyGame!.mini!.arena!.time;
  await new Promise(resolve=>setTimeout(resolve,200));room=await request(host,"qwixx:state");assert.equal(room.partyGame!.mini!.arena!.time,pausedTime,"Echtzeit-Physik pausiert mit dem Raum");
  const arenaRejoin=await connect();room=await request(arenaRejoin,"room:join",{code:room.code,playerId:b,name:"Ben",partyToken:guestToken});byId[b]=arenaRejoin;assert.equal(room.partyGame!.pausedAt,0);
  for(let count=0;count<400&&room.partyGame!.phase!=="finished";count++){
    const g=room.partyGame!,p=activePartyPlayer(g);
    if(g.phase==="turn")await command({type:"roll"});
    else if(g.phase==="path")await command({type:"path",destination:p.position===8?9:19});
    else if(g.phase==="gift")await command({type:"gift",accept:false});
    else if(g.phase==="shop")await command({type:"shop"});
    else if(g.phase==="trophy")await command({type:"trophy",buy:true});
    else if(g.phase==="summary"||g.phase==="mini-result")await command({type:"next"});
    else if(g.phase==="mini-intro"){
      if(["words","bridge"].includes(g.mini!.id))await sendAs(a,{type:"material",available:false});
      else {await sendAs(a,{type:"ready"});await sendAs(b,{type:"ready"});}
    }else if(g.phase==="mini-play"){
      await sendAs(a,{type:"finish"});await sendAs(b,{type:"finish"});
    }else throw new Error(`Unerwartete Phase ${g.phase}`);
  }
  assert.equal(room.partyGame!.phase,"finished");assert.ok(room.partyGame!.winners.length>0);
  console.log("Inselparty online erfolgreich: vollständige Partie, gemeinsame Echtzeit-Arena, getrennte Figurensteuerung, Eingabe-/Sitzungsschutz, doppelte/veraltete Aktionen, Pause und Wiederbeitritt");
}finally{sockets.forEach(s=>s.disconnect());await server.close();}
