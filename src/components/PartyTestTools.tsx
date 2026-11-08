import { useRef, useState } from "react";
import { ACTION_MINI_IDS, ARENA_META, type ArenaId } from "../../shared/partyArena";
import type { RoomState } from "../../shared/types";
import { socket } from "../lib/socket";

export function PartyTestTools({room,onUpdate}:{room:RoomState;onUpdate:(room:RoomState)=>void}){
  const [selected,setSelected]=useState<ArenaId>("dash"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const panel=useRef<HTMLDetailsElement>(null);
  const commandSeq=useRef(0);
  function send(command:string,miniId?:string){setBusy(true);setError("");commandSeq.current=Math.max(commandSeq.current,room.partyTest?.commandSeq??0)+1;socket.timeout(15000).emit("party:test-command",{command,miniId,seq:commandSeq.current,token:room.partyToken},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{setBusy(false);if(err||!response.ok||!response.data)setError(response?.error??"Der Server antwortet gerade nicht.");else{if(panel.current)panel.current.open=false;onUpdate(response.data);}});}
  return <details className="party-test-tools" ref={panel}><summary>Testpartie mit Bots <span>Startwert {room.partyTest!.seed}</span></summary>
    <div className="party-test-tools__body"><p>Deine Bots spielen selbstständig. Hier kannst du gezielt etwas ausprobieren.</p>
      <label>Minispiel auswählen<select value={selected} onChange={e=>setSelected(e.target.value as ArenaId)}>{ACTION_MINI_IDS.map(id=><option key={id} value={id}>{ARENA_META[id].name}</option>)}</select></label>
      <div className="party-test-actions"><button disabled={busy} onClick={()=>send("mini",selected)}>Minispiel starten</button>{room.partyGame?.mini&&<button disabled={busy} onClick={()=>send("mini",room.partyGame!.mini!.id)}>Minispiel wiederholen</button>}<button disabled={busy} onClick={()=>send("skip-bots")}>Bot-Züge überspringen</button></div>
      <details><summary>Partie zurücksetzen</summary><p>Beginnt dieselbe Testpartie von vorn. Der aktuelle Spielstand wird ersetzt.</p><button disabled={busy} onClick={()=>send("restart")}>Testpartie neu starten</button></details>
      {error&&<p role="alert" className="error-message">{error}</p>}
    </div>
  </details>;
}
