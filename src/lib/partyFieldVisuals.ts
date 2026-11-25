import { fieldCoins, isFinalStretch, type Field, type PartyBoardState } from "../../shared/partyBoard";

/** One visual vocabulary for the 3D board, 2D map, legend and route previews. */
export const FIELD_VISUALS={
  start:{color:"#fff0ad",ink:"#10485b",symbol:"⚑"},
  coin:{color:"#326fc7",ink:"#fff9e8",symbol:"+"},
  bad:{color:"#c33d4c",ink:"#fff9e8",symbol:"−"},
  event:{color:"#65c783",ink:"#10485b",symbol:"!"},
  gift:{color:"#ffd258",ink:"#10485b",symbol:"◇"},
  shop:{color:"#a6dff5",ink:"#10485b",symbol:"▣"},
  duel:{color:"#6a3fb8",ink:"#fff9e8",symbol:"⚔"},
  safe:{color:"#f5e9bc",ink:"#10485b",symbol:"·"},
  tunnel:{color:"#e58a3a",ink:"#2a1606",symbol:"⇄"}
} as const satisfies Record<Field,{color:string;ink:string;symbol:string}>;

export const fieldSymbol=(type:Field)=>FIELD_VISUALS[type].symbol;

export const FIELD_HELP: Record<Field,string> = {
  start:"Beim Passieren bekommst du 3 Münzen.",coin:"Beim Landen bekommst du 3 Münzen.",
  bad:"Beim Landen verlierst du bis zu 3 Münzen. Ein Schild schützt dich.",
  event:"Eine Überraschung für dich oder die ganze Gruppe.",gift:"Hier wartet ein zufälliges Item auf dich.",
  shop:"Kaufe ein Item für deinen nächsten Zug.",duel:"Fordere jemanden zum Duell: Beide setzen gleich viele Münzen, wer das Minispiel gewinnt, bekommt alle.",safe:"Hier kannst du die Aussicht genießen. Keine weiteren Effekte.",
  tunnel:"Rohrpost: Wer hier landet, saust zum Partnerfeld auf der anderen Seite."
};

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
    duel:"Fordere jemanden zum Duell: Beide setzen gleich viele Münzen (bis 10), wer das Minispiel zu zweit gewinnt, bekommt alle.",
    safe:"Hier kannst du die Aussicht genießen.",
    tunnel:"Rohrpost: Wer hier landet, saust zum Partnerfeld auf der anderen Seite."
  }[type];
}
