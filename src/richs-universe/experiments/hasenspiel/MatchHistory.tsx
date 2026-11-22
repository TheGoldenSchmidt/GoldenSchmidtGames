import type { Color, Level } from "./rules";
import { botNames, type BotLevel } from "./bot";

export type FinishedMatch = { id: string; level: Level; bot?: BotLevel; outcome: "draw" | "first" | "second"; firstColor: Color };

export function readHistory(): FinishedMatch[] {
  const matches: FinishedMatch[] = [];
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith("lichtung.score.")) continue;
      try {
        const entry = JSON.parse(localStorage.getItem(key) ?? "null");
        if (entry && typeof entry.id === "string" && ["draw", "first", "second"].includes(entry.outcome)
          && [1, 2, 3].includes(entry.level)) matches.push(entry);
      } catch { /* Skip an unreadable entry. */ }
    }
  } catch { /* Storage is unavailable. */ }
  return matches.sort((a, b) => b.id.localeCompare(a.id));
}

export function MatchHistory({ history }: { history: FinishedMatch[] }) {
  return <details><summary>Partien &amp; Punktestand ({history.length})</summary>
    <p>Sieg 1 Punkt · Unentschieden je ½ Punkt</p>
    {!history.length && <p>Noch keine abgeschlossene Partie.</p>}
    {[false, true].map(bot => {
      const games = history.filter(game => !!game.bot === bot);
      if (!games.length) return null;
      const first = games.reduce((score, game) => score + (game.outcome === "draw" ? .5 : Number(game.outcome === "first")), 0);
      return <section key={String(bot)}><strong>{bot ? "Du gegen Computergegner" : "Person 1 gegen Person 2"} · {first.toLocaleString("de")} : {(games.length - first).toLocaleString("de")}</strong>
        <ol>{games.map(game => <li key={game.id}>Stufe {game.level}{game.bot && ` · ${botNames[game.bot]} · ${game.bot}`} · {game.outcome === "draw" ? "Unentschieden · ½ : ½" : game.outcome === "first" ? "1 : 0" : "0 : 1"}</li>)}</ol>
      </section>;
    })}
  </details>;
}
