import { useEffect, useMemo, useRef, useState } from "react";
import { RIGGED_CHARACTERS, isRiggedCharacter, type CharacterId } from "../../shared/characters";
import { createProberaum, PRACTICE_STATIONS, stepProberaum, visitStation } from "../../shared/proberaum";
import { NEUTRAL_MATCH_INPUT } from "../../shared/matches/types";
import { parcoursClient } from "../matches/games/parcours";
import { PRACTICE_LOOPS, PRACTICE_SHOTS } from "../matches/practiceAnimations";
import type { MatchIO, MatchWorld, MatchWorldFrame } from "../matches/client";
import { preloadFigures } from "../figures/catalog";
import { PartyPanel } from "../components/PartyPanel";

export function PracticeWorldScreen({characterId,onExit}:{characterId?:CharacterId;onExit:()=>void}) {
  const [character,setCharacter]=useState<CharacterId>(isRiggedCharacter(characterId)?characterId:"rig_jonas"),[panel,setPanel]=useState<"stations"|"tools">(),[preview,setPreview]=useState("");
  const [generation,setGeneration]=useState(0),[mode,setMode]=useState<"loading"|"ready"|"flat">("loading"),[paused,setPaused]=useState(false);
  const [reduced,setReduced]=useState(()=>matchMedia("(prefers-reduced-motion: reduce)").matches);
  const current=useRef(useMemo(()=>createProberaum(),[])),prev=useRef(current.current),[snapshot,setSnapshot]=useState(current.current);
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),input=useRef({...NEUTRAL_MATCH_INPUT}),local=useRef<Record<string,number>>({}),at=useRef(performance.now());
  const blocked=useRef(false);blocked.current=Boolean(panel)||paused||Boolean(preview);
  const neutral=()=>{input.current={...NEUTRAL_MATCH_INPUT,ca:input.current.ca,cb:input.current.cb};local.current.stickX=local.current.stickY=0;};
  const io=useMemo<MatchIO>(()=>({get input(){return input.current;},local:local.current,set(v){if(!blocked.current)Object.assign(input.current,v);},press(k){if(!blocked.current)input.current[k==="a"?"ca":"cb"]++;},command(){}}),[]);
  useEffect(()=>{const media=matchMedia("(prefers-reduced-motion: reduce)"),change=()=>setReduced(media.matches);media.addEventListener("change",change);return()=>media.removeEventListener("change",change);},[]);
  useEffect(()=>{neutral();},[panel,paused,preview]);
  useEffect(()=>{
    let last=performance.now(),acc=0;
    const timer=window.setInterval(()=>{const now=performance.now(),dt=Math.min(100,now-last);last=now;
      if(document.hidden||blocked.current){acc=0;at.current=now;return;}
      acc+=dt;while(acc>=50){prev.current=structuredClone(current.current);stepProberaum(current.current,input.current);acc-=50;at.current=now;}
      setSnapshot(structuredClone(current.current));
    },50);
    const hide=()=>{neutral();acc=0;last=performance.now();};document.addEventListener("visibilitychange",hide);
    return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",hide);};
  },[]);
  const frame=():MatchWorldFrame=>({prev:prev.current,cur:current.current,alpha:blocked.current||reduced?1:Math.min(1,(performance.now()-at.current)/50),viewer:"practice",reduced,names:{practice:"Du",partner:"Übungsfigur"},characters:{practice:character,partner:"rig_amara"},local:local.current,input:input.current,t:performance.now(),simTime:current.current.time+(blocked.current?0:Math.min(50,performance.now()-at.current))});
  const read=useRef(frame);read.current=frame;
  useEffect(()=>{
    if(mode==="flat")return;
    let cancelled=false,world:MatchWorld|undefined;
    const fail=()=>{if(!cancelled)setMode("flat");};
    void Promise.all([parcoursClient.world!(),preloadFigures([character,"rig_amara"])]).then(([factory])=>{
      if(cancelled||!host.current)return;
      try{world=factory(host.current,()=>read.current(),fail);setMode("ready");}catch{fail();}
    }).catch(fail);
    return()=>{cancelled=true;world?.dispose();};
  },[character,generation,mode==="flat"]);
  useEffect(()=>{
    if(mode!=="flat"||!canvas.current)return;
    const element=canvas.current,ctx=element.getContext("2d")!;let request=0;
    const paint=()=>{const {width:w,height:h}=element.getBoundingClientRect();if(element.width!==w||element.height!==h){element.width=w;element.height=h;}parcoursClient.render(ctx,{...read.current(),w,h});request=requestAnimationFrame(paint);};paint();
    return()=>cancelAnimationFrame(request);
  },[mode]);
  function travel(index:number){neutral();input.current={...NEUTRAL_MATCH_INPUT};delete local.current.camYaw;local.current.camTurn=0;local.current.practiceTravel=(local.current.practiceTravel??0)+1;visitStation(current.current,index);prev.current=structuredClone(current.current);at.current=performance.now();setSnapshot(structuredClone(current.current));setPanel(undefined);setPreview("");delete local.current.practiceLoop;}
  function reset(){neutral();input.current={...NEUTRAL_MATCH_INPUT};current.current=createProberaum();prev.current=current.current;setSnapshot(current.current);setPreview("");delete local.current.practiceLoop;setGeneration(n=>n+1);setPanel(undefined);}
  const racer=snapshot.game.racers.practice,station=PRACTICE_STATIONS[racer.checkpoint],Controls=parcoursClient.Controls;
  const pose=racer.respawnAt?"Zurück zur Station":racer.hang?"An der Kante":racer.grab?"Figur festgehalten":racer.duck?"Geduckt":({climb:"Hochziehen",run:"Am Boden",air:"In der Luft",dive:"Hechten",prone:"Am Boden liegend",stun:"Getroffen",done:"Im Ziel",out:"Ausgeschieden",hang:"An der Kante"})[racer.pose];
  return <main className="practice-world iw-menu" data-pose={racer.pose} data-position={JSON.stringify([racer.x,racer.y,racer.z])} data-time={snapshot.time}>
    <div className="practice-scene" ref={host} role="img" aria-label="3D-Proberaum" hidden={mode==="flat"}/>
    {mode==="flat"&&<canvas className="practice-scene" ref={canvas} aria-label="2D-Proberaum"/>}
    <header className="practice-header"><div><small>FREI SPIELEN</small><h1>Die Übungsinsel</h1></div><button onClick={()=>setPanel("tools")} aria-label="Proberaum-Werkzeuge">☰</button><button onClick={onExit} aria-label="Proberaum verlassen">×</button></header>
    <section className="practice-guidance"><button onClick={()=>setPanel("stations")} aria-label="Stationen öffnen">{station.name} <span>⌄</span></button><p>{station.hint}</p></section>
    <div className="practice-status" role="status">{preview?`Animation: ${preview}`:pose}{mode==="flat"?" · 2D-Ansicht":""}</div>
    <div className="practice-tools"><button onClick={()=>travel(racer.checkpoint)}>Zum Stationsstart</button><button aria-pressed={paused} onClick={()=>setPaused(p=>!p)}>{paused?"Weiter":"Pause"}</button>{preview&&<button onClick={()=>{setPreview("");delete local.current.practiceLoop;}}>Animation beenden</button>}</div>
    <div className="match-controls"><Controls key={generation+"/"+racer.checkpoint+"/"+Boolean(panel)+"/"+paused+"/"+preview} io={io} view={snapshot} viewer="practice" active={!blocked.current} world={mode==="ready"}/></div>
    {mode==="loading"&&<div className="practice-loading" role="status">Deine Übungsinsel wird aufgebaut …</div>}
    {panel&&<PartyPanel title={panel==="stations"?"Stationen":"Proberaum-Werkzeuge"} onClose={()=>setPanel(undefined)}>
      {panel==="stations"?<div className="practice-stations">{PRACTICE_STATIONS.map((s,i)=><button key={s.name} onClick={()=>travel(i)}><strong>{s.name}</strong><small>{s.hint}</small></button>)}</div>:<>
        <label className="practice-character">Deine Figur<select value={character} onChange={e=>setCharacter(e.target.value as CharacterId)}>{RIGGED_CHARACTERS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <h3>Animationen ansehen</h3><p>Vorschau ohne Bewegung. Zum Testen der Physik die Aktionstasten benutzen.</p>
        {mode==="flat"?<p>Die Animationsvorschau benötigt 3D.</p>:<div className="practice-animation-list">{PRACTICE_LOOPS.map((a,i)=><button key={a.clip} onClick={()=>{local.current.practiceLoop=i;setPreview(a.name);setPanel(undefined);}}>{a.name}</button>)}{PRACTICE_SHOTS.map((a,i)=><button key={a.clip} onClick={()=>{local.current.practiceLoop=0;local.current.practiceShot=i;local.current.practiceShotSeq=(local.current.practiceShotSeq??0)+1;setPreview(a.name);setPanel(undefined);}}>{a.name}</button>)}</div>}
        <details><summary>Messwerte</summary><p>{Math.hypot(racer.vx,racer.vz).toFixed(1)} m/s · Höhe {racer.y.toFixed(2)} m · {racer.falls} Stürze</p><p>Stick: laufen · freie Fläche ziehen: Kamera drehen. Festhalten und Ducken gedrückt halten.</p></details>
        <button className="button button--secondary" onClick={reset}>Raum zurücksetzen</button>
      </>}
    </PartyPanel>}
  </main>;
}
