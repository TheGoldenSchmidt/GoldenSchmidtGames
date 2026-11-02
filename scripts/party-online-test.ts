import assert from "node:assert/strict";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import { activePartyPlayer, type PartyAction } from "../shared/party";
import type { RoomState } from "../shared/types";

const server=createSpielraumServer(),port=await server.listen(0),url=`http://127.0.0.1:${port}`;
const sockets:Socket[]=[];
const request=(s:Socket,event:string,payload?:unknown)=>new Promise<RoomState>((resolve,reject)=>{
  const cb=(error:Error|null,res:{ok:boolean;data?:RoomState;error?:string})=>error?reject(error):!res.ok||!res.data?reject(new Error(res.error)):resolve(res.data);
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
  console.log("Inselparty online erfolgreich: vollständige Partie, Lobby, UUIDs, Sitzungsschutz, doppelte/veraltete Aktionen, Pause und Wiederbeitritt");
}finally{sockets.forEach(s=>s.disconnect());await server.close();}
