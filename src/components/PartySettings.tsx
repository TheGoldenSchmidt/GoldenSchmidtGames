import { PARTY_DEFAULTS, type PartyOptions } from "../../shared/party";

export function PartySettings({value=PARTY_DEFAULTS,disabled=false,onChange}:{value?:PartyOptions;disabled?:boolean;onChange:(value:PartyOptions)=>void}) {
  return <fieldset className="party-settings" disabled={disabled}><legend>Deine Inselparty</legend>
    <label>Runden<select value={value.rounds} onChange={e=>onChange({...value,rounds:Number(e.target.value)})}>{Array.from({length:11},(_,i)=>i+5).map(n=><option key={n}>{n}</option>)}</select></label>
    <label>Tempo<select value={value.tempo} onChange={e=>onChange({...value,tempo:e.target.value as PartyOptions['tempo']})}><option value="slow">Gemütlich</option><option value="normal">Normal</option><option value="fast">Schnell</option></select></label>
    <label className="party-check"><input type="checkbox" checked={value.analog} onChange={e=>onChange({...value,analog:e.target.checked})}/>Analoge Aufgaben (alle am selben Ort)</label>
    <p>8 Runden zielen auf etwa 30 Minuten. Rundenzahl, Spielerzahl und Tempo beeinflussen die tatsächliche Dauer.</p>
  </fieldset>;
}
