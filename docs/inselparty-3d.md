> Aktueller Regelstand und Erweiterungen: [Inselparty-Regeln](island-party-rules.md).

# Inselparty in 3D

Die Spielwelt orientiert sich an den räumlichen Spielzeuglandschaften und direkt gesteuerten Figuren von [Mario Party Jamboree](https://www.nintendo.com/au/news-and-articles/super-mario-party-jamboree-heres-a-quick-overview-of-the-game/). Eigene Geometrie und Figuren bilden Hafen, Dschungel, Vulkan, Markt und erhöhte Brücken. Das Brett und die Minispiele werden mit WebGL und Three.js tatsächlich räumlich gerendert.

## Design vor dem Bau

Himmel `#8ed8f4`, Wasser `#209cce`, Gras `#61bb58`, Strand `#ffe5a1`, Koralle `#ed7059`, Tiefblau `#10485b`. Die kräftige Trebuchet-Schrift bleibt für Namen und knappe HUD-Texte erhalten. Die Landschaft übernimmt die visuelle Identität; zusätzliche Karten, große Textflächen und Dekoration treten zurück. Schatten, Figurenproportionen und Höhenunterschiede vermitteln eine kleine, begehbare Spielzeugwelt.

```text
Brett: Kamera / Runde         Minispiel: Zeit / Name / Punkte
+----------------------+      +----------------------------+
| 3D-Insel und Figuren  |      | 3D-Arena mit eigenen        |
| Wege, Höhen, Markt    |      | Figuren und Hindernissen   |
+----------------------+      | Stick          Sprung / Hit|
Zugentscheidung / Inventar    +----------------------------+
```

Die Welt besteht aus echten Meshes, räumlicher Beleuchtung, Schatten, einer drehbaren Kamera und animierten Körpern mit Armen und Beinen. Die sechs neuen Standard-Minispiele verändern die Spielmechanik ausdrücklich auf Nutzerwunsch: laufen, springen, schlagen und balancieren. Brettregeln, Items und Münzverteilung bleiben erhalten.

## Ablauf und Steuerung

- Mehrspieler: gemeinsame Arena mit 20 Simulationsschritten pro Sekunde, wahlweise auf Node oder im Worker des Host-Handys; Clients senden ausschließlich normalisierte Steuerwerte, keine Positionen oder Punkte. Beide Wege verwenden `shared/roomCore.ts`; die [Hosting-Auswahl](../README.md#zwei-hostingarten) gilt für den gesamten Raum.
- Die Partyinsel ist ausschließlich online. Jede Person spielt auf dem eigenen Gerät; alle Minispiele laufen gleichzeitig. Analoge Aufgaben und ein lokaler Partiemodus entfallen auf ausdrücklichen Nutzerwunsch. Eine kurze Übung vor dem Spiel ist ohne Wertung möglich.
- Handy: analoger Touch-Stick, getrennte Aktionsknöpfe; PC: WASD/Pfeile, Leertaste und E/J.
- Die mobile Brettansicht belegt eine Bildschirmhöhe: Karte, Spielerleiste am Kartenfuß, Kameratasten und Zugaktion bleiben gemeinsam sichtbar. Set und Inventar öffnen sich über halbtransparente Seitenbuttons; Feldsuche und Spielmenü nutzen schließbare Panels mit Fokus-Rückgabe. Lange Auswahlen scrollen innerhalb dieser Flächen. Ein Button schaltet zwischen 3D und 2D um. Die frühere Minispiel-Auswahl und „Regeln & Spielgefühl“ unter dem Brett entfallen. Im laufenden 3D-Minispiel bleiben Stick und Aktionsknöpfe im Querformat bis 600 Pixel Höhe erreichbar.
- Inselparty und Roll It Up! starten mit der Brettkamera bei der aktiven Figur. „Zur Figur“ und „Ganze Insel/Schale“ setzen Blickrichtung und Zoom zurück; Drehen, Mausrad und Zwei-Finger-Zoom ergänzen die mindestens 44 Pixel großen Kameratasten außerhalb der Szene. Die aufklappbare Feld- und Figurensuche zentriert das ausgewählte Feld. Flache Feldnummern mit Tiefenprüfung, schmalere Wege und mehr Abstand lassen größere Figuren sichtbar; die ursprünglichen Modelle und Arenen bleiben unverändert.
- Das eigene Trophäenziel liegt hinter dem Sternbutton; Münzen stehen in der Spielerleiste, Kaufstandort und Preis über der Karte. Minispiel-Ergebnisse zeigen die erhaltenen Münzen und den neuen Kontostand; beim Öffnen des Ziels erscheint die letzte Belohnung. Übungsziele bestätigen tatsächliche Bewegung, Sprünge und Schläge ausschließlich in der Oberfläche; sie vergeben keine zusätzlichen Punkte oder Münzen. Reduzierte Bewegung behält dieselben Texte und Bestätigungen bei.
- Brettfiguren laufen zwischen den vorgegebenen Abfahrts- und Ankunftszeiten durchgehend in Bewegungsrichtung. Ihre Laufstärke stammt aus der Länge und Dauer des Wegabschnitts; Netzwerktakt und Kameraänderungen lösen keine Laufbewegung aus. Gruppenabstände werden zwischen Start und Ziel interpoliert. Der Raum entscheidet weiterhin über Ankunft und Feldwirkung.
- Balance: Neigung nach bewusster Aktivierung und Kalibrierung. Bei verweigerter Berechtigung, fehlenden Sensoren oder ausbleibenden Daten bleiben Stick und Tastatur verfügbar. Die Browser-[Sensorberechtigung](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) wird nur innerhalb der Aktivierungsaktion angefragt.
- Reduzierte Bewegung setzt Brettkamera und Brettfiguren ohne Übergang auf die vorgegebene Position und entfernt dekoratives Wippen. Der Zeitpunkt der serverseitigen Ankunft bleibt gleich. In den Minispielen bleiben notwendige Figurenbewegung und Hindernisse sichtbar; die Arenakamera hält die eigene Figur im Bild.
- Three.js wird lokal gebündelt und im PWA-Cache gespeichert; keine externen Modelle oder Asset-CDNs nötig. Ressourcen und Sensorlistener werden beim Verlassen freigegeben.
