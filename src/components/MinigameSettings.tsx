import { FIRST_GEN_LABEL, FIRST_GEN_MINI_IDS, miniEligible, miniName, miniPlayerHint, miniPool, NEW_MATCH_IDS, PLAYABLE_MINI_IDS, type PlayableMiniId } from "../../shared/minigameCatalog";
import { MINIGAME_DEFAULTS, type MinigameMode, type MinigameOptions } from "../../shared/minigameModes";

/** The classic minigames (first generation: 14 arenas, Hook Wars, Chaos Run, Wippenwerk) can be left out of random draws. */
export function ClassicToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <label className="settings-checkbox">
    <span>{FIRST_GEN_LABEL}<small id="classic-minis-hint">{FIRST_GEN_MINI_IDS.length} ältere Arenen und Läufe mit ziehen</small></span>
    <input type="checkbox" aria-label={FIRST_GEN_LABEL} aria-describedby="classic-minis-hint" checked={value} onChange={event => onChange(event.target.checked)} />
  </label>;
}

export function MinigameSettings({ mode, value = MINIGAME_DEFAULTS, players, disabled, onChange }: {
  mode: MinigameMode; value?: MinigameOptions; players: number; disabled: boolean; onChange: (value: MinigameOptions) => void;
}) {
  const options = { ...MINIGAME_DEFAULTS, ...value };
  const pool = miniPool(players, options.classic);
  return <fieldset className="settings-fields" aria-label="Minispieloptionen" disabled={disabled}>
    {mode === "free-minigame" ? <>
      <label><span>Minispiel</span><select value={options.miniId} onChange={e => onChange({ ...options, miniId: e.target.value as PlayableMiniId })}>
        <optgroup label="Neue Minispiele">{NEW_MATCH_IDS.map(id => <option key={id} value={id} disabled={!miniEligible(id, players)}>{miniName(id)}{miniEligible(id, players) ? "" : ` (${miniPlayerHint(id)})`}</option>)}</optgroup>
        <optgroup label={FIRST_GEN_LABEL}>{FIRST_GEN_MINI_IDS.map(id => <option key={id} value={id} disabled={!miniEligible(id, players)}>{miniName(id)}{miniEligible(id, players) ? "" : ` (${miniPlayerHint(id)})`}</option>)}</optgroup>
      </select></label>
    </> : <>
      <ClassicToggle value={options.classic} onChange={classic => onChange({ ...options, classic, rounds: Math.max(1, Math.min(options.rounds, miniPool(players, classic).length)) })} />
      <label><span>Anzahl Minispiele</span><select value={options.rounds} onChange={e => onChange({ ...options, rounds: Number(e.target.value) })}>
        {PLAYABLE_MINI_IDS.slice(0, Math.max(1, pool.length)).map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select></label>
    </>}
  </fieldset>;
}
