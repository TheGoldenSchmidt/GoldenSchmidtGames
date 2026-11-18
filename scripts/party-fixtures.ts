import {NEUTRAL_MATCH_INPUT} from "../shared/matches/types";
import {createPartyGame,applyPartyAction,applyPartyControl,activePartyPlayer,tickParty,type PartyGame} from "../shared/party";
export function settleMovement(game:PartyGame){let g=game;for(let n=0;n<20&&g.phase==="moving";n++)g=tickParty(g,g.movement!.arriveAt);return g;}
/** Exercise the real opening reducer before tests that specifically target board rules. */
export function boardGame(...args:Parameters<typeof createPartyGame>){
 let g=createPartyGame(...args),online=g.online;g.online=true;let now=args[4]??Date.now();
 for(const p of g.players)g=applyPartyAction(g,p.id,{type:"ready"},now);
 now=g.mini!.startAt+100;
 // The opening may be a 3D arena or a match game; both take part through their normal inputs.
 for(const p of g.players){g=applyPartyControl(g,p.id,g.mini!.match?{...NEUTRAL_MATCH_INPUT,x:.1}:{x:.1,z:0,jump:false,punch:false},1,now);}
 for(const p of g.players)if(g.phase==="mini-play")g=applyPartyAction(g,p.id,{type:"finish"},now);
 if(g.mode==="roll-it-up"){for(const p of g.players)if(g.phase==="mini-result")g=applyPartyAction(g,p.id,{type:"next"},now);}else g=applyPartyAction(g,activePartyPlayer(g).id,{type:"next"},now);g.online=online;return g;
}
