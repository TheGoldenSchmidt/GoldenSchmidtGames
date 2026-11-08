import type { CharacterId } from "../../shared/characters";
import type { Animations, FigureBase, FigureDef, FigureVariant } from "./types";
import { resolveFigure } from "./resolve";
import rick from "./data/figures/rick_sanchez_3.json";
import morty from "./data/figures/morty_smith.json";
import cartman from "./data/figures/eric_cartman_3.json";
import stan from "./data/figures/stan_marsh.json";
import kyle from "./data/figures/kyle_broflovski.json";
import kenny from "./data/figures/kenny_mccormick.json";
import butters from "./data/figures/butters_stotch.json";
import korvo from "./data/figures/korvo_3.json";
import terry from "./data/figures/terry_solar_opposites.json";
import pupa from "./data/figures/pupa.json";
import ritter from "./data/figures/ritter.json";
import rekrut from "./data/figures/rekrut.json";
import humanoid from "./data/bases/humanoid-standard.json";
import profile from "./data/profiles/humanoid-standard.json";
import defaults from "./data/animations.json";

const sources={rick_sanchez_3:rick,morty_smith:morty,eric_cartman_3:cartman,stan_marsh:stan,kyle_broflovski:kyle,kenny_mccormick:kenny,butters_stotch:butters,korvo_3:korvo,terry_solar_opposites:terry,pupa,ritter,rekrut};
const cache=new Map<CharacterId,FigureDef>();
export function getFigure(id:CharacterId):FigureDef {
  let figure=cache.get(id);
  if(!figure){figure=resolveFigure(sources[id] as FigureDef|FigureVariant,{"humanoid-standard":humanoid as unknown as FigureBase},{"humanoid-standard":profile as unknown as {animations:Animations}},defaults as unknown as Animations);cache.set(id,figure);}
  return figure;
}
