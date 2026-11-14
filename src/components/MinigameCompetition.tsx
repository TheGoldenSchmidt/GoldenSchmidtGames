import { useState } from "react";
import { availableBets } from "../../shared/minigameModes";
import { MINIS, partyMiniResults, type PartyAction, type PartyGame } from "../../shared/party";
import { CharacterAvatar } from "./CharacterAvatar";

export function MinigameScoreboard({ game }: { game: PartyGame }) {
  const c = game.competition!;
  return <ol className="minigame-scoreboard" aria-label="Gesamtpunktestand">
    {[...game.players].sort((a, b) => c.scores[b.id] - c.scores[a.id]).map(p => <li key={p.id}>
      <CharacterAvatar id={p.characterId} decorative /><strong>{p.name}</strong><span>{c.scores[p.id]} Punkte</span>
    </li>)}
  </ol>;
}

export function MinigameBetting({ game, viewer, busy, send }: {
  game: PartyGame; viewer: string; busy: boolean; send: (action: PartyAction) => void;
}) {
  const c = game.competition!, own = game.players.find(p => p.id === viewer)!;
  const [selected, setSelected] = useState<number>();
  const locked = c.locked.includes(viewer), available = availableBets(c, viewer);
  return <section className="minigame-betting" aria-labelledby="minigame-bet-title">
    <p>Minispiel {game.round} von {c.rounds}</p>
    <h1 id="minigame-bet-title">{MINIS[game.mini!.id].name}</h1>
    <p>{MINIS[game.mini!.id].instruction}</p>
    <h2>Was setzt du auf deinen Sieg?</h2>
    <p>Bei Sieg erhältst du deinen Einsatz, sonst 0 Punkte. Jeder Wert ist nur einmal einsetzbar. Die Einsätze bleiben verdeckt, bis alle gesetzt haben.</p>
    {own.passive ? <p role="status">Du schaust derzeit zu.</p> : locked
      ? <p className="minigame-bet-locked" role="status">Dein Einsatz: <strong>{c.bets[viewer]} Punkte</strong>. Wir warten auf die anderen.</p>
      : <>
        <div className="minigame-bets" role="group" aria-label="Dein Einsatz">
          {Array.from({ length: c.rounds }, (_, i) => i + 1).map(n => <button key={n}
            className={selected === n ? "is-selected" : ""} aria-pressed={selected === n}
            aria-label={`${n} ${n === 1 ? "Punkt" : "Punkte"}${available.includes(n) ? " setzen" : " verbraucht"}`}
            disabled={busy || !available.includes(n)} onClick={() => setSelected(n)}>{n}<small>{available.includes(n) ? selected === n ? "✓" : "frei" : "weg"}</small>
          </button>)}
        </div>
        <button className="button button--primary button--wide" disabled={busy || selected === undefined} onClick={() => send({ type: "bet", value: selected! })}>Einsatz festlegen{selected !== undefined ? ` · ${selected}` : ""}</button>
      </>}
    <ul className="minigame-bet-status" aria-label="Gesetzte Einsätze">{game.players.filter(p => !p.passive).map(p => <li key={p.id}>
      <span aria-hidden="true">{c.locked.includes(p.id) ? "✓" : "◷"}</span> {p.name}: {c.locked.includes(p.id) ? "gesetzt" : "wählt noch"}
    </li>)}</ul>
  </section>;
}

export function MinigameResults({ game, viewer, host, busy, send, onExit, exitLabel = "Zurück zu GSG" }: {
  game: PartyGame; viewer: string; host: boolean; busy: boolean; send: (action: PartyAction) => void; onExit: () => void;
  /** Online rooms return to their lobby after the game; local play goes back to GSG. */
  exitLabel?: string;
}) {
  const c = game.competition!, finished = game.phase === "finished", free = game.mode === "free-minigame";
  const result = c.history.at(-1)!;
  return <section className="minigame-results" aria-labelledby="minigame-result-title">
    <p>{free ? "Freies Minispiel" : `Minispiel ${game.round} von ${c.rounds}`}</p>
    <h1 id="minigame-result-title">{finished ? free ? "Euer Ergebnis" : "Der Wettbewerb ist entschieden!" : "Die Punkte stehen fest!"}</h1>
    {finished && <h2>{game.winners.length ? game.winners.map(id => game.players.find(p => p.id === id)!.name).join(" & ") : "Niemand hat teilgenommen"}</h2>}
    {finished && game.winners.length > 0 && <p>{game.winners.length > 1 ? "Ihr teilt euch den Gesamtsieg." : free ? "Minispiel gewonnen!" : "Die höchste Gesamtpunktzahl gewinnt."}</p>}
    <h2>{MINIS[result.miniId].name}</h2>
    <ol className="minigame-round-results" aria-label="Minispielergebnis">
      {partyMiniResults(game).map(r => <li key={r.player.id} className={r.player.id === viewer ? "is-you" : ""}>
        <span>{r.place ? `${r.place}.` : "–"}</span><CharacterAvatar id={r.player.characterId} decorative />
        <div><strong>{r.player.name}</strong><small>{r.participated ? `${r.score} Minispielpunkte${r.detail ? ` · ${r.detail}` : ""}` : "Nicht teilgenommen"}{!free && ` · Einsatz ${result.bets[r.player.id] ?? "–"}`}</small></div>
        {!free && <b>+{result.points[r.player.id]}<small>Punkte</small></b>}
      </li>)}
    </ol>
    <p>{game.mini?.match ? "Das Minispiel entscheidet Gleichstände selbst (Stechen, Golden Goal, Sudden Death). Bleibt es gleich, teilt ihr euch den Platz." : "Bei gleichen Minispielpunkten entscheiden weniger Stürze, dann die zu Beginn ausgeloste Reihenfolge."}</p>
    {!free && <><h2>Gesamtpunktestand</h2><MinigameScoreboard game={game} />
      <details className="minigame-history"><summary>Gespielte Minispiele und Einsätze</summary>
        <ol>{c.history.map((round, i) => <li key={i}><strong>{MINIS[round.miniId].name}</strong>
          <ul>{game.players.map(p => <li key={p.id}>{p.name}: Einsatz {round.bets[p.id] ?? "–"}, +{round.points[p.id]} Punkte</li>)}</ul>
        </li>)}</ol>
      </details></>}
    {finished ? <button className="button button--primary button--wide" onClick={onExit}>{exitLabel}</button>
      : host ? <button className="button button--primary button--wide" disabled={busy} onClick={() => send({ type: "next" })}>Nächstes Minispiel</button>
      : <p role="status">Der Host startet das nächste Minispiel.</p>}
  </section>;
}
