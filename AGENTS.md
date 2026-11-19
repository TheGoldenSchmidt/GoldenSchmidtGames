# GoldenSchmidtGames

Private Smartphone-Spielesammlung für Freunde; Betrieb ohne laufende Kosten. Online nutzt jede Person ihr eigenes Handy. Neue Spiele einzeln erprobbar halten.

## Zusammenarbeit und Auslieferung

TheGoldenSchmidt verantwortet Integration und Betrieb, Rich seinen [Bereich](src/richs-universe/README.md). Diese Regeln gelten für Menschen sowie Codex und Claude Code.

- `main` ist der vorgesehene Live-Branch: **nur Pull Requests, keine direkten Pushes**. Render-Konfiguration: Auslieferung nach erfolgreichen CI-Checks. Kein Merge während eines Spielabends; Neustarts können Node-Partien unterbrechen oder bei flüchtigem Speicher löschen.
- Jede Aufgabe auf eigenem Branch vom aktuellen `origin/main`: `<person>/<thema>`, Agenten `codex/<thema>` bzw. `claude/<thema>`. Ein Branch gehört einer Person; fremde Branches nicht umschreiben, kein Force-Push. Parallele Agenten-Sitzungen verwenden getrennte Worktrees.
- Vor dem PR `origin/main` einmischen, Konflikte lösen und passende Prüfungen erneut ausführen. Besonders auf gemeinsame Einstiegspunkte achten: `src/App.tsx`, `src/screens/HomeScreen.tsx`, `shared/games.ts`, `shared/roomCore.ts`, `package-lock.json`.
- PR: Ziel, Änderungen, Prüfungen und offene Punkte nennen; schnelle CI muss grün sein. **Merge nur nach Freigabe durch TheGoldenSchmidt**, danach Aufgabenbranch löschen. CODEOWNERS-Zuständigkeit ersetzt diese Freigabe nicht.
- Vorher absprechen: `shared/roomCore.ts`, `server/`, Sitzungen/Wiederbeitritt, Socket-Nachrichten, `.github/workflows/`, `render.yaml`, `Dockerfile`, Abhängigkeiten, diese Datei, `designregeln.md`, Inselparty-Regeln und Figurenfreigabe. Eine konkrete Freigabe im laufenden Auftrag gilt; nicht erneut fragen.
- Rich arbeitet in `src/richs-universe/`; Änderungen außerhalb vorher absprechen. Nur die dortigen `experiments/` sind von den Designregeln ausgenommen, Zugang und Untermenü folgen ihnen. Gemeinsame Sicherheits-, Offline- und Qualitätsanforderungen bleiben bestehen.
- Mit `npm ci` installieren. `package-lock.json` nur zusammen mit einer abgesprochenen Änderung an `package.json` committen. Keine Zugangsdaten ins Repo; Render und Turso verwaltet der Betreiber.
- Übergabe: Ziel, Branch/Commit, PR-Link sofern vorhanden, offene lokale Änderungen, geprüfte und offene Punkte.

Technische Einrichtung und noch offene Betreiberaufgaben: [Deployment](DEPLOYMENT.md#einrichtung-durch-den-betreiber).

## Architektur

- Regeln/Wertung in `shared/`; lokal, Node und Handy-Host verwenden dieselben Funktionen. Einstieg: [Katalog](shared/games.ts), [Raumkern](shared/roomCore.ts), [Ansichtsauswahl](src/App.tsx).
- Match-Minispiele: `shared/matches/` und `src/matches/`. Vorher [Backlog](docs/minigames/backlog.md) und [Konzept](docs/minigames/konzept.md) lesen und relevante Änderungen nachführen.
- Raumautorität entscheidet über Züge, Würfe und Punkte; beide Hostingadapter verwenden `roomCore` ohne eigene Spielregeln. Nachrichten vor Zustandsänderung prüfen, Erfolg erst nach Speicherung bestätigen.
- Wiederbeitritt nur mit passendem Raum-, Spieler- und Sitzungsschlüssel. Jedes Gerät erhält nur seine Sicht; verdeckte Karten, Einsätze und Schlüssel schützen. Beim Handy-Hosting bleibt dasselbe Host-Gerät zuständig.

## Oberfläche

Bei UI-Änderungen zuerst [Designregeln](designregeln.md) samt Geltungsbereich anwenden. Bei UI-Design `frontend-design:frontend-design` nutzen; fehlt er, in der Übergabe nennen. Für HUDs/Menüs/Overlays zusätzlich [game-ui-frontend](.agents/skills/game-ui-frontend/SKILL.md).

Touch auf getrennten Handys zuerst. Inselparty, Roll It Up! und Minispiele: keine PC-Layouts, Tastaturbedienung oder Desktop-Tests. PC-Prüfungen ruhen auch für übrige Ansichten. Animationen erklären Aktionen; `prefers-reduced-motion` beachten, mit identischem Spielergebnis.

## Passende Prüfungen

| Änderung | Lokal prüfen |
| --- | --- |
| Regeln, Wertung, Bots | `npm run test:rules` |
| Raum, Sitzung, Socket | `npm run test:online`; Wiederbeitritt zusätzlich `tests/browser/room-session.spec.ts`, Handy-Hosting `tests/browser/nearby.spec.ts` |
| Spielansicht/Bedienung | `npm run test:screens`, danach betroffener Playwright-Fall |
| Rich’s Universe | `npm run build`, `npm run test:screens`, dann `npm run test:browser -- tests/browser/richs-universe.spec.ts` |
| PWA/Auslieferung | `npm run test:pwa`, `npm run build`, `npm run test:production` |

Nach Client-/`shared/`-Änderungen **vor Playwright bauen**: Server verwendet Quellcode, Client `dist/`. Beispiel: `npm run build`, danach `npm run test:browser -- tests/browser/qwixx-cup.spec.ts`. Bei Browser-Versionsabweichung `PLAYWRIGHT_CHROMIUM_PATH` setzen.

`test:browser` nutzt `phone` (Chromium-Touchemulation); ruhende PC-Fälle: `test:browser:desktop`. Zufallsminispiele über `toArenaMini`/`participate` aus `tests/browser/party-session.ts` behandeln. 3D-Leistung und Sensorfunktion nur auf echten Handys belegen.

CI: schnelle Prüfung (Build, Regeln, Screens, PWA, Online, Produktion) bei jedem PR und Push auf `main`, auch für Doku. So erhalten Pflichtprüfungen und Render für jeden Commit ein Ergebnis. Actions-Verbrauch gemeinsam sparsam halten; ausführliche Browser-CI weiterhin **nur auf ausdrücklichen Wunsch** manuell starten, optional einzelne Specs. Sonst betroffene Fälle lokal prüfen.

## Dokumentation

[README](README.md): Einstieg; [Deployment](DEPLOYMENT.md): Betrieb/Speicher; [Inselparty-Regeln](docs/island-party-rules.md) und [Figurenfreigabe](docs/approved-character-design.md): verbindliche Entscheidungen.

[documentation-audit](.agents/skills/documentation-audit/SKILL.md) bei angefordertem/regelmäßigem Audit oder größeren Architektur-, Hosting- oder Spielmodul-Meilensteinen; nicht bei kleinen Änderungen.

Betroffene Doku im selben Auftrag knapp nachführen, wenn die Änderung implementiert und überprüft ist. Veraltetes nur nach Beleg entfernen, Dopplungen vermeiden; implementiert/getestet/geplant unterscheiden. Dauerhafte Entscheidungen einmal im zuständigen Dokument pflegen. Wiederkehrende Fehler und ineffiziente Abläufe belegen und konkrete Regel-/Skillverbesserungen vorschlagen. Grundlegende Agentenregeln und Qualitätsanforderungen nur nach Freigabe ändern; Tests und Sicherheitsregeln niemals abschwächen. Diff klein und prüfbar halten.
