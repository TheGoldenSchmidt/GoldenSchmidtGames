import type {CharacterId} from "../../shared/characters";
import { useState } from "react";
import { ACTION_MINI_IDS, ARENA_META } from "../../shared/partyArena";
import { MATCH_IDS, MATCH_MODULES } from "../../shared/matches/framework";
import type { PlayableMiniId } from "../../shared/minigameCatalog";
import { PartyPractice } from "./PartyMini";

export function PartyTraining({active=false,characterId}:{active?:boolean;characterId?:CharacterId}) {
  const [practice,setPractice]=useState<PlayableMiniId>();
  return <><details className="party-training"><summary>Minispiele ausprobieren</summary><p>{active?"Übe ohne Wertung. Die gemeinsame Partie läuft währenddessen weiter.":"Übe die Steuerung ohne Wertung, bevor die gemeinsame Partie startet."}</p><div>{MATCH_IDS.map(id=><button key={id} onClick={()=>setPractice(id)}><strong>{MATCH_MODULES[id].meta.name}</strong><small>Neu · gegen Übungsbots</small></button>)}{ACTION_MINI_IDS.map(id=><button key={id} onClick={()=>setPractice(id)}><strong>{ARENA_META[id].name}</strong><small>Klassisch · {ARENA_META[id].tilt?"Balance mit Neigung oder Stick":ARENA_META[id].punch?"Laufen, springen, schlagen":"Laufen und springen"}</small></button>)}</div></details>{practice&&<PartyPractice key={practice} miniId={practice} characterId={characterId} onClose={()=>setPractice(undefined)}/>}</>;
}
