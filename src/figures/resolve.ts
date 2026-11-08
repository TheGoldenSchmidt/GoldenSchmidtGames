import type { Animations, FigureBase, FigureDef, FigureVariant } from "./types";

/** Gleiche Reihenfolge wie PC_Fighters: Profil < Grundgerüst < Variante. */
export function resolveFigure(source: FigureDef | FigureVariant, bases: Record<string,FigureBase>, profiles: Record<string,{animations:Animations}>, defaults: Animations): FigureDef {
  if (!("baseId" in source)) return validateFigure({...structuredClone(source), animations:{...defaults,...source.animations}});
  const base=bases[source.baseId];
  if(!base) throw new Error(`Grundgerüst fehlt: ${source.baseId}`);
  const target=(id:string) => {
    if(!id.startsWith("@"))return id;
    const attachment=base.attachments[id.slice(1)];
    if(!attachment)throw new Error(`Unbekannter Anschluss: ${id}`);
    return attachment;
  };
  const visual=structuredClone(base.visual), removed=new Set((source.removeParts??[]).map(target));
  const known=new Set(visual.parts.map(p=>p.id));
  for(const id of removed)if(id==="root"||!known.has(id))throw new Error(`Ungültiger entfernter Baustein: ${id}`);
  for(let changed=true;changed;){changed=false;for(const part of visual.parts)if(part.parent&&removed.has(part.parent)&&!removed.has(part.id)){removed.add(part.id);changed=true;}}
  visual.parts=visual.parts.filter(p=>!removed.has(p.id));
  for(const patch of source.patchParts??[]){
    const part=visual.parts.find(p=>p.id===target(patch.id));if(!part)throw new Error(`Baustein fehlt: ${patch.id}`);
    const {id:_,...changes}=structuredClone(patch);if(changes.parent)changes.parent=target(changes.parent);Object.assign(part,changes);
  }
  for(const part of structuredClone(source.addParts??[])){if(part.parent)part.parent=target(part.parent);visual.parts.push(part);}
  visual.palette={...visual.palette,...source.palette};
  if(source.height!==undefined)visual.height=source.height;
  if(source.detailLevel)visual.detailLevel=source.detailLevel;
  const profile=base.animationProfileId?profiles[base.animationProfileId]:undefined;
  if(base.animationProfileId&&!profile)throw new Error(`Animationsprofil fehlt: ${base.animationProfileId}`);
  return validateFigure({cardId:source.cardId,visual,animations:{...defaults,...profile?.animations,...base.animations,...source.animations}});
}

export function validateFigure(figure:FigureDef):FigureDef {
  const parts=new Map(figure.visual.parts.map(p=>[p.id,p]));
  if(parts.has("root")||parts.size!==figure.visual.parts.length)throw new Error("Doppelte oder reservierte Baustein-ID.");
  for(const part of parts.values()){
    const seen=new Set([part.id]);let parent=part.parent;
    while(parent&&parent!=="root"){
      if(seen.has(parent)||!parts.has(parent))throw new Error(`Ungültige Hierarchie: ${part.id}`);
      seen.add(parent);parent=parts.get(parent)!.parent;
    }
  }
  for(const clip of Object.values(figure.animations??{})){
    if(!Number.isFinite(clip.duration)||clip.duration<=0)throw new Error("Ungültige Animationsdauer.");
    for(const track of clip.tracks){
      if(track.part!=="root"&&!parts.has(track.part))throw new Error(`Animationsbaustein fehlt: ${track.part}`);
      if(!track.keys.length||track.keys.some(([t,v],i)=>!Number.isFinite(t)||!Number.isFinite(v)||t<0||i>0&&t<=track.keys[i-1][0]))throw new Error("Ungültige Keyframes.");
    }
  }
  return figure;
}
