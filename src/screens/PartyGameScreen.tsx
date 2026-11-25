import { FIELD_VISUALS, fieldSymbol } from "../lib/partyFieldVisuals";
import { Collection, JayspotFinish } from "../components/RollItUp";
import { RollItUpBoard } from "../components/RollItUpBoard";
import { fieldName, hasFullSet, JAYSPOT, partyBoard, partyPaths, stationAt } from "../../shared/partyBoard";
import { getGame } from "../../shared/games";
import { MinigameBetting, MinigameResults, MinigameScoreboard } from "../components/MinigameCompetition";
import {PartyTrophyGoal,PartyCoinReward,type MiniReward} from "../components/PartyProgress";
import {CharacterAvatar} from "../components/CharacterAvatar";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { activePartyPlayer, type PartyGame, fieldLabel, isFinalStretch, ITEMS, ITEM_IDS, MINIS, partyMiniResults, partyStanding, type MiniId, type PartyAction } from "../../shared/party";
import { PartyFinalStretchCall, PartyIslandFinale } from "../components/PartyFinale";
import { NEUTRAL_INPUT, type ArenaInput, type ArenaState } from "../../shared/partyArena";
import type { MatchInput, MatchState } from "../../shared/matches/types";
import type { GuestProfile, RoomState } from "../../shared/types";
import { PartyBoard } from "../components/PartyBoard";
import { Celebration, MINI_LOOK, MiniPreview } from "../components/PartyArt";
import { PartyDice } from "../components/PartyDice";
import { PartyMini, PartyPractice } from "../components/PartyMini";
import { MiniLookPicker, MiniLookSettings } from "../components/MiniLookSettings";
import { UnityMatchHost } from "../components/UnityMatchHost";
import { preloadMatchWorld } from "../matches/registry";
import { PartyPanel } from "../components/PartyPanel";
import { PartyTestTools } from "../components/PartyTestTools";
import { DuelChallenge, DuelHeadline, DuelResult } from "../components/PartyDuel";
import { socket } from "../lib/socket";
/** Developer test only: loaded on demand so the Unity bridge stays out of the main bundle. */
const UnityRollItUpBoard=lazy(()=>import("../components/UnityRollItUpBoard").then(m=>({default:m.UnityRollItUpBoard})));

export const PARTY_ONLINE_SAVE="spielraum.party.online.v1";
export interface PartySavedSession {code:string;partyToken:string;gameId?:RoomState["config"]["gameId"]}
export function readPartySave<T>(key:string):T|undefined {try{return JSON.parse(localStorage.getItem(key)??"null")??undefined;}catch{return undefined;}}
const BOARD_PHASES=["moving","turn","path","trophy","supply","shop","gift","duel","summary"];

function pathPreview(game:PartyGame,steps:number,destination:number) {
  const fields=[destination];
  for(let remaining=steps-1;remaining>0;remaining--){const next=partyPaths(game,activePartyPlayer(game),fields.at(-1)!);if(!next.length)break;if(next.length>1)return {fields,label:"Weitere Wegwahl"};fields.push(next[0]);}
  return {fields,label:fieldName(game,fields.at(-1)!)};
}

/** `unityBoard`: Roll It Up! board phases drawn by the Unity build (developer test); rules and minigames unchanged. */
export function PartyGameScreen({profile,initialRoom,onExit,onLobby,unityBoard=false}:{profile:GuestProfile;initialRoom:RoomState;onExit:()=>void;onLobby?:()=>void;unityBoard?:boolean}) {
  const [room,setRoom]=useState(initialRoom);
  const [miniReward,setMiniReward]=useState<MiniReward>();
  const [now,setNow]=useState(Date.now()),[error,setError]=useState(""),[pending,setPending]=useState(false),[practice,setPractice]=useState<MiniId>();
  const [replace,setReplace]=useState(0),[target,setTarget]=useState(""),[destination,setDestination]=useState(6),[selectedItem,setSelectedItem]=useState<number>();
  const [sound,setSound]=useState(false),[haptics,setHaptics]=useState(true),[rolling,setRolling]=useState(false),[travelling,setTravelling]=useState(false);
  const [panel,setPanel]=useState<"inventory"|"collection"|"menu"|"journal">();
  const lock=useRef(false),offset=useRef((initialRoom.partyGame?.serverTime ?? Date.now()) - Date.now()),controlSeq=useRef(0),controlAt=useRef(0),controlTimer=useRef<number|undefined>(undefined),latestControl=useRef<(input:ArenaInput|MatchInput,reliable?:boolean)=>void>(()=>{}),game=room.partyGame;
  const diceKey=game?.dice.length?`${game.round}:${game.turn}:${game.dice.join()}`:"",lastDice=useRef(diceKey);
  const turnStart=useRef({key:"",coins:0,trophies:0});

  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()+offset.current),50);return()=>clearInterval(timer);},[]);
  useEffect(()=>{if(socket.tableRoute)return;try{if(["finished","aborted"].includes(room.partyGame?.phase??"")){localStorage.removeItem(PARTY_ONLINE_SAVE);return;}localStorage.setItem(PARTY_ONLINE_SAVE,JSON.stringify({code:room.code,partyToken:room.partyToken,gameId:room.config.gameId}));}catch{setError("Der Raum konnte auf diesem Gerät nicht für den Wiederbeitritt gespeichert werden.");}},[room.code,room.partyToken,room.partyGame?.phase]);
  useEffect(()=>{
    const update=(next:RoomState)=>{if(next.code!==initialRoom.code)return;if(next.partyGame?.serverTime)offset.current=next.partyGame.serverTime-Date.now();setRoom(next);};
    const arena=(payload:{code:string;phaseId:number;arena:ArenaState;serverTime:number})=>{if(payload.code!==initialRoom.code)return;offset.current=payload.serverTime-Date.now();setRoom(previous=>{const g=previous.partyGame;if(!g?.mini||g.phaseId!==payload.phaseId||(g.mini.arena?.time??0)>payload.arena.time)return previous;const runs={...g.mini.runs};for(const actor of payload.arena.actors)runs[actor.id]={...runs[actor.id],score:actor.score,feedback:actor.feedback,done:runs[actor.id].done||actor.finished,lastInput:actor.played?(runs[actor.id].lastInput||payload.serverTime):0};return {...previous,partyGame:{...g,serverTime:payload.serverTime,mini:{...g.mini,arena:payload.arena,runs}}};});};
    // Match games: the authority sends each device its own view at 10 or 20 Hz.
    const match=(payload:{code:string;phaseId:number;match:MatchState;serverTime:number})=>{if(payload.code!==initialRoom.code)return;offset.current=payload.serverTime-Date.now();setRoom(previous=>{const g=previous.partyGame;if(!g?.mini?.match||g.phaseId!==payload.phaseId||g.mini.match.time>payload.match.time)return previous;return {...previous,partyGame:{...g,serverTime:payload.serverTime,mini:{...g.mini,match:payload.match}}};});};
    socket.on("room:updated",update);socket.on("party:arena",arena);socket.on("party:match",match);
    return()=>{socket.off("room:updated",update);socket.off("party:arena",arena);socket.off("party:match",match);};
  },[initialRoom.code,profile.id]);
  useEffect(()=>{setError("");setReplace(0);setPractice(undefined);setSelectedItem(undefined);if(game?.phase==="mini-intro"){if(game.mini?.match)preloadMatchWorld(game.mini.match.id,game.players.map(p=>p.characterId));else void import("../three/arenaWorld");}},[game?.phaseId,game?.itemUsed]);
  useEffect(()=>{setPanel(undefined);},[game?.phase==="mini-play",game?.phase==="aborted",game?.phase==="finished",game?.itemUsed]);
  useEffect(()=>{
    if(lastDice.current===diceKey)return;
    lastDice.current=diceKey;
    if(!diceKey||window.matchMedia("(prefers-reduced-motion: reduce)").matches){setRolling(false);return;}
    setRolling(true);const timer=setTimeout(()=>setRolling(false),700);return()=>clearTimeout(timer);
  },[diceKey]);
  const boardPhase=Boolean(game&&BOARD_PHASES.includes(game.phase));
  useEffect(()=>{if(!boardPhase)window.scrollTo({top:0,behavior:"instant"});},[boardPhase]);
  // A stop must not get lost: it is sent reliably and (see control) never inside the authority's 25-ms window.
  useEffect(()=>{if(panel&&game?.phase==="mini-play"&&!game.mini?.match)control(NEUTRAL_INPUT,true);},[panel]);
  useEffect(()=>()=>window.clearTimeout(controlTimer.current),[]);

  useEffect(()=>{
    if(!game)return;
    if(game.phase==='mini-intro'){setMiniReward(undefined);return;}
    if(!game.mini||game.opening||game.competition||game.duel||!['mini-result','finished'].includes(game.phase))return;
    const result=partyMiniResults(game).find(r=>r.player.id===profile.id);
    if(result)setMiniReward({id:game.mini.startAt,coins:result.coins,total:result.player.coins});
  },[game?.phase,game?.mini?.startAt,profile.id]);

  function feedback() {
    if(haptics){try{navigator.vibrate?.(18);}catch{ /* optional */ }}
    if(sound){try{const AudioCtx=window.AudioContext;if(AudioCtx){const context=new AudioCtx(),osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=520;gain.gain.value=.025;osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(context.currentTime+.07);osc.onended=()=>{void context.close();};}}catch{ /* optional */ }}
  }
  if(!game)return <main className="page"><p>{getGame(room.config.gameId).name} wird geladen …</p><button onClick={onExit}>Zurück</button></main>;
  const g=game,p=activePartyPlayer(g),viewer=profile.id;
  const projected=g,own=g.players.find(q=>q.id===viewer)!,canAct=p.id===profile.id,host=room.hostId===profile.id;
  // The Unity frame starts loading with the first minigame that uses Unity and then stays for the whole match.
  const [unityHost,setUnityHost]=useState(false);
  useEffect(()=>{if(g.mini?.look?.renderer==="unity")setUnityHost(true);},[g.mini?.look?.renderer]);
  const m=projected.mini,standings=partyStanding(g),busy=pending;
  const competition=g.competition;
  // Online rooms return to their lobby after the end; leaving the room happens there.
  const over=["finished","aborted"].includes(g.phase);
  const tray=g.mode==="roll-it-up", board=partyBoard(g), station=tray?stationAt(p.position):undefined;
  // Inselparty: the last rounds are marked in the header; their start is announced until the first roll.
  const finalStretch=isFinalStretch(g)&&!competition&&!over,finalCall=Boolean(finalStretch&&g.finalStretch?.round===g.round&&g.turn===0&&g.phase==="turn");
  const turnKey=`${g.round}:${g.turn}`;
  if(turnStart.current.key!==turnKey)turnStart.current={key:turnKey,coins:p.coins,trophies:p.trophies};
  const coinsChanged=p.coins-turnStart.current.coins,trophiesChanged=p.trophies-turnStart.current.trophies;
  const moving=g.phase==="moving"||rolling||travelling,item=selectedItem===undefined?undefined:own.items[selectedItem];
  const seconds=g.deadline>0?Math.max(0,Math.ceil((g.deadline-now)/1000)):0;
  function send(action:PartyAction) {
    if(lock.current||!socket.connected||g.pausedAt&&action.type!=="resume"&&action.type!=="abort")return;
    setError("");feedback();
    lock.current=true;setPending(true);socket.timeout(8000).emit("party:action",{seq:(g.seq[profile.id]??0)+1,phaseId:g.phaseId,token:room.partyToken,action},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{lock.current=false;setPending(false);if(err||!response.ok||!response.data)setError(response?.error??"Der Server antwortet nicht. Die Verbindung wird wiederhergestellt.");else{if(response.data.partyGame?.serverTime)offset.current=response.data.partyGame.serverTime-Date.now();setRoom(response.data);}});
  }
  // Stick values may be dropped (volatile); taps and commands use the reliable channel.
  // The authority ignores control packets that arrive less than 25 ms after the previous one.
  // Keep 30 ms between packets and always deliver the latest one, so a stop (menu, blur) is never swallowed.
  function control(input:ArenaInput|MatchInput,reliable=false) {if(!socket.connected||g.pausedAt||g.phase!=="mini-play")return;
    window.clearTimeout(controlTimer.current);
    const wait=30-(performance.now()-controlAt.current);
    if(wait>0){controlTimer.current=window.setTimeout(()=>latestControl.current(input,reliable),wait);return;}
    controlAt.current=performance.now();controlSeq.current=Math.max(controlSeq.current,g.mini?.arena?.actors.find(a=>a.id===viewer)?.inputSeq??g.mini?.match?.players.find(p=>p.id===viewer)?.inputSeq??0)+1;(reliable?socket:socket.volatile).emit("party:control",{phaseId:g.phaseId,token:room.partyToken,seq:controlSeq.current,input});}
  latestControl.current=control;
  const replaceControl=<label>Welches Item möchtest du ersetzen?<select value={replace} onChange={e=>setReplace(Number(e.target.value))}>{p.items.map((item,i)=><option value={i} key={i}>{ITEMS[item].name}</option>)}</select></label>;
  const roster=<div className={`party-standings ${boardPhase?"party-board-roster":""}`} aria-label={boardPhase?"Feste Zugreihenfolge und Punktestand":"Punktestand"}>{(boardPhase?g.order.map(id=>g.players.find(player=>player.id===id)!):standings).map((player,rank)=>{
    const index=g.players.indexOf(player);
    return <div key={player.id} className={player.id===p.id&&boardPhase?"is-active":""} aria-current={player.id===p.id&&boardPhase?"step":undefined}><CharacterAvatar id={player.characterId} className={`party-avatar party-player-color-${index}`}/><strong title={player.name}>{player.name}</strong><small>{tray?<span aria-label={`${player.supplies?.length??0} Utensilien`}>Set {player.supplies?.length??0}/6</span>:<span aria-label={`${player.trophies} Trophäen`}>★ {player.trophies}</span>}<span aria-label={`${player.coins} Münzen`}>◉ {player.coins}</span>{player.shield&&<span title="Schutzschild aktiv">⬡</span>}{player.passive&&<span>pausiert</span>}</small><em>{rank+1}.</em></div>;
  })}</div>;
  const sideTools=<>
    <button onClick={()=>setPanel("collection")} aria-label={tray?"Dein Set öffnen":"Dein Trophäenziel öffnen"} aria-haspopup="dialog"><span aria-hidden="true">{tray?"◇":"★"}</span><small>{tray?`Set ${own.supplies?.length??0}/6`:"Ziel"}</small></button>
    <button onClick={()=>setPanel("inventory")} aria-label="Dein Inventar öffnen" aria-haspopup="dialog"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M8 8V6a4 4 0 0 1 8 0v2M5 8h14l1 13H4L5 8Zm3 5h8m-8 4h8"/></svg><small>{own.items.length}/3</small></button>
  </>;
  const inventory=<fieldset className="party-controls" disabled={busy||moving||!canAct||g.phase!=="turn"||Boolean(g.pausedAt)}>
    {!canAct&&<p>Du kannst dein Inventar ansehen. Items setzt du in deinem eigenen Zug vor dem Würfeln ein.</p>}
    {own.items.length===0?<p>Geschenke und Inselmärkte bringen dir Items. Pro Zug kannst du eines einsetzen.</p>:<>
      <div className="party-inventory-items">{own.items.map((entry,i)=><button className={`party-item ${selectedItem===i?"is-selected":""}`} key={i} aria-pressed={selectedItem===i} disabled={g.itemUsed||(entry==="shield"&&own.shield)} onClick={()=>setSelectedItem(selectedItem===i?undefined:i)}><span>{ITEMS[entry].icon}</span><strong>{ITEMS[entry].name}</strong><small>{ITEMS[entry].description}</small></button>)}</div>
      {g.itemUsed&&canAct&&<p>Dein Item ist eingesetzt. Jetzt wird gewürfelt!</p>}
      {item&&<div className="party-item-confirm">
        {item==="magnet"&&<label>Wem angelst du Münzen ab?<select value={target||g.players.find(player=>player.id!==viewer)?.id} onChange={event=>setTarget(event.target.value)}>{g.players.filter(player=>player.id!==viewer).map(player=><option key={player.id} value={player.id}>{player.name} · {player.coins} Münzen{player.shield?" · Schild aktiv":""}</option>)}</select></label>}
        {item==="compass"&&<label>Zu welchem Inselmarkt?<select value={destination} onChange={event=>setDestination(Number(event.target.value))}>{[6,15,24].map(n=><option key={n} value={n}>Feld {n}{!tray&&g.trophyField===n?" · Trophäenstand":""}</option>)}</select></label>}
        <button className="button button--secondary button--wide" onClick={()=>send({type:"item",index:selectedItem!,target:target||g.players.find(player=>player.id!==viewer)?.id,destination})}>{ITEMS[item].name} einsetzen</button>
      </div>}
    </>}
  </fieldset>;
  return <main data-board-phase={boardPhase?g.phase:undefined} className={`party-screen ${tray?"roll-it-up":""} ${competition?"minigame-mode":""} ${competition&&g.phase!=="mini-play"?"party-menu":""} ${boardPhase?"party-screen--board":"party-screen--stage"} ${g.phase==="mini-play"?"party-screen--playing":""}`}>
    {!(tray&&boardPhase)&&<header className="party-header"><div><strong>{getGame(room.config.gameId).name}<span aria-hidden="true">✦</span></strong><small>Raum {room.code}</small></div><div className={`party-round ${finalStretch?"is-final":""}`}><span>{g.opening?"Auftakt":<>Runde <b>{g.round}</b>{!tray&&` / ${competition?.rounds??g.options.rounds}`}</>}</span>{finalStretch&&<small className="party-round-final">Schlussrunde</small>}</div><div className="party-header-actions"><button className="party-game-menu" onClick={()=>setPanel("menu")} aria-label="Spielmenü öffnen" aria-haspopup="dialog">☰</button>{!boardPhase&&!(over&&onLobby)&&<button className="text-button" onClick={onExit}>Verlassen</button>}</div></header>}
    {room.partyTest&&!competition&&host&&socket.connected&&!["finished","aborted"].includes(g.phase)&&<PartyTestTools room={room} onUpdate={setRoom}/>}
    {!competition&&!boardPhase&&g.phase!=="mini-play"&&g.phase!=="finished"&&roster}
    {(!socket.connected||g.pausedAt>0)&&<section className="party-connection" role="status"><h2>Wir warten auf die Verbindung</h2><p>Die Partie pausiert, bis die Geräte wieder verbunden sind. Nach 60 Sekunden kann der Host ohne fehlende Spieler fortsetzen.</p>{host&&g.resumeOffered&&<button className="button button--primary" disabled={busy} onClick={()=>send({type:"resume"})}>Ohne getrennte Spieler fortsetzen</button>}{host&&<button className="button button--ghost" disabled={busy} onClick={()=>send({type:"abort"})}>Partie abbrechen</button>}</section>}
    {tray&&unityBoard&&<Suspense fallback={null}><UnityRollItUpBoard game={g} viewer={viewer} now={g.pausedAt||now} busy={busy} connected={socket.connected} error={error} visible={boardPhase&&!over} send={send} onPanel={setPanel}/></Suspense>}
    {tray&&boardPhase&&unityBoard?null:tray&&boardPhase?<RollItUpBoard game={g} viewer={viewer} now={g.pausedAt||now} busy={busy} rolling={rolling} blocked={Boolean(panel)} connected={socket.connected} error={error} send={send} onMenu={()=>setPanel("menu")} onInventory={()=>setPanel("inventory")}/>:<div className="party-layout">
      {boardPhase&&<PartyBoard game={g} now={g.pausedAt||now} rolling={rolling} onTravelChange={setTravelling} roster={roster} tools={sideTools} interactionBlocked={Boolean(panel)}/>}
      <section className={`party-decision ${moving&&boardPhase?"is-travelling":""}`}>
        {finalCall&&<PartyFinalStretchCall game={g} viewer={viewer}/>}
        {boardPhase&&<>
          <div className="party-turn-title"><CharacterAvatar id={p.characterId} className={`party-avatar party-player-color-${g.players.indexOf(p)}`}/><div><h2>{canAct?`${p.name}, du bist dran!`:`${p.name} ist am Zug`}</h2><small>{moving?(rolling?"Der Würfel fällt …":(tray?"Unterwegs in der Bauschale":"Ab auf die Insel!")):g.deadline>0?`${seconds} Sekunden für deine Entscheidung`:`Zug ${g.turn+1} von ${g.players.length} · danach Minispiel`}</small></div>{g.deadline>0&&<b className={`party-decision-time ${seconds<=5?"is-urgent":""}`}>{seconds}</b>}</div>
          {(g.phase==="turn"||g.dice.length>0)&&<PartyDice values={g.dice} rolling={rolling} boost={g.boost}/>}
          {moving&&<p className="party-movement-status" role="status">{rolling?"Wie weit geht’s diesmal?":`${p.name} zieht weiter …`}</p>}
        </>}
        {canAct&&!g.pausedAt&&boardPhase&&<fieldset className="party-controls" disabled={busy||moving}>
          {g.phase==="turn"&&<>
            <div className="party-roll-dock">
              <div className="party-roll-status"><strong>{p.name}, du bist dran!</strong><small>{moving?(rolling?"Der Würfel fällt …":(tray?"Unterwegs in der Bauschale":"Ab auf die Insel!")):`Zug ${g.turn+1} von ${g.players.length} · danach Minispiel`}</small><small className="party-roll-goal">{tray?(hasFullSet(own)?"Zum Jayspot · Feld 34":`Dein Set · ${own.supplies?.length}/6 Utensilien`):<>★ {own.coins>=20?"Trophäenkauf möglich":`Noch ${20-own.coins} Münzen zur Trophäe`} · Feld {g.trophyField}</>}</small></div>
              <button className="button button--primary button--wide party-roll-button" onClick={()=>send({type:"roll"})}><span aria-hidden="true">⚄</span>Würfeln & losziehen</button>
            </div>

          </>}
          {g.phase==="path"&&<><h3>Welchen Weg nimmst du?</h3><p>Du hast noch {g.steps} Schritte. {tray?"An Kaufstellen kannst du unterwegs einkaufen.":"Nur dein Zielfeld löst seine Wirkung aus; am Trophäenstand kannst du unterwegs anhalten."}</p><div className="party-path-choices">{partyPaths(g,p).map((n,i)=>{const preview=pathPreview(g,g.steps,n);return <button key={n} onClick={()=>send({type:"path",destination:n})}><strong>{n===JAYSPOT?"Zur Bank":i===0?"Hauptweg":tray?"Hügelweg":"Abenteuerweg"}</strong><span aria-hidden="true">{preview.fields.map((field,index)=><i key={index} style={{backgroundColor:FIELD_VISUALS[board[field].type].color,color:FIELD_VISUALS[board[field].type].ink}}>{fieldSymbol(board[field].type)}</i>)}</span><small>{preview.label} · ab Feld {n}</small></button>;})}</div></>}
          {g.phase==="supply"&&station&&<div className="party-special-decision roll-purchase">
            <h3>{station.name}</h3><p>Feld {p.position} · Du hast {p.coins} Münzen.</p>
            <button className="button button--primary button--wide" onClick={()=>send({type:"supply",buy:true})}>{station.name} kaufen · {station.price} Münzen</button>
            <button className="button button--ghost button--wide" onClick={()=>send({type:"supply",buy:false})}>Weiterziehen</button>
          </div>}
          {g.phase==="trophy"&&<div className="party-special-decision"><Celebration small/><h3>Eine Trophäe für dich?</h3><p>Du hast {p.coins} Münzen. Für 20 gehört dir ein Stück vom Sieg.</p><button className="button button--gold button--wide" onClick={()=>send({type:"trophy",buy:true})}>Trophäe kaufen · 20 Münzen</button><button className="button button--ghost button--wide" onClick={()=>send({type:"trophy",buy:false})}>Weiterziehen</button></div>}
          {g.phase==="shop"&&<><div className="party-shop-heading"><span>▣</span><div><h3>Der Inselmarkt</h3><p>{p.coins} Münzen im Beutel · ein Item pro Besuch</p></div></div>{p.items.length===3&&replaceControl}<div className="party-shop-items">{ITEM_IDS.map(item=><button className="party-item" key={item} disabled={p.coins<ITEMS[item].price} onClick={()=>send({type:"shop",item,replace})}><span>{ITEMS[item].icon}</span><strong>{ITEMS[item].name}<b>{ITEMS[item].price} ◉</b></strong><small>{ITEMS[item].description}</small></button>)}</div><button className="button button--secondary" onClick={()=>send({type:"shop"})}>Ohne Einkauf weiter</button></>}
          {g.phase==="duel"&&<DuelChallenge key={g.phaseId} game={g} send={send}/>}
          {g.phase==="gift"&&g.offered&&<div className="party-special-decision"><span className="party-gift-icon">{ITEMS[g.offered].icon}</span><h3>{ITEMS[g.offered].name} für dich!</h3><p>{ITEMS[g.offered].description}</p>{p.items.length===3&&replaceControl}<button className="button button--gold button--wide" onClick={()=>send({type:"gift",accept:true,replace})}>Geschenk annehmen</button><button className="button button--ghost button--wide" onClick={()=>send({type:"gift",accept:false})}>Ablehnen</button></div>}
          {g.phase==="summary"&&<><div className={`party-turn-result party-turn-result--${board[p.position].type}`}><span aria-hidden="true">{fieldSymbol(board[p.position].type)}</span><div><h3>{trophiesChanged>0?"Eine Trophäe mehr!":fieldLabel(g,board[p.position].type)}</h3><p>{g.log.at(-1)}</p></div>{coinsChanged!==0&&<strong className={coinsChanged>0?"is-gain":"is-loss"}>{coinsChanged>0?"+":""}{coinsChanged}<small>Münzen im Zug</small></strong>}</div><button className="button button--primary button--wide" onClick={()=>send({type:"next"})}>Nächster Zug</button><p className="party-next-hint">{g.turn===g.order.length-1?"Jetzt spielt ihr alle im Minispiel um Münzen.":`Als Nächstes: ${g.players.find(q=>q.id===g.order[g.turn+1])?.name}`}</p></>}
        </fieldset>}
        {!canAct&&boardPhase&&<div className="party-wait"><strong>{p.name} entscheidet gerade.</strong><p>Du kannst die Felder erkunden. Dein nächster Zug kommt!</p></div>}

        {competition&&g.mode==="goldenschmidt"&&["mini-bet","mini-intro"].includes(g.phase)&&<MinigameScoreboard game={g}/>}
        {g.phase==="mini-bet"&&<MinigameBetting key={g.phaseId} game={g} viewer={viewer} busy={busy||Boolean(g.pausedAt)} send={send}/>}
        {competition&&["mini-result","finished"].includes(g.phase)&&<MinigameResults game={g} viewer={viewer} host={host} busy={busy||Boolean(g.pausedAt)} send={send} onExit={onLobby??onExit} exitLabel={onLobby?"Zurück zur Lobby":"Zurück zu GSG"}/>}
        {g.phase==="mini-intro"&&m&&<div className="party-mini-intro">
          <MiniPreview id={m.id}/><p className="party-mini-round">{g.duel?`Duell auf Feld ${g.duel.field}`:g.opening?"Auftakt: Bestimmt eure Zugreihenfolge":`Minispiel der Runde ${g.round}`}</p><h1>{MINIS[m.id].name}</h1><p className="party-mini-tagline">{MINI_LOOK[m.id].action}</p><DuelHeadline game={g} viewer={viewer}/><p>{MINIS[m.id].instruction}</p><MiniLookPicker game={g} host={host||!g.online} busy={busy||Boolean(g.pausedAt)} send={send}/><div className="party-mini-facts"><span>{MINI_LOOK[m.id].goal}</span><span>{competition?(g.mode==="goldenschmidt"?`Dein Einsatz: ${competition.bets[viewer]??"–"} Punkte`:"Ein Spiel · ein Ergebnis"):g.duel?`Sieg: ${g.duel.stake*2} Münzen aus dem Pott`:g.opening?"Ergebnis bestimmt euren Startplatz":"Platz 1: 10 · Platz 2: 4 · Platz 3: 2 Münzen"}</span></div>
          <button className="button button--secondary button--wide" onClick={()=>setPractice(m.id)}>Erst kurz üben</button>
          {g.duel&&viewer!==g.duel.challenger&&viewer!==g.duel.opponent?<p className="party-wait" role="status">Du schaust beim Duell zu. Es startet, sobald beide bereit sind.</p>:<button className="button button--primary button--wide" disabled={busy||m.runs[viewer]?.ready||own.passive} onClick={()=>send({type:"ready"})}>{m.runs[viewer]?.ready?"Bereit – wir warten auf die anderen":"Ich bin bereit"}</button>}
          <div className="party-ready-players" aria-label="Bereitschaft">{g.players.filter(q=>!q.passive&&(!g.duel||q.id===g.duel.challenger||q.id===g.duel.opponent)).map(q=><span key={q.id} className={m.runs[q.id].ready?"is-ready":""}><CharacterAvatar id={q.characterId} decorative/>{m.runs[q.id].ready?"✓":"◷"} {q.name}</span>)}</div>
        </div>}
        {g.phase==="mini-play"&&m&&<><div className="party-mini-player"><CharacterAvatar id={own.characterId}/>{own.name}<small>{g.duel?(viewer===g.duel.challenger||viewer===g.duel.opponent?`Duell um ${g.duel.stake*2} Münzen`:"Du schaust beim Duell zu"):"Alle spielen gleichzeitig"}</small></div><PartyMini game={projected} id={viewer} now={g.pausedAt||now} send={send} control={control} busy={!socket.connected||own.passive||Boolean(g.pausedAt)||Boolean(panel)} matchUi={{note:g.duel?(viewer===g.duel.challenger||viewer===g.duel.opponent?`Duell um ${g.duel.stake*2} Münzen`:"Du schaust beim Duell zu"):undefined,
          menu:<>{!m.runs[viewer]?.done&&(m.match?<><p>Du scheidest aus diesem Spiel aus und landest hinter allen, die noch spielen.</p><button type="button" disabled={busy} onClick={()=>send({type:"finish"})}>Jetzt aufgeben</button></>:<><p>Deine bisher erspielten Punkte zählen.</p><button type="button" disabled={busy} onClick={()=>send({type:"finish"})}>Versuch beenden</button></>)}<button type="button" className="is-quiet" onClick={()=>setPanel("menu")} aria-haspopup="dialog">Spielmenü öffnen</button></>}}/>{!m.match&&!m.arena&&!m.runs[viewer]?.done&&<details className="party-end-attempt"><summary>{m.match?"Aufgeben":"Versuch vorzeitig beenden"}</summary><p>{m.match?"Du scheidest aus diesem Spiel aus und landest hinter allen, die noch spielen.":"Deine bisher erspielten Punkte zählen."}</p><button className="button button--ghost" disabled={busy} onClick={()=>send({type:"finish"})}>{m.match?"Jetzt aufgeben":"Versuch beenden"}</button></details>}</>}
        {g.phase==="mini-result"&&g.duel&&m&&<DuelResult game={g} viewer={viewer} canAct={canAct} busy={busy} send={send}/>}
        {!competition&&!g.duel&&g.phase==="mini-result"&&m&&<div className="party-mini-results"><Celebration small/><h1>{g.opening?"Eure Reihenfolge steht!":"Schätze verteilt!"}</h1><p>{MINIS[m.id].name}</p>{!g.opening&&miniReward&&<PartyCoinReward coins={miniReward.coins} total={miniReward.total}/>}<ol className="party-awards">{partyMiniResults(g).map(result=><li key={result.player.id} className={result.player.id===viewer?"is-you":""}><span className="party-place">{result.place?`${result.place}.`:"–"}</span><CharacterAvatar id={result.player.characterId} className={`party-avatar party-player-color-${g.players.indexOf(result.player)}`}/><div><strong>{result.player.name}</strong><small>{result.participated?`${result.score} ${m.id==="memory"?`Paare · ${result.attempts} Versuche`:"Punkte"}`:result.player.passive?"Ausgesetzt":"Nicht teilgenommen"}</small></div><b>{g.opening?`${g.order.indexOf(result.player.id)+1}.`:`+${result.coins}`}<small>{g.opening?"Startplatz":"Münzen"}</small></b></li>)}</ol><p className="party-result-note">Bei Punktgleichstand entscheiden weniger Stürze, dann die feste Zugreihenfolge. Im Auftakt entscheidet das Los.</p>{tray?<><button className="button button--primary button--wide" disabled={busy||own.passive||Boolean(m.resultReady?.includes(viewer))} onClick={()=>send({type:"next"})}>{m.resultReady?.includes(viewer)?"Bestätigt":"Ergebnis bestätigen"}</button><p className="party-wait" role="status">Noch nicht bestätigt: {g.players.filter(q=>!q.bot&&!q.passive&&!m.resultReady?.includes(q.id)).map(q=>q.name).join(", ")}</p></>:canAct?<button className="button button--primary button--wide" disabled={busy} onClick={()=>send({type:"next"})}>{tray?"Weiter zur Bauschale":g.opening?"Ab auf die Insel":g.round===g.options.rounds?"Zur Siegerehrung":"Weiter zur Insel"}</button>:<p className="party-wait">{p.name} bringt euch gleich zurück {tray?"zur Bauschale":"zur Insel"}.</p>}</div>}
        {g.phase==="finished"&&tray&&<section className="party-finale roll-finale">
          <JayspotFinish player={p}/><h1>Am Jayspot angekommen!</h1>
          <h2>{p.name} gewinnt Roll It Up!</h2><p>Das Set ist komplett. Zeit, auf der Bank zu entspannen.</p>
          <button className="button button--primary button--wide" onClick={onLobby??onExit}>{onLobby?"Zurück zur Lobby":"Zurück zu GSG"}</button>
        </section>}
        {g.phase==="finished"&&!tray&&!competition&&<PartyIslandFinale game={g} viewer={viewer} reward={miniReward} backLabel={onLobby?"Zurück zur Lobby":"Zurück zu GSG"} onBack={onLobby??onExit}/>}
        {g.phase==="aborted"&&<><h2>Partie beendet</h2><button className="button button--primary" onClick={onLobby??onExit}>{onLobby?"Zurück zur Lobby":"Zum Startmenü"}</button></>}
        {error&&!panel&&<p className="error-message" role="alert">{error}</p>}
      </section>
    </div>}
    {panel&&<PartyPanel title={panel==="inventory"?"Dein Inventar":panel==="collection"?(tray?"Dein Set":"Dein Trophäenziel"):panel==="journal"?(tray?"Spielverlauf":"Inselchronik"):"Spielmenü"} onClose={()=>setPanel(undefined)}>
      {panel==="inventory"&&inventory}
      {panel==="collection"&&(tray?<Collection player={own}/>:<PartyTrophyGoal coins={own.coins} field={g.trophyField} reward={miniReward}/>)}
      {panel==="journal"&&<ol className="party-game-log">{g.log.map((line,i)=><li key={i}>{line}</li>)}</ol>}
      {panel==="menu"&&<div className="party-game-options"><MiniLookSettings game={g} host={host||!g.online} busy={busy} send={send}/>{tray&&<button className="button button--secondary" onClick={()=>setPanel("inventory")}>Dein Inventar ansehen</button>}<label><input type="checkbox" checked={sound} onChange={event=>setSound(event.target.checked)}/> Kurze Spieltöne</label><label><input type="checkbox" checked={haptics} onChange={event=>setHaptics(event.target.checked)}/> Vibration, falls unterstützt</label><button className="button button--secondary" onClick={()=>setPanel("journal")}>{tray?"Spielverlauf":"Inselchronik"} öffnen</button>{host&&!["finished","aborted"].includes(g.phase)&&<button className="button button--ghost" disabled={busy} onClick={()=>send({type:"abort"})}>Partie für alle beenden</button>}<button className="button button--ghost" onClick={onExit}>Verlassen</button></div>}
      {error&&<p className="error-message" role="alert">{error}</p>}
    </PartyPanel>}
    {practice&&<PartyPractice key={practice} miniId={practice} characterId={own.characterId} look={g.mini?.look} onClose={()=>setPractice(undefined)}/>}
    {unityHost&&<UnityMatchHost/>}
  </main>;
}
