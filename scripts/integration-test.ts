import { io, type Socket } from "socket.io-client";
import type { RoomState } from "../shared/types";
import { createSpielraumServer } from "../server/index";

function connect(endpoint: string) {
  return new Promise<Socket>((resolve, reject) => {
    const socket = io(endpoint, { transports: ["websocket"], forceNew: true });
    const timeout = setTimeout(() => reject(new Error("Verbindungstimeout")), 5000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("connect_error", reject);
  });
}

function emit<T>(socket: Socket, event: string, payload?: unknown) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout bei ${event}`)), 5000);
    const callback = (response: { ok: boolean; data?: T; error?: string }) => {
      clearTimeout(timeout);
      if (!response.ok || response.data === undefined) reject(new Error(response.error ?? `${event} fehlgeschlagen`));
      else resolve(response.data);
    };
    if (payload === undefined) socket.emit(event, callback);
    else socket.emit(event, payload, callback);
  });
}

function waitForRoom(socket: Socket, predicate: (room: RoomState) => boolean) {
  return new Promise<RoomState>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("room:updated", listener);
      reject(new Error("Erwartetes Raum-Update blieb aus"));
    }, 5000);
    const listener = (room: RoomState) => {
      if (!predicate(room)) return;
      clearTimeout(timeout);
      socket.off("room:updated", listener);
      resolve(room);
    };
    socket.on("room:updated", listener);
  });
}

const testServer = createSpielraumServer();
const port = await testServer.listen(0);
const endpoint = `http://127.0.0.1:${port}`;
const hostPlayerId = "11111111-1111-4111-8111-111111111111";
const guestPlayerId = "22222222-2222-4222-8222-222222222222";
let host: Socket | undefined;
let guest: Socket | undefined;

try {
  host = await connect(endpoint);
  guest = await connect(endpoint);
  const created = await emit<RoomState>(host, "room:create", { playerId: hostPlayerId, name: "Host" });
  if (!/^[A-Z0-9]{5}$/.test(created.code)) throw new Error("Raumcode hat ein falsches Format");
  if (created.hostId !== hostPlayerId) throw new Error("Die vollständige Spieler-ID des Hosts wurde nicht gespeichert");

  const hostSeesGuest = waitForRoom(host, (room) => room.players.some((player) => player.id === guestPlayerId));
  const joined = await emit<RoomState>(guest, "room:join", {
    code: created.code,
    playerId: guestPlayerId,
    name: "Gast"
  });
  if (joined.players.length !== 2) throw new Error("Zweiter Spieler fehlt im Raum");
  await hostSeesGuest;

  await emit<RoomState>(host, "room:configure", { gameId: "qwixx", playerCount: 2 });
  const guestSeesStart = waitForRoom(guest, (room) => room.phase === "playing");
  const hostReady = await emit<RoomState>(host, "room:ready");
  if (!hostReady.players.find((player) => player.id === hostPlayerId)?.ready) {
    throw new Error("Bereitschaft des Hosts wurde nicht gespeichert");
  }
  const started = await emit<RoomState>(guest, "room:ready");
  await guestSeesStart;
  if (started.phase !== "playing") throw new Error("Partie wurde nicht gestartet");
  if (started.game?.phase !== "awaiting-roll") throw new Error("Qwixx wurde nicht initialisiert");
  if (!started.game.sheets[hostPlayerId] || !started.game.sheets[guestPlayerId]) {
    throw new Error("Wertungsblätter verwenden nicht die vollständigen Spieler-IDs");
  }

  const guestSeesRoll = waitForRoom(guest, (room) => room.game?.phase === "white-choice");
  await emit<RoomState>(host, "qwixx:roll");
  await guestSeesRoll;

  await emit<RoomState>(host, "qwixx:white-choice", { color: null });
  const colorPhase = await emit<RoomState>(guest, "qwixx:white-choice", { color: null });
  if (colorPhase.game?.phase !== "color-choice") throw new Error("Gemeinsame weiße Aktion wurde nicht synchronisiert");

  const nextTurn = await emit<RoomState>(host, "qwixx:color-choice", { choice: null });
  if (nextTurn.game?.phase !== "awaiting-roll" || nextTurn.game.turnIndex !== 1) {
    throw new Error("Zugwechsel wurde nicht synchronisiert");
  }
  if (nextTurn.game.sheets[hostPlayerId].failedThrows !== 1) throw new Error("Fehlwurf wurde nicht gewertet");

  const durakCreated = await emit<RoomState>(host, "room:create", { playerId: hostPlayerId, name: "Host" });
  await emit<RoomState>(guest, "room:join", { code: durakCreated.code, playerId: guestPlayerId, name: "Gast" });
  await emit<RoomState>(host, "room:configure", { gameId: "durak", playerCount: 2, durakCheatMode: true });
  await emit<RoomState>(host, "room:ready");
  const durakStarted = await emit<RoomState>(guest, "room:ready");
  if (!durakStarted.durakGame || durakStarted.durakGame.phase !== "attack") throw new Error("Durak wurde nicht gestartet");
  if (!durakStarted.durakGame.cheatMode) throw new Error("Der optionale Schummelmodus wurde nicht übernommen");
  if (durakStarted.durakGame.hands[guestPlayerId].length !== 6 || durakStarted.durakGame.hands[hostPlayerId].length !== 0) {
    throw new Error("Verdeckte Online-Handkarten wurden nicht korrekt gefiltert");
  }
  const hostDurakState = await emit<RoomState>(host, "durak:state");
  const attackerId = hostDurakState.durakGame!.attackerId;
  const attackerSocket = attackerId === hostPlayerId ? host : guest;
  const attackerState = attackerId === hostPlayerId ? hostDurakState : durakStarted;
  const attackCard = attackerState.durakGame!.hands[attackerId][0];
  const attacked = await emit<RoomState>(attackerSocket, "durak:attack", { cardId: attackCard.id });
  if (attacked.durakGame?.phase !== "defend" || attacked.durakGame.table.length !== 1) {
    throw new Error("Durak-Angriff wurde nicht synchronisiert");
  }

  const hostMigrates = waitForRoom(guest, (room) => room.hostId === guestPlayerId);
  host.disconnect();
  const migrated = await hostMigrates;
  if (migrated.hostId !== guestPlayerId) throw new Error("Host-Wechsel fehlgeschlagen");

  console.log(`Online-Integration erfolgreich: Qwixx und Durak, verdeckte Hände, Phasensync und Host-Wechsel`);
} finally {
  host?.disconnect();
  guest?.disconnect();
  await testServer.close();
}
