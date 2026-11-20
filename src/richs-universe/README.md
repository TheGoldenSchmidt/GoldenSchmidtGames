# Rich’s Universe

Lokale Spielwiese für Rich. Die Stein-Tafel unter den Spielmodi öffnet die Experimentliste.

## Bereich und Grenzen

- `experiments/<id>/`: freie Spielidee, Gestaltung und Ablauf, auch unfertig. Hier dürfen Experimente von den Designregeln abweichen.
- `experiments.ts`, `RichsUniverseScreen.tsx`, `richsUniverse.css`: gemeinsame Registrierung und Untermenü; Zugang/Untermenü folgen den [Designregeln](../../designregeln.md).
- Änderungen außerhalb dieses Bereichs vorher absprechen. [AGENTS.md](../../AGENTS.md) gilt auch hier.
- Experiment-CSS mit `.ru-<id>` kapseln, keine ungeschützten globalen Selektoren. Smartphone-Touch und reduzierte Bewegung berücksichtigen.
- Keine extern geladenen Schriften, Skripte oder Bilder; offline und ohne laufende Kosten nutzbar halten.

## Experiment hinzufügen

1. `experiments/hallo-universum/` kopieren, Ordner/ID eindeutig benennen.
2. Komponente mit `profile` und `onExit` gemäß `ExperimentProps` in [experiments.ts](experiments.ts) implementieren.
3. In `EXPERIMENTS` registrieren:

```ts
{
  id: "sternenjagd",
  title: "Sternenjagd",
  detail: "Fange so viele Sterne wie möglich",
  component: lazy(() => import("./experiments/sternenjagd/Sternenjagd"))
}
```

Lazy Loading lädt ein Experiment beim Öffnen. Die Fehlergrenze fängt Renderfehler ab; sie ersetzt keine Fehlerbehandlung für Ereignisse/Async-Code. Beim Entfernen der Vorlage Registrierung und zugehörigen Browserfall anpassen; leere Listen haben einen Leerhinweis.

## Prüfen

Node.js ≥22:

```bash
npm ci
npm run dev
npm run build
npm run test:screens
npm run test:browser -- tests/browser/richs-universe.spec.ts
```

Einmalig Chromium mit `npx playwright install chromium` installieren. Entwicklung: `http://localhost:5173`, am Handy über die Netzwerkadresse. Produktionsbuild vor Playwright; der Test prüft Zugang und Vorlage auf Smartphone-Größe. Eigene Mechaniken zusätzlich passend prüfen.

## Zusammenarbeit über Git

Persönliche Aufgabenbranches folgen dem Muster `rich/<thema>`, Agentenbranches den [zentralen Regeln](../../AGENTS.md#zusammenarbeit-und-auslieferung). Vom aktuellen `origin/main` starten, vor dem PR aktualisieren und prüfen. Liegen alle Dateiänderungen unter `src/richs-universe/` und ist die schnelle CI für den aktuellen PR-Stand grün, darf Rich selbst nach `main` mergen. Sobald der PR auch Dateien außerhalb dieses Ordners ändert, braucht der Merge die Freigabe von TheGoldenSchmidt.

Ein reguläres Online-Spiel gemeinsam planen: Regeln nach `shared/`, Einbindung über `shared/roomCore.ts`, Darstellung in `src/`. Experimente selbst laufen nur lokal.

## Hasenspiel

Spielbarer Prototyp für zwei Personen auf einem Smartphone oder
für eine Person gegen einen Bot (Leicht, Mittel oder Schwer). Stufen 1–3
lassen sich im Spiel auswählen. Beim Wechsel beginnt eine neue Partie. Stufe 1 beginnt
mit 16 Hasen pro Seite. Zwei gespiegelte Dreiecke mit je sechs Reihen umgeben
das Zentrum. Die fünf Zugänge pro Seite sind für Sprünge paarweise gerade
gegenüber verbunden und gestrichelt markiert. Links und rechts verbinden je
drei weitere gestrichelte Linien die beiden Hälften für direkte Züge und
Sprünge ab Stufe 1. Seitlich-vorwärts und vorwärts-seitlich sind als
Sprünge erlaubt. Ein besetztes Zentrum kann nach drei gegnerischen Zügen
zum Sieg führen. Wenn es keine legalen Züge gibt, wird gepasst. Zweimal
aufeinanderfolgendes Passen bei leerem Zentrum ergibt ein Unentschieden.

Stufe 2 erlaubt Hasen seitliche Schritte zur Reihenmitte und schützt den
mittleren Hasen eines gleichfarbigen Dreiergespanns vor gegnerischen Sprüngen.
Stufe 3 ergänzt Hirsche, Affen und Doppelsprünge. Hirsche können seitlich oder
diagonal vorwärts bis zum letzten freien Feld vor Hindernis oder Brettrand laufen,
auch über die Spielfeldmitte hinweg. Zum Testen sperren Hirsche
bei vier bis sechs Feldern Abstand dazwischen. Affen hangeln vorwärts oder
seitlich, mit höchstens einer Lücke und ohne zu schlagen.
