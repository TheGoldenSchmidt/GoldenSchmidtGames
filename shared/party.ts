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
export type Field = "start" | "coin" | "bad" | "event" | "gift" | "shop" | "safe";
export const FIELD_LABELS: Record<Field, string> = { start: "Hafen", coin: "+3 Münzen", bad: "−3 Münzen", event: "Ereignis", gift: "Geschenk", shop: "Shop", safe: "Aussicht" };
export const FIELD_ICONS: Record<Field, string> = { start: "⚑", coin: "+", bad: "−", event: "?", gift: "◇", shop: "▣", safe: "·" };
export const BOARD = Array.from({ length: 34 }, (_, id) => {
  const has = (numbers: number[]) => numbers.includes(id);
  const type: Field = id === 0 ? "start" : has([1,3,7,9,11,14,17,20,23,25,28]) ? "coin" : has([5,13,19,26,32]) ? "bad" : has([4,10,16,22,29,33]) ? "event" : has([2,12,21,30]) ? "gift" : has([6,15,24]) ? "shop" : "safe";
  const next = id === 8 ? [9,28] : id === 18 ? [19,31] : id === 30 ? [12] : id === 33 ? [22] : id === 27 ? [0] : [id + 1];
  const angle = ((id / 28) * Math.PI * 2) - Math.PI / 2;
  const branch: Record<number, [number, number]> = { 28:[61,32],29:[55,40],30:[48,47],31:[39,66],32:[44,57],33:[51,61] };
  const [x,y] = branch[id] ?? [50 + 40 * Math.cos(angle), 50 + 40 * Math.sin(angle)];
  return { id, type, next, x, y };
});
export const MINI_IDS = ["targets", "colors", "memory", "timing", "trail", "risk"] as const;
export type MiniId = typeof MINI_IDS[number] | "words" | "bridge";
export const MINIS: Record<MiniId, { name: string; seconds: number; instruction: string }> = {
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
export interface PartyPlayer { id: string; name: string; position: number; coins: number; trophies: number; wins: number; items: Item[]; shield: boolean; passive: boolean }
export interface MiniRun { ready: boolean; done: boolean; score: number; attempts: number; cursor: number; opened: number[]; matched: number[]; blockedUntil: number; bank: number; loot: number; feedback: string; lastInput: number }
export interface PartyMini { id: MiniId; startAt: number; runs: Record<string, MiniRun>; cards: number[]; prompts: number[]; words: number[]; targets: number[]; trail: number[]; risk: number[]; reports: Record<string, number>; confirms: Record<string, boolean>; material: Record<string, boolean> }
export type PartyPhase = "turn" | "path" | "trophy" | "shop" | "gift" | "summary" | "mini-intro" | "mini-play" | "analog-confirm" | "mini-result" | "finished" | "aborted";
export interface PartyGame {
  serverTime?: number;
  version: 1; options: PartyOptions; online: boolean; players: PartyPlayer[]; order: string[]; round: number; turn: number;
  phase: PartyPhase; phaseId: number; deadline: number; rng: number; steps: number; dice: number[]; path: number[];
  itemUsed: boolean; boost: number; double: boolean; trophyField: number; trophyBought: boolean; offered?: Item;
  events: number[]; miniBag: MiniId[]; lastMini?: MiniId; mini?: PartyMini; localMiniIndex: number; log: string[]; winners: string[];
  seq: Record<string, number>; disconnected: Record<string, number>; pausedAt: number; resumeOffered: boolean;
}
export type PartyAction =
  | { type: "roll" } | { type: "item"; index: number; target?: string; destination?: number }
  | { type: "path"; destination: number } | { type: "trophy"; buy: boolean }
  | { type: "shop"; item?: Item; replace?: number } | { type: "gift"; accept: boolean; replace?: number }
  | { type: "next" } | { type: "ready" } | { type: "input"; value: number | string }
  | { type: "finish" } | { type: "material"; available: boolean } | { type: "report"; score: number }
  | { type: "confirm"; accept: boolean } | { type: "resume" } | { type: "abort" };

export function partyOptions(value?: Partial<PartyOptions>): PartyOptions {
  const rounds = value?.rounds ?? 8, tempo = value?.tempo ?? "normal";
  if (!Number.isInteger(rounds) || rounds < 5 || rounds > 15 || !["slow","normal","fast"].includes(tempo) || (value?.analog !== undefined && typeof value.analog !== "boolean")) throw new Error("Ungültige Inselparty-Einstellungen.");
  return { rounds, tempo, analog: value?.analog ?? false };
}
function random(g: PartyGame) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function shuffle<T>(g: PartyGame, source: readonly T[]): T[] { const result = [...source]; for (let i=result.length-1;i>0;i--) { const j=Math.floor(random(g)*(i+1)); [result[i],result[j]]=[result[j],result[i]]; } return result; }
function log(g: PartyGame, message: string) { g.log = [...g.log.slice(-11),message]; }
export function activePartyPlayer(g: PartyGame) { return g.players.find(p => p.id === g.order[g.turn])!; }
export function partyStanding(g: PartyGame) { return [...g.players].sort((a,b) => b.trophies-a.trophies || b.coins-a.coins || b.wins-a.wins); }
function phase(g: PartyGame, next: PartyPhase, now: number) {
  g.phase = next; g.phaseId++;
  g.deadline = g.online ? now + ({slow:35000,normal:20000,fast:12000}[g.options.tempo]) : 0;
  if (next === "finished" || next === "aborted") g.deadline=0;
}
export function createPartyGame(players: {id:string;name:string}[], options?: Partial<PartyOptions>, online=false, seed=Date.now(), now=Date.now()): PartyGame {
  if (players.length<2 || players.length>6 || new Set(players.map(p=>p.id)).size!==players.length) throw new Error("Inselparty benötigt 2–6 unterschiedliche Spieler.");
  const g: PartyGame = { version:1, options:partyOptions(options), online, players:players.map(p=>({...p,position:0,coins:10,trophies:0,wins:0,items:[],shield:false,passive:false})), order:players.map(p=>p.id), round:1,turn:0,phase:"turn",phaseId:0,deadline:0,rng:seed>>>0,steps:0,dice:[],path:[],itemUsed:false,boost:0,double:false,trophyField:6,trophyBought:false,events:[],miniBag:[],localMiniIndex:0,log:[],winners:[],seq:{},disconnected:{},pausedAt:0,resumeOffered:false };
  g.order=shuffle(g,g.order); phase(g,"turn",now); log(g,`${activePartyPlayer(g).name} eröffnet die Inselparty.`); return g;
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
  if(e===4) { const last=partyStanding(g).at(-1)!; g.players.filter(p=>p.trophies===last.trophies&&p.coins===last.coins&&p.wins===last.wins).forEach(p=>p.coins+=5); log(g,"Hilfslieferung: die Letztplatzierten erhalten 5 Münzen."); }
}
function land(g: PartyGame, now:number) {
  const p=activePartyPlayer(g), field=BOARD[p.position];
  log(g,`${p.name}: ${FIELD_LABELS[field.type]}.`);
  if(field.type==="coin") p.coins+=3;
  if(field.type==="bad") lose(g,p,3);
  if(field.type==="event") event(g);
  if(field.type==="gift") g.offered=ITEM_IDS[Math.floor(random(g)*5)];
  if(g.offered) phase(g,"gift",now); else phase(g,field.type==="shop"?"shop":"summary",now);
}
function move(g: PartyGame, now:number) {
  const p=activePartyPlayer(g);
  while(g.steps>0) {
    const choices=BOARD[p.position].next;
    if(choices.length>1) {phase(g,"path",now);return;}
    step(g,choices[0]);
    if(p.position===g.trophyField&&!g.trophyBought&&p.coins>=20) {phase(g,"trophy",now);return;}
  }
  land(g,now);
}
function step(g:PartyGame,destination:number) {const p=activePartyPlayer(g);p.position=destination;g.path.push(destination);g.steps--;if(destination===0){p.coins+=3;log(g,`${p.name} passiert den Hafen: +3 Münzen.`);}}
function startTurn(g:PartyGame,now:number) {g.itemUsed=false;g.double=false;g.boost=0;g.trophyBought=false;g.dice=[];g.path=[];g.offered=undefined;phase(g,"turn",now);log(g,`${activePartyPlayer(g).name} ist am Zug.`);}
function selectMini(g:PartyGame,now:number,forceDigital=false) {
  if(!g.miniBag.length) {g.miniBag=shuffle(g,g.options.analog?[...MINI_IDS,"words","bridge"] as MiniId[]:MINI_IDS);if(g.miniBag.at(-1)===g.lastMini) [g.miniBag[0],g.miniBag[g.miniBag.length-1]]=[g.miniBag[g.miniBag.length-1],g.miniBag[0]];}
  let id=g.miniBag.pop()!;if(forceDigital) id=MINI_IDS[Math.floor(random(g)*6)];g.lastMini=id;
  g.mini={id,startAt:0,runs:Object.fromEntries(g.players.map(p=>[p.id,{ready:false,done:p.passive,score:0,attempts:0,cursor:0,opened:[],matched:[],blockedUntil:0,bank:0,loot:0,feedback:"",lastInput:0}])),cards:shuffle(g,[0,0,1,1,2,2,3,3,4,4,5,5]),prompts:Array.from({length:12},()=>Math.floor(random(g)*4)),words:Array.from({length:12},()=>Math.floor(random(g)*4)),targets:Array.from({length:12},()=>Math.floor(random(g)*9)),trail:Array.from({length:6},()=>Math.floor(random(g)*6)),risk:Array.from({length:256},()=>random(g)),reports:{},confirms:{},material:{}};
  g.localMiniIndex=0;phase(g,"mini-intro",now);if(g.online)g.deadline=now+90000;
}
function startMini(g:PartyGame,now:number) {g.mini!.startAt=now+3000;phase(g,"mini-play",now);g.deadline=g.mini!.startAt+MINIS[g.mini!.id].seconds*1000;}
function rewardMini(g:PartyGame,now:number) {
  const m=g.mini!, eligible=g.players.filter(p=>!p.passive&&(m.runs[p.id].lastInput>0||m.reports[p.id]!==undefined)), ranked=[...eligible].sort((a,b)=>m.runs[b.id].score-m.runs[a.id].score || (m.id==="memory"?m.runs[a.id].attempts-m.runs[b.id].attempts:0));
  const same=(a:PartyPlayer,b:PartyPlayer)=>m.runs[a.id].score===m.runs[b.id].score&&(m.id!=="memory"||m.runs[a.id].attempts===m.runs[b.id].attempts);
  for(const p of eligible) {const place=ranked.filter(q=>m.runs[q.id].score>m.runs[p.id].score || (m.runs[q.id].score===m.runs[p.id].score&&(m.id!=="memory"||m.runs[q.id].attempts<=m.runs[p.id].attempts))).length; const amount=[10,7,5,3,2,1][place-1]??0;p.coins+=amount;if(ranked[0]&&same(p,ranked[0]))p.wins++;log(g,`${p.name}: +${amount} Münzen (${m.runs[p.id].score} Minispielpunkte).`);}
  phase(g,"mini-result",now);
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

export function applyPartyAction(current:PartyGame,id:string,action:PartyAction,now=Date.now()):PartyGame {
  if(!current.players.some(p=>p.id===id)||current.phase==="finished"||current.phase==="aborted")throw new Error("Diese Partie ist nicht aktiv.");
  const g=structuredClone(current),p=activePartyPlayer(g),own=g.players.find(p=>p.id===id)!;
  if(action.type==="abort"){phase(g,"aborted",now);return g;}
  if(action.type==="resume"){if(!g.resumeOffered)throw new Error("Die Wartezeit läuft noch.");Object.keys(g.disconnected).forEach(id=>{g.players.find(p=>p.id===id)!.passive=true;if(g.mini)g.mini.runs[id].done=true;});const pause=now-g.pausedAt;if(g.deadline)g.deadline+=pause;if(g.mini?.startAt)g.mini.startAt+=pause;g.pausedAt=0;g.resumeOffered=false;return g;}
  if(g.pausedAt)throw new Error("Die Partie wartet auf die Verbindung.");
  const miniPhase=["mini-intro","mini-play","analog-confirm"].includes(g.phase);
  if(!miniPhase && id!==p.id)throw new Error("Du bist nicht am Zug.");
  if(own.passive)throw new Error("Du schaust derzeit zu.");
  if(action.type==="roll"&&g.phase==="turn") {g.dice=Array.from({length:g.double?2:1},()=>1+Math.floor(random(g)*6));g.steps=g.dice.reduce((a,b)=>a+b,0)+g.boost;g.path=[p.position];move(g,now);}
  else if(action.type==="item"&&g.phase==="turn") {
    const item=p.items[action.index];if(g.itemUsed||!item)throw new Error("Dieses Item kann nicht verwendet werden.");
    if(item==="shield"&&p.shield)throw new Error("Dein Schild ist bereits aktiv.");
    if(item==="magnet"){const target=g.players.find(p=>p.id===action.target);if(!target||target.id===id)throw new Error("Wähle eine andere Person.");p.coins+=lose(g,target,5);}
    if(item==="compass"){if(![6,15,24].includes(action.destination??-1))throw new Error("Wähle einen Shop.");p.position=action.destination!;g.path=[];}
    if(item==="shield")p.shield=true;if(item==="double")g.double=true;if(item==="sprint")g.boost=3;
    p.items.splice(action.index,1);g.itemUsed=true;log(g,`${p.name} setzt ${ITEMS[item].name} ein.`);
  }
  else if(action.type==="path"&&g.phase==="path"){if(!BOARD[p.position].next.includes(action.destination))throw new Error("Ungültiger Weg.");step(g,action.destination);if(p.position===g.trophyField&&!g.trophyBought&&p.coins>=20)phase(g,"trophy",now);else move(g,now);}
  else if(action.type==="trophy"&&g.phase==="trophy"){if(action.buy){if(p.coins<20)throw new Error("Nicht genug Münzen.");p.coins-=20;p.trophies++;g.trophyBought=true;g.trophyField=({6:15,15:24,24:6} as Record<number,number>)[g.trophyField];log(g,`${p.name} kauft eine Trophäe!`);}move(g,now);}
  else if(action.type==="shop"&&g.phase==="shop"){if(action.item){if(!ITEM_IDS.includes(action.item)||p.coins<ITEMS[action.item].price)throw new Error("Nicht genug Münzen oder ungültiges Item.");addItem(p,action.item,action.replace);p.coins-=ITEMS[action.item].price;}phase(g,"summary",now);}
  else if(action.type==="gift"&&g.phase==="gift"){if(action.accept&&g.offered)addItem(p,g.offered,action.replace);g.offered=undefined;phase(g,"summary",now);}
  else if(action.type==="next"&&g.phase==="summary"){g.turn++;if(g.turn===g.order.length){g.turn=0;selectMini(g,now);}else startTurn(g,now);}
  else if(action.type==="ready"&&g.phase==="mini-intro") {const m=g.mini!;if(!g.online&&id!==g.players[g.localMiniIndex].id&&m.id!=="words"&&m.id!=="bridge")throw new Error("Bitte das Gerät weitergeben.");m.runs[id].ready=true;if(!g.online||g.players.filter(p=>!p.passive).every(p=>m.runs[p.id].ready)){if((m.id==="words"||m.id==="bridge")&&!g.players.filter(p=>!p.passive).every(p=>m.material[p.id]===true))throw new Error("Erst das Material bestätigen.");startMini(g,now);}}
  else if(action.type==="material"&&g.phase==="mini-intro"){if(!["words","bridge"].includes(g.mini!.id))throw new Error("Kein Material nötig.");if(!action.available)selectMini(g,now,true);else{if(!g.online)g.players.forEach(p=>g.mini!.material[p.id]=true);else g.mini!.material[id]=true;}}
  else if(action.type==="input"&&g.phase==="mini-play") {if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Nicht dein Versuch.");partyInput(g,id,action.value,now);}
  else if(action.type==="finish"&&g.phase==="mini-play"){if(["words","bridge"].includes(g.mini!.id))throw new Error("Analoge Aufgaben laufen bis zum Zeitende.");if(!g.online&&id!==g.players[g.localMiniIndex].id)throw new Error("Nicht dein Versuch.");finishRun(g,id,now);}
  else if(action.type==="report"&&(g.phase==="mini-play"||g.phase==="analog-confirm")){if(!g.mini||!["words","bridge"].includes(g.mini.id)||now<g.deadline&&g.phase==="mini-play")throw new Error("Die Aufgabe läuft noch.");if(!Number.isInteger(action.score)||action.score<0||action.score>200)throw new Error("Bitte 0–200 ganze Punkte eintragen.");g.mini.reports[id]=action.score;g.mini.runs[id].score=action.score;g.mini.confirms={};finishRun(g,id,now);}
  else if(action.type==="confirm"&&g.phase==="analog-confirm"){if(!action.accept)selectMini(g,now,true);else{g.mini!.confirms[id]=true;if(!g.online||g.players.filter(p=>!p.passive).every(p=>g.mini!.confirms[p.id]))rewardMini(g,now);}}
  else if(action.type==="next"&&g.phase==="mini-result"){if(g.round===g.options.rounds){const first=partyStanding(g)[0];g.winners=g.players.filter(p=>p.trophies===first.trophies&&p.coins===first.coins&&p.wins===first.wins).map(p=>p.id);phase(g,"finished",now);}else{g.round++;g.order.push(g.order.shift()!);g.turn=0;g.mini=undefined;startTurn(g,now);}}
  else throw new Error("Diese Aktion passt nicht zur aktuellen Spielphase.");
  return g;
}

export function tickParty(current:PartyGame,now=Date.now()):PartyGame {
  if(current.pausedAt){const g=structuredClone(current);if(now-g.pausedAt>=60000)g.resumeOffered=true;return g;}
  const g=structuredClone(current);
  if(g.phase==="finished"||g.phase==="aborted")return g;
  if(g.phase==="mini-play"&&now>=g.deadline){const m=g.mini!;if(m.id==="words"||m.id==="bridge"){phase(g,"analog-confirm",now);return g;}const ids=g.online?g.players.filter(p=>!p.passive&&!m.runs[p.id].done).map(p=>p.id):[g.players[g.localMiniIndex].id];ids.forEach(id=>{if(g.phase==="mini-play")finishRun(g,id,now);});return g;}
  if(!g.online)return g;
  const p=activePartyPlayer(g);
  if(g.phase==="mini-intro"&&now>=g.deadline){if(["words","bridge"].includes(g.mini!.id))selectMini(g,now,true);else startMini(g,now);return g;}
  if(g.phase==="analog-confirm"&&now>=g.deadline){selectMini(g,now,true);return g;}
  if((g.deadline&&now>=g.deadline)||p.passive) {
    const defaults:Partial<Record<PartyPhase,PartyAction>>={turn:{type:"roll"},path:{type:"path",destination:BOARD[p.position].next[0]},trophy:{type:"trophy",buy:false},shop:{type:"shop"},gift:{type:"gift",accept:false},summary:{type:"next"},"mini-result":{type:"next"}};
    const a=defaults[g.phase];if(a){const passive=p.passive;p.passive=false;const result=applyPartyAction(g,p.id,a,now);result.players.find(q=>q.id===p.id)!.passive=passive;return result;}
  }return g;
}

/** Per-player projection: never transmit hidden decks, random state or other results. */
export function publicParty(current:PartyGame,viewer:string,now=Date.now()):PartyGame {
  const g=structuredClone(current);g.rng=0;g.events=[];g.miniBag=[];g.serverTime=now;
  if(g.mini){const m=g.mini,original=current.mini!,r=original.runs[viewer];m.risk=[];
    m.cards=original.cards.map((value,i)=>r&&(r.matched.includes(i)||r.opened.includes(i))?value:-1);
    m.trail=g.phase==="mini-play"&&now>=m.startAt&&now<m.startAt+6000?m.trail:[];
    m.targets=original.targets.map((v,i)=>g.phase==="mini-play"&&i===Math.floor((now-m.startAt)/2000)?v:-1);
    m.prompts=original.prompts.map((v,i)=>r&&i===r.cursor?v:-1);m.words=original.words.map((v,i)=>r&&i===r.cursor?v:-1);
    if(g.phase!=="mini-result"&&g.phase!=="finished")for(const [id,run] of Object.entries(m.runs))if(id!==viewer)m.runs[id]={...run,score:0,opened:[],matched:[],bank:0,loot:0};
  }return g;
}

export function createPartyPractice(id:MiniId,now=Date.now()):PartyGame {
  const g=createPartyGame([{id:"practice",name:"Du"},{id:"spectator",name:"Übung"}],{rounds:5},false,now,now);
  g.players[1].passive=true;g.miniBag=[id];selectMini(g,now);startMini(g,now);return g;
}
