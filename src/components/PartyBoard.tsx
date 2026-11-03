import { useEffect, useRef, useState } from "react";
import { activePartyPlayer, BOARD, FIELD_LABELS, type PartyGame } from "../../shared/party";
import type { BoardFrame } from "../three/boardWorld";
import { PartyMapFallback } from "./PartyMapFallback";

export const FIGURES=["●","▲","■","◆","✚","★"];
const HELP={start:"Beim Passieren bekommst du 3 Münzen.",coin:"Beim Landen bekommst du 3 Münzen.",bad:"Beim Landen verlierst du bis zu 3 Münzen. Ein Schild schützt dich.",event:"Eine Überraschung für dich oder die ganze Gruppe.",gift:"Hier wartet ein zufälliges Item auf dich.",shop:"Kaufe ein Item für deinen nächsten Zug.",safe:"Hier kannst du die Aussicht genießen."};
export function PartyBoard({game,rolling=false,onTravelChange}:{game:PartyGame;rolling?:boolean;onTravelChange?:(moving:boolean)=>void}) {
  const [zoom,setZoom]=useState(1),[angle,setAngle]=useState(0),[follow,setFollow]=useState(false),[selected,setSelected]=useState<number>(),[animated,setAnimated]=useState<number>(),[error,setError]=useState(false),[ready,setReady]=useState(false);
  const host=useRef<HTMLDivElement>(null),progress=useRef({turn:"",path:[] as number[],index:0});
  const p=activePartyPlayer(game),key=game.path.join(","),turn=`${game.round}-${game.turn}`;
  const reduced=typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const positions=Object.fromEntries(game.players.map(player=>[player.id,player.id===p.id&&animated!==undefined?animated:player.position]));
  const current=useRef<BoardFrame>({game,positions,zoom,angle,follow,reduce:reduced});current.current={game,positions,zoom,angle,follow,reduce:reduced};
  useEffect(()=>{
    if(error)return;let cancelled=false,world:{dispose:()=>void}|undefined;
    void import("../three/boardWorld").then(({createBoardWorld})=>{if(cancelled||!host.current)return;try{world=createBoardWorld(host.current,()=>current.current,setSelected,()=>setError(true));setReady(true);}catch{setError(true);}}).catch(()=>setError(true));
    return()=>{cancelled=true;world?.dispose();};
  },[error]);
  useEffect(()=>{if(game.dice.length&&!reduced)setFollow(true);},[game.dice.join(),turn,reduced]);
  useEffect(()=>{
    const path=game.path,previous=progress.current;
    if(!path.length){progress.current={turn,path:[],index:0};setAnimated(undefined);onTravelChange?.(false);return;}
    const continued=previous.turn===turn&&previous.path.every((field,i)=>path[i]===field),index=continued?Math.min(previous.index,path.length-1):0;
    progress.current={turn,path:[...path],index};setAnimated(path[index]);
    if(reduced){progress.current.index=path.length-1;setAnimated(path.at(-1));onTravelChange?.(false);return;}
    onTravelChange?.(index<path.length-1||rolling);if(rolling)return;
    const delay={slow:280,normal:220,fast:140}[game.options.tempo];
    const timer=setInterval(()=>{const next=Math.min(++progress.current.index,path.length-1);setAnimated(path[next]);if(next===path.length-1){clearInterval(timer);onTravelChange?.(false);}},delay);
    return()=>clearInterval(timer);
  },[key,turn,rolling,game.options.tempo,onTravelChange,reduced]);
  if(error)return <div className="party-world-fallback"><p role="status">3D ist auf diesem Gerät nicht verfügbar. Du kannst auf der Übersicht weiterspielen.</p><PartyMapFallback game={game} rolling={rolling} onTravelChange={onTravelChange}/></div>;
  return <section className="party-board-wrap party-board-3d" aria-label="3D-Inselkarte">
    <div className="party-map-tools"><span><b>★</b> Trophäe auf Feld {game.trophyField}<small>20 Münzen</small></span><button onClick={()=>setAngle(angle-Math.PI/4)} aria-label="Kamera nach links drehen">↶</button><button onClick={()=>setAngle(angle+Math.PI/4)} aria-label="Kamera nach rechts drehen">↷</button><button onClick={()=>setZoom(Math.max(1,zoom-.5))} disabled={zoom===1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(Math.min(2,zoom+.5))} disabled={zoom===2} aria-label="Karte vergrößern">+</button></div>
    <div className="party-world" ref={host} role="group" aria-label="Drehbare 3D-Insel mit begehbaren Wegen, Vulkan, Hafen und eigenen Spielfiguren"><button className="party-camera-focus" onClick={()=>setFollow(!follow)}>{follow?"Ganze Insel":"Zur Figur"}</button>{!ready&&<div className="party-world-loading" role="status">Die Insel taucht auf …</div>}</div>
    <div className="party-map-caption" role="status">{selected!==undefined?<><strong>Feld {selected}: {FIELD_LABELS[BOARD[selected].type]}</strong><span>{selected===game.trophyField?"Trophäe: 20 Münzen. ":""}{HELP[BOARD[selected].type]}</span></>:<><strong>{game.phase==="path"?"Wähle deinen Weg durch die Insel.":"Ziehe über die Insel, sammle Trophäen."}</strong><span>Ziehen dreht die Kamera. Tippe auf ein Feld, um es zu entdecken.</span></>}</div>
    <details className="party-field-browser"><summary>Felder und Figuren</summary><div>{BOARD.map(field=><button key={field.id} aria-label={`Feld ${field.id}: ${FIELD_LABELS[field.type]}${field.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>setSelected(field.id)}>{field.id} {FIELD_LABELS[field.type]}</button>)}</div></details>
    <div className="party-position-announcements" aria-label="Figurenpositionen">{game.players.map(player=><output key={player.id} className="party-player-position" data-player={player.id} data-field={positions[player.id]}>{player.name}: Feld {positions[player.id]}</output>)}</div>
  </section>;
}
