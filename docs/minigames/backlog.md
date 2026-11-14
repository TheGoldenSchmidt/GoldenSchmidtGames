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
| 5 | Arrow Masters, Tower Tumble, Hook Wars | fertig (Gerätetest offen) |
| 6 | Qualitätssicherung, Leistung, Feinschliff, Dokumentation | weitgehend fertig; Gerätetests offen (siehe unten) |

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
| 12 | Hook Wars | `hooks` | 2–6 | P4 | fertig, seit Nov. 2026 bei den 1st Generation Minigames | Regeln (`hook-wars-test`), Browser `phone` |

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
- Lobby: Checkbox „1st Generation Minigames“ (früher „Klassische Minispiele“), getrennte Auswahlgruppen,
  Übungsliste mit neuen Spielen, Bot-Testwerkzeug mit allen Spielen.
- Testspiel: `scripts/match-framework-test.ts` prüft das Framework mit einem
  eigenen Tippzähler-Modul ohne Lobbyeintrag.
- Nur Smartphone: Playwright-Projekt `desktop` ignoriert Party- und
  Minispiel-Specs; gemischte Specs überspringen Party-Fälle auf dem Desktop.

## Gemeinsame Bausteine

- `geometry.ts`: Kreis-Rechteck-Abstoßung, Kreis-Kreis-Trennung, Strahl-Rechteck-Test.
- `ringCore.ts`: Ring-Out-Kern für Sumo Smash und Bumper Mayhem.
- Muster „Durchgänge mit Pause, Punkte je überlebtem Gegner, Stechen“:
  Light Trails, Bomb Arena, Floor is Lava.
- Steuerelemente in `src/matches/controls.tsx`: `Stick`, `ActionButton` mit
  Abklingring, `AimPad`, `SwipeZone`, `SliderPad` (mit Loslassen), `TapZone`.
- Neue Spiele: Kennungen dürfen nicht mit klassischen Arena-Kennungen
  kollidieren (`bumper` ist „Kugelrempler“, daher `bumpercars`).

## Architekturentscheidungen (Kurzfassung)

Siehe [konzept.md](konzept.md#architekturentscheidungen) und die Tabelle
„Dokumentierte Abweichungen“. Ergänzungen aus der Umsetzung:

- **Aufgeben statt Versuch beenden:** Die bestehende Aktion `finish` lässt in
  Match-Spielen die Person ausscheiden. Später Aufgebende stehen vor früher
  Aufgebenden; bleibt höchstens eine Person, endet das Match.
- **Teilnahme:** Wer im Match keine Eingabe gesendet hat, gilt wie bisher als
  nicht teilnehmend und erhält keine Münzen oder Einsatzpunkte.
- **Schlanke öffentliche Sicht:** fremde Spieler nur mit Kennung, Farbe, Team
  und Anwesenheit; Ereignisse der letzten 1,5 s; Zahlen auf 1/1000 gerundet.
- **Tower Tumble** ist seit Nov. 2026 ein Turmrennen mit eigener,
  deterministischer Starrkörperphysik (`physics2d.ts`, Begründung im Konzept).
- **Klassische Tastaturbedienung** der 3D-Arenen bleibt vorerst im Code
  (bestehende `phone`-Tests nutzen sie), wird aber nicht weiterentwickelt.

## Teststatus

| Prüfung | Stand |
| --- | --- |
| `npm run test:rules` inkl. Framework und allen zwölf Spielen | grün |
| `npm run test:online` inkl. `match-online-test` und Neustart mit laufendem Match | grün |
| `npm run test:screens` | grün |
| `npm run build`, `npm run test:pwa`, `npm run test:production` | grün |
| Playwright `phone`, `match-games.spec.ts` (34 Fälle, alle zwölf Spiele; Stand Nov. 2026 nach Pfeilsteuerung und Etagen) | grün |
| Playwright `phone`, gesamte Suite ohne Handy-Hosting-Fälle | 103 von 106 grün; die 3 roten (Testhelfer) korrigiert und danach 51 von 51 in dreifacher Wiederholung grün |
| Playwright `desktop`, gesamte Suite ohne Handy-Hosting-Fälle (Party und Minispiele ausgenommen) | 35 grün, 2 übersprungen |
| Handy-Hosting-Browserfälle (`nearby.spec.ts`, „Handy-Einladung“) | in dieser Cloud-Umgebung nicht lauffähig (WebRTC), auch nicht auf dem Ausgangsstand |
| Echte Handys (Leistung, Touch, Latenz, Handy-Host mit 6 Spielern) | nicht durchgeführt |

Abgedeckt sind je Spiel: Start bis Ergebnis über die Party, Siegbedingungen,
Gleichstände und Stechen, Zeitablauf, Aufgeben, gleichzeitige Ereignisse,
deterministische Wiederholung, JSON-Neustart mitten im Spiel sowie 2, 4 und 6
Spieler (Neon Pong 1v1 und 2v2). Netzverzögerung ist für Quick Draw
(Laufzeitprüfung) und allgemein für doppelte, alte und verlorene Pakete
geprüft; echte Funknetze nicht.

## Offene Probleme

- **Echte Geräte:** 60 FPS, Touchgefühl, Lesbarkeit kleiner Figuren (Arrow
  Masters, Sumo), Quick-Draw-Fairness im WLAN und Handy-Host mit sechs Geräten
  sind nicht geprüft.
- **Handy-Hosting im Browser:** `nearby.spec.ts` braucht eine Umgebung mit
  WebRTC (z. B. CI). Der Handy-Worker nutzt denselben Raumkern; mit
  Match-Spielen ist er im Browser noch nicht geprüft.
- **Bots** sind für Übung und Testräume gedacht, nicht als starke Gegner;
  besonders Hook Wars und Chaos Run spielen einfach.
- **Neon Pong** steht nur bei 2 oder 4 aktiven Spielern im Pool.
- **Tower Tumble** braucht als einziges Spiel spürbar Rechenzeit (≈ 12 ms je
  Spielsekunde im Bot-Spiel, bis ≈ 50 ms bei sechs hohen wackelnden Türmen in
  Node); auf Handy-Host und Render Free ungeprüft. Bots verlieren viele
  Steine und taugen nur zum Üben.
- **Floor is Lava** sendet mit drei Etagen etwa 3,6 statt 2,4 KB je Sicht;
  Figuren auf tieferen Etagen sind teils von den Platten darüber verdeckt.
- **Zufallsziehung in Tests:** Tests, die ein bestimmtes Minispiel erwarten,
  müssen es wählen oder gezogene Match-Spiele durchspielen
  (`toArenaMini`, `participate` in `tests/browser/party-session.ts`).
- **Browsertests nach Änderungen in `shared/`:** Der Testserver nutzt den
  Quellcode, der Client `dist/`; vorher `npm run build`.

## Rückmeldung aus der ersten Spielrunde (Nov. 2026)

| Spiel | Rückmeldung | Stand |
| --- | --- | --- |
| Sumo Smash, Bumper Mayhem | Rückstoß viel zu klein | **umgesetzt**: Kontrollverlust nach Treffern, stärkerer Stoß; Wurfweite im Regeltest abgesichert (Sumo ≈ 5 statt 0,8 Einheiten, seitlicher Rammstoß ≈ 6 statt 3,5) |
| Neon Pong | Schläger zu langsam | **umgesetzt**: 42 statt 16 Feldeinheiten/s, eigene Anzeige läuft weiter voraus |
| Arrow Masters | Nach jedem Schuss andere Startplätze | **umgesetzt**: neun Plätze, jede Runde neu verteilt |
| Tower Tumble | Mechanik und Physik nicht schön | **umgesetzt**: Neubau als Turmrennen mit echter 2D-Starrkörperphysik, Drehen, schnellem Fallen und Landehilfe (eigenständiges Spiel im Genre, keine Kopie); Gefühl auf echten Handys offen |
| Hook Wars | Prinzip unverständlich | **umgesetzt**: vorerst zu den 1st Generation Minigames verschoben (nur mit Haken im Zufallspool, weiter direkt wählbar) |
| Floor is Lava | Lieber als 3D-Hindernislauf mit Figuren | **umgesetzt** als 2.5D-Tempel über Lava mit Figuren und neuem Schubser (kein Hindernislauf); Plan und Stand in [plan-floor-is-lava.md](plan-floor-is-lava.md), Gerätetest offen |

## Rückmeldung aus der zweiten Runde (Nov. 2026)

| Spiel | Rückmeldung | Stand |
| --- | --- | --- |
| Tower Tumble | Hängt und ruckelt am Handy | **umgesetzt**: Ursache war vor allem Rechenzeit der Raumautorität (Übung und Handy-Host rechnen auf dem Handy, Render Free hat wenig CPU): zusammengefasste Kollisionsboxen, schlanker Solver, Warmstart als Zahlenliste, Sicht ohne Kopie der Physikdaten (`publicGame`); auf dem Gerät Zellen als vorgezeichnete Bilder und zeitbasierte Kamera. Werte in [konzept.md](konzept.md#architekturentscheidungen); echtes Handy offen |
| Tower Tumble | Lieber links/rechts-Pfeile statt Schieben | **umgesetzt**: ⇦ ⇨ links unten (halbe Zelle je Tipp, Halten wiederholt), ⟳ und ⇩ rechts unten; Regeltest und Playwright `phone` |
| Floor is Lava | Über mehrere Etagen spielen | **umgesetzt**: drei Etagen, Durchfallen statt Lava bis zur untersten Etage; Regeltest, Playwright `phone` (beide Bewegungseinstellungen, sechs Figuren, 2D-Rückfall); Gerätetest offen |

Gefühl auf echten Handys ist für die umgesetzten Punkte weiter ungeprüft.

## 2.5D-Fassungen

| Spiel | Stand |
| --- | --- |
| Bomb Arena | **umgesetzt**, Gerätetest offen: 3D-Feld mit gewählten Figuren, 2D-Rückfall; Stand in [plan-2-5d.md](plan-2-5d.md#umsetzungsstand) |
| Floor is Lava | **umgesetzt**, Gerätetest offen: siehe [plan-floor-is-lava.md](plan-floor-is-lava.md) |
| Sumo Smash | **umgesetzt**, Gerätetest offen: animierte Figuren (sechs Looks), Schieben, Kampfspiel-Kamera; [figuren-rigged.md](figuren-rigged.md) |
| Chaos Run | **umgesetzt**, Gerätetest offen: animierte Figuren in eigenen Spuren, Verfolgerkamera; [figuren-rigged.md](figuren-rigged.md) |
| Figurenwahl | **umgesetzt**: elf animierte Figuren wählbar (inkl. MC Goldie, Lil Schmidt, Kiki Komet, Bolt, Glubschi), in allen 3D-Szenen sichtbar; [figuren-rigged.md](figuren-rigged.md) |
| Tank Trouble | **umgesetzt**, Gerätetest offen: Panzer mit Figur in der Luke, Ziellaser, 2D-Rückfall; Stand in [plan-2-5d.md](plan-2-5d.md#tank-trouble-zweites-spiel-umgesetzt) |

## Nächste Schritte

1. Gerätetest aller zwölf Spiele auf mindestens zwei echten Handys
   (Android/iOS) im Node- und Handy-Modus; Ergebnisse hier eintragen.
2. `nearby.spec.ts` in CI beobachten; bei Fehlern mit Match-Spielen den
   Handy-Worker prüfen.
3. Nach Rückmeldung aus echten Runden Werte feinjustieren (Tempo von Light
   Trails, Wind bei Arrow Masters, Stärke der Bots).
