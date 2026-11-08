import * as T from "three";
import { advanceArena, bridgeCenter, clamp, DASH_BLOCKS, HURDLES, TILT_HOLES, type ArenaInput, type ArenaState } from "../../shared/partyArena";
import { character, PLAYER_COLORS, SceneKit, type Character } from "./sceneKit";

export interface ArenaFrame {arena:ArenaState;viewer:string;elapsed:number;input:ArenaInput;reduce:boolean;names:Record<string,string>;paused:boolean}
export function createArenaWorld(host:HTMLElement,read:()=>ArenaFrame,onError:()=>void) {
  const initial=read(),id=initial.arena.id,kit=new SceneKit(host,onError),world=new T.Group();kit.scene.add(world);kit.water(world,-.8);
  const race=id==="balance"||id==="hurdles";
  const actors=new Map<string,Character>(),balls=new Map<string,T.Mesh>(),pickups=new Map<number,T.Group>(),crates=new Map<number,T.Group>(),waves:T.Mesh[]=[];
  if(id==="balance"){
    for(let z=3;z>=-23;z-=.5){const plank=kit.box(world,0xd9ab6b,bridgeCenter(z),-.12,z,2,.22,.56);plank.rotation.y=-Math.atan(Math.cos((z-2)*.35)*.595);if(Math.round(z*2)%8===0)kit.cylinder(world,0x986e47,bridgeCenter(z),-1.5,z,.18,3);}
    kit.box(world,0xffe5a1,0,-.3,3.2,4,.5,3);kit.box(world,0xffe5a1,bridgeCenter(-22),-.3,-22.5,5,.5,3);kit.lighthouse(world,bridgeCenter(-22)+2.2,0,-23);
  }else if(id==="hurdles"){
    kit.box(world,0xf5d695,0,-.35,-10,12,.7,29);
    for(let z=3;z>-23;z-=2)for(const x of [-6,6])kit.box(world,0xfdf7d9,x,-.1,z,.17,.3,1);
    for(const [i,z] of HURDLES.entries()){
      kit.box(world,i%2?0xec7f5a:0x47a6b4,0,.53,z,10.8,1.06,.24);
      for(const x of [-5.5,5.5]){kit.box(world,0xf8f0ce,x,.7,z,.25,1.4,.35);const flag=kit.badge(world,String(i+1),"#10485b",.65);flag.position.set(x,1.8,z);}
    }
    kit.lighthouse(world,3.5,0,-24);kit.box(world,0x69be71,0,-.1,-22,12,.2,1);
  }else if(id==="tilt"){
    const shape=new T.Shape();shape.moveTo(-7,-5.4);shape.lineTo(7,-5.4);shape.lineTo(7,5.4);shape.lineTo(-7,5.4);shape.closePath();
    for(const hole of TILT_HOLES){const path=new T.Path();path.absarc(hole.x,-hole.z,hole.r,0,Math.PI*2,true);shape.holes.push(path);const rim=kit.mesh(world,new T.TorusGeometry(hole.r+.07,.07,8,32),0xf5c967,hole.x,.01,hole.z);rim.rotation.x=Math.PI/2;}
    const deck=kit.mesh(world,new T.ExtrudeGeometry(shape,{depth:.45,bevelEnabled:false}),0xa1d585,0,-.45,0);deck.rotation.x=-Math.PI/2;
    for(const [x,z] of [[-7.2,0],[7.2,0]] as const)kit.box(world,0xf9dfab,x,-.05,z,.25,.5,11);
  }else if(id==="shock"){
    kit.cylinder(world,0xffdf9f,0,-.3,0,6.3,.6);kit.cylinder(world,0x82c973,0,.01,0,5.9,.05);kit.cylinder(world,0xffc956,0,.1,0,.65,.2);
    for(let i=0;i<3;i++){const wave=kit.mesh(world,new T.TorusGeometry(1,.08,8,72),0xffefc7,0,.28,0);wave.rotation.x=Math.PI/2;waves.push(wave);}
  }else {
    kit.box(world,id==="crates"?0xe4c98f:0x8dcc79,0,-.3,0,14.2,.6,10.8);
    for(const x of [-7.2,7.2])kit.box(world,0xf8e3b6,x,.02,0,.3,.4,11);
    for(const z of [-5.4,5.4])kit.box(world,0xf8e3b6,0,.02,z,14.2,.4,.3);
    if(id==="dash")for(const b of DASH_BLOCKS){kit.box(world,0xe7a966,b.x,.5,b.z,b.w,1,b.d);kit.box(world,0xffd7a3,b.x,1.02,b.z,b.w,.08,b.d);}
  }
  // A few landmarks frame the arena without obstructing the play surface.
  if(!race){kit.palm(world,-9,-.2,-5,.85);kit.palm(world,9,-.2,-6,1.1);kit.ball(world,0xffe5a1,-9,-.65,-5,2,.5,2);kit.ball(world,0xffe5a1,9,-.65,-6,2.5,.5,2.5);}
  for(const pickup of initial.arena.pickups){
    const group=new T.Group();group.position.set(pickup.x,pickup.y,pickup.z);world.add(group);
    if(pickup.value===3||id==="tilt")kit.mesh(group,new T.OctahedronGeometry(.32),0xffd04c,0,0,0);
    else {const coin=kit.cylinder(group,0xffd252,0,0,0,.25,.08);coin.rotation.x=Math.PI/2;kit.ball(group,0xffeea3,0,0,.055,.1,.15,.02);}
    pickups.set(pickup.id,group);
  }
  for(const crate of initial.arena.crates){const group=new T.Group();group.position.set(crate.x,0,crate.z);world.add(group);kit.box(group,0xc28c54,0,.55,0,1.2,1.1,1.2);for(const z of [-.63,.63]){kit.beam(group,0xffd18c,new T.Vector3(-.5,.12,z),new T.Vector3(.5,1.02,z),.1);kit.beam(group,0xffd18c,new T.Vector3(.5,.12,z),new T.Vector3(-.5,1.02,z),.1);}crates.set(crate.id,group);}
  let frame=0,last=performance.now(),cameraZ=0,cameraX=0;
  const animate=(time:number)=>{
    const dt=Math.min(.05,(time-last)/1000);last=time;const source=read();
    const view=structuredClone(source.arena),own=view.actors.find(a=>a.id===source.viewer);
    if(own&&!source.paused&&!own.finished){own.input=source.input;own.inputUntil=view.time+300;advanceArena(view,Math.min(source.elapsed,view.time+180));}
    const narrow=kit.camera.aspect<1;
    const myActor=view.actors.find(a=>a.id===source.viewer),targetZ=race?clamp((myActor?.z??2)-2,-18,0):narrow?clamp((myActor?.z??0)*.5,-2.2,2.2):0,targetX=narrow&&!race?clamp((myActor?.x??0)*.7,-3.5,3.5):0;
    cameraZ=source.reduce?targetZ:T.MathUtils.damp(cameraZ,targetZ,5,dt);cameraX=source.reduce?targetX:T.MathUtils.damp(cameraX,targetX,5,dt);
    kit.camera.position.set(cameraX,race?13:narrow?12:13,cameraZ+(race?13:narrow?10.5:16));kit.camera.lookAt(cameraX,0,cameraZ-1.3);
    for(const actor of view.actors){
      let figure=actors.get(actor.id);if(!figure){figure=character(kit,world,actor.style,source.names[actor.id],actor.characterId);figure.group.scale.setScalar(1.2);actors.set(actor.id,figure);figure.group.position.set(actor.x,actor.y,actor.z);if(id==="tilt"){const ball=kit.ball(world,PLAYER_COLORS[actor.style%6],actor.x,.46,actor.z,.46);balls.set(actor.id,ball);}}
      const respawning=view.time<actor.respawnAt;figure.group.visible=!respawning||Math.floor(view.time/120)%2===0;
      const target=new T.Vector3(actor.x,actor.y+(id==="tilt"?.92:0),actor.z);
      figure.group.position.lerp(target,source.reduce?1:1-Math.exp(-dt*22));figure.pose(actor.heading,Math.hypot(actor.vx,actor.vz),time,actor.y,view.time<actor.punchUntil,source.reduce);
      const ball=balls.get(actor.id);if(ball){ball.visible=figure.group.visible;ball.position.set(figure.group.position.x,.46,figure.group.position.z);ball.rotation.x+=actor.vz*dt;ball.rotation.z-=actor.vx*dt;}
    }
    for(const pickup of view.pickups){const mesh=pickups.get(pickup.id)!;mesh.visible=view.time>=pickup.readyAt;if(!source.reduce){mesh.rotation.y=time*.0016;mesh.position.y=pickup.y+Math.sin(time*.002+pickup.id)*.08;}}
    for(const crate of view.crates){const mesh=crates.get(crate.id)!;mesh.visible=crate.hp>0;mesh.scale.setScalar(crate.hp===1?.9:1);}
    if(id==="shock")for(let i=0;i<waves.length;i++){const phase=(view.time-700)/1000-i*3.5,radius=phase<0?-1:phase%10.5*2.7;waves[i].visible=radius>=0&&radius<6.9;waves[i].scale.setScalar(Math.max(.001,radius));}
    kit.render();host.dataset.actors=JSON.stringify(view.actors.map(a=>({id:a.id,x:Number(a.x.toFixed(2)),z:Number(a.z.toFixed(2)),y:Number(a.y.toFixed(2)),jumpAt:a.jumpAt,punchAt:a.punchAt,punch:view.time<a.punchUntil})));
    frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return {dispose:()=>{cancelAnimationFrame(frame);kit.dispose();}};
}
