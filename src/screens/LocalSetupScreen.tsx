import { useMemo, useState } from "react";
import { GAMES, getGame } from "../../shared/games";
import type { GameId } from "../../shared/types";
import {CHARACTERS,isCharacterId,type CharacterId} from "../../shared/characters";
import {CharacterAvatar} from "../components/CharacterAvatar";
import { ScreenHeader } from "../components/ScreenHeader";

export function LocalSetupScreen({
  onBack,
  onStart
}: {
  onBack: () => void;
  onStart: (gameId: GameId, names: string[], options?: { durakCheatMode: boolean; characters:CharacterId[] }) => void;
}) {
  const [gameId, setGameId] = useState<GameId>("qwixx");
  const game = getGame(gameId);
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
    <main className="page screen-enter">
      <ScreenHeader title="Lokal spielen" onBack={onBack} />
      <section className="page__content">
        <div className="section-heading">
          <h2>Spiel auswählen</h2>
          <p>Weitere Spiele kommen als eigene Module hinzu.</p>
        </div>

        <div className="game-choices">
          {GAMES.filter(entry=>entry.id!=="party").map((entry) => (
            <button
              className={`game-choice game-choice--${entry.id} ${entry.id === gameId ? "is-selected" : ""}`}
              key={entry.id}
              disabled={entry.status !== "ready"}
              onClick={() => {
                setGameId(entry.id);
                changeCount(Math.max(entry.minPlayers, Math.min(entry.maxPlayers, count)));
              }}
            >
              <span className={`game-choice__tile game-choice__tile--${entry.id}`} aria-hidden="true">
                {entry.id === "qwixx" ? "2–12" : entry.id === "durak" ? "♠" : entry.id === "kribbeln" ? "⚄" : entry.id === "party" ? "⚑" : "B"}
              </span>
              <span>
                <strong>{entry.name}{entry.status === "soon" && <em>Bald</em>}</strong>
                <small>{entry.shortDescription}</small>
              </span>
              {entry.status === "ready" && <span className="check" aria-label="Ausgewählt">✓</span>}
            </button>
          ))}
        </div>

        <div className="section-heading section-heading--row">
          <div>
            <h2>Spieler</h2>
            <p>Alle spielen an diesem Gerät.</p>
          </div>
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
      <div className="sticky-action">
        <button className="button button--primary button--wide" disabled={visibleNames.some((_,i)=>!isCharacterId(characters[i]))} onClick={() => onStart(gameId, visibleNames.map((name, index) => name.trim() || `Spieler ${index + 1}`), { durakCheatMode, characters:characters.slice(0,count) as CharacterId[] })}>
          {game.name} starten
        </button>
      </div>
    </main>
  );
}
