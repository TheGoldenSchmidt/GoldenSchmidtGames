import {useEffect,useRef,useState} from 'react';
import {type PartyGame} from '../../shared/party';
import {ARENA_META,isArenaId} from '../../shared/partyArena';

export interface MiniReward {id:number;coins:number;total:number}

export function PartyTrophyGoal({coins,field,reward}:{coins:number;field:number;reward?:MiniReward}) {
  const [highlight,setHighlight]=useState(Boolean(reward&&reward.coins>0));
  useEffect(()=>{if(!reward||reward.coins<=0)return;setHighlight(true);const timer=setTimeout(()=>setHighlight(false),3000);return()=>clearTimeout(timer);},[reward?.id]);
  return <aside className={`party-trophy-goal ${highlight?'is-rewarded':''}`} aria-label="Dein Trophäenziel">
    <div><strong>{coins>=20?'Bereit für eine Trophäe!':`Noch ${20-coins} Münzen bis zum Trophäenkauf`}</strong><span>{coins} / 20 Münzen</span></div>
    <meter min={0} max={20} value={Math.min(20,coins)} aria-label="Münzen für den nächsten Trophäenkauf"/>
    <small>Kauf am Trophäenstand auf Feld {field} · 20 Münzen</small>
    {highlight&&reward&&<p role="status">+{reward.coins} Münzen aus dem Minispiel · jetzt {reward.total}</p>}
  </aside>;
}

export function PartyCoinReward({coins,total}:{coins:number;total:number}) {
  return <p className="party-coin-reward" role="status"><strong>+{coins} Münzen</strong><span>Dein Münzbeutel: jetzt {total}</span></p>;
}

export function PartyPracticeGoals({game}:{game:PartyGame}) {
  const mini=game.mini!;
  if(!isArenaId(mini.id)||!mini.arena)return null;
  return <ArenaPracticeGoals key={mini.startAt} game={game}/>;
}

function ArenaPracticeGoals({game}:{game:PartyGame}) {
  const mini=game.mini!,actor=mini.arena!.actors.find(a=>a.id==='practice')!;
  const meta=ARENA_META[mini.arena!.id],origin=useRef({x:actor.x,z:actor.z});
  const [done,setDone]=useState({move:false,jump:false,punch:false});
  useEffect(()=>{
    const move=Math.hypot(actor.x-origin.current.x,actor.z-origin.current.z)>.35;
    const jump=actor.jumpAt>=0,punch=actor.punchAt>=0;
    setDone(previous=>{
      const next={move:previous.move||move,jump:previous.jump||jump,punch:previous.punch||punch};
      return next.move===previous.move&&next.jump===previous.jump&&next.punch===previous.punch?previous:next;
    });
  },[actor.x,actor.z,actor.jumpAt,actor.punchAt]);
  const goals=[{label:'Bewege deine Figur',done:done.move},...(meta.jump?[{label:'Springe einmal',done:done.jump}]:[]),...(meta.punch?[{label:'Schlage einmal',done:done.punch}]:[])];
  const complete=goals.every(goal=>goal.done);
  return <section className="party-practice-goals" aria-label="Lernziele der Übung">
    <ul>{goals.map(goal=><li key={goal.label} aria-label={`${goal.label}: ${goal.done?'geschafft':'offen'}`} className={goal.done?'is-complete':''}><span aria-hidden="true">{goal.done?'✓':'○'}</span> {goal.label}</li>)}</ul>
    <p role="status">{complete?'Lernziele geschafft! Du kannst weiter üben.':'Probiere die Steuerung aus – ohne zusätzliche Spielpunkte.'}</p>
  </section>;
}
