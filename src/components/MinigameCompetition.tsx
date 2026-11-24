import { useState, type CSSProperties } from "react";
import { availableBets } from "../../shared/minigameModes";
import { MINIS, partyMiniResults, type PartyAction, type PartyGame, type PartyPlayer } from "../../shared/party";
import { CharacterAvatar } from "./CharacterAvatar";
import { MINI_LOOK } from "./PartyArt";

/**
 * Schlag den GoldenSchmidt as a game show: round track, gold bet coins, covered bet cards that
 * flip at the result, score bars and a podium at the end. Free minigames share the studio look.
 * Presentation only: rules, bets and points come from shared/.
 */
const color = (game: PartyGame, p: PartyPlayer) => `party-avatar party-player-color-${game.players.indexOf(p)}`;
const maxPoints = (rounds: number) => rounds * (rounds + 1) / 2;

/** One plate per minigame: played ones show their winners, the current one glows. */
export function RoundTrack({ game }: { game: PartyGame }) {
  const c = game.competition!;
  if (game.mode !== "goldenschmidt") return null;
  return <ol className="gs-track" aria-label="Spielverlauf">
    {Array.from({ length: c.rounds }, (_, i) => {
      const played = c.history[i], current = !played && i === game.round - 1;
      const winners = played ? game.players.filter(p => played.winnerIds.includes(p.id)) : [];
      return <li key={i} className={played ? "is-played" : current ? "is-current" : undefined} aria-current={current ? "step" : undefined}
        aria-label={played ? `Spiel ${i + 1}: ${MINIS[played.miniId].name}, ${winners.length ? `gewonnen von ${winners.map(p => p.name).join(" & ")}` : "ohne Sieger"}` : `Spiel ${i + 1}${current ? ", läuft gerade" : ""}`}>
        <b>{i + 1}</b>
        {winners.slice(0, 2).map(p => <CharacterAvatar key={p.id} id={p.characterId} decorative className={color(game, p)} />)}
      </li>;
    })}
  </ol>;
}

/** Total score as bars; the bar length shows the share of the highest possible total. */
export function MinigameScoreboard({ game, gained }: { game: PartyGame; gained?: Record<string, number> }) {
  const c = game.competition!, best = Math.max(...Object.values(c.scores));
  const scale = Math.max(1, best, maxPoints(c.rounds) / 2);
  return <ol className="gs-scoreboard" aria-label="Gesamtpunktestand">
    {[...game.players].sort((a, b) => c.scores[b.id] - c.scores[a.id]).map((p, i) => {
      const leader = best > 0 && c.scores[p.id] === best;
      return <li key={p.id} className={leader ? "is-leader" : undefined} style={{ "--share": c.scores[p.id] / scale, "--i": i } as CSSProperties}>
        <CharacterAvatar id={p.characterId} decorative className={color(game, p)} />
        <div><strong>{leader && <span className="gs-crown" aria-label="führt">♛ </span>}{p.name}</strong><i aria-hidden="true"><em /></i></div>
        <span><b>{c.scores[p.id]}</b> Punkte{gained?.[p.id] ? <small> +{gained[p.id]}</small> : null}</span>
      </li>;
    })}
  </ol>;
}

export function MinigameBetting({ game, viewer, busy, send }: {
  game: PartyGame; viewer: string; busy: boolean; send: (action: PartyAction) => void;
}) {
  const c = game.competition!, own = game.players.find(p => p.id === viewer)!, mini = game.mini!.id;
  const [selected, setSelected] = useState<number>();
  const locked = c.locked.includes(viewer), available = availableBets(c, viewer);
  return <section className="gs-betting" aria-labelledby="minigame-bet-title">
    <RoundTrack game={game} />
    <div className="gs-card">
      <span className="gs-card__icon" aria-hidden="true">{MINI_LOOK[mini].icon}</span>
      <div><p>Spiel {game.round} von {c.rounds}</p><h1 id="minigame-bet-title">{MINIS[mini].name}</h1><p>{MINIS[mini].instruction}</p></div>
    </div>
    <h2>Was setzt du auf deinen Sieg?</h2>
    <p className="gs-note">Gewinnst du, bekommst du deinen Einsatz als Punkte, sonst nichts. Jeder Wert geht nur einmal; alle Einsätze bleiben verdeckt, bis alle gesetzt haben.</p>
    {own.passive ? <p role="status">Du schaust derzeit zu.</p> : locked
      ? <div className="gs-locked" role="status"><span className="gs-cardback" aria-hidden="true"><b>{c.bets[viewer]}</b></span><p>Dein Einsatz: <strong>{c.bets[viewer]} Punkte</strong>. Wir warten auf die anderen.</p></div>
      : <>
        <div className="gs-coins" role="group" aria-label="Dein Einsatz">
          {Array.from({ length: c.rounds }, (_, i) => i + 1).map(n => <button key={n}
            className={selected === n ? "is-selected" : ""} aria-pressed={selected === n}
            aria-label={`${n} ${n === 1 ? "Punkt" : "Punkte"}${available.includes(n) ? " setzen" : " verbraucht"}`}
            disabled={busy || !available.includes(n)} onClick={() => setSelected(n)}><b>{n}</b><small>{available.includes(n) ? selected === n ? "✓" : "frei" : "weg"}</small>
          </button>)}
        </div>
        <button className="gs-action" disabled={busy || selected === undefined} onClick={() => send({ type: "bet", value: selected! })}>Einsatz festlegen{selected !== undefined ? ` · ${selected}` : ""}</button>
      </>}
    <ul className="gs-bet-status" aria-label="Gesetzte Einsätze">{game.players.filter(p => !p.passive).map(p => {
      const set = c.locked.includes(p.id);
      return <li key={p.id} className={set ? "is-set" : undefined}><CharacterAvatar id={p.characterId} decorative className={color(game, p)} /><span>{p.name}</span><small>{set ? "gesetzt" : "wählt noch"}</small></li>;
    })}</ul>
    <MinigameScoreboard game={game} />
  </section>;
}

/** Places of the total score; equal totals share a place. */
function podium(game: PartyGame) {
  const c = game.competition!, sorted = [...game.players].sort((a, b) => c.scores[b.id] - c.scores[a.id]);
  return sorted.map(p => ({ player: p, place: 1 + sorted.filter(q => c.scores[q.id] > c.scores[p.id]).length }));
}

export function MinigameResults({ game, viewer, host, busy, send, onExit, exitLabel = "Zurück zu GSG" }: {
  game: PartyGame; viewer: string; host: boolean; busy: boolean; send: (action: PartyAction) => void; onExit: () => void;
  /** Online rooms return to their lobby after the game; local play goes back to GSG. */
  exitLabel?: string;
}) {
  const c = game.competition!, finished = game.phase === "finished", free = game.mode === "free-minigame";
  const result = c.history.at(-1)!, places = podium(game);
  return <section className="gs-results" aria-labelledby="minigame-result-title">
    <RoundTrack game={game} />
    <p className="gs-kicker">{free ? "Freies Minispiel" : `Spiel ${game.round} von ${c.rounds}`}</p>
    <h1 id="minigame-result-title">{finished ? free ? "Euer Ergebnis" : "Der Wettbewerb ist entschieden!" : "Die Punkte stehen fest!"}</h1>
    {finished && !free && <div className="gs-podium" aria-label="Siegerpodest">
      {[2, 1, 3].map(place => places.filter(e => e.place === place)).filter(group => group.length).map(group =>
        <div key={group[0].place} className={`gs-step gs-step--${group[0].place}`}>
          <div className="gs-step__people">{group.map(({ player }) => <CharacterAvatar key={player.id} id={player.characterId} className={color(game, player)} />)}</div>
          <strong>{group.map(e => e.player.name).join(" & ")}</strong>
          <span>{c.scores[group[0].player.id]} Punkte</span>
          <b aria-hidden="true">{group[0].place}</b>
        </div>)}
    </div>}
    {finished && <h2 className="gs-winner">{game.winners.length ? game.winners.map(id => game.players.find(p => p.id === id)!.name).join(" & ") : "Niemand hat teilgenommen"}</h2>}
    {finished && game.winners.length > 0 && <p className="gs-note">{game.winners.length > 1 ? "Ihr teilt euch den Gesamtsieg." : free ? "Minispiel gewonnen!" : "Die höchste Gesamtpunktzahl gewinnt."}</p>}
    <h2>{MINIS[result.miniId].name}</h2>
    <ol className="gs-reveal" aria-label="Minispielergebnis">
      {partyMiniResults(game).map((r, i) => {
        const won = (result.points[r.player.id] ?? 0) > 0;
        return <li key={r.player.id} className={`${r.player.id === viewer ? "is-you" : ""} ${won ? "is-winner" : ""}`} style={{ "--i": i } as CSSProperties}>
          <span className="gs-place">{r.place ? `${r.place}.` : "–"}</span>
          <CharacterAvatar id={r.player.characterId} decorative className={color(game, r.player)} />
          <div><strong>{r.player.name}</strong><small>{r.participated ? `${r.score} Minispielpunkte${r.detail ? ` · ${r.detail}` : ""}` : "Nicht teilgenommen"}</small></div>
          {!free && <span className="gs-flip" role="img" aria-label={`Einsatz ${result.bets[r.player.id] ?? "–"}, ${won ? `+${result.points[r.player.id]} Punkte` : "keine Punkte"}`}>
            <span className="gs-flip__inner"><span className="gs-cardback" /><span className="gs-cardface"><b>{result.bets[r.player.id] ?? "–"}</b><small>{won ? `+${result.points[r.player.id]}` : "0"}</small></span></span>
          </span>}
        </li>;
      })}
    </ol>
    <p className="gs-note">{game.mini?.match ? "Das Minispiel entscheidet Gleichstände selbst (Stechen, Golden Goal, Sudden Death). Bleibt es gleich, teilt ihr euch den Platz." : "Bei gleichen Minispielpunkten entscheiden weniger Stürze, dann die zu Beginn ausgeloste Reihenfolge."}</p>
    {!free && <><h2>Gesamtpunktestand</h2><MinigameScoreboard game={game} gained={finished ? undefined : result.points} />
      <details className="gs-history"><summary>Gespielte Minispiele und Einsätze</summary>
        <div className="gs-history__scroll"><table>
          <thead><tr><th scope="col">Spiel</th>{game.players.map(p => <th key={p.id} scope="col">{p.name}</th>)}</tr></thead>
          <tbody>{c.history.map((round, i) => <tr key={i}><th scope="row">{i + 1}. {MINIS[round.miniId].name}</th>
            {game.players.map(p => <td key={p.id} className={round.points[p.id] ? "is-win" : undefined}>Einsatz {round.bets[p.id] ?? "–"}, +{round.points[p.id]} Punkte</td>)}</tr>)}</tbody>
        </table></div>
      </details></>}
    {finished ? <button className="gs-action" onClick={onExit}>{exitLabel}</button>
      : host ? <button className="gs-action" disabled={busy} onClick={() => send({ type: "next" })}>Nächstes Minispiel</button>
      : <p role="status" className="gs-note">Der Host startet das nächste Minispiel.</p>}
  </section>;
}
