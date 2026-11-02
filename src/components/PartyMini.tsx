import { useEffect, useRef, useState } from "react";
import { applyPartyAction, COLORS, createPartyPractice, MINIS, publicParty, SYMBOLS, tickParty, type MiniId, type PartyAction, type PartyGame } from "../../shared/party";
import { MINI_LOOK, Shell, Treasure } from "./PartyArt";

function useMarkerClock(now:number,enabled:boolean) {
  const [smooth,setSmooth]=useState(now),offset=useRef(0);
  offset.current=now-Date.now();
  useEffect(()=>{if(!enabled)return;let frame=0;const update=()=>{setSmooth(Date.now()+offset.current);frame=requestAnimationFrame(update);};frame=requestAnimationFrame(update);return()=>cancelAnimationFrame(frame);},[enabled]);
  return enabled?smooth:now;
}

export function PartyMini({game,id,now,send,busy=false}:{game:PartyGame;id:string;now:number;send:(action:PartyAction)=>void;busy?:boolean}) {
  const m=game.mini!,r=m.runs[id],meta=MINIS[m.id],look=MINI_LOOK[m.id],elapsed=now-m.startAt;
  const active=game.phase==="mini-play"&&elapsed>=0&&!r.done&&now<game.deadline&&!game.pausedAt;
  const timingStopped=m.id==="timing"&&Math.floor(Math.max(0,elapsed)/2400)<r.cursor;
  const markerNow=useMarkerClock(now,m.id==="timing"&&active&&!timingStopped),markerElapsed=timingStopped?r.lastInput-m.startAt:markerNow-m.startAt;
  const [trailChoices,setTrailChoices]=useState<Record<number,number>>({});
  useEffect(()=>{setTrailChoices({});},[m.startAt,id]);
  const [feedback,setFeedback]=useState({text:"",good:true,key:0});
  const previous=useRef({start:m.startAt,id,score:r.score,cursor:r.cursor,attempts:r.attempts,last:r.lastInput});
  useEffect(()=>{
    const before=previous.current;
    if(before.start===m.startAt&&before.id===id&&r.lastInput>before.last){
      const gained=r.score-before.score,wrong=(m.id==="colors"||m.id==="trail")&&r.cursor>before.cursor&&!gained;
      const mismatch=m.id==="memory"&&r.attempts>before.attempts&&!gained;
      const trap=m.id==="risk"&&r.feedback.includes("Falle");
      const text=wrong?"Knapp daneben!":mismatch?"Kein Paar. Merke dir die beiden!":gained>0?`+${gained}${m.id==="memory"?" Paar":m.id==="timing"?" Punkte":""}`:trap?"Falle! Beute verloren.":m.id==="risk"?r.feedback:"";
      if(text)setFeedback({text,good:!wrong&&!mismatch&&!trap,key:r.lastInput});
    }
    previous.current={start:m.startAt,id,score:r.score,cursor:r.cursor,attempts:r.attempts,last:r.lastInput};
  },[m.startAt,id,r.lastInput,r.score,r.cursor,r.attempts,r.feedback,m.id]);
  const input=(value:number|string)=>{if(active&&!busy){if(m.id==="trail")setTrailChoices(previous=>({...previous,[r.cursor]:Number(value)}));send({type:"input",value});}};
  const disabled=!active||busy,seconds=Math.max(0,Math.ceil((game.deadline-now)/1000));
  const round=Math.floor(Math.max(0,elapsed)/2000),caught=r.cursor>round;
  const progress=m.id==="targets"?Math.min(12,round+1):m.id==="colors"?r.cursor:m.id==="memory"?r.score:m.id==="timing"?Math.min(5,Math.floor(Math.max(0,elapsed)/2400)):m.id==="trail"?r.cursor:r.attempts;
  const total=["targets","colors"].includes(m.id)?12:m.id==="memory"||m.id==="trail"?6:5;
  return <section className={`party-minigame party-scene--${m.id} ${seconds<=5&&active?"is-urgent":""}`} aria-label={meta.name}>
    <div className="party-mini-heading"><div><h2>{meta.name}</h2><p>{look.hint}</p></div><span className="party-mini-timer" role="timer" aria-label="Verbleibende Zeit">{elapsed<0?"Bereit":`${seconds} s`}</span></div>
    <div className="party-time-track" role="progressbar" aria-label="Verbleibende Spielzeit" aria-valuemin={0} aria-valuemax={meta.seconds} aria-valuenow={Math.max(0,Math.min(meta.seconds,seconds))}><i style={{width:`${Math.max(0,Math.min(1,(game.deadline-now)/(meta.seconds*1000)))*100}%`}}/></div>
    <div className="party-arena">
      {elapsed<0&&<div className="party-countdown" role="status"><span key={Math.ceil(-elapsed/1000)}>{Math.ceil(-elapsed/1000)}</span><strong>Gleich geht’s los!</strong></div>}
      {r.done&&<div className="party-attempt-done" role="status"><b>✓</b><h3>Geschafft!</h3><strong>{r.score} Punkte</strong><p>Dein Ergebnis steht. Die anderen spielen noch.</p></div>}
      {m.id==="targets"&&<div className="party-target-grid">{Array.from({length:9},(_,i)=>{const target=active&&m.targets[round]===i;return <button key={i} aria-label={`Schatzfeld ${i+1}`} className={`${target&&!caught?"is-target":""} ${target&&caught?"is-caught":""}`} disabled={disabled||(target&&caught)} onClick={()=>input(i)}><span>{target?(caught?"✓":"◆"):""}</span><i/></button>;})}</div>}
      {m.id==="colors"&&<><div className="party-color-prompt"><small>Schriftfarbe gesucht</small><div key={r.cursor} className={`party-color-word party-text-${m.prompts[r.cursor]}`}>{active?COLORS[m.words[r.cursor]]??"Fertig":"Blau"}</div></div><div className="party-choice-grid party-color-choices">{COLORS.map((color,i)=><button key={color} className={`party-color-${i}`} disabled={disabled} onClick={()=>input(i)}><i/>{color}</button>)}</div></>}
      {m.id==="memory"&&<div className="party-memory-grid">{m.cards.map((value,i)=>{const matched=r.matched.includes(i),open=matched||(r.opened.includes(i)&&(r.opened.length<2||now<r.blockedUntil));return <button key={i} className={`${matched?"is-matched":""} ${open?"is-open":""}`} disabled={disabled||matched||r.opened.includes(i)&&r.opened.length<2||now<r.blockedUntil} aria-label={`Muschel ${i+1}${open?`, ${SYMBOLS[value]}`:", verdeckt"}`} onClick={()=>input(i)}><span className="party-shell-back"><Shell/></span><span className="party-shell-front">{open?SYMBOLS[value]:""}</span>{matched&&<i>✓</i>}</button>;})}</div>}
      {m.id==="timing"&&<div className="party-bridge-scene"><div className="party-bridge-bank party-bridge-bank--left"/><div className="party-bridge-bank party-bridge-bank--right"/><div className="party-timing" aria-label="Ziel ist die Mitte"><span className="party-timing-center"><b>★</b></span><span className={`party-timing-marker ${timingStopped?"is-stopped":""}`} style={{left:`${Math.max(0,markerElapsed%2400)/2400*100}%`}}>◆</span></div><p>{timingStopped?"Treffer gewertet. Gleich kommt der nächste Versuch!":"Je näher an der Mitte, desto mehr Punkte."}</p><button className="button button--primary button--wide" disabled={disabled||timingStopped} onClick={()=>input("stop")}>{active&&timingStopped?"Nächster Versuch …":"Jetzt stoppen"}</button></div>}
      {m.id==="trail"&&<><div className="party-trail-status">{elapsed<0?"Die Spur erscheint gleich":elapsed<6000?`Merken! Noch ${Math.ceil((6000-elapsed)/1000)} Sekunden`:"Jetzt bist du dran"}</div><div className="party-trail" aria-label="Merkfolge">{Array.from({length:6},(_,i)=><span key={i} className={elapsed>=6000&&i<r.cursor?"is-entered":""}>{elapsed>=0&&elapsed<6000?SYMBOLS[m.trail[i]]:i<r.cursor?SYMBOLS[trailChoices[i]]??"•":i+1}</span>)}</div><div className="party-choice-grid party-symbol-choices">{SYMBOLS.map((symbol,i)=><button key={symbol} aria-label={symbol} disabled={disabled||elapsed<6000} onClick={()=>input(i)}>{symbol}</button>)}</div></>}
      {m.id==="risk"&&<><Treasure key={r.lastInput} open={r.loot>0} trap={r.feedback.includes("Falle")}/><div className="party-risk"><span>Im sicheren Hafen<strong>{r.bank}</strong></span><span>Ungesicherte Beute<strong key={r.loot}>{r.loot}</strong></span></div><div className="party-choice-grid party-risk-choices"><button aria-label="Kiste öffnen" disabled={disabled} onClick={()=>input("open")}>Kiste öffnen<small>Risiko: 1 von 4 ist eine Falle</small></button><button aria-label="Beute sichern" disabled={disabled} onClick={()=>input("bank")}>Beute sichern<small>{r.loot>0?`${r.loot} Schätze behalten`:"Versuch abschließen"}</small></button></div></>}
      {(m.id==="words"||m.id==="bridge")&&<div className="party-analog-scene"><span>{look.icon}</span><h3>{look.action}</h3><p>{meta.instruction}</p><strong>Spielt gemeinsam außerhalb des Bildschirms.</strong></div>}
    </div>
    {!['words','bridge'].includes(m.id)&&<>
      <div className="party-mini-score"><span><strong key={r.score}>{r.score}</strong>{m.id==="memory"?r.score===1?"Paar":"Paare":"Punkte"}</span><div className="party-mini-progress" aria-label={`Fortschritt: ${progress} von ${total}`}>{Array.from({length:total},(_,i)=><i key={i} className={i<progress?"is-complete":""}/>)}</div><span>{m.id==="memory"?`${r.attempts} ${r.attempts===1?"Versuch":"Versuche"}`:`${Math.min(total,progress+1)} / ${total}`}</span></div>
      <p className={`party-mini-feedback ${feedback.good?"is-good":"is-miss"}`} key={feedback.key} role="status">{feedback.text||(elapsed<0?"Mach dich bereit.":look.action)}</p>
    </>}
  </section>;
}

export function PartyPractice({miniId,onClose}:{miniId:MiniId;onClose:()=>void}) {
  const [game,setGame]=useState(()=>createPartyPractice(miniId)),[now,setNow]=useState(Date.now()),[error,setError]=useState("");
  const dialog=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.focus();const timer=setInterval(()=>{const time=Date.now();setNow(time);setGame(g=>tickParty(g,time));},100);return()=>{clearInterval(timer);previous?.focus();};},[]);
  const send=(action:PartyAction)=>{try{setGame(applyPartyAction(game,"practice",action,Date.now()));setError("");}catch(e){setError(e instanceof Error?e.message:"Bitte erneut versuchen.");}};
  return <div className="party-overlay"><div className="party-practice" role="dialog" aria-modal="true" aria-label={`Übung: ${MINIS[miniId].name}`} tabIndex={-1} ref={dialog} onKeyDown={e=>{
    if(e.key==="Escape"){e.stopPropagation();close.current();}
    if(e.key==="Tab"){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first.focus();}}
  }}><p className="party-practice-label">Übung · zählt nicht zur Wertung</p><PartyMini game={publicParty(game,"practice",now)} id="practice" now={now} send={send}/>{error&&<p role="alert">{error}</p>}{game.mini?.runs.practice.done&&<button className="button button--primary button--wide" onClick={()=>{setGame(createPartyPractice(miniId));setError("");}}>Noch einmal üben</button>}<button className="button button--secondary button--wide" onClick={onClose}>Zurück zur Minispielrunde</button></div></div>;
}
