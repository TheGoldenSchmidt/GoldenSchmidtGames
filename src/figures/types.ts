export type DetailLevel = "low" | "mid" | "high";
export interface VisualPart {
  id: string;
  shape: "ico" | "box" | "cyl" | "cone" | "sph" | "capsule" | "torus" | "group" | "morphHead" | "mesh";
  mesh?: { vertices: [number,number,number][]; indices: number[]; colors?: string[] };
  morph?: Record<string,number>; smoothShading?: boolean;
  size?: number | number[]; detail?: DetailLevel;
  pos?: [number,number,number]; rot?: [number,number,number]; scale?: number | [number,number,number];
  color?: string; parent?: string; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number;
  arc?: [number,number,number,number];
}
export interface Visual { detailLevel?: DetailLevel; height?: number; palette?: Record<string,string>; parts: VisualPart[] }
export interface AnimationTrack { part: string; prop: "pos.x"|"pos.y"|"pos.z"|"rot.x"|"rot.y"|"rot.z"|"scale"|"emissive"|"opacity"; keys: [number,number][] }
export interface AnimationClip { duration: number; loop?: boolean; tracks: AnimationTrack[] }
export type Animations = Record<string,AnimationClip>;
export interface FigureDef { cardId: string; visual: Visual; animations?: Animations }
export interface FigureBase { baseId: string; visual: Visual; attachments: Record<string,string>; animationProfileId?: string; animations?: Animations }
export interface FigureVariant { cardId: string; baseId: string; palette?: Record<string,string>; height?: number; detailLevel?: DetailLevel; removeParts?: string[]; patchParts?: (Partial<VisualPart> & {id:string})[]; addParts?: VisualPart[]; animations?: Animations }
