import {challengeCue,CHALLENGE_HINTS} from "../../shared/arenaChallenges";
import {preloadFigures} from "../figures/catalog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ARENA_META, checkedInput, NEUTRAL_INPUT, type ArenaInput } from "../../shared/partyArena";
import type { PartyGame } from "../../shared/party";
import type { ArenaFrame } from "../three/arenaWorld";
import { usePartyTilt } from "./usePartyTilt";

/** `menu`/`doneActions`/`note` as for the match games: the arena fills the screen, so these live in its floating HUD. */
export function PartyArena({game,id,now,control,busy=false,menu,doneActions,note}:{game:PartyGame;id:string;now:number;control:(input:ArenaInput,reliable?:boolean)=>void;busy?:boolean;menu?:ReactNode;doneActions?:ReactNode;note?:string}) {
  const arena=game.mini!.arena!,meta=ARENA_META[arena.id],own=arena.actors.find(a=>a.id===id),run=game.mini!.runs[id];
  const active=game.phase==="mini-play"&&now>=game.mini!.startAt&&now<game.deadline&&!busy&&!run.done&&!own?.finished&&!game.pausedAt;
  const [error,setError]=useState(false),[ready,setReady]=useState(false),[axes,setAxes]=useState({...NEUTRAL_INPUT});
  const host=useRef<HTMLDivElement>(null),manual=useRef({...NEUTRAL_INPUT}),keys=useRef(new Set<string>()),pulse=useRef({jump:0,punch:0}),pointer=useRef<number|undefined>(undefined);
  const sensor=usePartyTilt(),activeRef=useRef(active),controlRef=useRef(control);activeRef.current=active;controlRef.current=control;
  const readInput=()=>{
    const keyboard={x:Number(keys.current.has("ArrowRight")||keys.current.has("d"))-Number(keys.current.has("ArrowLeft")||keys.current.has("a")),z:Number(keys.current.has("ArrowDown")||keys.current.has("s"))-Number(keys.current.has("ArrowUp")||keys.current.has("w"))};
    const source=Math.hypot(manual.current.x,manual.current.z)>.07?manual.current:Math.hypot(keyboard.x,keyboard.z)>0?keyboard:sensor.axes.current;
    return checkedInput({x:source.x,z:source.z,jump:meta.jump&&(manual.current.jump||keys.current.has(" ")||Date.now()<pulse.current.jump),punch:meta.punch&&(manual.current.punch||keys.current.has("e")||keys.current.has("j")||Date.now()<pulse.current.punch)});
  };
  const reader=useRef(readInput);reader.current=readInput;
  const reduced=typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame=useRef<ArenaFrame>({arena,viewer:id,elapsed:0,input:axes,reduce:reduced,names:{},paused:!active});
  frame.current={arena,viewer:id,elapsed:Math.max(0,now-game.mini!.startAt),input:active?readInput():NEUTRAL_INPUT,reduce:reduced,names:Object.fromEntries(game.players.map(p=>[p.id,p.name])),paused:!active};
  useEffect(()=>{
    if(error)return;let cancelled=false,world:{dispose:()=>void}|undefined;
    void Promise.all([import("../three/arenaWorld"),preloadFigures(arena.actors.map(a=>a.characterId))]).then(([{createArenaWorld}])=>{if(cancelled||!host.current)return;try{world=createArenaWorld(host.current,()=>frame.current,()=>setError(true));setReady(true);}catch{setError(true);}}).catch(()=>setError(true));
    return()=>{cancelled=true;world?.dispose();};
  },[arena.id,game.mini!.startAt,id,error]);
  useEffect(()=>{
    const reset=()=>{keys.current.clear();manual.current={...NEUTRAL_INPUT};pulse.current={jump:0,punch:0};pointer.current=undefined;sensor.axes.current={x:0,z:0};setAxes({...NEUTRAL_INPUT});if(activeRef.current)controlRef.current({...NEUTRAL_INPUT},true);};
    const down=(e:KeyboardEvent)=>{if(!activeRef.current||(e.target instanceof HTMLElement&&(e.target.matches("input,select,textarea")||e.key===" "&&Boolean(e.target.closest("button")))))return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(!["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","e","j"].includes(key))return;e.preventDefault();keys.current.add(key);if(!e.repeat&&key===" ")pulse.current.jump=Date.now()+110;if(!e.repeat&&["e","j"].includes(key))pulse.current.punch=Date.now()+110;controlRef.current(reader.current());};
    const up=(e:KeyboardEvent)=>{keys.current.delete(e.key.length===1?e.key.toLowerCase():e.key);};
    const hidden=()=>{if(document.hidden)reset();};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",reset);document.addEventListener("visibilitychange",hidden);
    const timer=setInterval(()=>{const value=activeRef.current?reader.current():{...NEUTRAL_INPUT};setAxes(value);if(activeRef.current)controlRef.current(value);},66);
    return()=>{reset();clearInterval(timer);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",reset);document.removeEventListener("visibilitychange",hidden);};
  },[arena.id,id,game.mini!.startAt]);
  useEffect(()=>{if(!active){manual.current={...NEUTRAL_INPUT};keys.current.clear();pulse.current={jump:0,punch:0};}},[active]);
  const stick=(event:React.PointerEvent<HTMLDivElement>)=>{if(event.pointerId!==pointer.current)return;const box=event.currentTarget.getBoundingClientRect(),radius=box.width/2-17,dx=(event.clientX-box.left-box.width/2)/radius,dz=(event.clientY-box.top-box.height/2)/radius,length=Math.max(1,Math.hypot(dx,dz));manual.current.x=dx/length;manual.current.z=dz/length;setAxes(reader.current());if(active)controlRef.current(reader.current());};
  const releaseStick=()=>{pointer.current=undefined;manual.current.x=0;manual.current.z=0;setAxes(reader.current());if(active)controlRef.current(reader.current());};
  const action=(kind:"jump"|"punch",pressed:boolean)=>{manual.current[kind]=pressed;if(pressed)pulse.current[kind]=Date.now()+110;if(active)controlRef.current(reader.current());};
  const virtualAction=(kind:"jump"|"punch")=>{pulse.current[kind]=Date.now()+110;if(active)controlRef.current(reader.current());};
  const seconds=Math.max(0,Math.ceil((game.deadline-now)/1000)),count=Math.ceil((game.mini!.startAt-now)/1000);
  return <section className={`party-action-game party-action-game--${arena.id}`} aria-label={meta.name}>
    <div className="party-action-heading"><div><h2>{meta.name}{note&&<small>{note}</small>}</h2><p>{CHALLENGE_HINTS[arena.id]??(meta.tilt?"Neigen oder mit dem Stick lenken":meta.punch?"Laufen, springen und Kisten aufschlagen":"Lenke deine Figur und sammle Punkte")}</p></div><span role="timer">{count>0?"Bereit":`${seconds} s`}</span><strong><b>{own?.score??run.score}</b> Punkte</strong>{menu&&<details className="party-arena-menu"><summary aria-label="Minispielmenü">⋯</summary><div className="party-arena-menu__panel">{menu}</div></details>}</div>
    <div className="party-arena-status"><p role="status">{challengeCue(arena)}</p><span aria-label="Verbleibende Stürze">{own?.eliminated?"Ausgeschieden":`${Math.max(0,2-(own?.falls??0))} Stürze übrig`}</span></div>
    <div className="party-action-stage">
      <div className="party-action-world" ref={host} role="img" aria-label={`3D-Spielarena: ${meta.name}`}/>
      {!ready&&!error&&<div className="party-world-loading" role="status">Deine Arena entsteht …</div>}
      {error&&<div className="party-3d-error" role="alert"><h3>3D konnte nicht gestartet werden</h3><p>Prüfe die Grafikbeschleunigung deines Browsers oder öffne den Spiel-Link in einem aktuellen Browser. Dein Raum bleibt erhalten.</p><button className="button button--secondary" onClick={()=>location.reload()}>Ansicht neu laden</button></div>}
      {count>0&&<div className="party-action-countdown" role="status"><b key={count}>{count}</b><span>Mach dich bereit!</span></div>}
      {run.done&&<div className={`party-action-countdown ${own?.eliminated?"party-spectator-notice":""}`}><div className="party-arena-done-note" role="status"><b>{own?.eliminated?"◉":"✓"}</b><h3>{own?.eliminated?"Du schaust jetzt zu":own?.finished&&own.z<=-21?"Ziel erreicht!":"Dein Ergebnis steht!"}</h3><span>{run.score} Punkte bleiben · Die anderen spielen noch.</span></div>{doneActions&&<div className="party-arena-done-actions">{doneActions}</div>}</div>}
      {own&&arena.time<own.respawnAt&&<div className="party-respawn" role="status">Platsch! Gleich bist du zurück.</div>}
      {!run.done&&<div className="party-action-feedback" role="status" key={own?.feedback}>{own?.feedback??"Mach dich bereit!"}</div>}
      <div className="party-game-controls" aria-label="Figur steuern">
        <div className="party-joystick" role="group" aria-label="Bewegungsstick" onPointerDown={e=>{if(!active||pointer.current!==undefined)return;pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);stick(e);}} onPointerMove={stick} onPointerUp={releaseStick} onPointerCancel={releaseStick} onLostPointerCapture={releaseStick}><span aria-hidden="true">✥</span><i style={{transform:`translate(${axes.x*35}px,${axes.z*35}px)`}}/></div>
        <div className="party-action-buttons">{meta.jump&&<button className="party-jump" aria-label="Springen" disabled={!active} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);action("jump",true);}} onPointerUp={()=>action("jump",false)} onPointerCancel={()=>action("jump",false)} onLostPointerCapture={()=>action("jump",false)} onClick={e=>{if(e.detail===0)virtualAction("jump");}}><b>↑</b><span>Springen</span></button>}{meta.punch&&<button className="party-punch" aria-label="Schlagen" disabled={!active} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);action("punch",true);}} onPointerUp={()=>action("punch",false)} onPointerCancel={()=>action("punch",false)} onLostPointerCapture={()=>action("punch",false)} onClick={e=>{if(e.detail===0)virtualAction("punch");}}><b>✦</b><span>Schlagen</span></button>}</div>
      </div>
    </div>
    <p className="party-key-hint">WASD / Pfeile{meta.jump?" · Leertaste: springen":""}{meta.punch?" · E oder J: schlagen":""}</p>
    {meta.tilt&&<div className="party-tilt-panel"><p role="status">{sensor.message}</p>{sensor.status==="active"?<><button className="button button--secondary" onClick={sensor.calibrate}>Gerade halten & kalibrieren</button><button className="button button--ghost" onClick={sensor.stop}>Neigung ausschalten</button></>:<button className="button button--secondary" disabled={sensor.status==="asking"||sensor.status==="waiting"} onClick={()=>{void sensor.enable();}}>Neigung aktivieren</button>}</div>}
    <output className="party-position-announcements" aria-label="Eigene Figur">{own?`${own.x.toFixed(2)}, ${own.z.toFixed(2)}; Sprunghöhe ${own.y.toFixed(2)}`:""}</output>
  </section>;
}
