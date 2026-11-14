import type { MatchId } from "../../shared/matches/framework";
import type { MatchClient } from "./client";
import { preloadFigures } from "../figures/catalog";
import { quickDrawClient } from "./games/quickDraw";
import { lightTrailsClient } from "./games/lightTrails";
import { neonPongClient } from "./games/neonPong";
import { tankTroubleClient, tankViewClient } from "./games/tankTrouble";
import { bombArenaClient } from "./games/bombArena";
import { floorIsLavaClient } from "./games/floorIsLava";
import { bumperClient, sumoClient } from "./games/ringArena";
import { chaosRunClient } from "./games/chaosRun";
import { arrowMastersClient } from "./games/arrowMasters";
import { towerTumbleClient } from "./games/towerTumble";
import { hookWarsClient } from "./games/hookWars";

/** Rendering and touch controls per match game; rules live in `shared/matches/`. */
export const MATCH_CLIENTS: Record<MatchId, MatchClient> = { quickdraw: quickDrawClient, trails: lightTrailsClient, pong: neonPongClient, tanks: tankTroubleClient, tankview: tankViewClient, bombs: bombArenaClient, lava: floorIsLavaClient, sumo: sumoClient, bumpercars: bumperClient, chaosrun: chaosRunClient, arrows: arrowMastersClient, tower: towerTumbleClient, hooks: hookWarsClient };

/** Loads a 3D match world and its figures ahead of time (during the minigame intro). */
export function preloadMatchWorld(id: string, characters: readonly unknown[]) {
  const client = MATCH_CLIENTS[id as MatchId];
  if (!client?.world) return;
  void client.world().catch(() => undefined);
  void preloadFigures(characters).catch(() => undefined);
}
