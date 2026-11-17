import { fieldName, JAYSPOT, partyBoard, partyPaths, stationAt } from "../../shared/partyBoard";
import { mapObjective, objectiveHint, TrayMapArt } from "./RollItUp";
import {characterId,characterPortrait} from "../../shared/characters";
import { useEffect, useState, type CSSProperties } from "react";
import { FIELD_VISUALS, fieldHelp } from "../lib/partyFieldVisuals";
import { activePartyPlayer, BOARD, type PartyGame } from "../../shared/party";


// Visual coordinates only: rules and all 34 connections stay unchanged.
const POSITIONS: Record<number,[number,number]>={28:[77,60],29:[67,63],30:[65,75],31:[33,69],32:[34,57],33:[24,49]};
const islandMap=BOARD.map(f=>({...f,x:POSITIONS[f.id]?.[0]??f.x,y:POSITIONS[f.id]?.[1]??f.y}));

function Palm({x,y,size=1}:{x:number;y:number;size?:number}) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}><path d="M0 5q2-5 0-11" stroke="#9d7341" strokeWidth="1.6" fill="none"/><path d="M0-6q-7-5-8 1 4-2 8-1m0 0q-1-8 5-7-3 3-5 7m0 0q7-5 9 1-5-2-9-1m0 0q-6-8-9-4 5 0 9 4" fill="#237250"/><circle cy="-5" r="1.1" fill="#bd8849"/></g>;
}

export function PartyMapFallback({game,rolling=false,onTravelChange,onInspect}:{game:PartyGame;rolling?:boolean;onTravelChange?:(moving:boolean)=>void;onInspect?:(field:number)=>void}) {
  const [zoom,setZoom]=useState(1),[selected,setSelected]=useState<number>(),[animated,setAnimated]=useState<number>();

  const p=activePartyPlayer(game), tray=game.mode==="roll-it-up", map=tray?partyBoard(game):islandMap;
  useEffect(()=>{setAnimated(game.phase==="moving"?game.movement?.destination:undefined);onTravelChange?.(game.phase==="moving");},[game.phase,game.movement?.destination,onTravelChange]);
  const route=new Set(game.path),choices=game.phase==="path"?partyPaths(game,p):[];
  function inspect(field:number) {setSelected(field);onInspect?.(field);}
  return <section className="party-board-wrap" aria-label={tray?"Bauschalenkarte":"Inselkarte"}>
    <div className="party-map-tools">{!onInspect&&mapObjective(game)}<button onClick={()=>setZoom(Math.max(1,zoom-.5))} disabled={zoom===1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(Math.min(2,zoom+.5))} disabled={zoom===2} aria-label="Karte vergrößern">+</button></div>
    <div className="party-map-scroll"><svg viewBox="0 0 100 100" style={{width:`${zoom*100}%`,height:`${zoom*100}%`}} role="group" aria-label={tray?"Bauschale mit Jayspot und Kaufstellen":"Insel mit Hafen, Dschungel, Vulkan und Jahrmarkt"}>
      <defs>
        <pattern id="party-water" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M2 7q2-1.8 4 0t4 0" fill="none" stroke="#b0e8df" strokeWidth=".35" opacity=".4"/></pattern>
        <linearGradient id="party-ocean" x2="0" y2="1"><stop stopColor="#31b3bb"/><stop offset="1" stopColor="#087f9b"/></linearGradient>
        <linearGradient id="party-grass" x2=".3" y2="1"><stop stopColor="#6dbb80"/><stop offset="1" stopColor="#43a179"/></linearGradient>
        <filter id="party-field-shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dy=".5" stdDeviation=".25" floodColor="#695c36" floodOpacity=".3"/></filter>
        <g id="party-market"><path d="M-4 0h8v6h-8Z" fill="#fff5d4"/><path d="M-5 0l2-4h6l2 4Z" fill="#e66352"/><path d="M-2-4v4m4-4v4" stroke="#fff5d4" strokeWidth="1.6"/><path d="M-2 6V2h4v4" fill="#a56e39"/></g>
      </defs>
      {tray?<TrayMapArt/>:<><rect width="100" height="100" fill="url(#party-ocean)"/><rect width="100" height="100" fill="url(#party-water)"/>
      <path d="M48 3Q80 1 94 25Q105 52 90 80Q75 103 43 98Q11 100 3 72Q-4 43 10 21Q23 3 48 3" fill="#9bdfcf" opacity=".5"/>
      <path d="M49 5Q83 4 92 29Q102 55 85 79Q74 99 45 95Q15 96 7 73Q-1 48 12 24Q23 6 49 5" fill="#e5c37c"/>
      <path d="M49 4Q83 3 92 28Q102 54 85 78Q74 97 45 93Q15 94 7 71Q-1 46 12 23Q23 6 49 4" fill="#fff0bb"/>
      <path d="M46 15Q72 10 83 32Q94 52 75 74Q65 88 42 83Q19 83 17 62Q11 39 24 25Q33 16 46 15" fill="url(#party-grass)"/>
      <path d="M39 20q12-5 24-2m-41 42q2 13 12 17m33-55q9 6 11 16" stroke="#8dd098" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <g transform="translate(50 18)"><path d="M-6-3h12v5h-12Z" fill="#bd8b54"/><path d="M-5-1h10m-7-2v5m4-5v5" stroke="#84613d" strokeWidth=".5"/><path d="M-2-3v-6h5l-2 2 2 2h-5" fill="#e66352" stroke="#fff0bb" strokeWidth=".4"/></g>
      <g transform="translate(51 41)"><use href="#party-market"/><path d="M-10 7q10-3 20 0" stroke="#e8d18d" strokeWidth="2" fill="none"/><path d="M-9-1v-8m0 0 4 4-4 1" stroke="#fff0bb" strokeWidth=".6" fill="#ffcc4d"/><path d="M9-1v-8m0 0-4 4 4 1" stroke="#fff0bb" strokeWidth=".6" fill="#e66352"/></g>
      <g transform="translate(38 48)"><ellipse cy="8" rx="8" ry="3" fill="#308565"/><path d="M-8 8-2-9h4l7 17Z" fill="#87675c"/><path d="m-2-9-3 8 5-2 5 3-3-9Z" fill="#f59866"/><path d="m0-8-1 10 3 3" stroke="#e66352" strokeWidth="1.2" fill="none"/><path d="M0-12q-4-3-1-5m3 5q4-2 1-4" stroke="#f4eac5" strokeWidth="1.4" fill="none" strokeLinecap="round"/></g>
      <Palm x={65} y={48}/><Palm x={76} y={52} size={.75}/><Palm x={56} y={58} size={.75}/><Palm x={26} y={33} size={.6}/><Palm x={25} y={76} size={.55}/>
      <g transform="translate(7 12) rotate(-20)"><path d="m-4 2 8 0-2 3h-4Z" fill="#fff0bb"/><path d="M0 1v-9l5 8Z" fill="#fffdf0"/></g>
      <g fill="none" stroke="#fff0bb" strokeWidth=".4"><path d="M86 10q2-2 4 0 2-2 4 0"/><path d="M4 84q2-2 4 0 2-2 4 0"/></g>
      </> }
      {map.flatMap(f=>f.next.map(next=>{const a=map[f.id],b=map[next],traversed=route.has(f.id)&&route.has(next);return <g key={`${f.id}-${next}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#bba365" strokeWidth="2.7" strokeLinecap="round"/><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={traversed?"#ffcc4d":"#fff5d7"} strokeWidth="1.7" strokeLinecap="round"/></g>;}))}
      {!tray&&<><text x="49" y="27" className="party-region">Hafen</text><text x="53" y="53" className="party-region">Jahrmarkt</text><text x="72" y="73" className="party-region">Dschungel</text><text x="25" y="58" className="party-region">Vulkan</text></>}
      {map.map(f=><g key={f.id} role="button" tabIndex={0} aria-label={`Feld ${f.id}: ${fieldName(game,f.id)}${!tray && f.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>inspect(f.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();inspect(f.id);}}} style={{"--field-color":FIELD_VISUALS[f.type].color,"--field-ink":FIELD_VISUALS[f.type].ink} as CSSProperties} className={`party-field party-field--${f.type} ${selected===f.id?"is-selected":""} ${choices.includes(f.id)?"is-choice":""}`}>
        <circle cx={f.x} cy={f.y} r="3.1" filter="url(#party-field-shadow)"/><text className="party-field-symbol" x={f.x} y={f.y} dominantBaseline="central">{FIELD_VISUALS[f.type].symbol}</text>
        {tray && stationAt(f.id) && <g className="roll-map-label" transform={`translate(${50+(f.x-50)*.8} ${50+(f.y-50)*.8})`}><rect x="-6.2" y="-2.1" width="12.4" height="4.2" rx="1.4"/><text y=".8">{stationAt(f.id)!.name}</text></g>}
        {!tray && f.id===game.trophyField&&<g className="party-map-trophy" transform={`translate(${f.x} ${f.y-6})`}><path d="m0 5-3-5h6Z" fill="#ffcc4d"/><circle r="3.6" fill="#ffcc4d" stroke="#fff7d6" strokeWidth=".8"/><text y="1.2">★</text></g>}
      </g>)}
      {game.players.map((player,i)=>{const field=map[player.id===p.id&&animated!==undefined?animated:player.position],occupants=game.players.filter(q=>q.position===player.position),same=occupants.findIndex(q=>q.id===player.id);const shift=occupants.length>1?(same%3-1)*2.6:0;return <g key={player.id} data-player={player.id} data-field={field.id} className={`party-pawn party-pawn--${i} ${player.id===p.id?"is-active":""}`} style={{transform:`translate(${field.x+shift}px,${field.y-2.5-Math.floor(same/3)*3}px)`}}><title>{`${player.name}: Feld ${player.position}`}</title><ellipse cy="3" rx="2" ry=".65" fill="#10485b" opacity=".3"/><path d="M-1.8 1.4q-1-3.5 1.8-4.2 2.8.7 1.8 4.2L0 3Z"/><circle cy="-.9" r="1.65"/><image href={characterPortrait(characterId(player.characterId,i))} x="-2.5" y="-3.5" width="5" height="6"/></g>;})}
    </svg></div>
    {!onInspect&&<div className="party-map-caption" role="status">{selected!==undefined?<><strong>Feld {selected}: {fieldName(game,selected)}</strong><span>{objectiveHint(game,selected)}{selected!==JAYSPOT&&fieldHelp(game,map[selected].type)}</span></>:<><strong>{game.phase==="path"?"Du stehst an einer Abzweigung.":tray?"Die Bauschale":"Deine Insel, dein Weg."}</strong><span>{game.phase==="path"?"Die markierten Felder zeigen deine beiden Wege.":"Felder antippen und entdecken, was dich erwartet."}</span></>}</div>}
  </section>;
}
