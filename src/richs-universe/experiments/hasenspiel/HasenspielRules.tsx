import type { Level } from "./rules";

export function HasenspielRules({ level }: { level: Level }) {
  const advanced = level === 3;
  return (
    <details>
      <summary>Regeln für Stufe {level}</summary>
      <p><strong>Das Spielprinzip.</strong> Ihr spielt 1 gegen 1. {advanced
        ? <><strong>Neu in Stufe 3:</strong> Jede Seite hat 12 Hasen, 2 Hirsche und 2 Affen.</>
        : "Beide Seiten haben je 16 Hasen."} Ein Münzwurf lost aus, wer Blau und wer Grau spielt.
        Blau beginnt, danach zieht ihr abwechselnd.</p>
      <p><strong>Das Spielbrett.</strong> Zwei gespiegelte Dreiecke treffen an der Lichtung aufeinander.
        Jede Seite hat sechs nummerierte Reihen, vom einzelnen Dreieck in Reihe 1 bis zur breiten Reihe 6.
        Die gestrichelten Linien links und rechts verbinden je drei gegenüberliegende Feldpaare und zählen wie gemeinsame Kanten.
        Die Lichtung ist auf jeder Seite mit den fünf mittleren Feldern der Reihe 6 verbunden.
        Wer über die Lichtung springt, landet gerade gegenüber.</p>
      <p><strong>Einen Zug machen.</strong> Tippe zuerst auf deine Figur, dann auf ein markiertes Landefeld.
        Gibt es mehrere Wege dorthin, wähle unter dem Brett einen aus. Zwei Dreiecksfelder sind benachbart,
        wenn sie eine Kante teilen (eine geteilte Linie, eine Ecke reicht nicht) oder durch eine gestrichelte Linie verbunden sind.</p>
      <p><strong>Die Hasen.</strong> Ein Hase zieht auf ein freies Nachbarfeld nach vorn oder auf die direkt verbundene Lichtung
        {advanced ? ". Seitwärts darf er ein freies Feld zur Reihenmitte ziehen." : "."}
        {" "}Er kann vorwärts oder seitwärts über {advanced ? "eine benachbarte Figur" : "einen benachbarten Hasen"} auf ein freies,
        mit {advanced ? "ihr" : "ihm"} verbundenes Feld springen. Innerhalb einer Reihe springt er geradeaus.
        Gegnerische {advanced ? "Figuren" : "Hasen"} werden geschlagen, eigene bleiben stehen.
        Im nächsten eigenen Zug darf {advanced ? "dieselbe Figur dieselbe eigene Figur" : "derselbe Hase denselben eigenen Hasen"} nicht erneut überspringen.
        {advanced && " Stehen drei gleichfarbige Hasen direkt nebeneinander in einer Reihe, ist der mittlere vor gegnerischen Sprüngen geschützt."}</p>
      {level === 2 && <ul>
        <li><strong>Neu in Stufe 2 · Seitwärts ziehen.</strong> Ein Hase darf innerhalb seiner Reihe ein Feld zur Reihenmitte ziehen,
          wenn es frei ist.</li>
        <li><strong>Neu in Stufe 2 · Dreierreihe.</strong> Stehen drei gleichfarbige Hasen direkt nebeneinander in derselben Reihe,
          ist der mittlere vor gegnerischen Sprüngen geschützt. Eigene Hasen dürfen ihn weiterhin überspringen.</li>
      </ul>}
      {advanced && <ul>
        <li><strong>Neu in Stufe 3 · Doppelsprung.</strong> Hasen und Affen dürfen in einem Zug zweimal springen,
          wenn sie zuerst eine eigene und danach eine gegnerische Figur überspringen. Beide Landefelder müssen frei sein.</li>
        <li><strong>Neu in Stufe 3 · Hirsche.</strong> Hirsche ziehen waagerecht, senkrecht oder diagonal über freie Felder.
          Sie springen nicht. Nach einem Zug über mindestens drei Felder setzen sie beim nächsten eigenen Zug aus.
          Bis dahin können sie nicht übersprungen werden.</li>
        <li><strong>Neu in Stufe 3 · Hirschwall.</strong> Bringt ein Zug zwei gleichfarbige Hirsche in dieselbe Reihe,
          entsteht zwischen ihnen ein grüner Wall. Die eigene Farbe kann frei hindurchziehen. Gegnerische Figuren darauf
          setzen beim nächsten eigenen Zug aus, außer Hirschen. Danach können sie seitlich oder rückwärts herausziehen.
          Gegnerische Affen können den Wall beim Hangeln überqueren. Der Wall verschwindet, sobald die Hirsche nicht mehr in derselben Reihe stehen.</li>
        <li><strong>Neu in Stufe 3 · Affen.</strong> Affen dürfen in alle Richtungen ziehen und springen, auch rückwärts.
          Beim Hangeln bewegen sie sich vorwärts oder seitwärts über mindestens zwei Hasen. Zwischen ihnen darf höchstens
          ein Feld frei sein. Der Affe landet auf einem freien Feld und schlägt beim Hangeln keine Figur.</li>
      </ul>}
      <p><strong>Gewinnen und passen.</strong> Wer mit {advanced ? "derselben Figur" : "demselben Hasen"} drei gegnerische Züge
        in Folge auf der Lichtung bleibt, gewinnt. Ein gegnerischer Pass zählt mit. Wer keinen erlaubten Zug hat, muss passen.
        Passen beide direkt nacheinander bei leerer Lichtung, endet die Partie unentschieden.
        {advanced && " Solange noch eine Betäubung oder Hirschruhe aktiv ist, zählen Pässe dafür nicht."}</p>
    </details>
  );
}
