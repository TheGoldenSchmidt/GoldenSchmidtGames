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
