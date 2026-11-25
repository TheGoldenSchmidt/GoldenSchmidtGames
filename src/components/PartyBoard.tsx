import { fieldName, goalField, partyBoard } from "../../shared/partyBoard";
import { mapObjective, objectiveHint } from "./RollItUp";
import { preloadFigures } from "../figures/catalog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { activePartyPlayer, FIELD_LABELS, fieldLabel, type PartyGame } from "../../shared/party";
import type { BoardFrame } from "../three/boardWorld";
import { PartyMapFallback } from "./PartyMapFallback";
import { PartyPanel } from "./PartyPanel";
import { FIELD_VISUALS, fieldHelp } from "../lib/partyFieldVisuals";

export const FIGURES=["●","▲","■","◆","✚","★"];
interface Props {
  game:PartyGame;now?:number;rolling?:boolean;onTravelChange?:(moving:boolean)=>void;
  roster?:ReactNode;tools?:ReactNode;interactionBlocked?:boolean;
}
export function PartyBoard({game,now=Date.now(),rolling=false,onTravelChange,roster,tools,interactionBlocked=false}:Props) {
  const [overview,setOverview]=useState(false),[zoom,setZoom]=useState(1),[angle,setAngle]=useState(0);
  const [follow,setFollow]=useState(true),[selected,setSelected]=useState<number>(),[detail,setDetail]=useState<"fields"|"field"|"camera">();
  const [error,setError]=useState(false),[ready,setReady]=useState(false),[view,setView]=useState(0);
  const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const host=useRef<HTMLDivElement>(null);
  const p=activePartyPlayer(game),turn=`${game.round}-${game.turn}`,inspected=selected??p.position;
  const tray=game.mode==="roll-it-up",board=partyBoard(game),flat=error||overview;
  const positions=Object.fromEntries(game.players.map(player=>[player.id,player.position]));
  const frame={game,positions,zoom,angle,follow,selected,view,reduce:reduced,now,blocked:interactionBlocked||Boolean(detail)};
  const current=useRef<BoardFrame>(frame);current.current=frame;
  function inspect(id:number) {setSelected(id);setDetail(current=>current==="fields"?current:"field");}
  function camera(focus:boolean) {setSelected(undefined);setFollow(focus);setZoom(1);setAngle(0);setView(value=>value+1);}
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduced(media.matches);
    media.addEventListener("change",change);return()=>media.removeEventListener("change",change);
  },[]);
  useEffect(()=>{
    if(flat)return;setReady(false);let cancelled=false,world:{dispose:()=>void}|undefined;
    void Promise.all([import("../three/boardWorld"),preloadFigures(game.players.map(player=>player.characterId))]).then(([{createBoardWorld}])=>{
      if(cancelled||!host.current)return;
      try{world=createBoardWorld(host.current,()=>current.current,inspect,()=>setError(true),setZoom);setReady(true);}catch{setError(true);}
    }).catch(()=>setError(true));
    return()=>{cancelled=true;world?.dispose();};
  },[flat]);
  useEffect(()=>{setSelected(undefined);setDetail(current=>current==="field"?undefined:current);},[turn,game.dice.join()]);
  useEffect(()=>{onTravelChange?.(game.phase==="moving");},[game.phase,onTravelChange]);
  const caption=<div className={`party-map-caption party-map-caption--${board[inspected].type}`} role="status"><strong>Feld {inspected}: {fieldName(game,inspected)}</strong><span>{objectiveHint(game,inspected)}{inspected!==goalField(game)&&fieldHelp(game,board[inspected].type)}</span></div>;
  return <section className={`party-board-wrap party-board-3d ${flat?"is-overview":""}`} aria-label={tray?"Bauschalenkarte":"Inselkarte"}>
    <div className="party-board-toolbar">
      <div className="party-map-objective">{mapObjective(game)}</div>
      <button className="party-view-toggle" disabled={error} onClick={()=>setOverview(value=>!value)} aria-label={flat?"Zur 3D-Ansicht wechseln":"Zur 2D-Übersicht wechseln"}>{flat?"3D":"2D"}</button>
      {!flat&&<button onClick={()=>setDetail("camera")} aria-haspopup="dialog" aria-label="Kamera öffnen"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8Z"/></svg></button>}
      <button className="party-fields-toggle" onClick={()=>setDetail("fields")} aria-haspopup="dialog" aria-label="Felder und Figuren">⌖</button>
    </div>
    <div className="party-world-stage">
      {flat?<PartyMapFallback game={game} rolling={rolling} onInspect={inspect}/>:<div className="party-world" ref={host} role="group" aria-label={tray?"Drehbare Bauschale mit sechs Kaufstellen und Jayspot":"Drehbare 3D-Insel mit begehbaren Wegen, Vulkan, Hafen und eigenen Spielfiguren"}>
        {!ready&&<div className="party-world-loading" role="status">{tray?"Bauschale wird geladen …":"Die Insel taucht auf …"}</div>}
      </div>}
      <div className="party-map-side-tools">{tools}</div>
      {error&&<p className="party-map-error" role="status">3D ist hier nicht verfügbar. Die 2D-Karte bleibt spielbar.</p>}
    </div>
    {roster}
    {detail==="camera"&&<PartyPanel title="Kamera" onClose={()=>setDetail(undefined)}><p className="party-camera-hint">Ziehen zum Drehen · mit zwei Fingern zoomen. Dein gewählter Ausschnitt bleibt beim Öffnen von Informationen erhalten.</p><div className="party-camera-tools" role="group" aria-label="Kamera steuern">
      <div className="party-camera-presets"><button aria-pressed={follow} onClick={()=>camera(true)}>Zur Figur</button><button aria-pressed={!follow} onClick={()=>camera(false)}>{tray?"Ganze Schale":"Ganze Insel"}</button></div>
      <div className="party-camera-adjust"><button onClick={()=>setAngle(value=>value-Math.PI/4)} aria-label="Kamera nach links drehen">↶</button><button onClick={()=>setAngle(value=>value+Math.PI/4)} aria-label="Kamera nach rechts drehen">↷</button><button onClick={()=>setZoom(value=>Math.max(1,value-.5))} disabled={zoom<=1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(value=>Math.min(2.5,value+.5))} disabled={zoom>=2.5} aria-label="Karte vergrößern">+</button></div>
    </div></PartyPanel>}
    {detail==="field"&&<PartyPanel title="Feldinfo" onClose={()=>setDetail(undefined)}>{caption}</PartyPanel>}
    {detail==="fields"&&<PartyPanel title="Felder und Figuren" onClose={()=>setDetail(undefined)}>
      {caption}<p className="party-camera-hint">Feld oder Figur auswählen, um die Feldinfo zu lesen. Dein Kartenausschnitt bleibt erhalten.</p>
      <div className="party-map-players" aria-label="Figur auf der Karte finden">{game.players.map(player=><button key={player.id} onClick={()=>inspect(positions[player.id])}>{player.name}<small>Feld {positions[player.id]}</small></button>)}</div>
      <div className="party-field-legend" aria-label="Feldarten">{(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[]).filter(type=>board.some(field=>field.type===type)).map(type=>{const look=FIELD_VISUALS[type];return <span key={type}><i aria-hidden="true" style={{backgroundColor:look.color,color:look.ink}}>{look.symbol}</i>{tray&&type==="start"?"Start":fieldLabel(game,type)}</span>;})}</div>
      <div className="party-field-list">{board.map(field=><button key={field.id} aria-pressed={selected===field.id} aria-label={`Feld ${field.id}: ${fieldName(game,field.id)}${!tray&&field.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>inspect(field.id)}>{field.id} {fieldName(game,field.id)}</button>)}</div>
    </PartyPanel>}
    <div className="party-position-announcements" aria-label="Figurenpositionen">{game.players.map(player=><output key={player.id} className="party-player-position" data-player={player.id} data-field={positions[player.id]}>{player.name}: Feld {positions[player.id]}</output>)}</div>
  </section>;
}
