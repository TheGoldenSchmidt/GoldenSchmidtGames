import {useEffect,useRef,useState} from "react";
import {CHARACTERS,isCharacterId,type CharacterId} from "../../shared/characters";
import {loadFigure} from "../figures/catalog";
export function CharacterPreview({value,index}: {value?:CharacterId;index:number}) {
  const selected=isCharacterId(value)?value:undefined,entry=CHARACTERS.find(c=>c.id===selected);
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
  return (
    <div className="party-character-stage">
      <div className="party-character-canvas" ref={host} role="img" aria-label={entry?`3D-Vorschau: ${entry.name}`:"Wähle deine Spielfigur"} onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.012);}} onPointerUp={()=>drag.current=undefined} onPointerCancel={()=>drag.current=undefined}/>
      {!entry?<div className="character-invitation"><span>?</span><strong>Wer spielt mit?</strong><p>Wähle zuerst deine Figur.</p></div>:(!loaded||failed)&&<p className="party-character-loading">{failed?`${entry.name} ist gewählt. Die 3D-Vorschau ist auf diesem Gerät nicht verfügbar.`:"Deine Figur betritt die Bühne …"}</p>}
      {entry&&<button type="button" className="party-character-rotate" onClick={()=>setAngle(a=>a+Math.PI/2)} aria-label="Figur drehen">↻ Drehen</button>}
    </div>
  );
}
