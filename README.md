# Spielraum

Eine installierbare Smartphone-PWA für lokale und Online-Spiele. Das aktuelle Grundgerüst enthält:

- lokales Gastprofil mit optionalem Anzeigenamen
- lokales Spiel-Setup
- Online-Räume mit fünfstelligem Raumcode
- Host-Wechsel bei Verbindungsabbruch
- gemeinsame Spieldefinitionen für lokalen und Online-Modus
- Qwixx-, Durak- und Kribbeln-Spielmodule für lokale und Online-Partien
- Offline-Cache als installierbare PWA
- Inselparty für 2–6 Personen ausschließlich online: eine echte 3D-Insel, eigene steuerbare Figuren, 34 Felder, fünf Items und sechs gemeinsame 3D-Minispiele mit Touch-, Tastatur- und Neigungssteuerung

Das Qwixx-Modul enthält den gemeinsamen weißen Wurf, die zusätzliche Farbaktion der aktiven Person, vier getrennte Wertungsblätter, Fehlwürfe, Reihenschlüsse, automatische Wertung und die Spielergebnisanzeige.

Durak verwendet 36 Karten für zwei bis sechs Spieler. Enthalten sind Trumpf, Angriff und Verteidigung, Aufnehmen, Nachlegen, Weiterschieben sowie verdeckte Online-Handkarten. Im lokalen Modus schützt eine Übergabeansicht die Hand der jeweils aktiven Person.

Neue Partien beginnen mit einem etwa vier Sekunden langen 3D-Intro: Bei Durak sitzen die Spieler am runden Filztisch, bei Qwixx und Kribbeln liegen die jeweiligen Würfel und Blätter bereit. Die Kamera fährt näher und richtet sich senkrecht auf den Tisch aus. Inselparty beginnt mit einem Anflug auf eine kleine Insel. Die Sequenzen sind per Button oder Escape überspringbar, entfallen bei reduzierter Bewegung und werden beim Wiederbeitritt nicht erneut abgespielt. Ohne WebGL steht eine Ersatzszene bereit. Mehr dazu in [Spiel-Intros](docs/game-intros.md).

Kribbeln ist für zwei bis fünf Personen lokal und online spielbar: sechs Farbwürfel, bis zu drei Würfe mit frei wählbarem Behalten, sechs Farbaufgaben und vier streng ansteigende Kribbelfelder. Bei einer nicht erfüllten Aufgabe kann auf ein freies Kribbelfeld derselben Gruppe ausgewichen werden; danach gibt es drei neue Versuche. Jede abgeschlossene Zeile wird nach Platzierung gewertet, Gleichstände erhalten den niedrigeren Platz. Bei gleichen Endpunkten entscheidet das vierte Kribbelfeld.

Die App verwendet ein eigenes festes digitales Aufgabenblatt und eine dokumentierte zyklische Farbverteilung: Die sechs Farben Rot, Gelb, Grün, Blau, Orange und Violett werden für jeden weiteren Würfel um eine Zahl versetzt. Jeder Würfel trägt jede Zahl von 1 bis 6 und jede Farbe genau einmal. Über alle 36 Seiten kommt jedes Zahl-Farbe-Paar genau einmal vor; Wurflogik und sichtbare Würfelseiten verwenden dieselbe geprüfte Tabelle. Diese Materialausführung ist nicht als identische Kopie sämtlicher Original-Wertungsblätter oder der Originalwürfel verifiziert.

Die aktuelle Kribbeln-Aufgabe wird als Mengenbild mit Würfeln, Farbgruppen oder Summenziel dargestellt. Fallende Würfel bleiben neutral; Farben, Beschriftungen, Aufgabenzähler und Summe erscheinen erst nach dem Landen. Behaltene Würfel bleiben auch für die anderen Online-Spieler sichtbar liegen. Reduzierte Bewegung zeigt das Ergebnis sofort. Die Ansicht nutzt auf dem PC zwei Spalten und auf dem Handy einen kompakten Spieltisch. Mehr dazu in [Kribbeln: Aufgabe und Wurf](docs/kribbeln-visuals.md).

## Automatische Prüfungen

Auf dem Startbildschirm prüft „Nach Updates suchen“ den Service Worker ohne Browsercache. Eine heruntergeladene Version wird mit „Neue Version laden“ ausdrücklich aktiviert; erst nach Übernahme wird diese App-Ansicht neu geladen. Laufende Spiele besitzen keinen Update-Button und werden vom Update-Code nicht automatisch neu geladen. Die Tests dafür laufen mit `npm run test:pwa` auch in CI.

`.github/workflows/ci.yml` führt unter Node 22 bei Pushes und Pull Requests Installation, TypeScript-/PWA-Build, Regeltests aller vier Spiele, Socket-Integration, Produktionsprüfung und echte Chromium-Browsertests aus. Manuelle Starts sind ebenfalls möglich. Die Regeltests umfassen Feldgrenzen, Schlösser und Fehlwürfe bei Qwixx, Kartenvergleiche, Weiterschieben und Schummelmodus bei Durak sowie alle 46.656 Farbkombinationen und Runden-/Wertungslogik bei Kribbeln. Die Socket-Tests verwenden echte UUIDs und prüfen alle vier Spielstarts. Dies ist keine Garantie, dass jeder denkbare Browser- oder Netzwerkfehler abgedeckt ist.

## Inselparty

Die Partyinsel wird ausschließlich online gespielt. Jede Person öffnet den Link auf dem eigenen Handy oder PC und tritt dem Raum bei. Die anderen Spielmodule behalten ihren lokalen Modus. Die Lobby bietet 5–15 Runden und drei Tempostufen. Standard sind acht Runden; die tatsächliche Dauer hängt von der Spielerzahl und den Entscheidungen ab. Startkapital: 10 Münzen. Eine Trophäe kostet 20 Münzen. Trophäen, danach Münzen, danach Minispielsiege entscheiden über den Sieg. Auf dem Brett wirken normale Felder beim Landen. Am Hafen gibt es beim Überqueren 3 Münzen. Die Trophäe wechselt nach dem Kauf zwischen den Shops 6, 15 und 24. Inventarlimit: drei Items, ein Einsatz vor dem Würfeln.

Nach jeder Brett-Runde folgt eines von sechs 3D-Minispielen. Alle spielen nach einem gemeinsamen Countdown gleichzeitig in derselben Arena und steuern die eigene Figur. Wer nicht teilnimmt, bekommt keine Münzen. Platzierungen erhalten 10/7/5/3/2/1 Münzen; Gleichstände zählen zum niedrigeren Platz. Minispiel-Anleitungen erhalten bis zu 90 Sekunden, damit ein Übungsversuch möglich ist. Die Lobby und das Spiel bieten außerdem eine Übersicht zum Ausprobieren ohne Wertung.

| Minispiel | Aufgabe | Steuerung |
| --- | --- | --- |
| Schatzsprint | Münzen und schwebende Kristalle sammeln, Hindernisse überspringen | Laufen, springen |
| Kistenkrawall | Kisten aufschlagen und andere Figuren anschubsen | Laufen, springen, schlagen |
| Hafenhüpfer | Fünf Hürden überwinden und den Leuchtturm erreichen | Laufen, springen |
| Wellenwache | Wellen überspringen und auf der Insel bleiben | Laufen, springen |
| Wackelsteg | Die Figur über eine schmale, gewundene Brücke balancieren | Neigung oder Stick |
| Kugelkapitäne | Auf einer Kugel Kristalle sammeln und Löcher umfahren | Neigung oder Stick |

Am Handy gibt es einen analogen Touch-Stick und passende Aktionsknöpfe. Am PC funktionieren WASD/Pfeile, Leertaste zum Springen und E/J zum Schlagen. Neigung wird über „Neigung aktivieren“ bewusst freigegeben, beim ersten gültigen Signal kalibriert und kann jederzeit neu kalibriert oder ausgeschaltet werden. Bei verweigerter Freigabe, fehlenden Sensoren oder ausbleibenden Daten bleiben Stick und Tastatur nutzbar. Analoge Aufgaben mit Papier oder anderem Material sind nicht mehr Teil der Partyinsel.

Das Gerät speichert Raum und Sitzungsschlüssel, sodass „Online-Inselparty wieder beitreten“ nach einem Verbindungsabbruch funktioniert. Die Gruppe pausiert bis zu 60 Sekunden; anschließend kann der Host ohne getrennte Spieler fortsetzen oder abbrechen. Online-Zustände bleiben im Arbeitsspeicher: Ein Serverneustart beendet die Partie. Sitzungsschlüssel dürfen nicht mit fremden Personen geteilt werden. Der Server berechnet Bewegung, Kollisionen, Sprünge, Treffer und Punkte in festen 50-ms-Schritten. Clients senden nur geprüfte Steuerwerte; sie können keine Position oder Punktzahl vorgeben. Zustände werden zehnmal pro Sekunde verteilt, die eigene Bewegung wird kurz vorausberechnet und visuell geglättet.

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

Für die Browsertests einmal `npx playwright install chromium` ausführen. Die CI installiert Chromium automatisch und nutzt Software-WebGL. Die Tests umfassen 55 vollständige simulierte Online-Partien, die Brett-/Item-Regeln, deterministische Replays aller sechs Arenen, Sprünge, Schläge, Hindernisse, Wellen, Stürze, Checkpoints und Sensorachsen. Echte Socket-Tests prüfen getrennte Figurensteuerung, Sitzungsschutz, veraltete Eingaben, Pause, Wiederbeitritt und eine vollständige Partie. 42 Handy-/Desktop-Browsertests prüfen die Spiel-Intros mit Kamerafahrt, Überspringen, reduzierter Bewegung und WebGL-Ersatz, neue Online-Spielstarts sowie echte WebGL-Szenen, Kamerasteuerung, alle sechs Minispiele, Touch-Stick und Tastatur, gemeinsame Figuren sowie freigegebene/verweigerte/ausbleibende Sensoren. Die Sensordaten sind dabei simuliert; physische Geräte müssen zusätzlich praktisch geprüft werden. Screenshots und Fehlertraces liegen lokal unter `test-results/` (nicht versioniert).

Die Schritte für einen öffentlichen HTTPS-Link und einen Docker-fähigen Hoster stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Für den echten Online-Betrieb müssen Client und Socket.IO-Server unter einer öffentlich erreichbaren HTTPS-Adresse bereitgestellt werden. Der lokale Modus bleibt nach dem ersten Laden offline verfügbar.
