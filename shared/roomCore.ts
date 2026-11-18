import { getGame, isPartyMode } from "./games";
import { checkMinigameSetup, isMinigameMode, minigameOptions, type MinigameOptions } from "./minigameModes";
import { isPlayableMini, miniPool, type PlayableMiniId } from "./minigameCatalog";
import { MATCH_MODULES, publicMatch, type MatchId } from "./matches/framework";
import { applyPartyAction, applyPartyControl, createPartyGame, neutralizePartyInputs, partyOptions, publicParty, selectPartyTestMini, shiftPartyClock, startPartyTestDuel, tickParty, type PartyAction, type PartyOptions } from "./party";
import { CHARACTERS, characterId, isCharacterId } from "./characters";
import { PartyBotDriver } from "./partyBots";
import { publicArena, type ArenaInput } from "./partyArena";
import { createKribbelnGame, rollKribbeln, submitKribbeln } from "./kribbeln";
import { accuseDurak, attackDurak, cheatDefendDurak, cheatThrowInDurak, createDurakGame, defendDurak, finishDurakBout, takeDurak, throwInDurak, transferDurak } from "./durak";
import {
  QWIXX_COLORS,
  createQwixxGame,
  rollQwixx,
  submitColorChoice,
  submitWhiteChoice,
  type QwixxColorChoice
} from "./qwixx";
import type { Ack, GameId, Player, QwixxColor, RoomState } from "./types";

import type { RoomStorage, SavedRoom, RoomHub } from "./roomPorts";
import { RoomTransactions } from "./roomTransactions";
import { socketRequests } from "./socketRequests";
const randomUUID = () => crypto.randomUUID();
function randomInt(limit: number) {
  const range = 0x100000000;
  const ceiling = range - range % limit;
  let value: number;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= ceiling);
  return value % limit;
}
export function createRoomCore(hub: RoomHub, store: RoomStorage, ownerPeer?: string) {
const rooms = new Map<string, RoomState>();
const socketMembership = new Map<string, { roomCode: string; playerId: string }>();
const roomTokens = new Map<string, Map<string, string>>();
const botDrivers = new Map<string,PartyBotDriver>();

const moveSequences = new Map<string, Map<string, { sequence: number; id: string }>>();
const emptySince = new Map<string, number>();
const checkpointAt = new Map<string, number>();
const closingRooms = new Set<string>();
const retentionMs = 7 * 24 * 60 * 60 * 1000;
let stopping = false;
let recoverTimer: ReturnType<typeof setTimeout> | undefined;

function snapshot(code: string): SavedRoom | null {
  const room = rooms.get(code);
  if (!room || closingRooms.has(code)) return null;
  const savedAt = Date.now();
  checkpointAt.set(code, savedAt);
  return { version: 1, room, savedAt, emptySince: emptySince.get(code),
    tokens: [...roomTokens.get(code)!], moveSequences: [...moveSequences.get(code)!] };
}

async function restore(records: SavedRoom[]) {
  rooms.clear();
  roomTokens.clear();
  moveSequences.clear();
  botDrivers.clear();
  socketMembership.clear();
  emptySince.clear();
  checkpointAt.clear();
  closingRooms.clear();
  const newlyOffline = new Map<string, SavedRoom | null>();
  for (const record of records) {
    const room = record.room;
    rooms.set(room.code, room);
    roomTokens.set(room.code, new Map(record.tokens));
    moveSequences.set(room.code, new Map(record.moveSequences));
    emptySince.set(room.code, record.emptySince ?? Date.now());
    checkpointAt.set(room.code, record.savedAt);
    for (const player of room.players) {
      if (!player.bot) player.connected = false;
    }
    const game = room.partyGame;
    if (game) {
      const now = Date.now();
      shiftPartyClock(game, now - (game.pausedAt || record.savedAt));
      game.pausedAt = now;
      // Allow a full reconnect window after downtime while preserving the paused game clock.
      game.resumeOffered = false;
      for (const player of game.players) {
        if (!player.bot && !player.passive) game.disconnected[player.id] = Date.now();
      }
      neutralizePartyInputs(game);
      if (room.partyTest) botDrivers.set(room.code, new PartyBotDriver());
    }
    if (record.emptySince === undefined) newlyOffline.set(room.code, snapshot(room.code));
  }
  if (newlyOffline.size) await store.save(newlyOffline);
}

function retryStorage() {
  if (stopping) return;
  recoverTimer = setTimeout(async () => {
    try {
      const records = await store.load(false);
      if (!stopping) { await restore(records); transactions.available = !stopping; }
    } catch { retryStorage(); }
  }, 3000);
  recoverTimer.unref?.();
}

const transactions = new RoomTransactions(store, snapshot, () => {
  console.error("Spielstandspeicher nicht verfügbar oder übernommen. Bestätigungen pausieren.");
  hub.dropConnections();
  retryStorage();
});
function cleanName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim().replace(/\s+/g, " ").slice(0, 24) || fallback;
}

function cleanPlayerId(value: unknown) {
  if (value === undefined) return randomUUID();
  if (typeof value === "string") {
    const playerId = value.trim();
    if (/^[A-Za-z0-9_-]{1,64}$/.test(playerId) && !(playerId in Object.prototype)) return playerId;
  }
  return undefined;
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
  if (viewerId) {
    result.moveSequence = moveSequences.get(room.code)?.get(viewerId)?.sequence ?? 0;
    result.sessionToken = roomTokens.get(room.code)?.get(viewerId);
    if (room.partyGame) result.partyToken = result.sessionToken; // Existing Inselparty clients.
  }
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

function sendRoom(room: RoomState, event: "room:updated" | "game:started") {
  transactions.publish(() => {
    for (const socketId of hub.members(room.code) ?? []) {
      const member = socketMembership.get(socketId);
      if (member?.roomCode === room.code) hub.peer(socketId)?.emit(event, publicRoom(room, member.playerId));
    }
  });
}

function broadcast(room: RoomState) {
  transactions.dirty(room.code);
  sendRoom(room, "room:updated");
}

function forgetRoom(code: string) {
  rooms.delete(code); roomTokens.delete(code); moveSequences.delete(code); botDrivers.delete(code);
  checkpointAt.delete(code); emptySince.delete(code); closingRooms.delete(code);
}

// Only seeded test rooms are closed after the game; regular rooms return to their lobby.
function closePartyRoom(room: RoomState) {
  if (!room.partyTest) return;
  const reason = room.partyGame?.phase;
  if (reason !== "finished" && reason !== "aborted") return;
  closeRoom(room, reason);
}

// Removes the room for every member. "closed" means the host ended it from the lobby.
function closeRoom(room: RoomState, reason: "finished" | "aborted" | "closed") {
  closingRooms.add(room.code);
  transactions.dirty(room.code);
  transactions.publish(() => {
    hub.emitTo([room.code, `party-status:${room.code}`], "party:closed", { code: room.code, reason });
    for (const [id, member] of socketMembership) {
      if (member.roomCode === room.code) {
        socketMembership.delete(id);
        hub.peer(id)?.leave(room.code);
      }
    }
    hub.clearGroup(`party-status:${room.code}`);
    forgetRoom(room.code);
  });
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
    if (!player.connected) roomTokens.get(room.code)?.delete(player.id);
  });
  if (room.config.gameId === "qwixx") room.game = createQwixxGame(players);
  else if (room.config.gameId === "durak") room.durakGame = createDurakGame(players, Math.random, room.config.durakCheatMode ?? false);
  else if (room.config.gameId === "kribbeln") room.kribbelnGame = createKribbelnGame(players);
  else if (isPartyMode(room.config.gameId)) {
    players.forEach((p,i)=>p.characterId=characterId(p.characterId,i));
    room.partyGame = createPartyGame(players, room.config.party, true, room.partyTest?.seed??randomInt(0x100000000), Date.now(), room.config.gameId, room.config.minigames);
    if(room.partyTest)botDrivers.set(room.code,new PartyBotDriver());
  }
  else throw new Error("Dieses Spiel ist noch nicht verfügbar.");
  broadcast(room);
  sendRoom(room, "game:started");
}

function leaveRoom(socketId: string) {
  const membership = socketMembership.get(socketId);
  socketMembership.delete(socketId);
  if (!membership) return;
  const stillPresent = [...socketMembership.values()].some(other =>
    other.roomCode === membership.roomCode && other.playerId === membership.playerId);
  if (stillPresent) return;
  const room = rooms.get(membership.roomCode);
  const player = room?.players.find((entry) => entry.id === membership.playerId);
  if (!room || !player) return;

  player.connected = false;
  const party = room.partyGame;
  if (party && !party.players.find(member => member.id === player.id)?.passive) {
    const now = Date.now();
    party.disconnected[player.id] = now;
    if (!party.pausedAt) party.pausedAt = now;
    neutralizePartyInputs(party);
  }
  player.ready = false;
  const connectedPlayers = room.players.filter((entry) => entry.connected&&!entry.bot);
  if (!ownerPeer && room.hostId === player.id && connectedPlayers.length > 0) {
    room.hostId = connectedPlayers[0].id;
  }
  broadcast(room);

  if (!room.players.some(entry => entry.connected && !entry.bot)) emptySince.set(room.code, Date.now());
}

function registerRoom(room: RoomState) {
  rooms.set(room.code, room);
  moveSequences.set(room.code, new Map());
  roomTokens.set(room.code, new Map([[room.hostId, randomUUID()]]));
  transactions.dirty(room.code);
}

function validSession(roomCode: string, id: string, token: unknown) {
  return typeof token === "string" && roomTokens.get(roomCode)?.get(id) === token;
}

function enterRoom(socketId: string, room: RoomState, playerId: string) {
  const socket = hub.peer(socketId);
  const previous = socketMembership.get(socketId);
  if (previous && (previous.roomCode !== room.code || previous.playerId !== playerId)) {
    socket?.leave(previous.roomCode);
    leaveRoom(socketId);
  }
  emptySince.delete(room.code);
  socket?.join(room.code);
  socketMembership.set(socketId, { roomCode: room.code, playerId });
}

hub.onPeer((socket) => {
  const { withPayload, withoutPayload } = socketRequests(socket, transactions, (move, perform, reply) => {
    const member = socketMembership.get(socket.id);
    const room = member && rooms.get(member.roomCode);
    if (!member || !room) return reply({ ok: false, error: "Du bist in keinem Raum." });
    const sequences = moveSequences.get(room.code)!;
    if (move.code !== room.code) return reply({ ok: false, error: "Der Raum hat sich geändert." });
    const previous = sequences.get(member.playerId);
    if (move.sequence === previous?.sequence && move.id === previous.id) return reply({ ok: true, data: publicRoom(room, member.playerId) });
    if (move.sequence !== (previous?.sequence ?? 0) + 1) return reply({ ok: false, error: "Der Spielstand hat sich geändert." });
    perform(result => {
      if (result.ok) {
        sequences.set(member.playerId, { sequence: move.sequence, id: move.id });
        transactions.dirty(room.code);
        result = { ...result, data: publicRoom(room, member.playerId) };
      }
      reply(result);
    });
  });
  let lastPartyControl=0;
  withPayload("party:session-status",(payload:{code?:string;playerId?:string;partyToken?:string},callback:(ack:Ack<{available:boolean}>)=>void)=>{
    const room=rooms.get(cleanName(payload?.code,"").toUpperCase()),id=cleanPlayerId(payload?.playerId);
    // Also after the end (finished/aborted) until the room is back in its lobby: members return to the end screen.
    const available=Boolean(id&&room?.partyGame&&payload?.partyToken&&roomTokens.get(room.code)?.get(id)===payload.partyToken&&room.players.some(p=>p.id===id&&!p.bot));
    if(available)socket.join(`party-status:${room!.code}`);
    callback({ok:true,data:{available}});
  });
  withPayload("party:test-create",(payload:{playerId?:string;name?:string;bots?:number;seed?:number;gameId?:GameId;characterId?:unknown},callback:(ack:Ack<RoomState>)=>void)=>{
    if (ownerPeer && socket.id !== ownerPeer) return callback({ok:false,error:"Nur das Host-Gerät kann Räume erstellen."});
    if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
    if(!Number.isInteger(payload?.bots)||payload.bots!<1||payload.bots!>5||!Number.isInteger(payload.seed)||payload.seed!<0||payload.seed!>0xffffffff)return callback({ok:false,error:"Wähle 1–5 Bots und einen Startwert von 0 bis 4294967295."});
    const mode = payload.gameId ?? "party";
    if (!isPartyMode(mode)) return callback({ok:false,error:"Unbekannter Partymodus."});
    const id=cleanPlayerId(payload.playerId),code=createCode();
    if (!id) return callback({ok:false,error:"Ungültige Spieler-ID."});
    const players:Player[]=[{id,name:cleanName(payload.name,"Gast"),connected:true,ready:false,score:0,characterId:payload.characterId}];
    for(let i=0;i<payload.bots!;i++)players.push({id:`bot-${randomUUID()}`,name:`Inselbot ${i+1}`,connected:true,ready:true,score:0,bot:true,characterId:CHARACTERS[randomInt(CHARACTERS.length)].id});
    const room:RoomState={code,hostId:id,players,phase:"lobby",config:{gameId:mode,playerCount:players.length,party:partyOptions({rounds:5})},partyTest:{seed:payload.seed!}};
    registerRoom(room);enterRoom(socket.id,room,id);callback({ok:true,data:publicRoom(room,id)});
  });
  withPayload("room:character",(payload:{characterId?:unknown},callback:(ack:Ack<RoomState>)=>void)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,player=room?.players.find(p=>p.id===member?.playerId);
    if(!room||!player||room.phase!=="lobby")return callback({ok:false,error:"Die Figur kann nur vor dem Spielstart gewählt werden."});
    if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Diese Figur ist nicht verfügbar."});
    player.characterId=payload.characterId;player.ready=false;broadcast(room);callback({ok:true,data:publicRoom(room,player.id)});
  });
  withPayload("party:test-command",(payload:{token?:string;phaseId?:number;seq?:number;command?:string;miniId?:string},callback:(ack:Ack<RoomState>)=>void)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    if(!member||!room?.partyTest||!g||room.hostId!==member.playerId||!validSession(room.code, member.playerId, payload.token))return callback({ok:false,error:"Testwerkzeuge sind nur für den Host einer Testpartie verfügbar."});
    // Testwerkzeuge unterbrechen bewusst auch laufende Bot-Züge. Die Folge
    // schützt vor doppelten Anfragen, während normale Spielaktionen ihre Phase prüfen.
    const seq=payload.seq??(room.partyTest.commandSeq??0)+1;
    if(!Number.isSafeInteger(seq)||seq<1)return callback({ok:false,error:"Ungültige Testaktion."});
    if(seq<=(room.partyTest.commandSeq??0))return callback({ok:true,data:publicRoom(room,member.playerId)});
    if(g.pausedAt)return callback({ok:false,error:"Die Testpartie ist pausiert."});
    if(payload.command==="restart"){
      room.partyGame=createPartyGame(room.players,room.config.party,true,room.partyTest.seed,Date.now(),g.mode,room.config.minigames);
      room.partyGame.phaseId=g.phaseId+1;room.partyGame.seq={...g.seq};botDrivers.set(room.code,new PartyBotDriver());
    }else if(payload.command==="mini"&&!g.competition&&isPlayableMini(payload.miniId)){
      try{room.partyGame=selectPartyTestMini(g,payload.miniId as PlayableMiniId);}catch(error){return callback({ok:false,error:error instanceof Error?error.message:"Minispiel nicht verfügbar."});}
    }
    else if(payload.command==="skip-bots")room.partyGame=botDrivers.get(room.code)!.skipTurns(g,Date.now());
    else if(payload.command==="duel"){try{room.partyGame=startPartyTestDuel(g,member.playerId);}catch(error){return callback({ok:false,error:error instanceof Error?error.message:"Testduell nicht möglich."});}}
    else return callback({ok:false,error:"Unbekanntes Testwerkzeug."});
    room.partyTest.commandSeq=seq;
    broadcast(room);callback({ok:true,data:publicRoom(room,member.playerId)});closePartyRoom(room);
  });
  withPayload("party:control",(payload:{phaseId?:number;token?:string;seq?:number;input?:ArenaInput},callback:(ack:Ack<{accepted:boolean}>)=>void, acknowledged:boolean)=>{
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    const fail=(error:string)=>callback?.({ok:false,error});
    if(!member||!room||!g||!validSession(room.code, member.playerId, payload.token))return fail("Die Inselparty-Sitzung ist nicht gültig.");
    if(payload.phaseId!==g.phaseId)return fail("Die Minispielrunde hat sich geändert.");
    const now=Date.now();if(now-lastPartyControl<25)return callback?.({ok:true,data:{accepted:false}});
    try{room.partyGame=applyPartyControl(g,member.playerId,payload.input!,payload.seq!,now);lastPartyControl=now;if(acknowledged)transactions.dirty(room.code);callback({ok:true,data:{accepted:true}});}
    catch(error){fail(error instanceof Error?error.message:"Steuerung nicht möglich.");}
  }, true); // Arena controls are also sent without acknowledgements.
  withPayload("party:action", (payload: { seq?: number; phaseId?: number; token?: string; action?: PartyAction }, callback: (ack: Ack<RoomState>) => void) => {
    const member=socketMembership.get(socket.id),room=member?rooms.get(member.roomCode):undefined,g=room?.partyGame;
    if(!member||!room||!g||!validSession(room.code, member.playerId, payload.token))return callback({ok:false,error:"Die Inselparty-Sitzung ist nicht gültig."});
    if(!Number.isSafeInteger(payload.seq)||payload.seq!<1||!payload.action)return callback({ok:false,error:"Ungültige Aktion."});
    if(payload.seq! <= (g.seq[member.playerId]??0))return callback({ok:true,data:publicRoom(room,member.playerId)});
    if(payload.phaseId!==g.phaseId)return callback({ok:false,error:"Der Spielzug hat sich geändert. Bitte erneut wählen."});
    if((payload.action.type==="resume"||payload.action.type==="abort")&&room.hostId!==member.playerId)return callback({ok:false,error:"Nur der Host kann fortsetzen oder abbrechen."});
    if(g.competition&&payload.action.type==="next"&&room.hostId!==member.playerId)return callback({ok:false,error:"Nur der Host startet das nächste Minispiel."});
    try {room.partyGame=applyPartyAction(g,member.playerId,payload.action);room.partyGame.seq[member.playerId]=payload.seq!;broadcast(room);callback({ok:true,data:publicRoom(room,member.playerId)});closePartyRoom(room);}
    catch(error){callback({ok:false,error:error instanceof Error?error.message:"Aktion nicht möglich."});}
  });
  withPayload("kribbeln:roll", (payload: { keep?: number[] }, callback: (ack: Ack<RoomState>) => void) => {
    const member = socketMembership.get(socket.id);
    const room = member ? rooms.get(member.roomCode) : undefined;
    if (!member || !room?.kribbelnGame || room.phase !== "playing") return callback({ ok: false, error: "Die Partie ist nicht aktiv." });
    try { room.kribbelnGame = rollKribbeln(room.kribbelnGame, member.playerId, payload?.keep ?? []); broadcast(room); callback({ ok: true, data: publicRoom(room, member.playerId) }); }
    catch (error) { callback({ ok: false, error: error instanceof Error ? error.message : "Würfeln nicht möglich." }); }
  });
  withPayload("kribbeln:submit", (payload: { choice?: "score" | "skip" | "fallback" }, callback: (ack: Ack<RoomState>) => void) => {
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

  withPayload(
    "room:create",
    (payload: { playerId?: string; name?: string; gameId?: GameId; characterId?: unknown }, callback: (ack: Ack<RoomState>) => void) => {
      if (ownerPeer && socket.id !== ownerPeer) return callback({ok:false,error:"Nur das Host-Gerät kann Räume erstellen."});
      if(!isCharacterId(payload?.characterId))return callback({ok:false,error:"Wähle zuerst eine Spielfigur."});
      const playerId = cleanPlayerId(payload?.playerId);
      if (!playerId) return callback({ ok: false, error: "Ungültige Spieler-ID." });
      let game;
      try { game = getGame(payload.gameId ?? "qwixx"); }
      catch { return callback({ ok: false, error: "Unbekanntes Spiel." }); }
      if (game.status !== "ready") return callback({ ok: false, error: "Dieses Spiel ist noch nicht verfügbar." });
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
        config: { gameId: game.id, playerCount: game.minPlayers, durakCheatMode: false },
        phase: "lobby"
      };
      registerRoom(room);
      enterRoom(socket.id, room, playerId);
      callback({ ok: true, data: publicRoom(room, playerId) });
    }
  );

  withPayload(
    "room:join",
    (
      payload: { code?: string; playerId?: string; name?: string; sessionToken?: string; partyToken?: string; resumeOnly?: boolean; characterId?: unknown },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const code = cleanName(payload?.code, "").toUpperCase();
      const room = rooms.get(code);
      // Rooms stay open after a game: members (valid key, checked below) may come back to the
      // end screen and on to the lobby; newcomers are refused below until the room is a lobby again.
      if (!room) return callback({ ok: false, error: "Dieser Raum ist geschlossen oder wurde nicht gefunden." });
      const playerId = cleanPlayerId(payload?.playerId);
      if (!playerId) return callback({ ok: false, error: "Ungültige Spieler-ID." });
      let player = room.players.find(entry => entry.id === playerId);
      if (player?.bot || (room.partyTest && playerId !== room.hostId)) {
        return callback({ ok: false, error: "Dieser Platz ist nicht verfügbar." });
      }
      if (ownerPeer && socket.id !== ownerPeer && playerId === room.hostId) {
        return callback({ ok: false, error: "Dieser Platz gehört dem Host-Handy." });
      }
      const token = payload.sessionToken ?? payload.partyToken;
      if (player && !validSession(code, playerId, token)) {
        return callback({ ok: false, error: "Für den Wiederbeitritt brauchst du die ursprüngliche Sitzung." });
      }
      if (ownerPeer && !player && room.players.length >= getGame(room.config.gameId).maxPlayers) return callback({ok:false,error:"Alle Plätze sind belegt."});
      if (!player && (room.phase !== "lobby" || payload.resumeOnly)) return callback({ ok: false, error: "Die Partie läuft bereits." });

      const selectedCharacter = player && (room.phase === "playing" || payload.characterId === undefined)
        ? player.characterId : payload.characterId;
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
        // A new client can reserve its own random key before sending the join.
        // This also permits a secure retry if its first acknowledgement is lost.
        const key = typeof token === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
          ? token : randomUUID();
        roomTokens.get(code)!.set(playerId, key);
        room.players.push(player);
      }

      enterRoom(socket.id, room, playerId);
      const game = room.partyGame;
      if (game) {
        delete game.disconnected[playerId];
        if (!suspended && game.pausedAt && !Object.keys(game.disconnected).length) {
          shiftPartyClock(game, Date.now() - game.pausedAt);
          game.pausedAt = 0;
          game.resumeOffered = false;
        }
      }
      callback({ ok: true, data: publicRoom(room, playerId) });
      broadcast(room);
    }
  );

  withPayload(
    "room:configure",
    (
      payload: { gameId?: GameId; playerCount?: number; durakCheatMode?: boolean; party?: Partial<PartyOptions>; minigames?: Partial<MinigameOptions> },
      callback: (ack: Ack<RoomState>) => void
    ) => {
      const membership = socketMembership.get(socket.id);
      const room = membership ? rooms.get(membership.roomCode) : undefined;
      if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
      if (room.hostId !== membership.playerId) {
        return callback({ ok: false, error: "Nur der Host kann das Spiel einstellen." });
      }
      if(room.phase!=="lobby")return callback({ok:false,error:"Die Partie läuft bereits."});
      if(room.partyTest&&((payload.gameId&&payload.gameId!==room.config.gameId)||(payload.playerCount!==undefined&&payload.playerCount!==room.config.playerCount)))return callback({ok:false,error:"Spiel und Botanzahl des Testraums stehen bereits fest."});
      let options: PartyOptions;
      try { options=partyOptions(payload.party??room.config.party); } catch {return callback({ok:false,error:"Ungültige Inselparty-Einstellungen."});}
      let game;
      try { game=getGame(payload?.gameId??room.config.gameId); } catch {return callback({ok:false,error:"Unbekanntes Spiel."});}
      if(game.status!=="ready")return callback({ok:false,error:"Dieses Spiel ist noch nicht verfügbar."});
      let minis: MinigameOptions | undefined;
      try { minis = isMinigameMode(game.id) ? minigameOptions(payload.minigames ?? room.config.minigames) : room.config.minigames; }
      catch(error) { return callback({ok:false,error:error instanceof Error ? error.message : "Ungültige Minispiel-Einstellungen."}); }
      const requestedCount = payload.playerCount ?? room.config.playerCount;
      if(!Number.isInteger(requestedCount))return callback({ok:false,error:"Ungültige Spielerzahl."});
      const playerCount = Math.max(game.minPlayers, Math.min(game.maxPlayers, requestedCount));
      // Reject settings that could not start, so a room never fails at its start signal.
      try {
        if (minis && isMinigameMode(game.id)) checkMinigameSetup(game.id, minis, playerCount);
        else if (isPartyMode(game.id) && !miniPool(playerCount, options.classic ?? true).length) throw new Error("Ohne 1st Generation Minigames gibt es für diese Spielerzahl noch kein passendes Spiel.");
      } catch (error) { return callback({ok:false,error:error instanceof Error ? error.message : "Ungültige Minispiel-Einstellungen."}); }
      room.config = {
        gameId: game.id,
        playerCount,
        durakCheatMode: game.id === "durak" ? Boolean(payload.durakCheatMode ?? room.config.durakCheatMode) : false,
        party: options,
        minigames: minis
      };
      room.players.forEach((player) => {
        player.ready = Boolean(player.bot);
      });
      broadcast(room);
      callback({ ok: true, data: publicRoom(room, membership.playerId) });
    }
  );

  withoutPayload("room:ready", (callback: (ack: Ack<RoomState>) => void) => {
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

  withoutPayload("room:lobby", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    if (room.phase === "lobby") return callback({ ok: true, data: publicRoom(room, membership.playerId) });
    const over = room.game?.phase === "finished" || room.durakGame?.phase === "finished" || room.kribbelnGame?.finished
      || ["finished", "aborted"].includes(room.partyGame?.phase ?? "");
    if (!over || room.partyTest) return callback({ ok: false, error: "Die Partie läuft noch." });
    room.phase = "lobby";
    delete room.game; delete room.durakGame; delete room.kribbelnGame; delete room.partyGame;
    botDrivers.delete(room.code);
    moveSequences.set(room.code, new Map());
    room.players.forEach(player => { player.ready = Boolean(player.bot); player.score = 0; });
    broadcast(room);
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  // Leave a waiting lobby for good: the seat is freed instead of waiting for a rejoin.
  withoutPayload("room:leave", (callback: (ack: Ack<{ left: boolean }>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    if (room.phase !== "lobby") return callback({ ok: false, error: "Die Partie läuft noch." });
    if (ownerPeer && room.hostId === membership.playerId) {
      return callback({ ok: false, error: "Das Host-Handy kann die Party nur für alle beenden." });
    }
    for (const [id, member] of socketMembership) {
      if (member.roomCode === room.code && member.playerId === membership.playerId) {
        socketMembership.delete(id);
        hub.peer(id)?.leave(room.code);
      }
    }
    room.players = room.players.filter(player => player.id !== membership.playerId);
    roomTokens.get(room.code)?.delete(membership.playerId);
    moveSequences.get(room.code)?.delete(membership.playerId);
    const people = room.players.filter(player => !player.bot);
    if (!people.length) {
      forgetRoom(room.code);
      transactions.dirty(room.code);
      return callback({ ok: true, data: { left: true } });
    }
    if (room.hostId === membership.playerId) room.hostId = (people.find(player => player.connected) ?? people[0]).id;
    if (!people.some(player => player.connected)) emptySince.set(room.code, Date.now());
    broadcast(room);
    callback({ ok: true, data: { left: true } });
  });

  withoutPayload("room:close", (callback: (ack: Ack<{ closed: boolean }>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    if (room.hostId !== membership.playerId) return callback({ ok: false, error: "Nur der Host kann die Party für alle beenden." });
    if (room.phase !== "lobby") return callback({ ok: false, error: "Die Partie läuft noch. Beende sie zuerst im Spielmenü." });
    closeRoom(room, "closed");
    callback({ ok: true, data: { closed: true } });
  });

  withoutPayload("room:start", (callback: (ack: Ack<RoomState>) => void) => {
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

  withoutPayload("qwixx:roll", (callback: (ack: Ack<RoomState>) => void) => {
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

  withPayload(
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

  withPayload(
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

  withoutPayload("qwixx:state", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room) return callback({ ok: false, error: "Du bist in keinem Raum." });
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  withPayload("durak:attack", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = attackDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  withPayload("durak:defend", (payload: { attackCardId?: string; defenseCardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = defendDurak(room.durakGame!, playerId, payload.attackCardId ?? "", payload.defenseCardId ?? "");
    });
  });

  withPayload("durak:transfer", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = transferDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  withoutPayload("durak:take", (callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = takeDurak(room.durakGame!, playerId);
    });
  });

  withPayload("durak:throw-in", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = throwInDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  withoutPayload("durak:finish-bout", (callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = finishDurakBout(room.durakGame!, playerId);
    });
  });

  withPayload("durak:cheat-defend", (payload: { attackCardId?: string; defenseCardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = cheatDefendDurak(room.durakGame!, playerId, payload.attackCardId ?? "", payload.defenseCardId ?? "");
    });
  });

  withPayload("durak:cheat-throw-in", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = cheatThrowInDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  withPayload("durak:accuse", (payload: { cardId?: string }, callback: (ack: Ack<RoomState>) => void) => {
    runDurakAction(callback, (room, playerId) => {
      room.durakGame = accuseDurak(room.durakGame!, playerId, payload.cardId ?? "");
    });
  });

  withoutPayload("durak:state", (callback: (ack: Ack<RoomState>) => void) => {
    const membership = socketMembership.get(socket.id);
    const room = membership ? rooms.get(membership.roomCode) : undefined;
    if (!membership || !room || !room.durakGame) return callback({ ok: false, error: "Die Durak-Partie ist nicht aktiv." });
    callback({ ok: true, data: publicRoom(room, membership.playerId) });
  });

  socket.on("disconnect", () => { if (!stopping) void transactions.run(() => leaveRoom(socket.id)); });
});

  let suspended = false;
  let pulse = 0, ticking = false;
  let lastTick = Date.now();
  let nextCleanup = 0;
  function tick() {
    const now = Date.now();
    // Mobile operating systems may freeze the worker without a visibility event.
    // Treat that gap as a pause rather than simulating seconds of unseen movement.
    const gap = now - lastTick;
    lastTick = now;
    if (ownerPeer && gap > 1500) {
      for (const room of rooms.values()) {
        const game = room.partyGame;
        if (!game || game.pausedAt) continue;
        shiftPartyClock(game, gap);
        neutralizePartyInputs(game);
        broadcast(room);
      }
    }
    if (now >= nextCleanup) {
      nextCleanup = now + 30000;
      for (const [code, since] of emptySince) {
        const lifetime = rooms.get(code)?.phase === "lobby" ? 300000 : retentionMs;
        if (now - since >= lifetime) { forgetRoom(code); transactions.dirty(code); }
      }
    }
    pulse++;
    for (const room of rooms.values()) {
      const before = room.partyGame;
      if (!before || emptySince.has(room.code)) continue;
      const realtime = before.phase === "mini-play" && !!(before.mini?.arena || before.mini?.match) && !before.pausedAt;
      if (!realtime && pulse % 5 !== 0) continue;
      const withBots = room.partyTest ? botDrivers.get(room.code)!.step(before, now) : before;
      const after = tickParty(withBots, now);
      room.partyGame = after;
      if (realtime && after.phaseId === before.phaseId && after.mini?.match) {
        if (now - (checkpointAt.get(room.code) ?? 0) >= 1000) transactions.dirty(room.code);
        const match = after.mini.match;
        if (MATCH_MODULES[match.id as MatchId].meta.hz === 20 || pulse % 2 === 0) transactions.publish(() => {
          for (const id of hub.members(room.code) ?? []) {
            const viewer = socketMembership.get(id)?.playerId;
            if (viewer) hub.peer(id)?.emit("party:match", { code: room.code, phaseId: after.phaseId, match: publicMatch(match, viewer), serverTime: now });
          }
        });
      } else if (realtime && after.phaseId === before.phaseId && after.mini?.arena) {
        if (now - (checkpointAt.get(room.code) ?? 0) >= 1000) transactions.dirty(room.code);
        if (pulse % 2 === 0) transactions.publish(() => {
          for (const id of hub.members(room.code) ?? []) {
            const viewer = socketMembership.get(id)?.playerId;
            if (viewer) hub.peer(id)?.emit("party:arena", { code: room.code, phaseId: after.phaseId,
              arena: publicArena(after.mini!.arena!, viewer), serverTime: now });
          }
        });
      } else if (JSON.stringify(after) !== JSON.stringify(before)) {
        if (!ownerPeer && after.resumeOffered && !room.players.some(player => player.id === room.hostId && player.connected)) {
          room.hostId = room.players.find(player => player.connected && !player.bot)?.id ?? room.hostId;
        }
        broadcast(room);
        closePartyRoom(room);
      } else if (!after.pausedAt && (after.deadline || after.movement) && now - (checkpointAt.get(room.code) ?? 0) >= 1000) {
        transactions.dirty(room.code);
      }
    }
  }
  const partyClock = setInterval(() => {
    if (suspended || ticking || stopping || !transactions.available) return;
    ticking = true;
    void transactions.run(tick).finally(() => { ticking = false; });
  }, 50);
  partyClock.unref?.();
  return {
    get available() { return transactions.available; },
    get count() { return rooms.size; },
    async start() { await restore(await store.load(true)); transactions.available = true; },
    async suspend(hidden: boolean) {
      if (suspended === hidden) return;
      suspended = hidden;
      lastTick = Date.now();
      await transactions.run(() => {
        for (const room of rooms.values()) {
          const g = room.partyGame;
          if (g && hidden) {
            if (!g.pausedAt) g.pausedAt = Date.now();
            neutralizePartyInputs(g);
          }
          if (g && !hidden && g.pausedAt && !Object.keys(g.disconnected).length) {
            shiftPartyClock(g, Date.now() - g.pausedAt); g.pausedAt = 0; g.resumeOffered = false;
          }
          broadcast(room);
        }
      });
    },
    async stop() {
      stopping = true; clearInterval(partyClock); clearTimeout(recoverTimer);
      await transactions.drain();
      if (transactions.available) await transactions.run(() => {
        for (const room of rooms.values()) if (room.partyGame && !emptySince.has(room.code)) transactions.dirty(room.code);
      });
      transactions.available = false;
      store.close();
    }
  };
}
