import { isCall, type Wire } from "./protocol";

type Signal = { v: 1; table: string; invite: string; code: string; sdp: string; type: "offer" | "answer" };
async function encode(signal: Signal) {
  const stream = new Blob([JSON.stringify(signal)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return "GSG1." + btoa(String.fromCharCode(...bytes));
}
export async function decode(text: string): Promise<Signal> {
  if (!text.startsWith("GSG1.") || text.length > 16000) throw new Error("Kein gültiger Tisch-Code.");
  const bytes = Uint8Array.from(atob(text.slice(5)), c => c.charCodeAt(0));
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  let json = "", size = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const {value,done} = await reader.read();
    if (done) break;
    if ((size += value.length) > 32768) { await reader.cancel(); throw new Error("Code zu groß."); }
    json += decoder.decode(value,{stream:true});
  }
  const s = JSON.parse(json + decoder.decode());
  if (s?.v !== 1 || !["offer","answer"].includes(s.type) || !/^[A-Z0-9]{5}$/.test(s.code) ||
      ![s.table,s.invite].every(id=>typeof id === "string" && /^[a-f0-9-]{36}$/.test(id)) ||
      typeof s.sdp !== "string" || !s.sdp.startsWith("v=0")) throw new Error("Ungültiger Tisch-Code.");
  return s;
}

export class DirectLink {
  private pc = new RTCPeerConnection({ iceServers: [] });
  private reliable?: RTCDataChannel;
  private live?: RTCDataChannel;
  private ready = false;
  private closed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastReply = Date.now();
  private waiting = false;
  constructor(private host: boolean, private opened: ()=>void, private received: (p:Wire)=>void, private ended: ()=>void) {
    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === "failed") this.close();
      if (this.pc.connectionState === "disconnected") {
        clearTimeout(this.timer); this.timer = setTimeout(()=>this.close(), 12000);
      } else clearTimeout(this.timer);
    };
    if (host) {
      this.attach(this.pc.createDataChannel("table"));
      this.attach(this.pc.createDataChannel("arena", { ordered:false, maxRetransmits:0 }));
    } else this.pc.ondatachannel = e => this.attach(e.channel);
  }
  private attach(ch: RTCDataChannel) {
    if (ch.label === "table" && !this.reliable) this.reliable = ch;
    else if (ch.label === "arena" && !this.live) this.live = ch;
    else { ch.close(); return; }
    const ready = () => {
      if (!this.ready && this.reliable?.readyState === "open" && this.live?.readyState === "open") {
        this.ready = true; this.lastReply=Date.now(); this.opened();
        if(!this.host)this.heartbeat=setInterval(()=>{
          if(this.reliable?.readyState!=="open")return;
          this.reliable.send('{"kind":"ping"}');
          const waiting=Date.now()-this.lastReply>4000;
          if(waiting!==this.waiting){this.waiting=waiting;this.received({kind:"event",event:"host:waiting",data:waiting});}
        },1000);
      }
    };
    ch.onopen = ready;
    ch.onclose = () => this.close();
    ch.onmessage = e => {
      if (typeof e.data !== "string" || e.data.length > 128000) return;
      let p: Wire;
      try { p = JSON.parse(e.data); } catch { return; }
      if (!p || typeof p !== "object") return;
      const kind=(p as {kind:string}).kind;
      if(ch===this.reliable && this.host && kind==="ping"){
        if(!document.hidden)ch.send('{"kind":"pong"}');
        return;
      }
      if(ch===this.reliable && !this.host && kind==="pong"){this.lastReply=Date.now();return;}
      if (this.host ? !isCall(p) : !(p.kind === "ack" || (p.kind === "event" && typeof p.event === "string"))) return;
      const realtime = (p.kind === "call" && p.event === "party:control") || (p.kind === "event" && p.event === "party:arena");
      if (realtime === (ch === this.live)) this.received(p);
    };
    ready();
  }
  send(p: Wire) {
    const ch = (p.kind === "call" && p.event === "party:control") || (p.kind === "event" && p.event === "party:arena")
      ? this.live : this.reliable;
    if (!ch || ch.readyState !== "open" || (ch === this.live && ch.bufferedAmount > 32000)) return;
    try { ch.send(JSON.stringify(p)); } catch { this.close(); }
  }
  private async description(desc: RTCSessionDescriptionInit, info: Omit<Signal,"sdp"|"type">) {
    await this.pc.setLocalDescription(desc);
    // Without ICE servers only local host candidates exist and they arrive together. Some devices never
    // report "complete" (e.g. an idle VPN or cellular interface), so a short quiet period after the last
    // candidate ends the wait instead of the full timeout.
    if (this.pc.iceGatheringState !== "complete") await new Promise<void>((resolve,reject) => {
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => { clearTimeout(timeout); clearTimeout(quiet);
        this.pc.removeEventListener("icegatheringstatechange", check); this.pc.removeEventListener("icecandidate", found); };
      const finish = () => { cleanup(); resolve(); };
      const check = () => { if (this.pc.iceGatheringState === "complete") finish(); };
      const found = (e: RTCPeerConnectionIceEvent) => { if (e.candidate) { clearTimeout(quiet); quiet = setTimeout(finish, 1000); } };
      const timeout = setTimeout(() => { cleanup();
        if (this.pc.localDescription?.sdp.includes("a=candidate:")) resolve(); else reject(new Error("Keine lokale Netzwerkverbindung gefunden.")); },8000);
      this.pc.addEventListener("icegatheringstatechange",check); this.pc.addEventListener("icecandidate",found);
      if (this.pc.localDescription?.sdp.includes("a=candidate:")) quiet = setTimeout(finish, 1000);
      check();
    });
    const sdp = this.pc.localDescription!.sdp;
    if (!sdp.includes("a=candidate:")) throw new Error("Keine lokale Adresse gefunden. WLAN oder Hotspot prüfen.");
    return encode({...info, sdp, type:desc.type as Signal["type"]});
  }
  async offer(table:string, code:string, invite:string) {
    return this.description(await this.pc.createOffer(), {v:1,table,code,invite});
  }
  async answer(offer: Signal) {
    await this.pc.setRemoteDescription({type:"offer",sdp:offer.sdp});
    return this.description(await this.pc.createAnswer(), {v:1,table:offer.table,code:offer.code,invite:offer.invite});
  }
  async accept(answer:Signal) { await this.pc.setRemoteDescription({type:"answer",sdp:answer.sdp}); }
  close() {
    if (this.closed) return;
    this.closed = true; clearTimeout(this.timer); clearInterval(this.heartbeat); this.pc.close(); this.ended();
  }
}
