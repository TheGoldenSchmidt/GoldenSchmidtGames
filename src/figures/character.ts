import {RIG_JOINTS} from "./rigJoints";
import * as T from "three";
import { characterId } from "../../shared/characters";
import { createAnimationPlayer } from "./AnimationPlayer";
import {buildOptimizedFigure} from "./optimizedFigure";
import { getFigure } from "./catalog";

/** Figurenanimationen bleiben innerhalb der Spielposition; Physik und Namensschild gehören zum äußeren Objekt. */
export function figureCharacter(parent:T.Object3D, selected:string) {
  const data=getFigure(characterId(selected)), built=buildOptimizedFigure(data);
  const group=new T.Group();group.userData.characterId=selected;parent.add(group);group.add(built.root);
  const options={reducedMotion:false,idleWeight:1,extraParts:Object.values(RIG_JOINTS).flat()},player=createAnimationPlayer(built.parts,data.animations??{},options);
  const part=(...ids:string[])=>ids.map(id=>built.parts.get(id)).find(Boolean);
  const legs=[part(...RIG_JOINTS.leftLeg),part(...RIG_JOINTS.rightLeg)],arms=[part(...RIG_JOINTS.leftArm),part(...RIG_JOINTS.rightArm)];
  const feet=[part(...RIG_JOINTS.leftFoot),part(...RIG_JOINTS.rightFoot)].map((foot,index)=>foot&&!legs[index]?.getObjectById(foot.id)?foot:undefined);
  let lastPunch=false,lastJump=false,lastTime=0,walk=0,hit=0,wheel=0,air=0;
  return {group,pose(heading:number,speed:number,time:number,jump:number,punch:boolean,reduce:boolean){
    group.rotation.y=heading;options.reducedMotion=reduce;
    const dt=lastTime?Math.max(0,Math.min(.1,(time-lastTime)/1000)):1/60;lastTime=time;
    walk+=((reduce?0:Math.min(1,speed/4.8))-walk)*(1-Math.exp(-dt*12));
    hit+=((punch&&!reduce?1:0)-hit)*(1-Math.exp(-dt*(punch?24:12)));options.idleWeight=1-walk*.7;
    air+=((jump>0&&!reduce?1:0)-air)*(1-Math.exp(-dt*14));
    wheel+=reduce?0:speed*dt*3;
    if(reduce)player.reset();
    else {if(punch&&!lastPunch)player.play("attack",time);if(jump>0&&!lastJump&&data.animations?.jump)player.play("jump",time);}
    player.update(time);lastPunch=punch;lastJump=jump>0;
    const swing=reduce?0:Math.sin(time*.014)*walk*.65;
    group.userData.stride=swing;
    if(legs[0])legs[0].rotation.x+=swing;
    if(legs[1])legs[1].rotation.x-=swing;
    for(const [index,foot] of feet.entries())if(foot){const step=swing*(index===0?1:-1);foot.position.y+=Math.max(0,step)*.12;foot.position.z+=step*.1;}
    if(arms[0])arms[0].rotation.x-=swing*.7;
    if(arms[1])arms[1].rotation.x+=-hit*1.25+swing*.7*(1-hit);
    for(const id of RIG_JOINTS.wheels){const joint=built.parts.get(id);if(joint)joint.rotation.x+=wheel;}
    built.root.rotation.x-=air*.08;
    if(!reduce&&!legs.some(Boolean)&&!feet.some(Boolean)&&!RIG_JOINTS.wheels.some(id=>built.parts.has(id)))built.root.rotation.z+=Math.sin(time*.007)*walk*.05;
    if(!reduce)built.root.position.y+=Math.abs(Math.sin(time*.014))*walk*.035;
  }};
}
