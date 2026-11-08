import {createPartyGame,applyPartyAction,applyPartyControl,activePartyPlayer,tickParty,type PartyGame} from "../shared/party";
export function settleMovement(game:PartyGame){let g=game;for(let n=0;n<20&&g.phase==="moving";n++)g=tickParty(g,g.movement!.arriveAt);return g;}
/** Exercise the real opening reducer before tests that specifically target board rules. */
export function boardGame(...args:Parameters<typeof createPartyGame>){
 let g=createPartyGame(...args),online=g.online;g.online=true;let now=args[4]??Date.now();
 for(const p of g.players)g=applyPartyAction(g,p.id,{type:"ready"},now);
 now=g.mini!.startAt+100;
 for(const p of g.players){g=applyPartyControl(g,p.id,{x:.1,z:0,jump:false,punch:false},1,now);}
 for(const p of g.players)g=applyPartyAction(g,p.id,{type:"finish"},now);
 g=applyPartyAction(g,activePartyPlayer(g).id,{type:"next"},now);g.online=online;return g;
}
