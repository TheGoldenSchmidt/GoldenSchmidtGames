import { clamp } from "../../shared/partyArena";
export interface TiltSample {beta:number;gamma:number}
export function tiltAxes(sample:TiltSample,baseline:TiltSample,screenAngle:number) {
  const angle=screenAngle*Math.PI/180,side=sample.gamma-baseline.gamma,forward=sample.beta-baseline.beta;
  const deadzone=(value:number)=>Math.abs(value)<.07?0:clamp(value,-1,1);
  return {x:deadzone((side*Math.cos(angle)+forward*Math.sin(angle))/18),z:deadzone((forward*Math.cos(angle)-side*Math.sin(angle))/18)};
}
