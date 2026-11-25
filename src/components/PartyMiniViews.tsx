import { MINIS, partyMiniResults, type PartyAction, type PartyGame } from "../../shared/party";
import { MiniLookPicker } from "./MiniLookSettings";
import { isArenaId } from "../../shared/partyArena";
import { CharacterAvatar } from "./CharacterAvatar";
import { Celebration, MINI_LOOK, MiniPreview } from "./PartyArt";
import { PartyCoinReward, type MiniReward } from "./PartyProgress";

interface ViewProps { game: PartyGame; viewer: string; busy: boolean; send: (action: PartyAction) => void }

/** Minigame intro: short goal, controls, optional full rules, practice and readiness. */
/** `onLook` (host only) opens the game menu; the host picks variant (Unity/Web) and view right in the intro as well. */
export function PartyMiniIntro({ game: g, viewer, busy, send, onPractice, onLook }: ViewProps & { onPractice: () => void; onLook?: () => void }) {
  const m = g.mini!, meta = MINIS[m.id], own = g.players.find(p => p.id === viewer)!, competition = g.competition;
  const watching = Boolean(g.duel && viewer !== g.duel.challenger && viewer !== g.duel.opponent);
  const reward = competition ? (g.mode === "goldenschmidt" ? `Dein Einsatz: ${competition.bets[viewer] ?? "–"} Punkte` : "Ein Spiel · ein Ergebnis")
    : g.duel ? `Sieg: ${g.duel.stake * 2} Münzen aus dem Pott` : g.opening ? "Ergebnis bestimmt euren Startplatz" : "Platz 1: 10 · Platz 2: 4 · Platz 3: 2 Münzen";
  return <div className="party-mini-intro">
    <MiniPreview id={m.id} />
    <p className="party-mini-round">{g.duel ? `Duell auf Feld ${g.duel.field}` : g.opening ? "Auftakt: Bestimmt eure Zugreihenfolge" : `Minispiel der Runde ${g.round}`}</p>
    <h1>{meta.name}</h1>
    <p className="party-mini-tagline">{MINI_LOOK[m.id].action}</p>
    {g.duel && <DuelLine game={g} viewer={viewer} />}
    <p>{meta.instruction}</p>
    <MiniLookPicker game={g} host={Boolean(onLook)} busy={busy} send={send} />
    {meta.rules && <details className="party-mini-rules"><summary>Alle Regeln</summary><p>{meta.rules}</p></details>}
    <div className="party-mini-facts"><span>{MINI_LOOK[m.id].goal}</span><span>{reward}</span></div>
    <button className="button button--secondary button--wide" onClick={onPractice}>Erst kurz üben</button>
    {watching ? <p className="party-wait" role="status">Du schaust beim Duell zu. Es startet, sobald beide bereit sind.</p>
      : <button className="button button--primary button--wide" disabled={busy || m.runs[viewer]?.ready || own.passive} onClick={() => send({ type: "ready" })}>{m.runs[viewer]?.ready ? "Bereit – wir warten auf die anderen" : "Ich bin bereit"}</button>}
    <div className="party-ready-players" aria-label="Bereitschaft">
      {g.players.filter(q => !q.passive && (!g.duel || q.id === g.duel.challenger || q.id === g.duel.opponent)).map(q =>
        <span key={q.id} className={m.runs[q.id].ready ? "is-ready" : ""}><CharacterAvatar id={q.characterId} decorative />{m.runs[q.id].ready ? "✓" : "◷"} {q.name}</span>)}
    </div>
  </div>;
}

function DuelLine({ game, viewer }: { game: PartyGame; viewer: string }) {
  const d = game.duel!, name = (id: string) => game.players.find(p => p.id === id)?.name ?? "", duelist = viewer === d.challenger || viewer === d.opponent;
  return <p className="party-duel-headline"><strong>{name(d.challenger)} gegen {name(d.opponent)}</strong><span>Pott {d.stake * 2} Münzen · {duelist ? "ihr zwei spielt, alle anderen schauen zu" : "du schaust live zu"}</span></p>;
}

/** Everyone confirms a result; the names of those still reading are shown. */
export function ResultConfirm({ game: g, viewer, busy, send, label }: ViewProps & { label: string }) {
  const m = g.mini!, own = g.players.find(p => p.id === viewer)!, confirmed = Boolean(m.resultReady?.includes(viewer));
  const waiting = g.players.filter(q => !q.bot && !q.passive && !m.resultReady?.includes(q.id)).map(q => q.id === viewer ? "du" : q.name);
  return <>
    <button className="button button--primary button--wide" disabled={busy || own.passive || confirmed} onClick={() => send({ type: "next" })}>{confirmed ? "Bestätigt" : label}</button>
    {waiting.length > 0 && <p className="party-wait" role="status">Warten auf: {waiting.join(", ")}</p>}
  </>;
}

/** Board games: places, coins and the confirmation of all players. */
export function PartyMiniResults({ game: g, viewer, busy, send, reward }: ViewProps & { reward?: MiniReward }) {
  const m = g.mini!, tray = g.mode === "roll-it-up";
  return <div className="party-mini-results">
    <Celebration small />
    <h1>{g.opening ? "Eure Reihenfolge steht!" : "Schätze verteilt!"}</h1>
    <p>{MINIS[m.id].name}</p>
    {!g.opening && reward && <PartyCoinReward coins={reward.coins} total={reward.total} />}
    <ol className="party-awards">{partyMiniResults(g).map(result =>
      <li key={result.player.id} className={result.player.id === viewer ? "is-you" : ""}>
        <span className="party-place">{result.place ? `${result.place}.` : "–"}</span>
        <CharacterAvatar id={result.player.characterId} className={`party-avatar party-player-color-${g.players.indexOf(result.player)}`} />
        <div><strong>{result.player.name}</strong><small>{result.participated ? `${result.score} Punkte` : result.player.passive ? "Ausgesetzt" : "Nicht teilgenommen"}</small></div>
        <b>{g.opening ? `${g.order.indexOf(result.player.id) + 1}.` : `+${result.coins}`}<small>{g.opening ? "Startplatz" : "Münzen"}</small></b>
      </li>)}</ol>
    <p className="party-result-note">{isArenaId(m.id) ? "Bei Punktgleichstand entscheiden weniger Stürze, dann die feste Zugreihenfolge." : "Gleich gute Plätze teilen sich die Münzen ihres Platzes."}{g.opening ? " Im Auftakt entscheidet bei Gleichstand das Los." : ""}</p>
    <ResultConfirm game={g} viewer={viewer} busy={busy} send={send} label={tray ? "Weiter zur Bauschale" : g.opening ? "Ab auf die Insel" : "Weiter zur Insel"} />
  </div>;
}
