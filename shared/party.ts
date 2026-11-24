import { advanceArena, ARENA_META, createArena, isArenaId, NEUTRAL_INPUT, publicArena, setArenaControl, type ArenaId, type ArenaInput, type ArenaState } from "./partyArena";
import { defaultLook, isMiniLook, lookChoices, matchIdForLook, type MiniLook, type MiniRenderer, type MiniView } from "./minigameLooks";
import { advanceMatch, createMatch, finishMatch, isMatchId, MATCH_IDS, MATCH_MODULES, matchStandings, neutralizeMatch, publicMatch, removeMatchPlayer, setMatchControl, type MatchId } from "./matches/framework";
import type { MatchState } from "./matches/types";
import { miniEligible, miniFamily, miniPool, type PlayableMiniId } from "./minigameCatalog";
import { partyBoard, partyPaths, fieldCoins, fieldLabel, FINAL_ROUNDS, hasFullSet, isFinalStretch, stationAt, JAYSPOT, TROPHY_SHOPS } from "./partyBoard";
import { characterId, type CharacterId } from "./characters";
import { checkMinigameSetup, isMinigameMode, minigameOptions, placeMinigameBet, type MinigameCompetition, type MinigameMode, type MinigameOptions } from "./minigameModes";
/** `classic` keeps the 1st generation minigames in the draw. */
export interface PartyOptions { rounds: number; classic?: boolean }
export const PARTY_DEFAULTS: PartyOptions = { rounds: 8, classic: true };
/** Price of a trophy at the trophy stand (Inselparty). */
export const TROPHY_PRICE = 15;
/** Trophies one visit at the trophy stand can buy. */
export const MAX_TROPHIES_PER_VISIT = 2;
/** Time a figure needs for one board step. */
export const PARTY_STEP_MS = 320;
export type Item = "sprint" | "double" | "shield" | "magnet" | "compass";
export const ITEMS: Record<Item, { name: string; price: number; icon: string; description: string }> = {
  sprint: { name: "Sprintschuhe", price: 5, icon: "➜", description: "+3 Schritte beim nächsten Wurf" },
  double: { name: "Doppelwürfel", price: 8, icon: "⚄", description: "Zwei Würfel statt einem" },
  shield: { name: "Schutzschild", price: 6, icon: "⬡", description: "Wehrt einmal Pech oder Diebstahl ab" },
  magnet: { name: "Münzangel", price: 7, icon: "⚓", description: "Bis zu 5 Münzen von einer Person nehmen" },
  compass: { name: "Reisekompass", price: 6, icon: "✥", description: "Vor dem Wurf zu einem Shop reisen" }
};
export const ITEM_IDS = Object.keys(ITEMS) as Item[];
/**
 * Duel fields (Inselparty): whoever lands there challenges another player and
 * names a stake; both pay it into the pot and play a short 1v1 game from the
 * duel pool while the others watch. The winner takes the pot; a draw refunds it.
 */
export const DUEL = { maxStake: 10, minis: ["quickdraw", "sumo", "bumpercars", "pong", "tanks", "trails"] as const satisfies readonly MatchId[] };
export interface PartyDuel { field: number; challenger: string; opponent: string; stake: number; winner?: string; draw?: boolean }
/** Players the active player can challenge (with coins of their own) and the highest possible stake against each. */
export function duelTargets(g: PartyGame) {
  const p = activePartyPlayer(g);
  return g.players.filter(o => o.id !== p.id && !o.passive && o.coins > 0).map(o => ({ id: o.id, max: Math.min(DUEL.maxStake, p.coins, o.coins) })).filter(o => o.max > 0);
}
export { BOARD, FIELD_ICONS, FIELD_LABELS, FINAL_ROUNDS, fieldLabel, isFinalStretch, TROPHY_SHOPS, type Field } from "./partyBoard";
export type MiniId = ArenaId | MatchId;
/** `instruction`: the short intro text; `rules`: optional details behind „Alle Regeln“. */
export const MINIS: Record<MiniId, { name: string; seconds: number; instruction: string; rules?: string }> = {
  ...ARENA_META,
  ...Object.fromEntries(MATCH_IDS.map(id => [id, { name: MATCH_MODULES[id].meta.name, seconds: MATCH_MODULES[id].meta.seconds, instruction: MATCH_MODULES[id].meta.instruction, rules: MATCH_MODULES[id].meta.rules }])) as Record<MatchId, { name: string; seconds: number; instruction: string; rules?: string }>
};
export interface PartyPlayer { id: string; name: string; characterId?: CharacterId; bot?: boolean; position: number; supplies?: number[]; coins: number; trophies: number; wins: number; items: Item[]; shield: boolean; passive: boolean; walked?: number; lost?: number; duels?: number; spent?: number; found?: number }
export interface MiniRun { ready: boolean; done: boolean; score: number; feedback: string; lastInput: number }
/** `resultReady`: humans who confirmed the result; the game continues once all active humans have. */
export interface PartyMini { resultReady?: string[]; id: MiniId; startAt: number; runs: Record<string, MiniRun>; arenaSeed?:number; arena?:ArenaState; match?: MatchState; /** Rendering and view chosen by the host (minigames with a choice only). */ look?: MiniLook }
export type PartyPhase = "turn" | "moving" | "path" | "trophy" | "supply" | "shop" | "gift" | "duel" | "summary" | "mini-bet" | "mini-intro" | "mini-play" | "mini-result" | "finished" | "aborted";
export interface PartyGame {
  mode?: "party" | "roll-it-up" | MinigameMode;
  competition?: MinigameCompetition;
  serverTime?: number;
  opening:boolean;movement?:{destination:number;departAt:number;arriveAt:number};
  /** Inselparty: help for the last places when the last rounds begin. */
  finalStretch?: { round: number; help: { id: string; item?: Item; coins?: number }[] };
  /** Inselparty: bonus trophies announced at the start (missing in older rooms: the former three). */
  bonusPicks?: BonusTrophyId[];
  /** Inselparty: bonus trophies awarded at the end; they count like bought trophies. */
  bonus?: { id: BonusTrophyId; winners: string[]; value: number }[];
  /** Inselparty: the running duel (set from the stake until the result is confirmed). */
  duel?: PartyDuel;
  /** Last duel game, so two duels in a row do not repeat it. */
  lastDuelMini?: MiniId;
  version: 1; options: PartyOptions; online: boolean; players: PartyPlayer[]; order: string[]; round: number; turn: number;
  phase: PartyPhase; phaseId: number; deadline: number; rng: number; steps: number; dice: number[]; path: number[];
  itemUsed: boolean; boost: number; double: boolean; trophyField: number; trophyBought: boolean; offered?: Item;
  events: number[]; miniBag: MiniId[]; lastMini?: MiniId; mini?: PartyMini; localMiniIndex: number; log: string[]; winners: string[];
  seq: Record<string, number>; disconnected: Record<string, number>; pausedAt: number; resumeOffered: boolean;
}
export type PartyAction =
  | { type: "bet"; value: number }
  | { type: "roll" } | { type: "item"; index: number; target?: string; destination?: number }
  | { type: "path"; destination: number } | { type: "trophy"; buy: boolean; count?: number } | { type: "supply"; buy: boolean }
  | { type: "shop"; item?: Item; replace?: number } | { type: "gift"; accept: boolean; replace?: number }
  | { type: "duel"; target?: string; stake?: number }
  | { type: "next" } | { type: "ready" } | { type: "finish" } | { type: "resume" } | { type: "abort" }
  | { type: "look"; renderer: MiniRenderer; view: MiniView };

/** Older clients may still send `tempo`/`analog`; both are ignored. */
export function partyOptions(value?: Partial<PartyOptions>): PartyOptions {
  const rounds = value?.rounds ?? PARTY_DEFAULTS.rounds, classic = value?.classic ?? true;
  if (!Number.isInteger(rounds) || rounds < 5 || rounds > 15 || typeof classic !== "boolean") throw new Error("Ungültige Inselparty-Einstellungen.");
  return { rounds, classic };
}
function random(g: PartyGame) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function shuffle<T>(g: PartyGame, source: readonly T[]): T[] { const result = [...source]; for (let i=result.length-1;i>0;i--) { const j=Math.floor(random(g)*(i+1)); [result[i],result[j]]=[result[j],result[i]]; } return result; }
function log(g: PartyGame, message: string) { g.log = [...g.log.slice(-11),message]; }
export function activePartyPlayer(g: PartyGame) { return g.players.find(p => p.id === g.order[g.turn])!; }
function progress(g: PartyGame, p: PartyPlayer) { return g.mode === 'roll-it-up' ? p.supplies?.length ?? 0 : p.trophies; }
export function partyStanding(g: PartyGame) { return [...g.players].sort((a,b) => progress(g,b)-progress(g,a) || b.coins-a.coins || b.wins-a.wins); }
export type BonusTrophyId = "minis" | "walker" | "unlucky" | "duelist" | "shopper" | "finder";
export const BONUS_TROPHIES: { id: BonusTrophyId; name: string; label: string; stat: (p: PartyPlayer) => number }[] = [
  { id: "minis", name: "Minispiel-Ass", label: "Meiste Minispielsiege", stat: p => p.wins },
  { id: "walker", name: "Weltenbummler", label: "Meiste gelaufene Felder", stat: p => p.walked ?? 0 },
  { id: "unlucky", name: "Pechvogel", label: "Meiste verlorene Münzen", stat: p => p.lost ?? 0 },
  { id: "duelist", name: "Duellkönig", label: "Meiste gewonnene Duelle", stat: p => p.duels ?? 0 },
  { id: "shopper", name: "Marktkönig", label: "Meiste Münzen im Inselmarkt ausgegeben", stat: p => p.spent ?? 0 },
  { id: "finder", name: "Glückspilz", label: "Meiste Münzen von Plus- und Ereignisfeldern", stat: p => p.found ?? 0 }
];
/** Minispiel-Ass always, plus one bonus drawn from the seed (without touching the game's random state). */
export function pickBonusTrophies(seed: number): BonusTrophyId[] {
  const others = BONUS_TROPHIES.slice(1).map(b => b.id), mixed = (Math.imul(seed >>> 0, 2654435761) >>> 0) % others.length;
  return ["minis", others[mixed]];
}
export const bonusTrophies = (g: PartyGame) => (g.bonusPicks ?? ["minis", "walker", "unlucky"]).map(id => BONUS_TROPHIES.find(b => b.id === id)!);
/** Current leaders of a bonus trophy (nobody while the best value is 0). */
export function bonusLeaders(g: PartyGame, id: BonusTrophyId) {
  const stat = BONUS_TROPHIES.find(b => b.id === id)!.stat, value = Math.max(...g.players.map(stat));
  return { value, players: value > 0 ? g.players.filter(p => stat(p) === value) : [] };
}
/** Every player with the highest value receives the bonus trophy; nobody receives it for a value of 0. */
function awardBonusTrophies(g:PartyGame){
  g.bonus=bonusTrophies(g).map(({id,name,stat})=>{
    const value=Math.max(...g.players.map(stat)),winners=value>0?g.players.filter(p=>stat(p)===value):[];
    for(const p of winners)p.trophies++;
    if(winners.length)log(g,`Bonus-Trophäe ${name}: ${winners.map(p=>p.name).join(" & ")}.`);
    return {id,winners:winners.map(p=>p.id),value};
  });
}
function finishParty(g:PartyGame,now:number){if((g.mode??"party")==="party"&&!g.bonus)awardBonusTrophies(g);const first=partyStanding(g)[0];g.winners=g.players.filter(p=>p.trophies===first.trophies&&p.coins===first.coins&&p.wins===first.wins).map(p=>p.id);phase(g,"finished",now);}
function phase(g: PartyGame, next: PartyPhase, now: number) {
  g.phase = next; g.phaseId++;
  g.deadline = 0;
  if(next!=="moving")g.movement=undefined;

}
export function createPartyGame(players: {id:string;name:string;characterId?:CharacterId;bot?:boolean}[], options?: Partial<PartyOptions>, online=false, seed=Date.now(), now=Date.now(), mode: PartyGame['mode']='party', minis?: Partial<MinigameOptions>): PartyGame {
  if (players.length<2 || players.length>6 || new Set(players.map(p=>p.id)).size!==players.length) throw new Error("Inselparty benötigt 2–6 unterschiedliche Spieler.");
  const g: PartyGame = { mode,opening:true,version:1, options:partyOptions(options), online, players:players.map(p=>({...p,...(mode==='roll-it-up'?{supplies:[]}:{}),position:0,coins:10,trophies:0,wins:0,items:[],shield:false,passive:false})), order:players.map(p=>p.id), round:1,turn:0,phase:"turn",phaseId:0,deadline:0,rng:seed>>>0,steps:0,dice:[],path:[],itemUsed:false,boost:0,double:false,trophyField:6,trophyBought:false,events:[],miniBag:[],localMiniIndex:0,log:[],winners:[],seq:{},disconnected:{},pausedAt:0,resumeOffered:false };
  g.players.forEach((p,i)=>p.characterId=characterId(p.characterId,i));
  g.order=shuffle(g,g.order);
  if (isMinigameMode(mode)) {
    const settings = minigameOptions(minis);
    checkMinigameSetup(mode, settings, players.length);
    g.options.classic = settings.classic;
    g.opening = false;
    g.players.forEach(p => p.coins = 0);
    g.competition = { rounds: mode === "free-minigame" ? 1 : settings.rounds, scores: Object.fromEntries(players.map(p => [p.id, 0])), used: Object.fromEntries(players.map(p => [p.id, []])), bets: {}, locked: [], history: [] };
    if (mode === "free-minigame") g.miniBag = [settings.miniId];
    selectMini(g, now);
  } else {
    if (mode === "party") g.bonusPicks = pickBonusTrophies(seed);
    selectMini(g,now);log(g,"Das Auftakt-Minispiel bestimmt eure feste Zugreihenfolge. Bei Gleichstand entscheidet das Los.");
  }
  return g;
}
function lose(g: PartyGame, p: PartyPlayer, amount: number) { if (p.shield) { p.shield=false; log(g,`${p.name}: Schutzschild wehrt den Verlust ab.`); return 0; } const n=Math.min(amount,p.coins); p.coins-=n; p.lost=(p.lost??0)+n; return n; }
function addItem(p: PartyPlayer, item: Item, replace?: number) {
  if (p.items.length<3) p.items.push(item);
  else { if (!Number.isInteger(replace) || replace!<0 || replace!>=3) throw new Error("Wähle ein Item zum Ersetzen."); p.items[replace!]=item; }
}
function event(g: PartyGame) {
  if (!g.events.length) g.events=shuffle(g,[0,1,2,3,4,5]);
  const p=activePartyPlayer(g), e=g.events.pop()!;
  if(e===0) {p.coins+=5;p.found=(p.found??0)+5;log(g,"Strandfund: +5 Münzen.");}
  if(e===1) {g.players.forEach(p=>p.coins+=2);log(g,"Inselrunde: alle erhalten 2 Münzen.");}
  if(e===2 || e===5) {g.offered=e===2?"sprint":"shield";log(g,`Marktgeschenk: ${ITEMS[g.offered].name}.`);}
  if(e===3) {lose(g,p,4);log(g,"Reparatur: bis zu 4 Münzen abgeben.");}
  if(e===4) { const last=partyStanding(g).at(-1)!; g.players.filter(p=>progress(g,p)===progress(g,last)&&p.coins===last.coins&&p.wins===last.wins).forEach(p=>p.coins+=5); log(g,"Hilfslieferung: die Letztplatzierten erhalten 5 Münzen."); }
}
function land(g: PartyGame, now:number) {
  const p=activePartyPlayer(g), field=partyBoard(g)[p.position];
  log(g,`${p.name}: ${g.mode==="roll-it-up" && field.id===0?"Start":fieldLabel(g,field.type)}.`);
  if(field.type==="coin") {p.coins+=fieldCoins(g);p.found=(p.found??0)+fieldCoins(g);}
  if(field.type==="bad") lose(g,p,fieldCoins(g));
  if(field.type==="event") event(g);
  if(field.type==="gift") g.offered=ITEM_IDS[Math.floor(random(g)*5)];
  if(field.type==="duel"&&(g.mode??"party")==="party"){
    if(duelTargets(g).length){phase(g,"duel",now);return;}
    log(g,p.coins>0?"Niemand hat Münzen für ein Duell.":"Ohne Münzen kein Duell.");
  }
  if(g.offered) phase(g,"gift",now); else phase(g,field.type==="shop"?"shop":"summary",now);
}
function move(g:PartyGame,now:number,delay=0,destination?:number){
  const p=activePartyPlayer(g);
  if(g.steps<=0){land(g,now);return;}
  const choices=partyPaths(g,p);
  if(destination===undefined&&choices.length>1){phase(g,"path",now);return;}
  const target=destination??choices[0];
  phase(g,"moving",now);g.movement={destination:target,departAt:now+delay,arriveAt:now+delay+PARTY_STEP_MS};
}
function arrive(g:PartyGame,now:number){
  const target=g.movement!.destination;step(g,target);
  const p=activePartyPlayer(g);
  if (g.mode === "roll-it-up") {
    if (p.position === JAYSPOT && hasFullSet(p)) {
      g.winners = [p.id];
      g.steps = 0;
      log(g, p.name + " erreicht den Jayspot!");
      phase(g, "finished", now);
      return;
    }
    const station = stationAt(p.position);
    if (station && !p.supplies?.includes(station.field) && p.coins >= station.price) {
      phase(g, "supply", now);
      return;
    }
    move(g, now);
  } else if(canBuyTrophy(g,p))phase(g,"trophy",now);
  else move(g,now);
}
function step(g:PartyGame,destination:number) {const p=activePartyPlayer(g);p.position=destination;p.walked=(p.walked??0)+1;g.path.push(destination);g.steps--;if(destination===0){p.coins+=3;log(g,`${p.name} passiert ${g.mode==="roll-it-up"?"das Startfeld":"den Hafen"}: +3 Münzen.`);}}
function canBuyTrophy(g:PartyGame,p:PartyPlayer){return (g.mode??"party")==="party"&&p.position===g.trophyField&&!g.trophyBought&&p.coins>=TROPHY_PRICE;}
/** After a purchase the trophy stand moves to one of the two other shops, drawn by the room's random state. */
function moveTrophy(g:PartyGame){const others=TROPHY_SHOPS.filter(field=>field!==g.trophyField);g.trophyField=others[Math.floor(random(g)*others.length)];log(g,`Der Trophäenstand zieht weiter zu Feld ${g.trophyField}.`);}
/** The last three rounds begin: every last-placed player receives a random item, or its price in coins with a full inventory. */
function startFinalStretch(g:PartyGame){
  const last=partyStanding(g).at(-1)!,tied=g.players.filter(p=>p.trophies===last.trophies&&p.coins===last.coins&&p.wins===last.wins);
  const help=tied.map(p=>{const item=ITEM_IDS[Math.floor(random(g)*ITEM_IDS.length)];if(p.items.length<3){p.items.push(item);return {id:p.id,item};}p.coins+=ITEMS[item].price;return {id:p.id,coins:ITEMS[item].price};});
  g.finalStretch={round:g.round,help};
  log(g,`Die letzten ${FINAL_ROUNDS} Runden beginnen: Plus- und Minusfelder zählen doppelt.`);
  for(const entry of help){const p=g.players.find(q=>q.id===entry.id)!;log(g,`Rückenwind für ${p.name}: ${entry.item?ITEMS[entry.item].name:`+${entry.coins} Münzen`}.`);}
}
function startTurn(g:PartyGame,now:number) {g.itemUsed=false;g.double=false;g.boost=0;g.trophyBought=false;g.dice=[];g.path=[];g.offered=undefined;phase(g,"turn",now);log(g,`${activePartyPlayer(g).name} ist am Zug.`);}
/**
 * Draw order for the next minigames: one entry per game family (obstacle runs: two different
 * courses), never the same family twice in a row. Competitions never repeat a played game.
 */
function fillMiniBag(g:PartyGame,active:number){
  const played=new Set<string>(g.competition?.history.map(h=>h.miniId)??[]);
  let pool=miniPool(active,g.options.classic??true);
  if(pool.some(id=>!played.has(id)))pool=pool.filter(id=>!played.has(id));
  const families=new Map<string,PlayableMiniId[]>();
  for(const id of pool)families.set(miniFamily(id),[...(families.get(miniFamily(id))??[]),id]);
  const entries=shuffle(g,[...families].flatMap(([family,ids])=>shuffle(g,ids).slice(0,family==="parcours"?2:1)));
  const order:PlayableMiniId[]=[];let previous=g.lastMini;
  while(entries.length){
    const index=Math.max(0,entries.findIndex(id=>!previous||miniFamily(id)!==miniFamily(previous)));
    previous=entries.splice(index,1)[0];order.push(previous);
  }
  g.miniBag=order.reverse();
}
function selectMini(g:PartyGame,now:number) {
  const active=g.players.filter(p=>!p.passive).length;
  if(!g.miniBag.length)fillMiniBag(g,active);
  // Players may have become passive since the bag was filled; skip games that no longer fit.
  while(g.miniBag.length&&!miniEligible(g.miniBag.at(-1)!,active)){g.miniBag.pop();if(!g.miniBag.length)fillMiniBag(g,active);}
  const id=g.miniBag.pop()!;g.lastMini=id;
  prepareMini(g,id,now);
  if(g.mode === "goldenschmidt") {
    g.competition!.bets = {}; g.competition!.locked = [];
    phase(g, "mini-bet", now);
  }
}
/** A fresh minigame state; in a duel only the two duelists play, everyone else watches (already done and ready). */
function prepareMini(g:PartyGame,id:MiniId,now:number){
  const watching=(p:PartyPlayer)=>Boolean(g.duel&&p.id!==g.duel.challenger&&p.id!==g.duel.opponent);
  g.mini={id,startAt:0,runs:Object.fromEntries(g.players.map(p=>[p.id,{ready:watching(p),done:p.passive||watching(p),score:0,feedback:"",lastInput:0}]))};
  g.mini.arenaSeed=g.rng;
  const look=defaultLook(id);if(look)g.mini.look=look;
  g.localMiniIndex=0;phase(g,"mini-intro",now);if(g.online)g.deadline=now+90000;
}
/** Starts the duel: both pay the stake, a game from the duel pool is drawn (not the previous one). */
function startDuel(g:PartyGame,target:PartyPlayer,stake:number,now:number){
  const p=activePartyPlayer(g);
  p.coins-=stake;target.coins-=stake;
  g.duel={field:p.position,challenger:p.id,opponent:target.id,stake};
  const pool=DUEL.minis.filter(id=>id!==g.lastDuelMini),id=pool[Math.floor(random(g)*pool.length)];
  g.lastDuelMini=id;
  log(g,`${p.name} fordert ${target.name} zum Duell: je ${stake} Münzen im Pott, gespielt wird ${MINIS[id].name}.`);
  prepareMini(g,id,now);
}
/** Duel result: the single winner takes the pot (both stakes); a draw or no winner refunds the stakes. */
function settleDuel(g:PartyGame,now:number){
  const d=g.duel!,results=partyMiniResults(g),top=results.filter(r=>r.participated&&r.place===1);
  const pot=d.stake*2,a=g.players.find(p=>p.id===d.challenger)!,b=g.players.find(p=>p.id===d.opponent)!;
  if(top.length===1){d.winner=top[0].player.id;top[0].player.coins+=pot;top[0].player.duels=(top[0].player.duels??0)+1;log(g,`${top[0].player.name} gewinnt das Duell und den Pott: +${pot} Münzen.`);}
  else{d.draw=true;a.coins+=d.stake;b.coins+=d.stake;log(g,"Duell unentschieden: beide bekommen ihren Einsatz zurück.");}
  phase(g,"mini-result",now);
}
function startMini(g:PartyGame,now:number) {
  const m=g.mini!;m.startAt=now+3000;
  if(isArenaId(m.id))m.arena=createArena(m.id,g.players.filter((p,i)=>!p.passive&&(g.online||i===g.localMiniIndex)).map(p=>({id:p.id,style:g.players.indexOf(p),characterId:p.characterId})),m.arenaSeed??1);
  // In a duel only the two duelists enter the match.
  const contenders=g.duel?g.players.filter(p=>p.id===g.duel!.challenger||p.id===g.duel!.opponent):g.players.filter(p=>!p.passive);
  if(isMatchId(m.id))m.match=createMatch(matchIdForLook(m.id,m.look),contenders.map(p=>({id:p.id,style:g.players.indexOf(p),characterId:p.characterId})),m.arenaSeed??1);
  phase(g,"mini-play",now);g.deadline=m.startAt+MINIS[m.id].seconds*1000;
}

export function applyPartyControl(current:PartyGame,id:string,input:ArenaInput|unknown,seq:number,now=Date.now()):PartyGame {
  if(current.pausedAt||current.phase!=="mini-play"||!(current.mini?.arena||current.mini?.match)||now<current.mini.startAt||now>=current.deadline)throw new Error("Die Steuerung ist gerade pausiert.");
  const player=current.players.find(p=>p.id===id);
  if(!player||player.passive||current.mini.runs[id]?.done)throw new Error("Dein Versuch ist nicht aktiv.");
  const g=structuredClone(current),m=g.mini!;
  if(m.match){
    advanceMatch(m.match,now-m.startAt);
    setMatchControl(m.match,id,input,seq,now-m.startAt,now);
    syncMatchRuns(g,now);
    return g;
  }
  advanceArena(m.arena!,now-m.startAt);
  setArenaControl(m.arena!,id,input,seq);
  syncArenaRuns(g,now);
  return g;
}
function syncMatchRuns(g:PartyGame,now:number) {
  const m=g.mini!,standings=matchStandings(m.match!),events=m.match!.events;
  for(const player of m.match!.players){const run=m.runs[player.id];if(!run)continue;run.score=standings.find(s=>s.id===player.id)?.score??0;run.feedback=[...events].reverse().find(e=>e.ids.includes(player.id))?.text??run.feedback;if(player.played&&run.lastInput===0)run.lastInput=now;}
}
/** A finished match ends the minigame for everyone at once. */
function endMatch(g:PartyGame,now:number){
  const m=g.mini!;finishMatch(m.match!);syncMatchRuns(g,now);
  for(const p of g.players)if(m.runs[p.id])m.runs[p.id].done=true;
  rewardMini(g,now);
}
/** Inputs must not keep steering while a device is gone or the host pauses. */
export function neutralizePartyInputs(game:PartyGame){
  for(const actor of game.mini?.arena?.actors??[]){actor.input={...NEUTRAL_INPUT};actor.inputUntil=0;}
  if(game.mini?.match)neutralizeMatch(game.mini.match);
}
function syncArenaRuns(g:PartyGame,now:number) {
  for(const actor of g.mini!.arena!.actors){const run=g.mini!.runs[actor.id];run.score=actor.score;run.feedback=actor.feedback;if(actor.played&&run.lastInput===0)run.lastInput=now;}
}
/** One source for awarded coins and the result screen, including lower-place ties. */
export function partyMiniResults(g:PartyGame) {
  const m=g.mini!;
  const eligible=g.players.filter(p=>!p.passive&&m.runs[p.id].lastInput>0);
  if(m.match){
    // The match module ranks with shared places; non-participants are left out before places are counted.
    const standings=matchStandings(m.match),place=(id:string)=>standings.find(s=>s.id===id)?.place??99;
    const order=[...eligible].sort((a,b)=>place(a.id)-place(b.id)||g.order.indexOf(a.id)-g.order.indexOf(b.id));
    return g.players.map(player=>{
      const participated=eligible.includes(player),rank=participated?1+eligible.filter(other=>place(other.id)<place(player.id)).length:0;
      const coins=participated&&!g.opening&&!g.competition&&!g.duel?([10,4,2][rank-1]??0):0;
      return {player,place:rank,coins,participated,score:standings.find(s=>s.id===player.id)?.score??0,detail:standings.find(s=>s.id===player.id)?.detail};
    }).sort((a,b)=>(a.place||99)-(b.place||99)||order.indexOf(a.player)-order.indexOf(b.player));
  }
  const falls=(p:PartyPlayer)=>m.arena?.actors.find(a=>a.id===p.id)?.falls??0;
  const ranked=[...eligible].sort((a,b)=>m.runs[b.id].score-m.runs[a.id].score||falls(a)-falls(b)||g.order.indexOf(a.id)-g.order.indexOf(b.id));
  return g.players.map(player=>{
    const participated=eligible.includes(player),place=participated?ranked.indexOf(player)+1:0;
    const coins=participated&&!g.opening&&!g.competition?([10,4,2][place-1]??0):0;
    return {player,place,coins,participated,score:m.runs[player.id].score,detail:undefined as string|undefined};
  }).sort((a,b)=>(a.place||99)-(b.place||99));
}
function rewardMini(g:PartyGame,now:number){
  if(g.duel){settleDuel(g,now);return;}
  const m=g.mini!,results=partyMiniResults(g);
  if (g.competition) {
    const c = g.competition;
    const winnerIds = results.filter(r => r.place === 1).map(r => r.player.id);
    const points = Object.fromEntries(results.map(r => [r.player.id, r.place === 1 ? (g.mode === "goldenschmidt" ? c.bets[r.player.id] ?? 0 : 0) : 0]));
    for (const result of results) {
      c.scores[result.player.id] += points[result.player.id];
      if (result.place === 1) result.player.wins++;
    }
    c.history.push({ miniId: m.id as PlayableMiniId, winnerIds, bets: { ...c.bets }, points });
    if (g.round === c.rounds) {
      const best = Math.max(...Object.values(c.scores));
      g.winners = g.mode === "free-minigame" ? winnerIds : g.players.filter(p => c.scores[p.id] === best).map(p => p.id);
      phase(g, "finished", now);
    } else phase(g, "mini-result", now);
    return;
  }
  if(g.opening){
    const original=[...g.order];g.order=results.filter(r=>r.participated).map(r=>r.player.id).concat(original.filter(id=>!results.some(r=>r.participated&&r.player.id===id)));g.turn=0;
    log(g,`Feste Zugreihenfolge: ${g.order.map(id=>g.players.find(p=>p.id===id)!.name).join(" → ")}.`);
  }else for(const result of results.filter(r=>r.participated)){result.player.coins+=result.coins;if(result.place===1)result.player.wins++;log(g,`${result.player.name}: +${result.coins} Münzen (${m.runs[result.player.id].score} Minispielpunkte).`);}
  if(!g.opening&&g.mode!=="roll-it-up"&&g.round===g.options.rounds)finishParty(g,now);else phase(g,"mini-result",now);
}

function finishRun(g:PartyGame,id:string,now:number) {const m=g.mini!;if(m.match)return;m.runs[id].done=true;
  if(g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].done)) rewardMini(g,now);
  else if(!g.online) {g.localMiniIndex=g.players.findIndex(p=>!p.passive&&!m.runs[p.id].done);phase(g,"mini-intro",now);}
}
export function partyMiniActor(g:PartyGame,id:string) {return g.online?id:g.players[g.localMiniIndex].id;}

/** Arena simulation time is relative to mini.startAt. Only wall-clock deadlines move. */
export function shiftPartyClock(game: PartyGame, elapsed: number) {
  const offset = Math.max(0, elapsed);
  if (game.deadline) game.deadline += offset;
  if (game.movement) {
    game.movement.departAt += offset;
    game.movement.arriveAt += offset;
  }
  if (game.mini?.startAt) game.mini.startAt += offset;
  for (const run of Object.values(game.mini?.runs ?? {})) if (run.lastInput) run.lastInput += offset;
}

/** All active humans confirmed the minigame result (bots and pausing players never block). */
export function resultConfirmed(g:PartyGame){return g.players.every(q=>q.bot||q.passive||g.mini?.resultReady?.includes(q.id));}
export function applyPartyAction(current:PartyGame,id:string,action:PartyAction,now=Date.now()):PartyGame {
  if(!current.players.some(p=>p.id===id)||current.phase==="finished"||current.phase==="aborted")throw new Error("Diese Partie ist nicht aktiv.");
  const g=structuredClone(current),p=activePartyPlayer(g),own=g.players.find(p=>p.id===id)!;
  if(action.type==="abort"){phase(g,"aborted",now);return g;}
  if(action.type==="resume"){if(!g.resumeOffered)throw new Error("Die Wartezeit läuft noch.");Object.keys(g.disconnected).forEach(id=>{g.players.find(p=>p.id===id)!.passive=true;if(g.mini?.match)removeMatchPlayer(g.mini.match,id);if(g.mini){g.mini.runs[id].done=true;const actor=g.mini.arena?.actors.find(a=>a.id===id);if(actor){actor.finished=true;actor.inputUntil=0;}}});shiftPartyClock(g,now-g.pausedAt);g.pausedAt=0;g.resumeOffered=false;return g;}
  if(g.pausedAt)throw new Error("Die Partie wartet auf die Verbindung.");
  // Minigame phases involve everyone; results wait until every active human confirmed.
  const miniPhase=["mini-bet","mini-intro","mini-play","mini-result"].includes(g.phase);
  if(!miniPhase && id!==p.id)throw new Error("Du bist nicht am Zug.");
  if(own.passive)throw new Error("Du schaust derzeit zu.");
  if(action.type === "bet" && g.phase === "mini-bet" && g.mode === "goldenschmidt" && g.competition) {
    placeMinigameBet(g.competition, id, action.value);
    if (g.players.filter(p => !p.passive).every(p => g.competition!.locked.includes(p.id))) {
      phase(g, "mini-intro", now); if(g.online)g.deadline = now + 90000;
    }
  }
  else if(action.type==="roll"&&g.phase==="turn") {g.dice=Array.from({length:g.double?2:1},()=>1+Math.floor(random(g)*6));g.steps=g.dice.reduce((a,b)=>a+b,0)+g.boost;g.path=[p.position];move(g,now,700);}
  else if(action.type==="item"&&g.phase==="turn") {
    const item=p.items[action.index];if(g.itemUsed||!item)throw new Error("Dieses Item kann nicht verwendet werden.");
    if(item==="shield"&&p.shield)throw new Error("Dein Schild ist bereits aktiv.");
    if(item==="magnet"){const target=g.players.find(p=>p.id===action.target);if(!target||target.id===id)throw new Error("Wähle eine andere Person.");p.coins+=lose(g,target,5);}
    if(item==="compass"){if(!(TROPHY_SHOPS as readonly number[]).includes(action.destination??-1))throw new Error("Wähle einen Shop.");p.position=action.destination!;g.path=[];}
    if(item==="shield")p.shield=true;if(item==="double")g.double=true;if(item==="sprint")g.boost=3;
    p.items.splice(action.index,1);g.itemUsed=true;log(g,`${p.name} setzt ${ITEMS[item].name} ein.`);
    // Travelling straight to the trophy stand offers the trophy before the roll.
    if(item==="compass"&&canBuyTrophy(g,p))phase(g,"trophy",now);
  }
  else if(action.type==="path"&&g.phase==="path"){if(!partyPaths(g,p).includes(action.destination))throw new Error("Ungültiger Weg.");move(g,now,0,action.destination);}
  else if (action.type === "supply" && g.mode === "roll-it-up" && g.phase === "supply") {
    const station = stationAt(p.position);
    if (typeof action.buy !== "boolean" || !station || p.supplies?.includes(p.position)) throw new Error("Ungültiger Einkauf.");
    if (action.buy) {
      if (p.coins < station.price) throw new Error("Nicht genug Münzen.");
      p.coins -= station.price;
      (p.supplies ??= []).push(station.field);
      log(g, p.name + " kauft " + station.name + ".");
    }
    move(g, now);
  }
  else if(action.type==="trophy"&&g.phase==="trophy"){
    if(action.buy){
      // Saved coins pay off: up to MAX_TROPHIES_PER_VISIT trophies at once.
      const count=action.count??1;
      if(!Number.isInteger(count)||count<1||count>MAX_TROPHIES_PER_VISIT)throw new Error("Ungültige Anzahl.");
      if(p.coins<TROPHY_PRICE*count)throw new Error("Nicht genug Münzen.");
      p.coins-=TROPHY_PRICE*count;p.trophies+=count;g.trophyBought=true;log(g,count>1?`${p.name} kauft ${count} Trophäen!`:`${p.name} kauft eine Trophäe!`);moveTrophy(g);
    }
    // Before the roll (after the compass) the turn continues with the roll.
    if(g.dice.length)move(g,now);else phase(g,"turn",now);
  }
  else if(action.type==="shop"&&g.phase==="shop"){if(action.item){if(!ITEM_IDS.includes(action.item)||p.coins<ITEMS[action.item].price)throw new Error("Nicht genug Münzen oder ungültiges Item.");addItem(p,action.item,action.replace);p.coins-=ITEMS[action.item].price;p.spent=(p.spent??0)+ITEMS[action.item].price;}phase(g,"summary",now);}
  else if(action.type==="gift"&&g.phase==="gift"){if(action.accept&&g.offered)addItem(p,g.offered,action.replace);g.offered=undefined;phase(g,"summary",now);}
  else if(action.type==="duel"&&g.phase==="duel"){
    if(action.target===undefined){log(g,`${p.name} verzichtet auf das Duell.`);phase(g,"summary",now);}
    else{
      const target=g.players.find(q=>q.id===action.target),option=duelTargets(g).find(o=>o.id===action.target);
      if(!target||!option)throw new Error("Diese Person kann gerade nicht zum Duell gefordert werden.");
      if(!Number.isInteger(action.stake)||action.stake!<1||action.stake!>option.max)throw new Error(`Der Einsatz muss zwischen 1 und ${option.max} Münzen liegen.`);
      startDuel(g,target,action.stake!,now);
    }
  }
  else if(action.type==="next"&&g.phase==="summary"){g.turn++;if(g.turn===g.order.length){g.turn=0;selectMini(g,now);}else startTurn(g,now);}
  else if(action.type==="ready"&&g.phase==="mini-intro") {const m=g.mini!;if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Bitte das Gerät weitergeben.");m.runs[id].ready=true;if(!g.online||g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].ready))startMini(g,now);}
  else if(action.type==="look"&&g.phase==="mini-intro"){const look={renderer:action.renderer,view:action.view};if(!isMiniLook(g.mini!.id,look))throw new Error("Diese Ansicht gibt es für dieses Minispiel nicht.");g.mini!.look=look;}
  else if(action.type==="finish"&&g.phase==="mini-play"){if(g.duel&&id!==g.duel.challenger&&id!==g.duel.opponent)throw new Error("Du schaust beim Duell zu.");if(g.mini!.match){
    // Giving up leaves the match for good; the module ranks earlier leavers lower.
    const m=g.mini!;advanceMatch(m.match!,now-m.startAt);removeMatchPlayer(m.match!,id);m.runs[id].done=true;syncMatchRuns(g,now);
    if(m.match!.done||m.match!.players.every(p=>p.gone))endMatch(g,now);
    return g;
  }if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Nicht dein Versuch.");const actor=g.mini?.arena?.actors.find(a=>a.id===id);if(actor){actor.finished=true;actor.vx=0;actor.vz=0;actor.inputUntil=0;}finishRun(g,id,now);}
  else if(action.type==="next"&&g.phase==="mini-result"){
    // Board games continue once every active human confirmed; bots never block.
    if(!g.competition&&g.mini){
      const ready=g.mini.resultReady??=[];
      if(!ready.includes(id))ready.push(id);
      if(!resultConfirmed(g))return g;
    }
    if(g.duel){g.duel=undefined;g.mini=undefined;phase(g,"summary",now);}
    else if(g.competition){g.round++;selectMini(g,now);}else if(g.opening){g.opening=false;g.mini=undefined;g.turn=0;startTurn(g,now);}else if(g.mode!=="roll-it-up"&&g.round===g.options.rounds){finishParty(g,now);}else{g.round++;g.turn=0;g.mini=undefined;if(isFinalStretch(g)&&g.round===g.options.rounds-FINAL_ROUNDS+1)startFinalStretch(g);startTurn(g,now);}}
  else throw new Error("Diese Aktion passt nicht zur aktuellen Spielphase.");
  return g;
}

export function tickParty(current:PartyGame,now=Date.now()):PartyGame {
  if(current.pausedAt){const g=structuredClone(current);if(now-g.pausedAt>=60000)g.resumeOffered=true;return g;}
  const g=structuredClone(current);
  if(g.phase==="finished"||g.phase==="aborted")return g;
  if(g.phase === "mini-bet" && g.competition && g.players.filter(p => !p.passive).every(p => g.competition!.locked.includes(p.id))) {
    phase(g, "mini-intro", now); if(g.online)g.deadline = now + 90000;
  }
  if(g.phase==="mini-play"&&g.mini?.match&&now>=g.mini.startAt){
    const m=g.mini;advanceMatch(m.match!,now-m.startAt);syncMatchRuns(g,now);
    if(m.match!.done||now>=g.deadline||m.match!.players.filter(p=>!p.gone).length===0)endMatch(g,now);
    return g;
  }
  if(g.phase==="mini-play"&&g.mini?.arena&&now>=g.mini.startAt){
    advanceArena(g.mini.arena,now-g.mini.startAt);syncArenaRuns(g,now);
    const finished=g.mini.arena.actors.filter(a=>a.finished&&!g.mini!.runs[a.id].done).map(a=>a.id);
    for(const id of finished)if(g.phase==="mini-play")finishRun(g,id,now);
  }
  if(g.phase==="mini-play"&&now>=g.deadline){const m=g.mini!;const ids=g.online?g.players.filter(p=>!p.passive&&!m.runs[p.id].done).map(p=>p.id):[g.players[g.localMiniIndex].id];ids.forEach(id=>{if(g.phase==="mini-play")finishRun(g,id,now);});return g;}
  while(g.phase==="moving"&&g.movement&&now>=g.movement.arriveAt)arrive(g,g.movement.arriveAt);
  // Results continue once every active human confirmed (also after someone left or paused).
  if(!g.competition&&g.phase==="mini-result"){
    const actor=g.players.find(q=>!q.passive);
    if(actor&&resultConfirmed(g))return applyPartyAction(g,actor.id,{type:"next"},now);
    return g;
  }
  if(!g.online)return g;
  const p=activePartyPlayer(g);
  if(g.phase==="mini-intro"&&now>=g.deadline){startMini(g,now);return g;}
  if((g.deadline&&now>=g.deadline)||p.passive) {
    const defaults:Partial<Record<PartyPhase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:partyPaths(g,p)[0]},supply:{type:"supply",buy:false},trophy:{type:"trophy",buy:false},shop:{type:"shop"},gift:{type:"gift",accept:false},duel:{type:"duel"},summary:{type:"next"}};
    const a=defaults[g.phase];if(a){const passive=p.passive;p.passive=false;const result=applyPartyAction(g,p.id,a,now);result.players.find(q=>q.id===p.id)!.passive=passive;return result;}
  }return g;
}

/** Per-player projection: never transmit hidden decks, random state or other results. */
export function publicParty(current:PartyGame,viewer:string,now=Date.now()):PartyGame {
  const g=structuredClone(current);g.rng=0;g.events=[];g.miniBag=[];g.serverTime=now;
  if(g.phase === "mini-bet" && g.competition) {
    for(const id of Object.keys(g.competition.bets)) if(id !== viewer) {
      g.competition.used[id] = g.competition.used[id].filter(value => value !== g.competition!.bets[id]);
      delete g.competition.bets[id];
    }
  }
  if(g.mini){const m=g.mini,original=current.mini!;
    if(m.arena)m.arena=publicArena(m.arena,viewer);
    if(original.match)m.match=publicMatch(original.match,viewer);
    if(g.phase!=="mini-result"&&g.phase!=="finished")for(const [id,run] of Object.entries(m.runs))if(id!==viewer)m.runs[id]={...run,score:0};
  }return g;
}

/** Practice of a minigame; `look` follows the host's view in the app's own web rendering (light, also offline). */
export function createPartyPractice(id:MiniId,now=Date.now(),selectedCharacter?:CharacterId,look?:MiniLook):PartyGame {
  if(isMatchId(id)){
    // Match games need opponents: practise against bots that use the normal input path.
    const size=MATCH_MODULES[id].meta.players[0];
    const g=createPartyGame([{id:"practice",name:"Du",characterId:selectedCharacter},...Array.from({length:size-1},(_,i)=>({id:`practice-bot-${i+1}`,name:`Übungsbot ${i+1}`,bot:true}))],{rounds:5},true,now,now);
    g.opening=false;g.miniBag=[id];selectMini(g,now);
    const web=lookChoices(id)?.web;if(look&&isMiniLook(id,look)&&web?.length)g.mini!.look={renderer:"web",view:web.includes(look.view)?look.view:web[web.length-1]};
    startMini(g,now);return g;
  }
  const g=createPartyGame([{id:"practice",name:"Du",characterId:selectedCharacter},{id:"spectator",name:"Übung"}],{rounds:5},false,now,now);
  g.opening=false;g.players[1].passive=true;g.miniBag=[id];selectMini(g,now);startMini(g,now);return g;
}

/**
 * Test rooms only (checked by the server): `playerId` takes the turn and lands on duel field 8
 * with at least 10 coins for everyone, so a duel can be tried at once.
 */
export function startPartyTestDuel(current:PartyGame,playerId:string,now=Date.now()):PartyGame {
  if((current.mode??"party")!=="party"||!["turn","summary","mini-intro","mini-result"].includes(current.phase))throw new Error("Ein Testduell geht im Brettzug oder vor einem Minispiel.");
  const g=structuredClone(current),index=g.order.indexOf(playerId);
  if(index<0)throw new Error("Unbekannte Person.");
  g.opening=false;g.mini=undefined;g.duel=undefined;g.turn=index;g.dice=[];g.path=[];g.offered=undefined;g.itemUsed=false;g.steps=0;
  for(const p of g.players)p.coins=Math.max(p.coins,10);
  const p=activePartyPlayer(g);p.position=8;g.path=[8];
  land(g,now);
  return g;
}

/** Nur der Server darf dies nach Prüfung eines Testraums aufrufen. */
export function selectPartyTestMini(current:PartyGame,id:PlayableMiniId,now=Date.now()):PartyGame {
  if(!isArenaId(id)&&!(isMatchId(id)&&miniEligible(id,current.players.filter(p=>!p.passive).length)))throw new Error("Unbekanntes Minispiel.");
  const seed=current.mini?.id===id?current.mini.arenaSeed:undefined;
  const g=structuredClone(current);g.opening=false;g.miniBag=[id];selectMini(g,now);
  if(seed!==undefined)g.mini!.arenaSeed=seed;
  return g;
}
