import { useEffect, useState } from "react";
import { activePartyPlayer, BOARD, FIELD_ICONS, FIELD_LABELS, type PartyGame } from "../../shared/party";

export const FIGURES=["●","▲","■","◆","✚","★"];
export function PartyBoard({game}:{game:PartyGame}) {
  const [zoom,setZoom]=useState(1),[selected,setSelected]=useState<number>(),[animated,setAnimated]=useState<number>();
  const p=activePartyPlayer(game),key=game.path.join(",");
  useEffect(()=>{
    if(!game.path.length){setAnimated(undefined);return;}
    const path=game.path;let index=0;setAnimated(path[0]);
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setAnimated(path.at(-1));return;}
    const delay={slow:240,normal:130,fast:55}[game.options.tempo];
    const timer=setInterval(()=>{index++;setAnimated(path[Math.min(index,path.length-1)]);if(index>=path.length-1)clearInterval(timer);},delay);
    return()=>clearInterval(timer);
  },[key,game.round,game.turn]);
  return <section className="party-board-wrap" aria-label="Inselkarte"><div className="party-map-tools"><span>Inselkarte</span><button onClick={()=>setZoom(Math.max(1,zoom-.5))} disabled={zoom===1} aria-label="Karte verkleinern">−</button><button onClick={()=>setZoom(Math.min(2,zoom+.5))} disabled={zoom===2} aria-label="Karte vergrößern">+</button></div>
    <div className="party-map-scroll"><svg viewBox="0 0 100 105" style={{width:`${zoom*100}%`}} role="img" aria-label="Insel mit Hafen, Dschungel, Vulkan und Jahrmarkt">
      <defs><pattern id="party-water" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M1 5q2-2 4 0t4 0" fill="none" stroke="#52a8bd" strokeWidth=".3"/></pattern></defs>
      <rect width="100" height="105" fill="#227c9d"/><rect width="100" height="105" fill="url(#party-water)"/>
      <path d="M48 4Q86 3 95 36Q100 67 76 93Q43 104 17 87Q0 64 6 36Q12 10 48 4" fill="#fff1cc"/>
      <path d="M23 29Q37 10 64 23L72 47 44 68 21 56Z" fill="#80b77a"/>
      <path d="M67 67l10-23 10 24Z" fill="#d95848"/><path d="M73 53l4-9 4 9Z" fill="#ffd166"/>
      <text x="48" y="15" className="party-region">Hafen</text><text x="46" y="30" className="party-region">Dschungel</text><text x="75" y="73" className="party-region">Vulkan</text><text x="25" y="68" className="party-region">Jahrmarkt</text>
      {BOARD.flatMap(f=>f.next.map(next=><line key={`${f.id}-${next}`} x1={f.x} y1={f.y} x2={BOARD[next].x} y2={BOARD[next].y} stroke="#c4a36b" strokeWidth="1.7"/>))}
      {BOARD.map(f=><g key={f.id} role="button" tabIndex={0} aria-label={`Feld ${f.id}: ${FIELD_LABELS[f.type]}${f.id===game.trophyField?", Trophäenstand":""}`} onClick={()=>setSelected(f.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setSelected(f.id);}}} className={`party-field party-field--${f.type}`}>
        <circle cx={f.x} cy={f.y} r="2.6"/><text x={f.x} y={f.y+.9}>{FIELD_ICONS[f.type]}</text>
        {f.id===game.trophyField&&<><circle cx={f.x+2} cy={f.y-3} r="2.7" fill="#ffd166"/><text x={f.x+2} y={f.y-2}>★</text></>}
      </g>)}
      {game.players.map((player,i)=>{const field=BOARD[player.id===p.id&&animated!==undefined?animated:player.position];const same=game.players.filter(q=>q.position===player.position).findIndex(q=>q.id===player.id);return <g key={player.id} className={`party-pawn party-pawn--${i}`} style={{transform:`translate(${field.x+(same%3-1)*2.7}px,${field.y-3-Math.floor(same/3)*2.7}px)`}}><title>{`${player.name}: Feld ${player.position}`}</title><circle r="2.3"/><text y=".9">{FIGURES[i]}</text></g>;})}
    </svg></div>
    <p className="party-map-caption">{selected!==undefined?`Feld ${selected}: ${FIELD_LABELS[BOARD[selected].type]}${selected===game.trophyField?" · Trophäe: 20 Münzen":""}`:"Tippe auf ein Feld. An Abzweigungen wählst du deinen Weg."}</p>
    <div className="party-map-legend">{Object.entries(FIELD_LABELS).filter(([id])=>id!=="start"&&id!=="safe").map(([id,label])=><span key={id}>{FIELD_ICONS[id as keyof typeof FIELD_ICONS]} {label}</span>)}</div>
  </section>;
}
