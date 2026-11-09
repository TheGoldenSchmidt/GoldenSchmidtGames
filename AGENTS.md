# GoldenSchmidtGames

Private, installierbare Spielesammlung für eine Freundesrunde. Im Online-Spiel nutzt jede Person ihr eigenes Handy. Neue Spiele sollen sich einzeln ausprobieren lassen. Der Betrieb soll dauerhaft ohne laufende Kosten auskommen.

## Spielregeln und Online-Räume

- Lege Regeln und Wertung im jeweiligen Spielmodul in `shared/` ab. Lokales Spiel und beide Hostingarten verwenden dieselben Regelfunktionen. Für ein neues Spiel sind [Spielekatalog](shared/games.ts), [Raumlogik](shared/roomCore.ts) und [Auswahl der Spielansicht](src/App.tsx) die Einstiegspunkte. Inselparty braucht getrennte Geräte, wahlweise mit Node-Server oder Handy-Host.
- Die gewählte Raumautorität entscheidet über Züge, Würfe und Punkte. Node-Server und Handy-Worker verwenden `shared/roomCore.ts`; halte die Transportadapter frei von Spielregeln. Prüfe Nachrichten vor jeder Zustandsänderung und bestätige Züge erst nach dem Speichern. Beim Wiederbeitritt muss der Schlüssel zum Raum und zum Spieler passen. Sende jedem Gerät nur seine eigene Sicht, insbesondere bei Durak-Handkarten und Sitzungsschlüsseln. Beim Handy-Hosting bleibt dasselbe Host-Gerät zuständig.

## Spieloberfläche

Bei **jeder UI-Designaufgabe** den Skill `frontend-design:frontend-design` lesen und anwenden. Für HUDs, Menüs und Overlays zusätzlich [game-ui-frontend](.agents/skills/game-ui-frontend/SKILL.md) nutzen. Gestalte zuerst für Touch auf getrennten Handys und prüfe die Bedienung auch mit Maus und Tastatur am PC. Animationen erklären Spieleraktionen und respektieren `prefers-reduced-motion`. Beide Bewegungseinstellungen müssen zum selben Spielergebnis führen.

## Passende Prüfungen

| Änderung | Lokal prüfen |
| --- | --- |
| Regeln, Wertung oder Bots | `npm run test:rules` |
| Raum, Sitzung oder Socket-Nachricht | `npm run test:online`. Bei Änderungen am Wiederbeitritt auch `tests/browser/room-session.spec.ts`, für Handy-Hosting `tests/browser/nearby.spec.ts` ausführen. |
| Spielansicht oder Bedienung | `npm run test:screens`, danach den betroffenen Playwright-Fall in den Projekten `phone` und `desktop` ausführen. |
| PWA-Update oder Auslieferung | `npm run test:pwa` für den Updateablauf, `npm run build` und `npm run test:production` für die gebaute App. |

Playwright startet den Server mit dem Inhalt von `dist/`. Nach Clientänderungen zuerst `npm run build`, dann z. B. `npm run test:browser -- tests/browser/qwixx-cup.spec.ts` ausführen. Das Projekt `phone` emuliert Touch in Chromium. Für Aussagen zur 3D-Leistung oder zu Bewegungssensoren auf einem echten Handy prüfen.

## Projektwissen und Übergabe

Nutze [documentation-audit](.agents/skills/documentation-audit/SKILL.md) auf ausdrückliche Anforderung, für regelmäßige Dokumentationsprüfungen oder nach größeren Entwicklungsmeilensteinen (z. B. Architektur-, Hosting- oder Spielmodulerweiterungen). Kleine Codeänderungen lösen keinen vollständigen Audit aus.

[README](README.md) für den Einstieg, [Deployment](DEPLOYMENT.md) für Hosting und Speichergrenzen, [Inselparty-Regeln](docs/island-party-rules.md) und [Figurenfreigabe](docs/approved-character-design.md) für verbindliche Spielentscheidungen. Änderungen an solchen Entscheidungen im zuständigen Dokument festhalten.

Bei parallelen Codex-Chats pro unabhängiger Änderung einen eigenen Worktree nutzen. Zur Übergabe Ziel, Branch und Commit, offene lokale Änderungen sowie geprüfte und noch offene Punkte nennen.
