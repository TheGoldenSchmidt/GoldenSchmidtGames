import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import { RoomStore, type SavedRoom } from "../server/roomStore";
import type { Ack, RoomState } from "../shared/types";

class FaultStore extends RoomStore {
  fail: "before" | "after" | undefined;
  override async save(changes: Map<string, SavedRoom | null>) {
    const failure = this.fail;
    this.fail = undefined;
    if (failure === "before") throw new Error("Schreibfehler");
    await super.save(changes);
    if (failure === "after") throw new Error("Datenbankantwort verloren");
  }
}

// Two independent connections to the same SQLite database within this test process.
// The separate process-crash suite exercises a real disk file.
const config = { url: "file::memory:?cache=shared" };
const store = new FaultStore(config), server = createSpielraumServer(store);
const port = await server.listen(0), origin = `http://127.0.0.1:${port}`;
const sockets: Socket[] = [];
async function connect() {
  const socket = io(origin, { transports: ["websocket"], autoConnect: false, reconnection: false });
  sockets.push(socket);
  const ready = new Promise<void>((ok, fail) => { socket.once("connect", ok); socket.once("connect_error", fail); });
  socket.connect(); await ready; return socket;
}
async function request(s: Socket, event: string, ...args: object[]) {
  const response: Ack<RoomState> = await s.timeout(3000).emitWithAck(event, ...args);
  assert.ok(response.ok, response.error); return response.data!;
}

try {
  let a = await connect(), b = await connect();
  const host = await request(a, "room:create", { playerId: "host", characterId: "alpha_rick_prime" });
  const guest = await request(b, "room:join", { code: host.code, playerId: "guest", characterId: "alpha_korvo" });
  await request(a, "room:configure", { gameId: "kribbeln" });
  await request(a, "room:ready"); await request(b, "room:ready");
  const move = { id: randomUUID(), code: host.code, moveSequence: 1 };
  for (const fault of ["before", "after"] as const) {
    let leaked = false;
    b.on("room:updated", (r: RoomState) => { if (r.kribbelnGame?.rolls) leaked = true; });
    store.fail = fault;
    await assert.rejects(request(a, "kribbeln:roll", { keep: [] }, move));
    const deadline = Date.now() + 12000;
    while (!(await fetch(origin + "/api/health")).ok) {
      assert.ok(Date.now() < deadline, "Speicher wurde nicht wieder verfügbar"); await delay(100);
    }
    assert.equal(leaked, false, "Ohne erfolgreiche Speicherantwort kein Broadcast");
    a = await connect(); b = await connect();
    const room = await request(a, "room:join", { code: host.code, playerId: "host", sessionToken: host.sessionToken });
    await request(b, "room:join", { code: host.code, playerId: "guest", sessionToken: guest.sessionToken });
    assert.equal(room.kribbelnGame!.rolls, fault === "before" ? 0 : 1);
  }
  const duplicate = await request(a, "kribbeln:roll", { keep: [] }, move);
  assert.equal(duplicate.kribbelnGame!.rolls, 1);
  const incoming = new RoomStore(config);
  try {
    const rows = await incoming.load(true);
    await assert.rejects(store.save(new Map([[host.code, null]])), /übernommen/);
    assert.deepEqual(await incoming.load(false), rows, "Alter Prozess kann beim Deployment nichts mehr überschreiben");
  } finally { incoming.close(); }
  console.log("Speicherfehler vor und nach Commit, Wiederholung und Schutz vor veralteten Serverprozessen geprüft.");
} finally {
  await server.close();
  sockets.forEach(s => s.disconnect());
}
