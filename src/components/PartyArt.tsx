import type { CSSProperties } from "react";
import type { MiniId } from "../../shared/party";
import { MATCH_IDS, MATCH_MODULES, isMatchId } from "../../shared/matches/framework";

export const MINI_LOOK: Record<MiniId, { icon: string; action: string; hint: string; goal: string }> = {
  walls:{icon:"▥",action:"Finde die Lücke",hint:"Bewege dich unter eine Öffnung",goal:"Wände sicher überstehen"},
  hex:{icon:"⬡",action:"Rette dich auf die richtige Farbe",hint:"Achte auf die Ansage",goal:"Auf der sicheren Plattform bleiben"},
  photo:{icon:"▣",action:"Das Foto gehört dir",hint:"Kämpfe um den goldenen Platz",goal:"Beim Auslösen vorne stehen"},
  bumper:{icon:"◉",action:"Kugel gegen Kugel",hint:"Remple und halte dein Gleichgewicht",goal:"Auf der Insel bleiben"},
  says:{icon:"⚓",action:"Hör auf den Kapitän",hint:"Erkenne die Täuschungen",goal:"Zum richtigen Zeichen laufen"},
  stack:{icon:"▤",action:"Hoch hinaus im Kistenregen",hint:"Ausweichen und hinaufspringen",goal:"Oben Punkte sammeln"},
  golf:{icon:"⚑",action:"Mit Gefühl ins Zielloch",hint:"Neigung oder Stick lenken die Kugel",goal:"Den Parcours schnell schaffen"},
  duos:{icon:"⚒",action:"Gemeinsam öffnet ihr den Weg",hint:"Besetzt zusammen die Schalter",goal:"Durch beide Tore ins Ziel"},

  dash:{icon:"◆",action:"Deine Figur auf Schatzjagd",hint:"Laufe, springe und sammle Schätze.",goal:"Laufen & springen · 30 Sekunden"},
  crates:{icon:"✦",action:"Mach die Kisten klein!",hint:"Laufe zu den Kisten und schlage sie auf.",goal:"Laufen, springen & schlagen · 30 Sekunden"},
  hurdles:{icon:"↑",action:"Ab zum Leuchtturm!",hint:"Springe über die Hürden auf dem Weg zum Ziel.",goal:"Hindernisrennen · 35 Sekunden"},
  shock:{icon:"◎",action:"Spring über die Wellen",hint:"Bleib auf der Insel und weiche den Wellen aus.",goal:"Laufen & springen · 30 Sekunden"},
  balance:{icon:"↔",action:"Ruhige Hände, sicherer Weg",hint:"Balanciere deine Figur über den schmalen Steg.",goal:"Neigung oder Stick · 35 Sekunden"},
  tilt:{icon:"◉",action:"Auf der Kugel um die Kurve",hint:"Neige dein Handy und rolle zu den Kristallen.",goal:"Neigung oder Stick · 30 Sekunden"},
  ...Object.fromEntries(MATCH_IDS.map(id => [id, MATCH_MODULES[id].meta.look])) as Record<typeof MATCH_IDS[number], { icon: string; action: string; hint: string; goal: string }>,
};

export function MiniPreview({id}:{id:MiniId}) {
  return <div className={`party-mini-preview party-scene--${id}`} aria-hidden="true">
    {isMatchId(id)?<span className={`match-preview match-preview--${id}`}><b>{MINI_LOOK[id].icon}</b><small>Neu</small></span>:<span className="party-preview-analog">{MINI_LOOK[id].icon}</span>}
  </div>;
}

export function Celebration({small=false}:{small?:boolean}) {
  return <div className={`party-celebration ${small?"party-celebration--small":""}`} aria-hidden="true">{Array.from({length:14},(_,i)=><i key={i} style={{"--piece":i} as CSSProperties}/>)}<span>★</span></div>;
}
