# Designregeln für GoldenSchmidtGames

Bei jeder UI-Erweiterung und -Bearbeitung anwenden. Technik und Prüfungen: [AGENTS.md](AGENTS.md). Für HUDs/Menüs/Overlays zusätzlich `game-ui-frontend`.

## Geltungsbereich

| Bereich | Gestaltung |
| --- | --- |
| Start, lokale/Online-Auswahl, Lobby, Profil, QR, Wiederverbindung | Inselwelt: `HomeScreen.tsx`, `AdventureChoice.tsx`, `home.css`, `menus.css` |
| Rich’s Universe: Zugang/Experimentliste | Inselwelt; [Bereich](src/richs-universe/README.md). Nur dortige `experiments/` gestalten sich frei. |
| Roll It Up! | Bauschale mit Inselwelt-HUD; [Umsetzung](docs/inselparty-3d.md#roll-it-up-die-bauschale) |
| Einsatz-/Ergebnismenüs laufender Wettbewerbe | Bisheriger Party-Stil: `.party-menu`, `--menu-*`, `partyMenus.css` |
| Übrige Spiele/Live-HUDs | Eigene bisherige Gestaltung; Umstellung nur auf Auftrag |

Eine Ansicht vollständig umstellen oder ihren bestehenden Stil fortführen; nicht mischen. Keine neuen Party-Stil-Bausteine. Menüänderungen verändern keine Spielflächen nebenbei. Umstellungen hier nachführen; implementiert, geprüft und geplant unterscheiden. Die Experiment-Ausnahme hebt gemeinsame Sicherheits-, Offline- und Zugänglichkeitsanforderungen nicht auf.

## Visuelle Richtung

Schwebende Insel als plastische Abenteuerwelt: Landschaft rahmt freie Inhalte, Materialien machen Aktionen erkennbar. Warme Sonne, kühles Füll-/Kantenlicht, weiche Schatten, facettierte Körper und leichte Körnung. Pro Ansicht ein Blickfang und eine wichtigste nächste Aktion; danach Ruhe.

Aktuelle Illustrationen/Buttons: `src/assets/expedition/`. Frühere prozedurale Quellen: [Grafikwerkzeuge](docs/startscreen-render.md). Historische Renderkompositionen sind keine aktuelle Menüvorgabe. Neue Grafik im Projekt modellieren; fremde Modelle nur mit geprüfter Lizenz/Herkunft. Keine Fotos, Emoji oder flachen Ersatzflächen für Weltgrafik.

## Materialien und Schrift

Farben aus `--iw-*` in [inselwelt.css](src/styles/inselwelt.css); alte Renderpalette in `kit.ts`/`sprites.ts`. Keine ähnlichen Parallelpaletten.

| Material | Grundfarbe | Rolle |
| --- | --- | --- |
| Gold/Citrin | `#ffd777` → `#f1aa4c` | Hauptaktion |
| Amethyst | `#dcaefc` → `#c18ef2` | Gleichrangige zweite Wahl, Online |
| Stein | `#7c7092` → `#605575` | Nebenaktionen, Werkzeuge, Fortsetzen |
| Holz | `#dea468` | Schilder/Abschnittstitel |
| Glas | `#1f1c54`, 74 % | Status/kurze Hinweise |
| Papier | `#fff8ea` | Formulare, Listen, Hilfetexte |

Textkontrast ≥4,5:1 auf tatsächlichen Flächen, nach Neurendern/neuen Kombinationen erneut messen. Text braucht Materialhintergrund. Farben nie allein: Auswahl mit Rahmen/Häkchen, Bereitschaft mit Text, Fehler konkret. Spielfarben (Qwixx, Würfel, Karten) semantisch erhalten.

Lilita One: Titel/kurze Hauptzeilen; Lexend: Bedienung/Fließtext (400–500, Bedienelemente 600). Lokal über Fontsource und offline verfügbar; keine weiteren/externen Schriften. Bestehende Spielansichten behalten Trebuchet bis zur Umstellung. Logo als Bild mit Alternativtext „GoldenSchmidtGames“.

Großschreibung per CSS nur auf kurzen Tafel-/Schildtiteln (etwa 18 Zeichen). Klare Titelhierarchie, kurze deutsche Aktionsnamen, gleiche Aktion gleich benennen. Beschriftung, zugänglicher Name und bestätigte Auswahl stimmen überein. Markenname GoldenSchmidtGames, Kurzform GSG.

## Menüs und Bausteine

`.iw-menu`/`.iw-dialog`, `IslandWorld`, `ScreenHeader`, `.iw-card`, `.iw-chip`, `.iw-note` und vorhandene Tasten verwenden. Ansichtsspezifisches CSS in eigener Datei; keine globalen Selektoren oder `!important` als Ersatz für Zuständigkeit. Regeln, Sitzungen und Transport bleiben außerhalb der Gestaltung.

- Höchstens eine goldene Hauptaktion; Amethyst daneben nur bei gleichrangiger Wahl, sonst Stein. „Party für alle beenden“ dunkel, niemals Gold, mit Papierbestätigung.
- Materialtasten mit heller Kante, sichtbarer Tiefe und Druckzustand. Expedition-Flächen verwenden; alte Sprites an der Renderquelle ändern.
- Symbole einfarbig ohne zusätzliche Kachel; große Tafeln mit Symbol, Haupt-/Unterzeile und Pfeil. Runde Pillen für Chips, Papier/Eingaben mit 12–16 px Radius.
- Eingaben mit sichtbarem Label. Fehler nennen Ursache/nächsten Schritt; Hinweise unterscheiden sich von Fehlern. Deaktivierte Aktionen entsättigt und technisch deaktiviert.
- Touch-Ziele ≥44 × 44 CSS-px, Stein-Tafeln ≥52 px, große Tafeln ≥70 px hoch; Abstand zwischen Nachbaraktionen.
- Nur [freigegebene Figuren](docs/approved-character-design.md). Eine gemeinsame drehbare 3D-Vorschau je Auswahl, unverzerrte statische Portraits in Listen; keine zusätzlichen Canvas-Vorschauen.

Online zuerst Erstellen/Beitreten; Raumcode/QR sind Beitrittsarten. Galerie in Erstellen, Beitreten und Lobby aufklappbar; lokale Plätze mit Namen/eigener Galerie. Nur Partienoptionen in Einstellungen; Fragezeichen an Spielkarten öffnen Regeln. Verlassen/Beenden unter Bereitschaft absetzen.

Lokal: „Ein Handy für alle“ (Tischspiele), „Allein mit Bots“ (Brett-/Minispielmodi), Hinweis „Läuft nur auf diesem Handy, auch ohne Internet.“. Bot-Karten nennen 1–5 Bots, Einrichtung trägt Spielnamen. Proberaum bleibt eigener lokaler Zugang.

## Smartphone-Layout

Touch zuerst; ab 320 px kein horizontaler Überlauf. Lange Namen umbrechen/kürzen, ohne Aktionen/Portraits zu verdrängen. Hochkant untereinander; im Querformat ab 700 px passende Bereiche nebeneinander. Kulisse bildschirmfüllend; Abstände etwa 8/16/24/32 px. PC-Prüfungen ruhen.

Feste Aktionen brauchen Inhaltsabstand und Safe Areas; Bildschirmtastatur berücksichtigen. Dialoge passen in sichtbare Fläche, scrollen innen, haben erreichbare Schließen-Aktion und Fokus-Rückgabe. Kamera-/Welteingaben unter Modals sperren. QR-Codes quadratisch, unverzerrt, mit weißem Rand.

## Start und Bewegung

Startbildschirm eine Bildschirmhöhe ohne Scrollen; bei Platzmangel zuerst Illustration verkleinern, Touch-Ziele erhalten. Status/Ton/Profil oben; Wappen/Motto und Spielzugänge darübergelegt. Rich’s Universe als kompakte Stein-Tafel unter den Spielmodi; Installation/Updates/Fortsetzen erreichbar. Keine Figuren oder Live-3D-Szene; CSS-Himmel bis Bilder bereitstehen.

Beim ersten Einstieg landen Steintafel, GOLDEN, SCHMIDT, GAMES und Krone nacheinander; einmaliger warmer Kronenreflex. Zweizeiliges, signiertes Motto blendet ein, danach Spielbuttons. Bei Rückkehr/reduzierter Bewegung sofort verfügbar. Kurzer mechanischer Klick für Menüaktionen, Ton je Gerät schaltbar.

Bewegung erklärt Auftritt/Handlung; kein ständiges Wackeln/Blinken/Schweben. Höchstens ein Auftritt je Ansicht. `prefers-reduced-motion` entfernt Dekoration/Übergänge und erhält Auswahl, Bestätigung, Ergebnis. Fehlende Grafik blockiert keinen Zugang; WebGL-Ersatz bleibt nutzbar.

## Spielflächen

Brett-/Roll-It-Up-Details: [3D-Spielansichten](docs/inselparty-3d.md). Größere Figuren, schmale Wege, flache Symbole mit Tiefenprüfung; keine Feldnummern auf Karten. Plus blau, Minus rot, Ereignis grün, Shop hellblau, identisch in 3D/2D/Legende/Vorschau. Aktive Figur gelb markieren; Kamera startet bei ihr, „Zur Figur“/„Ganze Insel/Schale“ setzen zurück.

Brettansicht eine Bildschirmhöhe; Spielerleiste unten, Ziel/Inventar und seltene Informationen in schließbaren Panels. Feldinfo verändert keinen Ausschnitt. Keine Minispielauswahl unter dem Brett. Inselparty behält ihre Farbwelt. Bauschale: Emaille/Messing/Hügel, Lilita/Lexend, Glas und Gold/Stein; oben Münzen/Set/Ziel, unten Entscheidung/Reihenfolge. Vorschau vor Bestätigung, Kauf kompakt, Feldwirkung einmal, Kamera während Zug stabil.

Schlussrunden gelb markieren; bis erstem Wurf tiefblaue ×2-Ansage, Würfeln erreichbar. Siegerehrung: drei Bonuszeilen mit goldenen/grauen Sternen, danach Konfetti/Sieg; reduzierte Bewegung zeigt alles sofort.

Match-Spiele teilen dunkles HUD mit gelbem Titel, eigenen Punkten/Ton, Zwischenstand und großer Spielfläche; eigene Themen je Spiel. Stick links, Aktionen rechts; bei Bomb Arena/Tank Trouble 132 px Steuerreserve und gelber Eigenmarker. Countdown/Ergebnis/Rückmeldung gemeinsam; keine Tastatur-/PC-Erweiterung. [Minispiel-Konzept](docs/minigames/konzept.md).

## Prüfung

Smartphone visuell/per Touch: schmale/kurze Displays, Querformat, lange Namen, Auswahl/Fehler, Fokus, reduzierte Bewegung, Offline-Zugriff. Prüfungen gemäß AGENTS.md; Start/Menüs in `home-screen.spec.ts`/`party-menus.spec.ts`, Rich’s Universe in eigenem Spec. Browseremulation ersetzt keine Android-/iPhone-Messung.
