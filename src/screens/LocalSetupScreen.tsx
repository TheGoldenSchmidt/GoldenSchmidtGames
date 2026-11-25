import { useMemo, useState } from "react";
import { GameTile } from "../components/GameTile";
import { GAMES, getGame, isPartyMode } from "../../shared/games";
import type { GameId } from "../../shared/types";
import {isCharacterId,type CharacterId} from "../../shared/characters";
import { CharacterGallery } from "../components/RoomGalleries";
import { ScreenHeader } from "../components/ScreenHeader";
import { IslandWorld } from "../components/IslandWorld";
import { UNITY_GAMES, UNITY_LOAD_NOTE, type UnityGameId } from "../unityGames";
import { MenuIcon } from "../components/MenuIcon";
import { useBackStep } from "../lib/backNavigation";

/** `games`: the main list; `unity`: Unity minigames and developer tools. */
export type LocalSection = "games" | "unity";

export function LocalSetupScreen({
  section = "games",
  onSection,
  onPractice,
  onUnity,
  onUnityRollItUp,
  onBack,
  onTest,
  onStart
}: {
  section?: LocalSection;
  onSection?: (section: LocalSection) => void;
  onPractice?: () => void;
  /** Unity test games (separate WebGL builds), open to everyone. */
  onUnity?: (id: UnityGameId) => void;
  /** Developer test: Roll It Up! against bots with the Unity board (admins and developers only). */
  onUnityRollItUp?: () => void;
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
  const unity = section === "unity" && !settingUp;
  // Back gesture: leave the player setup or the Unity list first.
  useBackStep(() => settingUp ? setSettingUp(false) : onSection?.("games"), settingUp || unity);
  const hasLab = Boolean(onPractice || onUnity || onUnityRollItUp);

  return (
    <main className="page iw-menu local-setup screen-enter">
      <IslandWorld />
      <ScreenHeader title={settingUp ? game.name : unity ? "Unity-Minispiele" : "Lokal spielen"} onBack={settingUp ? () => setSettingUp(false) : unity ? () => onSection?.("games") : onBack} />
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
      </> : unity ? <nav className="page__content game-shelf" aria-label="Unity-Minispiel auswählen">
        <p className="iw-note game-shelf__note">{UNITY_LOAD_NOTE}</p>
        {onUnity&&UNITY_GAMES.map(entry=><button key={entry.id} className="practice-entry iw-card" onClick={()=>onUnity(entry.id)}><strong>{entry.name}</strong><span>{entry.text}</span><small>{entry.note}</small></button>)}
        {(onPractice||onUnityRollItUp)&&<h2 className="iw-plank game-shelf__group">Entwicklung</h2>}
        {onUnityRollItUp&&<button className="practice-entry iw-card" onClick={onUnityRollItUp}><strong>Roll It Up! (Unity)</strong><span>Bauschale oder Grinder als Unity-Brett gegen Bots; Regeln und Minispiele wie im Original.</span><small>Nur Admin/Entwicklung</small></button>}
        {onPractice&&<button className="practice-entry iw-card" onClick={onPractice}><strong>Proberaum</strong><span>Eine Insel für Bewegung, Hindernisse und Animationen.</span><small>Ohne Zeitlimit · auch offline</small></button>}
      </nav> : <nav className="page__content game-shelf" aria-label="Spiel auswählen">
        <h2 className="iw-plank game-shelf__group">Allein mit Bots</h2>
        <p className="iw-note game-shelf__note">Läuft nur auf diesem Handy, auch ohne Internet.</p>
        {GAMES.filter(entry => entry.status === "ready" && isPartyMode(entry.id)).map(entry =>
          <GameTile key={entry.id} game={entry} players="1–5 Bots" onSelect={() => onTest(entry.id)}/>
        )}
        <h2 className="iw-plank game-shelf__group">Ein Handy für alle</h2>
        {GAMES.filter(entry => entry.status === "ready" && !isPartyMode(entry.id)).map(entry =>
          <GameTile key={entry.id} game={entry} onSelect={() => {
            setGameId(entry.id);
            changeCount(Math.max(entry.minPlayers, Math.min(entry.maxPlayers, count)));
            setSettingUp(true);
          }}/>
        )}
        {hasLab&&<button className="iw-slab iw-slab--stone shelf-slab" onClick={()=>onSection?.("unity")}>
          <span className="iw-slab__face"><MenuIcon name="crown"/><span className="shelf-slab__copy"><strong>Unity-Minispiele</strong><small>{UNITY_GAMES.length} Spiele gegen Bots{onPractice?" · Proberaum":""}</small></span><MenuIcon name="next"/></span>
        </button>}
      </nav>}

    </main>
  );
}
