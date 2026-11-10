import * as T from "three";
import { character, SceneKit } from "./sceneKit";

export function createCharacterPreview(host:HTMLElement,id:string,index:number,read:()=>{angle:number;reduce:boolean},onError:()=>void){
  const kit=new SceneKit(host,onError),world=new T.Group();kit.scene.add(world);
  kit.scene.background=new T.Color(0x57e4cb);kit.scene.fog=null;kit.camera.position.set(0,1.8,4.3);kit.camera.lookAt(0,.85,0);
  kit.cylinder(world,0xffe44e,0,-.13,0,1.1,.25);kit.cylinder(world,0x24133f,0,-.29,0,1.16,.1);
  const model=character(kit,world,index,undefined,id);
  host.dataset.character=id;
  let frame=0;
  const render=(time:number)=>{const state=read();model.pose(state.angle,0,time,0,false,state.reduce);kit.render();frame=requestAnimationFrame(render);};
  frame=requestAnimationFrame(render);
  return {dispose(){cancelAnimationFrame(frame);kit.dispose();delete host.dataset.character;}};
}
