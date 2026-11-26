import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import type { PartyAction } from "../shared/party";
import type { RoomState } from "../shared/types";
import { NEUTRAL_MATCH_INPUT } from "../shared/matches/types";
import { FL, FLOOR_TILES } from "../shared/matches/floorIsLava";
import type { LavaHostGame, LavaHostSnap } from "../shared/matches/lavaHost";

/**
 * Floor is Lava "Unity · Host rechnet" over real sockets: the room relays a guest's input to the
 * simulating host at once ("party:unity-input") and the host's checked snapshot to everyone else
 * ("party:unity-snap"), without waiting for the next room tick; nobody else gets them.
 */
const server = createSpielraumServer(), port = await server.listen(0), sockets: Socket[] = [];
const request = <T = RoomState>(s: Socket, event: string, payload?: unknown) => new Promise<T>((resolve, reject) => {
  const callback = (err: Error | null, r: { ok: boolean; data?: T; error?: string }) => err ? reject(err) : !r.ok ? reject(new Error(r.error)) : resolve(r.data!);
  if (payload === undefined) s.timeout(5000).emit(event, callback); else s.timeout(5000).emit(event, payload, callback);
});
async function connect() {
  const s = io(`http://127.0.0.1:${port}`, { transports: ["websocket"], forceNew: true, reconnection: false }); sockets.push(s);
  await new Promise<void>((resolve, reject) => { s.once("connect", resolve); s.once("connect_error", reject); }); return s;
}
const wait = (ms: number) => new Promise(r => setTimeout(r, Math.max(0, ms)));
/** Resolves with the first matching event within `ms`, or undefined. */
const next = <T>(s: Socket, event: string, ms: number, match: (payload: T) => boolean = () => true) => new Promise<T | undefined>(resolve => {
  const timer = setTimeout(() => { s.off(event, handler); resolve(undefined); }, ms);
  const handler = (payload: T) => { if (!match(payload)) return; clearTimeout(timer); s.off(event, handler); resolve(payload); };
  s.on(event, handler);
});
try {
  const host = await connect(), guest = await connect(), ids = [randomUUID(), randomUUID()], clients = [host, guest];
  let room = await request(host, "room:create", { playerId: ids[0], name: "Anna", characterId: "alpha_rick_prime" });
  await request(guest, "room:join", { code: room.code, playerId: ids[1], name: "Ben", characterId: "alpha_morty_smith" });
  await request(host, "room:configure", { gameId: "free-minigame", playerCount: 2, minigames: { miniId: "lava" } });
  await request(host, "room:ready"); room = await request(guest, "room:ready");
  const tokens = [(await request(host, "qwixx:state")).partyToken!, room.partyToken!];
  const send = async (i: number, action: PartyAction) => {
    const current = await request(clients[i], "qwixx:state");
    room = await request(clients[i], "party:action", { token: tokens[i], phaseId: current.partyGame!.phaseId, seq: (current.partyGame!.seq[ids[i]] ?? 0) + 1, action });
  };
  await send(0, { type: "look", renderer: "unity-host", view: "third" });
  for (let i = 0; i < 2; i++) await send(i, { type: "ready" });
  assert.equal(room.partyGame!.mini!.match!.id, "lavahost");
  assert.equal((room.partyGame!.mini!.match!.game as LavaHostGame).host, ids[0]);
  const phaseId = room.partyGame!.phaseId, startAt = room.partyGame!.mini!.startAt, order = room.partyGame!.mini!.match!.players.map(p => p.id);
  await wait(startAt - Date.now() + 100);

  // The guest's input reaches the host at once; the guest itself gets no relayed inputs.
  const toHost = next<{ id: string; input: { x: number } }>(host, "party:unity-input", 1000, p => p.id === ids[1]), toGuest = next(guest, "party:unity-input", 400);
  const sent = Date.now();
  await request(guest, "party:control", { token: tokens[1], phaseId, seq: 1, input: { ...NEUTRAL_MATCH_INPUT, x: .8 } });
  const relayed = await toHost;
  assert.ok(relayed, "Eingabe des Mitspielers kommt beim Host an");
  assert.equal(relayed!.input.x, .8);
  assert.ok(Date.now() - sent < 500);
  assert.equal(await toGuest, undefined, "Nur das Host-Handy bekommt fremde Eingaben");

  // The host's report reaches the guest at once and checked; the host gets no echo.
  const TILES = FLOOR_TILES * FL.floors;
  const snap: LavaHostSnap = { type: "snap", time: 1200, done: false, round: 1, phase: "play", tiebreak: false, roundStart: 0, rings: 0, tiles: "1".repeat(TILES), regen: "0".repeat(TILES),
    tiebreakWinner: -1, points: [0, 1], events: [], physical: true,
    runners: order.map((id, i) => ({ id, x: 3 + i, y: 4, vx: 0, vy: 0, fx: 0, fy: 1, floor: 0, alive: true, h: 0, dropUntil: 0, airUntil: 0, shoveUntil: 0, slideUntil: 0, diveUntil: 0, proneUntil: 0, jumpReady: 0, shoveReady: 0, diveReady: 0, invulnUntil: 0 })) };
  const toGuestSnap = next<{ snap: LavaHostSnap }>(guest, "party:unity-snap", 1000), echo = next(host, "party:unity-snap", 400);
  await request(host, "party:unity", { token: tokens[0], phaseId, report: { seq: 1, snap: { ...snap, runners: snap.runners.map(r => ({ ...r, x: 99 })) } } });
  const got = await toGuestSnap;
  assert.ok(got, "Zustand des Hosts kommt sofort beim Mitspieler an");
  assert.equal(got!.snap.runners[0].x, FL.cols + 2, "Weitergereicht wird der geprüfte Zustand");
  assert.equal(await echo, undefined, "Kein Echo an den Host");
  // Only the host reports; a refused report is not relayed.
  const stray = next(host, "party:unity-snap", 400);
  await assert.rejects(request(guest, "party:unity", { token: tokens[1], phaseId, report: { seq: 2, snap } }), /Host-Handy/);
  assert.equal(await stray, undefined);
  console.log("Floor is Lava „Host rechnet“ online: Eingaben sofort an den Host, geprüfte Zustände sofort an alle anderen, keine Echos, fremde Meldungen abgewiesen.");
} finally {
  for (const s of sockets) s.disconnect();
  await server.close();
}
