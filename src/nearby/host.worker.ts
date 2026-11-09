import { createRoomCore } from "../../shared/roomCore";
import type { RoomPeer } from "../../shared/roomPorts";
import { HostStore } from "./hostStore";
import { isCall, localHost, type ToWorker, type FromWorker } from "./protocol";

const send = (packet: FromWorker) => self.postMessage(packet);
class Peer implements RoomPeer {
  connected = true;
  groups = new Set<string>();
  handlers = new Map<string, (...args:unknown[])=>void>();
  constructor(readonly id: string) {}
  on(event: string, fn: (...args:unknown[])=>void) { this.handlers.set(event, fn); }
  emit(event: string, data: unknown) { send({kind:"message",peer:this.id,packet:{kind:"event",event,data}}); }
  join(group: string) { this.groups.add(group); }
  leave(group: string) { this.groups.delete(group); }
  drop() {
    this.connected = false; peers.delete(this.id);
    this.handlers.get("disconnect")?.();
  }
}
const peers = new Map<string,Peer>();
let register: (peer: RoomPeer)=>void;
let core: ReturnType<typeof createRoomCore>;
let hidden = false;
self.onmessage = async ({data}: MessageEvent<ToWorker>) => {
  if (data.kind === "start") {
    core = createRoomCore({
      onPeer: fn => { register = fn; }, peer: id => peers.get(id),
      members: group => [...peers.values()].filter(p=>p.groups.has(group)).map(p=>p.id),
      clearGroup: group => { for(const p of peers.values()) p.leave(group); },
      emitTo: (groups, event, payload) => { for(const p of peers.values()) if(groups.some(g=>p.groups.has(g))) p.emit(event,payload); },
      dropConnections: () => { for(const p of [...peers.values()]) { p.drop(); send({kind:"close",peer:p.id}); } }
    }, new HostStore(data.key), localHost);
    try { await core.start(); send({kind:"ready"}); } catch { send({kind:"error"}); }
    return;
  }
  if (data.kind === "visibility") {
    hidden = data.hidden;
    await core.suspend(hidden);
    if (hidden === data.hidden) {
      for (const peer of peers.values()) if (peer.id !== localHost && peer.groups.size) peer.emit("host:waiting", hidden);
    }
    return;
  }
  if (data.kind === "disconnect") { peers.get(data.peer)?.drop(); return; }
  if (data.kind === "connect") {
    if (!core?.available) { send({kind:"close",peer:data.peer}); return; }
    const peer = new Peer(data.peer); peers.set(peer.id,peer); register(peer); return;
  }
  if (data.kind !== "message" || !isCall(data.packet)) return;
  const peer = peers.get(data.peer);
  if (!peer) return;
  const {event,args,request} = data.packet;
  const reply = (result: unknown) => {
    if (request !== undefined) send({kind:"message",peer:peer.id,packet:{kind:"ack",request,data:result}});
  };
  if (hidden) { reply({ok:false,retryable:true,error:"Das Host-Handy pausiert."}); return; }
  peer.handlers.get(event)?.(...(request === undefined ? args : [...args,reply]));
};
