import { useEffect, useState } from "react";
import { applyPartyAction, COLORS, createPartyPractice, MINIS, publicParty, SYMBOLS, tickParty, type MiniId, type PartyAction, type PartyGame } from "../../shared/party";

export function PartyMini({game,id,now,send,busy=false}:{game:PartyGame;id:string;now:number;send:(action:PartyAction)=>void;busy?:boolean}) {
  const m=game.mini!,r=m.runs[id],meta=MINIS[m.id],elapsed=now-m.startAt,active=game.phase==="mini-play"&&elapsed>=0&&!r.done&&now<game.deadline;
  const input=(value:number|string)=>send({type:"input",value});
  const disabled=!active||busy;
  return <section className="party-minigame" aria-label={meta.name}>
    <div className="party-mini-heading"><h2>{meta.name}</h2><span role="timer">{elapsed<0?`Start in ${Math.ceil(-elapsed/1000)}`:`${Math.max(0,Math.ceil((game.deadline-now)/1000))} s`}</span></div>
    <p>{meta.instruction}</p>
    {elapsed<0&&<div className="party-countdown" aria-live="polite">{Math.ceil(-elapsed/1000)}</div>}
    {r.done&&<p role="status">Dein Versuch ist beendet. Die anderen spielen noch.</p>}
    {m.id==="targets"&&<div className="party-target-grid">{Array.from({length:9},(_,i)=><button key={i} aria-label={`Schatzfeld ${i+1}`} className={active&&m.targets[Math.floor(elapsed/2000)]===i?"is-target":""} disabled={disabled} onClick={()=>input(i)}>{active&&m.targets[Math.floor(elapsed/2000)]===i?"◆":"·"}</button>)}</div>}
    {m.id==="colors"&&<><div className={`party-color-word party-text-${m.prompts[r.cursor]}`}>{active?COLORS[m.words[r.cursor]]??"Fertig":"Bereit?"}</div><div className="party-choice-grid">{COLORS.map((c,i)=><button key={c} className={`party-color-${i}`} disabled={disabled} onClick={()=>input(i)}>{c}</button>)}</div><p>Aufgabe {Math.min(12,r.cursor+1)} von 12</p></>}
    {m.id==="memory"&&<div className="party-memory-grid">{m.cards.map((value,i)=>{const open=r.matched.includes(i)||(r.opened.includes(i)&&(r.opened.length<2||now<r.blockedUntil));return <button key={i} className={r.matched.includes(i)?"is-matched":""} disabled={disabled||r.matched.includes(i)||now<r.blockedUntil} aria-label={`Muschel ${i+1}${open?`, ${SYMBOLS[value]}`:", verdeckt"}`} onClick={()=>input(i)}>{open?SYMBOLS[value]:"◒"}</button>;})}</div>}
    {m.id==="timing"&&<><div className="party-timing" aria-label="Ziel ist die Mitte"><span className="party-timing-center"/><span className="party-timing-marker" style={{left:`${Math.max(0,elapsed%2400)/2400*100}%`}}/></div><p>Versuch {Math.min(5,Math.floor(Math.max(0,elapsed)/2400)+1)} von 5</p><button className="button button--primary button--wide" disabled={disabled||Math.floor(elapsed/2400)<r.cursor} onClick={()=>input("stop")}>Jetzt stoppen</button></>}
    {m.id==="trail"&&<><div className="party-trail" aria-label="Merkfolge">{elapsed<0?"Bereit machen!":elapsed<6000?m.trail.map((v,i)=><span key={i}>{SYMBOLS[v]}</span>):`${r.cursor} / 6 gewählt`}</div><div className="party-choice-grid">{SYMBOLS.map((s,i)=><button key={s} disabled={disabled||elapsed<6000} onClick={()=>input(i)}>{s}</button>)}</div></>}
    {m.id==="risk"&&<><div className="party-risk"><span>Gesichert<strong>{r.bank}</strong></span><span>In der Kiste<strong>{r.loot}</strong></span></div><p>Versuch {Math.min(5,r.attempts+1)} von 5</p><div className="party-choice-grid"><button disabled={disabled} onClick={()=>input("open")}>Kiste öffnen</button><button disabled={disabled} onClick={()=>input("bank")}>Beute sichern</button></div></>}
    <p className="party-mini-feedback" role="status">{r.feedback||(!['words','bridge'].includes(m.id)?`${r.score} Punkte`:"Alle spielen gemeinsam außerhalb des Bildschirms.")}</p>
  </section>;
}

export function PartyPractice({miniId,onClose}:{miniId:MiniId;onClose:()=>void}) {
  const [game,setGame]=useState(()=>createPartyPractice(miniId));
  const [now,setNow]=useState(Date.now());
  const [error,setError]=useState("");
  useEffect(()=>{const timer=setInterval(()=>{const time=Date.now();setNow(time);setGame(g=>tickParty(g,time));},100);return()=>clearInterval(timer);},[]);
  const send=(a:PartyAction)=>{try{setGame(applyPartyAction(game,"practice",a,Date.now()));setError("");}catch(e){setError(e instanceof Error?e.message:"Bitte erneut versuchen.");}};
  return <div className="party-overlay"><section className="party-practice"><p>Übung · zählt nicht zur Wertung</p><PartyMini game={publicParty(game,"practice",now)} id="practice" now={now} send={send}/>{error&&<p role="alert">{error}</p>}{game.mini?.runs.practice.done&&<p>Übung beendet! {game.mini.runs.practice.score} Punkte.</p>}<button className="button button--secondary button--wide" onClick={onClose}>Zurück zur Minispielrunde</button></section></div>;
}
