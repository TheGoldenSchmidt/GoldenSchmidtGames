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
  const [overview,setOverview]=useState(false),[zoom,setZoom]=useState(1),[angle,setAngle]=useState(0),[follow,setFollow]=useState(true),[selected,setSelected]=useState<number>(),[error,setError]=useState(false),[ready,setReady]=useState(false),[view,setView]=useState(0);
  const [reduced,setReduced]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const host=useRef<HTMLDivElement>(null);
  const p=activePartyPlayer(game),turn=`${game.round}-${game.turn}`,inspected=selected??p.position;
  const tray=game.mode==="roll-it-up", board=partyBoard(game);
  const positions=Object.fromEntries(game.players.map(player=>[player.id,player.position]));
  const frame={game,positions,zoom,angle,follow,selected,view,reduce:reduced,now};
  const current=useRef<BoardFrame>(frame);current.current=frame;
  function inspect(id:number) {setSelected(id);setFollow(true);setZoom(1);setView(value=>value+1);}
  function camera(focus:boolean) {setSelected(undefined);setFollow(focus);setZoom(1);setAngle(0);setView(value=>value+1);}
  useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduced(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[]);
  useEffect(()=>{
    if(error||overview)return;setReady(false);let cancelled=false,world:{dispose:()=>void}|undefined;
    void Promise.all([import("../three/boardWorld"),preloadFigures(game.players.map(p=>p.characterId))]).then(([{createBoardWorld}])=>{if(cancelled||!host.current)return;try{world=createBoardWorld(host.current,()=>current.current,inspect,()=>setError(true),setZoom);setReady(true);}catch{setError(true);}}).catch(()=>setError(true));
    return()=>{cancelled=true;world?.dispose();};
  },[error,overview]);
  useEffect(()=>{setSelected(undefined);},[turn,game.dice.join()]);
  useEffect(()=>{onTravelChange?.(game.phase==="moving");},[game.phase,onTravelChange]);
  const toggle=<div className="party-map-view-switch" role="group" aria-label="Kartenansicht"><button aria-pressed={!overview} onClick={()=>setOverview(false)}>{tray?"3D-Bauschale":"3D-Insel"}</button><button aria-pressed={overview} onClick={()=>setOverview(true)}>Klare Übersicht</button></div>;
  if(error||overview)return <div className="party-world-fallback">{toggle}{error&&<p role="status">3D ist auf diesem Gerät nicht verfügbar. Die Übersicht bleibt spielbar.</p>}<PartyMapFallback game={game} rolling={rolling}/></div>;
  return <section className="party-board-wrap party-board-3d" aria-label={tray?"3D-Bauschale":"3D-Inselkarte"}>
    {toggle}<div className="party-map-objective">{mapObjective(game)}</div>
    <div className="party-world" ref={host} role="group" aria-label={tray?"Drehbare Bauschale mit sechs Kaufstellen und Jayspot":"Drehbare 3D-Insel mit begehbaren Wegen, Vulkan, Hafen und eigenen Spielfiguren"}>{!ready&&<div className="party-world-loading" role="status">{tray?"Bauschale wird geladen …":"Die Insel taucht auf …"}</div>}</div>
    <div className="party-camera-tools" role="group" aria-label="Kamera steuern">
      <div className="party-camera-presets"><button aria-pressed={follow&&selected===undefined} onClick={()=>camera(true)}>Zur Figur</button><button aria-pressed={!follow} onClick={()=>camera(false)}>{tray?"Ganze Schale":"Ganze Insel"}</button></div>
      <div className="party-camera-adjust"><button onClick={()=>setAngle(value=>value-Math.PI/4)} aria-label="Kamera nach links drehen">↶</button><button onClick={()=>setAngle(value=>value+Math.PI/4)} aria-label="Kamera nach rechts drehen">↷</button><button onClick={()=>setZoom(value=>Math.max(1,value-.5))} disabled={zoom<=1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(value=>Math.min(2.5,value+.5))} disabled={zoom>=2.5} aria-label="Karte vergrößern">+</button></div>
    </div>
    <div className={`party-map-caption party-map-caption--${board[inspected].type}`} role="status"><strong>Feld {inspected}: {fieldName(game,inspected)}</strong><span>{objectiveHint(game,inspected)}{inspected!==JAYSPOT&&HELP[board[inspected].type]}</span></div>
    <details className="party-field-browser"><summary>Felder und Figuren</summary>
      <p className="party-camera-hint">Ziehen zum Drehen · mit zwei Fingern zoomen. Oder die Kameratasten nutzen.</p>
      <div className="party-map-players" aria-label="Figur auf der Karte finden">{game.players.map(player=><button key={player.id} onClick={()=>inspect(positions[player.id])}>{player.name}<small>Feld {positions[player.id]}</small></button>)}</div>
      <div className="party-field-legend" aria-label="Feldarten">{Object.entries(FIELD_LABELS).map(([type,label])=><span className={`party-legend-${type}`} key={type}><i aria-hidden="true"/>{tray&&type==="start"?"Start":label}</span>)}</div>
      <div className="party-field-list">{board.map(field=><button key={field.id} aria-pressed={selected===field.id} aria-label={`Feld ${field.id}: ${fieldName(game,field.id)}${!tray && field.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>inspect(field.id)}>{field.id} {fieldName(game,field.id)}</button>)}</div>
    </details>
    <div className="party-position-announcements" aria-label="Figurenpositionen">{game.players.map(player=><output key={player.id} className="party-player-position" data-player={player.id} data-field={positions[player.id]}>{player.name}: Feld {positions[player.id]}</output>)}</div>
  </section>;
}
