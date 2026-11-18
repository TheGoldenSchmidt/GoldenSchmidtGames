import { createMatch, checkedMatchInput } from "./matches/framework";
import { parcoursModule, type ParcoursGame } from "./matches/parcours";
import { PRACTICE_STATIONS } from "./matches/proberaumCourse";
import { NEUTRAL_MATCH_INPUT, type MatchInput, type MatchState } from "./matches/types";
export { PRACTICE_STATIONS };
const engine=parcoursModule("proberaum");
export type PracticeState=MatchState<ParcoursGame>;
export function createProberaum():PracticeState {
  const state=createMatch("kreiselkurs",[{id:"practice",style:0},{id:"partner",style:1}],751) as PracticeState;
  state.id="proberaum";state.game=engine.create(state);visitStation(state,0);return state;
}
export function visitStation(s:PracticeState,index:number) {
  const station=PRACTICE_STATIONS[index];if(!station)throw new Error("Unbekannte Station");
  const blank=engine.create({...s});
  s.players.forEach((p,i)=>{s.game.racers[p.id]={...blank.racers[p.id],x:station.x+i*1.1,y:.05,z:station.z+i*.7,checkpoint:index,lastGround:s.time};p.input={...NEUTRAL_MATCH_INPUT};p.usedA=p.usedB=p.usedN=0;p.inputUntil=0;});
}
/** The same validated controls and fixed-step physics as the obstacle minigames. */
export function stepProberaum(s:PracticeState,raw:MatchInput) {
  const input=checkedMatchInput(raw),p=s.players[0];p.input=input;p.inputUntil=s.time+100;
  if(input.ca>p.usedA)engine.press?.(s,p,"a",s.time,input.n);
  if(input.cb>p.usedB)engine.press?.(s,p,"b",s.time,input.n);
  p.usedA=input.ca;p.usedB=input.cb;
  s.time+=50;engine.step(s,.05);
  const r=s.game.racers.practice;
  if(r.grounded){const near=PRACTICE_STATIONS.findIndex(p=>Math.hypot(p.x-r.x,p.z-r.z)<3);if(near>=0)r.checkpoint=near;}
}
