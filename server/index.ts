import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { randomInt, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Server } from "socket.io";
import { getGame } from "../shared/games";
import { applyPartyAction, applyPartyControl, createPartyGame, partyOptions, publicParty, selectPartyTestMini, tickParty, type PartyAction, type PartyOptions } from "../shared/party";
import { CHARACTERS, characterId, isCharacterId } from "../shared/characters";
import { PartyBotDriver } from "../shared/partyBots";
import { isArenaId, NEUTRAL_INPUT, publicArena, type ArenaInput } from "../shared/partyArena";
import { createKribbelnGame, rollKribbeln, submitKribbeln } from "../shared/kribbeln";
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
const partyTokens = new Map<string, Map<string, string>>();
const botDrivers = new Map<string,PartyBotDriver>();

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
  if (room.partyGame) result.partyGame = publicParty(room.partyGame, viewerId ?? "");
  if (viewerId) result.partyToken = partyTokens.get(room.code)?.get(viewerId);
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
  else if (room.config.gameId === "kribbeln") room.kribbelnGame = createKribbelnGame(players);
  else if (room.config.gameId === "party") {
    players.forEach((p,i)=>p.characterId=characterId(p.characterId,i));
    room.partyGame = createPartyGame(players, room.config.party, true, room.partyTest?.seed??randomInt(0x100000000));
    partyTokens.set(room.code, new Map(players.filter(p=>!p.bot).map(p => [p.id, randomUUID()])));
    if(room.partyTest)botDrivers.set(room.code,new PartyBotDriver());
  }
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
  let lastPartyControl=0;
  socket.on("party:test-create",(payload:{playerId?:string;name?:string;bots?:number;seed?:number;characterId?:unknown},callback:(ack:Ack<RoomState>)=>void)=>{
    if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
    if(!Number.isInteger(payload?.bots)||payload.bots!<1||payload.bots!>5||!Number.isInteger(payload.seed)||payload.seed!<0||payload.seed!>0xffffffff)return callback({ok:false,error:"Wähle 1–5 Bots und einen Startwert von 0 bis 4294967295."});
    const id=cleanPlayerId(payload.playerId),code=createCode();
    const players:Player[]=[{id,name:cleanName(payload.name,"Gast"),connected:true,ready:false,score:0,characterId:payload.characterId}];
    for(let i=0;i<payload.bots!;i++)players.push({id:`bot-${randomUUID()}`,name:`Inselbot ${i+1}`,connected:true,ready:true,score:0,bot:true,characterId:CHARACTERS[randomInt(CHARACTERS.length)].id});
    const room:RoomState={code,hostId:id,players,phase:"lobby",config:{gameId:"party",playerCount:players.length,party:partyOptions({rounds:5})},partyTest:{seed:payload.seed!}};
    rooms.set(code,room);enterRoom(socket.id,room,id);callback({ok:true,data:publicRoom(room,id)});
  });
  socket.on("room:character",(payload:{characterId?:unknown},callback:(ack:Ack<RoomState>)=>void)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,player=room?.players.find(p=>p.id===member?.playerId);
    if(!room||!player||room.phase!=="lobby")return callback({ok:false,error:"Die Figur kann nur vor dem Spielstart gewählt werden."});
    if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Diese Figur ist nicht verfügbar."});
    player.characterId=payload.characterId;player.ready=false;broadcast(room);callback({ok:true,data:publicRoom(room,player.id)});
  });
  socket.on("party:test-command",(payload:{token?:string;phaseId?:number;seq?:number;command?:string;miniId?:string},callback:(ack:Ack<RoomState>)=>void)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    if(!member||!room?.partyTest||!g||room.hostId!==member.playerId||payload?.token!==partyTokens.get(room.code)?.get(member.playerId))return callback({ok:false,error:"Testwerkzeuge sind nur für den Host einer Testpartie verfügbar."});
    // Testwerkzeuge unterbrechen bewusst auch laufende Bot-Züge. Die Folge
    // schützt vor doppelten Anfragen, während normale Spielaktionen ihre Phase prüfen.
    const seq=payload.seq??(room.partyTest.commandSeq??0)+1;
    if(!Number.isSafeInteger(seq)||seq<1)return callback({ok:false,error:"Ungültige Testaktion."});
    if(seq<=(room.partyTest.commandSeq??0))return callback({ok:true,data:publicRoom(room,member.playerId)});
    if(g.pausedAt)return callback({ok:false,error:"Die Testpartie ist pausiert."});
    if(payload.command==="restart"){
      room.partyGame=createPartyGame(room.players,room.config.party,true,room.partyTest.seed);
      room.partyGame.phaseId=g.phaseId+1;room.partyGame.seq={...g.seq};botDrivers.set(room.code,new PartyBotDriver());
    }else if(payload.command==="mini"&&isArenaId(payload.miniId??""))room.partyGame=selectPartyTestMini(g,payload.miniId as import("../shared/partyArena").ArenaId);
    else if(payload.command==="skip-bots")room.partyGame=botDrivers.get(room.code)!.skipTurns(g,Date.now());
    else return callback({ok:false,error:"Unbekanntes Testwerkzeug."});
    room.partyTest.commandSeq=seq;
    broadcast(room);callback({ok:true,data:publicRoom(room,member.playerId)});
  });
  socket.on("party:control",(payload:{phaseId?:number;token?:string;seq?:number;input?:ArenaInput},callback?:(ack:Ack<{accepted:boolean}>)=>void)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    const fail=(error:string)=>callback?.({ok:false,error});
    if(!member||!room||!g||payload?.token!==partyTokens.get(room.code)?.get(member.playerId))return fail("Die Inselparty-Sitzung ist nicht gültig.");
    if(payload.phaseId!==g.phaseId)return fail("Die Minispielrunde hat sich geändert.");
    const now=Date.now();if(now-lastPartyControl<25)return callback?.({ok:true,data:{accepted:false}});
    try{room.partyGame=applyPartyControl(g,member.playerId,payload.input!,payload.seq!,now);lastPartyControl=now;callback?.({ok:true,data:{accepted:true}});}
    catch(error){fail(error instanceof Error?error.message:"Steuerung nicht möglich.");}
  });
  socket.on("party:action", (payload: { seq?: number; phaseId?: number; token?: string; action?: PartyAction }, callback: (ack: Ack<RoomState>) => void) => {
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    if(!member||!room||!g||payload?.token!==partyTokens.get(room.code)?.get(member.playerId))return callback({ok:false,error:"Die Inselparty-Sitzung ist nicht gültig."});
    if(!Number.isSafeInteger(payload.seq)||payload.seq!<1||!payload.action)return callback({ok:false,error:"Ungültige Aktion."});
    if(payload.seq! <= (g.seq[member.playerId]??0))return callback({ok:true,data:publicRoom(room,member.playerId)});
    if(payload.phaseId!==g.phaseId)return callback({ok:false,error:"Der Spielzug hat sich geändert. Bitte erneut wählen."});
    if((payload.action.type==="resume"||payload.action.type==="abort")&&room.hostId!==member.playerId)return callback({ok:false,error:"Nur der Host kann fortsetzen oder abbrechen."});
    try {room.partyGame=applyPartyAction(g,member.playerId,payload.action);room.partyGame.seq[member.playerId]=payload.seq!;broadcast(room);callback({ok:true,data:publicRoom(room,member.playerId)});}
    catch(error){callback({ok:false,error:error instanceof Error?error.message:"Aktion nicht möglich."});}
  });
  socket.on("kribbeln:roll", (payload: { keep?: number[] }, callback: (ack: Ack<RoomState>) => void) => {
    const member = socketMembership.get(socket.id);
    const room = member ? rooms.get(member.roomCode) : undefined;
    if (!member || !room?.kribbelnGame || room.phase !== "playing") return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
    try { room.kribbelnGame = rollKribbeln(room.kribbelnGame, member.playerId, payload?.keep ?? []); broadcast(room); callback({ ok: true, data: publicRoom(room, member.playerId) }); }
    catch (error) { callback({ ok: false, error: error instanceof Error ? error.message : "Würfeln nicht möglich." }); }
  });
  socket.on("kribbeln:submit", (payload: { choice?: "score" | "skip" | "fallback" }, callback: (ack: Ack<RoomState>) => void) => {
    const member = socketMembership.get(socket.id);
    const room = member ? rooms.get(member.roomCode) : undefined;
    if (!member || !room?.kribbelnGame || room.phase !== "playing") return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
    if (!payload || !["score", "skip", "fallback"].includes(payload.choice ?? "")) return callback({ ok: false, error: "Ungültige Auswahl." });
    try { room.kribbelnGame = submitKribbeln(room.kribbelnGame, member.playerId, payload.choice!); broadcast(room); callback({ ok: true, data: publicRoom(room, member.playerId) }); }
    catch (error) { callback({ ok: false, error: error instanceof Error ? error.message : "Eintrag nicht möglich." }); }
  });
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
    (payload: { playerId?: string; name?: string; characterId?: unknown }, callback: (ack: Ack<RoomState>) => void) => {
      if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
      const playerId = cleanPlayerId(payload?.playerId);
      const code = createCode();
      const player: Player = {
        id: playerId,
        name: cleanName(payload?.name, "Gast"),
        characterId: payload.characterId,
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
      payload: { code?: string; playerId?: string; name?: string; partyToken?: string; characterId?: unknown },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const code = cleanName(payload?.code, "").toUpperCase();
      const room = rooms.get(code);
      if (!room) return callback({ ok: false, error: "Dieser Raum wurde nicht gefunden." });
      const playerId = cleanPlayerId(payload?.playerId);
      if(room.partyTest&&(playerId!==room.hostId||room.players.find(p=>p.id===playerId)?.bot))return callback({ok:false,error:"Dieser Testraum gehört einer einzelnen Person und ihren Bots."});
      if(room.partyGame&&payload.partyToken!==partyTokens.get(code)?.get(playerId))return callback({ok:false,error:"Diese Inselparty kann nur mit der ursprünglichen Sitzung fortgesetzt werden."});
      if (room.phase !== "lobby") {
        const returning = room.players.some((player) => player.id === playerId);
        if (!returning) return callback({ ok: false, error: "Die Partie läuft bereits." });
      }

      let player = room.players.find((entry) => entry.id === playerId);
      const selectedCharacter=room.phase==="playing"&&player?player.characterId:payload.characterId;
      if(!isCharacterId(selectedCharacter))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
      if (player) {
        player.connected = true;
        if(room.phase==="lobby"){if(player.characterId!==selectedCharacter)player.ready=false;player.characterId=selectedCharacter;}
        player.name = cleanName(payload?.name, player.name);
      } else {
        player = {
          id: playerId,
          name: cleanName(payload?.name, "Gast"),
          characterId:selectedCharacter,
          connected: true,
          ready: false,
          score: 0
        };
        room.players.push(player);
      }

      enterRoom(socket.id, room, playerId);
      if(room.partyGame){delete room.partyGame.disconnected[playerId];if(!Object.keys(room.partyGame.disconnected).length&&room.partyGame.pausedAt){const pause=Date.now()-room.partyGame.pausedAt;if(room.partyGame.deadline)room.partyGame.deadline+=pause;if(room.partyGame.mini?.startAt)room.partyGame.mini.startAt+=pause;room.partyGame.pausedAt=0;room.partyGame.resumeOffered=false;}}
      callback({ ok: true, data: publicRoom(room, playerId) });
      broadcast(room);
    }
  );

  socket.on(
    "room:configure",
    (
      payload: { gameId?: GameId; playerCount?: number; durakCheatMode?: boolean; party?: Partial<PartyOptions> },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const membership = socketMembership.get(socket.id);
      const room = membership ? rooms.get(membership.roomCode) : undefined;
      if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
      if (room.hostId !== membership.playerId) {
        return callback({ ok: false, error: "Nur der Host kann das Spiel einstellen." });
      }
      if(room.phase!=="lobby")return callback({ok:false,error:"Die Partie läuft bereits."});
      if(room.partyTest&&((payload.gameId&&payload.gameId!=="party")||(payload.playerCount!==undefined&&payload.playerCount!==room.config.playerCount)))return callback({ok:false,error:"Ein Testraum bleibt eine Inselparty mit der gewählten Botanzahl."});
      let options: PartyOptions;
      try { options=partyOptions(payload.party??room.config.party); } catch {return callback({ok:false,error:"Ungültige Inselparty-Einstellungen."});}
      let game;
      try { game=getGame(payload?.gameId??room.config.gameId); } catch {return callback({ok:false,error:"Unbekanntes Spiel."});}
      if(game.status!=="ready")return callback({ok:false,error:"Dieses Spiel ist noch nicht verfügbar."});
      const requestedCount = Number(payload.playerCount ?? room.config.playerCount);
      if(!Number.isInteger(requestedCount))return callback({ok:false,error:"Ungültige Spielerzahl."});
      room.config = {
        gameId: game.id,
        playerCount: Math.max(game.minPlayers, Math.min(game.maxPlayers, requestedCount)),
        durakCheatMode: game.id === "durak" ? Boolean(payload.durakCheatMode ?? room.config.durakCheatMode) : false,
        party: options
      };
      room.players.forEach((player) => {
        player.ready = Boolean(player.bot);
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
    if(!isCharacterId(player.characterId))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
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
    if(room.phase!=="lobby")return callback({ok:false,error:"Die Partie läuft bereits."});
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
    if([...socketMembership.values()].some(m=>m.roomCode===membership.roomCode&&m.playerId===membership.playerId))return;
    const room = rooms.get(membership.roomCode);
    const player = room?.players.find((entry) => entry.id === membership.playerId);
    if (!room || !player) return;

    player.connected = false;
    if(room.partyGame&&!room.partyGame.players.find(p=>p.id===player.id)?.passive){room.partyGame.disconnected[player.id]=Date.now();if(!room.partyGame.pausedAt)room.partyGame.pausedAt=Date.now();room.partyGame.mini?.arena?.actors.forEach(a=>{a.input={...NEUTRAL_INPUT};a.inputUntil=0;});}
    player.ready = false;
    const connectedPlayers = room.players.filter((entry) => entry.connected&&!entry.bot);
    if (room.hostId === player.id && connectedPlayers.length > 0) {
      room.hostId = connectedPlayers[0].id;
    }
    broadcast(room);

    setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom) return;
      const stillConnected = currentRoom.players.some((entry) => entry.connected&&!entry.bot);
      if (!stillConnected) {rooms.delete(currentRoom.code);partyTokens.delete(currentRoom.code);botDrivers.delete(currentRoom.code);}
    }, 5 * 60 * 1000).unref();
  });
});

  let pulse=0;
  const partyClock=setInterval(()=>{
    pulse++;
    for(const room of rooms.values()){
      const before=room.partyGame;if(!before||['finished','aborted'].includes(before.phase))continue;
      const realtime=before.phase==="mini-play"&&Boolean(before.mini?.arena)&&!before.pausedAt;
      if(!realtime&&pulse%5!==0)continue;
      const withBots=room.partyTest?botDrivers.get(room.code)!.step(before,Date.now()):before;
      room.partyGame=tickParty(withBots);const after=room.partyGame;
      if(realtime&&after.phaseId===before.phaseId&&after.mini?.arena){
        if(pulse%2===0)for(const socketId of io.sockets.adapter.rooms.get(room.code)??[]){const viewer=socketMembership.get(socketId)?.playerId??"";io.sockets.sockets.get(socketId)?.emit("party:arena",{code:room.code,phaseId:after.phaseId,arena:publicArena(after.mini.arena,viewer),serverTime:Date.now()});}
      }else broadcast(room);
    }
  },50);
  partyClock.unref();
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
      clearInterval(partyClock);
      return new Promise<void>((resolve) => io.close(() => resolve()));
    }
  };
}

const isMainModule = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? "");

if (isMainModule) {
  const server = createSpielraumServer();
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port).then(() => {
    console.log(`GoldenSchmidtGames-Server läuft auf http://localhost:${port}`);
  });
}
