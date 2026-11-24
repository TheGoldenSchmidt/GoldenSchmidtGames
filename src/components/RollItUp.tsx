import { characterId, characterPortrait } from "../../shared/characters";
import { TROPHY_PRICE, type PartyGame, type PartyPlayer } from "../../shared/party";
import { goalField, hasFullSet, rollBoard, stationAt, stationsOf } from "../../shared/partyBoard";

export function Collection({game,player,onShow}:{game:PartyGame;player:PartyPlayer;onShow?:(field:number)=>void}) {
  return <section className="roll-collection">
    <p><strong>{player.supplies?.length ?? 0} / {stationsOf(game).length} Utensilien gesammelt</strong></p>
    <ul>{stationsOf(game).map(s=>{const collected=player.supplies?.includes(s.field);return <li key={s.field}><div><b>{collected?"✓ ":""}{s.name}</b><span>{collected?"Gesammelt":`${s.price} Münzen${player.coins<s.price?` · noch ${s.price-player.coins} nötig`:" · bezahlbar"}`} · Feld {s.field}</span></div>{onShow&&<button className="roll-show" onClick={()=>onShow(s.field)} aria-label={`${s.name} auf der Karte zeigen`}>Zeigen</button>}</li>;})}</ul>
    <p>{hasFullSet(game,player)?"Der Weg zum Jayspot ist frei.":"Mit sechs Utensilien öffnet sich der Weg zur Bank."}</p>
  </section>;
}

export function mapObjective(game:PartyGame) {
  return game.mode === "roll-it-up"
    ? <span><b>⌖</b> Jayspot<small>{rollBoard(game).id==="grinder"?"Lounge in der Mitte":"Bank auf dem Hügel"} · Feld {goalField(game)}</small></span>
    : <span><b>★</b> Trophäenstand<small>Feld {game.trophyField} · {TROPHY_PRICE} Münzen</small></span>;
}

export function objectiveHint(game:PartyGame, id:number) {
  if (game.mode !== "roll-it-up") return id === game.trophyField ? `Trophäenstand: ${TROPHY_PRICE} Münzen. ` : "";
  if (id === goalField(game)) return "Mit vollständigem Set gewinnst du bei Ankunft.";
  const station = stationAt(game, id);
  return station ? station.name + " beim Passieren für " + station.price + " Münzen kaufen. " : "";
}

export function TrayMapArt({game}:{game:PartyGame}) {
  const board=rollBoard(game);
  if(board.id==="grinder")return <GrinderMapArt tunnels={Object.entries(board.tunnels).filter(([a,b])=>Number(a)<b).map(([a,b])=>[board.fields[Number(a)],board.fields[b]])}/>;
  return <g aria-hidden="true">
    <rect width="100" height="100" fill="#7f9be8"/>
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

/** 2D view of the Grinder: steel disc, knurled rim, grinding teeth, tubes and the lounge in the middle. */
function GrinderMapArt({tunnels}:{tunnels:{x:number;y:number}[][]}) {
  const teeth=(radius:number,count:number)=>Array.from({length:count},(_,i)=>{const a=i*Math.PI*2/count+radius;return <path key={`${radius}-${i}`} d={`M${50+Math.cos(a)*radius} ${50+Math.sin(a)*radius-1}l1 2h-2Z`}/>;});
  return <g aria-hidden="true">
    <rect width="100" height="100" fill="#5f7fb8"/>
    <circle cx="50" cy="50" r="49" fill="#3b4352" stroke="#8d97a6" strokeWidth="1.6" strokeDasharray="1.2 .8"/>
    <circle cx="50" cy="50" r="46" fill="#b9c0ca" stroke="#6b7482" strokeWidth="1"/>
    <circle cx="50" cy="50" r="17" fill="#8fae4b"/><circle cx="50" cy="50" r="12" fill="#9fbd5a"/>
    <g fill="#8d97a6" opacity=".9">{teeth(35.5,40)}{teeth(26.5,30)}</g>
    <g fill="none" stroke="#e58a3a" strokeWidth="1.1" strokeDasharray="2 1.2" opacity=".85">{tunnels.map(([a,b],i)=><path key={i} d={`M${a.x} ${a.y}Q50 50 ${b.x} ${b.y}`}/>)}</g>
    <g transform="translate(50 47)"><rect x="-6" y="-2" width="12" height="4" rx="1.2" fill="#6f4fb0"/><rect x="-6" y="-4" width="12" height="2" rx=".8" fill="#5a3d8f"/></g>
  </g>;
}
