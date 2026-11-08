/** Deterministic 20 Hz simulation for practice and the authoritative multiplayer server. */
export const ACTION_MINI_IDS=["dash","crates","hurdles","shock","balance","tilt"] as const;
export type ArenaId=typeof ACTION_MINI_IDS[number];
export const isArenaId=(id:string):id is ArenaId=>(ACTION_MINI_IDS as readonly string[]).includes(id);
export const ARENA_STEP=50;
export const ARENA_META:Record<ArenaId,{name:string;seconds:number;instruction:string;jump:boolean;punch:boolean;tilt:boolean}>={
  dash:{name:"Schatzsprint",seconds:30,instruction:"Laufe zu den Münzen und springe über die niedrigen Hindernisse. Münzen zählen 1 Punkt, schwebende Kristalle 3 Punkte. Wer sammelt die meisten?",jump:true,punch:false,tilt:false},
  crates:{name:"Kistenkrawall",seconds:30,instruction:"Laufe zu den Kisten und schlage sie auf: jeder Treffer zählt 1 Punkt, die zerbrochene Kiste gibt zusätzlich 3 Punkte. Treffer schubsen andere Figuren; Sprünge weichen ihnen aus.",jump:true,punch:true,tilt:false},
  hurdles:{name:"Hafenhüpfer",seconds:35,instruction:"Laufe zum Leuchtturm und springe über fünf Hürden. Jede erreichte Flagge zählt 10 Punkte; das Ziel gibt 30 weitere. Wasser bringt dich zur letzten Flagge zurück.",jump:true,punch:false,tilt:false},
  shock:{name:"Wellenwache",seconds:30,instruction:"Bleib auf der Insel und springe über die sich ausbreitenden Wellen. Jede aktive Sekunde zählt 1 Punkt. Münzen bringen 2 Punkte; Wellentreffer kosten bis zu 2 Punkte.",jump:true,punch:false,tilt:false},
  balance:{name:"Wackelsteg",seconds:35,instruction:"Balanciere deine Figur über den gewundenen Steg zum Leuchtturm. Neige das Handy zum Lenken oder nutze den Stick. Fortschritt zählt; nach einem Sturz startest du an der letzten Flagge.",jump:false,punch:false,tilt:true},
  tilt:{name:"Kugelkapitäne",seconds:30,instruction:"Lenke deine Figur auf ihrer Kugel mit der Neigung des Handys. Sammle Kristalle für je 2 Punkte und umfahre die Löcher. Ein Sturz kostet bis zu 2 Punkte. Stick und Tastatur funktionieren ebenfalls.",jump:false,punch:false,tilt:true},
};
export interface ArenaInput {x:number;z:number;jump:boolean;punch:boolean}
export const NEUTRAL_INPUT:ArenaInput={x:0,z:0,jump:false,punch:false};
export interface ArenaActor {
  characterId?: import("./characters").CharacterId;
  id:string;style:number;x:number;z:number;y:number;vx:number;vz:number;vy:number;heading:number;
  score:number;checkpoint:number;falls:number;finished:boolean;played:boolean;
  input:ArenaInput;inputUntil:number;inputSeq:number;jumpHeld:boolean;punchHeld:boolean;
  jumpAt:number;punchAt:number;punchUntil:number;stunnedUntil:number;respawnAt:number;wave:number;feedback:string;
}
export interface ArenaPickup {id:number;x:number;z:number;y:number;value:number;readyAt:number}
export interface ArenaCrate {id:number;x:number;z:number;hp:number;readyAt:number}
export interface ArenaState {id:ArenaId;seed:number;time:number;actors:ArenaActor[];pickups:ArenaPickup[];crates:ArenaCrate[]}
export const DASH_BLOCKS=[{x:-2,z:-1,w:2,d:1},{x:2.6,z:1.2,w:2,d:1},{x:0,z:-3.6,w:2,d:.8}];
export const TILT_HOLES=[{x:-2.5,z:-1,r:.9},{x:2.5,z:1.5,r:.9},{x:1,z:-3,r:.8}];
export const HURDLES=[-2,-6,-10,-14,-18];
export const bridgeCenter=(z:number)=>Math.sin((z-2)*.35)*1.7;
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function checkedInput(input:unknown):ArenaInput {
  if(!input||typeof input!=="object")throw new Error("Ungültige Steuerung.");
  const value=input as ArenaInput;
  if(!Number.isFinite(value.x)||!Number.isFinite(value.z)||Math.abs(value.x)>1||Math.abs(value.z)>1||typeof value.jump!=="boolean"||typeof value.punch!=="boolean")throw new Error("Ungültige Steuerung.");
  const length=Math.max(1,Math.hypot(value.x,value.z));
  return {x:value.x/length,z:value.z/length,jump:value.jump,punch:value.punch};
}
export function createArena(id:ArenaId,players:{id:string;style:number;characterId?:import("./characters").CharacterId}[],seed:number):ArenaState {
  let randomSeed=seed>>>0;
  const random=()=>{randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;};
  const race=id==="hurdles"||id==="balance";
  const state:ArenaState={id,seed,time:0,actors:players.map((p,i)=>({
    ...p,x:race?id==="balance"?0:(i-(players.length-1)/2)*1.3:(i-(players.length-1)/2)*1.1,z:race?2:3.8,y:0,vx:0,vz:0,vy:0,heading:Math.PI,
    score:0,checkpoint:0,falls:0,finished:false,played:false,input:{...NEUTRAL_INPUT},inputUntil:0,inputSeq:0,jumpHeld:false,punchHeld:false,jumpAt:-1000,punchAt:-1000,punchUntil:0,stunnedUntil:0,respawnAt:0,wave:-1,feedback:"Los geht’s!",
  })),pickups:[],crates:[]};
  if(["dash","shock","tilt"].includes(id))for(let i=0;i<12;i++){
    let x=0,z=0;
    for(let attempt=0;attempt<100;attempt++){
      x=(random()-.5)*11;z=(random()-.5)*8;
      if(id==="shock"&&Math.hypot(x,z)>5)continue;
      if(id==="tilt"&&TILT_HOLES.some(h=>Math.hypot(x-h.x,z-h.z)<h.r+1))continue;
      if(id==="dash"&&DASH_BLOCKS.some(b=>Math.abs(x-b.x)<b.w/2+.6&&Math.abs(z-b.z)<b.d/2+.6))continue;
      if(state.pickups.some(p=>Math.hypot(x-p.x,z-p.z)<1.1))continue;
      break;
    }
    state.pickups.push({id:i,x,z,y:id==="dash"&&i%4===0?1.4:.5,value:id==="dash"?(i%4===0?3:1):2,readyAt:0});
  }
  if(id==="crates")for(let i=0;i<9;i++)state.crates.push({id:i,x:(i%3-1)*3,z:(Math.floor(i/3)-1)*2.8,hp:2,readyAt:0});
  return state;
}

function respawn(s:ArenaState,a:ArenaActor) {
  a.falls++;a.score=Math.max(0,a.score-2);a.respawnAt=s.time+900;a.vx=0;a.vz=0;a.y=0;a.vy=0;
  a.feedback="Platsch! Zurück auf die Insel.";
  if(s.id==="balance"||s.id==="hurdles"){a.z=a.checkpoint?1.2-a.checkpoint*4:2;a.x=s.id==="balance"?bridgeCenter(a.z):0;}
  else {a.x=0;a.z=3.8;}
}
function moveActor(s:ArenaState,a:ArenaActor,dt:number) {
  if(a.finished||s.time<a.respawnAt)return;
  const meta=ARENA_META[s.id],input=s.time<=a.inputUntil?a.input:NEUTRAL_INPUT;
  const canMove=s.time>=a.stunnedUntil;
  if(meta.jump&&input.jump&&!a.jumpHeld&&a.y===0&&s.time-a.jumpAt>=350&&canMove){a.vy=7.5;a.jumpAt=s.time;}
  a.jumpHeld=input.jump;
  if(meta.punch&&input.punch&&!a.punchHeld&&s.time-a.punchAt>=600&&canMove){a.punchAt=s.time;a.punchUntil=s.time+260;}
  a.punchHeld=input.punch;
  a.vy-=20*dt;a.y=Math.max(0,a.y+a.vy*dt);if(a.y===0)a.vy=0;
  const speed=s.id==="balance"?3.6:4.8,inertia=meta.tilt?.12:.48;
  if(canMove){a.vx+=(input.x*speed-a.vx)*inertia;a.vz+=(input.z*speed-a.vz)*inertia;}
  else {a.vx*=.85;a.vz*=.85;}
  if(Math.hypot(a.vx,a.vz)>.15)a.heading=Math.atan2(a.vx,a.vz);
  let x=a.x+a.vx*dt,z=a.z+a.vz*dt;
  if(s.id==="dash"&&a.y<1.05)for(const b of DASH_BLOCKS){if(Math.abs(x-b.x)<b.w/2+.32&&Math.abs(z-b.z)<b.d/2+.32){if(Math.abs(a.x-b.x)>=b.w/2+.31)x=a.x;else z=a.z;}}
  if(s.id==="hurdles"&&a.y<1.05)for(const bar of HURDLES){if(Math.abs(z-bar)<.42&&Math.abs(x)<5.5){z=a.z;}}
  if(s.id==="crates")for(const crate of s.crates)if(crate.hp>0&&Math.abs(x-crate.x)<.9&&Math.abs(z-crate.z)<.9){x=a.x;z=a.z;}
  a.x=x;a.z=z;
  if(s.id==="hurdles"||s.id==="balance"){
    if(s.id==="balance"&&Math.abs(x-bridgeCenter(z))>1.02||s.id==="hurdles"&&Math.abs(x)>5.9){respawn(s,a);return;}
    a.z=Math.min(3,a.z);
    const checkpoint=Math.min(5,Math.max(0,Math.floor((1-a.z)/4)));
    if(checkpoint>a.checkpoint){a.score+=(checkpoint-a.checkpoint)*10;a.checkpoint=checkpoint;a.feedback="Flagge erreicht!";}
    if(a.z<=-21){a.score+=30;a.finished=true;a.feedback="Ziel erreicht!";a.vx=0;a.vz=0;a.y=0;a.vy=0;}
  }else if(s.id==="shock"){
    if(Math.hypot(x,z)>6.3){respawn(s,a);return;}
    const radius=Math.hypot(x,z),waveIndex=Math.floor((s.time-700)/3500);
    for(let wave=Math.max(0,waveIndex-1);wave<=waveIndex;wave++){
      const previous=(s.time-ARENA_STEP-700-wave*3500)/1000*2.7,current=(s.time-700-wave*3500)/1000*2.7;
      if(wave>a.wave&&previous<=radius+.4&&current>=radius-.4&&current>=0&&current<7){a.wave=wave;if(a.y<.9){a.score=Math.max(0,a.score-2);a.stunnedUntil=s.time+450;a.vx=x/Math.max(.1,radius)*6;a.vz=z/Math.max(.1,radius)*6;a.feedback="Welle erwischt!";}else a.feedback="Welle übersprungen!";}
    }
    if(s.time%1000===0&&a.played)a.score++;
  }else {
    if(s.id==="tilt"&&(Math.abs(x)>6.7||Math.abs(z)>5||TILT_HOLES.some(h=>Math.hypot(x-h.x,z-h.z)<h.r-.05))){respawn(s,a);return;}
    a.x=clamp(a.x,-6.6,6.6);a.z=clamp(a.z,-4.9,4.9);
  }
}
export function advanceArena(s:ArenaState,elapsed:number) {
  const until=clamp(Math.floor(elapsed/ARENA_STEP)*ARENA_STEP,0,ARENA_META[s.id].seconds*1000);
  while(s.time<until){s.time+=ARENA_STEP;
    for(const crate of s.crates)if(crate.hp===0&&s.time>=crate.readyAt)crate.hp=2;
    for(const a of s.actors)moveActor(s,a,ARENA_STEP/1000);
    for(const a of s.actors){
      if(a.finished||s.time<a.respawnAt)continue;
      for(const pickup of s.pickups)if(s.time>=pickup.readyAt&&Math.hypot(a.x-pickup.x,a.z-pickup.z)<.75&&Math.abs(a.y+.5-pickup.y)<.8){a.score+=pickup.value;pickup.readyAt=s.time+3000;a.feedback=`+${pickup.value} ${pickup.value===1?"Münze":"Schätze"}!`;}
      if(a.punchAt===s.time){
        const hit=(x:number,z:number)=>Math.hypot(a.x-x,a.z-z)<1.9&&((x-a.x)*Math.sin(a.heading)+(z-a.z)*Math.cos(a.heading))>-.25;
        for(const crate of s.crates)if(crate.hp>0&&hit(crate.x,crate.z)){crate.hp--;a.score++;a.feedback="Treffer!";if(crate.hp===0){a.score+=3;crate.readyAt=s.time+3500;a.feedback="Kiste geknackt! +4 Punkte";}}
        for(const other of s.actors)if(other.id!==a.id&&!other.finished&&s.time>=other.respawnAt&&other.y<.8&&hit(other.x,other.z)){const dx=other.x-a.x,dz=other.z-a.z,n=Math.max(.1,Math.hypot(dx,dz));other.vx=dx/n*9;other.vz=dz/n*9;other.stunnedUntil=s.time+400;other.feedback="Angeschubst!";}
      }
    }
  }
  return s;
}
export function setArenaControl(s:ArenaState,id:string,input:unknown,seq:number) {
  const actor=s.actors.find(a=>a.id===id);if(!actor)throw new Error("Diese Figur gehört nicht zu deinem Versuch.");
  if(!Number.isSafeInteger(seq)||seq<=0)throw new Error("Ungültige Eingabefolge.");
  const value=checkedInput(input);
  if(seq<=actor.inputSeq)return false;
  actor.inputSeq=seq;actor.input=value;actor.inputUntil=s.time+300;
  if(Math.hypot(value.x,value.z)>.08||value.jump||value.punch)actor.played=true;
  return true;
}
export function publicArena(s:ArenaState,viewer:string):ArenaState {
  const result=structuredClone(s);
  for(const actor of result.actors)if(actor.id!==viewer)actor.input={...NEUTRAL_INPUT};
  return result;
}
