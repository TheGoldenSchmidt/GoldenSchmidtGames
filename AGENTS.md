# GoldenSchmidtGames

Private, installierbare Spielesammlung für eine Freundesrunde. Im Online-Spiel nutzt jede Person ihr eigenes Handy. Neue Spiele sollen sich einzeln ausprobieren lassen. Der Betrieb soll dauerhaft ohne laufende Kosten auskommen.

## Spielregeln und Online-Räume

- Lege Regeln und Wertung im jeweiligen Spielmodul in `shared/` ab. Lokales Spiel und beide Hostingarten verwenden dieselben Regelfunktionen. Für ein neues Spiel sind [Spielekatalog](shared/games.ts), [Raumlogik](shared/roomCore.ts) und [Auswahl der Spielansicht](src/App.tsx) die Einstiegspunkte. Inselparty braucht getrennte Geräte, wahlweise mit Node-Server oder Handy-Host.
- Neue Minispiele sind Match-Module in `shared/matches/` mit Darstellung in `src/matches/`. Vor der Arbeit [Backlog](docs/minigames/backlog.md) und [Konzept](docs/minigames/konzept.md) lesen und den Stand dort nachführen.
- Die gewählte Raumautorität entscheidet über Züge, Würfe und Punkte. Node-Server und Handy-Worker verwenden `shared/roomCore.ts`; halte die Transportadapter frei von Spielregeln. Prüfe Nachrichten vor jeder Zustandsänderung und bestätige Züge erst nach dem Speichern. Beim Wiederbeitritt muss der Schlüssel zum Raum und zum Spieler passen. Sende jedem Gerät nur seine eigene Sicht, insbesondere bei Durak-Handkarten und Sitzungsschlüsseln. Beim Handy-Hosting bleibt dasselbe Host-Gerät zuständig.

## Spieloberfläche

Bei **jeder UI-Erweiterung und UI-Bearbeitung** zuerst die [Designregeln](designregeln.md) lesen und anwenden. Sie legen Stil, Farben, Komponenten, Bewegung und responsive Gestaltung fest; den dort beschriebenen Geltungsbereich für Menüs und Spielansichten beachten.

Bei **jeder UI-Designaufgabe** den Skill `frontend-design:frontend-design` lesen und anwenden; fehlt er in der Sitzung (z. B. in Cloud-Sitzungen), das in der Übergabe nennen. Für HUDs, Menüs und Overlays zusätzlich [game-ui-frontend](.agents/skills/game-ui-frontend/SKILL.md) nutzen. Gestalte zuerst für Touch auf getrennten Handys. Inselparty, Roll It Up! und alle Minispiele sind nur für Smartphones vorgesehen: keine PC-Layouts, keine Tastaturbedienung und keine Desktop-Tests dafür. Auch die übrigen Ansichten werden vorerst nur auf dem Smartphone geprüft; PC-Prüfungen ruhen, bis die App wieder für den PC vorgesehen ist. Animationen erklären Spieleraktionen und respektieren `prefers-reduced-motion`. Beide Bewegungseinstellungen müssen zum selben Spielergebnis führen.

## Passende Prüfungen

| Änderung | Lokal prüfen |
| --- | --- |
| Regeln, Wertung oder Bots | `npm run test:rules` |
| Raum, Sitzung oder Socket-Nachricht | `npm run test:online`. Bei Änderungen am Wiederbeitritt auch `tests/browser/room-session.spec.ts`, für Handy-Hosting `tests/browser/nearby.spec.ts` ausführen. |
| Spielansicht oder Bedienung | `npm run test:screens`, danach den betroffenen Playwright-Fall ausführen. `npm run test:browser` nutzt nur das Projekt `phone`; die ruhenden PC-Fälle startet `npm run test:browser:desktop`. |
| PWA-Update oder Auslieferung | `npm run test:pwa` für den Updateablauf, `npm run build` und `npm run test:production` für die gebaute App. |

Playwright startet den Server mit dem Inhalt von `dist/`. Passt der vorinstallierte Browser nicht zur Playwright-Version, `PLAYWRIGHT_CHROMIUM_PATH` auf die Chromium-Datei setzen. Nach Client- und nach `shared/`-Änderungen zuerst `npm run build` (der Testserver nutzt den Quellcode, der Client `dist/`), dann z. B. `npm run test:browser -- tests/browser/qwixx-cup.spec.ts` ausführen. Tests dürfen nicht voraussetzen, dass ein bestimmtes Minispiel zufällig gezogen wird; dafür `toArenaMini` bzw. `participate` aus `tests/browser/party-session.ts` nutzen. Das Projekt `phone` emuliert Touch in Chromium. Für Aussagen zur 3D-Leistung oder zu Bewegungssensoren auf einem echten Handy prüfen.

Die GitHub-CI ist auf wenige Actions-Minuten ausgelegt: Automatisch läuft nur die schnelle Prüfung (Build, `test:rules`, `test:screens`, `test:pwa`, `test:online`, `test:production`) bei Pushes auf `main` und bei Pull Requests. Die Browsertests laufen dort nur in der ausführlichen Prüfung per manuellem Start (Actions → CI → „Run workflow“, optional mit einzelnen Spec-Dateien). Diese nur auf ausdrücklichen Wunsch starten und betroffene Browserfälle sonst lokal ausführen.

## Projektwissen und Übergabe

Nutze [documentation-audit](.agents/skills/documentation-audit/SKILL.md) auf ausdrückliche Anforderung, für regelmäßige Dokumentationsprüfungen oder nach größeren Entwicklungsmeilensteinen (z. B. Architektur-, Hosting- oder Spielmodulerweiterungen). Kleine Codeänderungen lösen keinen vollständigen Audit aus.

[README](README.md) für den Einstieg, [Deployment](DEPLOYMENT.md) für Hosting und Speichergrenzen, [Inselparty-Regeln](docs/island-party-rules.md) und [Figurenfreigabe](docs/approved-character-design.md) für verbindliche Spielentscheidungen. Änderungen an solchen Entscheidungen im zuständigen Dokument festhalten.

Bei parallelen Codex-Chats pro unabhängiger Änderung einen eigenen Worktree nutzen. Zur Übergabe Ziel, Branch und Commit, offene lokale Änderungen sowie geprüfte und noch offene Punkte nennen.
Fange für jede neue Aufgabe einen neuen Branch an.


## Kontinuierliche Verbesserung und Dokumentationspflege

- Prüfe bei relevanten Änderungen, ob bestehende
  Projektdokumentation aktualisiert werden muss.
- Aktualisiere betroffene Dokumentation im selben
  Auftrag, sofern die Änderung tatsächlich
  implementiert und überprüft wurde.
- Entferne nachweislich veraltete Informationen
  und vermeide redundante Dokumentation.
- Unterscheide implementierte, getestete und
  lediglich geplante Funktionalität.
- Identifiziere wiederkehrende Fehler,
  unklare Anweisungen und ineffiziente Workflows.
- Schlage daraus konkrete Verbesserungen an
  AGENTS.md, Guidelines oder Skills vor.
- Ändere grundlegende Agentenregeln und
  Qualitätsanforderungen nur nach Freigabe.
- Schwäche niemals Tests oder Sicherheitsregeln
  ab, nur um eine Aufgabe abzuschließen.
- Halte Dokumentationsänderungen klein,
  nachvollziehbar und im Git-Diff überprüfbar.
