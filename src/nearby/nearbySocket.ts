import { decode, DirectLink } from "./directLink";
import { localHost, type FromWorker, type ToWorker, type Wire } from "./protocol";

export interface TableRoute { table:string; role:"host"|"guest" }
// The existing screens use Socket.IO's named events and optional acknowledgement callback.
export type Listener = (...args:any[])=>void;
class NearbySocket {
  route?: TableRoute;
  id?: string;
  get connected() { return !!this.id; }
  private listeners = new Map<string,Set<Listener>>();
  private replies = new Map<number,(error:Error|null,data?:unknown)=>void>();
  private serial = 0;
  private worker?: Worker;
  private starting?: Promise<void>;
  private peers = new Map<string,DirectLink>();
  private pending?: {id:string;link:DirectLink};
  private guest?: DirectLink;
  private releaseLock?: ()=>void;
  private generation = 0;
  private visibility = () => this.post({kind:"visibility",hidden:document.hidden});
  on(event:string,fn:Listener) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(fn); this.listeners.set(event,listeners);
  }
  off(event:string,fn:Listener) { this.listeners.get(event)?.delete(fn); }
  private notify(event:string,...args:unknown[]) { this.listeners.get(event)?.forEach(fn=>fn(...args)); }
  private up() { this.id = crypto.randomUUID(); this.notify("connect"); }
  private down() {
    const wasConnected = this.connected;
    this.id = undefined;
    for (const done of [...this.replies.values()]) done(new Error("Verbindung unterbrochen."));
    if (wasConnected) this.notify("disconnect");
  }
  private post(message:ToWorker) { this.worker?.postMessage(message); }
  private receive(packet:Wire) {
    if (packet.kind === "ack") this.replies.get(packet.request)?.(null,packet.data);
    if (packet.kind === "event") this.notify(packet.event,packet.data);
  }
  configure(route:TableRoute) {
    if (this.route?.table === route.table && this.route.role === route.role) return;
    this.disconnect(); this.route = route;
  }
  connect() {
    if (this.route?.role === "host") void this.start().catch(e=>this.notify("connect_error",e));
  }
  start():Promise<void> {
    if (this.connected) return Promise.resolve();
    if (this.starting) return this.starting;
    const run = this.generation;
    this.starting = this.startWorker(run).catch(error => { if (run === this.generation) this.disconnect(); throw error; })
      .finally(()=>{ if (run === this.generation) this.starting = undefined; });
    return this.starting;
  }
  private async startWorker(run:number) {
    const table = this.route!.table;
    if (navigator.locks) await new Promise<void>((resolve,reject) => {
      void navigator.locks.request("gsg.host."+table,{ifAvailable:true}, lock => {
        if (!lock || run !== this.generation) { reject(new Error("Tisch bereits geöffnet.")); return; }
        return new Promise<void>(unlock=>{this.releaseLock=unlock;resolve();});
      }).catch(reject);
    });
    if (run !== this.generation) throw new Error("Start abgebrochen.");
    const worker = new Worker(new URL("./host.worker.ts",import.meta.url),{type:"module"});
    this.worker = worker;
    await new Promise<void>((resolve,reject) => {
      const timer = setTimeout(()=>reject(new Error("Tisch konnte nicht geladen werden.")),10000);
      worker.onerror = () => { clearTimeout(timer); reject(new Error("Spielhost nicht verfügbar.")); this.disconnect(); };
      worker.onmessage = ({data}: MessageEvent<FromWorker>) => {
        if (run !== this.generation) return;
        if (data.kind === "error") { clearTimeout(timer);reject(new Error("Spielstand konnte nicht geöffnet werden."));return; }
        if (data.kind === "ready") {
          clearTimeout(timer); this.post({kind:"connect",peer:localHost});
          document.addEventListener("visibilitychange",this.visibility); this.visibility(); this.up(); resolve();
        } else if (data.kind === "close") {
          if (data.peer === localHost) this.disconnect(); else this.peers.get(data.peer)?.close();
        } else if (data.kind === "message") {
          if (data.peer === localHost) this.receive(data.packet); else this.peers.get(data.peer)?.send(data.packet);
        }
      };
      this.post({kind:"start",key:table});
    });
  }
  cancelInvite() { this.pending?.link.close(); this.pending=undefined; }
  async invite(code:string) {
    if (!this.connected || this.route?.role !== "host") throw new Error("Tisch noch nicht bereit.");
    this.cancelInvite();
    const id = crypto.randomUUID();
    const link = new DirectLink(true, () => {
      this.peers.set(id,link);this.pending=undefined;this.post({kind:"connect",peer:id});this.notify("paired");
    }, packet => { if (packet.kind === "call") this.post({kind:"message",peer:id,packet}); },
    () => { this.peers.delete(id);this.post({kind:"disconnect",peer:id}); });
    this.pending = {id,link};
    return link.offer(this.route.table,code,id);
  }
  async accept(text:string) {
    const answer = await decode(text);
    if (answer.type !== "answer" || !this.pending || this.pending.id !== answer.invite || this.route?.table !== answer.table)
      throw new Error("Diese Antwort gehört zu einer anderen Einladung.");
    await this.pending.link.accept(answer);
  }
  async answer(text:string,expectedTable?:string) {
    const offer = await decode(text);
    if (offer.type !== "offer" || (expectedTable && offer.table !== expectedTable)) throw new Error("Einladung passt nicht zum Tisch.");
    this.configure({table:offer.table,role:"guest"});
    this.guest?.close();
    const link = new DirectLink(false,()=>this.up(),packet=>this.receive(packet),()=>this.down());
    this.guest=link;
    return { text:await link.answer(offer),code:offer.code };
  }
  private transmit(event:string,args:unknown[],ms?:number) {
    const last=args.at(-1), fn=typeof last === "function" ? args.pop() as Listener : undefined;
    const request=fn ? ++this.serial : undefined;
    if (fn && request !== undefined) {
      const timer=setTimeout(()=>this.replies.get(request)?.(new Error("Keine Antwort vom Host.")),ms??10000);
      this.replies.set(request,(error,data)=>{
        clearTimeout(timer); this.replies.delete(request);
        if(ms!==undefined) fn(error,data); else fn(error?{ok:false,error:error.message}:data);
      });
    }
    if(!this.connected) { if(request!==undefined)this.replies.get(request)?.(new Error("Tisch getrennt.")); return; }
    const packet:Wire={kind:"call",event,args,request};
    if(this.route?.role==="host") this.post({kind:"message",peer:localHost,packet}); else this.guest?.send(packet);
  }
  emit(event:string,...args:unknown[]) {this.transmit(event,args);}
  timeout(ms:number) {return {emit:(event:string,...args:unknown[])=>this.transmit(event,args,ms)};}
  get volatile() {return this;}
  disconnect() {
    ++this.generation; this.starting=undefined;
    this.cancelInvite(); for(const peer of this.peers.values()) peer.close();
    this.guest?.close(); this.guest=undefined;
    this.worker?.terminate();this.worker=undefined;this.releaseLock?.();this.releaseLock=undefined;
    if(typeof document!=="undefined")document.removeEventListener("visibilitychange",this.visibility);
    this.down();
  }
}
export const nearby = new NearbySocket();
