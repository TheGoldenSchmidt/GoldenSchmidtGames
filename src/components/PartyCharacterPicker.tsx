import {useEffect,useId,useRef,useState} from "react";
import {CHARACTERS,characterPortrait,isCharacterId,type CharacterId} from "../../shared/characters";
import {loadFigure} from "../figures/catalog";
export function PartyCharacterPicker({value,index=0,disabled=false,onChange,title="Deine Spielfigur"}:{value?:string;index?:number;disabled?:boolean;onChange:(id:CharacterId)=>void;title?:string}){
  const selected=isCharacterId(value)?value:undefined,entry=CHARACTERS.find(c=>c.id===selected),titleId=useId();
  const [angle,setAngle]=useState(.15),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false);
  const host=useRef<HTMLDivElement>(null),drag=useRef<{x:number;angle:number}|undefined>(undefined);
  const [reduce,setReduce]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(()=>{const media=window.matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduce(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[]);
  const current=useRef({angle,reduce});current.current={angle,reduce};
  useEffect(()=>{
    let cancelled=false,world:{dispose:()=>void}|undefined;setFailed(false);setLoaded(false);
    if(!selected)return;
    void Promise.all([import("../three/characterPreview"),loadFigure(selected)]).then(([{createCharacterPreview}])=>{if(cancelled||!host.current)return;try{world=createCharacterPreview(host.current,selected,index,()=>current.current,()=>setFailed(true));setLoaded(true);}catch{setFailed(true);}}).catch(()=>{if(!cancelled)setFailed(true);});
    return()=>{cancelled=true;world?.dispose();};
  },[selected,index]);
  return <section className="party-character-picker" aria-labelledby={titleId}>
    <div className="party-character-stage">
      <div className="party-character-canvas" ref={host} role="img" aria-label={entry?`3D-Vorschau: ${entry.name}`:"Wähle deine Spielfigur"} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.012);}} onPointerUp={()=>drag.current=undefined} onPointerCancel={()=>drag.current=undefined}/>
      {!entry?<div className="character-invitation"><span>?</span><strong>Wer spielt mit?</strong><p>Wähle zuerst deine Figur.</p></div>:(!loaded||failed)&&<p className="party-character-loading">{failed?`${entry.name} ist gewählt. Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar.`:"Deine Figur betritt die Bühne …"}</p>}
      {entry&&<button type="button" className="party-character-rotate" onClick={()=>setAngle(a=>a+Math.PI/2)} aria-label="Figur drehen">↻ Drehen</button>}
    </div>
    <div className="party-character-choice">
      <h2 id={titleId}>{title}</h2><p><strong aria-live="polite">{entry?.name??"Noch keine Figur gewählt"}</strong>{entry?" begleitet dich durch alle Spiele.":" – danach kannst du eine Partie erstellen oder beitreten."}</p>
      <div className="party-character-grid" role="group" aria-label="Spielfigur auswählen">{CHARACTERS.map(c=><button type="button" key={c.id} aria-pressed={c.id===selected} disabled={disabled} onClick={()=>onChange(c.id)}><img src={characterPortrait(c.id)} alt="" width="80" height="86" loading="lazy"/>{c.name}{c.id===selected&&<span aria-hidden="true">✓</span>}</button>)}</div>
      <small>Alle Figuren haben dieselben Fähigkeiten. Du kannst sie bis zum Start wechseln.</small>
    </div>
  </section>;
}
