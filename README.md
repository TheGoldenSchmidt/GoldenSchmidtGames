# GoldenSchmidtGames (GSG)

Eine installierbare Smartphone-PWA für lokale und Online-Spiele. Das aktuelle Grundgerüst enthält:

- lokales Gastprofil mit optionalem Anzeigenamen
- lokales Spiel-Setup
- Räume wahlweise auf dem Node-Server (Raumcode) oder dem Host-Handy (QR-Verbindung)
- Host-Wechsel bei Verbindungsabbruch im Node-Modus; beim Handy-Hosting bleibt dasselbe Gerät zuständig
- gemeinsame Spieldefinitionen für lokalen und Online-Modus
- Qwixx-, Durak- und Kribbeln-Spielmodule für lokale und Online-Partien
- Offline-Cache als installierbare PWA
- 13 freigegebene alpha_-Charaktere mit Pflichtauswahl vor Raumzugang und zufälliger Bot-Zuordnung; dieselbe Figur in allen Spielen
- Inselparty für 2–6 Personen ausschließlich online: eine echte 3D-Insel, eigene steuerbare Figuren, 34 Felder, fünf Items und 14 gemeinsame 3D-Minispiele mit Touch-, Tastatur- und Neigungssteuerung

Das Qwixx-Modul enthält den gemeinsamen weißen Wurf, die zusätzliche Farbaktion der aktiven Person, vier getrennte Wertungsblätter, Fehlwürfe, Reihenschlüsse, automatische Wertung und die Spielergebnisanzeige.

Qwixx bleibt nach dem Intro in einer runden 3D-Tischarena: Die aktive Figur rückt zum Becher vor, zwei weiße und vier einfarbige Würfel fliegen mit festen Identitäten auf wechselnde freie Landepunkte und können danach als gültige Kombination angehoben werden. Die Punktekarte liegt dauerhaft darunter. Der Becher lässt sich mit Finger oder Maus, optionaler Handybewegung oder dem Würfeln-Knopf bedienen; geschlossene Farbreihen nehmen ihren Würfel aus dem nächsten Wurf und reduzierte Bewegung zeigt Ergebnisse sofort. Mehr dazu in [Qwixx mit Würfelbecher](docs/qwixx-cup.md).

Durak verwendet 36 Karten für zwei bis sechs Spieler. Enthalten sind Trumpf, Angriff und Verteidigung, Aufnehmen, Nachlegen, Weiterschieben sowie verdeckte Online-Handkarten. Im lokalen Modus schützt eine Übergabeansicht die Hand der jeweils aktiven Person.

Neue Partien beginnen mit einem etwa vier Sekunden langen 3D-Intro: Bei Durak sitzen die Spieler am runden Filztisch, bei Qwixx und Kribbeln liegen die jeweiligen Würfel und Blätter bereit. Die Kamera fährt näher und richtet sich senkrecht auf den Tisch aus. Inselparty beginnt mit einem Anflug auf eine kleine Insel. Die Sequenzen sind per Button oder Escape überspringbar, entfallen bei reduzierter Bewegung und werden beim Wiederbeitritt nicht erneut abgespielt. Ohne WebGL steht eine Ersatzszene bereit. Mehr dazu in [Spiel-Intros](docs/game-intros.md).

Kribbeln ist für zwei bis fünf Personen lokal und online spielbar: sechs Farbwürfel, bis zu drei Würfe mit frei wählbarem Behalten, sechs Farbaufgaben und vier streng ansteigende Kribbelfelder. Bei einer nicht erfüllten Aufgabe kann auf ein freies Kribbelfeld derselben Gruppe ausgewichen werden; danach gibt es drei neue Versuche. Jede abgeschlossene Zeile wird nach Platzierung gewertet, Gleichstände erhalten den niedrigeren Platz. Bei gleichen Endpunkten entscheidet das vierte Kribbelfeld.

Die App verwendet ein eigenes festes digitales Aufgabenblatt und eine dokumentierte zyklische Farbverteilung: Die sechs Farben Rot, Gelb, Grün, Blau, Orange und Violett werden für jeden weiteren Würfel um eine Zahl versetzt. Jeder Würfel trägt jede Zahl von 1 bis 6 und jede Farbe genau einmal. Über alle 36 Seiten kommt jedes Zahl-Farbe-Paar genau einmal vor; Wurflogik und sichtbare Würfelseiten verwenden dieselbe geprüfte Tabelle. Diese Materialausführung ist nicht als identische Kopie sämtlicher Original-Wertungsblätter oder der Originalwürfel verifiziert.

Die aktuelle Kribbeln-Aufgabe wird als Mengenbild mit Würfeln, Farbgruppen oder Summenziel dargestellt. Ein Würfelbecher lässt sich mit Finger oder Maus schütteln und per Swipe nach unten auswerfen; alternativ gibt es den Würfeln-Knopf oder eine ausdrücklich freigegebene Handybewegung mit Schütteln und anschließendem Kippen. Die sechs Würfel behalten durchgehend ihre festen Farbseiten und fliegen aus dem Becher auf den Tisch. Behaltene Würfel bleiben auch für die anderen Online-Spieler liegen. Beschriftungen, Aufgabenzähler und Summe erscheinen nach dem Landen. Reduzierte Bewegung zeigt das Ergebnis sofort. Die Ansicht nutzt auf dem PC zwei Spalten und auf dem Handy einen kompakten Spieltisch. Mehr dazu in [Kribbeln: Aufgabe und Wurf](docs/kribbeln-visuals.md).

## Zwei Hostingarten

Beim Erstellen eines Raums wählt der Host **Node-Server** (Standard) oder **Dieses Handy**. Alle vier Spiele verwenden dieselbe Raum- und Regellogik. Die Auswahl gilt für diesen Raum; laufende Partien wechseln ihre Hostingart nicht.

Im Node-Modus verbindet sich jedes Gerät über das Internet mit dem bisherigen Server und tritt per Raumcode bei. Im Handy-Modus spielt der Host selbst mit und führt die gemeinsame Simulation in einem Worker aus. Gäste verbinden sich im selben WLAN oder Hotspot einzeln per Einladung und Antwort als QR-Code. Der Spielverkehr läuft direkt zwischen den Geräten, ohne Signalisierungsdienst, STUN/TURN oder Cloud-Datenbank. Verschiedene Gruppen haben unabhängige Hosts.

Für den Einsatz ohne Internet die aktuelle PWA vorher auf **jedem** Gerät vollständig laden. Das Host-Handy bleibt mit geöffneter App aktiv; beim Verlassen der App pausiert die Partie. Bestätigte Züge liegen im lokalen Gerätespeicher. Nach einem vollständigen Neustart öffnet der Host seinen Tisch wieder, Gäste verbinden sich bei Bedarf erneut per QR. Speicherlöschen, privates Surfen oder Verlust des Host-Geräts können diesen Spielstand löschen. Ein isoliertes WLAN/Hotspot kann Direktverbindungen verhindern. Voraussetzungen und praktische Geräteprüfung: [Deployment](DEPLOYMENT.md#handy-hosting).

## Automatische Prüfungen

Online-Plätze sind ab der Lobby an einen privaten Schlüssel auf dem jeweiligen Gerät gebunden. Nach einem Verbindungsabbruch meldet sich das Gerät im selben Raum wieder an. Auch nach dem Neuladen öffnet das Gerät seine zuletzt aktive Online-Partie. Wer nur den Raumcode oder eine fremde Spieler-ID kennt, erhält keinen Zugriff auf einen bereits belegten Platz. Der Server speichert bestätigte Züge, verdeckte Karten und Sitzungsschlüssel. Solange der Speicher erhalten bleibt, setzen alle vier Spiele nach einem Neustart im selben Raum fort. Auf Render starten beide Hostingarten auch ohne Turso; der lokale Node-Speicher ist dort flüchtig. Optionen für dauerhafte Node-Spielstände stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Auf dem Startbildschirm prüft „Nach Updates suchen“ den Service Worker ohne Browsercache. Eine heruntergeladene Version wird mit „Neue Version laden“ ausdrücklich aktiviert; erst nach Übernahme wird diese App-Ansicht neu geladen. Laufende Spiele besitzen keinen Update-Button und werden vom Update-Code nicht automatisch neu geladen. Die Tests dafür laufen mit `npm run test:pwa` auch in CI.

`.github/workflows/ci.yml` führt unter Node 22 bei Pushes und Pull Requests Installation, TypeScript-/PWA-Build, Regeltests aller vier Spiele, Socket-Integration, Produktionsprüfung und echte Chromium-Browsertests aus. Manuelle Starts sind ebenfalls möglich. Die Regeltests umfassen Feldgrenzen, Schlösser und Fehlwürfe bei Qwixx, Kartenvergleiche, Weiterschieben und Schummelmodus bei Durak sowie alle 46.656 Farbkombinationen und Runden-/Wertungslogik bei Kribbeln. Die Socket-Tests verwenden echte UUIDs und prüfen alle vier Spielstarts. Dies ist keine Garantie, dass jeder denkbare Browser- oder Netzwerkfehler abgedeckt ist.

## Inselparty

Die Partyinsel wird ausschließlich online gespielt. Jede Person öffnet den Link auf dem eigenen Handy oder PC und tritt dem Raum bei. Die anderen Spielmodule behalten ihren lokalen Modus. Die Lobby bietet 5–15 Runden und drei Tempostufen. Standard sind acht Runden; die tatsächliche Dauer hängt von der Spielerzahl und den Entscheidungen ab. Startkapital: 10 Münzen. Eine Trophäe kostet 20 Münzen. Trophäen, danach Münzen, danach Minispielsiege entscheiden über den Sieg. Auf dem Brett wirken normale Felder beim Landen. Am Hafen gibt es beim Überqueren 3 Münzen. Die Trophäe wechselt nach dem Kauf zwischen den Shops 6, 15 und 24. Inventarlimit: drei Items, ein Einsatz vor dem Würfeln.

Nach jeder Brett-Runde folgt eines von 14 3D-Minispielen. Alle spielen nach einem gemeinsamen Countdown gleichzeitig in derselben Arena und steuern die eigene Figur. Wer nicht teilnimmt, bekommt keine Münzen. Platzierungen erhalten 10/4/2/0 Münzen; Gleichstände werden eindeutig aufgelöst. Der erste Sturz halbiert die aktuellen Punkte, der zweite beendet den Versuch mit dem bestehenden Stand. Ein zufälliger Auftakt bestimmt die feste Zugreihenfolge. Minispiel-Anleitungen erhalten bis zu 90 Sekunden, damit ein Übungsversuch möglich ist. Die Lobby und das Spiel bieten außerdem eine Übersicht zum Ausprobieren ohne Wertung.

| Minispiel | Aufgabe | Steuerung |
| --- | --- | --- |
| Schatzsprint | Münzen und schwebende Kristalle sammeln, Hindernisse überspringen | Laufen, springen |
| Kistenkrawall | Kisten aufschlagen und andere Figuren anschubsen | Laufen, springen, schlagen |
| Hafenhüpfer | Fünf Hürden überwinden und den Leuchtturm erreichen | Laufen, springen |
| Wellenwache | Wellen überspringen und auf der Insel bleiben | Laufen, springen |
| Wackelsteg | Die Figur über eine schmale, gewundene Brücke balancieren | Neigung oder Stick |
| Kugelkapitäne | Auf einer Kugel Kristalle sammeln und Löcher umfahren | Neigung oder Stick |

Am Handy gibt es einen analogen Touch-Stick und passende Aktionsknöpfe. Am PC funktionieren WASD/Pfeile, Leertaste zum Springen und E/J zum Schlagen. Neigung wird über „Neigung aktivieren“ bewusst freigegeben, beim ersten gültigen Signal kalibriert und kann jederzeit neu kalibriert oder ausgeschaltet werden. Bei verweigerter Freigabe, fehlenden Sensoren oder ausbleibenden Daten bleiben Stick und Tastatur nutzbar. Analoge Aufgaben mit Papier oder anderem Material sind nicht mehr Teil der Partyinsel.

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

Für die Browsertests einmal `npx playwright install chromium` ausführen. Die CI installiert Chromium automatisch und nutzt Software-WebGL. Die Tests umfassen 55 vollständige simulierte Online-Partien, die Brett-/Item-Regeln, deterministische Replays aller 14 Arenen, Sprünge, Schläge, Hindernisse, Wellen, Stürze, Checkpoints und Sensorachsen. Echte Socket-Tests prüfen getrennte Figurensteuerung, Sitzungsschutz, veraltete Eingaben, Pause, Wiederbeitritt und eine vollständige Partie. Die Browsertests für Handy und Desktop prüfen die Spiel-Intros mit Kamerafahrt, Überspringen, reduzierter Bewegung und WebGL-Ersatz, neue Online-Spielstarts sowie echte WebGL-Szenen, Kamerasteuerung, alle 14 Minispiele, Touch-Stick und Tastatur, gemeinsame Figuren sowie freigegebene/verweigerte/ausbleibende Sensoren. Die Sensordaten sind dabei simuliert; physische Geräte müssen zusätzlich praktisch geprüft werden. Screenshots und Fehlertraces liegen lokal unter `test-results/` (nicht versioniert).

Die Schritte für einen öffentlichen HTTPS-Link und einen Docker-fähigen Hoster stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Für den Node-Modus müssen Client und Socket.IO-Server unter einer öffentlich erreichbaren HTTPS-Adresse bereitgestellt werden. Lokales Spiel und Handy-Hosting sind nach vollständigem Laden der PWA auch ohne Internet verfügbar.

Der aktuelle Ablauf, alle acht neuen Minispiele und die Raum-Schließung sind in [Inselparty-Regeln](docs/island-party-rules.md) beschrieben.
