import * as T from "three";
import type {ArenaState} from "../../shared/partyArena";
import {blockY,COMMAND_ZONES,DUO_SWITCHES,GOLF_GATES,HEX_COLORS,HEX_PLATFORMS,hexCue,photoSpot,wallCellPoint,wallHoles} from "../../shared/arenaChallenges";
import {SceneKit} from "./sceneKit";

export function challengeWorld(kit:SceneKit,world:T.Group,initial:ArenaState):(s:ArenaState)=>void {
  const id=initial.id;
  const deck=(color=0xf5d695,w=14,d=10.8,z=0)=>kit.box(world,color,0,-.32,z,w,.6,d);
  if(id==="hex"){
    const tiles=HEX_PLATFORMS.map((p,i)=>{const tile=kit.mesh(world,new T.CylinderGeometry(2,2,.45,6),Number(HEX_COLORS[i].replace("#","0x")),p.x,-.18,p.z);const label=kit.badge(world,String(i+1),"#10485b",.7);label.position.set(p.x,.35,p.z);tile.userData.label=label;return tile;});
    return s=>{const phase=s.time%6000,target=hexCue(s);for(const [i,tile] of tiles.entries()){const sink=phase<3500?0:phase<4200?(phase-3500)/700:phase<5500?1:1-(phase-5500)/500;tile.position.y=-.18-(i===target?0:sink*3);(tile.userData.label as T.Sprite).position.y=tile.position.y+.5;}};
  }
  if(id==="bumper"){
    kit.cylinder(world,0xffdf9f,0,-.3,0,6.3,.6);kit.cylinder(world,0x79cabc,0,.01,0,6.1,.04);const edge=kit.mesh(world,new T.TorusGeometry(6.13,.055,6,64),0xffd258,0,.05,0);edge.rotation.x=Math.PI/2;return()=>{};
  }
  if(id==="golf"||id==="duos"){
    deck(id==="golf"?0x87bf72:0xf5d695,12,29,-10);
    for(const z of [-1,-5,-9,-13,-17,-21]){const flag=kit.badge(world,"⚑","#b94f42",.8);flag.position.set(5.5,.8,z);}
    if(id==="golf"){
      for(const gate of GOLF_GATES){const left=gate.gapX-1.6,right=gate.gapX+1.6;kit.box(world,0x4b98a1,(-6+left)/2,.7,gate.z,left+6,1.4,.35);kit.box(world,0x4b98a1,(6+right)/2,.7,gate.z,6-right,1.4,.35);}
      kit.cylinder(world,0x10485b,0,.015,-21.8,.85,.08);kit.cylinder(world,0xfff9e8,.8,1.15,-21.8,.035,2.3);const flag=kit.badge(world,"⚑","#e96752",1);flag.position.set(1,2.2,-21.8);return()=>{};
    }
    const gates=DUO_SWITCHES.map((p,i)=>{const gate=kit.box(world,i?0xe87e60:0x47a6b4,0,1,p.gate,11.8,2,.3);for(const x of [p.left,p.right]){kit.cylinder(world,0xffd258,x,.06,p.z,.95,.12);const label=kit.badge(world,i?"Ⅱ":"Ⅰ","#10485b",.65);label.position.set(x,.65,p.z);}return gate;});
    for(const z of [-7,-16,-19])kit.box(world,0xe87e60,0,.5,z,11,1,.22);
    kit.lighthouse(world,4,0,-24);return s=>gates.forEach((gate,i)=>{gate.position.y=s.gates?.[i]?-2.5:1;});
  }
  deck(id==="stack"?0x8ebd9d:0xf5d695);
  if(id==="walls"){
    const tiles=Array.from({length:9},(_,cell)=>{const p=wallCellPoint(cell),tile=kit.box(world,0xdab478,p.x,8,p.z,4.3,.4,3.1);tile.material=tile.material.clone();(tile.material as T.MeshStandardMaterial).transparent=true;(tile.material as T.MeshStandardMaterial).opacity=.65;return tile;});
    const safe=Array.from({length:2},()=>{const ring=kit.mesh(world,new T.TorusGeometry(1,.065,6,32),0x47a6b4,0,.04,0);ring.rotation.x=Math.PI/2;return ring;});
    return s=>{const holes=wallHoles(s),phase=s.time%6000,y=phase<4500?8*(1-phase/4500):phase<5000?0:(phase-5000)/1000*8;for(const [i,tile] of tiles.entries()){tile.visible=!holes.includes(i);tile.position.y=y+.2;}safe.forEach((ring,i)=>{const p=wallCellPoint(holes[i]);ring.position.x=p.x;ring.position.z=p.z;});};
  }
  if(id==="says"){
    for(const zone of COMMAND_ZONES){kit.cylinder(world,zone.color,zone.x,.03,zone.z,1.6,.1);const label=kit.badge(world,zone.icon,"#10485b",1.1);label.position.set(zone.x,.55,zone.z);}return()=>{};
  }
  if(id==="photo"){
    const target=kit.mesh(world,new T.TorusGeometry(.95,.085,8,40),0xffd258,0,.08,0);target.rotation.x=Math.PI/2;
    const camera=new T.Group();world.add(camera);kit.cylinder(camera,0x10485b,0,1,0,.04,2);kit.box(camera,0x10485b,0,2,0,.8,.55,.4);const lens=kit.cylinder(camera,0xffd258,0,2,.3,.2,.25);lens.rotation.x=Math.PI/2;
    return s=>{const p=photoSpot(s);target.position.set(p.x,.08,p.z);camera.position.set(p.x,0,-6.2);camera.lookAt(p.x,0,p.z);};
  }
  if(id==="stack"){
    const blocks=(initial.blocks??[]).map(b=>kit.box(world,b.id%2?0xc58e52:0xe7b776,b.x,9,b.z,1.8,1.1,1.8));
    const warnings=(initial.blocks??[]).map(b=>kit.box(world,0xe96752,b.x,.04,b.z,1.9,.03,1.9));
    return s=>{for(const [i,b] of (s.blocks??[]).entries()){blocks[i].visible=s.time>=b.startAt;blocks[i].position.y=blockY(b,s.time)+.55;warnings[i].visible=s.time>=b.startAt-1000&&s.time<b.landAt;}};
  }
  return()=>{};
}
