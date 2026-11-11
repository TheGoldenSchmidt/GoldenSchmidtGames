import assert from "node:assert/strict";
import {io,type Socket} from "socket.io-client";
import {createSpielraumServer} from "../server/index";
import type {RoomState} from "../shared/types";
const server=createSpielraumServer(),port=await server.listen(0),sockets:Socket[]=[];
const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:["websocket"],forceNew:true,reconnection:false});sockets.push(s);await new Promise<void>((r,j)=>{s.once("connect",r);s.once("connect_error",j);});return s;};
const request=<T=RoomState>(s:Socket,event:string,payload?:unknown)=>new Promise<T>((r,j)=>{const done=(e:Error|null,a:{ok:boolean;error?:string;data?:T})=>e?j(e):!a.ok?j(new Error(a.error)):r(a.data!);if(payload===undefined)s.timeout(3000).emit(event,done);else s.timeout(3000).emit(event,payload,done);});
try{
 const host=await connect(),guest=await connect(),watcher=await connect();let room=await request(host,"room:create",{playerId:"host",name:"Host",characterId:"alpha_rick_prime"});
 await request(guest,"room:join",{code:room.code,playerId:"guest",name:"Gast",characterId:"alpha_korvo"});await request(host,"room:configure",{gameId:"party",playerCount:2});await request(host,"room:ready");await request(guest,"room:ready");room=await request(host,"qwixx:state");const code=room.code,token=room.partyToken!,guestToken=(await request(guest,"qwixx:state")).partyToken!;
 assert.equal((await request<{available:boolean}>(watcher,"party:session-status",{code,playerId:"host",partyToken:"wrong"})).available,false);
 assert.equal((await request<{available:boolean}>(watcher,"party:session-status",{code,playerId:"host",partyToken:token})).available,true);
 guest.disconnect();await new Promise(r=>setTimeout(r,70));room=await request(host,"qwixx:state");assert.ok(room.partyGame!.pausedAt);
 await request(watcher,"party:session-status",{code,playerId:"guest",partyToken:guestToken});assert.equal((await request(host,"qwixx:state")).partyGame!.pausedAt,room.partyGame!.pausedAt,"Status does not join or resume a room");
 const returned=await connect();await request(returned,"room:join",{code,playerId:"guest",partyToken:guestToken});room=await request(host,"qwixx:state");assert.equal(room.partyGame!.pausedAt,0);
 const members:Record<string,Socket>={host,guest:returned},tokens:Record<string,string>={host:token,guest:guestToken};
 const act=async(id:string,type:string)=>{const current=await request(host,"qwixx:state");return request(members[id],"party:action",{token:tokens[id],phaseId:current.partyGame!.phaseId,seq:(current.partyGame!.seq[id]??0)+1,action:{type}});};
 await act("host","ready");await act("guest","ready");room=await act("host","finish");if(room.partyGame!.phase==="mini-play")room=await act("guest","finish"); // Match games end once only one player remains.
 room=await act(room.partyGame!.order[0],"next");room=await act(room.partyGame!.order[0],"roll");const oldArrival=room.partyGame!.movement!.arriveAt;
 returned.disconnect();await new Promise(r=>setTimeout(r,1200));const activeGuest=await connect();room=await request(activeGuest,"room:join",{code,playerId:"guest",partyToken:guestToken});assert.ok(room.partyGame!.movement!.arriveAt>=oldArrival+1100,"Rejoin shifts the pending arrival by the connection pause");assert.equal(room.partyGame!.players.every(p=>p.position===0),true,"Pause cannot trigger the destination early");
 await assert.rejects(request(activeGuest,"party:action",{token:guestToken,phaseId:room.partyGame!.phaseId,seq:(room.partyGame!.seq.guest??0)+1,action:{type:"abort"}}));
 const closed=new Promise<{code:string;reason:string}>(r=>watcher.once("party:closed",r));const ended=await request(host,"party:action",{token,phaseId:room.partyGame!.phaseId,seq:(room.partyGame!.seq.host??0)+1,action:{type:"abort"}});assert.equal(ended.partyGame!.phase,"aborted");assert.deepEqual(await closed,{code,reason:"aborted"});
 await assert.rejects(request(watcher,"room:join",{code,playerId:"host",partyToken:token}));await assert.rejects(request(host,"qwixx:state"));
 assert.equal((await request<{available:boolean}>(watcher,"party:session-status",{code,playerId:"host",partyToken:token})).available,false);assert.equal((await (await fetch(`http://127.0.0.1:${port}/api/health`)).json() as {rooms:number}).rooms,0);
 console.log("Raumlebenszyklus: Status ohne Beitritt, echte Wiederaufnahme, Host-Rechte, Schließen, Watcher und Token-Ungültigkeit geprüft.");
}finally{sockets.forEach(s=>s.disconnect());await server.close();}
