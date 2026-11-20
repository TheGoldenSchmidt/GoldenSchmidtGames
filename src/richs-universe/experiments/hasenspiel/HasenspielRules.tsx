import { examples, RuleExample } from "./RuleExamples";
import type { Level } from "./rules";

export function HasenspielRules({ level }: { level: Level }) {
  const advanced = level === 3;
  return (
    <details key={level}>
      <summary>Regeln für Stufe {level}</summary>
      <p><strong>Das Spielprinzip.</strong> Ihr spielt 1 gegen 1. {advanced
        ? <><strong>Neu in Stufe 3:</strong> Jede Seite hat 12 Hasen, 2 Hirsche und 2 Affen.</>
        : "Beide Seiten haben je 16 Hasen."} Ein Münzwurf lost aus, wer Blau und wer Grau spielt.
        Blau beginnt, danach zieht ihr abwechselnd. Wer mit demselben Hasen drei gegnerische Züge
        in Folge auf der Lichtung bleibt, gewinnt. Ein gegnerischer Pass zählt mit.{advanced && " Affen und Hirsche können die Lichtung besetzen, zählen aber nicht für den Sieg."}</p>
      <p><strong>Das Spielbrett.</strong> Zwei gespiegelte Dreiecke treffen an der Lichtung aufeinander.
        Jede Seite hat sechs nummerierte Reihen, vom einzelnen Dreieck in Reihe 1 bis zur breiten Reihe 6.
        Die gestrichelten Linien links und rechts verbinden je drei gegenüberliegende Feldpaare und zählen wie gemeinsame Kanten.
        Die Lichtung ist auf jeder Seite mit den fünf mittleren Feldern der Reihe 6 verbunden.
        Wer darüber springt, landet gerade gegenüber.</p>
      <RuleExample frames={examples.crossing} />
      <p><strong>Einen Zug machen.</strong> Tippe zuerst auf deine Figur, dann auf ein markiertes Landefeld.
        Gibt es mehrere Wege dorthin, wähle unter dem Brett einen aus. Zwei Dreiecksfelder sind benachbart,
        wenn sie eine Kante teilen (eine geteilte Linie, eine Ecke reicht nicht) oder durch eine gestrichelte Linie verbunden sind.</p>
      <p><strong>Hase ziehen.</strong> Ziehe eine Ebene vor auf ein freies Nachbarfeld oder auf die direkt verbundene Lichtung.</p>
      <RuleExample frames={level === 1 ? examples.step : examples.step.filter((_, index) => index !== 1)} />
      <p><strong>Hase springen.</strong> Springe vorwärts oder seitwärts über {advanced ? "eine benachbarte Figur" : "einen benachbarten Hasen"}
        auf ein freies, damit verbundenes Feld. In derselben Reihe springst du geradeaus. Rückwärtssprünge sind auch zur oder über die Lichtung verboten. Gegnerische Figuren werden geschlagen,
        eigene bleiben stehen. Im nächsten eigenen Zug darf dieselbe Figur dieselbe eigene Figur nicht erneut überspringen.</p>
      <RuleExample frames={examples.jump} />
      {level >= 2 && <ul>
        <li><strong>Neu in Stufe 2 · Seitwärts ziehen.</strong> Ein Hase darf ein freies Feld seitwärts zur Reihenmitte ziehen.
          <RuleExample frames={examples.sideways} /></li>
        <li><strong>Neu in Stufe 2 · Dreierreihe.</strong> Stehen drei gleichfarbige Hasen nebeneinander in einer Reihe,
          darf nur die eigene Farbe den mittleren überspringen.
          <RuleExample frames={examples.trio} /></li>
      </ul>}
      {advanced && <ul>
        <li><strong>Neu in Stufe 3 · Doppelsprung.</strong> Hasen und Affen dürfen in einem Zug zweimal springen,
          wenn sie zuerst eine eigene und danach eine gegnerische Figur überspringen. Beide Landefelder müssen frei sein.<RuleExample frames={examples.double} /></li>
        <li><strong>Neu in Stufe 3 · Hirsche.</strong> Hirsche ziehen waagerecht, senkrecht oder diagonal über freie Felder.
          Sie springen nicht. Nach einem Zug über mindestens drei Felder setzen sie beim nächsten eigenen Zug aus.
          Bis dahin können sie nicht übersprungen werden.<RuleExample frames={examples.deer} /></li>
        <li><strong>Neu in Stufe 3 · Hirschwall.</strong> Stehen nach einem Zug zwei gleichfarbige Hirsche in derselben Reihe
          und liegen <strong>drei bis sechs Felder</strong> zwischen ihnen, entsteht auf diesen Feldern ein grüner Wall.
          Die eigene Farbe kann frei hindurchziehen. Gegnerische Figuren darauf
          setzen beim nächsten eigenen Zug aus, außer Hirschen. Danach können sie seitlich oder rückwärts herausziehen.
          Gegnerische Affen können den Wall beim Hangeln überqueren. Vom Wall aus kann keine Figur über seine Hirsche springen. Hasen und Affen können einen Wallhirsch nur seitlich von außen auf ein freies Feld im Wall überspringen und dabei einen gegnerischen Hirsch schlagen. Der Wall verschwindet, sobald die Hirsche in verschiedenen Reihen stehen oder der Abstand außerhalb dieser Grenzen liegt.<RuleExample frames={examples.wall} /></li>
        <li><strong>Neu in Stufe 3 · Affen.</strong> Affen dürfen in alle Richtungen ziehen und springen, auch rückwärts.
          Beim Hangeln bewegen sie sich vorwärts oder seitwärts über mindestens zwei Hasen. Zwischen ihnen darf höchstens
          ein Feld frei sein. Der Affe landet auf einem freien Feld und schlägt beim Hangeln keine Figur.<RuleExample frames={examples.monkey} /></li>
      </ul>}
      <p><strong>Passen.</strong> Wer keinen erlaubten Zug hat, muss passen.
        Passen beide direkt nacheinander ohne Hasen auf der Lichtung, endet die Partie unentschieden.
        {advanced && " Solange noch eine Betäubung oder Hirschruhe aktiv ist, zählen Pässe dafür nicht."}</p>
    </details>
  );
}
