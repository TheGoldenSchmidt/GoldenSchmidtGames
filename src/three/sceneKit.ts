import {characterId} from "../../shared/characters";
import * as T from "three";
import { figureCharacter } from "../figures/character";

export const PLAYER_COLORS=[0xe65c65,0x398fe2,0x67b94b,0xa16bd0,0xf4a53e,0xe8ca3b];
export class SceneKit {
  readonly scene=new T.Scene();
  readonly renderer:T.WebGLRenderer;
  readonly camera=new T.PerspectiveCamera(42,1,.1,180);
  private observer:ResizeObserver;
  private materials=new Map<number,T.MeshStandardMaterial>();
  private sphereGeometry=new T.SphereGeometry(1,16,12);
  private boxGeometry=new T.BoxGeometry(1,1,1);
  private cylinderGeometry=new T.CylinderGeometry(1,1,1,24);
  private coneGeometry=new T.ConeGeometry(1,1,24);
  private disposed=false;
  private frameTime=0;private slowFrames=0;private qualityChanged=false;
  private lost:(event:Event)=>void;
  constructor(readonly host:HTMLElement,onError:()=>void,options:{alpha?:boolean}={}) {
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:options.alpha??false,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;
    this.renderer.domElement.setAttribute("aria-hidden","true");
    host.appendChild(this.renderer.domElement);host.dataset.webgl="ready";
    this.scene.background=new T.Color(0x94def1);this.scene.fog=new T.Fog(0x94def1,55,130);
    this.scene.add(new T.HemisphereLight(0xe8faff,0x88a16a,1.6));
    const sun=new T.DirectionalLight(0xfff4d5,2.1);sun.position.set(-16,28,18);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-20;sun.shadow.camera.right=20;sun.shadow.camera.top=22;sun.shadow.camera.bottom=-24;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;this.scene.add(sun);
    const fill=new T.DirectionalLight(0xc5ecff,.7);fill.position.set(18,10,-18);this.scene.add(fill);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.lost=(event)=>{event.preventDefault();onError();};this.renderer.domElement.addEventListener("webglcontextlost",this.lost);
  }
  resize() {const {width,height}=this.host.getBoundingClientRect();if(!width||!height)return;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);}
  material(color:number) {let material=this.materials.get(color);if(!material){material=new T.MeshStandardMaterial({color,roughness:.78,metalness:0});this.materials.set(color,material);}return material;}
  mesh(parent:T.Object3D,geometry:T.BufferGeometry,color:number,x:number,y:number,z:number,sx=1,sy=1,sz=1) {
    const mesh=new T.Mesh(geometry,this.material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  ball(parent:T.Object3D,color:number,x:number,y:number,z:number,sx:number,sy=sx,sz=sx) {return this.mesh(parent,this.sphereGeometry,color,x,y,z,sx,sy,sz);}
  box(parent:T.Object3D,color:number,x:number,y:number,z:number,sx:number,sy:number,sz:number) {return this.mesh(parent,this.boxGeometry,color,x,y,z,sx,sy,sz);}
  cylinder(parent:T.Object3D,color:number,x:number,y:number,z:number,r:number,h:number) {return this.mesh(parent,this.cylinderGeometry,color,x,y,z,r,h,r);}
  cone(parent:T.Object3D,color:number,x:number,y:number,z:number,r:number,h:number) {return this.mesh(parent,this.coneGeometry,color,x,y,z,r,h,r);}
  beam(parent:T.Object3D,color:number,from:T.Vector3,to:T.Vector3,width:number) {const mesh=this.box(parent,color,0,0,0,width,from.distanceTo(to),width);mesh.position.copy(from).add(to).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize());return mesh;}
  label(parent:T.Object3D,text:string,color="#10485b",width=2.8,fontSize=52) {
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;const ctx=canvas.getContext("2d")!;
    ctx.fillStyle="rgba(255,251,226,.95)";ctx.beginPath();ctx.roundRect(4,8,504,104,36);ctx.fill();ctx.font=`bold ${fontSize}px 'Trebuchet MS',sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=color;ctx.fillText(text.slice(0,24),256,63,470);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true}));sprite.scale.set(width,width/4,1);parent.add(sprite);return sprite;
  }
  badge(parent:T.Object3D,text:string,color="#10485b",size=.85) {
    const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;const ctx=canvas.getContext("2d")!;
    ctx.font="bold 184px 'Trebuchet MS',sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.strokeStyle="#fff8d6";ctx.lineWidth=12;ctx.lineJoin="round";ctx.strokeText(text,128,137,220);ctx.fillStyle=color;ctx.fillText(text,128,137,220);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:true}));sprite.scale.set(size,size,1);parent.add(sprite);return sprite;
  }
  palm(parent:T.Object3D,x:number,y:number,z:number,scale=1) {
    const group=new T.Group();group.position.set(x,y,z);group.scale.setScalar(scale);parent.add(group);
    this.beam(group,0xb88a4f,new T.Vector3(0,0,0),new T.Vector3(.25,2.4,0),.22);
    for(let i=0;i<6;i++){const angle=i*Math.PI/3,leaf=this.ball(group,i%2?0x328851:0x5ab557,.25+Math.sin(angle)*.7,2.4,Math.cos(angle)*.7,.28,.13,1.15);leaf.rotation.y=angle;leaf.rotation.x=.14;}
    this.ball(group,0x9a6335,.15,2.2,.08,.17);this.ball(group,0xbd8b45,.42,2.2,.1,.16);
  }
  water(parent:T.Object3D,y=-.12) {
    const ocean=this.box(parent,0x219fca,0,y,0,120,.2,140);ocean.receiveShadow=true;ocean.castShadow=false;
    for(let i=0;i<22;i++){const x=Math.sin(i*9.17)*28,z=Math.cos(i*3.72)*29;this.box(parent,0x69c6de,x,y+.13,z,1.3,.025,.12).castShadow=false;}
  }
  lighthouse(parent:T.Object3D,x:number,y:number,z:number) {
    const group=new T.Group();group.position.set(x,y,z);parent.add(group);
    this.cylinder(group,0xfff6d9,0,1.6,0,.6,3.2);this.cylinder(group,0xe96752,0,1.3,0,.61,.5);this.cylinder(group,0xe96752,0,2.5,0,.61,.5);this.cylinder(group,0x3d7691,0,3.3,0,.78,.25);this.cylinder(group,0xffdc67,0,3.65,0,.48,.5);this.cone(group,0xe96752,0,4.13,0,.82,.55);return group;
  }
  render(frameBudget=16.7) {if(this.disposed||document.hidden)return;const now=performance.now();
    if(this.frameTime&&now-this.frameTime>Math.max(28,frameBudget*1.6)&&now-this.frameTime<150)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
    this.frameTime=now;
    if(!this.qualityChanged&&this.slowFrames>70){this.qualityChanged=true;this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=false;this.resize();}
    this.renderer.render(this.scene,this.camera);this.host.dataset.drawCalls=String(this.renderer.info.render.calls);this.host.dataset.triangles=String(this.renderer.info.render.triangles);this.host.dataset.frames=String((Number(this.host.dataset.frames)||0)+1);}
  dispose() {
    if(this.disposed)return;this.disposed=true;this.observer.disconnect();this.renderer.domElement.removeEventListener("webglcontextlost",this.lost);
    const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    this.scene.traverse(object=>{if(object instanceof T.InstancedMesh)object.dispose();const mesh=object as T.Mesh;if(mesh.geometry)geometries.add(mesh.geometry);if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(material);const map=(material as T.MeshStandardMaterial).map;if(map)textures.add(map);}});
    if(this.scene.background instanceof T.Texture)textures.add(this.scene.background);
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.materials.forEach(m=>m.dispose());
    this.sphereGeometry.dispose();this.boxGeometry.dispose();this.cylinderGeometry.dispose();this.coneGeometry.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();delete this.host.dataset.webgl;
  }
}

export interface Character {group:T.Group;act?:(clip:"attack"|"hit"|"death",time:number)=>void;pose:(heading:number,speed:number,time:number,jump:number,punch:boolean,reduce:boolean)=>void}
export function character(kit:SceneKit,parent:T.Object3D,index:number,name?:string,selected?:string):Character {
  const figure=figureCharacter(parent,characterId(selected,index),PLAYER_COLORS[index%6]);
  const ring=kit.mesh(figure.group,new T.TorusGeometry(.4,.045,6,24),PLAYER_COLORS[index%6],0,.045,0);ring.rotation.x=Math.PI/2;
  if(name){const label=kit.label(figure.group,name,"#10485b",2.1);label.position.set(0,1.9,0);}
  return figure;
}
