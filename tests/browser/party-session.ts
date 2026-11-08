import type {CharacterId} from "../../shared/characters";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import type { Page } from "@playwright/test";
import { activePartyPlayer, BOARD, type PartyAction } from "../../shared/party";
import type { RoomState } from "../../shared/types";

export const request=<T=RoomState>(socket:Socket,event:string,payload?:unknown)=>new Promise<T>((resolve,reject)=>{
  const done=(err:Error|null,response:{ok:boolean;data?:T;error?:string})=>err?reject(err):!response.ok?reject(new Error(response.error)):resolve(response.data!);
  if(payload===undefined)socket.timeout(5000).emit(event,done);else socket.timeout(5000).emit(event,payload,done);
});
export async function onlineSession(page:Page,followTurn=false,characters:CharacterId[]=["alpha_rick_prime","alpha_morty_smith"]) {
  const sockets=await Promise.all(characters.map(async()=>{const socket=io("http://127.0.0.1:4177",{transports:["websocket"],forceNew:true,reconnection:false});await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});return socket;}));
  const ids=sockets.map(()=>randomUUID()),byId=Object.fromEntries(ids.map((id,i)=>[id,sockets[i]]));
  let room=await request(sockets[0],"room:create",{characterId:characters[0],playerId:ids[0],name:"Anna"});
  for(let i=1;i<sockets.length;i++)await request(sockets[i],"room:join",{characterId:characters[i],playerId:ids[i],name:["Anna","Ben","Clara","David","Emma","Finn"][i],code:room.code});
  await request(sockets[0],"room:configure",{gameId:"party",playerCount:sockets.length,party:{rounds:5,tempo:"slow"}});
  for(const socket of sockets)await request(socket,"room:ready");
  room=await request(sockets[0],"qwixx:state");const tokens:Record<string,string>={};for(let i=0;i<sockets.length;i++)tokens[ids[i]]=(await request(sockets[i],"qwixx:state")).partyToken!;
  const viewer=followTurn?activePartyPlayer(room.partyGame!).id:ids[0];
  await page.addInitScript(({profile,session})=>{localStorage.setItem("spielraum.profile.v1",JSON.stringify(profile));localStorage.setItem("spielraum.party.online.v1",JSON.stringify(session));},{profile:{id:viewer,username:room.players.find(p=>p.id===viewer)!.name},session:{code:room.code,partyToken:tokens[viewer]}});
  await page.goto("/");await page.getByRole("button",{name:"Online-Inselparty wieder beitreten",exact:true}).click();
  return {
    ids,sockets,tokens,
    state:()=>request(sockets[0],"qwixx:state"),
    action:async(action:PartyAction,id?:string)=>{const current=await request(sockets[0],"qwixx:state"),actor=id??activePartyPlayer(current.partyGame!).id;return request(byId[actor],"party:action",{token:tokens[actor],seq:(current.partyGame!.seq[actor]??0)+1,phaseId:current.partyGame!.phaseId,action});},
    control:async(id:string,input:unknown,seq:number)=>{const current=await request(sockets[0],"qwixx:state");return request<{accepted:boolean}>(byId[id],"party:control",{token:tokens[id],phaseId:current.partyGame!.phaseId,seq,input});},
    close:()=>sockets.forEach(socket=>socket.disconnect()),
  };
}
export async function toMini(session:Awaited<ReturnType<typeof onlineSession>>) {
  for(let step=0;step<40;step++){
    const room=await session.state(),g=room.partyGame!,p=activePartyPlayer(g);
    if(g.phase==="mini-intro")return room;
    const actions:Partial<Record<typeof g.phase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:BOARD[p.position].next[0]},gift:{type:"gift",accept:false},shop:{type:"shop"},trophy:{type:"trophy",buy:true},summary:{type:"next"},"mini-result":{type:"next"}};
    const action=actions[g.phase];if(!action)throw new Error(g.phase);await session.action(action);
  }
  throw new Error("Minispiel wurde nicht erreicht.");
}
