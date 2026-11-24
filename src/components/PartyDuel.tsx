import { useState } from "react";
import { duelTargets, MINIS, type PartyAction, type PartyGame } from "../../shared/party";
import { CharacterAvatar } from "./CharacterAvatar";
import { ResultConfirm } from "./PartyMiniViews";

const STAKES = [1, 2, 3, 5, 10];
const name = (game: PartyGame, id: string) => game.players.find(p => p.id === id)?.name ?? "";

/** Duel field: the active player picks an opponent and the stake, or skips the duel. */
export function DuelChallenge({ game, send }: { game: PartyGame; send: (action: PartyAction) => void }) {
  const targets = duelTargets(game);
  const [target, setTarget] = useState(targets[0]?.id);
  const option = targets.find(t => t.id === target) ?? targets[0];
  const choices = option ? [...new Set([...STAKES.filter(n => n < option.max), option.max])] : [];
  const [wanted, setWanted] = useState(3);
  const stake = option ? Math.min(wanted, option.max) : 0;
  return <div className="party-special-decision party-duel">
    <h3><span aria-hidden="true">⚔ </span>Duellfeld</h3>
    <p>Wen forderst du heraus? Beide zahlen den Einsatz in den Pott, wer das Duell gewinnt, bekommt alles. Die anderen schauen zu.</p>
    <div className="party-duel-targets" role="group" aria-label="Gegner wählen">
      {targets.map(t => {
        const player = game.players.find(p => p.id === t.id)!, index = game.players.indexOf(player);
        return <button key={t.id} type="button" aria-pressed={option?.id === t.id} onClick={() => setTarget(t.id)}>
          <CharacterAvatar id={player.characterId} className={`party-avatar party-player-color-${index}`} decorative />
          <strong>{player.name}</strong><small>◉ {player.coins}</small>
        </button>;
      })}
    </div>
    {option && <div className="party-duel-stakes" role="group" aria-label="Einsatz wählen">
      {choices.map(n => <button key={n} type="button" aria-pressed={stake === n} onClick={() => setWanted(n)}>{n}</button>)}
    </div>}
    {option && <button className="button button--gold button--wide" onClick={() => send({ type: "duel", target: option.id, stake })}>
      {name(game, option.id)} herausfordern · Pott {stake * 2} Münzen
    </button>}
    <button className="button button--ghost button--wide" onClick={() => send({ type: "duel" })}>Auf das Duell verzichten</button>
  </div>;
}

/** Duel result: the winner takes the pot; a draw returns the stakes. */
export function DuelResult({ game, viewer, busy, send }: { game: PartyGame; viewer: string; busy: boolean; send: (action: PartyAction) => void }) {
  const d = game.duel!, winner = d.winner ? game.players.find(p => p.id === d.winner) : undefined;
  return <div className="party-mini-results party-duel-result">
    <h1>{winner ? (winner.id === viewer ? "Duell gewonnen!" : `${winner.name} gewinnt!`) : "Unentschieden"}</h1>
    <p>{game.mini ? MINIS[game.mini.id].name : ""} · {winner ? `Pott ${d.stake * 2} Münzen` : "Beide bekommen ihren Einsatz zurück"}</p>
    <ol className="party-awards">
      {[d.challenger, d.opponent].map(id => {
        const player = game.players.find(p => p.id === id)!, won = id === d.winner, change = d.winner ? (won ? d.stake : -d.stake) : 0;
        return <li key={id} className={id === viewer ? "is-you" : ""}>
          <span className="party-place">{won ? "1." : d.winner ? "2." : "–"}</span>
          <CharacterAvatar id={player.characterId} className={`party-avatar party-player-color-${game.players.indexOf(player)}`} />
          <div><strong>{player.name}</strong><small>{id === d.challenger ? "fordert heraus" : "wurde herausgefordert"} · jetzt ◉ {player.coins}</small></div>
          <b>{change > 0 ? `+${change}` : change}<small>Münzen</small></b>
        </li>;
      })}
    </ol>
    <ResultConfirm game={game} viewer={viewer} busy={busy} send={send} label="Weiter auf der Insel" />
  </div>;
}
