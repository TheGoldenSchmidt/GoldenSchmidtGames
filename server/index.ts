import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomInt } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { getGame } from "../shared/games";
import { accuseDurak, attackDurak, cheatDefendDurak, cheatThrowInDurak, createDurakGame, defendDurak, finishDurakBout, takeDurak, throwInDurak, transferDurak } from "../shared/durak";
import {
  QWIXX_COLORS,
  createQwixxGame,
  rollQwixx,
  submitColorChoice,
  submitWhiteChoice,
  type QwixxColorChoice
} from "../shared/qwixx";
import type { Ack, GameId, Player, QwixxColor, RoomState } from "../shared/types";

export function createSpielraumServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use((request, response, next) => {
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-Robots-Tag", "noindex, nofollow");
    if (request.secure) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

const rooms = new Map<string, RoomState>();
const socketMembership = new Map<string, { roomCode: string; playerId: string }>();

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, version: "0.1.0", rooms: rooms.size });
});

const distDirectory = path.resolve(process.cwd(), "dist");
if (existsSync(distDirectory)) {
  app.use(express.static(distDirectory, {
    maxAge: "1h",
    setHeaders(response, filePath) {
      if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.webmanifest") || filePath.endsWith("index.html")) {
        response.setHeader("Cache-Control", "no-cache");
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  }));
  app.use((request, response, next) => {
    if (request.method !== "GET" || !request.accepts("html")) return next();
    response.setHeader("Cache-Control", "no-cache");
    response.sendFile(path.join(distDirectory, "index.html"));
  });
}

function cleanName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function cleanPlayerId(value: unknown) {
  if (typeof value === "string") {
    const playerId = value.trim().slice(0, 64);
    if (/^[A-Za-z0-9_-]+$/.test(playerId)) return playerId;
  }
  return `guest-${randomInt(10000)}`;
}

function createCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function publicRoom(room: RoomState, viewerId?: string): RoomState {
  const result = structuredClone(room);
  if (result.durakGame) {
    for (const pair of result.durakGame.table) {
      delete pair.attackIllegal;
      delete pair.defenseIllegal;
    }
    for (const playerId of result.durakGame.playerOrder) {
      if (playerId !== viewerId) result.durakGame.hands[playerId] = [];
    }
    result.durakGame.deck = Array.from({ length: result.durakGame.deck.length }, (_, index) => ({
      id: `hidden-${index}`,
      suit: "clubs" as const,
      rank: "6" as const
    }));
  }
  return result;
}

function broadcast(room: RoomState) {
  for (const socketId of io.sockets.adapter.rooms.get(room.code) ?? []) {
    const membership = socketMembership.get(socketId);
    io.sockets.sockets.get(socketId)?.emit("room:updated", publicRoom(room, membership?.playerId));
  }
}

function broadcastGameStarted(room: RoomState) {
  for (const socketId of io.sockets.adapter.rooms.get(room.code) ?? []) {
    const membership = socketMembership.get(socketId);
    io.sockets.sockets.get(socketId)?.emit("game:started", publicRoom(room, membership?.playerId));
  }
}

function connectedPlayers(room: RoomState) {
  return room.players.filter((player) => player.connected);
}

function allPlayersReady(room: RoomState) {
  const players = connectedPlayers(room);
  return players.length === room.config.playerCount && players.every((player) => player.ready);
}

function startRoom(room: RoomState) {
  const players = connectedPlayers(room);
  room.phase = "playing";
  room.players.forEach((player) => {
    player.score = 0;
  });
  if (room.config.gameId === "qwixx") room.game = createQwixxGame(players);
  else if (room.config.gameId === "durak") room.durakGame = createDurakGame(players, Math.random, room.config.durakCheatMode ?? false);
  else throw new Error("Dieses Spiel ist noch nicht verfügbar.");
  broadcast(room);
  broadcastGameStarted(room);
}

function enterRoom(socketId: string, room: RoomState, playerId: string) {
  const socket = io.sockets.sockets.get(socketId);
  socket?.join(room.code);
  socketMembership.set(socketId, { roomCode: room.code, playerId });
}

io.on("connection", (socket) => {
  function runDurakAction(
    callback: (ack: Ack<RoomState>) => void,
    action: (room: RoomState, playerId: string) => void
  ) {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room || room.phase !== "playing" || !room.durakGame) {
      return callback({ ok: false, error: "Die Durak-Partie ist nicht aktiv." });
    }
    try {
      action(room, membership.playerId);
      broadcast(room);
      callback({ ok: true, data: publicRoom(room, membership.playerId) });
    } catch (error) {
      callback({ ok: false, error: error instanceof Error ? error.message : "Aktion nicht möglich." });
    }
  }

  socket.on(
    "room:create",
    (payload: { playerId?: string; name?: string }, callback: (ack: Ack<RoomState>) => void) => {
      const playerId = cleanPlayerId(payload?.playerId);
      const code = createCode();
      const player: Player = {
        id: playerId,
        name: cleanName(payload?.name, "Gast"),
        connected: true,
        ready: false,
        score: 0
      };
      const room: RoomState = {
        code,
        hostId: playerId,
        players: [player],
        config: { gameId: "qwixx", playerCount: 2, durakCheatMode: false },
        phase: "lobby"
      };
      rooms.set(code, room);
      enterRoom(socket.id, room, playerId);
      callback({ ok: true, data: publicRoom(room, playerId) });
    }
  );

  socket.on(
    "room:join",
    (
      payload: { code?: string; playerId?: string; name?: string },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const code = cleanName(payload?.code, "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return callback({ ok: false, error: "Dieser Raum wurde nicht gefunden." });
      const playerId = cleanPlayerId(payload?.playerId);
      if (room.phase !== "lobby") {
        const returning = room.players.some((player) => player.id === playerId);
        if (!returning) return callback({ ok: false, error: "Die Partie läuft bereits." });
      }

      let player = room.players.find((entry) => entry.id === playerId);
      if (player) {
        player.connected = true;
        player.name = cleanName(payload?.name, player.name);
      } else {
        player = {
          id: playerId,
          name: cleanName(payload?.name, "Gast"),
          connected: true,
          ready: false,
          score: 0
        };
        room.players.push(player);
      }

      enterRoom(socket.id, room, playerId);
      callback({ ok: true, data: publicRoom(room, playerId) });
      broadcast(room);
    }
  );

  socket.on(
    "room:configure",
    (
      payload: { gameId?: GameId; playerCount?: number; durakCheatMode?: boolean },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const membership = socketMembership.get(socket.id);
      const room = membership ? rooms.get(membership.roomCode) : undefined;
      if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
      if (room.hostId !== membership.playerId) {
        return callback({ ok: false, error: "Nur der Host kann das Spiel einstellen." });
      }
      const game = getGame(payload.gameId ?? room.config.gameId);
      const requestedCount = Number(payload.playerCount ?? room.config.playerCount);
      room.config = {
        gameId: game.id,
        playerCount: Math.max(game.minPlayers, Math.min(game.maxPlayers, requestedCount)),
        durakCheatMode: game.id === "durak" ? Boolean(payload.durakCheatMode ?? room.config.durakCheatMode) : false
      };
      room.players.forEach((player) => {
        player.ready = false;
      });
      broadcast(room);
      callback({ ok: true, data: publicRoom(room, membership.playerId) });
    }
  );

  socket.on("room:ready", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    const player = room?.players.find((entry) => entry.id === membership?.playerId);
    if (!room || !player) return callback({ ok: false, error: "Du bist in keinem Raum." });
    if (room.phase !== "lobby") return callback({ ok: false, error: "Die Partie läuft bereits." });
    player.ready = !player.ready;
    if (allPlayersReady(room)) {
      startRoom(room);
      return callback({ ok: true, data: publicRoom(room, membership?.playerId) });
    }
    broadcast(room);
    callback({ ok: true, data: publicRoom(room, membership?.playerId) });
  });

  socket.on("room:start", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    if (room.hostId !== membership.playerId) {
      return callback({ ok: false, error: "Nur der Host kann die Partie starten." });
    }
    const players = connectedPlayers(room);
    if (players.length !== room.config.playerCount) {
      return callback({
        ok: false,
        error: `Für den Start werden genau ${room.config.playerCount} verbundene Spieler benötigt.`
      });
    }
    startRoom(room);
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  socket.on("qwixx:roll", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room || room.phase !== "playing" || !room.game) {
      return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
    }
    try {
      room.game = rollQwixx(room.game, membership.playerId);
      broadcast(room);
      callback({ ok: true, data: publicRoom(room, membership.playerId) });
    } catch (error) {
      callback({ ok: false, error: error instanceof Error ? error.message : "Würfeln nicht möglich." });
    }
  });

  socket.on(
    "qwixx:white-choice",
    (payload: { color?: QwixxColor | null }, callback: (ack: Ack<RoomState>) => void) => {
      const membership = socketMembership.get(socket.id);
      const room = membership ? rooms.get(membership.roomCode) : undefined;
      if (!membership || !room || room.phase !== "playing" || !room.game) {
        return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
      }
      const color = payload?.color ?? null;
      if (color !== null && !QWIXX_COLORS.includes(color)) {
        return callback({ ok: false, error: "Unbekannte Farbreihe." });
      }
      try {
        room.game = submitWhiteChoice(room.game, membership.playerId, color);
        broadcast(room);
        callback({ ok: true, data: publicRoom(room, membership.playerId) });
      } catch (error) {
        callback({ ok: false, error: error instanceof Error ? error.message : "Auswahl nicht möglich." });
      }
    }
  );

  socket.on(
    "qwixx:color-choice",
    (payload: { choice?: QwixxColorChoice | null }, callback: (ack: Ack<RoomState>) => void) => {
      const membership = socketMembership.get(socket.id);
      const room = membership ? rooms.get(membership.roomCode) : undefined;
      if (!membership || !room || room.phase !== "playing" || !room.game) {
        return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
      }
      const choice = payload?.choice ?? null;
      if (
        choice !== null &&
        (!QWIXX_COLORS.includes(choice.color) || (choice.whiteIndex !== 0 && choice.whiteIndex !== 1))
      ) {
        return callback({ ok: false, error: "Ungültige Würfelkombination." });
      }
      try {
        room.game = submitColorChoice(room.game, membership.playerId, choice);
        broadcast(room);
        callback({ ok: true, data: publicRoom(room, membership.playerId) });
      } catch (error) {
        callback({ ok: false, error: error instanceof Error ? error.message : "Auswahl nicht möglich." });
      }
    }
  );

  socket.on("qwixx:state", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  socket.on("durak:attack", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = attackDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  socket.on("durak:defend", (payload: { attackCardId?: string; defenseCardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = defendDurak(room.durakGame!, playerId, payload.attackCardId ?? "", payload.defenseCardId ?? "");
    });
  });

  socket.on("durak:transfer", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = transferDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  socket.on("durak:take", (callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = takeDurak(room.durakGame!, playerId);
    });
  });

  socket.on("durak:throw-in", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = throwInDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  socket.on("durak:finish-bout", (callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = finishDurakBout(room.durakGame!, playerId);
    });
  });

  socket.on("durak:cheat-defend", (payload: { attackCardId?: string; defenseCardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = cheatDefendDurak(room.durakGame!, playerId, payload.attackCardId ?? "", payload.defenseCardId ?? "");
    });
  });

  socket.on("durak:cheat-throw-in", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = cheatThrowInDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  socket.on("durak:accuse", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = accuseDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  socket.on("durak:state", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room || !room.durakGame) return callback({ ok: false, error: "Die Durak-Partie ist nicht aktiv." });
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  socket.on("disconnect", () => {
    const membership = socketMembership.get(socket.id);
    socketMembership.delete(socket.id);
    if (!membership) return;
    const room = rooms.get(membership.roomCode);
    const player = room?.players.find((entry) => entry.id === membership.playerId);
    if (!room || !player) return;

    player.connected = false;
    player.ready = false;
    const connectedPlayers = room.players.filter((entry) => entry.connected);
    if (room.hostId === player.id && connectedPlayers.length > 0) {
      room.hostId = connectedPlayers[0].id;
    }
    broadcast(room);

    setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom) return;
      const stillConnected = currentRoom.players.some((entry) => entry.connected);
      if (!stillConnected) rooms.delete(currentRoom.code);
    }, 5 * 60 * 1000).unref();
  });
});

  return {
    app,
    httpServer,
    listen(port: number) {
      return new Promise<number>((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, () => {
          httpServer.off("error", reject);
          resolve((httpServer.address() as AddressInfo).port);
        });
      });
    },
    close() {
      return new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}

const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");

if (isMainModule) {
  const server = createSpielraumServer();
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port).then(() => {
    console.log(`Spielraum-Server läuft auf http://localhost:${port}`);
  });
}
