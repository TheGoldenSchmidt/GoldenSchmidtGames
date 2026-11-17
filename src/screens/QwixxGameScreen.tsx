import {CharacterAvatar,playerCharacters} from "../components/CharacterAvatar";
import type {CharacterId} from "../../shared/characters";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  QWIXX_COLORS,
  QWIXX_COLOR_NAMES,
  QWIXX_ROWS,
  activePlayerId,
  availableColorChoices,
  canMark,
  createQwixxGame,
  rollQwixx,
  sheetScoreBreakdown,
  sheetScore,
  submitColorChoice,
  submitWhiteChoice,
  type QwixxColorChoice
} from "../../shared/qwixx";
import type { GuestProfile, QwixxColor, QwixxGameState, RoomState } from "../../shared/types";
import { Brand } from "../components/Brand";
import { DiceCupTable, DICE_CUP_ROLL_DURATION, type DiceCupHandle } from "../components/DiceCupTable";
import { QwixxDice } from "../components/QwixxDice";
import { QwixxArenaWorld, type QwixxArenaAction } from "../components/QwixxArenaWorld";
import { GameIntroActive } from "../components/GameIntro";
import { sendGameMove, socket } from "../lib/socket";

function hasAnswered(game: QwixxGameState, playerId: string) {
  return Object.prototype.hasOwnProperty.call(game.whiteChoices, playerId);
}

export function QwixxGameScreen({
  profile,
  localNames,
  localCharacters,
  initialRoom,
  onExit,
  onLobby
}: {
  profile: GuestProfile;
  localNames?: string[];
  localCharacters?:CharacterId[];
  initialRoom?: RoomState;
  onExit: () => void;
  onLobby?: () => void;
}) {
  const online = Boolean(initialRoom);
  const introActive = useContext(GameIntroActive);
  const [room, setRoom] = useState(initialRoom);
  const [localGame, setLocalGame] = useState<QwixxGameState | undefined>(() =>
    localNames
      ? createQwixxGame(localNames.map((name, index) => ({ id: `local-${index}`, name })))
      : undefined
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false), [preparing, setPreparing] = useState(false);
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const requestLock = useRef(false), cup = useRef<DiceCupHandle>(null);

  useEffect(() => {
    if (!online) return;
    const update = (nextRoom: RoomState) => setRoom(nextRoom);
    socket.on("room:updated", update);
    socket.emit("qwixx:state", (response: { ok: boolean; data?: RoomState }) => {
      if (response.ok && response.data) setRoom(response.data);
    });
    return () => { socket.off("room:updated", update); };
  }, [online]);

  const game = online ? room?.game : localGame;
  const turnKey = `${game?.round}-${game?.turnIndex}`;
  const rollKey = `${turnKey}-${game?.dice ? 1 : 0}`;
  const [settledRollKey, setSettledRollKey] = useState(rollKey);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const rolling = Boolean(game?.dice && settledRollKey !== rollKey && !reducedMotion);
  const busy = pending || preparing || rolling;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!game?.dice || reducedMotion) { setSettledRollKey(rollKey); return; }
    const timer = window.setTimeout(() => setSettledRollKey(rollKey), DICE_CUP_ROLL_DURATION);
    return () => window.clearTimeout(timer);
  }, [rollKey, reducedMotion]);
  const activeId = game ? activePlayerId(game) : "";
  const pendingLocalId = game?.phase === "white-choice"
    ? game.playerOrder.find((id) => !hasAnswered(game, id))
    : undefined;
  const viewerId = online ? profile.id : (pendingLocalId ?? activeId);
  const sheet = game?.sheets[viewerId];
  const whiteSum = game?.dice ? game.dice.white[0] + game.dice.white[1] : null;
  const colorChoices = useMemo(
    () => game ? availableColorChoices(game, viewerId) : [],
    [game, viewerId]
  );
  const characters=useMemo(() => playerCharacters(room,localNames,localCharacters), [room, localNames, localCharacters]);
  const arenaSignature = game?.playerOrder.map(id => `${id}:${game.sheets[id].playerName}:${characters[id] ?? ""}`).join("|") ?? "";
  const arenaPlayers = useMemo(() => game?.playerOrder.map(id => ({ id, name: game.sheets[id].playerName, characterId: characters[id] })) ?? [], [arenaSignature]);
  useEffect(() => { setSelectedDice([]); }, [rollKey, game?.phase, viewerId]);

  if (!game || !sheet) {
    return <main className="game-screen"><p>Die Partie wird geladen …</p></main>;
  }

  const activeName = game.sheets[activeId].playerName;
  const activeGame = game;
  const ownTurn = !online || activeId === profile.id;
  const ownWhiteAnswer = hasAnswered(game, viewerId);
  const canRoll = game.phase === "awaiting-roll" && ownTurn && !pending && !rolling;
  const canChooseWhite = game.phase === "white-choice" && !ownWhiteAnswer && !busy;
  const canChooseColor = game.phase === "color-choice" && ownTurn && !busy;
  const availableDiceIds = ["white-1", "white-2", ...QWIXX_COLORS.filter(color => !game.closedRows.includes(color))];
  const selectableDiceIds = game.dice && !busy ? canChooseWhite ? ["white-1", "white-2"] : canChooseColor ? availableDiceIds : [] : [];
  const selectedWhite = selectedDice.find(id => id.startsWith("white-"));
  const selectedColor = selectedDice.find(id => !id.startsWith("white-")) as QwixxColor | undefined;
  const selectedCombination = game.dice && selectedWhite && selectedColor ? {
    color: selectedColor,
    value: game.dice.white[selectedWhite === "white-1" ? 0 : 1] + (game.dice.colors[selectedColor] ?? 0)
  } : undefined;

  function send(event: string, payload?: object) {
    requestLock.current = true; setPending(true);
    const done = (timeout: Error | null, response?: { ok: boolean; data?: RoomState; error?: string }) => {
      requestLock.current = false; setPending(false);
      if (timeout) setError("Der Server antwortet nicht.");
      else if (!response?.ok) setError(response?.error ?? "Die Aktion konnte nicht ausgeführt werden.");
      else if (response.data) setRoom(response.data);
    };
    sendGameMove(room, event, payload, done);
  }

  function updateLocal(action: () => QwixxGameState) {
    try { setLocalGame(action()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktion nicht möglich."); }
  }

  function roll() {
    if (!canRoll || requestLock.current) return;
    setError("");
    try { navigator.vibrate?.(35); } catch { /* Haptik ist optional. */ }
    if (online) send("qwixx:roll");
    else updateLocal(() => rollQwixx(activeGame, activeId));
  }

  function chooseWhite(color: QwixxColor | null) {
    if (!canChooseWhite || requestLock.current) return;
    setError("");
    if (online) send("qwixx:white-choice", { color });
    else updateLocal(() => submitWhiteChoice(activeGame, viewerId, color));
  }

  function chooseColor(choice: QwixxColorChoice | null) {
    if (!canChooseColor || requestLock.current) return;
    setError("");
    if (online) send("qwixx:color-choice", { choice });
    else updateLocal(() => submitColorChoice(activeGame, activeId, choice));
  }

  function selectableChoice(color: QwixxColor, value: number) {
    if (canChooseWhite && value === whiteSum && canMark(sheet!, color, value, game!.closedRows)) {
      return { kind: "white" as const };
    }
    if (canChooseColor) {
      const choice = colorChoices.find((entry) => entry.color === color && entry.value === value);
      if (choice && (!selectedCombination || (choice.color === selectedCombination.color && choice.value === selectedCombination.value))) return { kind: "color" as const, choice };
    }
    return null;
  }

  function selectDie(id: string) {
    if (!selectableDiceIds.includes(id)) return;
    if (canChooseWhite) {
      setSelectedDice(current => current.length === 2 ? [] : ["white-1", "white-2"]);
      return;
    }
    setSelectedDice(current => {
      const sameKind = id.startsWith("white-") ? current.filter(value => !value.startsWith("white-")) : current.filter(value => value.startsWith("white-"));
      return current.includes(id) ? sameKind : [...sameKind, id];
    });
  }

  function phaseText() {
    if (preparing) return "Die Würfel kommen in den Becher …";
    if (rolling) return "Die Würfel fliegen aus dem Becher …";
    if (pending) return "Warte auf die Bestätigung vom Tisch …";
    if (game!.phase === "awaiting-roll") {
      return activeId === viewerId ? "Du bist am Zug. Würfle alle verfügbaren Würfel." : `${activeName} ist am Zug.`;
    }
    if (game!.phase === "white-choice") {
      if (ownWhiteAnswer) return "Auswahl gespeichert. Die anderen entscheiden noch.";
      return `${sheet!.playerName}: Trage die weiße Summe ${whiteSum} ein oder passe.`;
    }
    if (game!.phase === "color-choice") {
      if (activeId !== viewerId) return `${activeName} wählt noch eine Farbkombination.`;
      return `${activeName}: Kombiniere einen weißen mit einem farbigen Würfel.`;
    }
    return "Die Partie ist beendet.";
  }

  const standings = [...game.playerOrder]
    .map((id) => {
      const playerSheet = game.sheets[id];
      const breakdown = sheetScoreBreakdown(playerSheet);
      return { id, name: playerSheet.playerName, score: breakdown.total, breakdown };
    })
    .sort((a, b) => b.score - a.score);
  const arenaAction: QwixxArenaAction = preparing ? "gathering" : rolling ? "throwing" : game.phase === "awaiting-roll" ? "waiting" : "choosing";

  return (
    <main className="qwixx-screen screen-enter">
      <header className="game-header qwixx-header">
        <Brand compact />
        <span className="game-header__mode">{online ? `Online · ${room!.code}` : `Runde ${game.round}`}</span>
        {/* Online the result sheet leads back to the lobby; the room is left from there. */}
        {!(game.phase === "finished" && onLobby) && <button className="text-button" onClick={onExit}>Beenden</button>}
      </header>

      <div className="qwixx-play">
      <section className="qwixx-arena" aria-label="Qwixx-Arena">
      {!introActive && <QwixxArenaWorld players={arenaPlayers} activeId={activeId} action={arenaAction} reducedMotion={reducedMotion}/>}
      <section className="qwixx-turn" aria-live="polite">
        <CharacterAvatar id={characters[activeId]} className="qwixx-turn__avatar"/>
        <div><strong>{activeName}</strong><p>{phaseText()}</p></div>
      </section>
      <div className="qwixx-table-side">
        <DiceCupTable ref={cup} className="dice-tray qwixx-cup-table" label="Virtuelle Würfelkiste" hasResult={Boolean(game.dice)}
          availableCount={6 - game.closedRows.length} rolling={rolling} pending={pending} canRoll={canRoll} canAct={ownTurn && game.phase !== "finished"}
          reducedMotion={reducedMotion} rollKey={rollKey} turnKey={turnKey} onRoll={roll} onPreparingChange={setPreparing}
          idleText={game.phase === "awaiting-roll" ? "Schütteln und wischen. Oder einfach Würfeln." : "Erst die weiße Summe, dann die Farbaktion."}
          renderDice={({ cupRef, inCup }) => <QwixxDice dice={game.dice} closedRows={game.closedRows} rolling={rolling} inCup={inCup} cupRef={cupRef} rollKey={rollKey}
            selectableIds={selectableDiceIds} selectedIds={selectedDice} onSelect={selectDie} />} />
        <div className="qwixx-cup-controls">
          <p className="qwixx-white-sum" role="status"><span>Weiße Summe</span><strong>{rolling || preparing ? "…" : whiteSum ?? "–"}</strong></p>
          {ownTurn && (game.phase === "awaiting-roll" || busy) && <button className="button button--primary button--wide" disabled={busy || !canRoll} onClick={() => cup.current?.roll()}>{preparing ? "Becher schütteln …" : pending ? "Warte auf den Tisch …" : rolling ? "Würfel rollen …" : "Würfeln"}</button>}
          {game.phase === "awaiting-roll" && !ownTurn && <p className="waiting-note">Warte auf {activeName} …</p>}
        </div>
      </div>
      {game.dice && !rolling && (canChooseWhite || canChooseColor) && <p className="qwixx-arena__choice" role="status">
        {canChooseWhite ? selectedDice.length === 2 ? "Weiße Würfel genommen – wähle unten eine Reihe." : "Nimm die weißen Würfel oder wähle direkt auf der Karte."
          : selectedCombination ? `${QWIXX_COLOR_NAMES[selectedCombination.color]} ${selectedCombination.value} gewählt – unten eintragen.` : "Nimm einen weißen und einen farbigen Würfel."}
      </p>}
      </section>
      <div className="qwixx-score-side">

      <section className="qwixx-sheet" aria-label={`Wertungsblatt von ${sheet.playerName}`}>
        {QWIXX_COLORS.map((color) => {
          const rowMarks = sheet.marks[color];
          const lastMarked = Math.max(-1, ...rowMarks);
          const globallyClosed = game.closedRows.includes(color);
          return (
            <div className={`qwixx-row qwixx-row--${color} ${globallyClosed ? "is-closed" : ""}`} key={color}>
              <span className="qwixx-row__name">{QWIXX_COLOR_NAMES[color]}</span>
              <div className="qwixx-row__cells">
                {QWIXX_ROWS[color].map((value, index) => {
                  const marked = rowMarks.includes(index);
                  const skipped = !marked && index < lastMarked;
                  const selectable = selectableChoice(color, value);
                  return (
                    <button
                      className={`qwixx-cell ${marked ? "is-marked" : ""} ${skipped ? "is-skipped" : ""} ${selectable ? "is-selectable" : ""}`}
                      key={value}
                      disabled={!selectable}
                      onClick={() => selectable?.kind === "white" ? chooseWhite(color) : selectable && chooseColor(selectable.choice)}
                      aria-label={`${QWIXX_COLOR_NAMES[color]} ${value}${marked ? ", angekreuzt" : skipped ? ", übersprungen" : selectable ? ", auswählbar" : ""}`}
                    >
                      {marked ? "×" : value}
                    </button>
                  );
                })}
                <span className={`qwixx-lock ${sheet.locks.includes(color) ? "is-marked" : ""}`} aria-label={`Schloss ${QWIXX_COLOR_NAMES[color]}`}>
                  {sheet.locks.includes(color) ? "×" : "◆"}
                </span>
              </div>
            </div>
          );
        })}

        <div className="qwixx-sheet__footer">
          <div className="failed-throws">
            <span>Fehlwürfe</span>
            <div>{[0, 1, 2, 3].map((index) => <i className={index < sheet.failedThrows ? "is-marked" : ""} key={index}>{index < sheet.failedThrows ? "×" : ""}</i>)}</div>
          </div>
          <div className="current-score"><span>Aktuell</span><strong>{sheetScore(sheet)}</strong></div>
        </div>
      </section>

      <section className="qwixx-actions">
        {canChooseWhite && <button className="button button--ghost button--wide" onClick={() => chooseWhite(null)}>Weiße Aktion auslassen</button>}
        {game.phase === "white-choice" && ownWhiteAnswer && <p className="waiting-note">Entscheidung gespeichert · warte auf die Mitspieler</p>}
        {canChooseColor && (
          <button className="button button--ghost button--wide" onClick={() => chooseColor(null)}>
            {game.whiteChoices[activeId] === null ? "Auslassen und Fehlwurf nehmen" : "Zweite Aktion auslassen"}
          </button>
        )}
        {game.phase === "color-choice" && !canChooseColor && <p className="waiting-note">Warte auf {activeName} …</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </section>
      </div>
      </div>

      {game.phase === "finished" && (
        <section className="result-sheet" aria-labelledby="result-title">
          <span className="result-sheet__seal" aria-hidden="true">✓</span>
          <h1 id="result-title">Partie beendet</h1>
          <p>{game.winnerIds.length > 1 ? "Gleichstand an der Spitze" : `${game.sheets[game.winnerIds[0]].playerName} gewinnt`}</p>
          <ol>
            {standings.map((entry) => (
              <li className="result-player" key={entry.id}>
                <div className="result-player__total"><span><CharacterAvatar id={characters[entry.id]} decorative/>{entry.name}</span><strong>{entry.score} Punkte</strong></div>
                <div className="result-player__breakdown" aria-label={`Punkte von ${entry.name}`}>
                  {QWIXX_COLORS.map((color) => (
                    <span className={`result-color result-color--${color}`} key={color}>
                      {QWIXX_COLOR_NAMES[color]} <strong>{entry.breakdown.colors[color]}</strong>
                    </span>
                  ))}
                  <span className="result-penalty">Fehlwürfe <strong>−{entry.breakdown.failedThrowPenalty}</strong></span>
                </div>
              </li>
            ))}
          </ol>
          <button className="button button--secondary button--wide" onClick={onLobby ?? onExit}>{onLobby ? "Zurück zur Lobby" : "Zum Startmenü"}</button>
        </section>
      )}
    </main>
  );
}
