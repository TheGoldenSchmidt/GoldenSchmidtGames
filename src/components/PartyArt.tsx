import type { CSSProperties } from "react";
import type { MiniId } from "../../shared/party";

export const MINI_LOOK: Record<MiniId, { icon: string; action: string; hint: string; goal: string }> = {
  dash:{icon:"◆",action:"Deine Figur auf Schatzjagd",hint:"Laufe, springe und sammle Schätze.",goal:"Laufen & springen · 30 Sekunden"},
  crates:{icon:"✦",action:"Mach die Kisten klein!",hint:"Laufe zu den Kisten und schlage sie auf.",goal:"Laufen, springen & schlagen · 30 Sekunden"},
  hurdles:{icon:"↑",action:"Ab zum Leuchtturm!",hint:"Springe über die Hürden auf dem Weg zum Ziel.",goal:"Hindernisrennen · 35 Sekunden"},
  shock:{icon:"◎",action:"Spring über die Wellen",hint:"Bleib auf der Insel und weiche den Wellen aus.",goal:"Laufen & springen · 30 Sekunden"},
  balance:{icon:"↔",action:"Ruhige Hände, sicherer Weg",hint:"Balanciere deine Figur über den schmalen Steg.",goal:"Neigung oder Stick · 35 Sekunden"},
  tilt:{icon:"◉",action:"Auf der Kugel um die Kurve",hint:"Neige dein Handy und rolle zu den Kristallen.",goal:"Neigung oder Stick · 30 Sekunden"},
  targets: { icon: "◆", action: "Fang den Schatz", hint: "Tippe auf das goldene Feld.", goal: "12 Schätze · 24 Sekunden" },
  colors: { icon: "✿", action: "Lass dich nicht täuschen", hint: "Welche Farbe hat die Schrift?", goal: "12 Farben · 24 Sekunden" },
  memory: { icon: "◒", action: "Was liegt unter den Muscheln?", hint: "Decke immer zwei Muscheln auf.", goal: "6 Paare · 30 Sekunden" },
  timing: { icon: "↔", action: "Triff die goldene Mitte", hint: "Stoppe den Marker genau im goldenen Bereich.", goal: "5 Versuche · bis zu 500 Punkte" },
  trail: { icon: "♣", action: "Folge der Dschungelspur", hint: "Erst merken, dann in derselben Reihenfolge antippen.", goal: "6 Symbole · 6 Sekunden merken" },
  risk: { icon: "▰", action: "Noch eine Kiste?", hint: "Sichern behält deine Beute. Eine Falle nimmt die ungesicherte Beute.", goal: "5 Versuche · 30 Sekunden" },
  words: { icon: "✎", action: "Stifte bereit!", hint: "Sammelt Tiernamen auf Papier.", goal: "Papier & Stifte · 30 Sekunden" },
  bridge: { icon: "⌒", action: "Baut die längste Brücke", hint: "Ein A4-Blatt, keine Hilfsmittel. Danach messt ihr die freie Spannweite.", goal: "A4-Papier & Lineal · 45 Sekunden" },
};

export function Shell() {
  return <svg viewBox="0 0 64 64" className="party-shell-art" aria-hidden="true"><path d="M12 43C-2 34 6 17 17 21 13 7 27 3 32 14 38 2 53 9 48 21 61 15 70 35 52 43L39 54H25Z" fill="#fff0d2" stroke="#bc8a63" strokeWidth="2"/><path d="M32 16v34M19 24l9 26m17-26-9 26M12 34l15 17m25-17L37 51" fill="none" stroke="#d8ad88" strokeWidth="2.5" strokeLinecap="round"/><path d="M25 53h14l-3 5h-8Z" fill="#d8ad88"/></svg>;
}

export function Treasure({open=false,trap=false}:{open?:boolean;trap?:boolean}) {
  return <svg viewBox="0 0 180 130" className={`party-treasure ${open?"is-open":""} ${trap?"is-trap":""}`} aria-hidden="true">
    <ellipse cx="90" cy="116" rx="66" ry="8" fill="#10485b" opacity=".15"/>
    {open&&<g className="party-treasure-loot" fill={trap?"#e66352":"#ffcc4d"}><path d="m48 24 4 9 10 1-8 7 2 10-8-5-9 5 2-10-8-7 11-1Z"/><path d="m131 10 4 10 11 1-8 7 2 11-9-6-9 6 2-11-8-7 11-1Z"/><circle cx="92" cy="36" r="12"/><circle cx="76" cy="58" r="9"/></g>}
    <path d="M34 66h112v40q-56 16-112 0Z" fill="#a35332" stroke="#623728" strokeWidth="3"/>
    <path d="M43 69v39m94-39v39" stroke="#ffcc4d" strokeWidth="9"/>
    <g className="party-treasure-lid"><path d="M31 69V50q59-29 118 0v19Z" fill="#c87d40" stroke="#623728" strokeWidth="3"/><path d="M46 44v24m87-24v24" stroke="#ffcc4d" strokeWidth="9"/><path d="M32 66h116" stroke="#ffcc4d" strokeWidth="6"/></g>
    <rect x="79" y="64" width="23" height="23" rx="4" fill="#ffcc4d"/><circle cx="90" cy="73" r="3" fill="#623728"/><path d="M90 74v6" stroke="#623728" strokeWidth="3"/>
    {trap&&<g stroke="#fff0bb" strokeWidth="4"><path d="m74 38 9 9m0-9-9 9m24-9 9 9m0-9-9 9"/></g>}
  </svg>;
}

export function MiniPreview({id}:{id:MiniId}) {
  return <div className={`party-mini-preview party-scene--${id}`} aria-hidden="true">
    {id==="risk"?<Treasure/>:id==="memory"?<div className="party-preview-shells"><Shell/><span>★</span><Shell/></div>:id==="timing"?<div className="party-preview-bridge"><i/><i/><i/><i/><i/><b>◆</b></div>:id==="colors"?<div className="party-preview-word">Blau</div>:id==="trail"?<div className="party-preview-trail"><span>☀</span><span>♣</span><span>♥</span></div>:id==="targets"?<div className="party-preview-target"><i>◆</i><i/><i/><i/></div>:<span className="party-preview-analog">{MINI_LOOK[id].icon}</span>}
  </div>;
}

export function Celebration({small=false}:{small?:boolean}) {
  return <div className={`party-celebration ${small?"party-celebration--small":""}`} aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{"--piece":i} as CSSProperties}/>)}<span>★</span></div>;
}
