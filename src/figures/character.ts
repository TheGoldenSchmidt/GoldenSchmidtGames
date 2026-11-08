import * as T from "three";
import { characterId } from "../../shared/characters";
import { createAnimationPlayer } from "./AnimationPlayer";
import { buildFigure } from "./CardFigure";
import { getFigure } from "./catalog";

/** Figurenanimationen bleiben innerhalb der Spielposition; Physik und Namensschild gehören zum äußeren Objekt. */
export function figureCharacter(parent:T.Object3D, selected:string) {
  const data=getFigure(characterId(selected)), built=buildFigure({...data.visual,height:.8},{useGeometryCache:false});
  const group=new T.Group();group.userData.characterId=selected;parent.add(group);group.add(built.root);
  const options={reducedMotion:false},player=createAnimationPlayer(built.parts,data.animations??{},options);
  const part=(...ids:string[])=>ids.map(id=>built.parts.get(id)).find(Boolean);
  const legs=[part("legL","leftLeg"),part("legR","rightLeg")],arms=[part("armL","leftArm"),part("armR","rightArm")];
  let lastPunch=false,lastJump=false;
  return {group,pose(heading:number,speed:number,time:number,jump:number,punch:boolean,reduce:boolean){
    group.rotation.y=heading;options.reducedMotion=reduce;
    if(reduce)player.reset();
    else {if(punch&&!lastPunch)player.play("attack");if(jump>0&&!lastJump&&data.animations?.jump)player.play("jump");}
    player.update(time);lastPunch=punch;lastJump=jump>0;
    const walk=Math.min(1,speed/4.8),swing=reduce?0:Math.sin(time*.014)*walk*.65;
    if(legs[0])legs[0].rotation.x+=swing;
    if(legs[1])legs[1].rotation.x-=swing;
    if(arms[0])arms[0].rotation.x-=swing*.7;
    if(arms[1])arms[1].rotation.x+=punch?-1.25:swing*.7;
    if(!reduce)built.root.position.y+=Math.abs(Math.sin(time*.014))*walk*.035;
  }};
}
