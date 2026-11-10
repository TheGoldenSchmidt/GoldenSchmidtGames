import { ACTION_MINI_IDS, advanceArena, ARENA_META, createArena, isArenaId, publicArena, setArenaControl, type ArenaId, type ArenaInput, type ArenaState } from "./partyArena";
import { partyBoard, partyPaths, FIELD_LABELS, hasFullSet, stationAt, JAYSPOT } from "./partyBoard";
import { characterId, type CharacterId } from "./characters";
import { isMinigameMode, minigameOptions, placeMinigameBet, type MinigameCompetition, type MinigameMode, type MinigameOptions } from "./minigameModes";
export type PartyTempo = "slow" | "normal" | "fast";
export interface PartyOptions { rounds: number; tempo: PartyTempo; analog: boolean }
export const PARTY_DEFAULTS: PartyOptions = { rounds: 8, tempo: "normal", analog: false };
export type Item = "sprint" | "double" | "shield" | "magnet" | "compass";
export const ITEMS: Record<Item, { name: string; price: number; icon: string; description: string }> = {
  sprint: { name: "Sprintschuhe", price: 5, icon: "➜", description: "+3 Schritte beim nächsten Wurf" },
  double: { name: "Doppelwürfel", price: 8, icon: "⚄", description: "Zwei Würfel statt einem" },
  shield: { name: "Schutzschild", price: 6, icon: "⬡", description: "Wehrt einmal Pech oder Diebstahl ab" },
  magnet: { name: "Münzangel", price: 7, icon: "⚓", description: "Bis zu 5 Münzen von einer Person nehmen" },
  compass: { name: "Reisekompass", price: 6, icon: "✥", description: "Vor dem Wurf zu einem Shop reisen" }
};
export const ITEM_IDS = Object.keys(ITEMS) as Item[];
export { BOARD, FIELD_ICONS, FIELD_LABELS, type Field } from "./partyBoard";
export const MINI_IDS = ["targets", "colors", "memory", "timing", "trail", "risk"] as const;
export type MiniId = typeof MINI_IDS[number] | ArenaId | "words" | "bridge";
export const MINIS: Record<MiniId, { name: string; seconds: number; instruction: string }> = {
  ...ARENA_META,
  targets: { name: "Schatzfänger", seconds: 24, instruction: "Tippe das leuchtende Schatzfeld an. Zwölf Ziele, jeweils zwei Sekunden. Jeder Treffer zählt!" },
  colors: { name: "Farbfalle", seconds: 24, instruction: "Wähle die Schriftfarbe, nicht das geschriebene Wort. Zwölf Aufgaben, je ein Punkt." },
  memory: { name: "Muschelmemory", seconds: 30, instruction: "Finde sechs Paare. Mehr Paare gewinnen; bei Gleichstand zählen weniger Versuche." },
  timing: { name: "Brückenstopp", seconds: 12, instruction: "Stoppe den Marker in der Mitte. Fünf Versuche, bis zu 100 Punkte pro Versuch." },
  trail: { name: "Dschungelspur", seconds: 26, instruction: "Merke dir sechs Symbole. Nach sechs Sekunden gibst du ihre Reihenfolge ein. Jede richtige Stelle zählt." },
  risk: { name: "Schatzrisiko", seconds: 30, instruction: "Fünf Versuche: Öffnen bringt 1–5 Schätze, eine Falle löscht die ungesicherte Beute. Sichere rechtzeitig!" },
  words: { name: "Inselwörter", seconds: 30, instruction: "Papier und Stift: Notiert unterschiedliche Tiere. Jeder gemeinsam bestätigte gültige Begriff zählt einen Punkt." },
  bridge: { name: "Papierbrücke", seconds: 45, instruction: "Baut aus einem A4-Blatt ohne Hilfsmittel eine selbststehende Brücke. Ganze Zentimeter freier Spannweite zählen. Ihr benötigt ein Lineal." }
};
export const SYMBOLS = ["☀", "☂", "♣", "★", "♥", "⚓"];
export const COLORS = ["Rot", "Blau", "Grün", "Gelb"];
export interface PartyPlayer { id: string; name: string; characterId?: CharacterId; bot?: boolean; position: number; supplies?: number[]; coins: number; trophies: number; wins: number; items: Item[]; shield: boolean; passive: boolean }
export interface MiniRun { ready: boolean; done: boolean; score: number; attempts: number; cursor: number; opened: number[]; matched: number[]; blockedUntil: number; bank: number; loot: number; feedback: string; lastInput: number }
export interface PartyMini { id: MiniId; startAt: number; runs: Record<string, MiniRun>; cards: number[]; prompts: number[]; words: number[]; targets: number[]; trail: number[]; risk: number[]; reports: Record<string, number>; confirms: Record<string, boolean>; material: Record<string, boolean>; arenaSeed?:number; arena?:ArenaState }
export type PartyPhase = "turn" | "moving" | "path" | "trophy" | "supply" | "shop" | "gift" | "summary" | "mini-bet" | "mini-intro" | "mini-play" | "analog-confirm" | "mini-result" | "finished" | "aborted";
export interface PartyGame {
  mode?: "party" | "roll-it-up" | MinigameMode;
  competition?: MinigameCompetition;
  serverTime?: number;
  opening:boolean;movement?:{destination:number;departAt:number;arriveAt:number};
  version: 1; options: PartyOptions; online: boolean; players: PartyPlayer[]; order: string[]; round: number; turn: number;
  phase: PartyPhase; phaseId: number; deadline: number; rng: number; steps: number; dice: number[]; path: number[];
  itemUsed: boolean; boost: number; double: boolean; trophyField: number; trophyBought: boolean; offered?: Item;
  events: number[]; miniBag: MiniId[]; lastMini?: MiniId; mini?: PartyMini; localMiniIndex: number; log: string[]; winners: string[];
  seq: Record<string, number>; disconnected: Record<string, number>; pausedAt: number; resumeOffered: boolean;
}
export type PartyAction =
  | { type: "bet"; value: number }
  | { type: "roll" } | { type: "item"; index: number; target?: string; destination?: number }
  | { type: "path"; destination: number } | { type: "trophy"; buy: boolean } | { type: "supply"; buy: boolean }
  | { type: "shop"; item?: Item; replace?: number } | { type: "gift"; accept: boolean; replace?: number }
  | { type: "next" } | { type: "ready" } | { type: "input"; value: number | string }
  | { type: "finish" } | { type: "material"; available: boolean } | { type: "report"; score: number }
  | { type: "confirm"; accept: boolean } | { type: "resume" } | { type: "abort" };

export function partyOptions(value?: Partial<PartyOptions>): PartyOptions {
  const rounds = value?.rounds ?? 8, tempo = value?.tempo ?? "normal";
  if (!Number.isInteger(rounds) || rounds < 5 || rounds > 15 || !["slow","normal","fast"].includes(tempo) || (value?.analog !== undefined && typeof value.analog !== "boolean")) throw new Error("Ungültige Inselparty-Einstellungen.");
  return { rounds, tempo, analog: false };
}
function random(g: PartyGame) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function shuffle<T>(g: PartyGame, source: readonly T[]): T[] { const result = [...source]; for (let i=result.length-1;i>0;i--) { const j=Math.floor(random(g)*(i+1)); [result[i],result[j]]=[result[j],result[i]]; } return result; }
function log(g: PartyGame, message: string) { g.log = [...g.log.slice(-11),message]; }
export function activePartyPlayer(g: PartyGame) { return g.players.find(p => p.id === g.order[g.turn])!; }
function progress(g: PartyGame, p: PartyPlayer) { return g.mode === 'roll-it-up' ? p.supplies?.length ?? 0 : p.trophies; }
export function partyStanding(g: PartyGame) { return [...g.players].sort((a,b) => progress(g,b)-progress(g,a) || b.coins-a.coins || b.wins-a.wins); }
function finishParty(g:PartyGame,now:number){const first=partyStanding(g)[0];g.winners=g.players.filter(p=>p.trophies===first.trophies&&p.coins===first.coins&&p.wins===first.wins).map(p=>p.id);phase(g,"finished",now);}
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
    g.opening = false;
    g.players.forEach(p => p.coins = 0);
    g.competition = { rounds: mode === "free-minigame" ? 1 : settings.rounds, scores: Object.fromEntries(players.map(p => [p.id, 0])), used: Object.fromEntries(players.map(p => [p.id, []])), bets: {}, locked: [], history: [] };
    if (mode === "free-minigame") g.miniBag = [settings.miniId];
    selectMini(g, now);
  } else {
    selectMini(g,now);log(g,"Das Auftakt-Minispiel bestimmt eure feste Zugreihenfolge. Bei Gleichstand entscheidet das Los.");
  }
  return g;
}
function lose(g: PartyGame, p: PartyPlayer, amount: number) { if (p.shield) { p.shield=false; log(g,`${p.name}: Schutzschild wehrt den Verlust ab.`); return 0; } const n=Math.min(amount,p.coins); p.coins-=n; return n; }
function addItem(p: PartyPlayer, item: Item, replace?: number) {
  if (p.items.length<3) p.items.push(item);
  else { if (!Number.isInteger(replace) || replace!<0 || replace!>=3) throw new Error("Wähle ein Item zum Ersetzen."); p.items[replace!]=item; }
}
function event(g: PartyGame) {
  if (!g.events.length) g.events=shuffle(g,[0,1,2,3,4,5]);
  const p=activePartyPlayer(g), e=g.events.pop()!;
  if(e===0) {p.coins+=5;log(g,"Strandfund: +5 Münzen.");}
  if(e===1) {g.players.forEach(p=>p.coins+=2);log(g,"Inselrunde: alle erhalten 2 Münzen.");}
  if(e===2 || e===5) {g.offered=e===2?"sprint":"shield";log(g,`Marktgeschenk: ${ITEMS[g.offered].name}.`);}
  if(e===3) {lose(g,p,4);log(g,"Reparatur: bis zu 4 Münzen abgeben.");}
  if(e===4) { const last=partyStanding(g).at(-1)!; g.players.filter(p=>progress(g,p)===progress(g,last)&&p.coins===last.coins&&p.wins===last.wins).forEach(p=>p.coins+=5); log(g,"Hilfslieferung: die Letztplatzierten erhalten 5 Münzen."); }
}
function land(g: PartyGame, now:number) {
  const p=activePartyPlayer(g), field=partyBoard(g)[p.position];
  log(g,`${p.name}: ${g.mode==="roll-it-up" && field.id===0?"Start":FIELD_LABELS[field.type]}.`);
  if(field.type==="coin") p.coins+=3;
  if(field.type==="bad") lose(g,p,3);
  if(field.type==="event") event(g);
  if(field.type==="gift") g.offered=ITEM_IDS[Math.floor(random(g)*5)];
  if(g.offered) phase(g,"gift",now); else phase(g,field.type==="shop"?"shop":"summary",now);
}
export const partyStepMs=(tempo:PartyTempo)=>({slow:420,normal:320,fast:240}[tempo]);
function move(g:PartyGame,now:number,delay=0,destination?:number){
  const p=activePartyPlayer(g);
  if(g.steps<=0){land(g,now);return;}
  const choices=partyPaths(g,p);
  if(destination===undefined&&choices.length>1){phase(g,"path",now);return;}
  const target=destination??choices[0];
  phase(g,"moving",now);g.movement={destination:target,departAt:now+delay,arriveAt:now+delay+partyStepMs(g.options.tempo)};
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
  } else if(p.position===g.trophyField&&!g.trophyBought&&p.coins>=20)phase(g,"trophy",now);
  else move(g,now);
}
function step(g:PartyGame,destination:number) {const p=activePartyPlayer(g);p.position=destination;g.path.push(destination);g.steps--;if(destination===0){p.coins+=3;log(g,`${p.name} passiert ${g.mode==="roll-it-up"?"das Startfeld":"den Hafen"}: +3 Münzen.`);}}
function startTurn(g:PartyGame,now:number) {g.itemUsed=false;g.double=false;g.boost=0;g.trophyBought=false;g.dice=[];g.path=[];g.offered=undefined;phase(g,"turn",now);log(g,`${activePartyPlayer(g).name} ist am Zug.`);}
function selectMini(g:PartyGame,now:number,forceDigital=false) {
  if(!g.miniBag.length) {g.miniBag=shuffle(g,ACTION_MINI_IDS);if(g.miniBag.at(-1)===g.lastMini) [g.miniBag[0],g.miniBag[g.miniBag.length-1]]=[g.miniBag[g.miniBag.length-1],g.miniBag[0]];}
  let id=g.miniBag.pop()!;if(forceDigital) id=ACTION_MINI_IDS[Math.floor(random(g)*ACTION_MINI_IDS.length)];g.lastMini=id;
  g.mini={id,startAt:0,runs:Object.fromEntries(g.players.map(p=>[p.id,{ready:false,done:p.passive,score:0,attempts:0,cursor:0,opened:[],matched:[],blockedUntil:0,bank:0,loot:0,feedback:"",lastInput:0}])),cards:shuffle(g,[0,0,1,1,2,2,3,3,4,4,5,5]),prompts:Array.from({length:12},()=>Math.floor(random(g)*4)),words:Array.from({length:12},()=>Math.floor(random(g)*4)),targets:Array.from({length:12},()=>Math.floor(random(g)*9)),trail:Array.from({length:6},()=>Math.floor(random(g)*6)),risk:Array.from({length:256},()=>random(g)),reports:{},confirms:{},material:{}};
  g.mini.arenaSeed=g.rng;
  g.localMiniIndex=0;phase(g,"mini-intro",now);if(g.online)g.deadline=now+90000;
  if(g.mode === "goldenschmidt") {
    g.competition!.bets = {}; g.competition!.locked = [];
    phase(g, "mini-bet", now);
  }
}
function startMini(g:PartyGame,now:number) {
  const m=g.mini!;m.startAt=now+3000;
  if(isArenaId(m.id))m.arena=createArena(m.id,g.players.filter((p,i)=>!p.passive&&(g.online||i===g.localMiniIndex)).map(p=>({id:p.id,style:g.players.indexOf(p),characterId:p.characterId})),m.arenaSeed??1);
  phase(g,"mini-play",now);g.deadline=m.startAt+MINIS[m.id].seconds*1000;
}

export function applyPartyControl(current:PartyGame,id:string,input:ArenaInput,seq:number,now=Date.now()):PartyGame {
  if(current.pausedAt||current.phase!=="mini-play"||!current.mini?.arena||now<current.mini.startAt||now>=current.deadline)throw new Error("Die Steuerung ist gerade pausiert.");
  const player=current.players.find(p=>p.id===id);
  if(!player||player.passive||current.mini.runs[id]?.done)throw new Error("Dein Versuch ist nicht aktiv.");
  const g=structuredClone(current),m=g.mini!;
  advanceArena(m.arena!,now-m.startAt);
  setArenaControl(m.arena!,id,input,seq);
  syncArenaRuns(g,now);
  return g;
}
function syncArenaRuns(g:PartyGame,now:number) {
  for(const actor of g.mini!.arena!.actors){const run=g.mini!.runs[actor.id];run.score=actor.score;run.feedback=actor.feedback;if(actor.played&&run.lastInput===0)run.lastInput=now;}
}
/** One source for awarded coins and the result screen, including lower-place ties. */
export function partyMiniResults(g:PartyGame) {
  const m=g.mini!;
  const eligible=g.players.filter(p=>!p.passive&&(m.runs[p.id].lastInput>0||m.reports[p.id]!==undefined));
  const better=(a:PartyPlayer,b:PartyPlayer)=>m.runs[a.id].score>m.runs[b.id].score||(m.runs[a.id].score===m.runs[b.id].score&&m.id==="memory"&&m.runs[a.id].attempts<m.runs[b.id].attempts);
  const ranked=[...eligible].sort((a,b)=>better(a,b)?-1:better(b,a)?1:(m.arena?.actors.find(p=>p.id===a.id)?.falls??0)-(m.arena?.actors.find(p=>p.id===b.id)?.falls??0)||g.order.indexOf(a.id)-g.order.indexOf(b.id));
  return g.players.map(player=>{
    const participated=eligible.includes(player),place=participated?ranked.indexOf(player)+1:0;
    const coins=participated&&!g.opening&&!g.competition?([10,4,2][place-1]??0):0;
    return {player,place,coins,participated,score:m.runs[player.id].score,attempts:m.runs[player.id].attempts};
  }).sort((a,b)=>(a.place||99)-(b.place||99));
}
function rewardMini(g:PartyGame,now:number){
  const m=g.mini!,results=partyMiniResults(g);
  if (g.competition) {
    const c = g.competition;
    const winnerIds = results.filter(r => r.place === 1).map(r => r.player.id);
    const points = Object.fromEntries(results.map(r => [r.player.id, r.place === 1 ? (g.mode === "goldenschmidt" ? c.bets[r.player.id] ?? 0 : 0) : 0]));
    for (const result of results) {
      c.scores[result.player.id] += points[result.player.id];
      if (result.place === 1) result.player.wins++;
    }
    c.history.push({ miniId: m.id as ArenaId, winnerIds, bets: { ...c.bets }, points });
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

function finishRun(g:PartyGame,id:string,now:number) {const m=g.mini!;m.runs[id].done=true;
  if(m.id==="words"||m.id==="bridge") {if(g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].done)){phase(g,"analog-confirm",now);}return;}
  if(g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].done)) rewardMini(g,now);
  else if(!g.online) {g.localMiniIndex=g.players.findIndex(p=>!p.passive&&!m.runs[p.id].done);phase(g,"mini-intro",now);}
}
export function partyMiniActor(g:PartyGame,id:string) {return g.online?id:g.players[g.localMiniIndex].id;}
export function partyInput(g:PartyGame,id:string,value:number|string,now:number) {
  const m=g.mini!,r=m.runs[id], elapsed=now-m.startAt;
  if(!r||r.done||elapsed<0||now>g.deadline||now-r.lastInput<40) throw new Error("Diese Eingabe ist gerade nicht möglich.");
  r.lastInput=now;
  if(m.id==="targets") {const turn=Math.floor(elapsed/2000);if(turn<12&&turn>=r.cursor&&value===m.targets[turn]){r.score++;r.cursor=turn+1;r.feedback="Schatz gefunden!";}}
  else if(m.id==="colors") {if(!Number.isInteger(value)||Number(value)<0||Number(value)>3||r.cursor>=12)throw new Error("Ungültige Farbe.");if(value===m.prompts[r.cursor])r.score++;r.cursor++;if(r.cursor===12)finishRun(g,id,now);}
  else if(m.id==="memory") {
    if(now<r.blockedUntil)throw new Error("Warte kurz, bis die Muscheln wieder verdeckt sind.");
    if(r.opened.length===2)r.opened=[];
    if(!Number.isInteger(value)||Number(value)<0||Number(value)>11||r.matched.includes(Number(value))||r.opened.includes(Number(value)))throw new Error("Diese Muschel ist bereits offen.");
    r.opened.push(Number(value));
    if(r.opened.length===2){r.attempts++;if(m.cards[r.opened[0]]===m.cards[r.opened[1]]){r.matched.push(...r.opened);r.opened=[];r.score++;if(r.score===6)finishRun(g,id,now);}else r.blockedUntil=now+700;}
  }
  else if(m.id==="timing") {const turn=Math.floor(elapsed/2400);if(turn>=5||turn<r.cursor)throw new Error("Dieser Versuch ist vorbei.");const distance=Math.abs((elapsed%2400)/2400-.5)*2;r.score+=Math.round(100*(1-distance));r.cursor=turn+1;r.feedback=`${r.score} Punkte`;if(r.cursor===5)finishRun(g,id,now);}
  else if(m.id==="trail") {if(elapsed<6000||!Number.isInteger(value)||Number(value)<0||Number(value)>5||r.cursor>=6)throw new Error("Merke dir erst die Spur.");if(value===m.trail[r.cursor])r.score++;r.cursor++;if(r.cursor===6)finishRun(g,id,now);}
  else if(m.id==="risk") {if(value!=="open"&&value!=="bank")throw new Error("Öffnen oder sichern wählen.");if(value==="bank"){r.bank+=r.loot;r.loot=0;r.attempts++;r.feedback="Beute gesichert!";}else{const draw=m.risk[r.cursor++];if(draw===undefined||draw<.25){r.loot=0;r.attempts++;r.feedback="Eine Falle! Ungesicherte Beute verloren.";}else{const n=1+Math.floor(((draw-.25)/.75)*5);r.loot+=n;r.feedback=`${n} Schätze gefunden!`;}}r.score=r.bank;if(r.attempts>=5)finishRun(g,id,now);}
  else throw new Error("Analoge Ergebnisse gemeinsam eintragen.");
}

/** Arena simulation time is relative to mini.startAt. Only wall-clock deadlines move. */
export function shiftPartyClock(game: PartyGame, elapsed: number) {
  const offset = Math.max(0, elapsed);
  if (game.deadline) game.deadline += offset;
  if (game.movement) {
    game.movement.departAt += offset;
    game.movement.arriveAt += offset;
  }
  if (game.mini?.startAt) game.mini.startAt += offset;
  for (const run of Object.values(game.mini?.runs ?? {})) {
    if (run.blockedUntil) run.blockedUntil += offset;
    if (run.lastInput) run.lastInput += offset;
  }
}

export function applyPartyAction(current:PartyGame,id:string,action:PartyAction,now=Date.now()):PartyGame {
  if(!current.players.some(p=>p.id===id)||current.phase==="finished"||current.phase==="aborted")throw new Error("Diese Partie ist nicht aktiv.");
  const g=structuredClone(current),p=activePartyPlayer(g),own=g.players.find(p=>p.id===id)!;
  if(action.type==="abort"){phase(g,"aborted",now);return g;}
  if(action.type==="resume"){if(!g.resumeOffered)throw new Error("Die Wartezeit läuft noch.");Object.keys(g.disconnected).forEach(id=>{g.players.find(p=>p.id===id)!.passive=true;if(g.mini){g.mini.runs[id].done=true;const actor=g.mini.arena?.actors.find(a=>a.id===id);if(actor){actor.finished=true;actor.inputUntil=0;}}});shiftPartyClock(g,now-g.pausedAt);g.pausedAt=0;g.resumeOffered=false;return g;}
  if(g.pausedAt)throw new Error("Die Partie wartet auf die Verbindung.");
  const miniPhase=["mini-bet","mini-intro","mini-play","analog-confirm"].includes(g.phase) || Boolean(g.competition && g.phase === "mini-result");
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
    if(item==="compass"){if(![6,15,24].includes(action.destination??-1))throw new Error("Wähle einen Shop.");p.position=action.destination!;g.path=[];}
    if(item==="shield")p.shield=true;if(item==="double")g.double=true;if(item==="sprint")g.boost=3;
    p.items.splice(action.index,1);g.itemUsed=true;log(g,`${p.name} setzt ${ITEMS[item].name} ein.`);
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
  else if(action.type==="trophy"&&g.phase==="trophy"){if(action.buy){if(p.coins<20)throw new Error("Nicht genug Münzen.");p.coins-=20;p.trophies++;g.trophyBought=true;g.trophyField=({6:15,15:24,24:6} as Record<number,number>)[g.trophyField];log(g,`${p.name} kauft eine Trophäe!`);}move(g,now);}
  else if(action.type==="shop"&&g.phase==="shop"){if(action.item){if(!ITEM_IDS.includes(action.item)||p.coins<ITEMS[action.item].price)throw new Error("Nicht genug Münzen oder ungültiges Item.");addItem(p,action.item,action.replace);p.coins-=ITEMS[action.item].price;}phase(g,"summary",now);}
  else if(action.type==="gift"&&g.phase==="gift"){if(action.accept&&g.offered)addItem(p,g.offered,action.replace);g.offered=undefined;phase(g,"summary",now);}
  else if(action.type==="next"&&g.phase==="summary"){g.turn++;if(g.turn===g.order.length){g.turn=0;selectMini(g,now);}else startTurn(g,now);}
  else if(action.type==="ready"&&g.phase==="mini-intro") {const m=g.mini!;if(!g.online&&id!==g.players[g.localMiniIndex].id&&m.id!=="words"&&m.id!=="bridge")throw new Error("Bitte das Gerät weitergeben.");m.runs[id].ready=true;if(!g.online||g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].ready)){if((m.id==="words"||m.id==="bridge")&&!g.players.filter(p=>!p.passive).every(p=>m.material[p.id]===true))throw new Error("Erst das Material bestätigen.");startMini(g,now);}}
  else if(action.type==="material"&&g.phase==="mini-intro"){if(!["words","bridge"].includes(g.mini!.id))throw new Error("Kein Material nötig.");if(!action.available)selectMini(g,now,true);else{if(!g.online)g.players.forEach(p=>g.mini!.material[p.id]=true);else g.mini!.material[id]=true;}}
  else if(action.type==="input"&&g.phase==="mini-play") {if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Nicht dein Versuch.");partyInput(g,id,action.value,now);}
  else if(action.type==="finish"&&g.phase==="mini-play"){if(["words","bridge"].includes(g.mini!.id))throw new Error("Analoge Aufgaben laufen bis zum Zeitende.");if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Nicht dein Versuch.");const actor=g.mini?.arena?.actors.find(a=>a.id===id);if(actor){actor.finished=true;actor.vx=0;actor.vz=0;actor.inputUntil=0;}finishRun(g,id,now);}
  else if(action.type==="report"&&(g.phase==="mini-play"||g.phase==="analog-confirm")){if(!g.mini||!["words","bridge"].includes(g.mini.id)||now<g.deadline&&g.phase==="mini-play")throw new Error("Die Aufgabe läuft noch.");if(!Number.isInteger(action.score)||action.score<0||action.score>200)throw new Error("Bitte 0–200 ganze Punkte eintragen.");g.mini.reports[id]=action.score;g.mini.runs[id].score=action.score;g.mini.confirms={};finishRun(g,id,now);}
  else if(action.type==="confirm"&&g.phase==="analog-confirm"){if(!action.accept)selectMini(g,now,true);else{g.mini!.confirms[id]=true;if(!g.online||g.players.filter(p=>!p.passive).every(p=>g.mini!.confirms[p.id]))rewardMini(g,now);}}
  else if(action.type==="next"&&g.phase==="mini-result"){if(g.competition){g.round++;selectMini(g,now);}else if(g.opening){g.opening=false;g.mini=undefined;g.turn=0;startTurn(g,now);}else if(g.mode!=="roll-it-up"&&g.round===g.options.rounds){finishParty(g,now);}else{g.round++;g.turn=0;g.mini=undefined;startTurn(g,now);}}
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
  if(g.phase==="mini-play"&&g.mini?.arena&&now>=g.mini.startAt){
    advanceArena(g.mini.arena,now-g.mini.startAt);syncArenaRuns(g,now);
    const finished=g.mini.arena.actors.filter(a=>a.finished&&!g.mini!.runs[a.id].done).map(a=>a.id);
    for(const id of finished)if(g.phase==="mini-play")finishRun(g,id,now);
  }
  if(g.phase==="mini-play"&&now>=g.deadline){const m=g.mini!;if(m.id==="words"||m.id==="bridge"){phase(g,"analog-confirm",now);return g;}const ids=g.online?g.players.filter(p=>!p.passive&&!m.runs[p.id].done).map(p=>p.id):[g.players[g.localMiniIndex].id];ids.forEach(id=>{if(g.phase==="mini-play")finishRun(g,id,now);});return g;}
  while(g.phase==="moving"&&g.movement&&now>=g.movement.arriveAt)arrive(g,g.movement.arriveAt);
  if(!g.online)return g;
  const p=activePartyPlayer(g);
  if(g.phase==="mini-intro"&&now>=g.deadline){if(["words","bridge"].includes(g.mini!.id))selectMini(g,now,true);else startMini(g,now);return g;}
  if(g.phase==="analog-confirm"&&now>=g.deadline){selectMini(g,now,true);return g;}
  if((g.deadline&&now>=g.deadline)||p.passive) {
    const defaults:Partial<Record<PartyPhase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:partyPaths(g,p)[0]},supply:{type:"supply",buy:false},trophy:{type:"trophy",buy:false},shop:{type:"shop"},gift:{type:"gift",accept:false},summary:{type:"next"},"mini-result":{type:"next"}};
    const a=g.competition&&g.phase==="mini-result"?undefined:defaults[g.phase];if(a){const passive=p.passive;p.passive=false;const result=applyPartyAction(g,p.id,a,now);result.players.find(q=>q.id===p.id)!.passive=passive;return result;}
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
  if(g.mini){const m=g.mini,original=current.mini!,r=original.runs[viewer];m.risk=[];
    if(m.arena)m.arena=publicArena(m.arena,viewer);
    m.cards=original.cards.map((value,i)=>r&&(r.matched.includes(i)||r.opened.includes(i))?value:-1);
    m.trail=g.phase==="mini-play"&&now>=m.startAt&&now<m.startAt+6000?m.trail:[];
    m.targets=original.targets.map((v,i)=>g.phase==="mini-play"&&i===Math.floor((now-m.startAt)/2000)?v:-1);
    m.prompts=original.prompts.map((v,i)=>r&&i===r.cursor?v:-1);m.words=original.words.map((v,i)=>r&&i===r.cursor?v:-1);
    if(g.phase!=="mini-result"&&g.phase!=="finished")for(const [id,run] of Object.entries(m.runs))if(id!==viewer)m.runs[id]={...run,score:0,opened:[],matched:[],bank:0,loot:0};
  }return g;
}

export function createPartyPractice(id:MiniId,now=Date.now(),selectedCharacter?:CharacterId):PartyGame {
  const g=createPartyGame([{id:"practice",name:"Du",characterId:selectedCharacter},{id:"spectator",name:"Übung"}],{rounds:5},false,now,now);
  g.opening=false;g.players[1].passive=true;g.miniBag=[id];selectMini(g,now);startMini(g,now);return g;
}

/** Nur der Server darf dies nach Prüfung eines Testraums aufrufen. */
export function selectPartyTestMini(current:PartyGame,id:ArenaId,now=Date.now()):PartyGame {
  if(!isArenaId(id))throw new Error("Unbekanntes Minispiel.");
  const seed=current.mini?.id===id?current.mini.arenaSeed:undefined;
  const g=structuredClone(current);g.opening=false;g.miniBag=[id];selectMini(g,now);
  if(seed!==undefined)g.mini!.arenaSeed=seed;
  return g;
}
