# Technisches Konzept: Match-Minispiele

Gilt für die zwölf neuen Minispiele aus der [Spezifikation](spezifikation.md).
Den Arbeitsstand führt der [Backlog](backlog.md).

## Ausgangslage (Analyse, Phase 0)

- **Ablauf:** `shared/party.ts` steuert Inselparty, Roll It Up!, Freies
  Minispiel und Schlag den GoldenSchmidt mit denselben Phasen
  `mini-bet → mini-intro → mini-play → mini-result/finished`. Anleitung,
  Bereitschaft, 3-Sekunden-Countdown (`mini.startAt`), Zeitlimit
  (`deadline`), Pause bei Verbindungsabbruch, Wiederbeitritt und Wertung
  (`partyMiniResults`) sind dort zentral gelöst.
- **Autorität:** `shared/roomCore.ts` läuft unverändert im Node-Server und im
  Handy-Worker (`src/nearby/host.worker.ts`). Ein 50-ms-Takt ruft
  `tickParty`; Steuerungen kommen über `party:control`, werden in einer
  geordneten Transaktion geprüft und erst nach dem Speichern bestätigt.
- **Klassische Arenen:** `shared/partyArena.ts` simuliert die 14 bestehenden
  3D-Minispiele deterministisch mit festem 50-ms-Schritt. Eingaben sind auf
  Stick, Springen und Schlagen beschränkt; Rendering mit Three.js.
- **Wiederverwendbar:** Phasen, Countdown, Ergebnisansichten,
  Wettbewerbs-Einsätze, Bot-Treiber, Sitzungs- und Pausenlogik, Übungsdialog,
  Socket-Transport mit Folgenummern und Ratenbegrenzung.
- **Nicht ausreichend:** Eingabeformat (keine Zielrichtung, keine
  verlustfreien Tipp-Ereignisse), feste Wertung mit eindeutigen Plätzen,
  Arena-Zustand mit fest verdrahteten Spielarten.

## Architekturentscheidungen

1. **Eigenes Modulsystem statt Erweiterung von `partyArena.ts`.**
   Jedes neue Spiel ist ein `MatchModule` in `shared/matches/`. Das
   Framework (`shared/matches/framework.ts`) übernimmt Registrierung,
   Spielerzahl und Teams, Eingabeprüfung, festen Simulationsschritt,
   öffentliche Sicht, Ranglisten und Bot-Anbindung. Die klassischen Arenen
   bleiben unverändert und laufen parallel weiter.
2. **Einbindung in den bestehenden Party-Ablauf.** `PartyMini` erhält neben
   `arena` ein Feld `match`. Anleitung, Countdown, Pausen, Einsätze,
   Ergebnisse und Rückkehr zur Lobby bleiben dieselben. Die Partylogik
   verteilt Münzen beziehungsweise Wettbewerbspunkte; das Modul liefert nur
   Platzierungen und Spielpunkte.
3. **Ein autoritativer Kern.** Module sind reine, deterministische
   Funktionen über einem serialisierbaren Zustand mit eigenem
   Zufallsgenerator. Node-Server, Handy-Worker, Übung und Tests rufen
   dieselben Funktionen auf. Clients senden nur geprüfte Eingaben.
4. **Eingabeformat `MatchInput`.** Stick (`x`,`y`), Zielvektor (`ax`,`ay`),
   gehaltene Tasten (`ha`,`hb`), **Tippzähler** (`ca`,`cb`) und ein
   Kommandozähler mit Wert (`cn`,`n`). Zähler sind kumulativ: Geht ein
   Paket verloren, trägt das nächste die Tipps nach. Dazu `echo`/`held` für
   die serverseitige Laufzeitmessung. Alle Werte werden begrenzt geprüft;
   zurücklaufende Zähler und alte Folgenummern werden ignoriert.
5. **Übertragung.** Zustände gehen über das Ereignis `party:match` mit
   10 oder 20 Hz (je Modul) an jedes Gerät, jeweils als eigene Sicht
   (`view`), z. B. ohne verdeckte Signalzeiten. Discrete Aktionen sendet der
   Client sofort zuverlässig, Stickwerte periodisch alle 100 ms.
6. **Darstellung mit Canvas 2D.** Die neuen Spiele sind 2D-Arcade-Spiele.
   Canvas 2D ist auf Handys leichter als eine Three.js-Szene, braucht kein
   WebGL 2 und erlaubt eigene Neon-, Western- oder Lava-Themen ohne externe
   Assets. Interpolation zwischen zwei Zuständen glättet die Bewegung; die
   eigene Spielfigur wird bei Bedarf lokal vorausberechnet.
7. **Nur Smartphone.** Steuerung ausschließlich per Touch (Stick, Tasten,
   Tippen, Wischen, Ziehen). Keine Tastaturbelegung, keine PC-Layouts, keine
   Tests im Playwright-Projekt `desktop` für Inselparty, Roll It Up! und
   Minispiele.
8. **Klassische Minispiele abschaltbar.** Die bisherigen 14 Arenen tragen die
   Kennung „klassisch“. Inselparty, Roll It Up! und Schlag den
   GoldenSchmidt erhalten die Option `classic` (Standard: an). Ist sie aus,
   ziehen die Modi nur aus den neuen Spielen, die zur Spielerzahl passen.

## Gemeinsame Bausteine

| Baustein | Ort | Aufgabe |
| --- | --- | --- |
| Modulvertrag, Eingaben, Zufall | `shared/matches/types.ts` | `MatchModule`, `MatchInput`, `MatchState`, Zufallszahlen |
| Framework | `shared/matches/framework.ts` | Registrierung, Spielerzahl/Teams, Eingabeprüfung, Schritt, Sicht, Rangliste, Pool |
| Geometrie | `shared/matches/geometry.ts` | Begrenzung, Kreis-/Rechteckkollision, Reflexion |
| Party-Anbindung | `shared/party.ts` | Start, Steuerung, Takt, Ende, Wertung, Pausen |
| Raumtakt | `shared/roomCore.ts` | Echtzeit-Takt und `party:match` für beide Hostingarten |
| Bots | `shared/partyBots.ts` | ruft `module.bot` mit der öffentlichen Sicht |
| Bühne | `src/matches/MatchStage.tsx` | Canvas, Takt, Interpolation, HUD, Countdown, Eingabeversand |
| Steuerung | `src/matches/controls.tsx` | Stick, Aktionstaste, Tippfläche, Wischfläche, Schieberegler, Zielfläche |
| Darstellung | `src/matches/render/*.ts` | eine Zeichenfunktion je Spiel |

## Wertung und Gleichstände

Das Modul liefert eine Rangliste mit Spielpunkten und geteilten Plätzen.
`partyMiniResults` übernimmt sie für alle Spieler, die mindestens eine
Eingabe gesendet haben. Gleich platzierte Spieler erhalten in der Inselparty
dieselbe Münzzahl ihres Platzes, im Wettbewerb ihren eigenen Einsatz. Die
spielinternen Stechregeln (Golden Goal, Stechdurchgang, Sudden Death) werden
im Modul ausgespielt; bleibt danach ein Gleichstand, wird der Platz geteilt.

## Latenz und Fairness

- **Feste Schritte:** 50 ms je Schritt, Module dürfen intern unterteilen
  (z. B. Ballphysik). Gleichzeitige Ereignisse werden in fester
  Reihenfolge und symmetrisch aufgelöst (z. B. Kopf-an-Kopf in Light Trails).
- **Quick Draw:** Der Server kennt allein den Signalzeitpunkt. Er
  verschickt ihn erst, wenn er erreicht ist. Das Gerät misst die Zeit von der
  Anzeige bis zum Tippen. Der Server akzeptiert diesen Wert nur innerhalb von
  `[Serverdauer − Laufzeitzuschlag, Serverdauer]`. Der Zuschlag ergibt sich aus
  der gemessenen Laufzeit (höchstens 300 ms) plus der Taktbreite. Ein Tipp vor
  dem Signal laut Server oder Gerät ist ein Fehlstart. Unter 80 ms gilt er als
  vorweggenommen.
- **Doppelte Nachrichten:** Folgenummern und kumulative Zähler machen
  Wiederholungen wirkungslos.
- **Abbruch:** Fehlende Eingaben laufen nach 400 ms auf neutral aus. Bei
  Verbindungsverlust pausiert die Party wie bisher; ein danach passiver
  Spieler gilt im Modul als ausgeschieden.

## Dokumentierte Abweichungen

| Spiel | Abweichung | Grund |
| --- | --- | --- |
| Alle | Steuerung nur per Touch | Auftrag: nur Smartphones |
| Neon Pong | Hochformat, eigenes Tor unten, Schläger per waagrechtem Ziehen | Handy im Hochformat; der Daumen deckt die Breite natürlich ab. Jedes Gerät sieht das eigene Team unten. |
| Neon Pong | Nur 2 oder 4 Spieler zulässig | 1v1/2v2 laut Spezifikation; bei 3, 5 oder 6 Spielern steht es nicht im Zufallspool |
| Neon Pong | Golden Goal höchstens 30 s, danach geteilter Sieg | Partys dürfen nicht endlos laufen |
| Quick Draw | Duell höchstens 9 Runden; danach entscheidet der Rundenstand | Wiederholte Doppel-Fehlstarts dürfen nicht endlos laufen |
| Quick Draw | Gruppen-Stechen bis zu 3 Durchgänge, danach geteilter Platz | Wie oben |
| Quick Draw | Reaktion unter 80 ms gilt als Fehlstart | Menschlich nicht erreichbar, verhindert Vorwegnahme |
| Light Trails | Durchgang endet spätestens nach 40 s; Überlebende teilen den Platz ohne Bonus | Begrenzte Spieldauer |
| Light Trails | Raster 21 × 33 im Hochformat, ein Feld je 150 ms, Arena schrumpft ab 12 s alle 1,5 s um einen Ring bis 5 Felder Breite | Lesbar auf Handys, Reaktionszeit trotz Funklatenz |
| Light Trails | Startplätze gleichmäßig auf einem inneren Ring, alle im Uhrzeigersinn; Zuordnung rotiert je Durchgang | Faire, symmetrische Ausgangslage |
| Light Trails | Bis zu zwei Kurven werden vorgemerkt; ⟲/⟳ wirken relativ zur letzten vorgemerkten Richtung | Schnelle Doppelkurven ohne verlorene Eingaben |
| Neon Pong | Ball startet mit 6,5, je Treffer +0,45, höchstens 15 Feldeinheiten/s; Power-up alle 10–15 s, aktiviert durch das Team des letzten Treffers | Konkrete Werte der Spezifikation |
| Neon Pong | Wirkungen: breiter Schläger 5 s, Mehrball bis alle Zusatzbälle weg sind, Kurvenbälle 6 s, Zeitlupe 4 s nur für Bälle Richtung des sammelnden Teams | „Kurzzeitiger Slowdown“ soll dem sammelnden Team helfen |
| Alle | „Aufgeben“ ersetzt in Match-Spielen „Versuch beenden“ | Gemeinsame Spiele lassen sich nicht einzeln beenden |
| Tank Trouble | Labyrinth 7 × 11 Zellen; Ziegelmauern halten 2 Treffer und verschlucken die Kugel; Stechen höchstens 30 s, danach geteilter Platz | Neue Schusswege entstehen sichtbar, Spiel bleibt begrenzt |
| Tank Trouble | Zielen per Ziehen auf der rechten Hälfte, Schuss beim Loslassen; kurzes Tippen schießt in die letzte Richtung | Präzises Zielen und schneller Schuss mit einem Daumen |
| Bomb Arena | „Gegnerischer Knockout“ = letztes Leben durch eine fremde Bombe (+2 für deren Besitzer) | Mit 2 Leben ist der K.o. das Ausscheiden |
| Bomb Arena | Kettenreaktionen bilden eine Explosion: höchstens ein Schaden je Spieler | „Dieselbe Explosion“ einheitlich auslegen |
| Bomb Arena | Arena schließt sich ab 25 s spiralförmig (ein Feld je 0,35 s); geteilter Rundenbonus anteilig (z. B. 1,5) | Konkrete Werte; Teilen laut Spezifikation |
| Bomb Arena | Sudden Death nur für die Punktgleichen: 1 Leben, Arena schließt ab 8 s, höchstens 30 s | Kurzer, eindeutiger Entscheid |
| Floor is Lava | Quadratische Platten 9 × 13; Rand bricht bei 10 s und 15 s ein; Sprung 0,55 s mit 1,4-facher Geschwindigkeit (überwindet ein Feld) | Konkrete Werte für Handys |
| Floor is Lava | Nach Lava sicherer Neustart auf der Platte mit größtem Abstand, 1,2 s Schutz; Überlebende bei Zeitablauf teilen +3 | Fairness; „teilen die beste Platzierung“ |
| Floor is Lava | Stechrunde bei Gesamtgleichstand: nur die Punktgleichen, 1 Leben | Spezifikation verlangt Stechrunde |
| Sumo Smash / Bumper Mayhem | Gemeinsamer Kern `ringCore.ts`; Ring-Out wird der Person gutgeschrieben, die in den letzten 3 s am stärksten geschoben hat | „Verursacher“ eindeutig und für beide Spiele gleich |
| Sumo Smash / Bumper Mayhem | Spielpunkte = 2 × Ring-Outs; Rangfolge: Sieger, Ausscheidezeitpunkt, Leben, Ring-Outs | Punkte laut Spezifikation, Platzierung nach Überleben |
| Sumo Smash / Bumper Mayhem | Sudden Death nur für die nach 75 s Gleichauf-Liegenden, 1 Leben, kleiner Ring, höchstens 20 s, danach geteilter Platz | Begrenzte Dauer |
| Sumo Smash | Stoß: 0,22 s Vorwärtsschub; Rückstoß nur bei Treffer während des Stoßes; Ring schrumpft ab 40 s bis 75 s von 5,5 auf 3,2 | Konkrete Werte |
| Bumper Mayhem | Lenkung in Stickrichtung mit begrenzter Drehrate, automatisches Gas; Turbo 0,8 s; zwei kreisende Pfosten als bewegliche Hindernisse; Arena schrumpft ab 45 s | Einfache Ein-Daumen-Steuerung |
| Chaos Run | Brücken stürzen je Läufer ein (0,6 s nach dem Betreten); keine gegenseitige Beeinflussung | Version 1 ohne Spielerinteraktion, faire Bedingungen |
| Chaos Run | Strecke aus 8 Modulen à 24 m, jeder der 6 Typen mindestens einmal; Checkpoint an jedem Modulbeginn; Wand 1,7 hoch (nur mit gehaltenem Sprung), Balken nur rutschend passierbar | „Halten für höhere Sprünge“ bekommt eine Aufgabe |
| Chaos Run | Wischen nach unten in der Luft lässt schnell fallen und startet das Rutschen | Tippen und Wischen auf einer Fläche ohne Verzögerung |

Weitere Abweichungen werden beim jeweiligen Spiel ergänzt.

## Risiken und Abhängigkeiten

- **Leistung auf echten Handys:** Browser-Emulation belegt keine 60 FPS.
  Prüfung auf echten Geräten steht aus (siehe Backlog).
- **Handy-Host mit sechs Spielern:** Der Worker klont den Spielzustand je
  Eingabe. Zustände bleiben deshalb klein (Spuren als Polylinien statt
  Raster in der Übertragung).
- **Latenzkompensation:** Die Laufzeit wird aus Client-Angaben abgeleitet und
  bleibt deshalb auf 300 ms begrenzt. Ein manipuliertes Gerät kann sich
  höchstens diesen Spielraum verschaffen.
- **Spielerzahlen:** Neon Pong passt nur zu 2 oder 4 Spielern. Wird ein Pool
  ohne klassische Spiele für eine Spielerzahl leer, lehnt die Lobby die
  Einstellung mit einer Meldung ab.
- **Physikintensive Spiele (Phase 4/5):** Tower Tumble und Hook Wars brauchen
  eigene deterministische Starrkörper- beziehungsweise Seilphysik. Sie
  stehen bewusst am Ende.
