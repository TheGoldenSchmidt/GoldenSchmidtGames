import {RIG_JOINTS} from "./rigJoints";
import * as T from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {buildFigure,type BuiltFigure} from "./CardFigure";
import type {FigureDef} from "./types";

/** Compile static surfaces inside each moving joint, preserving every named anchor.
 * Adding an animation track automatically gives its target a separate surface batch.
 * Resources belong to this instance and are disposed with its SceneKit. */
export function buildOptimizedFigure(data:FigureDef):BuiltFigure {
  const built=buildFigure({...data.visual,height:.8},{useGeometryCache:false});
  const moving=new Set(["root",...Object.values(RIG_JOINTS).flat()]);
  for(const clip of Object.values(data.animations??{}))for(const track of clip.tracks)moving.add(track.part);
  built.root.updateMatrixWorld(true);
  const buckets=new Map<T.Object3D,Map<string,{geometries:T.BufferGeometry[];material:T.MeshStandardMaterial}>>();
  const meshes:T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>[]=[];
  built.root.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});
  const names=new Map([...built.parts].map(([id,object])=>[object,id]));
  for(const mesh of meshes){
    let owner:T.Object3D=mesh;
    while(owner!==built.root&&!moving.has(names.get(owner)??""))owner=owner.parent!;
    const material=mesh.material,key=JSON.stringify([material.roughness,material.metalness,material.flatShading,material.transparent,material.opacity,material.side]);
    let groups=buckets.get(owner);if(!groups){groups=new Map();buckets.set(owner,groups);}
    let batch=groups.get(key);
    if(!batch){const m=material.clone();m.color.set(0xffffff);m.vertexColors=true;batch={geometries:[],material:m};groups.set(key,batch);}
    const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
    geometry.applyMatrix4(new T.Matrix4().copy(owner.matrixWorld).invert().multiply(mesh.matrixWorld));
    const count=geometry.getAttribute("position").count,original=geometry.getAttribute("color"),colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){colors[i*3]=(original?original.getX(i):1)*material.color.r;colors[i*3+1]=(original?original.getY(i):1)*material.color.g;colors[i*3+2]=(original?original.getZ(i):1)*material.color.b;}
    geometry.setAttribute("color",new T.BufferAttribute(colors,3));
    for(const attr of Object.keys(geometry.attributes))if(!["position","normal","color"].includes(attr))geometry.deleteAttribute(attr);
    if(!geometry.hasAttribute("normal"))geometry.computeVertexNormals();
    batch.geometries.push(geometry);
  }
  // Keep transforms, children, parent relationships and IDs, even for static leaves.
  const replacements=new Map<T.Object3D,T.Object3D>();
  for(const mesh of meshes){const anchor=new T.Group();anchor.name=mesh.name;anchor.position.copy(mesh.position);anchor.rotation.copy(mesh.rotation);anchor.scale.copy(mesh.scale);
    mesh.parent!.add(anchor);for(const child of [...mesh.children])anchor.add(child);mesh.removeFromParent();replacements.set(mesh,anchor);built.parts.set(names.get(mesh)!,anchor);mesh.geometry.dispose();mesh.material.dispose();}
  for(const [owner,groups] of buckets)for(const batch of groups.values()){
    const geometry=mergeGeometries(batch.geometries,false)!;batch.geometries.forEach(g=>g.dispose());geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const surface=new T.Mesh(geometry,batch.material);surface.castShadow=true;surface.updateMatrix();surface.matrixAutoUpdate=false;(replacements.get(owner)??owner).add(surface);
  }
  for(const [id,anchor] of built.parts)if(!moving.has(id)){anchor.updateMatrix();anchor.matrixAutoUpdate=false;}
  built.root.userData.surfaceCount=[...buckets.values()].reduce((n,groups)=>n+groups.size,0);
  built.root.userData.sourceMeshCount=meshes.length;
  return built;
}
