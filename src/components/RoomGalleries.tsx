import { useRef, type ReactNode } from "react";
import { CHARACTERS, characterName, type CharacterId } from "../../shared/characters";
import { GAMES, getGame } from "../../shared/games";
import type { GameId } from "../../shared/types";
import { GameCardFace } from "./GameCardFace";
import { CharacterAvatar } from "./CharacterAvatar";
import { MenuIcon } from "./MenuIcon";

function EntryGallery({title, selection, portrait, initiallyOpen = false, children}: {
  title: string; selection: string; portrait?: ReactNode; initiallyOpen?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  return <details className="host-gallery" name="room-entry-gallery" open={initiallyOpen} ref={ref}>
    <summary>{portrait}<span>{title}<strong>{selection}</strong></span><MenuIcon name="next"/></summary>
    <div className="game-shelf host-shelf" role="group" aria-label={title} onClick={event => {
      if (!(event.target instanceof Element) || !event.target.closest("button:enabled") || !ref.current) return;
      ref.current.open = false;
      ref.current.querySelector("summary")?.focus();
    }}>{children}</div>
  </details>;
}

export function GameGallery({gameId, disabled = false, initiallyOpen = false, onChange}: {
  gameId: GameId; disabled?: boolean; initiallyOpen?: boolean; onChange: (id: GameId) => void;
}) {
  return <EntryGallery title="Spiel auswählen" selection={getGame(gameId).name} initiallyOpen={initiallyOpen}>
        {GAMES.filter(game => game.status === "ready").map(game =>
          <button type="button" key={game.id} disabled={disabled} aria-pressed={game.id === gameId} onClick={() => onChange(game.id)}>
            <GameCardFace game={game}/>
          </button>
        )}
      </EntryGallery>;
}

export function CharacterGallery({characterId, disabled = false, onChange}: {
  characterId?: CharacterId; disabled?: boolean; onChange: (id: CharacterId) => void;
}) {
  return <EntryGallery title="Deine Spielfigur" selection={characterName(characterId)}
        portrait={<CharacterAvatar id={characterId} decorative/>}>
        {CHARACTERS.map(character =>
          <button type="button" key={character.id} disabled={disabled} aria-pressed={character.id === characterId}
            onClick={() => onChange(character.id)}>
            <CharacterAvatar id={character.id} decorative/>
            <span className="game-shelf__caption"><strong>{character.name}</strong></span>
          </button>
        )}
      </EntryGallery>;
}
