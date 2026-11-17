import type { CSSProperties } from "react";
import { BONUS_TROPHIES, FINAL_ROUNDS, ITEMS, MINIS, partyMiniResults, partyStanding, type PartyGame } from "../../shared/party";
import { fieldCoins } from "../../shared/partyBoard";
import { CharacterAvatar } from "./CharacterAvatar";
import { Celebration } from "./PartyArt";
import { PartyCoinReward, type MiniReward } from "./PartyProgress";

const player = (game: PartyGame, id: string) => game.players.find(p => p.id === id)!;

/** Shown to everyone before the first roll of the last rounds. */
export function PartyFinalStretchCall({ game, viewer }: { game: PartyGame; viewer: string }) {
  const coins = fieldCoins(game);
  return <div className="party-final-call" role="status">
    <b aria-hidden="true">×2</b>
    <strong>Die letzten {FINAL_ROUNDS} Runden!</strong>
    <p>Plus- und Minusfelder zählen jetzt doppelt: +{coins} und −{coins} Münzen.</p>
    {game.finalStretch?.help.map(entry => <p key={entry.id}>Rückenwind für {entry.id === viewer ? "dich" : player(game, entry.id).name}: {entry.item ? `${ITEMS[entry.item].name} im Inventar` : `+${entry.coins} Münzen`}.</p>)}
  </div>;
}

/** Inselparty ceremony: bonus trophies first, then the winners. The reveal is presentation only. */
export function PartyIslandFinale({ game, viewer, reward, backLabel, onBack }: { game: PartyGame; viewer: string; reward?: MiniReward; backLabel: string; onBack: () => void }) {
  const bonus = game.bonus ?? [], mini = game.mini, won = game.winners.includes(viewer), shared = game.winners.length > 1;
  const bonusOf = (id: string) => bonus.filter(award => award.winners.includes(id)).length;
  const verdict = won ? (shared ? "Ihr teilt euch den Sieg!" : "Du gewinnst die Inselparty!") : (shared ? "teilen sich den Sieg!" : "gewinnt die Inselparty!");
  return <section className="party-finale" style={{ "--bonus-count": bonus.length } as CSSProperties}>
    <p>Alle {game.options.rounds} Runden gespielt</p>
    {reward && <PartyCoinReward coins={reward.coins} total={reward.total} />}
    {bonus.length > 0 && <section className="party-bonus" aria-labelledby="party-bonus-title">
      <h2 id="party-bonus-title">Bonus-Trophäen</h2>
      <p>Jede zählt wie eine gekaufte Trophäe.</p>
      <ol>{bonus.map((award, index) => {
        const meta = BONUS_TROPHIES.find(entry => entry.id === award.id)!;
        return <li key={award.id} style={{ "--reveal": index } as CSSProperties} className={award.winners.includes(viewer) ? "is-you" : award.winners.length ? undefined : "is-empty"}>
          <span className="party-bonus-star" aria-hidden="true">★</span>
          <div><strong>{meta.name}</strong><small>{meta.label}: {award.winners.length ? award.value : "nicht vergeben"}</small></div>
          {award.winners.length > 0 && <div className="party-bonus-winners">{award.winners.map(id => {
            const p = player(game, id);
            return <span key={id}><CharacterAvatar id={p.characterId} decorative className={`party-avatar party-player-color-${game.players.indexOf(p)}`} />{id === viewer ? "Du" : p.name}<b>+1 ★</b></span>;
          })}</div>}
        </li>;
      })}</ol>
    </section>}
    <div className="party-finale-winner">
      <Celebration />
      <h1>Die Insel feiert euch!</h1>
      <h2>{game.winners.map(id => player(game, id).name).join(" & ")}</h2>
      <p>{verdict}</p>
    </div>
    <ol>{partyStanding(game).map((p, i) => <li key={p.id}><span>{i + 1}.</span><CharacterAvatar id={p.characterId} className={`party-avatar party-player-color-${game.players.indexOf(p)}`} /><strong>{p.name}<small>★ {p.trophies}{bonusOf(p.id) > 0 && ` (davon ${bonusOf(p.id)} Bonus)`} · ◉ {p.coins} · {p.wins} Minispielsiege</small></strong></li>)}</ol>
    {mini && <details className="party-final-awards"><summary>Letztes Minispiel: {MINIS[mini.id].name}</summary><ul>{partyMiniResults(game).map(r => <li key={r.player.id}><strong>{r.player.name}</strong><span>{r.score} Punkte · +{r.coins} Münzen</span></li>)}</ul></details>}
    <button className="button button--primary button--wide" onClick={onBack}>{backLabel}</button>
  </section>;
}
