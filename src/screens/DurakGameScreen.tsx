import {CharacterAvatar,playerCharacters} from "../components/CharacterAvatar";
import type {CharacterId} from "../../shared/characters";
import { useEffect, useMemo, useState } from "react";
import {
  DURAK_RANKS,
  DURAK_SUIT_NAMES,
  DURAK_SUIT_SYMBOLS,
  accuseDurak,
  attackDurak,
  canBeatDurak,
  canThrowInDurak,
  canTransferDurak,
  cheatDefendDurak,
  cheatThrowInDurak,
  createDurakGame,
  defendDurak,
  finishDurakBout,
  takeDurak,
  throwInDurak,
  transferDurak
} from "../../shared/durak";
import type { DurakCard, DurakGameState, GuestProfile, RoomState } from "../../shared/types";
import { Brand } from "../components/Brand";
import { sendGameMove, socket } from "../lib/socket";

function Card({ card, selected, playable, onClick }: { card: DurakCard; selected?: boolean; playable?: boolean; onClick?: () => void }) {
  const red = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <button
      className={`playing-card ${red ? "is-red" : ""} ${selected ? "is-selected" : ""} ${playable ? "is-playable" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${DURAK_SUIT_NAMES[card.suit]} ${card.rank}`}
    >
      <strong>{card.rank}</strong><span>{DURAK_SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}

function actorId(game: DurakGameState) {
  return game.phase === "defend" ? game.defenderId : game.attackerId;
}

export function DurakGameScreen({ profile, localNames, localCharacters, initialRoom, cheatMode = false, onExit, onLobby }: {
  profile: GuestProfile;
  localNames?: string[];
  localCharacters?:CharacterId[];
  initialRoom?: RoomState;
  cheatMode?: boolean;
  onExit: () => void;
  onLobby?: () => void;
}) {
  const characters=playerCharacters(initialRoom,localNames,localCharacters);
  const online = Boolean(initialRoom);
  const [room, setRoom] = useState(initialRoom);
  const [localGame, setLocalGame] = useState<DurakGameState | undefined>(() => localNames
    ? createDurakGame(localNames.map((name, index) => ({ id: `local-${index}`, name })), Math.random, cheatMode)
    : undefined);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [selectedAttackId, setSelectedAttackId] = useState("");
  const [error, setError] = useState("");
  const [revealedFor, setRevealedFor] = useState("");
  const game = online ? room?.durakGame : localGame;
  const viewerId = online ? profile.id : game ? actorId(game) : "";

  useEffect(() => {
    if (!online) return;
    const update = (nextRoom: RoomState) => setRoom(nextRoom);
    socket.on("room:updated", update);
    socket.emit("durak:state", (response: { ok: boolean; data?: RoomState }) => {
      if (response.ok && response.data) setRoom(response.data);
    });
    return () => { socket.off("room:updated", update); };
  }, [online]);

  useEffect(() => {
    setSelectedCardId("");
    setSelectedAttackId("");
  }, [game?.phase, game?.attackerId, game?.defenderId, game?.table.length]);

  useEffect(() => {
    if (!online) setRevealedFor("");
  }, [online, viewerId]);

  const hand = useMemo(() => [...(game?.hands[viewerId] ?? [])].sort((a, b) =>
    a.suit.localeCompare(b.suit) || DURAK_RANKS.indexOf(a.rank) - DURAK_RANKS.indexOf(b.rank)), [game, viewerId]);

  if (!game) return <main className="game-screen"><p>Die Durak-Partie wird geladen …</p></main>;
  const activeGame = game;

  const selectedCard = hand.find((card) => card.id === selectedCardId);
  const openAttacks = game.table.filter((pair) => !pair.defense);
  const targetAttackId = selectedAttackId || openAttacks[0]?.attack.id || "";
  const targetAttack = openAttacks.find((pair) => pair.attack.id === targetAttackId)?.attack;
  const isActor = viewerId === actorId(game);
  const canAttack = game.phase === "attack" && viewerId === game.attackerId;
  const canDefend = game.phase === "defend" && viewerId === game.defenderId;
  const canThrow = game.phase === "throw-in" && viewerId === game.attackerId;

  function handleResponse(response: { ok: boolean; data?: RoomState; error?: string }) {
    if (!response.ok) setError(response.error ?? "Aktion nicht möglich.");
    else if (response.data) setRoom(response.data);
  }

  function updateLocal(action: (current: DurakGameState) => DurakGameState) {
    setError("");
    try { if (localGame) setLocalGame(action(localGame)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktion nicht möglich."); }
  }

  function send(event: string, payload?: object) {
    setError("");
    sendGameMove(room, event, payload, (error, response) => {
      if (error) setError("Der Server antwortet gerade nicht.");
      else handleResponse(response);
    });
  }

  function playAttack() {
    if (!selectedCard) return;
    online ? send("durak:attack", { cardId: selectedCard.id }) : updateLocal((current) => attackDurak(current, viewerId, selectedCard.id));
  }

  function defend() {
    if (!selectedCard || !targetAttack) return;
    online
      ? send("durak:defend", { attackCardId: targetAttack.id, defenseCardId: selectedCard.id })
      : updateLocal((current) => defendDurak(current, viewerId, targetAttack.id, selectedCard.id));
  }

  function transfer() {
    if (!selectedCard) return;
    online ? send("durak:transfer", { cardId: selectedCard.id }) : updateLocal((current) => transferDurak(current, viewerId, selectedCard.id));
  }

  function take() {
    online ? send("durak:take") : updateLocal((current) => takeDurak(current, viewerId));
  }

  function throwIn() {
    if (!selectedCard) return;
    online ? send("durak:throw-in", { cardId: selectedCard.id }) : updateLocal((current) => throwInDurak(current, viewerId, selectedCard.id));
  }

  function finishBout() {
    online ? send("durak:finish-bout") : updateLocal((current) => finishDurakBout(current, viewerId));
  }

  function cheatDefend() {
    if (!selectedCard || !targetAttack) return;
    online
      ? send("durak:cheat-defend", { attackCardId: targetAttack.id, defenseCardId: selectedCard.id })
      : updateLocal((current) => cheatDefendDurak(current, viewerId, targetAttack.id, selectedCard.id));
  }

  function cheatThrowIn() {
    if (!selectedCard) return;
    online
      ? send("durak:cheat-throw-in", { cardId: selectedCard.id })
      : updateLocal((current) => cheatThrowInDurak(current, viewerId, selectedCard.id));
  }

  function accuse(cardId: string) {
    online
      ? send("durak:accuse", { cardId })
      : updateLocal((current) => accuseDurak(current, viewerId, cardId));
  }

  function phaseText() {
    if (activeGame.phase === "finished") return activeGame.durakId ? `${activeGame.playerNames[activeGame.durakId]} ist der Durak.` : "Unentschieden – niemand ist der Durak.";
    if (!isActor) return `Warte auf ${activeGame.playerNames[actorId(activeGame)]} …`;
    if (activeGame.phase === "attack") return "Wähle eine Karte für den Angriff.";
    if (activeGame.phase === "defend") return "Decke den Angriff, schiebe ihn weiter oder nimm die Karten auf.";
    return activeGame.defenderTakes ? "Du darfst noch passende Karten nachlegen oder die Runde beenden." : "Lege passend nach oder beende die erfolgreiche Verteidigung.";
  }

  return (
    <main className="durak-screen screen-enter">
      {!online && game.phase !== "finished" && revealedFor !== viewerId && (
        <section className="durak-handoff">
          <div>
            <span aria-hidden="true">🂠</span>
            <h1>Gerät weitergeben</h1>
            <p><CharacterAvatar id={characters[viewerId]}/><strong>{game.playerNames[viewerId]}</strong> ist jetzt am Zug.</p>
            <button className="button button--primary button--wide" onClick={() => setRevealedFor(viewerId)}>Karten anzeigen</button>
          </div>
        </section>
      )}
      <header className="game-header durak-header">
        <Brand compact />
        <span className="game-header__mode">{online ? `Online · ${room!.code}` : "Lokal"}</span>
        <button className="text-button" onClick={onExit}>Beenden</button>
      </header>

      <section className="durak-status">
        <div className="durak-trump"><small>Trumpf</small><strong>{DURAK_SUIT_SYMBOLS[game.trumpSuit]}</strong></div>
        <div><strong>{game.playerNames[viewerId] ?? "Zuschauer"}{game.cheatMode && <em className="cheat-badge">Schummeln an</em>}</strong><p>{phaseText()}</p></div>
        <div className="durak-deck"><strong>{game.deck.length}</strong><small>Karten</small></div>
      </section>

      {game.log.length > 0 && <p className="durak-event" role="status">{game.log[game.log.length - 1]}</p>}

      <section className="durak-players" aria-label="Spieler">
        {game.playerOrder.map((id) => (
          <div className={`${id === game.attackerId ? "is-attacker" : ""} ${id === game.defenderId ? "is-defender" : ""} ${game.finishedPlayerIds.includes(id) ? "is-finished" : ""}`} key={id}>
            <CharacterAvatar id={characters[id]}/>
            <strong>{game.playerNames[id]}</strong>
            <small>{game.finishedPlayerIds.includes(id) ? "Fertig" : `${game.handCounts[id]} Karten`}</small>
          </div>
        ))}
      </section>

      <section className="durak-table" aria-label="Kartentisch">
        {game.table.length === 0 ? <p>Der Tisch ist frei.</p> : game.table.map((pair) => (
          <div
            className={`durak-pair ${targetAttackId === pair.attack.id && !pair.defense ? "is-target" : ""}`}
            key={pair.attack.id}
            onClick={() => !pair.defense && canDefend && setSelectedAttackId(pair.attack.id)}
            role={!pair.defense && canDefend ? "button" : undefined}
            tabIndex={!pair.defense && canDefend ? 0 : undefined}
          >
            <Card card={pair.attack} />
            {pair.defense && <span className="durak-defense"><Card card={pair.defense} /></span>}
            {game.cheatMode && !game.accusationUsedPlayerIds.includes(viewerId) && (
              <span className="durak-accusations">
                {pair.attackPlayedBy !== viewerId && <button onClick={(event) => { event.stopPropagation(); accuse(pair.attack.id); }}>Angriff melden</button>}
                {pair.defense && pair.defensePlayedBy !== viewerId && <button onClick={(event) => { event.stopPropagation(); accuse(pair.defense!.id); }}>Abwehr melden</button>}
              </span>
            )}
          </div>
        ))}
      </section>

      {game.phase !== "finished" && (
        <section className="durak-hand-wrap">
          <div className="durak-hand" aria-label={`Handkarten von ${game.playerNames[viewerId]}`}>
            {hand.map((card) => {
              const playable = canAttack
                || (canDefend && Boolean(targetAttack && canBeatDurak(targetAttack, card, game.trumpSuit)))
                || canTransferDurak(game, viewerId, card.id)
                || canThrowInDurak(game, viewerId, card.id);
              return <Card key={card.id} card={card} selected={card.id === selectedCardId} playable={playable} onClick={isActor ? () => setSelectedCardId(card.id) : undefined} />;
            })}
          </div>
          <div className="durak-actions">
            {canAttack && <button className="button button--primary" disabled={!selectedCard} onClick={playAttack}>Angreifen</button>}
            {canDefend && <>
              <button className="button button--primary" disabled={!selectedCard || !targetAttack || !canBeatDurak(targetAttack, selectedCard, game.trumpSuit)} onClick={defend}>Decken</button>
              <button className="button button--secondary" disabled={!selectedCard || !canTransferDurak(game, viewerId, selectedCard.id)} onClick={transfer}>Weiterschieben</button>
              {game.cheatMode && !game.cheatBannedPlayerIds.includes(viewerId) && selectedCard && targetAttack && !canBeatDurak(targetAttack, selectedCard, game.trumpSuit) && <button className="button button--danger" onClick={cheatDefend}>Schummeln: Decken</button>}
              <button className="button button--ghost" onClick={take}>Aufnehmen</button>
            </>}
            {canThrow && <>
              <button className="button button--secondary" disabled={!selectedCard || !canThrowInDurak(game, viewerId, selectedCard.id)} onClick={throwIn}>Nachlegen</button>
              {game.cheatMode && !game.cheatBannedPlayerIds.includes(viewerId) && selectedCard && !canThrowInDurak(game, viewerId, selectedCard.id) && game.table.length < game.maxAttackCards && <button className="button button--danger" onClick={cheatThrowIn}>Schummeln: Nachlegen</button>}
              <button className="button button--primary" onClick={finishBout}>Runde beenden</button>
            </>}
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>
      )}

      {game.phase === "finished" && (
        <section className="result-sheet">
          <span className="result-sheet__seal">♠</span>
          <h1>Partie beendet</h1>
          <p>{phaseText()}</p>
          <ol>{game.finishedPlayerIds.map((id, index) => <li key={id}><span><CharacterAvatar id={characters[id]} decorative/>{index + 1}. {game.playerNames[id]}</span><strong>kartenfrei</strong></li>)}</ol>
          <button className="button button--secondary button--wide" onClick={onLobby ?? onExit}>{onLobby ? "Zurück zur Lobby" : "Zum Startmenü"}</button>
        </section>
      )}
    </main>
  );
}
