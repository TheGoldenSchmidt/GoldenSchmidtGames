import { ACTION_MINI_IDS, ARENA_META } from "../../shared/partyArena";
import { MATCH_IDS, MATCH_MODULES } from "../../shared/matches/framework";
import { miniEligible, miniName, miniPlayerHint, miniPool, PLAYABLE_MINI_IDS, type PlayableMiniId } from "../../shared/minigameCatalog";
import { MINIGAME_DEFAULTS, type MinigameMode, type MinigameOptions } from "../../shared/minigameModes";

/** The original 14 3D arenas are "classic" and can be left out of random draws. */
export function ClassicToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <label className="option-toggle classic-toggle">
    <span><strong>Klassische Minispiele</strong><small>Die 14 bisherigen 3D-Minispiele mitspielen. Ohne Haken kommen nur die neuen Spiele dran.</small></span>
    <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} />
  </label>;
}

export function MinigameSettings({ mode, value = MINIGAME_DEFAULTS, players, disabled, onChange }: {
  mode: MinigameMode; value?: MinigameOptions; players: number; disabled: boolean; onChange: (value: MinigameOptions) => void;
}) {
  const options = { ...MINIGAME_DEFAULTS, ...value };
  const pool = miniPool(players, options.classic);
  const instruction = (id: PlayableMiniId) => (MATCH_IDS as readonly string[]).includes(id) ? MATCH_MODULES[id as typeof MATCH_IDS[number]].meta.instruction : ARENA_META[id as typeof ACTION_MINI_IDS[number]].instruction;
  return <fieldset className="party-settings minigame-settings" disabled={disabled}>
    <legend>{mode === "free-minigame" ? "Direkt ins Minispiel" : "Euer Wettbewerb"}</legend>
    {mode === "free-minigame" ? <>
      <label><span>Minispiel</span><select value={options.miniId} onChange={e => onChange({ ...options, miniId: e.target.value as PlayableMiniId })}>
        <optgroup label="Neue Minispiele">{MATCH_IDS.map(id => <option key={id} value={id} disabled={!miniEligible(id, players)}>{miniName(id)}{miniEligible(id, players) ? "" : ` (${miniPlayerHint(id)})`}</option>)}</optgroup>
        <optgroup label="Klassische Minispiele">{ACTION_MINI_IDS.map(id => <option key={id} value={id}>{ARENA_META[id].name}</option>)}</optgroup>
      </select></label>
      <p>{instruction(options.miniId)}</p>
      <p>Ein Minispiel, alle gleichzeitig auf dem eigenen Handy. Vor dem Start könnt ihr ohne Wertung üben.</p>
    </> : <>
      <ClassicToggle value={options.classic} onChange={classic => onChange({ ...options, classic, rounds: Math.max(1, Math.min(options.rounds, miniPool(players, classic).length)) })} />
      <label><span>Anzahl Minispiele</span><select value={options.rounds} onChange={e => onChange({ ...options, rounds: Number(e.target.value) })}>
        {PLAYABLE_MINI_IDS.slice(0, Math.max(1, pool.length)).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select></label>
      <p>{options.rounds} zufällige Minispiele ohne Wiederholung aus {pool.length} passenden Spielen. Jede Person setzt vor jedem Spiel verdeckt einen eigenen Wert von 1 bis {options.rounds}. Jeder Wert ist genau einmal einsetzbar.</p>
      <p>Wer das Minispiel gewinnt, erhält den eigenen Einsatz als Punkte. Alle anderen erhalten 0 Punkte. Die höchste Gesamtpunktzahl gewinnt; bei Gleichstand teilt ihr euch den Sieg.</p>
    </>}
  </fieldset>;
}
