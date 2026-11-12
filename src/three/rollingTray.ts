import * as T from "three";
import { stationAt } from "../../shared/partyBoard";
import type { SceneKit } from "./sceneKit";

const enamel = 0x23685e, brass = 0xdfab61, clay = 0xce8057;
export function trayPoint(field: {id:number; x:number; y:number}) {
  const x = (field.x - 50) * .27, z = (field.y - 50) * .27;
  const height = Math.max(0, 1 - (x*x + z*z) / 26);
  return new T.Vector3(x, 1.09 + 2.5 * Math.sqrt(height), z);
}

export function rollingTray(kit: SceneKit, world: T.Object3D) {
  // Enamel basin with a flared wall, rolled brass lip and a contrasting inner glaze.
  kit.box(world, 0x634735, 0, -.65, 0, 120, .3, 120);
  kit.cylinder(world, clay, 0, .49, 0, 11.8, 1.02);
  const profile = [[11.5,1],[11.8,1.12],[12.05,1.48],[12.4,2.12],[12.68,2.18],[12.82,2.07],[12.65,1.78],[12.16,.42],[11.8,.07]].map(([r,y])=>new T.Vector2(r,y));
  const wall = kit.mesh(world, new T.LatheGeometry(profile, 96), enamel, 0, 0, 0);
  wall.material.side = T.DoubleSide;
  for (const [r,y,t] of [[12.62,2.17,.11],[11.45,1.015,.045]]) {
    kit.mesh(world,new T.TorusGeometry(r,t,8,96),brass,0,y,0).rotation.x=Math.PI/2;
  }
  kit.ball(world, 0x798351, 0, 1, 0, 5.1, 2.5, 5.1);
  // Slatted bench with a backrest and iron legs on the crown of the hill.
  const bench = new T.Group(); world.add(bench); bench.position.set(0,3.36,-1.14); bench.scale.setScalar(1.22);
  for(const x of [-.83,.83]) {
    for(const z of [-.26,.24]) kit.box(bench,0x253d37,x,.31,z,.13,.62,.14);
    kit.box(bench,0x253d37,x,.87,-.28,.12,1.16,.12);
  }
  for(const z of [-.25,0,.25]) kit.box(bench,0xf3bc73,0,.66,z,2.55,.16,.21);
  for(const y of [1.04,1.36]) kit.box(bench,0xdc9455,0,y,-.28,2.55,.24,.13);
  kit.label(bench,"Jayspot","#204a40",2.95,86).position.y=2.12;

  // Small objects left in the tray establish its scale.
  const lighter = new T.Group(); world.add(lighter); lighter.position.set(-4.8,1.11,-5.8); lighter.rotation.y=.55;
  kit.box(lighter,0xcb593e,0,.22,0,1.16,.45,2.55);
  kit.box(lighter,0xc5c8ae,0,.22,-1.48,1.14,.46,.52);
  kit.cylinder(lighter,0x343e36,.28,.24,-1.76,.19,.42).rotation.z=Math.PI/2;
  const packet = kit.box(world,0xf3d3a1,4.5,1.1,-5.3,3.25,.18,1.55); packet.rotation.y=-.45;
  const stripe=kit.box(world,enamel,4.55,1.21,-5.35,2.9,.03,.4);stripe.rotation.y=packet.rotation.y;
  for (const [x,z,a] of [[-5.4,2.7,.5],[-6.2,2.3,1.2],[2.2,7.4,-.4]]) {
    const tip=kit.cylinder(world,0xeac499,x,1.22,z,.2,1.12);tip.rotation.set(Math.PI/2,0,a);
  }
}

export function trayStation(kit: SceneKit, world: T.Group, id: number, point: T.Vector3) {
  const station = stationAt(id);
  if (!station) return;
  const prop = new T.Group();
  prop.position.copy(point).multiplyScalar(.80); prop.position.y=1.02;
  prop.rotation.y=Math.atan2(point.x,point.z);
  world.add(prop);
  if(station.name==="Grinder") {
    kit.cylinder(prop,0x384e4b,0,.42,0,.64,.8);
    for(const y of [.13,.49,.77]) kit.cylinder(prop,brass,0,y,0,.67,.09);
    kit.cylinder(prop,enamel,0,.86,0,.59,.09);
  } else if(station.name==="Pape") {
    kit.box(prop,enamel,0,.15,0,1.65,.3,.87);
    kit.box(prop,0xffe5b4,0,.5,-.16,1.46,.05,.94).rotation.x=-.7;
  } else if(station.name==="Filter") {
    for(const x of [-.43,0,.43]) kit.cylinder(prop,0xf6d7a3,x,.25,0,.22,1.03).rotation.x=Math.PI/2;
  } else {
    for(const [x,y,z,r] of [[0,.42,0,.55],[-.28,.52,-.1,.31],[.18,.78,.04,.37],[.07,1.02,-.02,.24]]) {
      kit.mesh(prop,new T.IcosahedronGeometry(r,0),y>.7?0x899646:0x527448,x,y,z);
    }
  }
  kit.label(prop, station.name,"#24483a",3.7,86).position.set(0,1.64,0);
}
