# 3D-Spielansichten

Regeln: [Inselparty](island-party-rules.md). Gestaltung: [Designregeln](../designregeln.md). Mehrspieler auf getrennten Handys, allein mit Bots auch offline; Touch als Zielbedienung.

## Gemeinsame Brettdarstellung

Three.js rendert räumliche Spielzeugwelten mit Licht, Schatten und animierten Figuren. Inselparty behält Hafen/Dschungel/Vulkan/Markt und ihre Farbwelt; Roll It Up! nutzt die Bauschale.

Welt bildschirmfüllend, Overlays kompakt; Zugphasen/Informationspanels verändern keine Spielflächengröße. Spielerleiste am Kartenfuß, erreichbare Würfelaktion, Ziel/Inventar und seltene Informationen in schließbaren Panels mit Fokus-Rückgabe. Lange Auswahlen scrollen innen. Ein Button wechselt 3D/2D; keine Minispielauswahl unter dem Brett.

Größere Figuren auf auseinanderliegenden Feldern, schmale Wege, flache Symbole mit Tiefenprüfung statt Nummern. Plus blau, Minus rot, Ereignis grün, Shop hellblau – `src/lib/partyFieldVisuals.ts` teilt die Zuordnung für 3D, 2D, Legende und Wegvorschau. IDs nur in Details. Bis sechs Figuren mit kamerabezogenen Abständen, aktive Figur mit gelbem Bodenring.

Kamera startet an aktiver Figur. „Zur Figur“/„Ganze Insel/Schale“ setzen zurück; Ziehen, Zwei-Finger-Zoom, Kameratasten ≥44 px. Antippen öffnet modale Feldinfo ohne Fokus-/Zoomänderung; Feld-/Figurensuche bietet dieselben Hinweise. Kameraeingaben unter Modals sperren.

## Bewegung und Simulation

`shared/roomCore.ts` auf Node/Handy-Worker entscheidet in 50-ms-Schritten; Clients senden Steuerwerte, keine Positionen/Punkte. Figuren laufen zwischen autoritativen Abfahrts-/Ankunftszeiten; erst Ankunft bestätigt Position/Feldwirkung. Laufstärke aus Weglänge/Zeit, nicht Netzwerktakt/Kamera. Laufzyklus bis bestätigtem Halt fortführen, Gruppenabstände interpolieren.

Reduzierte Bewegung setzt Brettkamera/-figuren direkt, ändert keine Ankunftszeit. Notwendige Bewegung/Hindernisse in Minispielen bleiben sichtbar, Kamera hält eigene Figur im Bild. Stick/Aktionen auch im Smartphone-Querformat erreichbar. Neigung nur nach Aktivierung/Kalibrierung, bei fehlenden/verweigerten Daten Stick erhalten.

Trophäenziel hinter Sternbutton, Münzen in Spielerleiste; Ergebnisse zeigen Gutschrift/Kontostand. Übungsfeedback nur visuell, ohne zusätzliche Punkte. Three.js/Assets lokal und im PWA-Cache; Ressourcen/Sensorlistener beim Verlassen freigeben. Klassische Action-Arenen benötigen WebGL 2; Bretter und neue Match-Spiele besitzen 2D-Ersatzdarstellungen.

## Roll It Up: Bretter

`ROLL_BOARDS` in `shared/partyBoard.ts` beschreibt jedes Brett (Felder mit x/y, sechs Kaufstellen, Ziel, Rohrpost-Paare); der Host wählt es in der Lobby (`options.board`, Standard Bauschale). `src/three/rollingTray.ts` baut die Szenerie: **Bauschale** mit Emaille, Messingrand, sechs Orten und Hügelbank; **Grinder** als Stahlscheibe mit geriffeltem Rand, Mahlzähnen, orangen Rohrpost-Bögen und Lounge auf dem Hügel. Die 2D-Karte (`TrayMapArt`) zeichnet beide. `src/components/RollItUpBoard.tsx`: HUD. [Ursprüngliche Vorschau](design/roll-it-up-entwurf/README.md) vom Client getrennt.

Oben Münzen, Set, nächstes fehlendes Utensil nach gerichteter Wegentfernung; Sammlung mit Preisen/Fehlbetrag/Besitz. Übersicht nennt alle Stationen, Zugansicht Ziel/gewählten Ort. Vorschau folgt `partyPaths` bis nächster offener Gabelung; mit vollem Set erlaubten Jayspot-Weg hervorheben. Auswahl/Bestätigung trennen, Kauf erst nach aktualisiertem Raumzustand bestätigen. Kaufzeile kompakt, Feldwirkung einmal, Zugansage nur vor Würfeln. Feldinfo bei `click` nach `pointerup` öffnen, damit Folge-Klick nicht schließt.

Feste HUD-Reserven je Ausrichtung; Fokus/Zoom während Zug stabil, automatisch erst bei Spielerwechsel neu. DOM-Schilder aus 3D-Positionen projizieren, HUD-Belegung beachten. Landschaft nach Material bündeln, Felder/Symbole instanzieren. Bewegung etwa 30 FPS, Ruheansicht/Schatten nur bei Änderung zeichnen; `SceneKit` begrenzt Pixelratio/Qualität. 2D nutzt denselben Graphen/dieselben Informationen.

## Prüfung

Regeln, Screens und Smartphone-Fälle `roll-it-up`, `party-board-camera`, `party-mobile-board`, `party-fields`: 320/390 px, Querformat, sechs Figuren, lange Namen, beide Bewegungseinstellungen, Käufe/Wegentscheidungen und WebGL-Ausfall. Build-Reihenfolge gemäß AGENTS.md; reale Bildrate, Akku und Sensoren gesondert prüfen.
