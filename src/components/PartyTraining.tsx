import type {CharacterId} from "../../shared/characters";
import { useState } from "react";
import { ACTION_MINI_IDS, ARENA_META, type ArenaId } from "../../shared/partyArena";
import { PartyPractice } from "./PartyMini";

export function PartyTraining({active=false,characterId}:{active?:boolean;characterId?:CharacterId}) {
  const [practice,setPractice]=useState<ArenaId>();
  return <><details className="party-training"><summary>Die 3D-Minispiele ausprobieren</summary><p>{active?"Übe ohne Wertung. Die gemeinsame Partie läuft währenddessen weiter.":"Übe die Steuerung ohne Wertung, bevor die gemeinsame Partie startet."}</p><div>{ACTION_MINI_IDS.map(id=><button key={id} onClick={()=>setPractice(id)}><strong>{ARENA_META[id].name}</strong><small>{ARENA_META[id].tilt?"Balance mit Neigung oder Stick":ARENA_META[id].punch?"Laufen, springen, schlagen":"Laufen und springen"}</small></button>)}</div></details>{practice&&<PartyPractice key={practice} miniId={practice} characterId={characterId} onClose={()=>setPractice(undefined)}/>}</>;
}
