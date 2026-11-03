import { useEffect, useRef, useState } from "react";
import { tiltAxes, type TiltSample } from "../lib/partyTilt";

type SensorStatus="off"|"asking"|"waiting"|"active"|"denied"|"missing"|"insecure";
export function usePartyTilt() {
  const [status,setStatus]=useState<SensorStatus>("off"),axes=useRef({x:0,z:0}),baseline=useRef<TiltSample|undefined>(undefined),latest=useRef<TiltSample|undefined>(undefined);
  const cleanup=useRef<()=>void>(()=>{}),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cleanup.current();};},[]);
  function stop(){cleanup.current();cleanup.current=()=>{};axes.current={x:0,z:0};baseline.current=undefined;setStatus("off");}
  async function enable() {
    cleanup.current();axes.current={x:0,z:0};baseline.current=undefined;
    if(!window.isSecureContext){setStatus("insecure");return;}
    const ctor=window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
    if(!ctor){setStatus("missing");return;}
    setStatus("asking");
    try{if(ctor.requestPermission&&await ctor.requestPermission()!=="granted"){if(mounted.current)setStatus("denied");return;}}
    catch{if(mounted.current)setStatus("denied");return;}
    if(!mounted.current)return;
    setStatus("waiting");let received=false;
    const event=(e:DeviceOrientationEvent)=>{
      if(e.beta===null||e.gamma===null||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma)||document.hidden)return;
      received=true;latest.current={beta:e.beta,gamma:e.gamma};baseline.current??=latest.current;
      const angle=screen.orientation?.angle??(window as Window&{orientation?:number}).orientation??0;
      const next=tiltAxes(latest.current,baseline.current,angle);axes.current={x:axes.current.x*.55+next.x*.45,z:axes.current.z*.55+next.z*.45};setStatus("active");
    };
    const reset=()=>{axes.current={x:0,z:0};baseline.current=undefined;};
    const visibility=()=>{if(document.hidden)reset();};
    window.addEventListener("deviceorientation",event);window.addEventListener("orientationchange",reset);document.addEventListener("visibilitychange",visibility);
    const timeout=setTimeout(()=>{if(!received){cleanup.current();axes.current={x:0,z:0};setStatus("missing");}},3000);
    cleanup.current=()=>{clearTimeout(timeout);window.removeEventListener("deviceorientation",event);window.removeEventListener("orientationchange",reset);document.removeEventListener("visibilitychange",visibility);};
  }
  function calibrate(){baseline.current=latest.current;axes.current={x:0,z:0};}
  const message:Record<SensorStatus,string>={off:"Neige dein Handy zum Lenken. Du kannst auch den Stick nutzen.",asking:"Sensorfreigabe wird angefragt …",waiting:"Halte das Handy bequem und ruhig. Wir warten auf das Sensorsignal …",active:"Neigung aktiv. Halte das Handy bequem; bei Bedarf neu kalibrieren.",denied:"Sensorfreigabe abgelehnt. Stick und Tastatur funktionieren weiter.",missing:"Kein Sensorsignal verfügbar. Nutze den Stick oder die Tastatur.",insecure:"Neigung braucht HTTPS. Öffne den öffentlichen Spiel-Link oder nutze den Stick."};
  return {status,axes,enable,stop,calibrate,message:message[status]};
}
