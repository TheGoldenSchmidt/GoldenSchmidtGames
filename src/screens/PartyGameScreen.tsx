import {PartyTrophyGoal,PartyCoinReward,type MiniReward} from "../components/PartyProgress";
import {CharacterAvatar} from "../components/CharacterAvatar";
import { useEffect, useRef, useState } from "react";
import { activePartyPlayer, BOARD, FIELD_ICONS, FIELD_LABELS, ITEMS, ITEM_IDS, MINIS, partyMiniResults, partyStanding, type MiniId, type PartyAction } from "../../shared/party";
import { type ArenaInput, type ArenaState } from "../../shared/partyArena";
import type { GuestProfile, RoomState } from "../../shared/types";
import { PartyBoard } from "../components/PartyBoard";
import { Celebration, MINI_LOOK, MiniPreview } from "../components/PartyArt";
import { PartyDice } from "../components/PartyDice";
import { PartyMini, PartyPractice } from "../components/PartyMini";
import { PartyTraining } from "../components/PartyTraining";
import { PartyTestTools } from "../components/PartyTestTools";
import { socket } from "../lib/socket";

export const PARTY_ONLINE_SAVE="spielraum.party.online.v1";
export interface PartySavedSession {code:string;partyToken:string}
export function readPartySave<T>(key:string):T|undefined {try{return JSON.parse(localStorage.getItem(key)??"null")??undefined;}catch{return undefined;}}
const BOARD_PHASES=["moving","turn","path","trophy","shop","gift","summary"];

function pathPreview(position:number,steps:number,destination:number) {
  const fields=[destination];
  for(let remaining=steps-1;remaining>0;remaining--){const next=BOARD[fields.at(-1)!].next;if(next.length>1)return {fields,label:"Weitere Wegwahl"};fields.push(next[0]);}
  return {fields,label:FIELD_LABELS[BOARD[fields.at(-1)??position].type]};
}

export function PartyGameScreen({profile,initialRoom,onExit}:{profile:GuestProfile;initialRoom:RoomState;onExit:()=>void}) {
  const [room,setRoom]=useState(initialRoom);
  const [miniReward,setMiniReward]=useState<MiniReward>();
  const [now,setNow]=useState(Date.now()),[error,setError]=useState(""),[pending,setPending]=useState(false),[practice,setPractice]=useState<MiniId>();
  const [replace,setReplace]=useState(0),[target,setTarget]=useState(""),[destination,setDestination]=useState(6),[selectedItem,setSelectedItem]=useState<number>();
  const [sound,setSound]=useState(false),[haptics,setHaptics]=useState(true),[connection,setConnection]=useState(true),[rolling,setRolling]=useState(false),[travelling,setTravelling]=useState(false);
  const lock=useRef(false),offset=useRef(0),controlSeq=useRef(0),game=room.partyGame;
  const diceKey=game?.dice.length?`${game.round}:${game.turn}:${game.dice.join()}`:"",lastDice=useRef(diceKey);
  const turnStart=useRef({key:"",coins:0,trophies:0});

  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+offset.current),50);return()=>clearInterval(timer);},[]);
  useEffect(()=>{try{if(["finished","aborted"].includes(room.partyGame?.phase??"")){localStorage.removeItem(PARTY_ONLINE_SAVE);return;}localStorage.setItem(PARTY_ONLINE_SAVE,JSON.stringify({code:room.code,partyToken:room.partyToken}));}catch{setError("Der Raum konnte auf diesem Gerät nicht für den Wiederbeitritt gespeichert werden.");}},[room.code,room.partyToken,room.partyGame?.phase]);
  useEffect(()=>{
    const update=(next:RoomState)=>{if(next.code!==initialRoom.code)return;if(next.partyGame?.serverTime)offset.current=next.partyGame.serverTime-Date.now();setRoom(next);};
    const arena=(payload:{code:string;phaseId:number;arena:ArenaState;serverTime:number})=>{if(payload.code!==initialRoom.code)return;offset.current=payload.serverTime-Date.now();setRoom(previous=>{const g=previous.partyGame;if(!g?.mini||g.phaseId!==payload.phaseId||(g.mini.arena?.time??0)>payload.arena.time)return previous;const runs={...g.mini.runs};for(const actor of payload.arena.actors)runs[actor.id]={...runs[actor.id],score:actor.score,feedback:actor.feedback,done:runs[actor.id].done||actor.finished,lastInput:actor.played?(runs[actor.id].lastInput||payload.serverTime):0};return {...previous,partyGame:{...g,serverTime:payload.serverTime,mini:{...g.mini,arena:payload.arena,runs}}};});};
    const lost=()=>setConnection(false);
    const rejoin=()=>{socket.timeout(8000).emit("room:join",{code:initialRoom.code,playerId:profile.id,name:profile.username,partyToken:initialRoom.partyToken},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{if(err||!response.ok||!response.data){setError(response?.error??"Die Sitzung ist nicht mehr erreichbar. Nach einem Serverneustart muss eine neue Partie begonnen werden.");return;}setConnection(true);setError("");update(response.data);});};
    socket.on("room:updated",update);socket.on("party:arena",arena);socket.on("connect",rejoin);socket.on("disconnect",lost);
    if(!socket.connected)socket.connect();else rejoin();
    return()=>{socket.off("room:updated",update);socket.off("party:arena",arena);socket.off("connect",rejoin);socket.off("disconnect",lost);};
  },[initialRoom.code,profile.id]);
  useEffect(()=>{setError("");setReplace(0);setPractice(undefined);setSelectedItem(undefined);if(game?.phase==="mini-intro")void import("../three/arenaWorld");},[game?.phaseId,game?.itemUsed]);
  useEffect(()=>{
    if(lastDice.current===diceKey)return;
    lastDice.current=diceKey;
    if(!diceKey||window.matchMedia("(prefers-reduced-motion: reduce)").matches){setRolling(false);return;}
    setRolling(true);const timer=setTimeout(()=>setRolling(false),700);return()=>clearTimeout(timer);
  },[diceKey]);
  const boardPhase=Boolean(game&&BOARD_PHASES.includes(game.phase));
  useEffect(()=>{if(!boardPhase)window.scrollTo({top:0,behavior:"instant"});},[boardPhase]);

  useEffect(()=>{
    if(!game)return;
    if(game.phase==='mini-intro'){setMiniReward(undefined);return;}
    if(!game.mini||game.opening||!['mini-result','finished'].includes(game.phase))return;
    const result=partyMiniResults(game).find(r=>r.player.id===profile.id);
    if(result)setMiniReward({id:game.mini.startAt,coins:result.coins,total:result.player.coins});
  },[game?.phase,game?.mini?.startAt,profile.id]);

  function feedback() {
    if(haptics){try{navigator.vibrate?.(18);}catch{ /* optional */ }}
    if(sound){try{const AudioCtx=window.AudioContext;if(AudioCtx){const context=new AudioCtx(),osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=520;gain.gain.value=.025;osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(context.currentTime+.07);osc.onended=()=>{void context.close();};}}catch{ /* optional */ }}
  }
  if(!game)return <main className="page"><p>Inselparty wird geladen …</p><button onClick={onExit}>Zurück</button></main>;
  const g=game,p=activePartyPlayer(g),viewer=profile.id;
  const projected=g,own=g.players.find(q=>q.id===viewer)!,canAct=p.id===profile.id,host=room.hostId===profile.id;
  const m=projected.mini,standings=partyStanding(g),busy=pending||!connection;
  const turnKey=`${g.round}:${g.turn}`;
  if(turnStart.current.key!==turnKey)turnStart.current={key:turnKey,coins:p.coins,trophies:p.trophies};
  const coinsChanged=p.coins-turnStart.current.coins,trophiesChanged=p.trophies-turnStart.current.trophies;
  const moving=g.phase==="moving"||rolling||travelling,item=selectedItem===undefined?undefined:p.items[selectedItem];
  const seconds=g.deadline>0?Math.max(0,Math.ceil((g.deadline-now)/1000)):0;
  function send(action:PartyAction) {
    if(lock.current||!connection||g.pausedAt&&action.type!=="resume"&&action.type!=="abort")return;
    setError("");feedback();
    lock.current=true;setPending(true);socket.timeout(8000).emit("party:action",{seq:(g.seq[profile.id]??0)+1,phaseId:g.phaseId,token:room.partyToken,action},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{lock.current=false;setPending(false);if(err||!response.ok||!response.data)setError(response?.error??"Der Server antwortet nicht. Die Verbindung wird wiederhergestellt.");else{if(response.data.partyGame?.serverTime)offset.current=response.data.partyGame.serverTime-Date.now();setRoom(response.data);}});
  }
  function control(input:ArenaInput) {if(!connection||g.pausedAt||g.phase!=="mini-play")return;controlSeq.current=Math.max(controlSeq.current,g.mini?.arena?.actors.find(a=>a.id===viewer)?.inputSeq??0)+1;socket.volatile.emit("party:control",{phaseId:g.phaseId,token:room.partyToken,seq:controlSeq.current,input});}
  const replaceControl=<label>Welches Item möchtest du ersetzen?<select value={replace} onChange={e=>setReplace(Number(e.target.value))}>{p.items.map((item,i)=><option value={i} key={i}>{ITEMS[item].name}</option>)}</select></label>;
  return <main className={`party-screen ${boardPhase?"party-screen--board":"party-screen--stage"} ${g.phase==="mini-play"?"party-screen--playing":""}`}>
    <header className="party-header"><div><strong>Inselparty<span aria-hidden="true">✦</span></strong><small>Raum {room.code}</small></div><div className="party-round"><span>{g.opening?"Auftakt":<>Runde <b>{g.round}</b> / {g.options.rounds}</>}</span><div aria-hidden="true">{Array.from({length:g.options.rounds},(_,i)=><i key={i} className={i<g.round?"is-complete":""}/>)}</div></div><div className="party-header-actions">{host&&!["finished","aborted"].includes(g.phase)&&<details className="party-host-menu"><summary>Partie</summary><button disabled={busy} onClick={()=>send({type:"abort"})}>Partie für alle beenden</button></details>}<button className="text-button" onClick={onExit}>Verlassen</button></div></header>
    {room.partyTest&&host&&connection&&!["finished","aborted"].includes(g.phase)&&<PartyTestTools room={room} onUpdate={setRoom}/>}
    {g.phase!=="mini-play"&&g.phase!=="finished"&&<div className="party-standings" aria-label={boardPhase?"Feste Zugreihenfolge und Punktestand":"Punktestand"}>{(boardPhase?g.order.map(id=>g.players.find(p=>p.id===id)!):standings).map((player,rank)=>{const i=g.players.indexOf(player);return <div key={player.id} className={player.id===p.id&&boardPhase?"is-active":""}><CharacterAvatar id={player.characterId} className={`party-avatar party-player-color-${i}`}/><strong>{player.name}</strong><small><span aria-label={`${player.trophies} Trophäen`}>★ {player.trophies}</span><span aria-label={`${player.coins} Münzen`}>◉ {player.coins}</span>{player.shield&&<span title="Schutzschild aktiv">⬡</span>}{player.passive&&<span>pausiert</span>}</small><em>{rank+1}.</em></div>;})}</div>}
    {(!connection||g.pausedAt>0)&&<section className="party-connection" role="status"><h2>Wir warten auf die Verbindung</h2><p>Die Partie pausiert bis zu 60 Sekunden. Nach einem Serverneustart sind Online-Partien nicht wiederherstellbar.</p>{host&&g.resumeOffered&&<button className="button button--primary" disabled={busy} onClick={()=>send({type:"resume"})}>Ohne getrennte Spieler fortsetzen</button>}{host&&<button className="button button--ghost" disabled={busy} onClick={()=>send({type:"abort"})}>Partie abbrechen</button>}</section>}
    <div className="party-layout">
      {boardPhase&&<PartyBoard game={g} now={g.pausedAt||now} rolling={rolling} onTravelChange={setTravelling}/>}
      <section className={`party-decision ${moving&&boardPhase?"is-travelling":""}`}>
        {boardPhase&&<>
          <div className="party-turn-title"><CharacterAvatar id={p.characterId} className={`party-avatar party-player-color-${g.players.indexOf(p)}`}/><div><h2>{canAct?`${p.name}, du bist dran!`:`${p.name} ist am Zug`}</h2><small>{moving?(rolling?"Der Würfel fällt …":"Ab auf die Insel!"):g.deadline>0?`${seconds} Sekunden für deine Entscheidung`:`Zug ${g.turn+1} von ${g.players.length} · danach Minispiel`}</small></div>{g.deadline>0&&<b className={`party-decision-time ${seconds<=5?"is-urgent":""}`}>{seconds}</b>}</div>
          {(g.phase==="turn"||g.dice.length>0)&&<PartyDice values={g.dice} rolling={rolling} boost={g.boost}/>}
          {moving&&<p className="party-movement-status" role="status">{rolling?"Wie weit geht’s diesmal?":`${p.name} zieht weiter …`}</p>}
        </>}
        {boardPhase&&<PartyTrophyGoal coins={own.coins} field={g.trophyField} reward={miniReward}/>}
        {canAct&&!g.pausedAt&&boardPhase&&<fieldset className="party-controls" disabled={busy||moving}>
          {g.phase==="turn"&&<>
            <div className="party-roll-dock">
              <div className="party-roll-status"><strong>{p.name}, du bist dran!</strong><small>{moving?(rolling?"Der Würfel fällt …":"Ab auf die Insel!"):`Zug ${g.turn+1} von ${g.players.length} · danach Minispiel`}</small><small className="party-roll-goal">★ {own.coins>=20?"Trophäenkauf möglich":`Noch ${20-own.coins} Münzen zur Trophäe`} · Feld {g.trophyField}</small></div>
              <button className="button button--primary button--wide party-roll-button" onClick={()=>send({type:"roll"})}><span aria-hidden="true">⚄</span>Würfeln & losziehen</button>
            </div>
            <details className="party-inventory" key={turnKey}><summary><span>Dein Inventar <b>{p.items.length}/3</b></span><span className="party-inventory-slots" aria-hidden="true">{[0,1,2].map(i=><i key={i}>{p.items[i]?ITEMS[p.items[i]].icon:"·"}</i>)}</span></summary>
              {p.items.length===0?<p>Geschenke und Inselmärkte bringen dir Items. Pro Zug kannst du eines einsetzen.</p>:<>
                <div className="party-inventory-items">{p.items.map((item,i)=><button className={`party-item ${selectedItem===i?"is-selected":""}`} key={i} aria-pressed={selectedItem===i} disabled={g.itemUsed||(item==="shield"&&p.shield)} onClick={()=>setSelectedItem(selectedItem===i?undefined:i)}><span>{ITEMS[item].icon}</span><strong>{ITEMS[item].name}</strong><small>{ITEMS[item].description}</small></button>)}</div>
                {g.itemUsed&&<p>Dein Item ist eingesetzt. Jetzt wird gewürfelt!</p>}
                {item&&<div className="party-item-confirm">
                  {item==="magnet"&&<label>Wem angelst du Münzen ab?<select value={target||g.players.find(q=>q.id!==viewer)?.id} onChange={e=>setTarget(e.target.value)}>{g.players.filter(q=>q.id!==viewer).map(q=><option key={q.id} value={q.id}>{q.name} · {q.coins} Münzen{q.shield?" · Schild aktiv":""}</option>)}</select></label>}
                  {item==="compass"&&<label>Zu welchem Inselmarkt?<select value={destination} onChange={e=>setDestination(Number(e.target.value))}>{[6,15,24].map(n=><option key={n} value={n}>Feld {n}{g.trophyField===n?" · Trophäenstand":""}</option>)}</select></label>}
                  <button className="button button--secondary button--wide" onClick={()=>send({type:"item",index:selectedItem!,target:target||g.players.find(q=>q.id!==viewer)?.id,destination})}>{ITEMS[item].name} einsetzen</button>
                </div>}
              </>}
            </details>
          </>}
          {g.phase==="path"&&<><h3>Welchen Weg nimmst du?</h3><p>Du hast noch {g.steps} Schritte. Nur dein Zielfeld löst seine Wirkung aus; am Trophäenstand kannst du unterwegs anhalten.</p><div className="party-path-choices">{BOARD[p.position].next.map((n,i)=>{const preview=pathPreview(p.position,g.steps,n);return <button key={n} onClick={()=>send({type:"path",destination:n})}><strong>{i===0?"Hauptweg":"Abenteuerweg"}</strong><span aria-hidden="true">{preview.fields.map((field,index)=><i key={index}>{FIELD_ICONS[BOARD[field].type]}</i>)}</span><small>{preview.label} · ab Feld {n}</small></button>;})}</div></>}
          {g.phase==="trophy"&&<div className="party-special-decision"><Celebration small/><h3>Eine Trophäe für dich?</h3><p>Du hast {p.coins} Münzen. Für 20 gehört dir ein Stück vom Sieg.</p><button className="button button--gold button--wide" onClick={()=>send({type:"trophy",buy:true})}>Trophäe kaufen · 20 Münzen</button><button className="button button--ghost button--wide" onClick={()=>send({type:"trophy",buy:false})}>Weiterziehen</button></div>}
          {g.phase==="shop"&&<><div className="party-shop-heading"><span>▣</span><div><h3>Der Inselmarkt</h3><p>{p.coins} Münzen im Beutel · ein Item pro Besuch</p></div></div>{p.items.length===3&&replaceControl}<div className="party-shop-items">{ITEM_IDS.map(item=><button className="party-item" key={item} disabled={p.coins<ITEMS[item].price} onClick={()=>send({type:"shop",item,replace})}><span>{ITEMS[item].icon}</span><strong>{ITEMS[item].name}<b>{ITEMS[item].price} ◉</b></strong><small>{ITEMS[item].description}</small></button>)}</div><button className="button button--secondary" onClick={()=>send({type:"shop"})}>Ohne Einkauf weiter</button></>}
          {g.phase==="gift"&&g.offered&&<div className="party-special-decision"><span className="party-gift-icon">{ITEMS[g.offered].icon}</span><h3>{ITEMS[g.offered].name} für dich!</h3><p>{ITEMS[g.offered].description}</p>{p.items.length===3&&replaceControl}<button className="button button--gold button--wide" onClick={()=>send({type:"gift",accept:true,replace})}>Geschenk annehmen</button><button className="button button--ghost button--wide" onClick={()=>send({type:"gift",accept:false})}>Ablehnen</button></div>}
          {g.phase==="summary"&&<><div className={`party-turn-result party-turn-result--${BOARD[p.position].type}`}><span aria-hidden="true">{FIELD_ICONS[BOARD[p.position].type]}</span><div><h3>{trophiesChanged>0?"Eine Trophäe mehr!":FIELD_LABELS[BOARD[p.position].type]}</h3><p>{g.log.at(-1)}</p></div>{coinsChanged!==0&&<strong className={coinsChanged>0?"is-gain":"is-loss"}>{coinsChanged>0?"+":""}{coinsChanged}<small>Münzen im Zug</small></strong>}</div><button className="button button--primary button--wide" onClick={()=>send({type:"next"})}>Nächster Zug</button><p className="party-next-hint">{g.turn===g.order.length-1?"Jetzt spielt ihr alle im Minispiel um Münzen.":`Als Nächstes: ${g.players.find(q=>q.id===g.order[g.turn+1])?.name}`}</p></>}
        </fieldset>}
        {!canAct&&boardPhase&&<div className="party-wait"><strong>{p.name} entscheidet gerade.</strong><p>Du kannst die Felder erkunden. Dein nächster Zug kommt!</p></div>}

        {g.phase==="mini-intro"&&m&&<div className="party-mini-intro">
          <MiniPreview id={m.id}/><p className="party-mini-round">{g.opening?"Auftakt: Bestimmt eure Zugreihenfolge":`Minispiel der Runde ${g.round}`}</p><h1>{MINIS[m.id].name}</h1><p className="party-mini-tagline">{MINI_LOOK[m.id].action}</p><p>{MINIS[m.id].instruction}</p><div className="party-mini-facts"><span>{MINI_LOOK[m.id].goal}</span><span>{g.opening?"Ergebnis bestimmt euren Startplatz":"Platz 1: 10 · Platz 2: 4 · Platz 3: 2 Münzen"}</span></div>
          <button className="button button--secondary button--wide" onClick={()=>setPractice(m.id)}>Erst kurz üben</button>
          <button className="button button--primary button--wide" disabled={busy||m.runs[viewer]?.ready||own.passive} onClick={()=>send({type:"ready"})}>{m.runs[viewer]?.ready?"Bereit – wir warten auf die anderen":"Ich bin bereit"}</button>
          <div className="party-ready-players" aria-label="Bereitschaft">{g.players.filter(q=>!q.passive).map(q=><span key={q.id} className={m.runs[q.id].ready?"is-ready":""}><CharacterAvatar id={q.characterId} decorative/>{m.runs[q.id].ready?"✓":"◷"} {q.name}</span>)}</div>
        </div>}
        {g.phase==="mini-play"&&m&&<><div className="party-mini-player"><CharacterAvatar id={own.characterId}/>{own.name}<small>Alle spielen gleichzeitig</small></div><PartyMini game={projected} id={viewer} now={g.pausedAt||now} send={send} control={control} busy={!connection||own.passive||Boolean(g.pausedAt)}/>{!m.runs[viewer]?.done&&<details className="party-end-attempt"><summary>Versuch vorzeitig beenden</summary><p>Deine bisher erspielten Punkte zählen.</p><button className="button button--ghost" disabled={busy} onClick={()=>send({type:"finish"})}>Versuch beenden</button></details>}</>}
        {g.phase==="mini-result"&&m&&<div className="party-mini-results"><Celebration small/><h1>{g.opening?"Eure Reihenfolge steht!":"Schätze verteilt!"}</h1><p>{MINIS[m.id].name}</p>{!g.opening&&miniReward&&<PartyCoinReward coins={miniReward.coins} total={miniReward.total}/>}<ol className="party-awards">{partyMiniResults(g).map(result=><li key={result.player.id} className={result.player.id===viewer?"is-you":""}><span className="party-place">{result.place?`${result.place}.`:"–"}</span><CharacterAvatar id={result.player.characterId} className={`party-avatar party-player-color-${g.players.indexOf(result.player)}`}/><div><strong>{result.player.name}</strong><small>{result.participated?`${result.score} ${m.id==="memory"?`Paare · ${result.attempts} Versuche`:"Punkte"}`:result.player.passive?"Ausgesetzt":"Nicht teilgenommen"}</small></div><b>{g.opening?`${g.order.indexOf(result.player.id)+1}.`:`+${result.coins}`}<small>{g.opening?"Startplatz":"Münzen"}</small></b></li>)}</ol><p className="party-result-note">Bei Punktgleichstand entscheiden weniger Stürze, dann die feste Zugreihenfolge. Im Auftakt entscheidet das Los.</p>{canAct?<button className="button button--primary button--wide" disabled={busy} onClick={()=>send({type:"next"})}>{g.opening?"Ab auf die Insel":g.round===g.options.rounds?"Zur Siegerehrung":"Weiter zur Insel"}</button>:<p className="party-wait">{p.name} bringt euch gleich zurück zur Insel.</p>}</div>}
        {g.phase==="finished"&&<section className="party-finale"><Celebration/><p>Alle {g.options.rounds} Runden gespielt</p>{miniReward&&<PartyCoinReward coins={miniReward.coins} total={miniReward.total}/>}<h1>Die Insel feiert euch!</h1><h2>{g.winners.map(id=>g.players.find(q=>q.id===id)!.name).join(" & ")}</h2><p>{g.winners.length>1?"Ihr teilt euch den Sieg!":"Du gewinnst die Inselparty!"}</p><ol>{standings.map((q,i)=><li key={q.id}><span>{i+1}.</span><CharacterAvatar id={q.characterId} className={`party-avatar party-player-color-${g.players.indexOf(q)}`}/><strong>{q.name}<small>★ {q.trophies} · ◉ {q.coins} · {q.wins} Minispielsiege</small></strong></li>)}</ol>{m&&<details className="party-final-awards"><summary>Letztes Minispiel: {MINIS[m.id].name}</summary><ul>{partyMiniResults(g).map(r=><li key={r.player.id}><strong>{r.player.name}</strong><span>{r.score} Punkte · +{r.coins} Münzen</span></li>)}</ul></details>}<button className="button button--primary button--wide" onClick={onExit}>Zurück zu GSG</button></section>}
        {g.phase==="aborted"&&<><h2>Partie beendet</h2><button className="button button--primary" onClick={onExit}>Zum Startmenü</button></>}
        {error&&<p className="error-message" role="alert">{error}</p>}
      </section>
    </div>
    {g.phase!=="mini-play"&&<footer className="party-footer"><PartyTraining active characterId={own.characterId}/><details className="party-journal"><summary>Inselchronik</summary><ol>{g.log.map((line,i)=><li key={i}>{line}</li>)}</ol></details><details className="party-journal"><summary>Regeln & Spielgefühl</summary><p>Die meisten Trophäen gewinnen; dann entscheiden Münzen und Minispielsiege. Eine Trophäe kostet 20 Münzen. Das Auftakt-Minispiel legt die feste Zugreihenfolge fest. Pro Zug darfst du ein Item einsetzen, dann würfeln, Wege wählen und das Zielfeld erleben. Auf dem Brett gibt es keine kurze Entscheidungsfrist. Minispiele vergeben 10, 4, 2 und danach 0 Münzen. Der erste Sturz halbiert deine Punkte; der zweite beendet den Versuch mit dem verbliebenen Punktestand. Nach allen Zügen folgt ein gemeinsames Minispiel mit eigener Figur auf jedem Gerät.</p><label><input type="checkbox" checked={sound} onChange={e=>setSound(e.target.checked)}/> Kurze Spieltöne</label><label><input type="checkbox" checked={haptics} onChange={e=>setHaptics(e.target.checked)}/> Vibration, falls unterstützt</label><p>Nach einer Unterbrechung kannst du mit deiner gespeicherten Sitzung wieder beitreten. Ein Serverneustart beendet die laufende Partie.</p></details></footer>}
    {practice&&<PartyPractice key={practice} miniId={practice} characterId={own.characterId} onClose={()=>setPractice(undefined)}/>}
  </main>;
}
