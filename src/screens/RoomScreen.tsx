import { isPartyMode } from "../../shared/games";
import { useEffect, useMemo, useState } from "react";
import { GAMES, getGame } from "../../shared/games";
import type { GameId, GuestProfile, RoomState } from "../../shared/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { HostInvite } from "../nearby/Pairing";
import { socket } from "../lib/socket";
import { PartySettings } from "../components/PartySettings";
import { MinigameSettings } from "../components/MinigameSettings";
import { isMinigameMode, type MinigameOptions } from "../../shared/minigameModes";
import type { PartyOptions } from "../../shared/party";
import { PartyCharacterPicker } from "../components/PartyCharacterPicker";
import {CharacterAvatar} from "../components/CharacterAvatar";
import {preloadFigures} from "../figures/catalog";
import { CHARACTERS, characterId, type CharacterId } from "../../shared/characters";

export function RoomScreen({
  profile,
  initialRoom,
  onBack,
  onGameStart
}: {
  profile: GuestProfile;
  initialRoom: RoomState;
  onBack: () => void;
  onGameStart: (room: RoomState) => void;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [chooseFigure,setChooseFigure]=useState(false);
  const isHost = room.hostId === profile.id;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const readyCount = room.players.filter((player) => player.connected && player.ready).length;
  const currentPlayerReady = room.players.find((player) => player.id === profile.id)?.ready ?? false;
  const game = getGame(room.config.gameId);
  const options = useMemo(
    () => Array.from({ length: game.maxPlayers - game.minPlayers + 1 }, (_, index) => game.minPlayers + index),
    [game]
  );

  useEffect(() => {
    const update = (nextRoom: RoomState) => setRoom(nextRoom);
    const start = (nextRoom: RoomState) => onGameStart(nextRoom);
    socket.on("room:updated", update);
    socket.on("game:started", start);
    return () => {
      socket.off("room:updated", update);
      socket.off("game:started", start);
    };
  }, [onGameStart]);

  useEffect(()=>{void preloadFigures(room.players.map(p=>p.characterId)).catch(()=>{});},[room.players.map(p=>p.characterId).join()]);

  function configure(gameId: GameId, playerCount: number, durakCheatMode = room.config.durakCheatMode ?? false, party:PartyOptions|undefined=room.config.party, minigames:MinigameOptions|undefined=room.config.minigames) {
    setError("");
    socket.emit("room:configure", { gameId, playerCount, durakCheatMode, party, minigames }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) setError(response.error ?? "Einstellung konnte nicht gespeichert werden.");
    });
  }

  function toggleReady() {
    socket.emit("room:ready", (response: { ok: boolean; error?: string }) => {
      if (!response.ok) setError(response.error ?? "Status konnte nicht geändert werden.");
    });
  }

  function chooseCharacter(id:CharacterId){setError("");socket.timeout(8000).emit("room:character",{characterId:id},(err:Error|null,response:{ok:boolean;data?:RoomState;error?:string})=>{if(err||!response.ok||!response.data)setError(response?.error??"Die Figur konnte nicht gespeichert werden.");else setRoom(response.data);});}

  async function copyCode() {
    await navigator.clipboard?.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="page party-menu screen-enter">
      <ScreenHeader title="Lobby" onBack={onBack} />
      <section className="page__content room">
        {socket.tableRoute?.role==="host" && !room.partyTest && <HostInvite code={room.code}/>}
        {room.partyTest?<div className="party-test-notice"><strong>Deine Testpartie</strong><br/>Du und {room.players.filter(p=>p.bot).length} Bots. Nur du musst dich bereit melden.</div>:socket.tableRoute?<div className="room-code"><small>Handy-Tisch · Beitritt per QR beim Host</small><strong>{room.code}</strong></div>:<button className="room-code" onClick={copyCode} aria-label="Raumcode kopieren">
          <small>{copied ? "Code kopiert" : "Raumcode antippen zum Kopieren"}</small>
          <strong>{room.code}</strong>
        </button>}

        <button className="lobby-character-button" onClick={()=>setChooseFigure(value=>!value)} aria-expanded={chooseFigure}><CharacterAvatar id={room.players.find(p=>p.id===profile.id)?.characterId}/><span><small>Deine Spielfigur</small><strong>{CHARACTERS.find(c=>c.id===room.players.find(p=>p.id===profile.id)?.characterId)?.name}</strong></span><b>{chooseFigure?"Figurenwahl schließen":"Spielfigur ändern"}</b></button>
        {chooseFigure&&<PartyCharacterPicker value={room.players.find(p=>p.id===profile.id)?.characterId} index={Math.max(0,room.players.findIndex(p=>p.id===profile.id))} onChange={chooseCharacter}/>}

        <div className="section-heading section-heading--row">
          <div>
            <h2>Mitspieler</h2>
            <p>{connectedCount} von {room.config.playerCount} Plätzen besetzt</p>
          </div>
          <span className="live-badge"><i /> Live</span>
        </div>

        <div className="player-list">
          {room.players.map((player) => (
            <div className={`player-row ${!player.connected ? "is-disconnected" : ""}`} key={player.id}>
              <CharacterAvatar id={player.characterId} className="player-avatar"/>
              <span className="player-row__name">
                <strong>{player.name}{player.id === profile.id ? " (du)" : ""}</strong>
                <small>{player.bot?"Bot":player.id === room.hostId ? "Host" : player.connected ? "Verbunden" : "Verbindung getrennt"}{` · ${CHARACTERS.find(c=>c.id===characterId(player.characterId,room.players.indexOf(player)))!.name}`}</small>
              </span>
              <span className={`ready-mark ${player.ready ? "is-ready" : ""}`}>{player.ready ? "Bereit" : "Wartet"}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, room.config.playerCount - connectedCount) }, (_, index) => (
            <div className="player-row player-row--empty" key={`empty-${index}`}>
              <span className="player-avatar">+</span>
              <span className="player-row__name"><strong>Freier Platz</strong><small>{socket.tableRoute?"Beim Host per QR verbinden":"Code teilen und einladen"}</small></span>
            </div>
          ))}
        </div>

        <div className="lobby-config">
          <label className="lobby-config__game">
            <span>Ausgewähltes Spiel</span>
            <select
              value={room.config.gameId}
              disabled={!isHost||Boolean(room.partyTest)}
              onChange={(event) => {
                const nextGame = getGame(event.target.value as GameId);
                configure(nextGame.id, Math.max(nextGame.minPlayers, Math.min(nextGame.maxPlayers, room.config.playerCount)));
              }}
            >
              {GAMES.filter((entry) => entry.status === "ready").map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Spielerzahl</span>
            <select value={room.config.playerCount} disabled={!isHost||Boolean(room.partyTest)} onChange={(event) => configure(room.config.gameId, Number(event.target.value))}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        {isMinigameMode(room.config.gameId)
          ? <MinigameSettings mode={room.config.gameId} value={room.config.minigames} players={room.config.playerCount} disabled={!isHost} onChange={value=>configure(room.config.gameId,room.config.playerCount,false,room.config.party,value)}/>
          : isPartyMode(room.config.gameId) && <PartySettings rollItUp={room.config.gameId==="roll-it-up"} characterId={room.players.find(p=>p.id===profile.id)?.characterId} value={room.config.party} disabled={!isHost} onChange={value=>configure(room.config.gameId,room.config.playerCount,false,value)}/>}
        {room.config.gameId === "durak" && (
          <label className="option-toggle">
            <span><strong>Schummelmodus</strong><small>Regelwidrig decken oder nachlegen – auf eigenes Risiko.</small></span>
            <input
              type="checkbox"
              checked={room.config.durakCheatMode ?? false}
              disabled={!isHost}
              onChange={(event) => configure("durak", room.config.playerCount, event.target.checked)}
            />
          </label>
        )}

        <button
          className={`button button--wide ${currentPlayerReady ? "button--secondary" : "button--primary"}`}
          onClick={toggleReady}
          disabled={connectedCount !== room.config.playerCount}
        >
          {connectedCount !== room.config.playerCount
            ? `Warte auf ${room.config.playerCount - connectedCount} Spieler`
            : currentPlayerReady
              ? `Bereit (${readyCount}/${room.config.playerCount})`
              : "Ich bin bereit"}
        </button>
        <p className="lobby-status">
          {connectedCount === room.config.playerCount
            ? `Das Spiel startet automatisch, sobald alle ${room.config.playerCount} Spieler bereit sind.`
            : "Sobald alle Plätze besetzt sind, können sich alle Spieler bereit melden."}
        </p>
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
