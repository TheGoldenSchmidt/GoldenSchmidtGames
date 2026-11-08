import {characterId,type CharacterId} from "../../shared/characters";
import type {Animations,FigureDef} from "./types";
import {resolveFigure} from "./resolve";
import defaults from "./data/animations.json";
const loaders:Record<CharacterId,()=>Promise<{default:unknown}>>={
  alpha_rick_prime:()=>import("./data/figures/alpha_rick_prime.json",{with:{type:"json"}}),
  alpha_morty_smith:()=>import("./data/figures/alpha_morty_smith.json",{with:{type:"json"}}),
  alpha_summer_smith:()=>import("./data/figures/alpha_summer_smith.json",{with:{type:"json"}}),
  alpha_jerry_smith:()=>import("./data/figures/alpha_jerry_smith.json",{with:{type:"json"}}),
  alpha_mr_nimbus:()=>import("./data/figures/alpha_mr_nimbus.json",{with:{type:"json"}}),
  alpha_scary_terry:()=>import("./data/figures/alpha_scary_terry.json",{with:{type:"json"}}),
  alpha_mr_poopybutthole:()=>import("./data/figures/alpha_mr_poopybutthole.json",{with:{type:"json"}}),
  alpha_captain_diabetes:()=>import("./data/figures/alpha_captain_diabetes.json",{with:{type:"json"}}),
  alpha_doctor_timothy:()=>import("./data/figures/alpha_doctor_timothy.json",{with:{type:"json"}}),
  alpha_the_coon:()=>import("./data/figures/alpha_the_coon.json",{with:{type:"json"}}),
  alpha_eric_cartman:()=>import("./data/figures/alpha_eric_cartman.json",{with:{type:"json"}}),
  alpha_pupa:()=>import("./data/figures/alpha_pupa.json",{with:{type:"json"}}),
  alpha_korvo:()=>import("./data/figures/alpha_korvo.json",{with:{type:"json"}})
};
const cache=new Map<CharacterId,FigureDef>(),pending=new Map<CharacterId,Promise<FigureDef>>();
export function loadFigure(id:CharacterId):Promise<FigureDef>{
  const cached=cache.get(id);if(cached)return Promise.resolve(cached);
  const current=pending.get(id);if(current)return current;
  const loader=loaders[id];if(!loader)return Promise.reject(new Error(`Figur nicht verfügbar: ${id}`));
  const request=loader().then(module=>{const figure=resolveFigure(module.default as FigureDef,{}, {},defaults as unknown as Animations);cache.set(id,figure);return figure;}).finally(()=>pending.delete(id));
  pending.set(id,request);return request;
}
export const preloadFigures=(ids:readonly unknown[])=>Promise.all([...new Set(ids.map((id,index)=>characterId(id,index)))].map(loadFigure));
export function getFigure(id:CharacterId):FigureDef{const figure=cache.get(id);if(!figure)throw new Error(`Figur wird noch geladen: ${id}`);return figure;}
