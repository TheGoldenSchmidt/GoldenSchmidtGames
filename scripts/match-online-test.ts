import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import type { PartyAction } from "../shared/party";
import type { RoomState } from "../shared/types";
import { NEUTRAL_MATCH_INPUT, type MatchState } from "../shared/matches/types";
import type { QuickDrawGame } from "../shared/matches/quickDraw";
import { miniPool } from "../shared/minigameCatalog";

/** Quick Draw over real sockets: configuration, hidden signal, validated shots, duplicates, give-up and result. */
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
try {
  const host = await connect(), guest = await connect(), ids = [randomUUID(), randomUUID()], clients = [host, guest];
  let room = await request(host, "room:create", { playerId: ids[0], name: "Anna", characterId: "alpha_rick_prime" });
  await request(guest, "room:join", { code: room.code, playerId: ids[1], name: "Ben", characterId: "alpha_morty_smith" });
  // Klassik-Option: Inselparty und Wettbewerb ohne Klassiker sind gültig, zu viele Runden nicht.
  await request(host, "room:configure", { gameId: "party", playerCount: 2, party: { rounds: 5, tempo: "fast", classic: false } });
  assert.equal((await request(host, "qwixx:state")).config.party!.classic, false);
  await assert.rejects(request(host, "room:configure", { gameId: "goldenschmidt", playerCount: 2, minigames: { rounds: miniPool(2, false).length + 1, classic: false } }), /höchstens/);
  await assert.rejects(request(host, "room:configure", { gameId: "party", party: { rounds: 5, classic: "nein" } }));
  await request(host, "room:configure", { gameId: "free-minigame", playerCount: 2, minigames: { miniId: "quickdraw" } });
  await request(host, "room:ready"); room = await request(guest, "room:ready");
  const tokens = [(await request(host, "qwixx:state")).partyToken!, room.partyToken!];
  const send = async (i: number, action: PartyAction) => {
    const current = await request(clients[i], "qwixx:state");
    room = await request(clients[i], "party:action", { token: tokens[i], phaseId: current.partyGame!.phaseId, seq: (current.partyGame!.seq[ids[i]] ?? 0) + 1, action });
  };
  for (let i = 0; i < 2; i++) await send(i, { type: "ready" });
  assert.equal(room.partyGame!.phase, "mini-play"); assert.equal(room.partyGame!.mini!.match!.id, "quickdraw");
  const phaseId = room.partyGame!.phaseId, startAt = room.partyGame!.mini!.startAt;
  const views: MatchState<QuickDrawGame>[][] = [[], []];
  clients.forEach((c, i) => c.on("party:match", (payload: { match: MatchState<QuickDrawGame>; phaseId: number }) => { if (payload.phaseId === phaseId) views[i].push(payload.match); }));
  await wait(startAt - Date.now() + 200);
  // Vor dem Signal kennt kein Gerät den Signalzeitpunkt.
  assert.ok(views[0].length > 0);
  assert.ok(views.flat().every(v => v.game.rounds.at(-1)!.signalAt === undefined || v.time >= v.game.rounds.at(-1)!.signalAt!));
  const control = (i: number, seq: number, cn: number, n: number) => request<{ accepted: boolean }>(clients[i], "party:control", { token: tokens[i], phaseId, seq, input: { ...NEUTRAL_MATCH_INPUT, cn, n, echo: Date.now() - 40, held: 10 } });
  await assert.rejects(request(clients[0], "party:control", { token: tokens[1], phaseId, seq: 1, input: NEUTRAL_MATCH_INPUT }), /Sitzung/);
  await assert.rejects(control(0, 1, 1, 5e6), /Ungültige Steuerung/);
  // Warten, bis das Signal öffentlich ist, dann schießen beide; ein doppeltes Paket bleibt wirkungslos.
  for (let t = 0; t < 120 && !views[0].some(v => v.game.rounds[0].signalAt !== undefined); t++) await wait(50);
  const signalView = views[0].find(v => v.game.rounds[0].signalAt !== undefined)!;
  assert.ok(signalView, "Signal wird übertragen");
  // Wie echte Geräte: erst nach der gemessenen Reaktionszeit tippen.
  await wait(260); await control(1, 2, 1, 250); await wait(40);
  await control(0, 2, 1, 200); await wait(40);
  await control(0, 2, 1, 120); // doppelte Folgenummer
  await control(0, 3, 1, 90);  // gleicher Zähler, also kein neuer Schuss
  await wait(300);
  const state = await request(host, "qwixx:state");
  const first = (state.partyGame!.mini!.match as MatchState<QuickDrawGame>).game.rounds[0];
  assert.ok(first.resolvedAt !== undefined, "Runde ausgewertet");
  // Angabe 200 ms: der Server akzeptiert sie höchstens bis zur eigenen gemessenen Dauer und nie schneller als Dauer minus Laufzeitzuschlag.
  const anna = first.shots[ids[0]], elapsed = anna.at - first.signalAt!;
  assert.ok(anna.reaction! >= 200 && anna.reaction! <= elapsed, `Reaktion ${anna.reaction} innerhalb 200…${elapsed}`);
  assert.ok(anna.reaction! >= elapsed - 300 - 60, "Höchstens Laufzeit plus Takt als Vorteil");
  assert.deepEqual(first.winners, first.shots[ids[0]].reaction! < first.shots[ids[1]].reaction! ? [ids[0]] : [ids[1]]);
  // Ben gibt auf: das Duell endet, Anna gewinnt, der Raum schließt mit Ergebnis.
  await send(1, { type: "finish" });
  assert.equal(room.partyGame!.phase, "finished");
  assert.deepEqual(room.partyGame!.winners, [ids[0]]);
  assert.equal(room.partyGame!.competition!.history[0].miniId, "quickdraw");
  console.log("Match-Spiele online erfolgreich: Klassik-Option, Lobbyprüfung, verdecktes Signal, Sitzungsschutz, Eingabeprüfung, doppelte Pakete, Serverwertung, Aufgeben und Ergebnis.");
} finally { sockets.forEach(s => s.disconnect()); await server.close(); }
