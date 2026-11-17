import { PARTY_DEFAULTS, type PartyOptions } from "../../shared/party";
import { ClassicToggle } from "./MinigameSettings";

export function PartySettings({value=PARTY_DEFAULTS,disabled=false,rollItUp=false,onChange}:{rollItUp?:boolean;value?:PartyOptions;disabled?:boolean;onChange:(value:PartyOptions)=>void}) {
  return <fieldset className="settings-fields" aria-label="Brettspieloptionen" disabled={disabled}>
    {!rollItUp&&<label>Runden<select value={value.rounds} onChange={e=>onChange({...value,rounds:Number(e.target.value)})}>{Array.from({length:11},(_,i)=>i+5).map(n=><option key={n}>{n}</option>)}</select></label>}
    <ClassicToggle value={value.classic??true} onChange={classic=>onChange({...value,classic})}/>
  </fieldset>;
}
