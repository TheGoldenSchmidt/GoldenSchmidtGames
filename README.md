# Spielraum

Eine installierbare Smartphone-PWA für lokale und Online-Spiele. Das aktuelle Grundgerüst enthält:

- lokales Gastprofil mit optionalem Anzeigenamen
- lokales Spiel-Setup
- Online-Räume mit fünfstelligem Raumcode
- Host-Wechsel bei Verbindungsabbruch
- gemeinsame Spieldefinitionen für lokalen und Online-Modus
- Qwixx-, Durak- und Kribbeln-Spielmodule für lokale und Online-Partien
- Offline-Cache als installierbare PWA
- Inselparty für 2–6 Personen, lokal und online: 34 Felder, verzweigte Wege, Trophäen, Münzen, fünf Items, sechs digitale und zwei optionale analoge Minispiele

Das Qwixx-Modul enthält den gemeinsamen weißen Wurf, die zusätzliche Farbaktion der aktiven Person, vier getrennte Wertungsblätter, Fehlwürfe, Reihenschlüsse, automatische Wertung und die Spielergebnisanzeige.

Durak verwendet 36 Karten für zwei bis sechs Spieler. Enthalten sind Trumpf, Angriff und Verteidigung, Aufnehmen, Nachlegen, Weiterschieben sowie verdeckte Online-Handkarten. Im lokalen Modus schützt eine Übergabeansicht die Hand der jeweils aktiven Person.

Kribbeln ist für zwei bis fünf Personen lokal und online spielbar: sechs Farbwürfel, bis zu drei Würfe mit frei wählbarem Behalten, sechs Farbaufgaben und vier streng ansteigende Kribbelfelder. Bei einer nicht erfüllten Aufgabe kann auf ein freies Kribbelfeld derselben Gruppe ausgewichen werden; danach gibt es drei neue Versuche. Jede abgeschlossene Zeile wird nach Platzierung gewertet, Gleichstände erhalten den niedrigeren Platz. Bei gleichen Endpunkten entscheidet das vierte Kribbelfeld.

Die App verwendet ein eigenes festes digitales Aufgabenblatt und eine dokumentierte zyklische Farbverteilung: Die sechs Farben Rot, Gelb, Grün, Blau, Orange und Violett werden für jeden weiteren Würfel um eine Zahl versetzt. Diese Materialausführung ist nicht als identische Kopie sämtlicher Original-Wertungsblätter oder der Originalwürfel verifiziert.

## Automatische Prüfungen

Auf dem Startbildschirm prüft „Nach Updates suchen“ den Service Worker ohne Browsercache. Eine heruntergeladene Version wird mit „Neue Version laden“ ausdrücklich aktiviert; erst nach Übernahme wird diese App-Ansicht neu geladen. Laufende Spiele besitzen keinen Update-Button und werden vom Update-Code nicht automatisch neu geladen. Die Tests dafür laufen mit `npm run test:pwa` auch in CI.

`.github/workflows/ci.yml` führt unter Node 22 bei Pushes und Pull Requests Installation, TypeScript-/PWA-Build, Regeltests aller vier Spiele, Socket-Integration, Produktionsprüfung und echte Chromium-Browsertests aus. Manuelle Starts sind ebenfalls möglich. Die Regeltests umfassen Feldgrenzen, Schlösser und Fehlwürfe bei Qwixx, Kartenvergleiche, Weiterschieben und Schummelmodus bei Durak sowie alle 46.656 Farbkombinationen und Runden-/Wertungslogik bei Kribbeln. Die Socket-Tests verwenden echte UUIDs und prüfen alle vier Spielstarts. Dies ist keine Garantie, dass jeder denkbare Browser- oder Netzwerkfehler abgedeckt ist.

## Inselparty

Die Lobby bietet 5–15 Runden, drei Tempostufen und analoge Aufgaben für Gruppen am selben Ort. Standard sind acht Runden mit etwa 30 Minuten als Richtwert; die tatsächliche Dauer variiert. Startkapital: 10 Münzen. Eine Trophäe kostet 20 Münzen. Trophäen, danach Münzen, danach Minispielsiege entscheiden über den Sieg. Auf dem Brett wirken normale Felder beim Landen. Am Hafen gibt es beim Überqueren 3 Münzen. Die Trophäe wechselt nach dem Kauf zwischen den Shops 6, 15 und 24. Inventarlimit: drei Items, ein Einsatz vor dem Würfeln.

Nach jeder Brett-Runde folgt ein Minispiel: Schatzfänger, Farbfalle, Muschelmemory, Brückenstopp, Dschungelspur oder Schatzrisiko. Die Anleitung und ein Übungsmodus stehen vor dem Start bereit. Online spielen alle gemeinsam nach einem Countdown. Lokal wird das Gerät weitergegeben; die Ergebnisse bleiben bis zum Rundenabschluss verdeckt. Wer nicht teilnimmt, bekommt keine Münzen. Platzierungen erhalten 10/7/5/3/2/1 Münzen; Gleichstände zählen zum niedrigeren Platz. Minispiel-Anleitungen erhalten online bis zu 90 Sekunden, damit ein Übungsversuch möglich ist.

Inselwörter und Papierbrücke sind optional. Erst wird Material bestätigt, anschließend werden Ergebnisse gemeinsam eingetragen und bestätigt. Fehlendes Material oder Uneinigkeit führen zu einem digitalen Ersatzspiel.

Lokale Partien speichern ihren Zustand nach Änderungen im Browser. „Lokale Inselparty fortsetzen“ lädt diesen Stand. Online speichert das Gerät Raum und Sitzungsschlüssel, sodass „Online-Inselparty wieder beitreten“ nach einem Verbindungsabbruch funktioniert. Die Gruppe pausiert bis zu 60 Sekunden; anschließend kann der Host ohne getrennte Spieler fortsetzen oder abbrechen. Online-Zustände bleiben im Arbeitsspeicher: Ein Serverneustart beendet die Partie. Sitzungsschlüssel und verdeckte Minispielinhalte dürfen nicht mit fremden Personen geteilt werden. Der Server bewertet Eingaben; es gibt kein garantiert manipulationssicheres Wettkampfsystem oder Latenzausgleich für Brückenstopp.

Die illustrierte SVG-Insel zeigt Hafen, Jahrmarkt, Dschungel und Vulkan. Zoom und Feldbeschreibungen funktionieren per Touch, Maus und Tastatur. Räumliche Würfel fallen vor der Figurenbewegung; eine Wegwahl setzt die Animation fort. Items werden erst ausgewählt und anschließend gezielt eingesetzt. Die Minispiele haben eigene Spielszenen mit Countdown, Fortschritt und Trefferfeedback; beim Brückenstopp bleibt der Marker an der gewerteten Stelle stehen. Ergebnislisten zeigen Platz, Punkte und die tatsächlich gewonnenen Münzen. Übungsdialoge unterstützen Tastatur, Escape und erneutes Üben. Bewegung respektiert „reduzierte Bewegung“. Kurze Spieltöne sind standardmäßig aus, Haptik ist abschaltbar. Die Gestaltungsentscheidungen stehen in [Spielerlebnis](docs/inselparty-spielerlebnis.md).

## Entwicklung starten

```bash
npm install
npm run dev
```

Die App läuft unter `http://localhost:5173`, der Echtzeit-Server unter `http://localhost:3001`.

## Produktion

```bash
npm run build
```

Die Spielregeln und der Echtzeitablauf lassen sich getrennt prüfen:

```bash
npm run test:rules
npm run test:online
npm run test:production
npm run test:browser
```

Für die Browsertests einmal `npx playwright install chromium` ausführen. Die CI installiert Chromium automatisch. Die Tests umfassen 55 vollständige Inselpartien (alle Spielerzahlen und Rundenzahlen), Feld-/Item-/Minispielregeln, Socket-Wiederbeitritt und eine vollständige Online-Partie sowie 28 Handy-/Desktop-Browsertests. Diese prüfen auch die Würfel-/Bewegungsreihenfolge, Wegfortsetzung, gestoppten Marker, Item-Ziele, Münzbelohnungen, Tastaturdialoge und Erreichbarkeit der Hauptaktion auf kleinen Handys. Browser-Screenshots und Fehlertraces liegen lokal unter `test-results/` (nicht versioniert).

Die Schritte für einen öffentlichen HTTPS-Link und einen Docker-fähigen Hoster stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Für den echten Online-Betrieb müssen Client und Socket.IO-Server unter einer öffentlich erreichbaren HTTPS-Adresse bereitgestellt werden. Der lokale Modus bleibt nach dem ersten Laden offline verfügbar.
