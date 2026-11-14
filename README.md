# GoldenSchmidtGames (GSG)

Eine installierbare Smartphone-PWA für lokale und Online-Spiele. Das aktuelle Grundgerüst enthält:

- lokales Gastprofil mit optionalem Anzeigenamen
- lokales Spiel-Setup
- Räume wahlweise auf dem Node-Server (Raumcode) oder dem Host-Handy (QR-Verbindung)
- Host-Wechsel bei Verbindungsabbruch im Node-Modus; beim Handy-Hosting bleibt dasselbe Gerät zuständig
- gemeinsame Spieldefinitionen für lokalen und Online-Modus
- Qwixx-, Durak- und Kribbeln-Spielmodule für lokale und Online-Partien
- Offline-Cache als installierbare PWA
- 24 wählbare Figuren mit Pflichtauswahl vor Raumzugang und zufälliger Bot-Zuordnung: elf animierte Figuren mit Skelett (darunter die Rapper MC Goldie und Lil Schmidt, Kiki Komet, Bolt und Glubschi) und die 13 klassischen alpha_-Charaktere; dieselbe Figur in allen Spielen
- Inselparty für 2–6 Personen ausschließlich online: eine echte 3D-Insel, eigene steuerbare Figuren, 34 Felder, fünf Items, 14 klassische 3D-Minispiele und neue Match-Minispiele
- Freies Minispiel und Schlag den GoldenSchmidt für 2–6 Personen auf getrennten Geräten, mit denselben Minispielen und beiden Hostingarten
- Inselparty, Roll It Up! und alle Minispiele sind nur für Smartphones vorgesehen (Touch-Steuerung, keine PC-Tests)

Das Qwixx-Modul enthält den gemeinsamen weißen Wurf, die zusätzliche Farbaktion der aktiven Person, vier getrennte Wertungsblätter, Fehlwürfe, Reihenschlüsse, automatische Wertung und die Spielergebnisanzeige.

Der Startbildschirm ist im Inselwelt-Stil gestaltet (siehe [Designregeln](designregeln.md)): Himmel und Landschaft, die schwebende Insel mit dem in Stein gefassten GoldenSchmidtGames-Logo, Fahne, Schwert, Würfel, Schatztruhe und Holzschild „Play like The GoldenSchmidt – Be like The GoldenSchmidt“ sowie die Tafeln „Lokal spielen“, „Online spielen“, „App installieren“ und „Updates prüfen“ sind aus einer three.js-Szene gerendert. Darüber liegt die normale React-Oberfläche, die App lädt nur die Bilder (WebP, zusammen etwa 400 KB, offline gespeichert). Szene, Renderbefehl `npm run render:home` und Referenzvergleich `npm run compare:home` beschreibt die [Renderpipeline](docs/startscreen-render.md). Beim Öffnen fliegt zuerst der Steinrahmen ein, dann erscheint die Insel und die Wörter „Golden“, „Schmidt“ und „Games“ fliegen nacheinander ein; danach ist die Seite ruhig; bei reduzierter Bewegung steht alles sofort im Endzustand. Die Seite füllt genau einen Bildschirm und scrollt nicht, die Installationshilfe öffnet sich als Feld über der unteren Zeile. Beide Spielmodi, Gastprofil, Installation, Updates und Wiederbeitritt bleiben direkt erreichbar.

Lokales Setup, Online-Menü, Lobby, Gastprofil, QR-Dialog und die Wiederverbindungsansicht nutzen denselben Stil: gerenderter Himmel als Hintergrund, Titel auf Holzschildern, Inhalte auf Pergamentkarten und Aktionen als Steintafeln. Die Menüs laufender Minispiel-Wettbewerbe sind noch im früheren Party-Stil. Spielflächen und Spielregeln behalten ihre bisherige Darstellung und Funktion.

Für UI-Erweiterungen und Überarbeitungen gelten die [Designregeln](designregeln.md).

Qwixx bleibt nach dem Intro in einer runden 3D-Tischarena: Die aktive Figur rückt zum Becher vor, zwei weiße und vier einfarbige Würfel fliegen mit festen Identitäten auf wechselnde freie Landepunkte und können danach als gültige Kombination angehoben werden. Die Punktekarte liegt dauerhaft darunter. Der Becher lässt sich mit Finger oder Maus, optionaler Handybewegung oder dem Würfeln-Knopf bedienen; geschlossene Farbreihen nehmen ihren Würfel aus dem nächsten Wurf und reduzierte Bewegung zeigt Ergebnisse sofort. Mehr dazu in [Qwixx mit Würfelbecher](docs/qwixx-cup.md).

Durak verwendet 36 Karten für zwei bis sechs Spieler. Enthalten sind Trumpf, Angriff und Verteidigung, Aufnehmen, Nachlegen, Weiterschieben sowie verdeckte Online-Handkarten. Im lokalen Modus schützt eine Übergabeansicht die Hand der jeweils aktiven Person.

Qwixx, Durak, Kribbeln und Inselparty beginnen mit einem etwa vier Sekunden langen 3D-Intro: Bei Durak sitzen die Spieler am runden Filztisch, bei Qwixx und Kribbeln liegen die jeweiligen Würfel und Blätter bereit. Die Kamera fährt näher und richtet sich senkrecht auf den Tisch aus. Inselparty beginnt mit einem Anflug auf eine kleine Insel. Die Sequenzen sind per Button oder Escape überspringbar, entfallen bei reduzierter Bewegung und werden beim Wiederbeitritt nicht erneut abgespielt. Ohne WebGL steht eine Ersatzszene bereit. Mehr dazu in [Spiel-Intros](docs/game-intros.md).

Kribbeln ist für zwei bis fünf Personen lokal und online spielbar: sechs Farbwürfel, bis zu drei Würfe mit frei wählbarem Behalten, sechs Farbaufgaben und vier streng ansteigende Kribbelfelder. Bei einer nicht erfüllten Aufgabe kann auf ein freies Kribbelfeld derselben Gruppe ausgewichen werden; danach gibt es drei neue Versuche. Jede abgeschlossene Zeile wird nach Platzierung gewertet, Gleichstände erhalten den niedrigeren Platz. Bei gleichen Endpunkten entscheidet das vierte Kribbelfeld.

Die App verwendet ein eigenes festes digitales Aufgabenblatt und eine dokumentierte zyklische Farbverteilung: Die sechs Farben Rot, Gelb, Grün, Blau, Orange und Violett werden für jeden weiteren Würfel um eine Zahl versetzt. Jeder Würfel trägt jede Zahl von 1 bis 6 und jede Farbe genau einmal. Über alle 36 Seiten kommt jedes Zahl-Farbe-Paar genau einmal vor; Wurflogik und sichtbare Würfelseiten verwenden dieselbe geprüfte Tabelle. Diese Materialausführung ist nicht als identische Kopie sämtlicher Original-Wertungsblätter oder der Originalwürfel verifiziert.

Die aktuelle Kribbeln-Aufgabe wird als Mengenbild mit Würfeln, Farbgruppen oder Summenziel dargestellt. Ein Würfelbecher lässt sich mit Finger oder Maus schütteln und per Swipe nach unten auswerfen; alternativ gibt es den Würfeln-Knopf oder eine ausdrücklich freigegebene Handybewegung mit Schütteln und anschließendem Kippen. Die sechs Würfel behalten durchgehend ihre festen Farbseiten und fliegen aus dem Becher auf den Tisch. Behaltene Würfel bleiben auch für die anderen Online-Spieler liegen. Beschriftungen, Aufgabenzähler und Summe erscheinen nach dem Landen. Reduzierte Bewegung zeigt das Ergebnis sofort. Die Ansicht nutzt auf dem PC zwei Spalten und auf dem Handy einen kompakten Spieltisch. Mehr dazu in [Kribbeln: Aufgabe und Wurf](docs/kribbeln-visuals.md).

## Zwei Hostingarten

Beim Erstellen eines Raums wählt der Host **Node-Server** (Standard) oder **Dieses Handy**. Alle verfügbaren Spiele verwenden dieselbe Raum- und Regellogik. Die Auswahl gilt für diesen Raum; laufende Partien wechseln ihre Hostingart nicht.

Im Node-Modus verbindet sich jedes Gerät über das Internet mit dem bisherigen Server und tritt per Raumcode bei. Im Handy-Modus spielt der Host selbst mit und führt die gemeinsame Simulation in einem Worker aus. Gäste verbinden sich im selben WLAN oder Hotspot einzeln per Einladung und Antwort als QR-Code. Der Spielverkehr läuft direkt zwischen den Geräten, ohne Signalisierungsdienst, STUN/TURN oder Cloud-Datenbank. Verschiedene Gruppen haben unabhängige Hosts.

Für den Einsatz ohne Internet die aktuelle PWA vorher auf **jedem** Gerät vollständig laden. Das Host-Handy bleibt mit geöffneter App aktiv; beim Verlassen der App pausiert die Partie. Bestätigte Züge liegen im lokalen Gerätespeicher. Nach einem vollständigen Neustart öffnet der Host seinen Tisch wieder, Gäste verbinden sich bei Bedarf erneut per QR. Speicherlöschen, privates Surfen oder Verlust des Host-Geräts können diesen Spielstand löschen. Ein isoliertes WLAN/Hotspot kann Direktverbindungen verhindern. Voraussetzungen und praktische Geräteprüfung: [Deployment](DEPLOYMENT.md#handy-hosting).

## Automatische Prüfungen

Online-Plätze sind ab der Lobby an einen privaten Schlüssel auf dem jeweiligen Gerät gebunden. Nach einem Verbindungsabbruch meldet sich das Gerät im selben Raum wieder an. Auch nach dem Neuladen öffnet das Gerät seine zuletzt aktive Online-Partie. Wer nur den Raumcode oder eine fremde Spieler-ID kennt, erhält keinen Zugriff auf einen bereits belegten Platz. Der Server speichert bestätigte Züge, verdeckte Karten, Minispieleinsätze und Sitzungsschlüssel. Solange der Speicher erhalten bleibt, setzen laufende Spiele nach einem Neustart im selben Raum fort. Auf Render starten beide Hostingarten auch ohne Turso; der lokale Node-Speicher ist dort flüchtig. Optionen für dauerhafte Node-Spielstände stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Auf dem Startbildschirm prüft „Updates prüfen“ den Service Worker ohne Browsercache. Eine heruntergeladene Version wird mit „Neue Version laden“ ausdrücklich aktiviert; erst nach Übernahme wird diese App-Ansicht neu geladen. Laufende Spiele besitzen keinen Update-Button und werden vom Update-Code nicht automatisch neu geladen. Die Tests dafür laufen mit `npm run test:pwa` auch in CI.

`.github/workflows/ci.yml` führt unter Node 22 bei Pushes auf `main` und bei Pull Requests die schnelle Prüfung aus: Installation, TypeScript-/PWA-Build, Regeltests der spielbaren Module, Bildschirm- und PWA-Tests, Socket-Integration und Produktionsprüfung. Pushes auf andere Branches und reine Dokumentationsänderungen starten keinen Lauf. Die echten Chromium-Browsertests (Projekt `phone`) laufen nur in der ausführlichen Prüfung, die von Hand gestartet wird: **Actions → CI → Run workflow**, wahlweise beschränkt auf einzelne Spec-Dateien. So bleibt der Verbrauch an Actions-Minuten klein. Die Regeltests umfassen Feldgrenzen, Schlösser und Fehlwürfe bei Qwixx, Kartenvergleiche, Weiterschieben und Schummelmodus bei Durak sowie alle 46.656 Farbkombinationen und Runden-/Wertungslogik bei Kribbeln. Die Socket-Tests verwenden echte UUIDs und prüfen unter anderem beide eigenständigen Minispielmodi und ihre verdeckten Einsätze. Dies ist keine Garantie, dass jeder denkbare Browser- oder Netzwerkfehler abgedeckt ist.

## Freies Minispiel und Schlag den GoldenSchmidt

Unter **Online spielen → Neuen Raum erstellen → Ausgewähltes Spiel** sind beide Modi für 2–6 Personen verfügbar. Jede Person spielt am eigenen Gerät. Im Modus **Freies Minispiel** wählt der Host eines der 26 Minispiele aus (12 neue, 14 klassische), sofern es zur Spielerzahl passt. Nach Anleitung, optionaler Übung und gemeinsamem Countdown wird genau dieses Spiel gewertet und das Ergebnis angezeigt.

Bei **Schlag den GoldenSchmidt** wählt der Host 1 bis zur Zahl der passenden Minispiele (Standard: 5; ohne 1st Generation Minigames entsprechend weniger). Die Raumautorität zieht die Spiele zufällig ohne Wiederholung. Vor jedem Spiel kennt ihr die Aufgabe und setzt verdeckt einen eigenen, noch freien Wert von 1 bis zur gewählten Spielanzahl. Sobald alle gesetzt haben, werden die Einsätze aufgedeckt. Ein gesetzter Wert ist auch bei einer Niederlage verbraucht und kann nicht geändert werden. Die erstplatzierte Person erhält ihren eigenen Einsatz als Punkte; alle anderen erhalten 0 Punkte. Die höchste Gesamtpunktzahl gewinnt. Bei gleichem Gesamtstand wird der Sieg geteilt. Der Host startet jeweils das nächste Minispiel.

Beide Modi verwenden die bestehenden Arena- und Gleichstandsregeln und vergeben keine Brettspielmünzen. Gespeicherte Einsätze bleiben bei Wiederbeitritt und Neustart erhalten. Die Bot-Testauswahl bietet beide Modi ebenfalls an; dabei gibt es keine Werkzeuge zum Überspringen gewerteter Runden. Die Regeltests, Socket-Tests und `tests/browser/minigame-modes.spec.ts` prüfen den Ablauf, verdeckte und einmalige Einsätze sowie Wiederbeitritt. Weitere Details stehen in [Inselparty-Regeln](docs/island-party-rules.md#eigenständige-minispielmodi).

## Neue Match-Minispiele

Zusätzlich zu den 14 ersten 3D-Minispielen gibt es zwölf 2D-Arcade-Minispiele für Smartphones; Hook Wars zählt inzwischen zu den **1st Generation Minigames**:

- **Quick Draw** (2–6): Duell bis 3 Siege oder 5 Gruppen-Durchgänge mit 3/2/1 Punkten, Täuschungen, Fehlstarts und Stechen. Der Server allein kennt den Signalzeitpunkt und prüft gemeldete Reaktionszeiten gegen seine eigene Uhr und die gemessene Laufzeit.
- **Light Trails** (2–6): Gleiter mit Lichtspuren auf einem Raster, Wischen oder ⟲/⟳, schrumpfende Arena, drei Durchgänge.
- **Neon Pong** (1v1 oder 2v2): eigenes Tor unten, Schläger per Finger, Power-ups, 7 Tore oder 90 Sekunden mit Golden Goal.
- **Tank Trouble** (2–6): Labyrinth mit abprallenden Kugeln, zerstörbaren Mauern, Power-ups und Respawn; 7 Abschüsse oder 90 Sekunden mit Stechen. In 2.5D mit der gewählten Figur in der Panzerluke; ohne WebGL die 2D-Fläche.
- **Bomb Arena** (2–6): Bomben mit Kettenreaktionen, Kisten, Power-ups (Reichweite, Bombe, Tempo, Kick), schließende Arena, zwei Durchgänge und Sudden Death. In 2.5D mit den gewählten Figuren; ohne WebGL die 2D-Fläche.
- **Floor is Lava** (2–6): drei Etagen Tempelplatten über Lava, die unter den Füßen zerbröseln und teils zurückkehren; wer durch ein Loch fällt, landet eine Etage tiefer, erst unter der untersten wartet die Lava. Sprung und Schubser mit Abklingzeit, einstürzender Rand mit Vorwarnung, drei Durchgänge und Stechrunde. In 2.5D mit den gewählten Figuren; ohne WebGL die 2D-Fläche.
- **Sumo Smash** und **Bumper Mayhem** (2–6): Ring-Outs mit Stoß beziehungsweise Turbo, 3 Leben, schrumpfende Arena, Entscheidung nach 75 Sekunden und Sudden Death. Sumo Smash in 2.5D mit animierten Figuren (Quaternius, CC0) und mitgehender Kamera.
- **Chaos Run** (2–6): Auto-Runner mit Lücken, Hämmern, Plattformen, einstürzenden Brücken, Wänden und Balken; Checkpoints und Fortschrittsanzeige. In 2.5D mit animierten Figuren in eigenen Spuren und Verfolgerkamera.
- **Arrow Masters** (2–6): 10 Sekunden verdeckt zielen, alle Pfeile fliegen gleichzeitig, Wind, Hindernisse, Zielscheiben, fünf Runden und Präzisions-Stechen.
- **Tower Tumble** (2–6): Turmrennen – alle bauen gleichzeitig auf einem eigenen schmalen Sockel mit derselben Steinfolge; Steine mit ⇦/⇨ verschieben, drehen, schnell fallen lassen; nach dem Aufsetzen echte Starrkörperphysik. Wer zuerst 2 s über 16 m steht, gewinnt, sonst nach 2 Minuten die Höhe.
- **Hook Wars** (2–6, 1st Generation): Greifhaken mit Schwingen und Heranziehen, Energiekerne in die eigene Zone bringen, Gegnern Kerne abluchsen.

In Inselparty, Roll It Up! und Schlag den GoldenSchmidt blendet die Checkbox **1st Generation Minigames** die 14 ersten 3D-Minispiele und Hook Wars aus der Zufallsauswahl aus; standardmäßig sind sie dabei. Im freien Modus stehen beide Gruppen getrennt zur Wahl. Spiele, die nicht zur Spielerzahl passen, werden nicht gezogen. Übung gegen Bots, Aufgeben und die bisherigen Pausen-, Wiederbeitritts- und Wertungsabläufe gelten auch hier. Stand, Regeln und Architektur: [Backlog](docs/minigames/backlog.md), [Spezifikation](docs/minigames/spezifikation.md), [Konzept](docs/minigames/konzept.md).

## Roll It Up!

Wählt im Online-Raum **Roll It Up!** für 2–6 Personen. Der Modus läuft auf dem Node-Server und beim Handy-Hosting. Für eine Solopartie lässt sich im Online-Menü ein Testspiel mit Bots erstellen.

Das Auftakt-Minispiel legt die Zugreihenfolge fest. Ihr würfelt, entscheidet an Abzweigungen und verdient in gemeinsamen Minispielen Münzen. In der Bauschale liegen sechs feste Kaufstellen jeweils fünf Felder auseinander. Der Grinder kostet 8 Münzen, Pape und Filter kosten je 3, jeder der drei Weedbuds kostet 5. Beim Passieren kann jede Figur an jeder Station einmal für ihr eigenes Set einkaufen. Die normalen Zug-Items haben weiterhin drei eigene Inventarplätze.

Mit vollständigem Set könnt ihr auf einem der beiden Hügelwege von Feld 31 oder 33 zur Bank auf Feld 34 abbiegen. Die erste Ankunft am Jayspot beendet die Partie sofort, auch bei übrigen Würfelschritten. Es gibt kein Rundenlimit.

## Inselparty

Die Partyinsel wird ausschließlich online gespielt. Jede Person öffnet den Link auf dem eigenen Handy und tritt dem Raum bei. Die anderen Spielmodule behalten ihren lokalen Modus. Die Lobby bietet 5–15 Runden und drei Tempostufen. Standard sind acht Runden; die tatsächliche Dauer hängt von der Spielerzahl und den Entscheidungen ab. Startkapital: 10 Münzen. Eine Trophäe kostet 20 Münzen. Trophäen, danach Münzen, danach Minispielsiege entscheiden über den Sieg. Auf dem Brett wirken normale Felder beim Landen. Am Hafen gibt es beim Überqueren 3 Münzen. Die Trophäe wechselt nach dem Kauf zwischen den Shops 6, 15 und 24. Inventarlimit: drei Items, ein Einsatz vor dem Würfeln.

Nach jeder Brett-Runde folgt ein Minispiel: eines der 14 klassischen 3D-Minispiele oder, je nach Spielerzahl, eines der neuen Match-Minispiele. Alle spielen nach einem gemeinsamen Countdown gleichzeitig. Wer nicht teilnimmt, bekommt keine Münzen. Platzierungen erhalten 10/4/2/0 Münzen; Gleichstände werden eindeutig aufgelöst. Der erste Sturz halbiert die aktuellen Punkte, der zweite beendet den Versuch mit dem bestehenden Stand. Ein zufälliger Auftakt bestimmt die feste Zugreihenfolge. Minispiel-Anleitungen erhalten bis zu 90 Sekunden, damit ein Übungsversuch möglich ist. Die Lobby bietet eine Übungsübersicht; vor jedem Minispiel lässt sich die anstehende Aufgabe ohne Wertung üben. Im laufenden Brettspiel entfällt die zusätzliche Übungsauswahl.

| Minispiel | Aufgabe | Steuerung |
| --- | --- | --- |
| Schatzsprint | Münzen und schwebende Kristalle sammeln, Hindernisse überspringen | Laufen, springen |
| Kistenkrawall | Kisten aufschlagen und andere Figuren anschubsen | Laufen, springen, schlagen |
| Hafenhüpfer | Fünf Hürden überwinden und den Leuchtturm erreichen | Laufen, springen |
| Wellenwache | Wellen überspringen und auf der Insel bleiben | Laufen, springen |
| Wackelsteg | Die Figur über eine schmale, gewundene Brücke balancieren | Neigung oder Stick |
| Kugelkapitäne | Auf einer Kugel Kristalle sammeln und Löcher umfahren | Neigung oder Stick |

Am Handy gibt es einen analogen Touch-Stick und passende Aktionsknöpfe. Die älteren Tastaturkürzel (WASD/Pfeile, Leertaste, E/J) bestehen noch, werden aber nicht mehr weiterentwickelt oder auf dem PC getestet. Neigung wird über „Neigung aktivieren“ bewusst freigegeben, beim ersten gültigen Signal kalibriert und kann jederzeit neu kalibriert oder ausgeschaltet werden. Bei verweigerter Freigabe, fehlenden Sensoren oder ausbleibenden Daten bleiben Stick und Tastatur nutzbar. Analoge Aufgaben mit Papier oder anderem Material sind nicht mehr Teil der Partyinsel.

Das Gerät speichert Raum und Sitzungsschlüssel, sodass „Online-Inselparty wieder beitreten“ nach einem Verbindungsabbruch funktioniert. Die Gruppe pausiert bis zu 60 Sekunden; anschließend kann der Host ohne getrennte Spieler fortsetzen oder abbrechen. Bei einem Serverneustart pausiert die Arena. Nach dem Wiederbeitritt läuft sie ab dem gespeicherten Stand weiter. Sitzungsschlüssel dürfen nicht mit fremden Personen geteilt werden. Der Server berechnet Bewegung, Kollisionen, Sprünge, Treffer und Punkte in festen 50-ms-Schritten. Clients senden nur geprüfte Steuerwerte; sie können keine Position oder Punktzahl vorgeben. Zustände werden zehnmal pro Sekunde verteilt, die eigene Bewegung wird kurz vorausberechnet und visuell geglättet.

Three.js rendert die Insel und Arenen mit räumlicher Beleuchtung, Schatten und eigenen Figuren mit animierten Gliedmaßen. Die Brettkamera lässt sich drehen und zoomen; Felder sind anklickbar und zusätzlich per Tastatur erreichbar. Bei fehlendem WebGL bleibt für das Brett eine beschriftete Übersicht verfügbar; die Action-Minispiele benötigen WebGL 2. Alle 3D-Assets entstehen aus lokal gebündelter Geometrie, ohne externe Asset-Downloads. Der PWA-Cache umfasst auch die nachgeladenen 3D-Module. Reduzierte Bewegung entfernt dekorative Animationen, während notwendige Figurenbewegung sichtbar bleibt. Die Gestaltungs- und Technikentscheidungen stehen in [Inselparty in 3D](docs/inselparty-3d.md).

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

`npm run test:browser` führt die Browsertests im Projekt `phone` aus (Touch-Emulation in Chromium). Die App ist vorerst nur für Smartphones vorgesehen; die PC-Fälle laufen nicht mehr mit und lassen sich bei Bedarf mit `npm run test:browser:desktop` starten. Für die Browsertests einmal `npx playwright install chromium` ausführen. Die ausführliche CI-Prüfung installiert Chromium automatisch und nutzt Software-WebGL. Die Tests umfassen 55 vollständige simulierte Online-Partien, die Brett-/Item-Regeln, deterministische Replays aller 14 Arenen, Sprünge, Schläge, Hindernisse, Wellen, Stürze, Checkpoints und Sensorachsen. Echte Socket-Tests prüfen getrennte Figurensteuerung, Sitzungsschutz, veraltete Eingaben, Pause, Wiederbeitritt und eine vollständige Partie. Die Browsertests prüfen die Spiel-Intros mit Kamerafahrt, Überspringen, reduzierter Bewegung und WebGL-Ersatz, neue Online-Spielstarts sowie echte WebGL-Szenen, Kamerasteuerung, alle 14 Minispiele, Touch-Stick und Tastatur, gemeinsame Figuren sowie freigegebene/verweigerte/ausbleibende Sensoren. Die Sensordaten sind dabei simuliert; physische Geräte müssen zusätzlich praktisch geprüft werden. Screenshots und Fehlertraces liegen lokal unter `test-results/` (nicht versioniert).

Die Schritte für einen öffentlichen HTTPS-Link und einen Docker-fähigen Hoster stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Für den Node-Modus müssen Client und Socket.IO-Server unter einer öffentlich erreichbaren HTTPS-Adresse bereitgestellt werden. Lokales Spiel und Handy-Hosting sind nach vollständigem Laden der PWA auch ohne Internet verfügbar.

Der aktuelle Ablauf, alle acht neuen Minispiele und die Raum-Schließung sind in [Inselparty-Regeln](docs/island-party-rules.md) beschrieben.
