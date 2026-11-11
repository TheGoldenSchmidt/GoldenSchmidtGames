import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { createSpielraumServer } from "../server/index";
import type { PartyAction } from "../shared/party";
import type { RoomState } from "../shared/types";
import { PLAYABLE_MINI_IDS } from "../shared/minigameCatalog";
import { NEUTRAL_MATCH_INPUT } from "../shared/matches/types";

const server = createSpielraumServer(), port = await server.listen(0), sockets: Socket[] = [];
const request = <T = RoomState>(s: Socket, event: string, payload?: unknown) => new Promise<T>((resolve, reject) => {
  const context = new Error(`${event} request`);
  const callback = (err: Error | null, r: {ok:boolean;data?:T;error?:string}) => err ? reject(Object.assign(context, { message: `${event}: ${err.message}` })) : !r.ok ? reject(new Error(r.error)) : resolve(r.data!);
  if(payload === undefined) s.timeout(5000).emit(event, callback); else s.timeout(5000).emit(event, payload, callback);
});
async function connect() {
  const s = io(`http://127.0.0.1:${port}`, {transports:["websocket"],forceNew:true,reconnection:false}); sockets.push(s);
  await new Promise<void>((resolve,reject)=>{s.once("connect",resolve);s.once("connect_error",reject);}); return s;
}
try {
  for(const mode of ["free-minigame", "goldenschmidt"] as const) {
    const host = await connect(), guest = await connect(), ids = [randomUUID(), randomUUID()];
    let room = await request(host, "room:create", {playerId:ids[0],name:"Anna",characterId:"alpha_rick_prime"});
    await request(guest,"room:join",{code:room.code,playerId:ids[1],name:"Ben",characterId:"alpha_morty_smith"});
    await assert.rejects(request(guest,"room:configure",{gameId:mode,minigames:{rounds:2}}));
    for(const minigames of [{rounds:0},{rounds:PLAYABLE_MINI_IDS.length+1},{rounds:1.5},{miniId:"missing"},{classic:"nein"}]) await assert.rejects(request(host,"room:configure",{gameId:mode,minigames}));
    await request(host,"room:configure",{gameId:mode,playerCount:2,minigames:{rounds:2,miniId:"hurdles"}});
    await request(host,"room:ready"); room = await request(guest,"room:ready");
    const tokens = [(await request(host,"qwixx:state")).partyToken!, room.partyToken!];
    const clients = [host, guest];
    const send = async (i:number, action:PartyAction) => {
      const current = await request(clients[i],"qwixx:state");
      room = await request(clients[i],"party:action",{token:tokens[i],phaseId:current.partyGame!.phaseId,seq:(current.partyGame!.seq[ids[i]]??0)+1,action});
    };
    for(let round=1;round<=(mode === "free-minigame" ? 1 : 2);round++) {
      if(mode === "goldenschmidt") {
        assert.equal(room.partyGame!.phase,"mini-bet");
        const packet = {token:tokens[0],phaseId:room.partyGame!.phaseId,seq:(room.partyGame!.seq[ids[0]]??0)+1,action:{type:"bet",value:round}};
        await assert.rejects(request(host,"party:action",{...packet,token:tokens[1]}));
        await request(host,"party:action",packet); await request(host,"party:action",packet);
        const hidden = await request(clients[1],"qwixx:state");
        assert.equal(hidden.partyGame!.competition!.bets[ids[0]],undefined);
        assert.equal(hidden.partyGame!.competition!.used[ids[0]].length,round-1);
        assert.ok(hidden.partyGame!.competition!.locked.includes(ids[0]));
        // A committed hidden bet survives disconnection and authenticated rejoin.
        clients[1].disconnect(); await new Promise(r=>setTimeout(r,80));
        const returned = await connect();
        await assert.rejects(request(returned,"room:join",{code:room.code,playerId:ids[1],sessionToken:tokens[0]}));
        room = await request(returned,"room:join",{code:room.code,playerId:ids[1],sessionToken:tokens[1]});
        clients[1] = returned;
        assert.equal(room.partyGame!.competition!.bets[ids[0]],undefined);
        assert.equal(room.partyGame!.pausedAt,0);
        await send(1,{type:"bet",value:round});
        assert.equal(room.partyGame!.competition!.bets[ids[0]],round);
        await assert.rejects(send(0,{type:"bet",value:round}));
      } else assert.equal(room.partyGame!.mini!.id,"hurdles");
      for(let i=0;i<2;i++) await send(i,{type:"ready"});
      assert.equal((room.partyGame!.mini!.arena?.actors ?? room.partyGame!.mini!.match!.players).length,2);
      await new Promise(r=>setTimeout(r,Math.max(0,room.partyGame!.mini!.startAt-Date.now()+100)));
      for(let i=0;i<2;i++) {
        await request(clients[i],"party:control",{token:tokens[i],phaseId:room.partyGame!.phaseId,seq:1,input:room.partyGame!.mini!.match?{...NEUTRAL_MATCH_INPUT,x:.1}:{x:.1,z:0,jump:false,punch:false}});
      }
      for(let i=0;i<2;i++) if(room.partyGame!.phase==="mini-play") await send(i,{type:"finish"}); // match games end with one player left
      assert.equal(room.partyGame!.competition!.history.length,round);
      if(mode === "goldenschmidt" && round === 1) {
        assert.equal(room.partyGame!.phase,"mini-result");
        await assert.rejects(send(1,{type:"next"})); await send(0,{type:"next"});
        await assert.rejects(send(0,{type:"bet",value:1}));
      }
    }
    assert.equal(room.partyGame!.phase,"finished");
    assert.ok(room.partyGame!.winners.length > 0);
    await assert.rejects(request(host,"room:join",{code:room.code,playerId:ids[0],sessionToken:tokens[0]}));
  }
  console.log("Minispielmodi online erfolgreich: Konfiguration, beide Spielstarts, verdeckte und doppelte Einsätze, Sitzungsschutz, Wiederbeitritt, Host-Wechsel der Runde und Raumabschluss.");
} finally { sockets.forEach(s=>s.disconnect()); await server.close(); }
