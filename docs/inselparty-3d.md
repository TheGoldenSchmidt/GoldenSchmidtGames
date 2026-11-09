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

- Online: gemeinsame Arena und serverseitige Simulation mit 20 Schritten pro Sekunde; Clients senden ausschließlich normalisierte Steuerwerte, keine Positionen oder Punkte.
- Die Partyinsel ist ausschließlich online. Jede Person spielt auf dem eigenen Gerät; alle Minispiele laufen gleichzeitig. Analoge Aufgaben und ein lokaler Partiemodus entfallen auf ausdrücklichen Nutzerwunsch. Eine kurze Übung vor dem Spiel ist ohne Wertung möglich.
- Handy: analoger Touch-Stick, getrennte Aktionsknöpfe; PC: WASD/Pfeile, Leertaste und E/J.
- Auf kleinen Bildschirmen stehen Zugstatus und Würfelaktion zusammen in einer festen unteren Leiste. Im laufenden 3D-Minispiel nutzt das Querformat bis 600 Pixel Höhe die verfügbare Bildschirmhöhe: Status und Steuerungsoptionen behalten ihren Platz, die Arena füllt den Rest. Stick und Aktionsknöpfe bleiben ohne Scrollen erreichbar.
- Das eigene Trophäenziel zeigt vorhandene Münzen und den aktuellen Kaufstandort; eine Kurzfassung steht in der mobilen Zugleiste. Minispiel-Ergebnisse zeigen die erhaltenen Münzen und den neuen Kontostand, beim Zurückkehren wird das Ziel kurz hervorgehoben. Übungsziele bestätigen tatsächliche Bewegung, Sprünge und Schläge ausschließlich in der Oberfläche; sie vergeben keine zusätzlichen Punkte oder Münzen. Reduzierte Bewegung behält dieselben Texte und Bestätigungen bei.
- Balance: Neigung nach bewusster Aktivierung und Kalibrierung. Bei verweigerter Berechtigung, fehlenden Sensoren oder ausbleibenden Daten bleiben Stick und Tastatur verfügbar. Die Browser-[Sensorberechtigung](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) wird nur innerhalb der Aktivierungsaktion angefragt.
- Reduzierte Bewegung entfernt automatische Brettkamerafahrten und dekoratives Wippen; notwendige Figurenbewegung und Hindernisse bleiben sichtbar. Die Arenakamera hält die eigene Figur im Bild.
- Three.js wird lokal gebündelt und im PWA-Cache gespeichert; keine externen Modelle oder Asset-CDNs nötig. Ressourcen und Sensorlistener werden beim Verlassen freigegeben.
