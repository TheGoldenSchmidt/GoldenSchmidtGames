import assert from "node:assert/strict";
import * as T from "three";
import { CHARACTERS, characterId, isCharacterId } from "../shared/characters";
import { getFigure } from "../src/figures/catalog";
import { buildFigure } from "../src/figures/CardFigure";
import { createAnimationPlayer } from "../src/figures/AnimationPlayer";
import { resolveFigure, validateFigure } from "../src/figures/resolve";
import type { FigureBase, FigureVariant } from "../src/figures/types";

assert.equal(isCharacterId("../../secret"),false);
assert.equal(characterId("unknown",1),"morty_smith");
for(const entry of CHARACTERS){
  const data=getFigure(entry.id),snapshot=JSON.stringify(data),built=buildFigure({...data.visual,height:.8},{useGeometryCache:false});
  const box=new T.Box3().setFromObject(built.root);
  assert.ok(Math.abs(box.getSize(new T.Vector3()).y-1.44)<1e-5,entry.id);
  assert.ok(Math.abs(box.min.y)<1e-5,`${entry.id}: Füße am Boden`);
  for(const part of data.visual.parts)assert.equal(built.parts.get(part.id)!.parent,part.parent&&part.parent!=="root"?built.parts.get(part.parent):built.root);
  const opts={reducedMotion:false},player=createAnimationPlayer(built.parts,data.animations!,opts);
  for(const name of Object.keys(data.animations!)){player.reset();player.play(name);player.update(performance.now()+100);for(const part of built.parts.values())assert.ok([...part.position.toArray(),...part.rotation.toArray().slice(0,3),...part.scale.toArray()].every(v=>Number.isFinite(v as number)),`${entry.id}: ${name}`);}
  player.reset();opts.reducedMotion=true;player.update(performance.now()+5000);
  const still=built.root.position.clone();player.update(performance.now()+6000);assert.ok(still.equals(built.root.position));
  assert.equal(JSON.stringify(data),snapshot,"Animation darf Quelldaten nicht verändern");
  built.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});
}
const base:FigureBase={baseId:"base",attachments:{rightHand:"hand"},visual:{palette:{shirt:"#000000"},parts:[{id:"body",shape:"group"},{id:"hand",shape:"group",parent:"body"},{id:"weapon",shape:"box",parent:"hand",size:1}]},animationProfileId:"rig"};
const variant:FigureVariant={cardId:"test",baseId:"base",palette:{shirt:"#ffffff"},patchParts:[{id:"@rightHand",pos:[1,2,3]}],removeParts:["weapon"],addParts:[{id:"glove",parent:"@rightHand",shape:"sph",size:.1}]};
const clip={duration:1,tracks:[]},resolved=resolveFigure(variant,{base},{rig:{animations:{attack:clip}}},{});
assert.deepEqual(resolved.visual.parts.find(p=>p.id==="hand")!.pos,[1,2,3]);
assert.equal(resolved.visual.parts.find(p=>p.id==="glove")!.parent,"hand");
assert.equal(resolved.visual.palette!.shirt,"#ffffff");assert.equal(resolved.visual.parts.some(p=>p.id==="weapon"),false);
assert.equal(base.visual.palette!.shirt,"#000000");assert.equal(resolved.animations!.attack,clip);
assert.throws(()=>resolveFigure({...variant,baseId:"missing"},{base},{},{}));
assert.throws(()=>validateFigure({cardId:"bad",visual:{parts:[{id:"a",shape:"group",parent:"b"},{id:"b",shape:"group",parent:"a"}]}}));
assert.throws(()=>validateFigure({cardId:"bad",visual:{parts:[]},animations:{bad:{duration:1,tracks:[{part:"missing",prop:"pos.x",keys:[[0,0],[1,1]]}]}}}));
console.log(`Figuren: ${CHARACTERS.length} Modelle, Hierarchien, Größen, Animationen und Varianten geprüft.`);
