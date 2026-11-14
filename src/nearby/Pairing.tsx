import { useEffect, useRef, useState } from "react";
import { nearby } from "./nearbySocket";

function DisplayCode({value}:{value:string}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [part,setPart] = useState(0);
  const [id] = useState(()=>crypto.randomUUID());
  const parts = value.match(/.{1,700}/g)!;
  const [error,setError] = useState("");
  useEffect(()=>{
    let active=true;
    const data = parts.length === 1 ? value : `GSGQ|${id}|${part}|${parts.length}|${parts[part]}`;
    const draw=()=>import("qrcode").then(qr=>{
      const target=canvas.current;
      if(active && target) return qr.toCanvas(target,data,{width:Math.floor(target.getBoundingClientRect().width),margin:4,errorCorrectionLevel:"M"});
    }).catch(()=>setError("QR-Code konnte nicht angezeigt werden. Nutze den Textcode."));
    const observer=new ResizeObserver(()=>void draw());
    if(canvas.current)observer.observe(canvas.current);
    void draw();
    return ()=>{active=false;observer.disconnect();};
  },[value,id,part]);
  return <><canvas className="pair-qr" ref={canvas} aria-label="Verbindungs-QR-Code"/>
    {parts.length>1 && <button className="button button--secondary" onClick={()=>setPart((part+1)%parts.length)}>Teil {part+1} von {parts.length} · Weiter</button>}
    <details><summary>Textcode anzeigen</summary><textarea aria-label="Eigener Verbindungscode" readOnly value={value} onFocus={e=>e.target.select()}/></details>
    {error && <p role="alert">{error}</p>}</>;
}

function ReadCode({label,onRead}:{label:string;onRead:(value:string)=>Promise<void>}) {
  const video=useRef<HTMLVideoElement>(null);
  const [scanning,setScanning]=useState(false),[text,setText]=useState(""),[error,setError]=useState("");
  const [progress,setProgress]=useState(""),[busy,setBusy]=useState(false);
  const receive=useRef(onRead); receive.current=onRead;
  const fragments=useRef({id:"",parts:new Map<number,string>()});
  async function submit(value:string) {
    setScanning(false);setBusy(true);setError("");
    try { await receive.current(value.trim()); }
    catch(e){setError(e instanceof Error?e.message:"Code nicht lesbar.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    if(!scanning)return;
    let active=true,stream:MediaStream|undefined,timer:ReturnType<typeof setTimeout>;
    async function scan(){
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      if(!active){stream.getTracks().forEach(t=>t.stop());return;}
      const v=video.current!;v.srcObject=stream;await v.play();
      const {default:decode}=await import("jsqr");
      const c=document.createElement("canvas"),ctx=c.getContext("2d",{willReadFrequently:true})!;
      function frame(){
        if(!active)return;
        if(v.videoWidth && v.readyState>=2){
          c.width=Math.min(900,v.videoWidth);c.height=Math.round(c.width*v.videoHeight/v.videoWidth);
          ctx.drawImage(v,0,0,c.width,c.height);
          const pixels=ctx.getImageData(0,0,c.width,c.height);
          const code=decode(pixels.data,c.width,c.height,{inversionAttempts:"dontInvert"})?.data;
          if(code?.startsWith("GSG1.")){void submit(code);return;}
          const m=code?.match(/^GSGQ\|([0-9a-f-]{36})\|(\d+)\|(\d+)\|(.{1,700})$/);
          if(m && +m[3]<=24 && +m[2]<+m[3]){
            if(fragments.current.id!==m[1])fragments.current={id:m[1],parts:new Map()};
            const parts=fragments.current.parts;parts.set(+m[2],m[4]);
            if(parts.size===+m[3]){void submit(Array.from({length:+m[3]},(_,i)=>parts.get(i)).join(""));return;}
            setProgress(`${parts.size} von ${m[3]} Teilen gelesen. Am anderen Handy weiterblättern.`);
          }
        }
        timer=setTimeout(frame,140);
      }
      frame();
    }
    scan().catch(()=>{if(active){setError("Kamera nicht verfügbar. Erlaube den Kamerazugriff oder füge den Textcode ein.");setScanning(false);}});
    return ()=>{active=false;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());};
  },[scanning]);
  return <section className="pair-read">{scanning && <video ref={video} playsInline muted aria-label="Kamerabild"/>}
    <button disabled={busy} className="button button--primary" onClick={()=>{setError("");setScanning(!scanning);}}>{scanning?"Kamera schließen":label}</button>
    {progress && scanning && <p role="status">{progress}</p>}
    <details><summary>Textcode eingeben</summary><textarea aria-label="Erhaltenen Verbindungscode einfügen" value={text} maxLength={16000} onChange={e=>setText(e.target.value)}/>
      <button className="button button--secondary" disabled={!text||busy} onClick={()=>void submit(text)}>Code übernehmen</button></details>
    {error && <p role="alert">{error}</p>}</section>;
}

export function HostInvite({code}:{code:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [open,setOpen]=useState(false),[offer,setOffer]=useState(""),[accepted,setAccepted]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    if(!open)return;
    let active=true;
    dialog.current?.showModal();
    const paired=()=>setOpen(false);nearby.on("paired",paired);
    nearby.invite(code).then(value=>{if(active)setOffer(value);}).catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;nearby.off("paired",paired);nearby.cancelInvite();};
  },[open,code]);
  return <div className="pair-invite"><button className="button button--secondary" onClick={()=>{setOffer("");setError("");setAccepted(false);setOpen(true);}}>Gerät verbinden</button>
    {open && <dialog ref={dialog} className="pair-dialog iw-dialog" onCancel={()=>setOpen(false)}>
      <h2 className="iw-plank">Einladung für ein Gerät</h2>
      {offer && !accepted && <><p>Dein Gast scannt diesen Code im selben WLAN oder Hotspot. Scanne danach seine Antwort.</p><DisplayCode value={offer}/>
        <ReadCode label="Antwort scannen" onRead={async value=>{await nearby.accept(value);setAccepted(true);}}/></>}
      {accepted && <p role="status">Verbindung wird aufgebaut. Falls kein Gerät beitritt, schließe die Einladung und versuche es erneut.</p>}
      {!offer && !error && <p role="status">Einladung wird vorbereitet …</p>}
      {error && <p role="alert">{error}</p>}
      <button className="button button--secondary" onClick={()=>setOpen(false)}>Schließen</button></dialog>}</div>;
}

export function GuestPair({expectedTable,onOffer,onReset}:{expectedTable?:string;onOffer:(code:string,table:string)=>void;onReset?:()=>void}) {
  const [answer,setAnswer]=useState("");
  return <div className="pair-guest">{answer?<><h2>Zeige dem Host deine Antwort</h2><DisplayCode value={answer}/>
    <button className="button button--secondary" onClick={()=>{nearby.disconnect();setAnswer("");onReset?.();}}>Neue Einladung scannen</button></>:
    <ReadCode label="Einladung scannen" onRead={async value=>{
      const result=await nearby.answer(value,expectedTable);onOffer(result.code,nearby.route!.table);setAnswer(result.text);
    }}/>}</div>;
}
