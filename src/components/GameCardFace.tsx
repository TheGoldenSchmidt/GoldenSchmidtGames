import type { GameDefinition } from "../../shared/types";

/** `players` replaces the player range, e.g. for games against bots on this device. */
export function GameCardFace({ game, players }: { game: GameDefinition; players?: string }) {
  const kind = { durak: "Karten", qwixx: "Würfel", kribbeln: "Würfel", party: "Brettspiel",
    "roll-it-up": "Brettspiel", "free-minigame": "Minispiel", goldenschmidt: "Wettbewerb", binokel: "Karten" }[game.id];
  return <>
    <span className={`game-art game-art--${game.id}`} aria-hidden="true"/>
    <span className="game-shelf__caption"><strong>{game.name}</strong><small>{players ?? `${game.minPlayers}–${game.maxPlayers} Spieler`} · {kind}</small></span>
  </>;
}
