import { useMemo, useState } from "react";
import { GAMES, getGame, isPartyMode } from "../../shared/games";
import type { GameId } from "../../shared/types";
import {CHARACTERS,isCharacterId,type CharacterId} from "../../shared/characters";
import {CharacterAvatar} from "../components/CharacterAvatar";
import { ScreenHeader } from "../components/ScreenHeader";
import { IslandWorld } from "../components/IslandWorld";

export function LocalSetupScreen({
  onBack,
  onTest,
  onStart
}: {
  onBack: () => void;
  onTest: () => void;
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
    setNames((current) => Array.from({ length: value }, (_, index) => current[index] ?? `Spieler ${index + 1}`));
  }

  return (
    <main className="page iw-menu local-setup screen-enter">
      <IslandWorld />
      <ScreenHeader title={settingUp ? game.name : "Lokal spielen"} onBack={settingUp ? () => setSettingUp(false) : onBack} />
      {settingUp ? <>
      <div className="page__content">
        <section className="iw-card local-setup__players">
          <h2 className="iw-plank iw-card__title">Spieler</h2>
        <div className="section-heading section-heading--row">
          <p className="iw-card__lead">Alle spielen an diesem Gerät.</p>
          <div className="stepper" aria-label="Spielerzahl">
            <button onClick={() => changeCount(Math.max(game.minPlayers, count - 1))} disabled={count <= game.minPlayers}>−</button>
            <strong>{count}</strong>
            <button onClick={() => changeCount(Math.min(game.maxPlayers, count + 1))} disabled={count >= game.maxPlayers}>+</button>
          </div>
        </div>

        <div className="player-fields">
          {visibleNames.map((name, index) => (
            <div className="local-player-setup" key={index}><label className="field field--player">
              <span className="player-number">{index + 1}</span>
              <input
                value={name}
                maxLength={24}
                aria-label={`Name von Spieler ${index + 1}`}
                onChange={(event) => {
                  const next = [...visibleNames];
                  next[index] = event.target.value;
                  setNames(next);
                }}
              />
            </label><label className="local-character-field"><CharacterAvatar id={characters[index]}/><span>Figur von Spieler {index+1}<select aria-label={`Figur von Spieler ${index+1}`} value={characters[index]??""} onChange={event=>{const id=event.target.value;if(isCharacterId(id))setCharacters(current=>{const next=[...current];next[index]=id;return next;});}}><option value="" disabled>Figur wählen</option>{CHARACTERS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></span></label></div>
          ))}
        </div>

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
        {GAMES.filter(entry => entry.status === "ready" && !isPartyMode(entry.id)).map(entry =>
          <button key={entry.id} onClick={() => {
            setGameId(entry.id);
            changeCount(Math.max(entry.minPlayers, Math.min(entry.maxPlayers, count)));
            setSettingUp(true);
          }}>
            <span className={`game-art game-art--${entry.id}`} aria-hidden="true"/>
            <span className="game-shelf__caption"><strong>{entry.name}</strong><small>{entry.minPlayers}–{entry.maxPlayers} Spieler · {entry.id === "durak" ? "Karten" : "Würfel"}</small></span>
          </button>
        )}
        <button onClick={onTest}><span className="game-art game-art--test" aria-hidden="true"/>
          <span className="game-shelf__caption"><strong>Minispiele testen</strong><small>Alleine gegen Bots</small></span>
        </button>
      </nav>}

    </main>
  );
}
