import { lookChoices, lookLabel, RENDERER_NAMES, VIEW_NAMES, type MiniLook, type MiniRenderer, type MiniView } from "../../shared/minigameLooks";
import type { PartyAction, PartyGame } from "../../shared/party";

/**
 * Rendering and view of the coming minigame (game menu, before "Ich bin bereit"). Only the host
 * changes them; everyone else sees the choice. Unity needs internet; on errors the web view takes over.
 */
export function MiniLookSettings({ game, host, busy, send }: { game: PartyGame; host: boolean; busy: boolean; send: (action: PartyAction) => void }) {
  const mini = game.mini, choices = mini && lookChoices(mini.id), look = mini?.look;
  if (game.phase !== "mini-intro" || !choices || !look) return null;
  // "Host rechnet" needs separate phones in a room: the host's Unity scene simulates for everyone.
  const renderers = (Object.keys(choices) as MiniRenderer[]).filter(r => choices[r]?.length && (r !== "unity-host" || game.online));
  const choose = (next: MiniLook) => send({ type: "look", renderer: next.renderer, view: next.view });
  return <fieldset className="settings-fields mini-look" aria-label="Darstellung und Ansicht" disabled={!host || busy}>
    <legend>Nächstes Minispiel</legend>
    <label><span>Darstellung</span><select aria-label="Darstellung" value={look.renderer} onChange={event => {
      const renderer = event.target.value as MiniRenderer, views = choices[renderer]!;
      choose({ renderer, view: views.includes(look.view) ? look.view : views[0] });
    }}>{renderers.map(r => <option key={r} value={r}>{RENDERER_NAMES[r]}</option>)}</select></label>
    <label><span>Ansicht</span><select aria-label="Ansicht" value={look.view} onChange={event => choose({ renderer: look.renderer, view: event.target.value as MiniView })}>
      {choices[look.renderer]!.map(v => <option key={v} value={v}>{VIEW_NAMES[v]}</option>)}
    </select></label>
    <p className="mini-look__note">{host ? "Gilt für alle Mitspielenden. Unity braucht Internet und lädt beim ersten Mal ca. 12 MB." : `Der Host hat ${lookLabel(look)} gewählt.`}</p>
  </fieldset>;
}

/**
 * The same choice directly in the minigame intro, before "Ich bin bereit": the host taps the variant
 * (Unity or Web) and the view; everyone else sees what the host picked.
 */
export function MiniLookPicker({ game, host, busy, send }: { game: PartyGame; host: boolean; busy: boolean; send: (action: PartyAction) => void }) {
  const mini = game.mini, choices = mini && lookChoices(mini.id), look = mini?.look;
  if (game.phase !== "mini-intro" || !choices || !look) return null;
  // "Host rechnet" needs separate phones in a room: the host's Unity scene simulates for everyone.
  const renderers = (Object.keys(choices) as MiniRenderer[]).filter(r => choices[r]?.length && (r !== "unity-host" || game.online));
  const views = choices[look.renderer]!;
  const choose = (next: MiniLook) => { if (next.renderer !== look.renderer || next.view !== look.view) send({ type: "look", renderer: next.renderer, view: next.view }); };
  if (!host) return <p className="mini-look-picker__readonly" role="status">Variante: <b>{lookLabel(look)}</b> <small>· wählt der Host</small></p>;
  const option = (key: string, label: string, pressed: boolean, onClick: () => void) =>
    <button key={key} type="button" aria-pressed={pressed} disabled={busy} onClick={onClick}>{pressed && <span aria-hidden="true">✓ </span>}{label}</button>;
  return <div className="mini-look-picker">
    {renderers.length > 1 && <div role="group" aria-label="Variante">
      <span>Variante</span>
      {renderers.map(r => option(r, RENDERER_NAMES[r], r === look.renderer, () => { const next = choices[r]!; choose({ renderer: r, view: next.includes(look.view) ? look.view : next[0] }); }))}
    </div>}
    {views.length > 1 && <div role="group" aria-label="Ansicht">
      <span>Ansicht</span>
      {views.map(v => option(v, VIEW_NAMES[v], v === look.view, () => choose({ renderer: look.renderer, view: v })))}
    </div>}
    {look.renderer === "unity" && <small>Unity lädt beim ersten Mal ca. 12 MB; ohne Internet übernimmt Web.</small>}
    {look.renderer === "unity-host" && <small>Test: Dein Handy rechnet mit Unity für alle und muss im Vordergrund bleiben. Fällt Unity aus, rechnet der Raum weiter.</small>}
  </div>;
}
