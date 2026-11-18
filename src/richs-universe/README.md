# Rich’s Universe

Rich’s eigene Spielwiese in GoldenSchmidtGames. Auf dem Startbildschirm führt die
Stein-Tafel **Rich’s Universe** direkt unter „Lokal spielen“ und „Online spielen“
in ein Untermenü. Dort steht jedes Experiment als eigener Eintrag.

## Was hier frei ist

- Alles in `src/richs-universe/experiments/<id>/`: Spielidee, Gestaltung, Ablauf.
  Experimente dürfen unfertig sein und von den Designregeln abweichen.
- Neue Einträge in [experiments.ts](experiments.ts) und Änderungen am Untermenü
  ([RichsUniverseScreen.tsx](RichsUniverseScreen.tsx), [richsUniverse.css](richsUniverse.css)).

## Was gemeinsam bleibt

- Dateien außerhalb von `src/richs-universe/` nur nach Absprache ändern. Für die
  übrige App gelten [AGENTS.md](../../AGENTS.md) und die [Designregeln](../../designregeln.md).
- CSS-Klassen eines Experiments beginnen mit `.ru-<id>`, damit sie den Rest der App
  nicht verändern. Keine globalen Selektoren wie `body`, `button` oder `.iw-menu`
  ohne dieses Präfix.
- Die App ist eine Handy-App: für Touch auf schmalen Bildschirmen bauen,
  `prefers-reduced-motion` respektieren.
- Keine Inhalte von fremden Servern (Schriften, Skripte, Bilder) laden; die App
  muss offline funktionieren und dauerhaft ohne laufende Kosten auskommen.

## Neues Experiment anlegen

1. Ordner `experiments/hallo-universum/` kopieren und umbenennen, z. B.
   `experiments/sternenjagd/`. Die Datei-ID ist zugleich die `id` des Eintrags.
2. In der Komponente den Inhalt ersetzen. Sie erhält `profile` (Gastprofil auf diesem
   Handy) und `onExit` (zurück zur Experimentliste), siehe `ExperimentProps` in
   [experiments.ts](experiments.ts).
3. Das Experiment in `EXPERIMENTS` eintragen:

   ```ts
   {
     id: "sternenjagd",
     title: "Sternenjagd",
     detail: "Fange so viele Sterne wie möglich",
     component: lazy(() => import("./experiments/sternenjagd/Sternenjagd"))
   }
   ```

Experimente werden erst beim Öffnen geladen und verlangsamen den Startbildschirm
nicht. Stürzt ein Experiment ab, zeigt das Untermenü die Fehlermeldung und die übrige
App läuft weiter. Die Vorlage `hallo-universum` kann gelöscht werden, sobald es
eigene Experimente gibt; die Liste zeigt dann einen Leerhinweis.

## Ausprobieren und prüfen

```bash
npm install
npm run dev          # App unter http://localhost:5173, am Handy über die Netzwerkadresse
npm run build        # Typprüfung und Produktionsbuild
npm run test:browser -- tests/browser/richs-universe.spec.ts
```

Der Browsertest prüft den Zugang auf dem Startbildschirm und das Öffnen der Vorlage.
Wird die Vorlage entfernt, den Test auf ein eigenes Experiment umstellen.

## Vom Experiment zum richtigen Spiel

Experimente laufen nur auf dem eigenen Handy. Soll daraus ein Online-Spiel für die
Freundesrunde werden, wandert es in die regulären Bereiche: Regeln in `shared/`,
Raumlogik in `shared/roomCore.ts`, Darstellung in `src/`. Den Ablauf dafür beschreibt
[AGENTS.md](../../AGENTS.md); das am besten gemeinsam planen.

## Zusammenarbeit über Git

Für jede Änderung einen eigenen Branch anlegen und per Pull Request nach `main`
bringen. Vor dem Pull Request `npm run build` und den Browsertest oben ausführen.
