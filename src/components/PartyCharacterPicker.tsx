import { useEffect, useRef, useState } from "react";
import { CHARACTERS, characterId, type CharacterId } from "../../shared/characters";

export function PartyCharacterPicker({value,index=0,disabled=false,onChange}:{value?:string;index?:number;disabled?:boolean;onChange:(id:CharacterId)=>void}){
  const selected=characterId(value,index),entry=CHARACTERS.find(c=>c.id===selected)!;
  const [angle,setAngle]=useState(.15),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  const host=useRef<HTMLDivElement>(null),drag=useRef<{x:number;angle:number}|undefined>(undefined);
  const [reduce,setReduce]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduce(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[]);
  const current=useRef({angle,reduce});current.current={angle,reduce};
  useEffect(()=>{
    let cancelled=false,world:{dispose:()=>void}|undefined;setFailed(false);setLoaded(false);
    void import("../three/characterPreview").then(({createCharacterPreview})=>{if(cancelled||!host.current)return;try{world=createCharacterPreview(host.current,selected,index,()=>current.current,()=>setFailed(true));setLoaded(true);}catch{setFailed(true);}}).catch(()=>setFailed(true));
    return()=>{cancelled=true;world?.dispose();};
  },[selected,index]);
  return <section className="party-character-picker" aria-labelledby="party-character-title">
    <div className="party-character-stage">
      <div className="party-character-canvas" ref={host} role="img" aria-label={`3D-Vorschau: ${entry.name}`} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.012);}} onPointerUp={()=>drag.current=undefined} onPointerCancel={()=>drag.current=undefined}/>
      {(!loaded||failed)&&<p className="party-character-loading">{failed?`${entry.name} ist gewählt. Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar.`:"Deine Figur betritt die Bühne …"}</p>}
      <button type="button" className="party-character-rotate" onClick={()=>setAngle(a=>a+Math.PI/2)} aria-label="Figur drehen">↻ Drehen</button>
    </div>
    <div className="party-character-choice">
      <h2 id="party-character-title">Deine Spielfigur</h2><p><strong aria-live="polite">{entry.name}</strong> begleitet dich über die Insel und in jedes Minispiel.</p>
      <div className="party-character-grid" role="group" aria-label="Spielfigur auswählen">{CHARACTERS.map(c=><button type="button" key={c.id} aria-pressed={c.id===selected} disabled={disabled} onClick={()=>onChange(c.id)}><i style={{background:c.color}} aria-hidden="true"/>{c.name}{c.id===selected&&<span aria-hidden="true">✓</span>}</button>)}</div>
      <small>Alle Figuren haben dieselben Fähigkeiten. Du kannst sie bis zum Start wechseln.</small>
    </div>
  </section>;
}
