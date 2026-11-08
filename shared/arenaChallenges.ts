import type {ArenaActor,ArenaState} from "./partyArena";
export const CHALLENGE_IDS=["walls","hex","photo","bumper","says","stack","golf","duos"] as const;
export const HEX_COLORS=["#f5c953","#60bfe0","#ee8173","#9b83d7","#76c987","#ed9a52","#e886b5"];
export const HEX_NAMES=["Gold","Blau","Koralle","Violett","Grün","Orange","Rosa"];
export const HEX_PLATFORMS=[{x:0,z:0},...Array.from({length:6},(_,i)=>({x:Math.cos(i*Math.PI/3)*3.5,z:Math.sin(i*Math.PI/3)*3.5}))];
export const COMMAND_ZONES=[{x:0,z:-3.2,name:"Anker",icon:"⚓",color:0x60bfe0},{x:3.2,z:0,name:"Sonne",icon:"☀",color:0xf5c953},{x:0,z:3.2,name:"Blatt",icon:"♣",color:0x76c987},{x:-3.2,z:0,name:"Stern",icon:"★",color:0x9b83d7},{x:0,z:0,name:"Mitte",icon:"●",color:0xfff9e8}];
export const GOLF_GATES=[{z:-3,gapX:-3},{z:-9,gapX:2.5},{z:-15,gapX:-2}];
export const DUO_SWITCHES=[{z:0,left:-3,right:3,gate:-4},{z:-9,left:-3,right:3,gate:-12}];
export function roundValue(seed:number,round:number,salt=0){let v=(seed^Math.imul(round+1,0x9e3779b1)^salt)>>>0;v=Math.imul(v^(v>>>16),0x85ebca6b)>>>0;return (v^(v>>>13))>>>0;}
export function wallHoles(s:ArenaState){const round=Math.floor(s.time/6000),one=roundValue(s.seed,round)%9;let two=roundValue(s.seed,round,73)%9;if(two===one)two=(two+4)%9;return [one,two];}
export const wallCell=(x:number,z:number)=>Math.max(0,Math.min(2,Math.floor((x+6.6)/4.4)))+Math.max(0,Math.min(2,Math.floor((z+4.8)/3.2)))*3;
export const wallCellPoint=(cell:number)=>({x:(cell%3-1)*4.4,z:(Math.floor(cell/3)-1)*3.2});
export const insideHex=(x:number,z:number,margin=0)=>Math.abs(x)<=Math.sqrt(3)-margin&&Math.abs(x)*.5+Math.abs(z)*Math.sqrt(3)/2<=Math.sqrt(3)-margin;
export const hexCue=(s:ArenaState)=>roundValue(s.seed,Math.floor(s.time/6000),17)%7;
export const photoSpot=(s:ArenaState)=>[{x:-3,z:-2},{x:3,z:-2},{x:0,z:2},{x:0,z:0}][roundValue(s.seed,Math.floor(s.time/5000),23)%4];
export function saysCue(s:ArenaState){const round=Math.floor(s.time/6000);let previous=4;for(let i=0;i<round;i++)if(i===0||roundValue(s.seed,i,31)%3!==0)previous=roundValue(s.seed,i,37)%4;const obey=round===0||roundValue(s.seed,round,31)%3!==0,target=roundValue(s.seed,round,37)%4;return {obey,target,expected:obey?target:previous};}
export function stackFloor(s:ArenaState,x:number,z:number,y:number){let top=0;for(const b of s.blocks??[])if(s.time>=b.landAt&&Math.abs(x-b.x)<.9&&Math.abs(z-b.z)<.9&&b.baseY+1.1<=y+.12)top=Math.max(top,b.baseY+1.1);return top;}
export function blockY(b:{startAt:number;landAt:number;baseY:number},time:number){return time<b.startAt?9:time>=b.landAt?b.baseY:b.baseY+8*(1-(time-b.startAt)/(b.landAt-b.startAt));}
export function challengeSetup(s:ArenaState){
  if(s.id==="hex"||s.id==="says")s.actors.forEach((a,i)=>{a.x=(i%3-1)*.95;a.z=Math.floor(i/3)*.95-.5;});
  if(s.id==="golf"||s.id==="duos")s.actors.forEach((a,i)=>{a.x=(i-(s.actors.length-1)/2)*1.3;a.z=2;});
  if(s.id==="duos"){s.gates=[false,false];s.switches=[false,false,false,false];}
  if(s.id==="stack"){
    const levels=new Map<number,number>();s.blocks=[];
    for(let i=0;i<20;i++){const cell=roundValue(s.seed,i,79)%20,baseY=(levels.get(cell)??0)*1.1;levels.set(cell,(levels.get(cell)??0)+1);s.blocks.push({id:i,x:(cell%5-2)*2.2,z:(Math.floor(cell/5)-1.5)*2.2,startAt:2000+i*1500,landAt:3500+i*1500,baseY});}
  }
}
export function challengeTick(s:ArenaState){
  if(s.id==="duos")for(const [i,plate] of DUO_SWITCHES.entries()){
    if(s.gates![i])continue;
    const active=s.actors.filter(a=>!a.finished&&s.time>=a.respawnAt);
    const left=active.some(a=>Math.hypot(a.x-plate.left,a.z-plate.z)<.95),right=active.some(a=>Math.hypot(a.x-plate.right,a.z-plate.z)<.95);
    s.switches![i*2] ||= left;s.switches![i*2+1] ||= right;
    if(active.length===1?s.switches![i*2]&&s.switches![i*2+1]:left&&right){s.gates![i]=true;for(const a of active){a.score+=10;a.feedback="Zusammen geöffnet! +10 Punkte";}}
  }
  if(s.id==="photo"&&s.time%5000===4500){const spot=photoSpot(s),ranked=s.actors.filter(a=>!a.finished&&s.time>=a.respawnAt&&a.played).sort((a,b)=>Math.hypot(a.x-spot.x,a.z-spot.z)-Math.hypot(b.x-spot.x,b.z-spot.z)||a.id.localeCompare(b.id));for(const [i,a] of ranked.entries()){const points=[10,4,2][i]??0;if(Math.hypot(a.x-spot.x,a.z-spot.z)<4){a.score+=points;a.feedback=`Foto! +${points} Punkte`;}}}
}
export function challengeSolid(s:ArenaState,a:ArenaActor,x:number,z:number){
  if(s.id==="golf")for(const gate of GOLF_GATES)if(Math.abs(z-gate.z)<.5&&Math.abs(x-gate.gapX)>1.15)return true;
  if(s.id==="duos"){
    for(const [i,plate] of DUO_SWITCHES.entries())if(!s.gates?.[i]&&Math.abs(z-plate.gate)<.5)return true;
    if(a.y<1.05&&[-7,-16,-19].some(bar=>Math.abs(z-bar)<.4))return true;
  }
  if(s.id==="stack")for(const b of s.blocks??[])if(s.time>=b.landAt&&Math.abs(x-b.x)<1.2&&Math.abs(z-b.z)<1.2&&a.y<b.baseY+1.05&&a.y+1.3>b.baseY)return true;
  return false;
}
function finishRace(s:ArenaState,a:ArenaActor){a.score+=30+Math.max(0,Math.ceil((s.id==="golf"?45000:50000)-s.time)/1000);a.score=Math.floor(a.score);a.finished=true;a.feedback="Ziel erreicht!";a.vx=0;a.vz=0;}
export function challengeMove(s:ArenaState,a:ArenaActor,previousY:number,fall:(s:ArenaState,a:ArenaActor)=>void){
  if(!(CHALLENGE_IDS as readonly string[]).includes(s.id))return false;
  const fail=(message?:string)=>{fall(s,a);if(message&&!a.eliminated)a.feedback=message+" · halbe Punkte";};
  if(s.id==="golf"||s.id==="duos"){
    if(Math.abs(a.x)>6||a.z>4.5||a.z<-24){fail();return true;}
    const checkpoint=Math.min(5,Math.max(0,Math.floor((1-a.z)/4)));
    if(checkpoint>a.checkpoint){a.score+=(checkpoint-a.checkpoint)*10;a.checkpoint=checkpoint;a.feedback="Flagge erreicht!";}
    if(s.id==="golf"?Math.hypot(a.x,a.z+21.8)<.85:a.z<-21.5)finishRace(s,a);
    return true;
  }
  if(s.id==="bumper"||s.id==="hex"){
    if(s.id==="hex"?!HEX_PLATFORMS.some(p=>insideHex(a.x-p.x,a.z-p.z,-.08)):Math.hypot(a.x,a.z)>6.3){fail();return true;}
  }else if(Math.abs(a.x)>6.6||Math.abs(a.z)>4.9){fail();return true;}
  if(s.id==="walls"&&s.time%6000===4500){if(!wallHoles(s).includes(wallCell(a.x,a.z)))fail("Wand erwischt");else if(a.played){a.score+=10;a.feedback="Lücke gefunden! +10 Punkte";}}
  if(s.id==="hex"){
    const phase=s.time%6000,target=HEX_PLATFORMS[hexCue(s)];
    if(phase>=3900&&phase<5500&&a.y<.5&&!insideHex(a.x-target.x,a.z-target.z,.1)){fail();return true;}
    if(phase===5500&&a.played){a.score+=10;a.feedback="Sicher! +10 Punkte";}
  }
  if(s.id==="says"&&s.time%6000===4000){const cue=saysCue(s),zone=COMMAND_ZONES[cue.expected];if(Math.hypot(a.x-zone.x,a.z-zone.z)>1.65)fail(cue.obey?"Kommando verpasst":"Auf Täuschung reagiert");else if(a.played){a.score+=10;a.feedback=cue.obey?"Richtig reagiert! +10 Punkte":"Täuschung erkannt! +10 Punkte";}}
  if(s.id==="bumper"&&s.time%1000===0&&a.played)a.score++;
  if(s.id==="stack"){
    if(s.time%1000===0&&a.played)a.score+=1+Math.floor(a.y);
    for(const b of s.blocks??[]){if(s.time<b.startAt||s.time>=b.landAt||a.lastBlockHit===b.id)continue;const y=blockY(b,s.time),before=blockY(b,s.time-50);if(Math.abs(a.x-b.x)<1.15&&Math.abs(a.z-b.z)<1.15&&before>=previousY+1.1&&y<=a.y+1.4){a.lastBlockHit=b.id;a.stunnedUntil=s.time+500;const dx=a.x-b.x||1,dz=a.z-b.z||.3,d=Math.hypot(dx,dz);a.vx=dx/d*7;a.vz=dz/d*7;a.score=Math.max(0,a.score-2);a.feedback="Kiste erwischt! −2 Punkte";}}
  }
  return true;
}
export function challengeCue(s:ArenaState):string {
  if(s.id==="walls")return `Wand ${Math.floor(s.time/6000)+1}: Suche eine Öffnung!`;
  if(s.id==="hex")return `Sicher: ${hexCue(s)+1} · ${HEX_NAMES[hexCue(s)]}${s.time%6000>=3500?" – bleib oben!":" – lauf zur Plattform!"}`;
  if(s.id==="photo")return `Foto in ${Math.max(0,Math.ceil((4500-s.time%5000)/1000))} Sekunden`;
  if(s.id==="says"){const cue=saysCue(s);return `${cue.obey?"Kapitän sagt: ":""}${COMMAND_ZONES[cue.target].icon} ${COMMAND_ZONES[cue.target].name}!`;}
  if(s.id==="duos")return s.gates?.every(Boolean)?"Beide Tore offen – gemeinsam ins Ziel!":`Tor ${(s.gates?.findIndex(open=>!open)??0)+1}: Besetzt beide goldenen Platten!`;
  if(s.id==="golf")return "Durch die Öffnungen zum roten Zielfähnchen";
  if(s.id==="stack")return "Achte auf die roten Landezonen!";
  if(s.id==="bumper")return "Bleib auf der Insel und remple die anderen herunter!";
  return "Erster Sturz: halbe Punkte · zweiter Sturz: ausgeschieden";
}

export const CHALLENGE_HINTS:Record<string,string>={walls:"In die Öffnungen der fallenden Wand laufen",hex:"Zur angesagten Farbplattform laufen und andere wegschubsen",photo:"Um den goldenen Fotoplatz kämpfen",bumper:"Andere Kugeln von der Insel rempeln",says:"Nur echte Kapitänskommandos befolgen",stack:"Kisten ausweichen und auf die Stapel springen",golf:"Mit Neigung oder Stick durch den Hindernisparcours",duos:"Zusammen Schalter besetzen, Tore öffnen und springen"};
