import { boardDistances, goalField, hasFullSet, partyPaths, stationsOf, type Collector } from "./partyBoard";
import { availableBets } from "./minigameModes";
import { botMatchInput } from "./matches/framework";
import {COMMAND_ZONES,DUO_SWITCHES,GOLF_GATES,HEX_PLATFORMS,hexCue,photoSpot,saysCue,wallHoles,wallCellPoint} from "./arenaChallenges";
import { activePartyPlayer, applyPartyAction, applyPartyControl, duelTargets, ITEMS, MAX_TROPHIES_PER_VISIT, tickParty, TROPHY_PRICE, type Item, type PartyAction, type PartyGame } from "./party";
import { bridgeCenter, clamp, DASH_BLOCKS, HURDLES, TILT_HOLES, type ArenaActor, type ArenaInput, type ArenaState } from "./partyArena";

/** Bots kennen nur die sichtbare Arena und senden normale Eingaben. */
export function botArenaInput(s:ArenaState,a:ArenaActor):ArenaInput {
  let x=0,z=-1,jump=false,punch=false;
  const steer=(tx:number,tz:number,gain=2)=>{x=clamp((tx-a.x)*gain,-1,1);z=clamp((tz-a.z)*gain,-1,1);};
  if(s.id==="walls"){const target=wallHoles(s).map(wallCellPoint).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];steer(target.x,target.z);}
  else if(s.id==="hex"){const p=HEX_PLATFORMS[hexCue(s)];steer(p.x,p.z);punch=s.time%900<100;}
  else if(s.id==="photo"){const p=photoSpot(s);steer(p.x,p.z);punch=s.time%800<100;}
  else if(s.id==="says"){const p=COMMAND_ZONES[saysCue(s).expected];steer(p.x,p.z);}
  else if(s.id==="bumper"){const target=s.actors.filter(b=>b.id!==a.id&&!b.finished).sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];if(Math.hypot(a.x,a.z)>4.7||!target)steer(0,0);else steer(target.x,target.z);}
  else if(s.id==="stack"){steer(Math.sin(s.time*.0007)*4,Math.cos(s.time*.0006)*3);jump=s.time%1000<150;}
  else if(s.id==="golf"){const gate=GOLF_GATES.find(g=>a.z>g.z-.7);if(gate)steer(gate.gapX,gate.z-1);else steer(0,-21.8);x=clamp(x-a.vx*.15,-1,1);z=clamp(z-a.vz*.15,-1,1);}
  else if(s.id==="duos"){const index=s.gates?.findIndex(open=>!open)??-1;if(index>=0){const plate=DUO_SWITCHES[index],side=s.actors.length===1?(s.switches?.[index*2]?1:0):s.actors.indexOf(a)%2;steer(side?plate.right:plate.left,plate.z);}else steer(0,-23);jump=[-7,-16,-19].some(bar=>a.z>bar&&a.z-bar<1.8)&&a.grounded;}
  else if(s.id==="balance")steer(bridgeCenter(a.z-1),a.z-1);
  else if(s.id==="hurdles")jump=HURDLES.some(h=>a.z>h&&a.z-h<1.8)&&a.y===0;
  else {
    const targets=s.id==="crates"?s.crates.filter(c=>c.hp>0):s.pickups.filter(p=>p.readyAt<=s.time);
    const target=[...targets].sort((p,q)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(q.x-a.x,q.z-a.z))[0];
    if(target)steer(target.x,target.z,s.id==="tilt"?1.1:2);
    else steer(0,0);
    if(s.id==="crates")punch=s.time%800<150;
    if(s.id==="dash")jump=a.y===0&&(DASH_BLOCKS.some(b=>Math.abs(a.x-b.x)<b.w/2+.8&&Math.abs(a.z-b.z)<b.d/2+.9)||Boolean(target&&"y" in target&&Number(target.y)>1));
    if(s.id==="shock"){
      const radius=Math.hypot(a.x,a.z);
      for(let wave=0;wave<20;wave++){const r=(s.time-700-wave*3500)/1000*2.7;if(r>=0&&r<7&&radius-r>.45&&radius-r<1.25)jump=a.y===0;}
    }
    if(s.id==="tilt"){
      // Bremsen und seitlich an Löchern vorbei lenken; kein Teleportieren.
      x-=a.vx*.22;z-=a.vz*.22;
      for(const h of TILT_HOLES){const dx=a.x-h.x,dz=a.z-h.z,d=Math.hypot(dx,dz);if(d<h.r+1.1&&d>.01){x+=dx/d*1.5;z+=dz/d*1.5;}}
      x=clamp(x,-1,1);z=clamp(z,-1,1);
    }
  }
  const n=Math.max(1,Math.hypot(x,z));return {x:x/n,z:z/n,jump,punch};
}

/** Walking distance from a field to the nearest of the targets (Infinity when none can be reached). */
function distanceTo(g:PartyGame,p:Collector,from:number,targets:readonly number[]){
  const distances=boardDistances(g,{...p,position:from});
  return Math.min(...targets.map(t=>distances.get(t)??Infinity));
}
/** Where a bot wants to go: the trophy stand once it can pay, otherwise the next missing utensil. */
function botGoal(g:PartyGame,p:PartyGame["players"][number]):number[]|undefined{
  if(g.mode==="roll-it-up")return hasFullSet(g,p)?[goalField(g)]:stationsOf(g).filter(s=>!p.supplies?.includes(s.field)&&p.coins>=s.price).map(s=>s.field);
  return p.coins>=TROPHY_PRICE?[g.trophyField]:undefined;
}
const has=(p:{items:Item[]},item:Item)=>p.items.indexOf(item);

export function botBoardAction(g:PartyGame):PartyAction|undefined {
  if(g.phase === "mini-result") return;
  const p=activePartyPlayer(g),party=(g.mode??"party")==="party";
  if(g.phase==="turn"){
    if(g.itemUsed)return {type:"roll"};
    // Travel to the trophy stand when it is far away and affordable.
    const compass=has(p,"compass");
    if(compass>=0&&party&&p.coins>=TROPHY_PRICE&&p.position!==g.trophyField&&distanceTo(g,p,p.position,[g.trophyField])>6)return {type:"item",index:compass,destination:g.trophyField};
    // Fish coins from the richest player without a shield.
    const magnet=has(p,"magnet"),rich=g.players.filter(o=>o.id!==p.id&&!o.shield&&o.coins>=3).sort((a,b)=>b.coins-a.coins)[0];
    if(magnet>=0&&rich)return {type:"item",index:magnet,target:rich.id};
    const index=p.items.findIndex(i=>i==="sprint"||i==="double"||i==="shield"&&!p.shield);
    return index>=0?{type:"item",index}:{type:"roll"};
  }
  if(g.phase==="path"){
    const paths = partyPaths(g,p);
    const goal=botGoal(g,p);
    if(goal?.length){const best=[...paths].sort((a,b)=>distanceTo(g,p,a,goal)-distanceTo(g,p,b,goal))[0];return {type:"path",destination:best};}
    // Without a goal the bots vary their route (deterministic, no own random state).
    return {type:"path", destination: paths[(g.round+g.turn)%paths.length]};
  }
  if(g.phase==="supply")return {type:"supply",buy:true};
  if(g.phase==="trophy"){const count=Math.min(MAX_TROPHIES_PER_VISIT,Math.floor(p.coins/TROPHY_PRICE));return count?{type:"trophy",buy:true,count}:{type:"trophy",buy:false};}
  if(g.phase==="gift")return {type:"gift",accept:true,replace:0};
  // Duels: challenge the richest player for up to 5 coins.
  if(g.phase==="duel"){const options=duelTargets(g).sort((a,b)=>g.players.find(q=>q.id===b.id)!.coins-g.players.find(q=>q.id===a.id)!.coins);return options.length?{type:"duel",target:options[0].id,stake:Math.min(5,options[0].max)}:{type:"duel"};}
  if(g.phase==="shop"){
    // Keep enough coins for the next trophy; prefer the compass, then the double die and the coin hook.
    const reserve=party?TROPHY_PRICE:8,wish=(["compass","double","magnet"] as Item[]).find(item=>has(p,item)<0&&p.coins-ITEMS[item].price>=reserve);
    return {type:"shop",item:p.items.length<3?wish:undefined};
  }
  if(g.phase==="summary")return {type:"next"};
}

export class PartyBotDriver {
  private phaseId=-1;
  private due=0;
  step(current:PartyGame,now:number,skipWait=false):PartyGame {
    if(current.pausedAt||current.phase==="finished"||current.phase==="aborted")return current;
    // Results wait for humans; bots are already counted as ready.
    if(current.phase==="mini-result"&&!current.competition)return current;
    let g=current;
    if(g.phase==="mini-play"&&g.mini?.match&&now>=g.mini.startAt&&now<g.deadline){
      for(const p of g.players.filter(p=>p.bot&&!p.passive)){
        const player=g.mini?.match?.players.find(q=>q.id===p.id);
        if(player&&!player.gone&&!g.mini!.match!.done&&g.phase==="mini-play")g=applyPartyControl(g,p.id,botMatchInput(g.mini!.match!,p.id),player.inputSeq+1,now);
      }
      return g;
    }
    if(g.phase==="mini-play"&&g.mini?.arena&&now>=g.mini.startAt&&now<g.deadline){
      for(const p of g.players.filter(p=>p.bot&&!p.passive)){
        const a=g.mini?.arena?.actors.find(a=>a.id===p.id);
        if(a&&!a.finished&&!g.mini!.runs[p.id].done)g=applyPartyControl(g,p.id,botArenaInput(g.mini!.arena!,a),a.inputSeq+1,now);
      }
      return g;
    }
    if(g.phaseId!==this.phaseId){this.phaseId=g.phaseId;this.due=now+650;}
    if(!skipWait&&now<this.due)return g;
    this.due=now+650;
    if(g.phase === "mini-bet" && g.competition) {
      for(const p of g.players.filter(p => p.bot && !p.passive)) {
        if(g.phase === "mini-bet" && !g.competition!.locked.includes(p.id)) {
          const available = availableBets(g.competition!, p.id);
          g = applyPartyAction(g, p.id, {type:"bet", value:available[(g.round + g.players.indexOf(p)) % available.length]}, now);
        }
      }
      return g;
    }
    if(g.phase==="mini-intro"){
      for(const p of g.players.filter(p=>p.bot&&!p.passive))if(g.phase==="mini-intro"&&!g.mini!.runs[p.id].ready)g=applyPartyAction(g,p.id,{type:"ready"},now);
      return g;
    }
    if(activePartyPlayer(g).bot){const action=botBoardAction(g);if(action)g=applyPartyAction(g,activePartyPlayer(g).id,action,now);}
    return g;
  }
  skipTurns(current:PartyGame,now:number):PartyGame {
    let g=current;
    for(let i=0;i<64&&activePartyPlayer(g).bot&&!g.phase.startsWith("mini-");i++){
      if(g.phase==="moving"&&g.movement){g=tickParty(g,g.movement.arriveAt);continue;}
      const next=this.step(g,now,true);if(next===g)break;g=next;
    }
    return g;
  }
}
