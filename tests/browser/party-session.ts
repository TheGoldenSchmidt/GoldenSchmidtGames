import type {CharacterId} from "../../shared/characters";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { expect, type Page } from "@playwright/test";
import { activePartyPlayer, BOARD, type PartyAction } from "../../shared/party";
import type { RoomState } from "../../shared/types";
import { getGame } from "../../shared/games";
import type { MinigameOptions } from "../../shared/minigameModes";
import { isArenaId, type ArenaId } from "../../shared/partyArena";

export const request=<T=RoomState>(socket:Socket,event:string,payload?:unknown)=>new Promise<T>((resolve,reject)=>{
  const done=(err:Error|null,response:{ok:boolean;data?:T;error?:string})=>err?reject(err):!response.ok?reject(new Error(response.error)):resolve(response.data!);
  if(payload===undefined)socket.timeout(5000).emit(event,done);else socket.timeout(5000).emit(event,payload,done);
});
export async function onlineSession(page:Page,followTurn=false,characters:CharacterId[]=["alpha_rick_prime","alpha_morty_smith"],finishOpening=true,gameId:NonNullable<import("../../shared/party").PartyGame["mode"]>="party",minigames?:Partial<MinigameOptions>,names=["Anna","Ben","Clara","David","Emma","Finn"]) {
  const sockets=await Promise.all(characters.map(async()=>{const socket=io("http://127.0.0.1:4177",{transports:["websocket"],forceNew:true,reconnection:false});await new Promise<void>((resolve,reject)=>{socket.once("connect",resolve);socket.once("connect_error",reject);});return socket;}));
  const ids=sockets.map(()=>randomUUID()),byId=Object.fromEntries(ids.map((id,i)=>[id,sockets[i]]));
  let room=await request(sockets[0],"room:create",{characterId:characters[0],playerId:ids[0],name:names[0]});
  for(let i=1;i<sockets.length;i++)await request(sockets[i],"room:join",{characterId:characters[i],playerId:ids[i],name:names[i],code:room.code});
  await request(sockets[0],"room:configure",{gameId,playerCount:sockets.length,party:{rounds:5,tempo:"slow"},minigames});
  for(const socket of sockets)await request(socket,"room:ready");
  room=await request(sockets[0],"qwixx:state");const tokens:Record<string,string>={};for(let i=0;i<sockets.length;i++)tokens[ids[i]]=(await request(sockets[i],"qwixx:state")).partyToken!;
  if(finishOpening){
    const send=async(i:number,action:PartyAction)=>{room=await request(sockets[i],"qwixx:state");room=await request(sockets[i],"party:action",{token:tokens[ids[i]],seq:(room.partyGame!.seq[ids[i]]??0)+1,phaseId:room.partyGame!.phaseId,action});};
    for(let i=0;i<sockets.length;i++)await send(i,{type:"ready"});
    // Match games end as soon as only one player is left in them.
    for(let i=0;i<sockets.length;i++)if(room.partyGame!.phase==="mini-play")await send(i,{type:"finish"});
    if(gameId==="roll-it-up"){for(let i=0;i<ids.length;i++)if(room.partyGame!.phase==="mini-result")await send(i,{type:"next"});}else await send(ids.indexOf(activePartyPlayer(room.partyGame!).id),{type:"next"});
  }
  const viewer=followTurn?activePartyPlayer(room.partyGame!).id:ids[0];
  await page.addInitScript(({profile,session})=>{localStorage.setItem("spielraum.profile.v1",JSON.stringify(profile));localStorage.setItem("spielraum.party.online.v1",JSON.stringify(session));},{profile:{id:viewer,username:room.players.find(p=>p.id===viewer)!.name},session:{gameId,code:room.code,partyToken:tokens[viewer]}});
  await page.goto("/");await page.getByRole("button",{name:gameId==="party"?"Online-Inselparty wieder beitreten":`${getGame(gameId).name} wieder beitreten`,exact:true}).click();
  return {
    ids,sockets,tokens,
    state:()=>request(sockets[0],"qwixx:state"),
    action:async(action:PartyAction,id?:string)=>{const current=await request(sockets[0],"qwixx:state"),actor=id??activePartyPlayer(current.partyGame!).id;return request(byId[actor],"party:action",{token:tokens[actor],seq:(current.partyGame!.seq[actor]??0)+1,phaseId:current.partyGame!.phaseId,action});},
    control:async(id:string,input:unknown,seq:number)=>{const current=await request(sockets[0],"qwixx:state");return request<{accepted:boolean}>(byId[id],"party:control",{token:tokens[id],phaseId:current.partyGame!.phaseId,seq,input});},
    close:()=>sockets.forEach(socket=>socket.disconnect()),
  };
}
export async function practiceSession(page:Page,miniId:ArenaId) {
  const session=await onlineSession(page,false,undefined,false,"free-minigame",{rounds:1,miniId});
  try{await page.getByRole("button",{name:"Erst kurz üben",exact:true}).click();return session;}
  catch(error){session.close();throw error;}
}
export async function toMini(session:Awaited<ReturnType<typeof onlineSession>>) {
  for(let step=0;step<180;step++){
    const room=await session.state(),g=room.partyGame!,p=activePartyPlayer(g);
    if(g.phase==="mini-intro")return room;
    const actions:Partial<Record<typeof g.phase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:BOARD[p.position].next[0]},gift:{type:"gift",accept:false},shop:{type:"shop"},trophy:{type:"trophy",buy:true},summary:{type:"next"},"mini-result":{type:"next"}};
    if(g.phase==="moving"){await new Promise(r=>setTimeout(r,250));continue;}
    const action=actions[g.phase];if(!action)throw new Error(g.phase);await session.action(action);
  }
  throw new Error("Minispiel wurde nicht erreicht.");
}

type Session = Awaited<ReturnType<typeof onlineSession>>;
/**
 * Lets the page's own player take part in whatever minigame was drawn: 3D
 * arenas via the existing keys, match games via their real touch controls.
 */
export async function participate(page:Page,session:Session,otherSeq:number) {
  const g=(await session.state()).partyGame!;
  if(g.mini?.match){
    await matchStarted(page);
    // A short drag works for every control type (tap zone, stick, slider, swipe and aim pads); camera swipe and camera toggle send no game input.
    const box=(await page.locator(".match-controls button:not(.match-camera), .match-controls [role=group]:not(.match-camera-swipe), .match-controls [role=slider]").first().boundingBox())!;
    await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();
    await page.mouse.move(box.x+box.width*.4+45,box.y+box.height*.5,{steps:3});await page.mouse.up();
    await expect.poll(async()=>(await session.state()).partyGame!.mini!.runs[session.ids[0]].lastInput).toBeGreaterThan(0);
    await session.control(session.ids[1],{x:.2,y:0,ax:0,ay:0,ha:false,hb:false,ca:otherSeq,cb:0,cn:0,n:0},otherSeq);
    return "match" as const;
  }
  // First the arena must exist, otherwise "no countdown" is trivially true during the intro.
  await expect(page.locator(".party-action-world")).toBeVisible();
  await expect(page.locator(".party-action-countdown")).toHaveCount(0,{timeout:10000});
  await page.keyboard.down("ArrowRight");
  await expect.poll(async()=>(await session.state()).partyGame!.mini!.runs[session.ids[0]].lastInput).toBeGreaterThan(0);
  await page.keyboard.up("ArrowRight");
  await session.control(session.ids[1],{x:.1,z:0,jump:false,punch:false},otherSeq);
  return "arena" as const;
}
/** Ends the page's own attempt through the visible UI (give up in match games). */
export async function endOwnAttempt(page:Page,kind:"match"|"arena") {
  await page.getByText(kind==="match"?"Aufgeben":"Versuch vorzeitig beenden",{exact:true}).click();
  await page.getByRole("button",{name:kind==="match"?"Jetzt aufgeben":"Versuch beenden",exact:true}).click();
}

/** Waits until the match stage is shown and its shared countdown has ended. */
export async function matchStarted(page:Page) {
  await expect(page.locator(".match-stage")).toBeVisible();
  await expect(page.locator(".match-countdown")).toHaveCount(0,{timeout:10000});
}

/**
 * Like `toMini`, but plays drawn match games out regularly until a classic 3D
 * arena is up (for tests about figures and 3D scenes).
 */
export async function toArenaMini(session:Session) {
  for(let round=0;round<12;round++){
    let room=await toMini(session);
    if(isArenaId(room.partyGame!.mini!.id))return room;
    for(const id of session.ids)if((await session.state()).partyGame!.phase==="mini-intro")await session.action({type:"ready"},id);
    for(const id of session.ids)if((await session.state()).partyGame!.phase==="mini-play")await session.action({type:"finish"},id);
    room=await session.state();
    if(room.partyGame!.phase==="mini-result")await session.action({type:"next"});
  }
  throw new Error("Keine 3D-Arena gezogen.");
}
