import type { MatchId } from "../../shared/matches/framework";
import type { MatchClient } from "./client";
import { quickDrawClient } from "./games/quickDraw";
import { lightTrailsClient } from "./games/lightTrails";
import { neonPongClient } from "./games/neonPong";
import { tankTroubleClient } from "./games/tankTrouble";
import { bombArenaClient } from "./games/bombArena";
import { floorIsLavaClient } from "./games/floorIsLava";

/** Rendering and touch controls per match game; rules live in `shared/matches/`. */
export const MATCH_CLIENTS: Record<MatchId, MatchClient> = { quickdraw: quickDrawClient, trails: lightTrailsClient, pong: neonPongClient, tanks: tankTroubleClient, bombs: bombArenaClient, lava: floorIsLavaClient };
