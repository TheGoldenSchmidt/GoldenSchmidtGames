import { useEffect, useMemo, useState, type CSSProperties } from "react";
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
import { socket } from "../lib/socket";

const PIPS: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9]
};

function DieFace({ value }: { value: number }) {
  return (
    <span className={`die-face die-face--${value}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i className={PIPS[value].includes(index + 1) ? "is-on" : ""} key={index} />
      ))}
    </span>
  );
}

function Die({ value, color, index }: { value: number | null; color: "white" | QwixxColor; index: number }) {
  const style = { "--roll-delay": `${index * 55}ms` } as CSSProperties;
  if (value === null) {
    return <span className={`die-scene die-scene--${color} is-removed`} aria-label={`${color} entfernt`}><span>×</span></span>;
  }
  return (
    <span className={`die-scene die-scene--${color}`} style={style} aria-label={`${color} ${value}`}>
      <span className={`die-cube die-cube--show-${value}`}>
        {[1, 2, 3, 4, 5, 6].map((face) => <DieFace value={face} key={face} />)}
      </span>
    </span>
  );
}

function hasAnswered(game: QwixxGameState, playerId: string) {
  return Object.prototype.hasOwnProperty.call(game.whiteChoices, playerId);
}

export function QwixxGameScreen({
  profile,
  localNames,
  initialRoom,
  onExit
}: {
  profile: GuestProfile;
  localNames?: string[];
  initialRoom?: RoomState;
  onExit: () => void;
}) {
  const online = Boolean(initialRoom);
  const [room, setRoom] = useState(initialRoom);
  const [localGame, setLocalGame] = useState<QwixxGameState | undefined>(() =>
    localNames
      ? createQwixxGame(localNames.map((name, index) => ({ id: `local-${index}`, name })))
      : undefined
  );
  const [error, setError] = useState("");

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

  if (!game || !sheet) {
    return <main className="game-screen"><p>Die Partie wird geladen …</p></main>;
  }

  const activeName = game.sheets[activeId].playerName;
  const ownWhiteAnswer = hasAnswered(game, viewerId);
  const canRoll = game.phase === "awaiting-roll" && (!online || activeId === profile.id);
  const canChooseWhite = game.phase === "white-choice" && !ownWhiteAnswer;
  const canChooseColor = game.phase === "color-choice" && (!online || activeId === profile.id);

  function handleResponse(response: { ok: boolean; data?: RoomState; error?: string }) {
    if (!response.ok) setError(response.error ?? "Die Aktion konnte nicht ausgeführt werden.");
    else if (response.data) setRoom(response.data);
  }

  function roll() {
    setError("");
    navigator.vibrate?.(35);
    if (online) socket.emit("qwixx:roll", handleResponse);
    else setLocalGame((current) => current ? rollQwixx(current, activeId) : current);
  }

  function chooseWhite(color: QwixxColor | null) {
    setError("");
    if (online) socket.emit("qwixx:white-choice", { color }, handleResponse);
    else setLocalGame((current) => current ? submitWhiteChoice(current, viewerId, color) : current);
  }

  function chooseColor(choice: QwixxColorChoice | null) {
    setError("");
    if (online) socket.emit("qwixx:color-choice", { choice }, handleResponse);
    else setLocalGame((current) => current ? submitColorChoice(current, activeId, choice) : current);
  }

  function selectableChoice(color: QwixxColor, value: number) {
    if (canChooseWhite && value === whiteSum && canMark(sheet!, color, value, game!.closedRows)) {
      return { kind: "white" as const };
    }
    if (canChooseColor) {
      const choice = colorChoices.find((entry) => entry.color === color && entry.value === value);
      if (choice) return { kind: "color" as const, choice };
    }
    return null;
  }

  function phaseText() {
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

  return (
    <main className="qwixx-screen screen-enter">
      <header className="game-header qwixx-header">
        <Brand compact />
        <span className="game-header__mode">{online ? `Online · ${room!.code}` : `Runde ${game.round}`}</span>
        <button className="text-button" onClick={onExit}>Beenden</button>
      </header>

      <section className="qwixx-turn" aria-live="polite">
        <span className="qwixx-turn__avatar">{sheet.playerName.slice(0, 1).toUpperCase()}</span>
        <div><strong>{sheet.playerName}</strong><p>{phaseText()}</p></div>
      </section>

      <section className={`dice-tray ${game.dice ? "has-result" : ""}`} aria-label="Virtuelle Würfelkiste">
        <span className="dice-tray__label">Würfelkiste</span>
        {game.dice ? (
          <>
            <div className="dice-group">
              <Die value={game.dice.white[0]} color="white" index={0} />
              <Die value={game.dice.white[1]} color="white" index={1} />
              {QWIXX_COLORS.map((color, index) => <Die key={color} value={game.dice!.colors[color]} color={color} index={index + 2} />)}
            </div>
            <strong className="white-total"><span>Weiß</span>{whiteSum}</strong>
          </>
        ) : (
          <div className="dice-tray__empty">
            <span aria-hidden="true">⚄</span>
            <p>Sechs Würfel warten auf den nächsten Wurf.</p>
          </div>
        )}
      </section>

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
        {canRoll && <button className="button button--primary button--wide" onClick={roll}>Würfeln</button>}
        {game.phase === "awaiting-roll" && !canRoll && <p className="waiting-note">Warte auf {activeName} …</p>}
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

      {game.phase === "finished" && (
        <section className="result-sheet" aria-labelledby="result-title">
          <span className="result-sheet__seal" aria-hidden="true">✓</span>
          <h1 id="result-title">Partie beendet</h1>
          <p>{game.winnerIds.length > 1 ? "Gleichstand an der Spitze" : `${game.sheets[game.winnerIds[0]].playerName} gewinnt`}</p>
          <ol>
            {standings.map((entry) => (
              <li className="result-player" key={entry.id}>
                <div className="result-player__total"><span>{entry.name}</span><strong>{entry.score} Punkte</strong></div>
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
          <button className="button button--secondary button--wide" onClick={onExit}>Zum Startmenü</button>
        </section>
      )}
    </main>
  );
}
