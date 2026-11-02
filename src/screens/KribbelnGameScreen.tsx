import { useEffect, useState } from "react";
import { createKribbelnGame, KRIBBEL_ROWS, kribbelTaskMet, rollKribbeln, submitKribbeln, type KribbelnGame } from "../../shared/kribbeln";
import type { GuestProfile, RoomState } from "../../shared/types";
import { socket } from "../lib/socket";

export function KribbelnGameScreen({ profile, localNames, initialRoom, onExit }: { profile: GuestProfile; localNames?: string[]; initialRoom?: RoomState; onExit: () => void }) {
  const online = Boolean(initialRoom);
  const [room, setRoom] = useState(initialRoom);
  const [local, setLocal] = useState<KribbelnGame | undefined>(() => localNames ? createKribbelnGame(localNames.map((name, i) => ({ id: `local-${i}`, name }))) : undefined);
  const [kept, setKept] = useState<number[]>([]);
  const [error, setError] = useState("");
  const game = online ? room?.kribbelnGame : local;
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
  if (!game) return <main className="page"><p>Partie wird geladen …</p><button onClick={onExit}>Zurück</button></main>;
  const active = game.order[game.playerIndex];
  const canAct = !online || active === profile.id;
  const row = KRIBBEL_ROWS[Math.min(game.row, KRIBBEL_ROWS.length - 1)];
  const sum = game.dice.reduce((total, die) => total + die.value, 0);
  const met = kribbelTaskMet(row.task, game.dice);
  function action(event: "roll" | "submit", payload: { keep: number[] } | { choice: "score" | "skip" | "fallback" }) {
    setError("");
    if (online) socket.timeout(5000).emit(`kribbeln:${event}`, payload, (timeout: Error | null, response: { ok: boolean; data?: RoomState; error?: string }) => {
      if (timeout) setError("Der Server antwortet nicht.");
      else if (!response.ok) setError(response.error ?? "Aktion nicht möglich.");
      else if (response.data) setRoom(response.data);
    });
    else {
      try { setLocal(event === "roll" ? rollKribbeln(game!, active, (payload as { keep: number[] }).keep) : submitKribbeln(game!, active, (payload as { choice: "score" | "skip" | "fallback" }).choice)); }
      catch (e) { setError(e instanceof Error ? e.message : "Aktion nicht möglich."); }
    }
  }
  return <main className="page screen-enter">
    <header className="game-header"><strong>Kribbeln</strong><span>{online ? `Online · ${room?.code}` : "Lokal"}</span><button className="text-button" onClick={onExit}>Beenden</button></header>
    <section className="page__content">
      {game.finished ? <><h1>Partie beendet</h1><p>Gewonnen: {game.winners.map(id => game.names[id]).join(", ")}</p></> : <>
        <h2>{row.label}</h2><p>{game.names[active]} ist am Zug · Wurf {game.rolls} von 3</p>
        <div className="kribbel-dice">{game.dice.map((die, i) => <button key={i} className={`kribbel-die kribbel-die--${die.color} ${kept.includes(i) ? "is-kept" : ""}`} disabled={!canAct} onClick={() => setKept(kept.includes(i) ? kept.filter(n => n !== i) : [...kept, i])} aria-label={`${die.color}, ${die.value}${kept.includes(i) ? ", behalten" : ""}`}>{die.value}</button>)}</div>
        {game.rolls > 0 && <p>Summe: {sum} · {met ? "Aufgabe erfüllt" : "Aufgabe noch nicht erfüllt"}. Würfel antippen, um sie zu behalten.</p>}
        {canAct && <div className="kribbel-actions">
          {game.rolls < 3 && <button className="button button--primary" onClick={() => action("roll", { keep: kept })}>{game.rolls ? "Erneut würfeln" : "Würfeln"}</button>}
          {game.rolls > 0 && <><button className="button button--secondary" onClick={() => action("submit", { choice: "score" })}>Ergebnis eintragen</button><button className="button button--secondary" onClick={() => action("submit", { choice: "skip" })}>Aufgabe streichen</button>{row.task !== -1 && !met && <button className="button button--secondary" onClick={() => action("submit", { choice: "fallback" })}>Auf Kribbelfeld ausweichen</button>}</>}
        </div>}
        {error && <p role="alert" className="error-message">{error}</p>}
      </>}
      <h2>Wertungsblatt</h2><div className="kribbel-sheet"><table><thead><tr><th>Aufgabe</th>{game.order.map(id => <th key={id}>{game.names[id]}<br />{game.scores[id]} P.</th>)}</tr></thead><tbody>{KRIBBEL_ROWS.map((entry, i) => <tr key={i} className={i === game.row && !game.finished ? "is-current" : ""}><th>{entry.label}</th>{game.order.map(id => <td key={id}>{game.results[id][i] === -1 ? "–" : game.results[id][i] === null ? "×" : game.results[id][i]}</td>)}</tr>)}</tbody></table></div>
      <details><summary>Spielregeln · digitales Aufgabenblatt</summary><p>Bis zu drei Würfe pro Zug. Behaltene Würfel können jederzeit wieder freigegeben werden. Gewertet wird die Summe aller sechs Würfel, wenn die Farbaufgabe erfüllt ist. Bei Misserfolg kannst du streichen oder auf ein freies Kribbelfeld derselben Gruppe ausweichen und die Aufgabe erneut versuchen. Kribbelsummen müssen immer höher als die bisherigen eigenen Kribbelsummen sein.</p><p>Pro Zeile erhält der Beste so viele Punkte, wie Spieler teilnehmen. Jeder weitere Platz erhält einen Punkt weniger; gleiche Summen zählen zum niedrigeren Platz. Ein Kreuz ergibt null Punkte. Dieses digitale Blatt verwendet eigene Farb-Zahlen-Zuordnungen.</p></details>
      {game.finished && <button className="button button--primary button--wide" onClick={onExit}>Zum Startmenü</button>}
    </section>
  </main>;
}
