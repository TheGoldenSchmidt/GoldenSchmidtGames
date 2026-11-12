import {CharacterAvatar,playerCharacters} from "../components/CharacterAvatar";
import type {CharacterId} from "../../shared/characters";
import { useEffect, useRef, useState } from "react";
import { canEnterKribbelSum, createKribbelnGame, KRIBBEL_ROWS, kribbelTaskMet, rollKribbeln, submitKribbeln, type KribbelnGame } from "../../shared/kribbeln";
import { KRIBBEL_ROLL_DURATION } from "../components/KribbelnDice";
import { KribbelnTable, type KribbelnCupHandle } from "../components/KribbelnTable";
import { KribbelnTask } from "../components/KribbelnTask";
import type { GuestProfile, RoomState } from "../../shared/types";
import { sendGameMove, socket } from "../lib/socket";

export function KribbelnGameScreen({ profile, localNames, localCharacters, initialRoom, onExit, onLobby }: { profile: GuestProfile; localNames?: string[]; localCharacters?:CharacterId[]; initialRoom?: RoomState; onExit: () => void; onLobby?: () => void }) {
  const characters=playerCharacters(initialRoom,localNames,localCharacters);
  const online = Boolean(initialRoom);
  const [room, setRoom] = useState(initialRoom);
  const [local, setLocal] = useState<KribbelnGame | undefined>(() => localNames ? createKribbelnGame(localNames.map((name, i) => ({ id: `local-${i}`, name }))) : undefined);
  const [kept, setKept] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const cup = useRef<KribbelnCupHandle>(null);
  const requestLock = useRef(false);
  const game = online ? room?.kribbelnGame : local;
  const rollKey = `${game?.row}-${game?.playerIndex}-${game?.rolls}`;
  const [settledRollKey, setSettledRollKey] = useState(rollKey);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const rolling = Boolean(game?.rolls && settledRollKey !== rollKey && !reducedMotion);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!online) return;
    const update = (next: RoomState) => setRoom(next);
    socket.on("room:updated", update);
    socket.emit("qwixx:state", (response: { ok: boolean; data?: RoomState }) => {
      if (response.ok && response.data) setRoom(response.data);
    });
    return () => { socket.off("room:updated", update); };
  }, [online]);
  useEffect(() => { if (!game?.rolls) setKept([]); }, [game?.row, game?.playerIndex, game?.rolls]);
  useEffect(() => {
    if (!game?.rolls || reducedMotion) { setSettledRollKey(rollKey); return; }
    const timer = window.setTimeout(() => setSettledRollKey(rollKey), KRIBBEL_ROLL_DURATION);
    return () => window.clearTimeout(timer);
  }, [rollKey, reducedMotion]);
  if (!game) return <main className="page"><p>Partie wird geladen …</p><button onClick={onExit}>Zurück</button></main>;
  const active = game.order[game.playerIndex];
  const canAct = !online || active === profile.id;
  const row = KRIBBEL_ROWS[Math.min(game.row, KRIBBEL_ROWS.length - 1)];
  const sum = game.dice.reduce((total, die) => total + die.value, 0);
  const met = kribbelTaskMet(row.task, game.dice);
  const busy = pending || rolling || preparing;
  const cribRows = [2, 5, 8, 9];
  const previous = cribRows.filter(i => i < game.row).map(i => game.results[active][i]);
  const previousSums = previous.filter((value): value is number => typeof value === "number" && value >= 6);
  const previousBest = previousSums.length ? Math.max(...previousSums) : undefined;
  const valid = met && (row.task !== -1 || canEnterKribbelSum(previous, sum));
  const target = cribRows.find(i => KRIBBEL_ROWS[i].group === row.group && game.results[active][i] === -1);
  const fallback = row.task !== -1 && !met && target !== undefined && canEnterKribbelSum(cribRows.filter(i => i < target).map(i => game.results[active][i]), sum);
  const standings = [...game.order].sort((a, b) => game.scores[b] - game.scores[a]);
  function action(event: "roll" | "submit", payload: { keep: number[] } | { choice: "score" | "skip" | "fallback" }) {
    if (requestLock.current || pending || rolling || !canAct || (preparing && event === "submit")) return;
    setError("");
    if (event === "roll") { try { navigator.vibrate?.(25); } catch { /* Haptik ist optional. */ } }
    if (online) {
      requestLock.current = true; setPending(true);
      sendGameMove(room, `kribbeln:${event}`, payload, (timeout: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
      requestLock.current = false; setPending(false);
      if (timeout) setError("Der Server antwortet nicht.");
      else if (!response.ok) setError(response.error ?? "Aktion nicht möglich.");
      else if (response.data) setRoom(response.data);
    }); }
    else {
      try { setLocal(event === "roll" ? rollKribbeln(game!, active, (payload as { keep: number[] }).keep) : submitKribbeln(game!, active, (payload as { choice: "score" | "skip" | "fallback" }).choice)); }
      catch (e) { setError(e instanceof Error ? e.message : "Aktion nicht möglich."); }
    }
  }
  return <main className="page screen-enter kribbel-game">
    <header className="game-header"><strong>Kribbeln</strong><span>{online ? `Online · ${room?.code}` : "Lokal"}</span><button className="text-button" onClick={onExit}>Beenden</button></header>
    <section className="page__content">
      <div className="kribbel-score-strip" aria-label="Punktestand">{standings.map(id => <span key={id} className={id === active && !game.finished ? "is-active" : ""}><CharacterAvatar id={characters[id]} decorative/>{game.names[id]} <strong>{game.scores[id]}</strong></span>)}</div>
      {game.finished ? <section className="kribbel-finale"><span aria-hidden="true">★</span><h1>Partie beendet</h1><p>Gewonnen: {game.winners.map(id => game.names[id]).join(", ")}</p><ol>{standings.map(id => <li key={id}><CharacterAvatar id={characters[id]} decorative/>{game.names[id]} <strong>{game.scores[id]} Punkte</strong></li>)}</ol></section> : <>
        <div className="kribbel-round"><span>Runde {game.row + 1} / 10</span><progress value={game.row} max={10} aria-label="Spielfortschritt" /></div>
        <div className="kribbel-play">
        <section className="kribbel-mission"><span className="character-turn-label"><CharacterAvatar id={characters[active]} decorative/>{canAct ? `${game.names[active]}, du bist dran!` : `${game.names[active]} ist am Zug`}</span><h1>{row.label}</h1><KribbelnTask task={row.task} label={row.label} dice={game.dice} rolling={rolling} previousBest={previousBest} /><div className="kribbel-attempts" aria-label={`Wurf ${game.rolls} von 3`}>{[1, 2, 3].map(n => <span className={n <= game.rolls ? "is-used" : ""} key={n}>{n}</span>)}<small>{3 - game.rolls} Würfe übrig</small></div></section>
        <div className="kribbel-table-side">
        <KribbelnTable ref={cup} dice={game.dice} kept={rolling || !canAct ? game.keptDice ?? [] : kept}
          rolling={rolling} pending={pending} canAct={canAct} canRoll={canAct && !pending && !rolling && game.rolls < 3 && kept.length < 6}
          reducedMotion={reducedMotion} rollKey={rollKey} turnKey={`${game.row}-${game.playerIndex}`} onPreparingChange={setPreparing}
          onRoll={() => action("roll", { keep: kept })} onToggle={i => setKept(kept.includes(i) ? kept.filter(n => n !== i) : [...kept, i])} />
        <div className={`kribbel-feedback ${valid && !rolling ? "is-success" : ""}`} role="status" aria-live="polite"><strong key={`${rollKey}-${rolling}`}>{rolling ? "…" : game.rolls ? sum : "–"}</strong><span>{rolling ? "Gleich steht das Ergebnis fest" : !game.rolls ? "Wie hoch kommst du?" : valid ? "Geschafft! Eintragen oder mehr riskieren?" : game.rolls < 3 ? "Da geht noch was. Noch einmal würfeln?" : fallback ? "Zweite Chance: Nutze dein Kribbelfeld!" : "Diesmal kein Treffer. Aufgabe streichen."}</span></div>
        {canAct ? <div className="kribbel-actions">
          {game.rolls < 3 && <button className="button button--primary kribbel-roll" disabled={busy || kept.length === 6} onClick={() => cup.current?.roll()}>{pending ? "Warte auf den Tisch …" : preparing ? "Becher schütteln …" : rolling ? "Würfel rollen …" : game.rolls ? `${6 - kept.length} Würfel neu werfen` : "Würfeln"}</button>}
          {game.rolls > 0 && <><button className="button button--secondary" disabled={busy || !valid} onClick={() => action("submit", { choice: "score" })}>Ergebnis eintragen</button>{row.task !== -1 && !met && <button className="button button--secondary" disabled={busy || !fallback} onClick={() => action("submit", { choice: "fallback" })}>Auf Kribbelfeld ausweichen</button>}<button className="button button--ghost kribbel-skip" disabled={busy} onClick={() => action("submit", { choice: "skip" })}>Aufgabe streichen</button></>}
        </div> : <p className="kribbel-waiting">Du bist gleich wieder dran. {game.names[active]} entscheidet gerade.</p>}
        {error && <p role="alert" className="error-message">{error}</p>}
        </div>
        </div>
      </>}
      <details className="kribbel-scorebook" open={game.finished}><summary>Wertungsblatt ansehen</summary><div className="kribbel-sheet"><table><thead><tr><th>Aufgabe</th>{game.order.map(id => <th key={id}><CharacterAvatar id={characters[id]} decorative/>{game.names[id]}<br />{game.scores[id]} P.</th>)}</tr></thead><tbody>{KRIBBEL_ROWS.map((entry, i) => <tr key={i} className={i === game.row && !game.finished ? "is-current" : ""}><th>{entry.label}</th>{game.order.map(id => <td key={id}>{game.results[id][i] === -1 ? "–" : game.results[id][i] === null ? "×" : game.results[id][i]}</td>)}</tr>)}</tbody></table></div></details>
      <details><summary>Spielregeln · digitales Aufgabenblatt</summary><p>Bis zu drei Würfe pro Zug. Behaltene Würfel können jederzeit wieder freigegeben werden. Gewertet wird die Summe aller sechs Würfel, wenn die Farbaufgabe erfüllt ist. Bei Misserfolg kannst du streichen oder auf ein freies Kribbelfeld derselben Gruppe ausweichen und die Aufgabe erneut versuchen. Kribbelsummen müssen immer höher als die bisherigen eigenen Kribbelsummen sein.</p><p>Pro Zeile erhält der Beste so viele Punkte, wie Spieler teilnehmen. Jeder weitere Platz erhält einen Punkt weniger; gleiche Summen zählen zum niedrigeren Platz. Ein Kreuz ergibt null Punkte.</p><p>Jeder Würfel trägt die Zahlen 1 bis 6 und jede der sechs Farben genau einmal. Über alle sechs Würfel kommt jedes Zahl-Farbe-Paar genau einmal vor. Dieses digitale Blatt verwendet eigene Farb-Zahlen-Zuordnungen.</p></details>
      {game.finished && <button className="button button--primary button--wide" onClick={onLobby ?? onExit}>{onLobby ? "Zurück zur Lobby" : "Zum Startmenü"}</button>}
    </section>
  </main>;
}
