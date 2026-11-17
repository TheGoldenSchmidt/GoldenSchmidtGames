import { fieldCoins, isFinalStretch, type Field, type PartyBoardState } from "../../shared/partyBoard";

/** One visual vocabulary for the 3D board, 2D map, legend and route previews. */
export const FIELD_VISUALS={
  start:{color:"#fff0ad",ink:"#10485b",symbol:"⚑"},
  coin:{color:"#326fc7",ink:"#fff9e8",symbol:"+"},
  bad:{color:"#c33d4c",ink:"#fff9e8",symbol:"−"},
  event:{color:"#65c783",ink:"#10485b",symbol:"!"},
  gift:{color:"#ffd258",ink:"#10485b",symbol:"◇"},
  shop:{color:"#a6dff5",ink:"#10485b",symbol:"▣"},
  safe:{color:"#f5e9bc",ink:"#10485b",symbol:"·"}
} as const satisfies Record<Field,{color:string;ink:string;symbol:string}>;

export const fieldSymbol=(type:Field)=>FIELD_VISUALS[type].symbol;

/** Field explanation for map pop-ups; plus and minus fields name their current amount. */
export function fieldHelp(game:PartyBoardState,type:Field) {
  const amount=fieldCoins(game),doubled=isFinalStretch(game)?" In den letzten Runden zählt das Feld doppelt.":"";
  return {
    start:"Beim Passieren bekommst du 3 Münzen.",
    coin:`Beim Landen bekommst du ${amount} Münzen.${doubled}`,
    bad:`Beim Landen verlierst du bis zu ${amount} Münzen. Ein Schild schützt dich.${doubled}`,
    event:"Eine Überraschung für dich oder die ganze Gruppe.",
    gift:"Hier wartet ein zufälliges Item auf dich.",
    shop:"Kaufe ein Item für deinen nächsten Zug.",
    safe:"Hier kannst du die Aussicht genießen."
  }[type];
}
