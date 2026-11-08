import {characterName,characterPortrait,isCharacterId,type CharacterId} from "../../shared/characters";
import type {RoomState} from "../../shared/types";

export function CharacterAvatar({id,className="",decorative=false}:{id?:string;className?:string;decorative?:boolean}){
  return <span className={`character-avatar ${className}`} data-character={isCharacterId(id)?id:undefined}>{isCharacterId(id)?<img src={characterPortrait(id)} alt={decorative?"":characterName(id)} width="48" height="52" draggable={false}/>:<span aria-label={decorative?undefined:"Figur noch nicht gewählt"}>?</span>}</span>;
}
export function playerCharacters(room:RoomState|undefined,names:string[]|undefined,characters:CharacterId[]|undefined):Record<string,CharacterId|undefined>{
  return Object.fromEntries(room?room.players.map(p=>[p.id,p.characterId]):(names??[]).map((_,i)=>[`local-${i}`,characters?.[i]]));
}
