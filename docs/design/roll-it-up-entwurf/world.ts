// Art-direction prototype only. The live game does not import this scene.
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { partyBoard, STATIONS, stationAt } from "../../../shared/partyBoard";
import { FIELD_VISUALS } from "../../../src/lib/partyFieldVisuals";
import { preloadFigures } from "../../../src/figures/catalog";
import { figureCharacter } from "../../../src/figures/character";

const W=780,H=1400,scene=new T.Scene();
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
document.body.append(renderer.domElement);
const sky=document.createElement("canvas");sky.width=2;sky.height=1024;
const sc=sky.getContext("2d")!,gradient=sc.createLinearGradient(0,0,0,1024);
gradient.addColorStop(0,"#4a47a6");gradient.addColorStop(.37,"#7f9be8");
gradient.addColorStop(.67,"#d9b8ee");gradient.addColorStop(1,"#4a47a6");
sc.fillStyle=gradient;sc.fillRect(0,0,2,1024);
const skyTexture=new T.CanvasTexture(sky);skyTexture.colorSpace=T.SRGBColorSpace;scene.background=skyTexture;
scene.add(new T.HemisphereLight(0xe4edff,0x56603e,1.8));
const sun=new T.DirectionalLight(0xffe4af,3.1);sun.position.set(-18,32,15);sun.castShadow=true;
sun.shadow.mapSize.set(4096,4096);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:85});
sun.shadow.bias=-.00012;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun);
const rim=new T.DirectionalLight(0xc3d9ff,2.1);rim.position.set(8,12,-18);scene.add(rim);
const camera=new T.PerspectiveCamera(35,W/H,.1,200);
const world=new T.Group();scene.add(world);
const materials=new Map<string,T.MeshStandardMaterial>();
function mat(color:T.ColorRepresentation,metal=0){const key=`${color}/${metal}`;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:metal?.32:.85,metalness:metal}));return materials.get(key)!;}
function mesh(parent:T.Object3D,g:T.BufferGeometry,color:T.ColorRepresentation,x=0,y=0,z=0,metal=0){const o=new T.Mesh(g,mat(color,metal));o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
function box(p:T.Object3D,c:T.ColorRepresentation,x:number,y:number,z:number,w:number,h:number,d:number,round=.05){return mesh(p,new RoundedBoxGeometry(w,h,d,2,round),c,x,y,z);}
function cyl(p:T.Object3D,c:T.ColorRepresentation,x:number,y:number,z:number,r:number,h:number,metal=0){return mesh(p,new T.CylinderGeometry(r,r,h,48),c,x,y,z,metal);}
function ring(p:T.Object3D,c:T.ColorRepresentation,x:number,y:number,z:number,r:number,t:number,metal=0){const o=mesh(p,new T.TorusGeometry(r,t,10,96),c,x,y,z,metal);o.rotation.x=-Math.PI/2;return o;}
let seed=17026;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function rock(p:T.Object3D,x:number,y:number,z:number,r:number,c:T.ColorRepresentation){const m=mesh(p,new T.IcosahedronGeometry(r,0),c,x,y,z);m.scale.set(1,.65+.3*random(),.8+random()*.4);m.rotation.set(random(),random(),random());return m;}
function tree(x:number,z:number,s:number){const g=new T.Group();g.position.set(x,1.05,z);g.scale.setScalar(s);world.add(g);cyl(g,0x80543b,0,.55,0,.13,1.1);for(let i=0;i<3;i++)mesh(g,new T.ConeGeometry(.8-i*.16,1.25,7),[0x2f7a2e,0x579c38,0x83b944][i],0,1+i*.47,0);}

// Shallow enamel vessel, brass rolled lip, and warm clay inner surface.
cyl(world,0x194d49,0,-.25,0,12.7,.8);
cyl(world,0xce8057,0,.18,0,12.3,.48);
const profile=[[12.1,.39],[12.4,.52],[12.75,1.1],[13.07,1.22],[13.22,1.08],[13.08,.7],[12.8,-.65],[12.4,-.78]].map(([x,y])=>new T.Vector2(x,y));
const enamel=mesh(world,new T.LatheGeometry(profile,128),0x23685e,0,0,0,.28);(enamel.material as T.MeshStandardMaterial).side=T.DoubleSide;
ring(world,0xdfab61,0,1.18,0,13.07,.11,.72);
ring(world,0xf1c77c,0,.55,0,12.39,.035,.5);
ring(world,0x173f3c,0,-.6,0,12.77,.07);
// Thin radial inlays reinforce a handmade bowl rather than an abstract platform.
for(let i=0;i<64;i++){const a=i*Math.PI/32;const m=box(world,0xc39455,Math.cos(a)*13.05,.67,Math.sin(a)*13.05,.05,.26,.035,.01);m.rotation.y=-a;}

// Terraced meadow. Board links and field IDs come from the real shared graph.
function hillY(x:number,z:number){return .44+3.15*Math.pow(Math.max(0,1-(x*x+z*z)/25),.65);}
const hill=new T.SphereGeometry(5,32,12,0,Math.PI*2,0,Math.PI/2);hill.scale(1,.63,1);
mesh(world,hill,0x6fbf35,0,.44,0);mat(0x6fbf35).flatShading=true;
for(let i=0;i<30;i++){const a=i*Math.PI/15,r=4.6+random()*.5;rock(world,Math.cos(a)*r,.55,Math.sin(a)*r,.35+random()*.4,[0xa7a780,0x8f8e68,0xb1ad84][i%3]);}
// Meadow islands flank stations without covering the playable tiles.
for(const s of STATIONS){const f=partyBoard({mode:"roll-it-up"})[s.field];const x=(f.x-50)*.27*.76,z=(f.y-50)*.27*.76;
const patch=mesh(world,new T.CylinderGeometry(1.85,2,.18,9),0x7eaa43,x,.46,z);patch.rotation.y=.4;
for(let i=0;i<5;i++){const a=i*1.3;rock(world,x+Math.cos(a)*1.75,.52,z+Math.sin(a)*1.75,.2,0xbfa37d);}}
const board=partyBoard({mode:"roll-it-up"});
const point=(id:number)=>{const f=board[id],x=(f.x-50)*.27,z=(f.y-50)*.27;return new T.Vector3(x,hillY(x,z)+.06,z);};
function path(ids:number[],color:T.ColorRepresentation,width:number,y=.02){const pts=ids.map(id=>point(id).add(new T.Vector3(0,y,0)));const curve=new T.CatmullRomCurve3(pts);return mesh(world,new T.TubeGeometry(curve,48,width,6,false),color);}
for(const f of board)for(const next of f.next){const a=point(f.id),b=point(next),pts=[];for(let i=0;i<=12;i++){const p=a.clone().lerp(b,i/12);p.y=hillY(p.x,p.z)+.055;pts.push(p);}mesh(world,new T.TubeGeometry(new T.CatmullRomCurve3(pts),20,.20,6,false),0xe2c99a);}
const routeA=path([8,9,10,11,12],0xffd777,.09,.24);const routeB=path([8,30,31,12,13],0xdcaefc,.09,.24);routeA.visible=routeB.visible=false;

const symbols=new Map<string,T.CanvasTexture>();
function symbolTexture(symbol:string,color:string){const key=symbol+color;if(symbols.has(key))return symbols.get(key)!;const c=document.createElement("canvas");c.width=c.height=128;const ctx=c.getContext("2d")!;ctx.fillStyle=color;ctx.font="bold 88px Arial";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(symbol,64,67);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;symbols.set(key,t);return t;}
for(const f of board){const p=point(f.id),look=FIELD_VISUALS[f.type],station=stationAt(f.id);
  cyl(world,0x75563b,p.x,p.y+.02,p.z,.65,.17);
  const top=cyl(world,station?0xf2d79e:look.color,p.x,p.y+.14,p.z,.58,.12);
  ring(world,station?0xc09b51:0xe8ce98,p.x,p.y+.205,p.z,.52,.025,.2);
  const icon=new T.Mesh(new T.PlaneGeometry(.65,.65),new T.MeshBasicMaterial({map:symbolTexture(station?"◆":look.symbol,station?"#4d3b20":look.ink),transparent:true,depthWrite:false}));icon.rotation.x=-Math.PI/2;icon.position.set(p.x,p.y+.21,p.z);world.add(icon);top.userData.field=f.id;
}

// The summit bench is the single landmark; lanterns mark its two entrances.
const bench=new T.Group();world.add(bench);bench.position.set(0,3.59,-.7);
for(const x of [-.9,.9]){for(const z of [-.3,.3])box(bench,0x293e3a,x,.35,z,.13,.7,.14);box(bench,0x293e3a,x,.93,-.35,.14,1.4,.14);}
for(const z of [-.3,0,.3])box(bench,0xe8ac62,0,.72,z,2.7,.15,.24);
for(const y of [1.08,1.42])box(bench,0xd18c4d,0,y,-.34,2.7,.24,.13);
for(const x of [-.9,.9])for(const y of [1.08,1.42]){const nail=mesh(bench,new T.SphereGeometry(.035,8,8),0xe6c377,x,y,-.25,.6);}
for(const x of [-2,2]){const y=hillY(x,0);cyl(world,0x5d4639,x,y+.62,0,.06,1.15);box(world,0x302e39,x,y+1.25,0,.35,.45,.35);box(world,0xffd777,x,y+1.26,.185,.22,.28,.015);mesh(world,new T.ConeGeometry(.31,.25,4),0x537657,x,y+1.59,0);}
tree(-3.1,-2.8,1.15);tree(-4.1,-1.8,.85);tree(2.5,-3.8,1.05);tree(4,-3.1,.65);

// Six recognisable collectible sculptures, with no permanent floating text.
for(const station of STATIONS){const p=point(station.field),g=new T.Group();g.position.set(p.x*.76,.65,p.z*.76);g.rotation.y=Math.atan2(p.x,p.z);world.add(g);
  cyl(g,0xe5cb97,0,.04,0,1.12,.22);ring(g,0xb88a42,0,.17,0,1.03,.03,.4);
  if(station.name==="Grinder"){
    cyl(g,0x2d5d59,0,.66,0,.79,1.12,.3);for(const y of [.19,.57,1.15])ring(g,0xdfab61,0,y,0,.8,.045,.6);
    cyl(g,0x286a5c,0,1.28,0,.81,.15,.4);for(let i=0;i<22;i++){const a=i*Math.PI/11;box(g,0x9f7f48,Math.sin(a)*.8,.9,Math.cos(a)*.8,.04,.34,.04,.01);}
    ring(g,0xdfab61,0,1.36,0,.52,.025,.5);
  }else if(station.name==="Pape"){
    box(g,0x23685e,0,.25,0,1.9,.24,1.08);box(g,0xe5c98f,0,.39,0,1.74,.08,.94);
    const paper=box(g,0xfff8ea,0,.82,-.29,1.73,.045,1.02);paper.rotation.x=-.68;
    box(g,0xdfab61,0,.42,.34,1.3,.03,.12);
  }else if(station.name==="Filter"){
    const packet=box(g,0xc28c55,0,.38,0,1.7,.45,1.05);packet.rotation.y=.15;
    for(let i=0;i<5;i++){const filter=cyl(g,0xffe7b0,-.6+i*.28,.75,.02,.12,1.1);filter.rotation.x=Math.PI/2;}
  }else{
    cyl(g,0x31584b,0,.3,0,.76,.27);ring(g,0xd7b06c,0,.45,0,.72,.045,.6);
    for(let i=0;i<12;i++){const a=i*2.4,r=.4*Math.sqrt(random()),y=.7+(i%4)*.22;const bud=mesh(g,new T.IcosahedronGeometry(.39,1),[0x527448,0x789946,0x9caa5b][i%3],Math.sin(a)*r,y,Math.cos(a)*r);bud.scale.y=1.2;}
    for(let i=0;i<7;i++){const a=i*.9;mesh(g,new T.IcosahedronGeometry(.055,0),0xdda253,Math.sin(a)*.4,.8+i*.09,Math.cos(a)*.4);}
  }
}
// Small vegetation and rocks establish scale; keep the outer route unobstructed.
for(let i=0;i<95;i++){const a=random()*Math.PI*2,r=5.8+random()*2.9,x=Math.cos(a)*r,z=Math.sin(a)*r;if(board.some(f=>Math.hypot((f.x-50)*.27-x,(f.y-50)*.27-z)<1.15))continue;
  if(i%3===0)rock(world,x,.54,z,.12+random()*.18,0xc9ad83);else{const g=new T.Group();world.add(g);g.position.set(x,.48,z);for(let j=0;j<3;j++){const blade=mesh(g,new T.ConeGeometry(.055,.24+random()*.15,3),0x78913b,j*.055,.12,0);blade.rotation.z=(j-1)*.4;}}}
for(const [x,z,s] of [[-6,-4,.8],[-7,-3,.5],[6,-4,.6],[-2,-7,.5],[2,7,.45]])tree(x,z,s);
// Sparse distant islands continue the menu's floating-world setting.
for(const [x,y,z,s] of [[-36,-8,-40,3],[32,-8,-45,3]]){
  const island=new T.Group();island.position.set(x,y,z);scene.add(island);
  const peak=mesh(island,new T.ConeGeometry(s,s*1.6,7),0x696689,0,-s*.7,0);peak.rotation.z=Math.PI;
  mesh(island,new T.CylinderGeometry(s,s,.3,7),0x799589,0,.1,0);
}

await preloadFigures(["alpha_rick_prime","alpha_morty_smith","alpha_summer_smith"]);
const pawn=figureCharacter(world,"alpha_rick_prime",0xffd777);pawn.group.scale.setScalar(2.3);pawn.group.position.copy(point(8)).add(new T.Vector3(0,.25,0));pawn.pose(1,0,0,0,false,true);
for(const [id,index,c] of [["alpha_morty_smith",21,0x7bc8ee],["alpha_summer_smith",3,0xe594c6]] as const){const f=figureCharacter(world,id,c);f.group.scale.setScalar(1.8);f.group.position.copy(point(index)).add(new T.Vector3(0,.25,0));f.pose(1,0,0,0,false,true);}
const active=ring(world,0xffd777,pawn.group.position.x,pawn.group.position.y+.02,pawn.group.position.z,.86,.07,.25);

const views={focus:{position:[40,34,17],target:[2,1,0],fov:35},purchase:{position:[27,35,37],target:[3,1,4],fov:35},overview:{position:[0,64,39],target:[0,1,0],fov:40}};
function render(view="focus",route="",position=8){const v=views[view as keyof typeof views]??views.focus;camera.position.fromArray(v.position);camera.lookAt(new T.Vector3().fromArray(v.target));camera.fov=v.fov;camera.updateProjectionMatrix();routeA.visible=route==="outer";routeB.visible=route==="shortcut";pawn.group.position.copy(point(position)).add(new T.Vector3(0,.25,0));active.position.copy(pawn.group.position).add(new T.Vector3(0,.02,0));renderer.render(scene,camera);
const projection=Object.fromEntries([8,12,13,34,...STATIONS.map(s=>s.field)].map(id=>{const p=point(id).add(new T.Vector3(0,id===34?2.5:2.6,0)).project(camera);return[id,{x:(p.x+1)/2*100,y:(1-p.y)/2*100}];}));
return {image:renderer.domElement.toDataURL("image/webp",.9),projection,triangles:renderer.info.render.triangles};}
(window as any).__draft={render,ready:true};render();
