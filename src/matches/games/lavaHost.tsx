import type { LavaHostGame } from "../../../shared/matches/lavaHost";
import { lavaFromSnap } from "../../../shared/matches/lavaSnap";
import type { MatchState } from "../../../shared/matches/types";
import type { MatchClient } from "../client";
import { floorIsLavaClient } from "./floorIsLava";

/**
 * Floor is Lava with "Unity · Host rechnet" in the web view: a device without Unity (no WebGL,
 * Unity failed) draws the host's reported snapshots with the normal Floor is Lava client.
 */
const asLava = (s: MatchState): MatchState => {
  const g = s.game as LavaHostGame;
  return { ...s, game: lavaFromSnap(g.snap, s.players.map(p => p.id), s.time) };
};

export const lavaHostClient: MatchClient = {
  ...floorIsLavaClient,
  render: (ctx, frame) => floorIsLavaClient.render(ctx, { ...frame, prev: asLava(frame.prev), cur: asLava(frame.cur) }),
  Controls: props => floorIsLavaClient.Controls({ ...props, view: asLava(props.view) }),
  status: (view, viewer) => floorIsLavaClient.status?.(asLava(view), viewer) ?? "",
  banner: (view, viewer) => floorIsLavaClient.banner?.(asLava(view), viewer),
  world: floorIsLavaClient.world && (() => floorIsLavaClient.world!().then(factory => (host, read, onError) =>
    factory(host, () => { const f = read(); return { ...f, prev: asLava(f.prev), cur: asLava(f.cur) }; }, onError)))
};
