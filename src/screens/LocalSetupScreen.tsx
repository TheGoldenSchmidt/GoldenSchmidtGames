import { useMemo, useState } from "react";
import { GameTile } from "../components/GameTile";
import { GAMES, getGame, isPartyMode } from "../../shared/games";
import type { GameId } from "../../shared/types";
import {isCharacterId,type CharacterId} from "../../shared/characters";
import { CharacterGallery } from "../components/RoomGalleries";
import { ScreenHeader } from "../components/ScreenHeader";
import { IslandWorld } from "../components/IslandWorld";

export function LocalSetupScreen({
  onBack,
  onTest,
  onStart
}: {
  onBack: () => void;
  /** Party modes run with bots on this device (local table host, also offline). */
  onTest: (gameId: GameId) => void;
  onStart: (gameId: GameId, names: string[], options?: { durakCheatMode: boolean; characters:CharacterId[] }) => void;
}) {
  const [gameId, setGameId] = useState<GameId>("qwixx");
  const game = getGame(gameId);
  const [settingUp, setSettingUp] = useState(false);
  const [count, setCount] = useState(2);
  const [characters,setCharacters]=useState<Array<CharacterId|undefined>>([]);
  const [names, setNames] = useState(["Spieler 1", "Spieler 2"]);
  const [durakCheatMode, setDurakCheatMode] = useState(false);

  const visibleNames = useMemo(
    () => Array.from({ length: count }, (_, index) => names[index] ?? `Spieler ${index + 1}`),
    [count, names]
  );

  function changeCount(value: number) {
    setCount(value);
  }

  return (
    <main className="page iw-menu local-setup screen-enter">
      <IslandWorld />
      <ScreenHeader title={settingUp ? game.name : "Lokal spielen"} onBack={settingUp ? () => setSettingUp(false) : onBack} />
      {settingUp ? <>
      <div className="page__content">
        <section className="local-setup__players" aria-label="Mitspieler">
          <div className="local-player-count">
            <h2>Spielerzahl</h2>
            <div className="stepper">
              <button aria-label="Spieler entfernen" onClick={() => changeCount(count - 1)} disabled={count <= game.minPlayers}>−</button>
              <strong aria-live="polite">{count}</strong>
              <button aria-label="Spieler hinzufügen" onClick={() => changeCount(count + 1)} disabled={count >= game.maxPlayers}>+</button>
            </div>
          </div>
          {visibleNames.map((name, index) => (
            <div className="local-player-setup" key={index}>
              <label className="local-player-name">
                <span>Spieler {index + 1}</span>
                <input value={name} maxLength={24} aria-label={`Name von Spieler ${index + 1}`}
                  onChange={event => {
                    const next = [...names];
                    next[index] = event.target.value;
                    setNames(next);
                  }}/>
              </label>
              <CharacterGallery title={`Figur von Spieler ${index + 1}`} characterId={characters[index]} previewIndex={index}
                onChange={id => {
                  const next = [...characters];
                  next[index] = id;
                  setCharacters(next);
                }}/>
            </div>
          ))}

        {gameId === "durak" && (
          <label className="option-toggle">
            <span><strong>Schummelmodus</strong><small>Erlaubt bewusst falsches Decken und Nachlegen mit Verdachtsmeldungen.</small></span>
            <input type="checkbox" checked={durakCheatMode} onChange={(event) => setDurakCheatMode(event.target.checked)} />
          </label>
        )}
        </section>
      </div>
      <div className="sticky-action">
        <button className="button button--primary button--wide" disabled={visibleNames.some((_,i)=>!isCharacterId(characters[i]))} onClick={() => onStart(gameId, visibleNames.map((name, index) => name.trim() || `Spieler ${index + 1}`), { durakCheatMode, characters:characters.slice(0,count) as CharacterId[] })}>
          {game.name} starten
        </button>
      </div>
      </> : <nav className="page__content game-shelf" aria-label="Spiel auswählen">
        <h2 className="iw-plank game-shelf__group">Ein Handy für alle</h2>
        {GAMES.filter(entry => entry.status === "ready" && !isPartyMode(entry.id)).map(entry =>
          <GameTile key={entry.id} game={entry} onSelect={() => {
            setGameId(entry.id);
            changeCount(Math.max(entry.minPlayers, Math.min(entry.maxPlayers, count)));
            setSettingUp(true);
          }}/>
        )}
        <h2 className="iw-plank game-shelf__group">Allein mit Bots</h2>
        <p className="iw-note game-shelf__note">Läuft nur auf diesem Handy, auch ohne Internet.</p>
        {GAMES.filter(entry => entry.status === "ready" && isPartyMode(entry.id)).map(entry =>
          <GameTile key={entry.id} game={entry} players="1–5 Bots" onSelect={() => onTest(entry.id)}/>
        )}
      </nav>}

    </main>
  );
}
