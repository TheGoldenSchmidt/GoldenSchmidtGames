import type { Ack, RoomState } from "../../shared/types";
import { io } from "socket.io-client";

import { nearby, type Listener, type TableRoute } from "../nearby/nearbySocket";

const central = io({
  autoConnect: false,
  transports: ["websocket", "polling"]
});

let current: typeof central | typeof nearby = central;
const subscriptions = new Map<string, Set<Listener>>();
export function useTableTransport(route?: TableRoute) {
  const next = route ? nearby : central;
  if (current !== next) {
    for (const [name, listeners] of subscriptions) for (const fn of listeners) current.off(name,fn);
    current.disconnect();
    current = next;
    for (const [name, listeners] of subscriptions) for (const fn of listeners) current.on(name,fn);
  }
  if (route) nearby.configure(route);
}
export const socket = {
  get connected() { return current.connected; },
  get id() { return current.id; },
  get tableRoute() { return current === nearby ? nearby.route : undefined; },
  connect() { current.connect(); },
  disconnect() { current.disconnect(); },
  on(event:string, fn:Listener) {
    const listeners = subscriptions.get(event) ?? new Set();
    if (!listeners.has(fn)) current.on(event,fn);
    listeners.add(fn); subscriptions.set(event,listeners);
  },
  off(event:string, fn:Listener) { subscriptions.get(event)?.delete(fn); current.off(event,fn); },
  emit(event:string,...args:unknown[]) { current.emit(event,...args); },
  timeout(ms:number) { return current.timeout(ms); },
  get volatile() { return current.volatile; }
};

export function sendGameMove(room: RoomState | undefined, event: string, payload: object | undefined,
  done: (error: Error | null, response: Ack<RoomState>) => void) {
  if (!room || !socket.connected) {
    done(new Error("Verbindung unterbrochen."), { ok: false });
    return;
  }
  const args: object[] = payload ? [payload] : [];
  if (room.moveSequence !== undefined) {
    args.push({ code: room.code, moveSequence: room.moveSequence + 1, id: crypto.randomUUID() });
  }
  socket.timeout(8000).emit(event, ...args, done);
}
