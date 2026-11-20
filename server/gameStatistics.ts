import type { InStatement } from "@libsql/client";
import type { RoomState } from "../shared/types";

/** Only completed, authoritative Node games count. A tie credits every winner. */
export function resultStatements(room: RoomState, owner: string): InStatement[] {
  if (!room.statisticsId || room.partyTest) return [];
  let participants: string[];
  let winners: string[];
  switch (room.config.gameId) {
    case "qwixx":
      if (room.game?.phase !== "finished") return [];
      participants = room.game.playerOrder; winners = room.game.winnerIds; break;
    case "durak":
      if (room.durakGame?.phase !== "finished") return [];
      participants = room.durakGame.playerOrder;
      winners = room.durakGame.durakId ? participants.filter(id => id !== room.durakGame!.durakId) : []; break;
    case "kribbeln":
      if (!room.kribbelnGame?.finished) return [];
      participants = room.kribbelnGame.order; winners = room.kribbelnGame.winners; break;
    default:
      if (room.partyGame?.phase !== "finished") return [];
      participants = room.partyGame.players.filter(player => !player.bot).map(player => player.id);
      winners = room.partyGame.winners;
  }
  return participants.filter(id => id.startsWith("acct_")).map(id => ({
    sql: `INSERT OR IGNORE INTO gsg_results(match_id,account_id,game_id,won)
      SELECT ?,id,?,? FROM gsg_accounts WHERE id=? AND EXISTS (SELECT 1 FROM gsg_writer WHERE id=1 AND owner=?)`,
    args: [room.statisticsId!, room.config.gameId, winners.includes(id) ? 1 : 0, id, owner]
  }));
}
