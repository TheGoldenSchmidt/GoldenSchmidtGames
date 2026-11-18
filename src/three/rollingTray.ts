import * as T from "three";
import { partyBoard, stationAt, STATIONS } from "../../shared/partyBoard";
import type { SceneKit } from "./sceneKit";

const enamel = 0x23685e, brass = 0xdfab61, clay = 0xce8057;
export const trayHeight = (x: number, z: number) => .44 + 3.15 * Math.pow(Math.max(0, 1 - (x * x + z * z) / 25), .65);
export function trayPoint(field: { id: number; x: number; y: number }) {
  const x = (field.x - 50) * .27, z = (field.y - 50) * .27;
  return new T.Vector3(x, trayHeight(x, z) + .06, z);
}

/** The Bauschale's scenery. Topology and collectible rules stay in shared/. */
export function rollingTray(kit: SceneKit, world: T.Object3D) {
  kit.scene.fog = null;
  const sky = document.createElement("canvas"); sky.width = 2; sky.height = 256;
  const ctx = sky.getContext("2d")!, gradient = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [stop, color] of [[0,"#4a47a6"],[.4,"#7f9be8"],[.7,"#d9b8ee"],[1,"#4a47a6"]] as const) gradient.addColorStop(stop, color);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2, 256);
  const texture = new T.CanvasTexture(sky); texture.colorSpace = T.SRGBColorSpace; kit.scene.background = texture;
  kit.renderer.toneMappingExposure = 1.04;
  kit.material(enamel).metalness = .25; kit.material(enamel).roughness = .35;
  kit.material(brass).metalness = .55; kit.material(brass).roughness = .4;
  const ring = (r: number, y: number, thickness: number, color = brass) => {
    const mesh = kit.mesh(world, new T.TorusGeometry(r, thickness, 6, 64), color, 0, y, 0);
    mesh.rotation.x = -Math.PI / 2;
  };
  kit.cylinder(world, 0x194d49, 0, -.25, 0, 12.7, .8);
  kit.cylinder(world, clay, 0, .18, 0, 12.3, .48);
  const profile = [[12.1,.39],[12.4,.52],[12.75,1.1],[13.07,1.22],[13.22,1.08],[13.08,.7],[12.8,-.65],[12.4,-.78]].map(([r,y])=>new T.Vector2(r,y));
  kit.mesh(world, new T.LatheGeometry(profile, 64), enamel, 0, 0, 0).material.side = T.DoubleSide;
  ring(13.07, 1.18, .11); ring(12.39, .55, .035); ring(12.77, -.6, .07, 0x173f3c);
  for (let i=0;i<48;i++) {const a=i*Math.PI/24;kit.box(world,brass,Math.cos(a)*13.06,.67,Math.sin(a)*13.06,.04,.24,.04);}

  const terrain = new T.PlaneGeometry(10,10,24,24); terrain.rotateX(-Math.PI/2);
  const positions = terrain.getAttribute("position");
  for (let i=0;i<positions.count;i++) positions.setY(i,trayHeight(positions.getX(i),positions.getZ(i)));
  const triangles:number[]=[], indices=terrain.getIndex()!;
  for(let i=0;i<indices.count;i+=3){const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)];if(ids.every(id=>Math.hypot(positions.getX(id),positions.getZ(id))<=5))triangles.push(...ids);}
  terrain.setIndex(triangles);terrain.computeVertexNormals();
  kit.material(0x6fbf35).flatShading=true;kit.mesh(world,terrain,0x6fbf35,0,0,0);
  const stone=new T.IcosahedronGeometry(1,0),cone=new T.ConeGeometry(1,1,7);
  for(let i=0;i<32;i++){const a=i*Math.PI/16;kit.mesh(world,stone,i%2?0xa7a780:0xb1ad84,Math.cos(a)*4.9,.61,Math.sin(a)*4.9,.35,.3,.4).rotation.y=a;}
  const tree=(x:number,z:number,s:number)=>{
    const y=trayHeight(x,z);kit.cylinder(world,0x80543b,x,y+.5*s,z,.1*s,s);
    for(let i=0;i<3;i++)kit.mesh(world,cone,[0x2f7a2e,0x579c38,0xa9dc42][i],x,y+(1+i*.4)*s,z,(.7-i*.15)*s,1.1*s,(.7-i*.15)*s);
  };
  for(const [x,z,s] of [[-3.1,-2.8,.85],[-4.1,-1.8,.6],[2.5,-3.8,.8],[4,-3.1,.5],[-6,-4,.65],[-7,-3,.4],[6,-4,.5],[-2,-7,.4],[2,7,.35]])tree(x,z,s);
  for(const station of STATIONS){const p=trayPoint(partyBoard({mode:"roll-it-up"})[station.field]);
    kit.mesh(world,new T.CylinderGeometry(1.8,1.95,.16,9),0x7eaa43,p.x*.76,.48,p.z*.76);
    for(let i=0;i<5;i++){const a=i*1.26;kit.mesh(world,stone,0xbfa37d,p.x*.76+Math.cos(a)*1.76,.55,p.z*.76+Math.sin(a)*1.76,.18,.12,.2);}
  }
  const bench=new T.Group();world.add(bench);bench.position.set(0,3.59,-.7);
  for(const x of [-.9,.9]){for(const z of [-.3,.3])kit.box(bench,0x293e3a,x,.35,z,.13,.7,.14);kit.box(bench,0x293e3a,x,.93,-.35,.14,1.4,.14);}
  for(const z of [-.3,0,.3])kit.box(bench,0xe8ac62,0,.72,z,2.7,.15,.24);
  for(const y of [1.08,1.42])kit.box(bench,0xd18c4d,0,y,-.34,2.7,.24,.13);
  for(const x of [-2,2]){const y=trayHeight(x,0);kit.cylinder(world,0x5d4639,x,y+.62,0,.06,1.15);kit.box(world,0x302e39,x,y+1.25,0,.35,.45,.35);kit.box(world,0xffd777,x,y+1.26,.185,.22,.28,.015);kit.mesh(world,new T.ConeGeometry(.31,.25,4),0x537657,x,y+1.59,0);}
  const board=partyBoard({mode:"roll-it-up"});
  for(let i=0;i<45;i++){const a=i*2.39996,r=6+(i%7)*.37,x=Math.sin(a)*r,z=Math.cos(a)*r;
    if(board.some(f=>Math.hypot((f.x-50)*.27-x,(f.y-50)*.27-z)<1.1))continue;
    kit.mesh(world,stone,i%3?0x78913b:0xc9ad83,x,.55,z,.12,.09+(i%3)*.07,.13);
  }
}

export function trayStation(kit:SceneKit,world:T.Group,id:number,point:T.Vector3) {
  const station=stationAt(id);if(!station)return;
  const prop=new T.Group();prop.position.set(point.x*.76,.65,point.z*.76);prop.rotation.y=Math.atan2(point.x,point.z);world.add(prop);
  kit.cylinder(prop,0xe5cb97,0,.04,0,1.08,.18);
  if(station.name==="Grinder") {
    kit.cylinder(prop,enamel,0,.66,0,.79,1.12);
    for(const y of [.19,.57,1.15])kit.cylinder(prop,brass,0,y,0,.81,.07);
    kit.cylinder(prop,enamel,0,1.28,0,.81,.15);
    for(let i=0;i<16;i++){const a=i*Math.PI/8;kit.box(prop,brass,Math.sin(a)*.8,.9,Math.cos(a)*.8,.04,.34,.04);}
  } else if(station.name==="Pape") {
    kit.box(prop,enamel,0,.25,0,1.9,.24,1.08);kit.box(prop,0xe5c98f,0,.39,0,1.74,.08,.94);
    kit.box(prop,0xfff8ea,0,.82,-.29,1.73,.045,1.02).rotation.x=-.68;
    kit.box(prop,brass,0,.42,.34,1.3,.03,.12);
  } else if(station.name==="Filter") {
    kit.box(prop,0xc28c55,0,.38,0,1.7,.45,1.05).rotation.y=.15;
    for(let i=0;i<5;i++)kit.cylinder(prop,0xffe7b0,-.6+i*.28,.75,.02,.12,1.1).rotation.x=Math.PI/2;
  } else {
    kit.cylinder(prop,enamel,0,.3,0,.76,.27);kit.cylinder(prop,brass,0,.45,0,.74,.07);
    const bud=new T.IcosahedronGeometry(1,0);
    for(let i=0;i<9;i++){const a=i*2.4,r=.3;kit.mesh(prop,bud,[0x527448,0x789946,0x9caa5b][i%3],Math.sin(a)*r,.65+(i%4)*.21,Math.cos(a)*r,.37,.43,.37);}
  }
}
