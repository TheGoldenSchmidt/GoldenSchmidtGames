> Aktueller Regelstand und Erweiterungen: [Inselparty-Regeln](island-party-rules.md).

# Inselparty in 3D

Die Spielwelt orientiert sich an den räumlichen Spielzeuglandschaften und direkt gesteuerten Figuren von [Mario Party Jamboree](https://www.nintendo.com/au/news-and-articles/super-mario-party-jamboree-heres-a-quick-overview-of-the-game/). Eigene Geometrie und Figuren bilden Hafen, Dschungel, Vulkan, Markt und erhöhte Brücken. Das Brett und die Minispiele werden mit WebGL und Three.js tatsächlich räumlich gerendert.

## Gestaltung der Inselparty

Himmel `#8ed8f4`, Wasser `#209cce`, Gras `#61bb58`, Strand `#ffe5a1`, Koralle `#ed7059`, Tiefblau `#10485b`. Die kräftige Trebuchet-Schrift bleibt für Namen und knappe HUD-Texte erhalten. Die Landschaft übernimmt die visuelle Identität; zusätzliche Karten, große Textflächen und Dekoration treten zurück. Schatten, Figurenproportionen und Höhenunterschiede vermitteln eine kleine, begehbare Spielzeugwelt.

```text
Brett: bildschirmfüllend      Minispiel: Zeit / Name / Punkte
+----------------------+      +----------------------------+
| Runde / Ansicht / ☰  |      | 3D-Arena mit eigenen        |
| 3D-Welt         Set  |      | Figuren und Hindernissen   |
|             Inventar |      | Stick          Sprung / Hit|
| Zugaktion / Spieler  |      +----------------------------+
+----------------------+
```

Die Welt besteht aus echten Meshes, räumlicher Beleuchtung, Schatten, einer drehbaren Kamera und animierten Körpern mit Armen und Beinen. Die sechs neuen Standard-Minispiele verändern die Spielmechanik ausdrücklich auf Nutzerwunsch: laufen, springen, schlagen und balancieren. Brettregeln, Items und Münzverteilung bleiben erhalten.

## Ablauf und Steuerung

- Mehrspieler: gemeinsame Arena mit 20 Simulationsschritten pro Sekunde, wahlweise auf Node oder im Worker des Host-Handys; Clients senden ausschließlich normalisierte Steuerwerte, keine Positionen oder Punkte. Beide Wege verwenden `shared/roomCore.ts`; die [Hosting-Auswahl](../README.md#zwei-hostingarten) gilt für den gesamten Raum.
- Die Partyinsel hat keinen Modus mit einem gemeinsamen Handy. Jede Person spielt auf dem eigenen Gerät; allein lässt sie sich mit Bots auf einem Handy spielen (Lokal spielen → Allein mit Bots, auch offline); alle Minispiele laufen gleichzeitig. Analoge Aufgaben und ein lokaler Partiemodus entfallen auf ausdrücklichen Nutzerwunsch. Eine kurze Übung vor dem Spiel ist ohne Wertung möglich.
- Zielplattform sind Smartphones mit Touch-Steuerung: analoger Stick und getrennte Aktionsknöpfe in den 3D-Minispielen. PC-Layouts und PC-Prüfungen ruhen gemäß `AGENTS.md`.
- Die Brettwelt belegt den gesamten verfügbaren Smartphone-Bildschirm. Runde, Ansichtsschalter, Spielerleiste am Kartenfuß und Zugaktion liegen als kompakte Overlays über der Welt; das Öffnen von Informationen und ein Wechsel der Zugphase verändern die Größe der Spielfläche nicht. Bei Inselparty öffnen sich Ziel und Inventar über halbtransparente Seitenbuttons; Roll It Up! nutzt das unten beschriebene eigene HUD. Feldsuche und Spielmenü nutzen schließbare Panels mit Fokus-Rückgabe. Lange Auswahlen scrollen innerhalb dieser Flächen. Ein Button schaltet zwischen 3D und 2D um. Die frühere Minispiel-Auswahl und „Regeln & Spielgefühl“ unter dem Brett entfallen. Im laufenden 3D-Minispiel bleiben Stick und Aktionsknöpfe im Querformat bis 600 Pixel Höhe erreichbar.
- Inselparty und Roll It Up! starten mit der Brettkamera bei der aktiven Figur. „Zur Figur“ und „Ganze Insel/Schale“ setzen Blickrichtung und Zoom zurück; Ziehen und Zwei-Finger-Zoom ergänzen die mindestens 44 Pixel großen Kameratasten im Kamera-Pop-up. Die Kameratasten öffnen sich über das Kamera-Icon. Antippen eines Feldes oder einer Figur öffnet eine Feldinfo als modales Pop-up; die Feld- und Figurensuche bietet dieselben Hinweise über eine Liste. Diese Informationen verändern weder den gewählten Kamerafokus noch Zoom oder Blickrichtung. Auf der Karte ersetzen flache Symbole die Nummern: Münzgewinn blau (+), Verlust rot (−), Ereignisse grün (!) und Shops hellblau (▣). 3D, 2D, Legende und Wegvorschau teilen dieselbe Zuordnung; Detailansichten behalten die Feld-IDs zur Orientierung. Die Symbole nutzen Tiefenprüfung und verdecken die größeren Figuren nicht.
- Das eigene Trophäenziel liegt hinter dem Sternbutton; Münzen stehen in der Spielerleiste, Kaufstandort und Preis über der Karte. Minispiel-Ergebnisse zeigen die erhaltenen Münzen und den neuen Kontostand; beim Öffnen des Ziels erscheint die letzte Belohnung. Übungsziele bestätigen tatsächliche Bewegung, Sprünge und Schläge ausschließlich in der Oberfläche; sie vergeben keine zusätzlichen Punkte oder Münzen. Reduzierte Bewegung behält dieselben Texte und Bestätigungen bei.
- Brettfiguren laufen zwischen den vorgegebenen Abfahrts- und Ankunftszeiten durchgehend in Bewegungsrichtung. Ihre Laufstärke stammt aus der Länge und Dauer des Wegabschnitts; Netzwerktakt und Kameraänderungen lösen keine Laufbewegung aus. Gruppenabstände werden zwischen Start und Ziel interpoliert. Der Raum entscheidet weiterhin über Ankunft und Feldwirkung.
- Balance: Neigung nach bewusster Aktivierung und Kalibrierung. Bei verweigerter Berechtigung, fehlenden Sensoren oder ausbleibenden Daten bleibt der Touch-Stick verfügbar. Die Browser-[Sensorberechtigung](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static) wird nur innerhalb der Aktivierungsaktion angefragt.
- Reduzierte Bewegung setzt Brettkamera und Brettfiguren ohne Übergang auf die vorgegebene Position und entfernt dekoratives Wippen. Der Zeitpunkt der serverseitigen Ankunft bleibt gleich. In den Minispielen bleiben notwendige Figurenbewegung und Hindernisse sichtbar; die Arenakamera hält die eigene Figur im Bild.
- Three.js wird lokal gebündelt und im PWA-Cache gespeichert; keine externen Modelle oder Asset-CDNs nötig. Ressourcen und Sensorlistener werden beim Verlassen freigegeben.

## Roll It Up: Die Bauschale

`BAUSCHALE` in `shared/partyBoard.ts` benennt das erste Brett unabhängig vom Spielnamen. Weitere Bretter sind noch nicht implementiert. `src/three/rollingTray.ts` baut die emaillierte Schale, sechs Sammelorte und den Hügel mit Bank; `src/components/RollItUpBoard.tsx` enthält das eigene HUD. Die genehmigten Figuren und die gemeinsame Raumautorität bleiben erhalten. Der [ursprüngliche Entwurf](design/roll-it-up-entwurf/README.md) ist eine separate Vorschau, kein Bestandteil des Spielclients.

Set und Münzen sind immer sichtbar. Das nächste fehlende Utensil wird anhand gerichteter Wegentfernungen vorgeschlagen; die Sammlung zeigt Preise, fehlende Münzen und bereits gekaufte Utensilien. Wegvorschauen folgen `partyPaths` und enden spätestens an der nächsten noch offenen Gabelung. Mit vollem Set wird ein erlaubter Weg zum Jayspot hervorgehoben. Auswahl und Bestätigung sind getrennt. Kaufmeldungen erscheinen erst nach dem aktualisierten Raumzustand. Kaufpanels zeigen Utensil und Preis in einer kleinen Kopfzeile; Restbudget und Set-Zuwachs werden nicht zusätzlich erklärt. Am Zugende steht die Feldwirkung nur einmal ohne Ansage des nächsten Spielers. Kamera und Feldinspektion sind unter modalen Panels gesperrt. Die Feldinfo öffnet sich erst mit dem `click`-Ereignis nach `pointerup`, damit der nachlaufende Touch-Klick sie nicht sofort wieder schließt.

Die Kamera verwendet feste HUD-Reserven je Smartphone-Ausrichtung. Sie hält Fokus und Zoom während des gesamten Zuges; wechselnde Aktionspanels und laufende Figuren lösen keine Kamerafahrt aus. Erst der Spielerwechsel setzt den Fokus neu; manuelles Drehen, Zoomen und die Übersicht bleiben verfügbar. Beschriftungen berücksichtigen weiterhin die tatsächlich belegten HUD-Flächen. DOM-Beschriftungen werden aus den 3D-Positionen projiziert. Statische Landschaftsgeometrien sind nach Material zusammengefasst, Felder und Symbole instanziert. Bewegte Ansichten werden auf etwa 30 Bilder pro Sekunde begrenzt; ruhende Ansichten zeichnen erst bei einer Änderung neu. Schatten werden ebenfalls nur bei Änderungen aktualisiert. Pixelratio-Begrenzung und automatische Qualitätsreduktion stammen aus `SceneKit`; reduzierte Bewegung behält dieselben autoritativen Ankunftszeiten bei. Die 2D-Karte verwendet denselben Graphen und dieselben Informationen und übernimmt bei WebGL-Ausfall.

Die lokalen Prüfungen umfassen Regeln, Bildschirm-Rendering und die Smartphone-Browserfälle `roll-it-up`, `party-board-camera`, `party-mobile-board` und `party-fields`. Sie prüfen unter anderem 320/390 Pixel Breite, Querformat, sechs Figuren, lange Namen, normale/reduzierte Bewegung, echte Käufe und Wegentscheidungen sowie WebGL-Ausfall. Browseremulation belegt keine Bildrate oder Akkulaufzeit auf einem echten Android-/iPhone-Gerät; dieser Gerätetest bleibt offen.
