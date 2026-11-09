import { fieldName, JAYSPOT, partyBoard } from "../../shared/partyBoard";
import { mapObjective, objectiveHint } from "./RollItUp";
import {preloadFigures} from "../figures/catalog";
import { useEffect, useRef, useState } from "react";
import { activePartyPlayer, FIELD_LABELS, type PartyGame } from "../../shared/party";
import type { BoardFrame } from "../three/boardWorld";
import { PartyMapFallback } from "./PartyMapFallback";

export const FIGURES=["●","▲","■","◆","✚","★"];
const HELP={start:"Beim Passieren bekommst du 3 Münzen.",coin:"Beim Landen bekommst du 3 Münzen.",bad:"Beim Landen verlierst du bis zu 3 Münzen. Ein Schild schützt dich.",event:"Eine Überraschung für dich oder die ganze Gruppe.",gift:"Hier wartet ein zufälliges Item auf dich.",shop:"Kaufe ein Item für deinen nächsten Zug.",safe:"Hier kannst du die Aussicht genießen."};
export function PartyBoard({game,now=Date.now(),rolling=false,onTravelChange}:{game:PartyGame;now?:number;rolling?:boolean;onTravelChange?:(moving:boolean)=>void}) {
  const [overview,setOverview]=useState(false),[zoom,setZoom]=useState(1),[angle,setAngle]=useState(0),[follow,setFollow]=useState(false),[selected,setSelected]=useState<number>(),[error,setError]=useState(false),[ready,setReady]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  const p=activePartyPlayer(game),turn=`${game.round}-${game.turn}`,inspected=selected??p.position;
  const tray=game.mode==="roll-it-up", board=partyBoard(game);
  const reduced=typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const positions=Object.fromEntries(game.players.map(player=>[player.id,player.position]));
  const current=useRef<BoardFrame>({game,positions,zoom,angle,follow,reduce:reduced,now});current.current={game,positions,zoom,angle,follow,reduce:reduced,now};
  useEffect(()=>{
    if(error||overview)return;setReady(false);let cancelled=false,world:{dispose:()=>void}|undefined;
    void Promise.all([import("../three/boardWorld"),preloadFigures(game.players.map(p=>p.characterId))]).then(([{createBoardWorld}])=>{if(cancelled||!host.current)return;try{world=createBoardWorld(host.current,()=>current.current,setSelected,()=>setError(true));setReady(true);}catch{setError(true);}}).catch(()=>setError(true));
    return()=>{cancelled=true;world?.dispose();};
  },[error,overview]);
  useEffect(()=>{if(game.dice.length&&!reduced)setFollow(true);},[game.dice.join(),turn,reduced]);
  useEffect(()=>{onTravelChange?.(game.phase==="moving");},[game.phase,onTravelChange]);
  const toggle=<div className="party-map-view-switch" role="group" aria-label="Kartenansicht"><button aria-pressed={!overview} onClick={()=>setOverview(false)}>{tray?"3D-Bauschale":"3D-Insel"}</button><button aria-pressed={overview} onClick={()=>setOverview(true)}>Klare Übersicht</button></div>;
  if(error||overview)return <div className="party-world-fallback">{toggle}{error&&<p role="status">3D ist auf diesem Gerät nicht verfügbar. Die Übersicht bleibt spielbar.</p>}<PartyMapFallback game={game} rolling={rolling}/></div>;
  return <section className="party-board-wrap party-board-3d" aria-label={tray?"3D-Bauschale":"3D-Inselkarte"}>
    {toggle}<div className="party-map-tools">{mapObjective(game)}<button onClick={()=>setAngle(angle-Math.PI/4)} aria-label="Kamera nach links drehen">↶</button><button onClick={()=>setAngle(angle+Math.PI/4)} aria-label="Kamera nach rechts drehen">↷</button><button onClick={()=>setZoom(Math.max(1,zoom-.5))} disabled={zoom===1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(Math.min(2,zoom+.5))} disabled={zoom===2} aria-label="Karte vergrößern">+</button></div>
    <div className="party-world" ref={host} role="group" aria-label={tray?"Drehbare Bauschale mit sechs Kaufstellen und Jayspot":"Drehbare 3D-Insel mit begehbaren Wegen, Vulkan, Hafen und eigenen Spielfiguren"}><button className="party-camera-focus" onClick={()=>setFollow(!follow)}>{follow?(tray?"Ganze Schale":"Ganze Insel"):"Zur Figur"}</button>{!ready&&<div className="party-world-loading" role="status">{tray?"Bauschale wird geladen …":"Die Insel taucht auf …"}</div>}</div>
    <div className={`party-map-caption party-map-caption--${board[inspected].type}`} role="status"><strong>Feld {inspected}: {fieldName(game,inspected)}</strong><span>{objectiveHint(game,inspected)}{inspected!==JAYSPOT&&HELP[board[inspected].type]}</span></div>
    <div className="party-field-legend" aria-label="Feldarten">{Object.entries(FIELD_LABELS).map(([type,label])=><span className={`party-legend-${type}`} key={type}><i aria-hidden="true"/>{tray&&type==="start"?"Start":label}</span>)}</div>
    <details className="party-field-browser"><summary>Felder und Figuren</summary><div>{board.map(field=><button key={field.id} aria-label={`Feld ${field.id}: ${fieldName(game,field.id)}${!tray && field.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>setSelected(field.id)}>{field.id} {fieldName(game,field.id)}</button>)}</div></details>
    <div className="party-position-announcements" aria-label="Figurenpositionen">{game.players.map(player=><output key={player.id} className="party-player-position" data-player={player.id} data-field={positions[player.id]}>{player.name}: Feld {positions[player.id]}</output>)}</div>
  </section>;
}
