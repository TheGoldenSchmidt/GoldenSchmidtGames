import type {CharacterId} from "../../shared/characters";
import { PARTY_DEFAULTS, type PartyOptions } from "../../shared/party";
import { PartyTraining } from "./PartyTraining";
import { ClassicToggle } from "./MinigameSettings";

export function PartySettings({value=PARTY_DEFAULTS,disabled=false,rollItUp=false,onChange,characterId}:{rollItUp?:boolean;characterId?:CharacterId;value?:PartyOptions;disabled?:boolean;onChange:(value:PartyOptions)=>void}) {
  return <><fieldset className="party-settings" disabled={disabled}><legend>{rollItUp?"Roll It Up!":"Deine Inselparty"}</legend>
    {!rollItUp&&<label>Runden<select value={value.rounds} onChange={e=>onChange({...value,rounds:Number(e.target.value)})}>{Array.from({length:11},(_,i)=>i+5).map(n=><option key={n}>{n}</option>)}</select></label>}
    <label>Tempo<select value={value.tempo} onChange={e=>onChange({...value,tempo:e.target.value as PartyOptions['tempo']})}><option value="slow">Gemütlich</option><option value="normal">Normal</option><option value="fast">Schnell</option></select></label>
    <ClassicToggle value={value.classic??true} onChange={classic=>onChange({...value,classic})}/>
    <p>Alle spielen online mit eigener Figur und eigenem Gerät. Die Minispiele laufen gleichzeitig. {rollItUp?"Kaufe Grinder, Pape, Filter und drei Weedbuds. Wer zuerst die Bank auf dem Hügel erreicht, gewinnt.":"8 Runden dauern ungefähr 30 Minuten."}</p>
  </fieldset><PartyTraining characterId={characterId}/></>;
}
