import { boardWalking } from "../lib/boardMotion";
import { rollingTray, trayHeight, trayPoint, trayStation } from "./rollingTray";
import { batchScenery } from "./staticBatch";
import { partyBoard, partyPaths, rollBoard, stationAt } from "../../shared/partyBoard";
import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BOARD, type PartyGame } from "../../shared/party";
import { character, SceneKit, type Character } from "./sceneKit";
import { FIELD_VISUALS } from "../lib/partyFieldVisuals";

const BRANCH:Record<number,[number,number]>={28:[77,60],29:[67,63],30:[65,75],31:[33,69],32:[34,57],33:[24,49]};
const BOARD_SPREAD=1.18, PAWN_SCALE=2.3;
function islandPoint(id:number) {
  const field=BOARD[id],coords=BRANCH[id]??[field.x,field.y];
  const lift=id>=14&&id<=21?Math.sin((id-14)/7*Math.PI)*1.5:id>=7&&id<=13?Math.sin((id-7)/6*Math.PI)*.6:id>=31?.9:0;
  return new T.Vector3((coords[0]-50)*.27,1.22+lift,(coords[1]-50)*.25);
}
export interface BoardFrame {game:PartyGame;positions:Record<string,number>;zoom:number;angle:number;follow:boolean;selected?:number;view:number;reduce:boolean;now:number;blocked?:boolean;
  route?:number[]; insets?:{top:number;bottom:number;left?:number;right?:number}; markers?:{field:number;element:HTMLElement;height?:number}[];
}
export function createBoardWorld(host:HTMLElement,read:()=>BoardFrame,select:(id:number)=>void,onError:()=>void,onZoom:(zoom:number)=>void) {
  const kit=new SceneKit(host,onError),world=new T.Group(),figures=new T.Group();kit.scene.add(world,figures);
  // Spread the scenery and routes without stretching the approved character models.
  world.scale.set(BOARD_SPREAD,1,BOARD_SPREAD);
  const game=read().game, tray=game.mode==="roll-it-up", board=partyBoard(game);
  if(tray)host.dataset.cameraSettled="false";
  const boardPoint=(id:number)=>tray ? trayPoint(board[id]) : islandPoint(id);
  const figurePoint=(id:number)=>boardPoint(id).multiply(new T.Vector3(BOARD_SPREAD,1,BOARD_SPREAD));
  const scenery=new T.Group();world.add(scenery);
  if(tray) {rollingTray(kit,scenery,rollBoard(game));kit.renderer.shadowMap.autoUpdate=false;kit.renderer.shadowMap.needsUpdate=true;} else kit.water(world);
  const controls=new OrbitControls(kit.camera,kit.renderer.domElement);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.12;controls.minPolarAngle=.35;controls.maxPolarAngle=1.08;
  controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  const initial=read(),initialTarget=initial.follow?figurePoint(initial.positions[initial.game.order[initial.game.turn]]).add(new T.Vector3(0,1,0)):new T.Vector3(0,1,0);
  const trayAzimuth=()=>{const state=read(),point=figurePoint(state.positions[state.game.order[state.game.turn]]);return Math.atan2(point.x,point.z)+.2;};
  if(tray&&initial.follow){initialTarget.multiplyScalar(.35);initialTarget.y=1.5;}
  const initialDistance=(initial.follow?19:45)*Math.max(1,1/kit.camera.aspect)/initial.zoom;
  controls.target.copy(initialTarget);kit.camera.position.setFromSphericalCoords(initialDistance,.82,(tray?trayAzimuth():Math.PI)+initial.angle).add(initialTarget);controls.update();
  if(!tray){
    kit.cylinder(world,0x41bad0,0,.08,0,13,.35).castShadow=false;
    kit.cylinder(world,0xc7a571,0,.45,0,12.4,1.05);kit.cylinder(world,0xffe5a1,0,.95,0,12.4,.3);kit.cylinder(world,0x65ba61,0,1.11,0,10.7,.18);
    kit.ball(world,0x76c76b,-6.6,1.1,4,4.2,1.8,4.1);kit.ball(world,0x4da85a,6,1.1,3.8,3.8,.8,4.2);
  }
  // Low, narrow paths explain connections without competing with the figures.
  for(const field of board)for(const next of field.next){const a=boardPoint(field.id),b=boardPoint(next);
    if(tray){const points=Array.from({length:9},(_,i)=>{const p=a.clone().lerp(b,i/8);p.y=trayHeight(p.x,p.z)+.055;return p;});kit.mesh(scenery,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.16,5,false),0xe2c99a,0,0,0);}
    else kit.beam(world,0xc7b686,a,b,.26);
  }
  const fields:T.Object3D[]=[],symbols:T.Mesh[]=[];
  const symbolGeometry=new T.PlaneGeometry(.88,.88),symbolMaterials=new Map<string,T.MeshBasicMaterial>();
  const symbolBatches:{mesh:T.InstancedMesh;ids:number[]}[]=[],dummy=new T.Object3D();
  let bases:T.InstancedMesh|undefined,tops:T.InstancedMesh|undefined;
  if(tray){
    bases=new T.InstancedMesh(new T.CylinderGeometry(.68,.68,.14,16),kit.material(0x75563b),board.length);
    tops=new T.InstancedMesh(new T.CylinderGeometry(.62,.62,.07,16),kit.material(0xffffff),board.length);
    for(const mesh of [bases,tops]){mesh.userData.fieldIds=board.map(f=>f.id);mesh.receiveShadow=true;world.add(mesh);fields.push(mesh);}
  }
  for(const field of board){const p=boardPoint(field.id);
    const station=tray?stationAt(game,field.id):undefined;if(station) trayStation(kit,scenery,station,p);
    if(!tray && p.y>1.6)kit.cylinder(world,0xc29c69,p.x,p.y/2,p.z,.28,p.y);
    if(!tray){const tile=kit.cylinder(world,0x8d9c73,p.x,p.y+.05,p.z,.68,.1);tile.userData.field=field.id;fields.push(tile);}
    const look=FIELD_VISUALS[field.type];
    if(tray){dummy.position.set(p.x,p.y+.05,p.z);dummy.updateMatrix();bases!.setMatrixAt(field.id,dummy.matrix);dummy.position.y=p.y+.15;dummy.updateMatrix();tops!.setMatrixAt(field.id,dummy.matrix);tops!.setColorAt(field.id,new T.Color(look.color));}
    else {const top=kit.cylinder(world,Number.parseInt(look.color.slice(1),16),p.x,p.y+.13,p.z,.62,.06);top.userData.field=field.id;fields.push(top);}
    let material=symbolMaterials.get(field.type);
    if(!material){
      const canvas=document.createElement("canvas");canvas.width=canvas.height=128;const ctx=canvas.getContext("2d")!;
      ctx.fillStyle=look.ink;ctx.font="900 86px Trebuchet MS,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(look.symbol,64,67);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false});symbolMaterials.set(field.type,material);
    }
    // Symbols stay flat on the field and use depth testing, leaving the pawns clear.
    if(!tray){const icon=new T.Mesh(symbolGeometry,material);icon.rotation.x=-Math.PI/2;world.add(icon);icon.position.set(p.x,p.y+.165,p.z);icon.userData.field=field.id;fields.push(icon);symbols.push(icon);}
  }
  if(tray){for(const [type,material] of symbolMaterials){const ids=board.filter(f=>f.type===type).map(f=>f.id),mesh=new T.InstancedMesh(symbolGeometry,material,ids.length);mesh.frustumCulled=false;world.add(mesh);symbolBatches.push({mesh,ids});}batchScenery(scenery);}
  const boat=new T.Group(), trophy=new T.Group();
  if(!tray){
    // Village, volcano, harbor and jungle have distinct silhouettes and height.
    const market=new T.Group();market.position.set(.7,1.2,-1.4);world.add(market);
    kit.box(market,0xffe4aa,0,.7,0,2.5,1.4,1.7);kit.mesh(market,new T.ConeGeometry(1.9,1.25,4),0xe34f3f,0,1.95,0).rotation.y=Math.PI/4;
    kit.box(market,0x679cab,0,.58,.88,.6,1.1,.1);kit.box(market,0xffcf54,-.78,.95,.9,.55,.55,.08);kit.box(market,0xffcf54,.78,.95,.9,.55,.55,.08);
    kit.box(market,0x4f9fac,-1.27,.9,0,.08,.55,.55);kit.box(market,0x4f9fac,1.27,.9,0,.08,.55,.55);kit.box(market,0x4f9fac,0,.9,-.88,.8,.55,.08);
    const banner=kit.label(market,"Inselmarkt", "#995a2d",2.7);banner.position.set(0,2.9,0);
    const volcano=new T.Group();volcano.position.set(-2,1.2,.2);volcano.scale.setScalar(.62);world.add(volcano);
    kit.cone(volcano,0x9e8072,0,1.8,0,2.6,3.8);kit.cone(volcano,0xe97b54,0,3.1,0,1.03,1.2);kit.cylinder(volcano,0xffc74c,0,3.55,0,.65,.15);
    for(let i=0;i<3;i++)kit.ball(volcano,0xe8ead6,Math.sin(i)*.25,4.15+i*.45,0,.28+i*.09,.3+i*.05,.3+i*.05).castShadow=false;
    for(const [x,z,size] of [[5,1,1.2],[7,3,.95],[4.4,5,1.1],[-7,-4,.85],[-5,7,.8],[2.4,4,.8]] as const)kit.palm(world,x,1.3,z,size*.65);
    kit.lighthouse(world,-2.8,1.1,-7.2);
    for(let i=0;i<7;i++)kit.box(world,0xb98d56,-3.2,1,-10.8-i*.45,2,.17,.39);
    boat.position.set(-5,.22,-12.5);world.add(boat);kit.ball(boat,0xe96a52,0,.2,0,.85,.35,1.7);kit.cylinder(boat,0xfff6ce,0,1.5,0,.045,2.5);
    const sailGeometry=new T.BufferGeometry();sailGeometry.setAttribute("position",new T.Float32BufferAttribute([0,2.7,0,0,.6,0,1.2,.6,0],3));sailGeometry.computeVertexNormals();const sail=new T.Mesh(sailGeometry,new T.MeshStandardMaterial({color:0xfff8dd,side:T.DoubleSide}));boat.add(sail);
    const fair=new T.Group();fair.position.set(3.8,1.2,-4);world.add(fair);
    kit.cylinder(fair,0xffd46b,0,.2,0,1,.4);kit.cylinder(fair,0xead8a2,0,1,0,.1,2);kit.cone(fair,0xe87565,0,2,0,1.4,.7);
    for(let i=0;i<4;i++){const angle=i*Math.PI/2;kit.ball(fair,0x9bd4dc,Math.sin(angle)*.75,.7,Math.cos(angle)*.75,.3,.45,.23);}
    world.add(trophy);kit.cylinder(trophy,0xcf9631,0,.05,0,.38,.15);kit.cylinder(trophy,0xffd34d,0,.35,0,.11,.6);kit.ball(trophy,0xffd34d,0,.8,0,.5,.35,.3);
    for(const side of [-1,1]){const handle=kit.mesh(trophy,new T.TorusGeometry(.24,.065,8,14),0xffd34d,side*.43,.8,0);handle.rotation.y=0;}
    const star=kit.badge(trophy,"★","#bd831c",.85);star.position.set(0,1.5,0);
  }
  const choices=new T.Group();world.add(choices);
  const route=new T.Group();world.add(route);let lastRoute="";
  const selection=kit.mesh(world,new T.TorusGeometry(.77,.045,8,32),0xffd258,0,0,0);selection.rotation.x=Math.PI/2;selection.visible=false;
  const activeMarker=kit.mesh(figures,new T.TorusGeometry(1.02,.055,8,32),0xffd258,0,0,0);activeMarker.rotation.x=Math.PI/2;
  const pawns=new Map<string,Character>();
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),pointers=new Set<number>();let down={x:0,y:0},dragged=false;
  const onDown=(e:PointerEvent)=>{
    pointers.add(e.pointerId);
    if(pointers.size===1){down={x:e.clientX,y:e.clientY};dragged=false;}
    else dragged=true;
  };
  const onMove=(e:PointerEvent)=>{if(pointers.has(e.pointerId)&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)dragged=true;};
  const onCancel=(e:PointerEvent)=>{pointers.delete(e.pointerId);dragged=true;};
  const onUp=(e:PointerEvent)=>{pointers.delete(e.pointerId);};
  // Open on the completed tap. Opening on pointerup lets the following synthetic
  // touch click hit the new dialog's backdrop and immediately close it again.
  const onClick=(e:MouseEvent)=>{
    if(read().blocked||dragged||e.button!==0||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;
    const box=host.getBoundingClientRect();
    pointer.set((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1);
    raycaster.setFromCamera(pointer,kit.camera);
    const pawnHit=raycaster.intersectObjects([...pawns.values()].map(p=>p.group),true).find(hit=>!(hit.object instanceof T.Sprite));
    if(pawnHit){
      let object:T.Object3D|null=pawnHit.object;
      while(object&&object.userData.field===undefined)object=object.parent;
      if(object){select(object.userData.field);return;}
    }
    const hit=raycaster.intersectObjects(fields,false)[0];
    if(hit)select(hit.instanceId===undefined?hit.object.userData.field:hit.object.userData.fieldIds[hit.instanceId]);
  };
  kit.renderer.domElement.addEventListener("pointerdown",onDown);kit.renderer.domElement.addEventListener("pointerup",onUp);kit.renderer.domElement.addEventListener("click",onClick);
  kit.renderer.domElement.addEventListener("pointermove",onMove);kit.renderer.domElement.addEventListener("pointercancel",onCancel);
  let frame=0,last=performance.now(),lastZoom=-1,lastAngle=initial.angle,lastChoices="",lastFollow=initial.follow,lastView=initial.view,lastAspect=0,wantedDistance=19,baseDistance=19,zooming=false;
  let clockNow=initial.now,clockAt=last;
  let lastTick=0,lastVisual="",lastInsets="",lastTurn=game.order[game.turn],lastSymbols=NaN;
  const heldFocus=initialTarget.clone();
  const oldCamera=new T.Vector3(),oldQuaternion=new T.Quaternion();let forcePaint=true;
  const invalidate=()=>{forcePaint=true;};controls.addEventListener("change",invalidate);
  // Resizing a canvas clears its pixels even if the camera has already settled.
  const resizeObserver=new ResizeObserver(invalidate);resizeObserver.observe(host);
  document.addEventListener("visibilitychange",invalidate);
  const startCamera=()=>{zooming=false;};controls.addEventListener("start",startCamera);
  const endZoom=()=>{if(!zooming)onZoom(T.MathUtils.clamp(Number((baseDistance/controls.getDistance()).toFixed(2)),1,2.5));};controls.addEventListener("end",endZoom);
  const animate=(time:number)=>{
    if(tray&&(document.hidden||time-lastTick<1000/30)){frame=requestAnimationFrame(animate);return;}
    lastTick=tray?time-(time-lastTick)%(1000/30):time;
    // Camera easing uses elapsed time, including slow full-screen WebGL frames.
    const dt=Math.min(.25,(time-last)/1000);last=time;if(document.body.dataset.partyPractice){frame=requestAnimationFrame(animate);return;}const state=read(),g=state.game;
    if(state.now!==clockNow){clockNow=state.now;clockAt=time;}
    const visualNow=g.pausedAt?state.now:state.now+Math.min(100,Math.max(0,time-clockAt));
    const movement=g.movement,progress=movement?T.MathUtils.clamp((visualNow-movement.departAt)/(movement.arriveAt-movement.departAt),0,1):0;
    controls.enabled=!state.blocked;
    const active=g.players.find(p=>p.id===g.order[g.turn])!;
    const focus=state.follow?figurePoint(state.positions[active.id]??active.position).add(new T.Vector3(0,1,0)):new T.Vector3(0,1,0),oldTarget=controls.target.clone();
    if(!tray&&state.follow&&movement)focus.lerp(figurePoint(movement.destination).add(new T.Vector3(0,1,0)),state.reduce?1:progress);
    if(tray&&state.follow){focus.multiplyScalar(.35);focus.y=1.5;}
    if(tray){if(state.view!==lastView||active.id!==lastTurn||state.follow!==lastFollow)heldFocus.copy(focus);focus.copy(heldFocus);}
    const insets=state.insets??{top:0,bottom:0};
    // Camera framing is independent of transient panels. Only viewport changes reframe it.
    const cameraInsets=tray?(host.clientWidth>host.clientHeight&&host.clientHeight<=500?{top:160,bottom:8,left:0,right:Math.min(340,host.clientWidth*.46)+16}:{top:host.clientHeight<=670?150:170,bottom:host.clientHeight<=670?180:200,left:0,right:0}):insets;
    const insetKey=`${cameraInsets.top}/${cameraInsets.bottom}/${cameraInsets.left}/${cameraInsets.right}/${host.clientWidth}/${host.clientHeight}`;
    const insetChanged=tray&&insetKey!==lastInsets;
    if(insetChanged){const w=host.clientWidth,h=host.clientHeight;kit.camera.setViewOffset(w,h,((cameraInsets.right??0)-(cameraInsets.left??0))/2,(cameraInsets.bottom-cameraInsets.top)/2,w,h);lastInsets=insetKey;forcePaint=true;}
    controls.target.lerp(focus,state.reduce?1:1-Math.exp(-dt*5));kit.camera.position.add(controls.target.clone().sub(oldTarget));
    if(state.view!==lastView||(tray&&active.id!==lastTurn)){kit.camera.position.setFromSphericalCoords(controls.getDistance(),.82,(tray?(state.follow?trayAzimuth():Math.PI):Math.PI)+state.angle).add(controls.target);lastAngle=state.angle;lastView=state.view;lastTurn=active.id;}
    if(state.zoom!==lastZoom||state.follow!==lastFollow||kit.camera.aspect!==lastAspect||insetChanged){
      const available=Math.max(.15,(host.clientHeight-cameraInsets.top-cameraInsets.bottom)/host.clientHeight);
      const availableWidth=Math.max(.15,(host.clientWidth-(cameraInsets.left??0)-(cameraInsets.right??0))/host.clientHeight);
      baseDistance=tray?(state.follow?10.5:17)/(Math.tan(kit.camera.fov*Math.PI/360)*Math.min(availableWidth,available)):(state.follow?19:45)*Math.max(1,1/kit.camera.aspect);
      controls.minDistance=baseDistance/2.5;controls.maxDistance=baseDistance;wantedDistance=baseDistance/state.zoom;zooming=true;lastZoom=state.zoom;lastFollow=state.follow;lastAspect=kit.camera.aspect;
    }
    if(zooming){const distance=kit.camera.position.distanceTo(controls.target),next=state.reduce?wantedDistance:T.MathUtils.damp(distance,wantedDistance,8,dt);kit.camera.position.sub(controls.target).multiplyScalar(next/distance).add(controls.target);if(Math.abs(next-wantedDistance)<.02)zooming=false;}
    if(state.angle!==lastAngle){kit.camera.position.sub(controls.target).applyAxisAngle(new T.Vector3(0,1,0),state.angle-lastAngle).add(controls.target);lastAngle=state.angle;}
    controls.enableDamping=!state.reduce&&!state.blocked;controls.update();
    const routeKey=state.route?.join()??"";
    const visual=tray?`${g.phaseId}/${g.pausedAt}/${state.view}/${state.selected}/${insets.top}/${insets.bottom}/${insets.left}/${insets.right}/${routeKey}/${g.players.map(p=>`${p.id}:${p.position}`).join()}/${state.reduce}/${state.markers?.map(m=>m.field).join()}`:"";
    const cameraChanged=oldCamera.distanceToSquared(kit.camera.position)>.000001||1-Math.abs(oldQuaternion.dot(kit.camera.quaternion))>.000001;
    if(tray)host.dataset.cameraSettled=String(!zooming&&!cameraChanged&&controls.target.distanceToSquared(focus)<.0001);
    // Keep a light clock/camera check, but skip posing figures, shadows and rendering at rest.
    if(tray&&!forcePaint&&!cameraChanged&&visual===lastVisual&&!(movement&&!g.pausedAt&&!state.reduce)) {frame=requestAnimationFrame(animate);return;}
    if(!tray){const at=boardPoint(g.trophyField);trophy.position.set(at.x+.95,at.y+.18,at.z);trophy.rotation.y=0;}
    selection.visible=state.selected!==undefined;if(state.selected!==undefined){const at=boardPoint(state.selected);selection.position.set(at.x,at.y+.18,at.z);}
    const choiceIds=g.phase==="path"?partyPaths(g,active):[],choiceKey=choiceIds.join();
    if(choiceKey!==lastChoices){choices.traverse(object=>{const mesh=object as T.Mesh;mesh.geometry?.dispose();});choices.clear();for(const id of choiceIds){const p=boardPoint(id);const marker=kit.mesh(choices,new T.TorusGeometry(.77,.065,8,28),0xffd258,p.x,p.y+.18,p.z);marker.rotation.x=Math.PI/2;}lastChoices=choiceKey;}
    if(tray&&routeKey!==lastRoute){route.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});route.clear();
      const ids=state.route??[];
      for(let i=1;i<ids.length;i++){const a=boardPoint(ids[i-1]),b=boardPoint(ids[i]),points=Array.from({length:9},(_,n)=>{const p=a.clone().lerp(b,n/8);p.y=trayHeight(p.x,p.z)+.27;return p;});kit.mesh(route,new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.10,5,false),0xffd777,0,0,0).castShadow=false;}
      lastRoute=routeKey;
    }
    const standingPoint=(playerId:string,fieldId:number)=>{
      const point=figurePoint(fieldId);
      const occupants=g.players.filter(player=>player.id===playerId||(state.positions[player.id]??player.position)===fieldId);
      const slot=occupants.findIndex(player=>player.id===playerId);
      point.y+=.17;
      if(occupants.length>1){
        const columns=Math.min(3,occupants.length);
        const offset=new T.Vector3((slot%columns-(columns-1)/2)*1.6,0,(Math.floor(slot/columns)-(Math.ceil(occupants.length/columns)-1)/2)*2.8);
        const radius=Math.hypot(point.x,point.z),inset=tray?1.4:.65;
        if(radius>10){point.x-=point.x/radius*inset;point.z-=point.z/radius*inset;}
        point.add(offset.applyAxisAngle(new T.Vector3(0,1,0),controls.getAzimuthalAngle()));
      }
      if(tray)point.y=trayHeight(point.x/BOARD_SPREAD,point.z/BOARD_SPREAD)+.23;
      return point;
    };
    const motion:Record<string,{walking:boolean;position:number[];stride:number;heading:number}>={};
    for(const [index,player] of g.players.entries()){
      let pawn=pawns.get(player.id);if(!pawn){pawn=character(kit,figures,index,undefined,player.characterId);pawn.group.scale.setScalar(PAWN_SCALE);pawns.set(player.id,pawn);pawn.group.position.copy(figurePoint(state.positions[player.id]??player.position));}
      const point=standingPoint(player.id,state.positions[player.id]??player.position);
      let speed=0,heading=controls.getAzimuthalAngle();
      const walking=player.id===active.id&&boardWalking(movement,visualNow,Boolean(g.pausedAt),state.reduce);
      if(player.id===active.id&&movement){
        const destination=standingPoint(player.id,movement.destination),direction=destination.clone().sub(point);
        // Animation speed comes from the authoritative segment, never from camera or network-frame deltas.
        heading=Math.atan2(direction.x,direction.z);
        if(walking)speed=Math.min(4.8,direction.length()*1000/(movement.arriveAt-movement.departAt));
        point.lerp(destination,state.reduce?1:progress);
        // Follow the curved hillside between fields, not a line through its mesh.
        if(tray)point.y=trayHeight(point.x/BOARD_SPREAD,point.z/BOARD_SPREAD)+.23;
      }
      pawn.group.userData.field=state.positions[player.id]??player.position;
      if(player.id===active.id)activeMarker.position.copy(point).add(new T.Vector3(0,.03,0));
      pawn.group.position.copy(point);
      pawn.pose(walking?heading:controls.getAzimuthalAngle(),speed,time,0,false,state.reduce||(tray&&!walking));
      motion[player.id]={walking,position:point.toArray().map(n=>Number(n.toFixed(3))),stride:Number((pawn.group.userData.stride??0).toFixed(3)),heading:Number(pawn.group.rotation.y.toFixed(3))};
    }
    if(!state.reduce)boat.rotation.z=Math.sin(time*.0007)*.035;
    for(const symbol of symbols)symbol.rotation.z=controls.getAzimuthalAngle();
    if(tray&&(Math.abs(lastSymbols-controls.getAzimuthalAngle())>.0001||Number.isNaN(lastSymbols))){
      for(const {mesh,ids} of symbolBatches){ids.forEach((id,index)=>{dummy.position.copy(boardPoint(id));dummy.position.y+=.195;dummy.rotation.set(-Math.PI/2,0,controls.getAzimuthalAngle());dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;}lastSymbols=controls.getAzimuthalAngle();
    }
    if(!tray||forcePaint||cameraChanged||visual!==lastVisual||Boolean(movement&&!g.pausedAt&&!state.reduce)){
      if(tray){kit.renderer.shadowMap.needsUpdate=Boolean(movement)||cameraChanged||visual!==lastVisual;}
      kit.render(tray?1000/30:16.7);forcePaint=false;lastVisual=visual;oldCamera.copy(kit.camera.position);oldQuaternion.copy(kit.camera.quaternion);
      host.dataset.motion=JSON.stringify(motion);host.dataset.camera=JSON.stringify(kit.camera.position.toArray().map(n=>Number(n.toFixed(2))));
      for(const marker of state.markers??[]){const at=figurePoint(marker.field);at.y+=marker.height??2;at.project(kit.camera);const x=(at.x+1)*host.clientWidth/2,y=(1-at.y)*host.clientHeight/2;const visible=at.z<1&&x>(insets.left??0)+35&&x<host.clientWidth-(insets.right??0)-35&&y>insets.top+12&&y<host.clientHeight-insets.bottom-8;marker.element.style.visibility=visible?"visible":"hidden";marker.element.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;}
    }
    frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
  return {dispose:()=>{cancelAnimationFrame(frame);resizeObserver.disconnect();document.removeEventListener("visibilitychange",invalidate);controls.removeEventListener("change",invalidate);controls.removeEventListener("start",startCamera);controls.removeEventListener("end",endZoom);controls.dispose();kit.renderer.domElement.removeEventListener("pointerdown",onDown);kit.renderer.domElement.removeEventListener("pointerup",onUp);kit.renderer.domElement.removeEventListener("click",onClick);kit.renderer.domElement.removeEventListener("pointermove",onMove);kit.renderer.domElement.removeEventListener("pointercancel",onCancel);kit.dispose();}};
}
