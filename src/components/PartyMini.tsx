import {PartyPracticeGoals} from "./PartyProgress";
import type {CharacterId} from "../../shared/characters";
import { useEffect, useRef, useState } from "react";
import { applyPartyAction, applyPartyControl, createPartyPractice, MINIS, publicParty, tickParty, type MiniId, type PartyAction, type PartyGame, type PartyUnityReport } from "../../shared/party";
import type { ArenaInput } from "../../shared/partyArena";
import { PartyArena } from "./PartyArena";
import { MatchStage, type MatchUi } from "../matches/MatchStage";
import type { MatchInput } from "../../shared/matches/types";
import { PartyBotDriver } from "../../shared/partyBots";
import { useBackStep } from "../lib/backNavigation";
import type { MiniLook } from "../../shared/minigameLooks";

interface MiniProps {game:PartyGame;id:string;now:number;send:(action:PartyAction)=>void;control?:(input:ArenaInput|MatchInput,reliable?:boolean)=>void;busy?:boolean;matchUi?:MatchUi;unityReport?:(report:PartyUnityReport)=>void}
export function PartyMini(props:MiniProps) {
  if(props.game.mini?.match)return <MatchStage game={props.game} id={props.id} now={props.now} control={props.control??(()=>{})} busy={props.busy} unityReport={props.unityReport} {...props.matchUi}/>;
  return props.game.mini?.arena?<PartyArena game={props.game} id={props.id} now={props.now} control={props.control??(()=>{})} busy={props.busy} {...props.matchUi}/>:null;
}
export function PartyPractice({miniId,onClose,characterId,look}:{miniId:MiniId;onClose:()=>void;characterId?:CharacterId;look?:MiniLook}) {
  const [game,setGame]=useState(()=>createPartyPractice(miniId,Date.now(),characterId,look)),[now,setNow]=useState(Date.now()),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  const dialog=useRef<HTMLDivElement>(null),close=useRef(onClose),controlSeq=useRef(0),bots=useRef(new PartyBotDriver());close.current=onClose;
  useBackStep(onClose);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow="hidden";document.body.dataset.partyPractice="true";dialog.current?.focus();const timer=setInterval(()=>{const time=Date.now();setNow(time);setGame(g=>tickParty(g.mini?.match?bots.current.step(g,time):g,time));},50);return()=>{clearInterval(timer);document.body.style.overflow=overflow;delete document.body.dataset.partyPractice;previous?.focus();};},[]);
  const control=(input:ArenaInput|MatchInput)=>setGame(g=>{try{return applyPartyControl(g,"practice",input,++controlSeq.current,Date.now());}catch{return g;}});
  const send=(action:PartyAction)=>{try{setGame(applyPartyAction(game,"practice",action,Date.now()));setError("");}catch(e){setError(e instanceof Error?e.message:"Bitte erneut versuchen.");}};
  const restart=()=>{bots.current=new PartyBotDriver();controlSeq.current=0;setGame(createPartyPractice(miniId,Date.now(),characterId,look));setAttempt(n=>n+1);setError("");};
  return <div className="party-overlay"><div className="party-practice" role="dialog" aria-modal="true" aria-label={`Übung: ${MINIS[miniId].name}`} tabIndex={-1} ref={dialog} onKeyDown={e=>{
    if(e.key==="Escape"){e.stopPropagation();close.current();}
    if(e.key==="Tab"){const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.current)){e.preventDefault();first.focus();}}
  }}><p className="party-practice-label">Übung · zählt nicht zur Wertung</p><PartyPracticeGoals game={game}/><PartyMini key={attempt} game={publicParty(game,"practice",now)} id="practice" now={now} send={send} control={control} matchUi={{note:"Übung",menu:<><p>Übung zählt nicht zur Wertung.</p><button type="button" onClick={restart}>Neu starten</button><button type="button" className="is-quiet" onClick={onClose}>Übung schließen</button></>,doneActions:<><button type="button" onClick={restart}>Noch einmal üben</button><button type="button" className="is-quiet" onClick={onClose}>Übung schließen</button></>}}/>{error&&<p role="alert">{error}</p>}{game.mini?.runs.practice.done&&<button className="button button--primary button--wide" onClick={restart}>Noch einmal üben</button>}<button className="button button--secondary button--wide" data-menu-direction="back" onClick={onClose}>Übung schließen</button></div></div>;
}
