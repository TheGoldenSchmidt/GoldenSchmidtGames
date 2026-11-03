import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BOARD, FIELD_ICONS, type PartyGame } from "../../shared/party";
import { character, SceneKit, type Character } from "./sceneKit";

const BRANCH:Record<number,[number,number]>={28:[77,60],29:[67,63],30:[65,75],31:[33,69],32:[34,57],33:[24,49]};
const COLORS={start:0xfff0ad,coin:0x77d7a1,bad:0xf38d79,event:0xb299e5,gift:0xffd258,shop:0x70d3e5,safe:0xf5e9bc};
export function boardPoint(id:number) {
  const field=BOARD[id],coords=BRANCH[id]??[field.x,field.y];
  const lift=id>=14&&id<=21?Math.sin((id-14)/7*Math.PI)*1.5:id>=7&&id<=13?Math.sin((id-7)/6*Math.PI)*.6:id>=31?.9:0;
  return new T.Vector3((coords[0]-50)*.27,1.22+lift,(coords[1]-50)*.25);
}
export interface BoardFrame {game:PartyGame;positions:Record<string,number>;zoom:number;angle:number;follow:boolean;reduce:boolean}
export function createBoardWorld(host:HTMLElement,read:()=>BoardFrame,select:(id:number)=>void,onError:()=>void) {
  const kit=new SceneKit(host,onError),world=new T.Group();kit.scene.add(world);kit.water(world);
  const controls=new OrbitControls(kit.camera,kit.renderer.domElement);controls.target.set(0,1.2,0);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.12;controls.minPolarAngle=.3;controls.maxPolarAngle=1.18;controls.minDistance=17;controls.maxDistance=46;
  kit.camera.position.set(17,31,27);controls.target.y=.3;controls.update();
  kit.cylinder(world,0x41bad0,0,.08,0,13,.35).castShadow=false;
  kit.cylinder(world,0xc7a571,0,.45,0,12.4,1.05);kit.cylinder(world,0xffe5a1,0,.95,0,12.4,.3);kit.cylinder(world,0x65ba61,0,1.11,0,10.7,.18);
  kit.ball(world,0x76c76b,-6.6,1.1,4,4.2,1.8,4.1);kit.ball(world,0x4da85a,6,1.1,3.8,3.8,.8,4.2);
  // A real raised route, with supports and slopes between all board fields.
  for(const field of BOARD)for(const next of field.next){const a=boardPoint(field.id),b=boardPoint(next);kit.beam(world,0xe6c58c,a,b,.65);}
  const fields:T.Object3D[]=[];
  for(const field of BOARD){const p=boardPoint(field.id);
    if(p.y>1.6)kit.cylinder(world,0xc29c69,p.x,p.y/2,p.z,.28,p.y);
    const tile=kit.cylinder(world,0xfffbdf,p.x,p.y+.02,p.z,.71,.22);tile.userData.field=field.id;fields.push(tile);
    const top=kit.cylinder(world,COLORS[field.type],p.x,p.y+.16,p.z,.6,.13);top.userData.field=field.id;fields.push(top);
    const icon=kit.badge(world,FIELD_ICONS[field.type],"#10485b",.8);icon.position.set(p.x,p.y+.72,p.z);icon.userData.field=field.id;fields.push(icon);
  }
  // Village, volcano, harbor and jungle have distinct silhouettes and height.
  const market=new T.Group();market.position.set(.7,1.2,-1.4);world.add(market);
  kit.box(market,0xffe4aa,0,.7,0,2.5,1.4,1.7);kit.mesh(market,new T.ConeGeometry(1.9,1.25,4),0xe34f3f,0,1.95,0).rotation.y=Math.PI/4;
  kit.box(market,0x679cab,0,.58,.88,.6,1.1,.1);kit.box(market,0xffcf54,-.78,.95,.9,.55,.55,.08);kit.box(market,0xffcf54,.78,.95,.9,.55,.55,.08);
  kit.box(market,0x4f9fac,-1.27,.9,0,.08,.55,.55);kit.box(market,0x4f9fac,1.27,.9,0,.08,.55,.55);kit.box(market,0x4f9fac,0,.9,-.88,.8,.55,.08);
  const banner=kit.label(market,"Inselmarkt", "#995a2d",2.7);banner.position.set(0,2.9,0);
  const volcano=new T.Group();volcano.position.set(-4,1.3,-.4);world.add(volcano);
  kit.cone(volcano,0x9e8072,0,1.8,0,2.6,3.8);kit.cone(volcano,0xe97b54,0,3.1,0,1.03,1.2);kit.cylinder(volcano,0xffc74c,0,3.55,0,.65,.15);
  for(let i=0;i<3;i++)kit.ball(volcano,0xe8ead6,Math.sin(i)*.25,4.15+i*.45,0,.28+i*.09,.3+i*.05,.3+i*.05).castShadow=false;
  for(const [x,z,size] of [[5,1,1.2],[7,3,.95],[4.4,5,1.1],[-7,-4,.85],[-5,7,.8],[2.4,4,.8]] as const)kit.palm(world,x,1.3,z,size);
  kit.lighthouse(world,0,1.1,-7.2);
  for(let i=0;i<7;i++)kit.box(world,0xb98d56,-3.2,1,-10.8-i*.45,2,.17,.39);
  const boat=new T.Group();boat.position.set(-5,.22,-12.5);world.add(boat);kit.ball(boat,0xe96a52,0,.2,0,.85,.35,1.7);kit.cylinder(boat,0xfff6ce,0,1.5,0,.045,2.5);
  const sailGeometry=new T.BufferGeometry();sailGeometry.setAttribute("position",new T.Float32BufferAttribute([0,2.7,0,0,.6,0,1.2,.6,0],3));sailGeometry.computeVertexNormals();const sail=new T.Mesh(sailGeometry,new T.MeshStandardMaterial({color:0xfff8dd,side:T.DoubleSide}));boat.add(sail);
  const fair=new T.Group();fair.position.set(3.8,1.2,-4);world.add(fair);
  kit.cylinder(fair,0xffd46b,0,.2,0,1,.4);kit.cylinder(fair,0xead8a2,0,1,0,.1,2);kit.cone(fair,0xe87565,0,2,0,1.4,.7);
  for(let i=0;i<4;i++){const angle=i*Math.PI/2;kit.ball(fair,0x9bd4dc,Math.sin(angle)*.75,.7,Math.cos(angle)*.75,.3,.45,.23);}
  const trophy=new T.Group();world.add(trophy);kit.cylinder(trophy,0xcf9631,0,.05,0,.38,.15);kit.cylinder(trophy,0xffd34d,0,.35,0,.11,.6);kit.ball(trophy,0xffd34d,0,.8,0,.5,.35,.3);
  for(const side of [-1,1]){const handle=kit.mesh(trophy,new T.TorusGeometry(.24,.065,8,14),0xffd34d,side*.43,.8,0);handle.rotation.y=0;}
  const star=kit.badge(trophy,"★","#bd831c",.85);star.position.set(0,1.5,0);
  const choices=new T.Group();world.add(choices);
  const pawns=new Map<string,Character>(),destinations=new Map<string,T.Vector3>();
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();let down={x:0,y:0};
  const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const onClick=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;const box=host.getBoundingClientRect();pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);raycaster.setFromCamera(pointer,kit.camera);const hit=raycaster.intersectObjects(fields,false)[0];if(hit)select(hit.object.userData.field);};
  kit.renderer.domElement.addEventListener("pointerdown",onDown);kit.renderer.domElement.addEventListener("pointerup",onClick);
  let frame=0,last=performance.now(),lastZoom=-1,lastAngle=0,lastChoices="",lastFollow=false,wantedDistance=37,zooming=false;
  const animate=(time:number)=>{
    const dt=Math.min(.05,(time-last)/1000);last=time;if(document.body.dataset.partyPractice){frame=requestAnimationFrame(animate);return;}const state=read(),g=state.game;
    const active=g.players.find(p=>p.id===g.order[g.turn])!,focus=state.follow?boardPoint(state.positions[active.id]??active.position).add(new T.Vector3(0,.5,0)):new T.Vector3(0,.3,0),oldTarget=controls.target.clone();
    controls.target.lerp(focus,state.reduce?1:1-Math.exp(-dt*5));kit.camera.position.add(controls.target.clone().sub(oldTarget));
    if(state.zoom!==lastZoom||state.follow!==lastFollow){wantedDistance=Math.max(17,(state.follow?19:37)/state.zoom);zooming=true;lastZoom=state.zoom;lastFollow=state.follow;}
    if(zooming){const distance=kit.camera.position.distanceTo(controls.target),next=state.reduce?wantedDistance:T.MathUtils.damp(distance,wantedDistance,8,dt);kit.camera.position.sub(controls.target).multiplyScalar(next/distance).add(controls.target);if(Math.abs(next-wantedDistance)<.02)zooming=false;}
    if(state.angle!==lastAngle){kit.camera.position.sub(controls.target).applyAxisAngle(new T.Vector3(0,1,0),state.angle-lastAngle).add(controls.target);lastAngle=state.angle;}
    const at=boardPoint(g.trophyField);trophy.position.set(at.x,at.y+.6,at.z);trophy.rotation.y=state.reduce?0:time*.0005;
    const choiceIds=g.phase==="path"?BOARD[g.players.find(p=>p.id===g.order[g.turn])!.position].next:[],choiceKey=choiceIds.join();
    if(choiceKey!==lastChoices){choices.traverse(object=>{const mesh=object as T.Mesh;mesh.geometry?.dispose();});choices.clear();for(const id of choiceIds){const p=boardPoint(id);const marker=kit.mesh(choices,new T.TorusGeometry(.83,.08,8,28),0xfff6bf,p.x,p.y+.25,p.z);marker.rotation.x=Math.PI/2;}lastChoices=choiceKey;}
    for(const [index,player] of g.players.entries()){
      let pawn=pawns.get(player.id);if(!pawn){pawn=character(kit,world,index,player.name);pawn.group.scale.setScalar(1.6);pawns.set(player.id,pawn);pawn.group.position.copy(boardPoint(state.positions[player.id]??player.position));}
      const point=boardPoint(state.positions[player.id]??player.position),others=g.players.filter(p=>(state.positions[p.id]??p.position)===(state.positions[player.id]??player.position)),slot=others.findIndex(p=>p.id===player.id);
      point.y+=.28;if(others.length>1){point.x+=(slot%3-1)*.72;point.z+=Math.floor(slot/3)*.7;}
      const old=pawn.group.position.clone(),delta=point.clone().sub(old),heading=Math.atan2(delta.x,delta.z),speed=delta.length()/Math.max(.01,dt);
      pawn.group.position.lerp(point,state.reduce?1:1-Math.exp(-dt*18));
      const prior=destinations.get(player.id);pawn.pose(delta.length()>.03?heading:prior?.x??Math.PI,Math.min(4.8,speed),time,0,false,state.reduce);if(delta.length()>.03)destinations.set(player.id,new T.Vector3(heading,0,0));
    }
    if(!state.reduce)boat.rotation.z=Math.sin(time*.0007)*.035;
    controls.enableDamping=!state.reduce;controls.update();kit.render();host.dataset.camera=JSON.stringify(kit.camera.position.toArray().map(n=>Number(n.toFixed(2))));frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return {dispose:()=>{cancelAnimationFrame(frame);controls.dispose();kit.renderer.domElement.removeEventListener("pointerdown",onDown);kit.renderer.domElement.removeEventListener("pointerup",onClick);kit.dispose();}};
}
