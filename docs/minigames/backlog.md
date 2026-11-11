# Backlog: Match-Minispiele

Persistenter Arbeitsstand für die zwölf neuen Minispiele. Bei jeder
Sitzung zuerst hier lesen und am Ende aktualisieren. Konzept:
[konzept.md](konzept.md) · Regeln: [spezifikation.md](spezifikation.md).

Statuswerte: **offen** · **in Arbeit** · **fertig** (Lobby bis
Ergebnis, automatisch getestet) · **blockiert**.

## Phasen

| Phase | Inhalt | Status |
| --- | --- | --- |
| 0 | Analyse, Konzept, Spezifikation, Backlog | fertig |
| 1 | Framework, Klassik-Option, Nur-Smartphone-Umstellung, Testspiel | fertig |
| 2 | Quick Draw, Light Trails, Neon Pong | fertig (Gerätetest offen) |
| 3 | Tank Trouble, Bomb Arena, Floor is Lava | fertig (Gerätetest offen) |
| 4 | Sumo Smash, Bumper Mayhem, Chaos Run | fertig (Gerätetest offen) |
| 5 | Arrow Masters, Tower Tumble, Hook Wars | in Arbeit (Arrow Masters, Tower Tumble fertig) |
| 6 | Qualitätssicherung, Leistung, Feinschliff, Dokumentation | offen |

## Spiele

| # | Spiel | Kennung | Spieler | Priorität | Status | Automatische Tests |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Quick Draw | `quickdraw` | 2–6 | P1 | fertig | Regeln (`quickdraw-test`), Socket (`match-online-test`), Browser `phone` |
| 2 | Light Trails | `trails` | 2–6 | P1 | fertig | Regeln (`light-trails-test`), Browser `phone` |
| 3 | Neon Pong | `pong` | 2 oder 4 | P1 | fertig | Regeln (`neon-pong-test`, 1v1 und 2v2), Browser `phone` 1v1/2v2 |
| 4 | Tank Trouble | `tanks` | 2–6 | P2 | fertig | Regeln (`tank-trouble-test`), Browser `phone` |
| 5 | Bomb Arena | `bombs` | 2–6 | P2 | fertig | Regeln (`bomb-arena-test`), Browser `phone` |
| 6 | Floor is Lava | `lava` | 2–6 | P2 | fertig | Regeln (`floor-is-lava-test`), Browser `phone` |
| 7 | Sumo Smash | `sumo` | 2–6 | P3 | fertig | Regeln (`ring-games-test`), Browser `phone` |
| 8 | Bumper Mayhem | `bumpercars` | 2–6 | P3 | fertig | Regeln (`ring-games-test`), Browser `phone` |
| 9 | Chaos Run | `chaosrun` | 2–6 | P3 | fertig | Regeln (`chaos-run-test`), Browser `phone` |
| 10 | Arrow Masters | `arrows` | 2–6 | P4 | fertig | Regeln (`arrow-masters-test`), Browser `phone` |
| 11 | Tower Tumble | `tower` | 2–6 | P4 | fertig | Regeln (`tower-tumble-test`), Browser `phone` |
| 12 | Hook Wars | – | 2–6 | P4 | offen | – |

„Fertig“ heißt: in Lobby, Zufallspool, Übung (gegen Bots), Bot-Testraum,
Wettbewerb und Inselparty spielbar; Ergebnis fließt in die bestehende Wertung.
Leistung und Bedienung auf echten Handys sind für kein Spiel geprüft.

## Phase 1: umgesetzt

- `shared/matches/types.ts`, `framework.ts`: Modulvertrag, Registrierung,
  Spielerzahl/Teams, Eingabeprüfung (`MatchInput` mit kumulativen Zählern),
  fester 50-ms-Schritt, harte Zeitgrenze, öffentliche Sicht, Laufzeitschätzung,
  Aufgeben/Abbruch (`presence`), Ranglisten mit geteilten Plätzen, Bot-Eingaben.
- `shared/minigameCatalog.ts`: gemeinsamer Pool aus Match- und klassischen
  Spielen; Option `classic` für Inselparty, Roll It Up! und Wettbewerb.
- `shared/party.ts`, `roomCore.ts`, `partyBots.ts`: Start, Takt, Ende,
  Wertung (`partyMiniResults`), Pausen, Neustart, `party:match` mit 10/20 Hz.
- `src/matches/`: Bühne (`MatchStage`), Steuerelemente (Tippfläche, Stick,
  Aktionstaste, Wischfläche, Schieberegler, Zielfläche), Töne, Registrierung.
- Lobby: Checkbox „Klassische Minispiele“, getrennte Auswahlgruppen,
  Übungsliste mit neuen Spielen, Bot-Testwerkzeug mit allen Spielen.
- Testspiel: `scripts/match-framework-test.ts` prüft das Framework mit einem
  eigenen Tippzähler-Modul ohne Lobbyeintrag.
- Nur Smartphone: Playwright-Projekt `desktop` ignoriert Party- und
  Minispiel-Specs; gemischte Specs überspringen Party-Fälle auf dem Desktop.

## Wiederverwendbare Bausteine aus Phase 2/3

- `geometry.ts`: Kreis-Rechteck-Abstoßung, Kreis-Kreis-Trennung, Strahl-Rechteck-Test.
- Muster „Durchgänge mit Pause, Punkte je überlebtem Gegner, Stechen“:
  Light Trails, Bomb Arena, Floor is Lava.
- Steuerelemente: `Stick`, `ActionButton` mit Abklingring, `AimPad`,
  `SwipeZone`, `SliderPad`, `TapZone`.
- Abhängigkeiten der offenen Spiele: Sumo Smash und Bumper Mayhem teilen
  Ring-Out und Impulse; Tower Tumble braucht einen deterministischen
  Starrkörperlöser; Hook Wars Plattform- und Seilphysik.

## Architekturentscheidungen (Kurzfassung)

Siehe [konzept.md](konzept.md#architekturentscheidungen). Ergänzungen aus der
Umsetzung:

- **Aufgeben statt Versuch beenden:** Die bestehende Aktion `finish` lässt in
  Match-Spielen die Person ausscheiden. Später Aufgebende stehen vor früher
  Aufgebenden; bleibt höchstens eine Person, endet das Match.
- **Teilnahme:** Wer im Match keine Eingabe gesendet hat, gilt wie bisher als
  nicht teilnehmend und erhält keine Münzen oder Einsatzpunkte.
- **Klassische Tastaturbedienung** der 3D-Arenen bleibt vorerst im Code
  (bestehende `phone`-Tests nutzen sie), wird aber nicht weiterentwickelt.

## Teststatus

| Prüfung | Stand |
| --- | --- |
| `npm run test:rules` inkl. Framework und allen neun fertigen Spielen | grün |
| `npm run test:online` inkl. `match-online-test` | grün |
| `npm run test:screens` | grün |
| `npm run build` | grün |
| `npm run test:pwa`, `npm run test:production` | grün |
| Playwright `phone`, `match-games.spec.ts` (13 Fälle, alle neun Spiele) und `minigame-modes.spec.ts` | grün |
| Playwright `phone`, gesamte Suite (vor Tank Trouble) | 94 grün; rot nur Handy-Einladung/`nearby` (Umgebung) und die inzwischen behobenen Testwettläufe |
| Playwright `desktop` | entfällt für Party und Minispiele (Auftrag) |
| Echte Handys (Leistung, Touch, Latenz, Handy-Host mit 6 Spielern) | nicht durchgeführt |

## Offene Probleme

- **Leistung und Bedienung auf echten Handys** sind nicht geprüft (60 FPS,
  Wischgefühl, Latenz bei Quick Draw im WLAN, Handy-Host mit sechs Geräten).
- **`nearby.spec.ts` in der Cloud-Sitzung:** Die WebRTC-Einladung bleibt bei
  „Einladung wird vorbereitet …“ stehen; alle Handy-Hosting-Browserfälle
  scheitern dort vor Spielbeginn, auch für Qwixx. Der Raumkern ist für Node
  getestet; der Handy-Worker nutzt denselben Kern, ist mit Match-Spielen aber
  im Browser nicht geprüft.
- **Behoben: `minigame-modes.spec.ts`, „Wettbewerb …“** scheiterte zeitweise,
  auch vor den Match-Spielen. Ursache war ein Testwettlauf: Der Test prüfte
  „kein Countdown“, bevor die Arena erschien, und drückte die Taste noch im
  Countdown. Das Banner „Wir warten auf die Verbindung“ im Fehlerbild entsteht
  erst, wenn der Test seine Sockets schließt. Gemeinsamer Helfer
  `matchStarted`/`participate` in `tests/browser/party-session.ts`.
- **Zufallsziehung in bestehenden Tests:** Tests, die ein 3D-Minispiel
  erwarten, dürfen sich nicht auf die Zufallsziehung verlassen. Betroffene
  Socket- und Regeltests spielen gezogene Match-Spiele jetzt regulär durch.
- **Browsertests nach Änderungen in `shared/`:** Der Testserver nutzt den
  Quellcode, der Client `dist/`. Ohne neuen Build kennt der Client neue Spiele
  nicht.
- Handy-Hosting-Browserfälle (`nearby.spec.ts`, „Handy-Einladung“ in
  `party-menus.spec.ts`) scheitern in dieser Cloud-Umgebung auch auf dem Stand
  vor den Änderungen.
- Neon Pong steht nur bei 2 oder 4 aktiven Spielern im Pool.

## Nächste Schritte

1. Phase 5: Arrow Masters, Tower Tumble, Hook Wars. Kennungen frei wählen,
   aber nicht mit klassischen Arena-Kennungen kollidieren lassen (z. B. ist
   `bumper` bereits „Kugelrempler“).
2. Gerätetest der Phase-2-Spiele auf mindestens zwei echten Handys
   (Android/iOS) im Node- und Handy-Modus, Ergebnisse hier eintragen.
