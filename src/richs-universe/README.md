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

Persönliche Aufgabenbranches: `rich/<thema>`; Agentenbranches gemäß [zentralen Regeln](../../AGENTS.md#zusammenarbeit-und-auslieferung). Vom aktuellen `origin/main` starten, vor PR aktualisieren und prüfen. Merge nur nach Freigabe durch TheGoldenSchmidt: `main` ist für Live-Auslieferung nach CI vorgesehen.

Ein reguläres Online-Spiel gemeinsam planen: Regeln nach `shared/`, Einbindung über `shared/roomCore.ts`, Darstellung in `src/`. Experimente selbst laufen nur lokal.
