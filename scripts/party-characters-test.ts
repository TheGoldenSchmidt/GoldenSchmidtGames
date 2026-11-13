import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import sources from "../src/figures/data/approved-sources.json";
import assert from "node:assert/strict";
import * as T from "three";
import { CHARACTERS as ALL_CHARACTERS, CLASSIC_CHARACTERS as CHARACTERS, RIGGED_CHARACTERS, characterId, characterPortrait, isCharacterId, isRiggedCharacter } from "../shared/characters";
import { RIGGED_SPECS, riggedIdFor } from "../src/three/riggedFigure";
import { access } from "node:fs/promises";
import { getFigure,preloadFigures } from "../src/figures/catalog";
import {buildOptimizedFigure} from "../src/figures/optimizedFigure";
import {figureCharacter} from "../src/figures/character";
import { buildFigure } from "../src/figures/CardFigure";
import { createAnimationPlayer } from "../src/figures/AnimationPlayer";
import { resolveFigure, validateFigure } from "../src/figures/resolve";
import type { FigureBase, FigureVariant } from "../src/figures/types";

assert.equal(isCharacterId("../../secret"),false);
assert.equal(characterId("unknown",1),"alpha_morty_smith");
await preloadFigures(CHARACTERS.map(c=>c.id));
assert.equal(CHARACTERS.length,13);
assert.deepEqual(CHARACTERS.map(c=>c.id),sources.map(s=>s.id));
assert.deepEqual((await readdir(new URL("../src/figures/data/figures/",import.meta.url))).sort(),CHARACTERS.map(c=>c.id+".json").sort());
for(const source of sources){const bytes=await readFile(new URL(`../src/figures/data/figures/${source.id}.json`,import.meta.url));assert.equal(createHash("sha256").update(bytes).digest("hex"),source.sha256);}

assert.equal(isCharacterId("kenny_mccormick"),false);
// Animierte Figuren: eigenes Register hinter den klassischen, je ein Aussehen und ein Vorschaubild.
assert.equal(RIGGED_CHARACTERS.length,10);assert.equal(ALL_CHARACTERS.length,23);
assert.deepEqual(ALL_CHARACTERS.slice(0,13).map(c=>c.id),CHARACTERS.map(c=>c.id),"Klassische Figuren behalten ihre Reihenfolge (Standardfigur je Platz)");
assert.deepEqual(Object.keys(RIGGED_SPECS).sort(),RIGGED_CHARACTERS.map(c=>c.id).sort());
for(const entry of RIGGED_CHARACTERS){
  assert.match(entry.id,/^rig_[a-z_]+$/);assert.ok(isCharacterId(entry.id)&&isRiggedCharacter(entry.id));assert.ok(!isRiggedCharacter("alpha_morty_smith"));
  await access(new URL(`../public${characterPortrait(entry.id)}`,import.meta.url));
}
assert.equal(new Set(ALL_CHARACTERS.map(c=>c.name)).size,23,"Namen sind eindeutig");
// Gewählte animierte Figur bleibt; klassische Wahl bekommt in Skelett-Szenen einen Menschen je Farbplatz.
assert.equal(riggedIdFor("rig_bolt",3),"rig_bolt");assert.equal(riggedIdFor("alpha_morty_smith",1),"rig_amara");assert.equal(riggedIdFor(undefined,7),"rig_amara");
for(const entry of CHARACTERS){
  const data=getFigure(entry.id),snapshot=JSON.stringify(data),built=buildFigure({...data.visual,height:.8},{useGeometryCache:false});
  const box=new T.Box3().setFromObject(built.root);
  assert.ok(Math.abs(box.getSize(new T.Vector3()).y-1.44)<1e-5,entry.id);
  assert.ok(Math.abs(box.min.y)<1e-5,`${entry.id}: Füße am Boden`);
  for(const part of data.visual.parts)assert.equal(built.parts.get(part.id)!.parent,part.parent&&part.parent!=="root"?built.parts.get(part.parent):built.root);
  const optimized=buildOptimizedFigure(data),optimizedBox=new T.Box3().setFromObject(optimized.root,true);
  assert.ok(optimizedBox.min.distanceTo(new T.Box3().setFromObject(built.root,true).min)<1e-5&&optimizedBox.max.distanceTo(new T.Box3().setFromObject(built.root,true).max)<1e-5,`${entry.id}: batching preserves silhouette`);
  assert.ok(optimized.root.userData.surfaceCount<optimized.root.userData.sourceMeshCount,entry.id);
  for(const part of data.visual.parts)assert.equal(optimized.parts.get(part.id)!.parent,part.parent&&part.parent!=="root"?optimized.parts.get(part.parent):optimized.root);
  console.log(`${entry.name}: ${optimized.root.userData.sourceMeshCount} → ${optimized.root.userData.surfaceCount} surfaces`);
  const opts={reducedMotion:false},player=createAnimationPlayer(built.parts,data.animations!,opts),optimizedPlayer=createAnimationPlayer(optimized.parts,data.animations!,opts);
  for(const [name,clip] of Object.entries(data.animations!)){
    for(const fraction of [0,.25,.5,.99,1.1]){
      player.reset();optimizedPlayer.reset();player.play(name,1000);optimizedPlayer.play(name,1000);
      // Disable the idle loop here so both independent players share the exact time origin.
      opts.reducedMotion=true;const time=1000+clip.duration*fraction*1000;player.update(time);optimizedPlayer.update(time);
      built.root.updateMatrixWorld(true);optimized.root.updateMatrixWorld(true);
      for(const [id,part] of built.parts){const actual=optimized.parts.get(id)!;assert.ok(part.matrixWorld.elements.every((v,i)=>Math.abs(v-actual.matrixWorld.elements[i])<1e-6),`${entry.id}: ${name}/${id} joint transform`);}
      const expected=new T.Box3().setFromObject(built.root,true),actual=new T.Box3().setFromObject(optimized.root,true);
      assert.ok(actual.min.distanceTo(expected.min)<1e-5&&actual.max.distanceTo(expected.max)<1e-5,`${entry.id}: ${name} animated silhouette`);
    }
  }
  opts.reducedMotion=false;
  for(const name of Object.keys(data.animations!)){player.reset();player.play(name);player.update(performance.now()+100);for(const part of built.parts.values())assert.ok([...part.position.toArray(),...part.rotation.toArray().slice(0,3),...part.scale.toArray()].every(v=>Number.isFinite(v as number)),`${entry.id}: ${name}`);}
  player.reset();opts.reducedMotion=true;player.update(performance.now()+5000);
  const still=built.root.position.clone();player.update(performance.now()+6000);assert.ok(still.equals(built.root.position));
  assert.equal(JSON.stringify(data),snapshot,"Animation darf Quelldaten nicht verändern");
  const walker=figureCharacter(new T.Group(),entry.id),standing=figureCharacter(new T.Group(),entry.id);
  const surfaces=(group:T.Group)=>{group.updateMatrixWorld(true);const matrices:number[][]=[];group.traverse(object=>{if(object instanceof T.Mesh)matrices.push([...object.matrixWorld.elements]);});return matrices;};
  for(let time=1000;time<=1400;time+=16){walker.pose(0,4.8,time,0,false,false);standing.pose(0,0,time,0,false,false);}
  const walkingSurfaces=surfaces(walker.group),stillSurfaces=surfaces(standing.group);
  assert.ok(walkingSurfaces.some((matrix,index)=>matrix.some((value,axis)=>Math.abs(value-stillSurfaces[index][axis])>.001)),`${entry.id}: locomotion moves rendered surfaces`);
  walker.pose(0,4.8,1500,0,false,true);const reducedSurfaces=surfaces(walker.group);
  walker.pose(0,4.8,1700,0,false,true);
  assert.deepEqual(surfaces(walker.group),reducedSurfaces,`${entry.id}: reduced motion freezes locomotion`);
  assert.equal(walker.group.userData.stride,0);
  for(const actor of [walker,standing])actor.group.traverse(object=>{if(object instanceof T.Mesh){object.geometry.dispose();object.material.dispose();}});
  optimized.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();o.material.dispose();}});
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

// Clips whose last keyframe is non-neutral still blend back without snapping.
const anchor=new T.Group(),parts=new Map([["root",anchor]]),transition=createAnimationPlayer(parts,{attack:{duration:1,tracks:[{part:"root",prop:"rot.x",keys:[[0,1],[1,1]]}]}});
transition.play("attack",0);transition.update(0);assert.equal(anchor.rotation.x,0);
transition.update(500);assert.equal(anchor.rotation.x,1);
transition.update(999);assert.ok(anchor.rotation.x<.01);
transition.update(1001);assert.equal(anchor.rotation.x,0);
