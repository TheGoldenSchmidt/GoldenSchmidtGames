import { useRef, useState, type ReactNode } from "react";
import { CHARACTERS, characterName, type CharacterId } from "../../shared/characters";
import { GAMES, getGame } from "../../shared/games";
import type { GameId } from "../../shared/types";
import { GameTile } from "./GameTile";
import { CharacterPreview } from "./CharacterPreview";
import { CharacterAvatar } from "./CharacterAvatar";
import { MenuIcon } from "./MenuIcon";

function EntryGallery({title, selection, portrait, initiallyOpen = false, preview, children}: {
  title: string; selection: string; portrait?: ReactNode; initiallyOpen?: boolean; preview?: ReactNode; children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  return <details className="host-gallery" name="room-entry-gallery" open={initiallyOpen} ref={ref} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{portrait}<span>{title}<strong>{selection}</strong></span><MenuIcon name="next"/></summary>
    {open && preview}
    <div className="game-shelf host-shelf" role="group" aria-label={title} onClick={event => {
      if (!(event.target instanceof Element) || !event.target.closest("button:enabled[aria-pressed]") || !ref.current) return;
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
          <GameTile key={game.id} game={game} disabled={disabled} selected={game.id === gameId} onSelect={() => onChange(game.id)}/>
        )}
      </EntryGallery>;
}

export function CharacterGallery({characterId, previewIndex, title = "Deine Spielfigur", disabled = false, onChange}: {
  characterId?: CharacterId; previewIndex?: number; title?: string; disabled?: boolean; onChange: (id: CharacterId) => void;
}) {
  return <EntryGallery title={title} selection={characterName(characterId)}
        preview={previewIndex !== undefined && characterId && <CharacterPreview value={characterId} index={previewIndex}/>}
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
