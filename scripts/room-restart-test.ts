import assert from "node:assert/strict";
import { NEUTRAL_MATCH_INPUT } from "../shared/matches/types";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { io, type Socket } from "socket.io-client";
import type { Ack, RoomState } from "../shared/types";
import { restartFixture } from "./restart-fixture";

// Exercise the deployed entry point with Render's environment and no Turso credentials.
// This test retains its local file; Render may discard that file on restart/deployment.
const server = await restartFixture({ render: true });
const sockets: Socket[] = [];
async function connect(url: string) {
  const s = io(url, { autoConnect: false, reconnection: false, transports: ["websocket"] });
  sockets.push(s);
  const connected = new Promise<void>((resolve, reject) => { s.once("connect", resolve); s.once("connect_error", reject); });
  s.connect(); await connected;
  return s;
}
async function reply<T = RoomState>(s: Socket, event: string, ...args: object[]): Promise<T> {
  const ack: Ack<T> = await s.timeout(5000).emitWithAck(event, ...args);
  assert.ok(ack.ok, ack.error);
  return ack.data!;
}
async function startRoom(url: string, gameId: "qwixx" | "durak" | "kribbeln" | "party" | "goldenschmidt" | "free-minigame") {
  const [a, b] = await Promise.all([connect(url), connect(url)]);
  const host = await reply(a, "room:create", { playerId: "ada", characterId: "alpha_rick_prime" });
  const guest = await reply(b, "room:join", { code: host.code, playerId: "ben", characterId: "alpha_korvo" });
  await reply(a, "room:configure", { gameId, playerCount: 2 });
  await reply(a, "room:ready"); const start = await reply(b, "room:ready");
  return { a, b, start, code: host.code, host: host.sessionToken!, guest: guest.sessionToken! };
}
type Seats = Awaited<ReturnType<typeof startRoom>>;
async function rejoin(url: string, seats: Seats) {
  const [a, b] = await Promise.all([connect(url), connect(url)]);
  const join = (s: Socket, playerId: string, sessionToken: string) =>
    reply(s, "room:join", { code: seats.code, playerId, sessionToken, resumeOnly: true });
  await assert.rejects(join(b, "ada", seats.guest), /Sitzung/);
  const host = await join(a, "ada", seats.host);
  const guest = await join(b, "ben", seats.guest);
  return { a, b, host, guest };
}
try {
  const url = await server.start();
  assert.equal((await fetch(url + "/api/health")).status, 200);
  const page = await fetch(url);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>GoldenSchmidtGames<\/title>/);
  const q = await startRoom(url, "qwixx"), d = await startRoom(url, "durak");
  const k = await startRoom(url, "kribbeln"), p = await startRoom(url, "party");
  const m = await startRoom(url, "goldenschmidt"), f = await startRoom(url, "free-minigame");
  await reply(m.a, "party:action", {token:m.host,seq:1,phaseId:m.start.partyGame!.phaseId,action:{type:"bet",value:5}});
  await reply(q.a, "qwixx:roll");
  const white = await reply(q.b, "qwixx:white-choice", { color: null });
  const attackerIsHost = d.start.durakGame!.attackerId === "ada";
  const attacker = attackerIsHost ? d.a : d.b;
  const cards = (await reply(attacker, "durak:state")).durakGame!;
  await reply(attacker, "durak:attack", { cardId: cards.hands[cards.attackerId][0].id });
  const hostCards = (await reply(d.a, "durak:state")).durakGame;
  const guestCards = (await reply(d.b, "durak:state")).durakGame;
  const move = { code: k.code, moveSequence: 1, id: randomUUID() };
  const rolled = await reply(k.a, "kribbeln:roll", { keep: [] }, move);
  const phaseId = p.start.partyGame!.phaseId;
  await reply(p.a, "party:action", { token: p.host, seq: 1, phaseId, action: { type: "ready" } });
  const playing = await reply(p.b, "party:action", { token: p.guest, seq: 1, phaseId, action: { type: "ready" } });
  const arena = playing.partyGame!;
  await delay(Math.max(0, arena.mini!.startAt - Date.now() + 100));
  const control = await reply<{ accepted: boolean }>(p.a, "party:control", {
    // The opening may be a 3D arena or a match game; both must survive the crash with their inputs.
    token: p.host, seq: 10, phaseId: arena.phaseId, input: arena.mini!.match ? { ...NEUTRAL_MATCH_INPUT, x: 1 } : { x: 1, z: 0, jump: false, punch: false }
  });
  assert.equal(control.accepted, true);
  await server.crash(); // No shutdown hooks or final flush.
  await delay(750);
  assert.equal(await server.start(), url);
  const q2 = await rejoin(url, q);
  assert.deepEqual(q2.guest.game, white.game);
  assert.equal((await reply(q2.a, "qwixx:white-choice", { color: null })).game?.phase, "color-choice");
  const d2 = await rejoin(url, d);
  assert.deepEqual(d2.host.durakGame, hostCards); assert.deepEqual(d2.guest.durakGame, guestCards);
  await reply(attackerIsHost ? d2.b : d2.a, "durak:take");
  const k2 = await rejoin(url, k);
  assert.deepEqual(k2.host.kribbelnGame, rolled.kribbelnGame);
  const duplicate = await reply(k2.a, "kribbeln:roll", { keep: [] }, move);
  assert.deepEqual(duplicate.kribbelnGame, rolled.kribbelnGame);
  await assert.rejects(reply(k2.a, "kribbeln:roll", { keep: [] }, { ...move, id: randomUUID() }), /geändert/);
  assert.equal((await reply(k2.a, "kribbeln:roll", { keep: [] },
    { ...move, moveSequence: 2, id: randomUUID() })).kribbelnGame?.rolls, 2);
  const p2 = await rejoin(url, p), restored = p2.guest.partyGame!;
  const m2 = await rejoin(url, m), f2 = await rejoin(url, f);
  assert.equal(m2.host.partyGame!.phase, "mini-bet");
  assert.equal(m2.host.partyGame!.competition!.bets.ada, 5);
  assert.equal(m2.guest.partyGame!.competition!.bets.ada, undefined);
  assert.deepEqual(m2.guest.partyGame!.competition!.used.ada, []);
  assert.deepEqual(m2.host.partyGame!.competition!.used.ada, [5]);
  await assert.rejects(reply(m2.a,"party:action",{token:m.host,seq:2,phaseId:m2.host.partyGame!.phaseId,action:{type:"bet",value:4}}),/bereits fest/);
  const bet = await reply(m2.b,"party:action",{token:m.guest,seq:1,phaseId:m2.guest.partyGame!.phaseId,action:{type:"bet",value:2}});
  assert.equal(bet.partyGame!.phase,"mini-intro"); assert.equal(bet.partyGame!.competition!.bets.ada,5);
  assert.equal(f2.guest.partyGame!.phase,"mini-intro");
  assert.equal(f2.guest.partyGame!.mini!.id,f.start.partyGame!.mini!.id);
  assert.ok(p2.host.partyGame!.pausedAt); assert.equal(restored.pausedAt, 0);
  assert.equal(restored.phaseId, arena.phaseId);
  assert.ok(restored.mini!.startAt >= arena.mini!.startAt + 700);
  assert.equal(restored.deadline - restored.mini!.startAt, arena.deadline - arena.mini!.startAt);
  // Read ada's own view: match games hide other players' input counters from the guest.
  const own = p2.host.partyGame!.mini!;
  assert.equal((own.arena?.actors ?? own.match!.players).find(actor => actor.id === "ada")?.inputSeq, 10);
  await reply(p2.a, "party:action", { token: p.host, seq: 2, phaseId: restored.phaseId, action: { type: "abort" } });
  await server.crash(); await server.start();
  // Rooms stay open after an abort, also across a restart: the member returns to the end screen, then to the lobby.
  const back = await connect(url), after = await reply(back, "room:join", { code: p.code, playerId: "ada", sessionToken: p.host });
  assert.equal(after.partyGame?.phase, "aborted");
  await assert.rejects(reply(await connect(url), "room:join", { code: p.code, playerId: "ada", sessionToken: m.host }), /ursprüngliche Sitzung/);
  assert.equal((await reply(back, "room:lobby")).phase, "lobby");
  console.log("Prozessabbruch: sechs Spiele fortgesetzt, verdeckte Einsätze erhalten, Karten geschützt, Zugwiederholung, Arenauhr und Rückkehr in die Lobby nach Abbruch geprüft.");
} finally {
  sockets.forEach(s => s.disconnect());
  await server.close();
}
