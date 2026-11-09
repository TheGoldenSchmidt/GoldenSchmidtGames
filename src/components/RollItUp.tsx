import { characterId, characterPortrait } from "../../shared/characters";
import type { PartyGame, PartyPlayer } from "../../shared/party";
import { hasFullSet, JAYSPOT, stationAt, STATIONS } from "../../shared/partyBoard";

export function Collection({player}:{player:PartyPlayer}) {
  return <details className="roll-collection">
    <summary><strong>Dein Set</strong><span>{player.supplies?.length ?? 0} / {STATIONS.length}</span></summary>
    <ul>{STATIONS.map(s=><li key={s.field}><b>{player.supplies?.includes(s.field)?"✓ ":""}{s.name}</b><span>Feld {s.field} · {s.price} Münzen</span></li>)}</ul>
    <p>{hasFullSet(player)?"Der Weg zum Jayspot ist frei.":"Mit sechs Utensilien öffnet sich der Weg zur Bank."}</p>
  </details>;
}

export function mapObjective(game:PartyGame) {
  return game.mode === "roll-it-up"
    ? <span><b>⌖</b> Jayspot<small>Bank auf dem Hügel · Feld {JAYSPOT}</small></span>
    : <span><b>★</b> Trophäe auf Feld {game.trophyField}<small>20 Münzen</small></span>;
}

export function objectiveHint(game:PartyGame, id:number) {
  if (game.mode !== "roll-it-up") return id === game.trophyField ? "Trophäenstand: 20 Münzen. " : "";
  if (id === JAYSPOT) return "Mit vollständigem Set gewinnst du bei Ankunft.";
  const station = stationAt(id);
  return station ? station.name + " beim Passieren für " + station.price + " Münzen kaufen. " : "";
}

export function TrayMapArt() {
  return <g aria-hidden="true">
    <rect width="100" height="100" rx="5" fill="#423c30"/>
    <circle cx="50" cy="50" r="49" fill="#22584f" stroke="#d8a76a" strokeWidth="1.2"/>
    <circle cx="50" cy="50" r="45" fill="#c98462" stroke="#854f43" strokeWidth="1.5"/>
    <circle cx="50" cy="50" r="20" fill="#8b935d"/><circle cx="50" cy="50" r="15" fill="#9ca36c"/>
    <g fill="#ddad6d" stroke="#584536" strokeWidth=".55"><path d="M44 41h12v2H44zm0 3h12v2H44zm-1 3h14v1.7H43z"/><path d="M45 49v1m10-1v1"/></g>
    <g transform="translate(30 29) rotate(-26)"><rect width="5" height="10" rx="1" fill="#b24f3f"/><path d="M0 1h5v2H0z" fill="#e0cdb3"/></g>
    <g transform="translate(62 25) rotate(18)"><rect width="10" height="5" rx=".5" fill="#f1d4a2"/><path d="M1 2h8v1H1z" fill="#306859"/></g>
  </g>;
}

export function JayspotFinish({player}:{player:PartyPlayer}) {
  return <svg className="roll-sunset" viewBox="0 0 300 130" aria-hidden="true">
    <defs><linearGradient id="jay-sky" x2="0" y2="1"><stop stopColor="#f2bd83"/><stop offset="1" stopColor="#f9deae"/></linearGradient></defs>
    <rect width="300" height="130" rx="14" fill="url(#jay-sky)"/>
    <circle cx="218" cy="45" r="23" fill="#ffedbf"/>
    <path d="M0 97Q43 58 92 82T196 77Q254 47 300 70V130H0Z" fill="#98a17b"/>
    <path d="M0 119Q122 51 241 100L300 111V130H0Z" fill="#536c50"/>
    <g stroke="#31483d" strokeWidth="4"><path d="M99 74v31m93-31v31M99 70V51m93 19V51"/></g>
    <g fill="#b97043" stroke="#754d36"><rect x="87" y="53" width="116" height="7" rx="2"/><rect x="87" y="63" width="116" height="7" rx="2"/><rect x="85" y="78" width="120" height="7" rx="2"/></g>
    <image href={characterPortrait(characterId(player.characterId))} x="116" y="23" width="55" height="69"/>
  </svg>;
}
