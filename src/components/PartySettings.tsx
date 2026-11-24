import { PARTY_DEFAULTS, type PartyOptions } from "../../shared/party";
import { ROLL_BOARD_IDS, ROLL_BOARDS, type RollBoardId } from "../../shared/partyBoard";
import { ClassicToggle } from "./MinigameSettings";

export function PartySettings({value=PARTY_DEFAULTS,disabled=false,rollItUp=false,onChange}:{rollItUp?:boolean;value?:PartyOptions;disabled?:boolean;onChange:(value:PartyOptions)=>void}) {
  const board=ROLL_BOARDS[value.board??"bauschale"];
  return <fieldset className="settings-fields" aria-label="Brettspieloptionen" disabled={disabled}>
    {rollItUp?<label>Spielbrett<select value={board.id} aria-describedby="roll-board-detail" onChange={e=>onChange({...value,board:e.target.value as RollBoardId})}>{ROLL_BOARD_IDS.map(id=><option key={id} value={id}>{ROLL_BOARDS[id].name}</option>)}</select><small id="roll-board-detail">{board.detail}</small></label>
      :<label>Runden<select value={value.rounds} onChange={e=>onChange({...value,rounds:Number(e.target.value)})}>{Array.from({length:11},(_,i)=>i+5).map(n=><option key={n}>{n}</option>)}</select></label>}
    <ClassicToggle value={value.classic??true} onChange={classic=>onChange({...value,classic})}/>
  </fieldset>;
}
