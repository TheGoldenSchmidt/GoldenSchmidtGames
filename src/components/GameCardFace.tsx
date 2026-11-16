import type { GameDefinition } from "../../shared/types";

export function GameCardFace({ game }: { game: GameDefinition }) {
  const kind = { durak: "Karten", qwixx: "Würfel", kribbeln: "Würfel", party: "Brettspiel",
    "roll-it-up": "Brettspiel", "free-minigame": "Minispiel", goldenschmidt: "Wettbewerb", binokel: "Karten" }[game.id];
  return <>
    <span className={`game-art game-art--${game.id}`} aria-hidden="true"/>
    <span className="game-shelf__caption"><strong>{game.name}</strong><small>{game.minPlayers}–{game.maxPlayers} Spieler · {kind}</small></span>
  </>;
}
