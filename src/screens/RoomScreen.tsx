import { useEffect, useMemo, useState } from "react";
import { GAMES, getGame } from "../../shared/games";
import type { GameId, GuestProfile, RoomState } from "../../shared/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { socket } from "../lib/socket";

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
  const isHost = room.hostId === profile.id;
  const connectedCount = room.players.filter((player) => player.connected).length;
  const canStart = connectedCount === room.config.playerCount;
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

  function configure(gameId: GameId, playerCount: number) {
    socket.emit("room:configure", { gameId, playerCount }, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) setError(response.error ?? "Einstellung konnte nicht gespeichert werden.");
    });
  }

  function toggleReady() {
    socket.emit("room:ready", (response: { ok: boolean; error?: string }) => {
      if (!response.ok) setError(response.error ?? "Status konnte nicht geändert werden.");
    });
  }

  function startGame() {
    setError("");
    socket.emit("room:start", (response: { ok: boolean; data?: RoomState; error?: string }) => {
      if (!response.ok) setError(response.error ?? "Die Partie konnte nicht gestartet werden.");
    });
  }

  async function copyCode() {
    await navigator.clipboard?.writeText(room.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="page screen-enter">
      <ScreenHeader title="Spielraum" onBack={onBack} />
      <section className="page__content room">
        <button className="room-code" onClick={copyCode} aria-label="Raumcode kopieren">
          <small>{copied ? "Code kopiert" : "Raumcode antippen zum Kopieren"}</small>
          <strong>{room.code}</strong>
        </button>

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
              <span className="player-avatar">{player.name.slice(0, 1).toUpperCase()}</span>
              <span className="player-row__name">
                <strong>{player.name}{player.id === profile.id ? " (du)" : ""}</strong>
                <small>{player.id === room.hostId ? "Host" : player.connected ? "Verbunden" : "Verbindung getrennt"}</small>
              </span>
              <span className={`ready-mark ${player.ready ? "is-ready" : ""}`}>{player.ready ? "Bereit" : "Wartet"}</span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, room.config.playerCount - connectedCount) }, (_, index) => (
            <div className="player-row player-row--empty" key={`empty-${index}`}>
              <span className="player-avatar">+</span>
              <span className="player-row__name"><strong>Freier Platz</strong><small>Code teilen und einladen</small></span>
            </div>
          ))}
        </div>

        <div className="lobby-config">
          <label className="lobby-config__game">
            <span>Ausgewähltes Spiel</span>
            <select
              value={room.config.gameId}
              disabled={!isHost}
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
            <select value={room.config.playerCount} disabled={!isHost} onChange={(event) => configure(room.config.gameId, Number(event.target.value))}>
              {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        {!isHost && (
          <button className={`button button--wide ${room.players.find((player) => player.id === profile.id)?.ready ? "button--secondary" : "button--primary"}`} onClick={toggleReady}>
            {room.players.find((player) => player.id === profile.id)?.ready ? "Nicht bereit" : "Ich bin bereit"}
          </button>
        )}

        {isHost && (
          <button className="button button--primary button--wide" onClick={startGame} disabled={!canStart}>
            {canStart ? "Partie starten" : `Warte auf ${room.config.playerCount - connectedCount} Spieler`}
          </button>
        )}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
    </main>
  );
}
