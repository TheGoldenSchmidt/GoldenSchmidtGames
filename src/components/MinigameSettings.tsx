import { ACTION_MINI_IDS, ARENA_META, type ArenaId } from "../../shared/partyArena";
import { MINIGAME_DEFAULTS, type MinigameMode, type MinigameOptions } from "../../shared/minigameModes";

export function MinigameSettings({ mode, value = MINIGAME_DEFAULTS, disabled, onChange }: {
  mode: MinigameMode; value?: MinigameOptions; disabled: boolean; onChange: (value: MinigameOptions) => void;
}) {
  return <fieldset className="party-settings minigame-settings" disabled={disabled}>
    <legend>{mode === "free-minigame" ? "Direkt ins Minispiel" : "Euer Wettbewerb"}</legend>
    {mode === "free-minigame" ? <>
      <label><span>Minispiel</span><select value={value.miniId} onChange={e => onChange({ ...value, miniId: e.target.value as ArenaId })}>
        {ACTION_MINI_IDS.map(id => <option key={id} value={id}>{ARENA_META[id].name}</option>)}
      </select></label>
      <p>{ARENA_META[value.miniId].instruction}</p>
      <p>Ein Minispiel, alle gleichzeitig auf dem eigenen Gerät. Vor dem Start könnt ihr ohne Wertung üben.</p>
    </> : <>
      <label><span>Anzahl Minispiele</span><select value={value.rounds} onChange={e => onChange({ ...value, rounds: Number(e.target.value) })}>
        {ACTION_MINI_IDS.map((_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select></label>
      <p>{value.rounds} zufällige Minispiele ohne Wiederholung. Jede Person setzt vor jedem Spiel verdeckt einen eigenen Wert von 1 bis {value.rounds}. Jeder Wert ist genau einmal einsetzbar.</p>
      <p>Wer das Minispiel gewinnt, erhält den eigenen Einsatz als Punkte. Alle anderen erhalten 0 Punkte. Die höchste Gesamtpunktzahl gewinnt; bei Gleichstand teilt ihr euch den Sieg.</p>
    </>}
  </fieldset>;
}
