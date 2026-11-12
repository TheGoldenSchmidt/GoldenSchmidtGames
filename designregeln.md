# Designregeln für GoldenSchmidtGames

Diese Regeln gelten bei jeder UI-Erweiterung und UI-Bearbeitung. Sie beschreiben
den Inselwelt-Stil, der die gesamte App tragen soll, und den Stand seiner Umsetzung.
Technische Vorgaben und Prüfabläufe stehen in [AGENTS.md](AGENTS.md).

## Richtung: die Inselwelt

GoldenSchmidtGames spielt auf einer schwebenden Insel: ein Abenteuer-Spielplatz für
die Freundesrunde, bunt, plastisch und sofort bedienbar. Vier Merkmale tragen den Stil:

1. **Welt statt Fläche.** Der Bildschirm ist ein Fenster in eine Landschaft. Hinter
   den Inhalten liegt ein Himmel von Nachtblau zu hellem Blau; Gipfel, Tannen und
   Blattwerk rahmen die Ränder, die Mitte bleibt frei für Inhalt und Bedienung.
2. **Material statt Farbe.** Jedes Bedienelement besteht aus einem Material mit
   fester Rolle: Gold, Amethyst, Stein, Holz, Glas oder Papier (siehe unten).
3. **Facetten.** Illustrationen sind flache Vielecke mit zwei bis vier Tönen je
   Material, Licht von links oben. Keine weichen Verläufe, keine Fotos, keine Emoji.
4. **Geschnitzte Tiefe.** Aktionen sind Tafeln mit abgeschlagenen Ecken, heller
   Oberkante, sichtbarer Seitenwand und dunkler Kontur. Beim Drücken sinken sie ein.

Blickfang ist pro Ansicht genau ein Motiv der Welt (auf dem Startbildschirm die
Insel mit dem Steinlogo). Alles andere bleibt ruhig; jede Ansicht zeigt ihre
wichtigste nächste Aktion.

### Stand der Umsetzung

| Bereich | Stand |
| --- | --- |
| Startbildschirm | Inselwelt umgesetzt und geprüft |
| Lokales Setup, Online-Menü, Lobby, Gastprofil, QR-Dialog | Noch im früheren Party-Stil (`.party-menu`, `--menu-*`); Umstellung geplant |
| Spielflächen, Live-HUDs, Minispiele | Eigene Gestaltung; Umstellung geplant, nur auf ausdrücklichen Auftrag |

Wer eine noch nicht umgestellte Ansicht bearbeitet, stellt sie entweder ganz auf die
Inselwelt um oder bleibt in ihrem bisherigen Stil. Beide Stile werden innerhalb
einer Ansicht nicht gemischt, und der Party-Stil erhält keine neuen Bausteine. Eine
Menüänderung darf Farben, Layout oder Interaktion einer Spielfläche nicht nebenbei
verändern. Bei beauftragten Spielansichten gilt zusätzlich der Skill
`game-ui-frontend`. Nach jeder Umstellung die Tabelle oben nachführen.

## Farben und Materialien

Alle Werte stehen als `--iw-*` in [inselwelt.css](src/styles/inselwelt.css). Diese
Variablen verwenden; keine zusätzlichen, fast identischen Farbreihen anlegen.

| Material | Fläche oben → unten | Kante / Seitenwand | Text darauf | Rolle |
| --- | --- | --- | --- | --- |
| Gold | `#fdc955` → `#eda43e` | `#ffe58a` / `#b4651f` | `#3d2412` | Hauptaktion einer Ansicht |
| Amethyst | `#c886f6` → `#a567e4` | `#ecb6fb` / `#5b2f9f` | `#1f0d45` | Gleichrangige zweite Wahl, Online |
| Stein | `#5d5272` → `#4a405e` | `#a6a2c4` / `#2b253f` | `#fff8ea` | Nebenaktionen, Werkzeuge, Fortsetzen |
| Holz | `#dfa468` | `#f4c88f` / `#9a5e34` | `#4a2a17` | Schilder: Motto, Abschnittstitel |
| Glas | `#1f1c54` mit 74 % Deckkraft | heller Rand, 30 % Weiß | `#fff8ea` | Status und kurze Hinweise über dem Himmel |
| Papier | `#fff8ea` | Kontur `#221b4f` | `#221b4f` | Formulare, Hilfetexte, lange Inhalte |

| Farbe | Wert | Rolle |
| --- | --- | --- |
| Himmel | `#272a6e` → `#4a47a6` → `#5f70d8` → `#7f9be8` | Hintergrund von oben nach unten |
| Abendrosa | `#d9b8ee` | Lichtschein rechts oben, Gipfel, Wolken |
| Tinte | `#221b4f` | Konturen der Tafeln und Chips |
| Gras | `#a9dc42`, `#6fbf35`, `#2f7a2e` | Natur, Blattwerk |
| Bereit | `#3fe6a0` | Online, Bereitschaft |
| Pink | `#ff7fc6` | Profilbild, Offline-Punkt, spielerische Akzente |
| Fehler | `#c8353e` | Fehlerrahmen und Fehlermeldungen |

Die genannten Textfarben erreichen auf ihrem Material mindestens 4,5:1 (Amethyst
unten 4,7:1, sonst 5,9:1 und mehr). Neue Kombinationen vor dem Einsatz prüfen.
Text steht nie direkt auf Himmel oder Landschaft, sondern auf einem Material.

Farben unterstützen Bedeutung, ersetzen sie aber nicht: Auswahl mit Rahmen und
Häkchen, Bereitschaft mit Text, Fehler mit konkreter Meldung kennzeichnen.
Deaktivierte Aktionen sind entsättigt und technisch deaktiviert. Spielfarben wie
Qwixx-Reihen, Würfelfarben und Kartenfarben bleiben semantisch unverändert.

## Schrift und Sprache

- **Lilita One** ist die Schauschrift: Logo, Holzschilder, Bildschirmtitel.
  **Lexend** ist die Bedienschrift: Buttons, Chips, Formulare, Fließtext (400 für
  Text, 600 für Bedienelemente, 900 für Tafel-Beschriftungen). Beide liegen als
  npm-Pakete im Projekt, werden mit der App ausgeliefert und offline gespeichert.
  Keine weiteren Schriften und keine Schriften von fremden Servern laden.
- Noch nicht umgestellte Ansichten behalten Trebuchet MS, bis sie umgestellt werden.
- Das Logo besteht aus Umrissen (`homeLogoPaths.ts`), damit es nie auf eine Schrift
  wartet: „Golden“ und „Schmidt“ in Gold, „Games“ in Silber, jeweils mit dunkler
  Kontur, Seitenwand und heller Oberkante.
- Großbuchstaben nur für die Hauptzeile einer Tafel und für Schildtexte, jeweils
  höchstens etwa 18 Zeichen. Unterzeilen, Hinweise und Formulare in normaler
  Schreibung. Der Quelltext bleibt normal geschrieben; die Großschreibung setzt CSS.
- Pro Ansicht eine klare Titelhierarchie. Kleine Hinweise nicht wie Überschriften
  behandeln.
- Kurz und direkt auf Deutsch schreiben. Aktionsnamen beschreiben die Handlung,
  etwa „Raum beitreten“. Dieselbe Aktion behält durch den Ablauf denselben Namen.
- Sichtbare Beschriftungen, zugängliche Namen und bestätigte Auswahl müssen
  übereinstimmen. Der Markenname bleibt `GoldenSchmidtGames`; `GSG` ist die Kurzform.

## Bausteine

| Baustein | Klasse | Verwendung |
| --- | --- | --- |
| Tafel | `.iw-slab` mit `.iw-slab__face`, Varianten `--gold`, `--violet`, `--stone` | Jede Aktion. Gold und Amethyst für große Zugänge, Stein kompakt für Nebenaktionen |
| Chip | `.iw-chip`, tippbar als `.iw-chip--light` | Status (dunkles Glas) und Profil (hell mit Tintenrand) |
| Inselszene | `HomeIsland`, `HomeBackdrop` in [HomeScene.tsx](src/components/HomeScene.tsx) | Blickfang und Kulisse des Startbildschirms |

Holzschild und Papierfläche gibt es bisher nur innerhalb des Startbildschirms (Motto
in der Inselgrafik, Installationshilfe). Als eigene Bausteine entstehen sie mit der
Umstellung der Menüs und werden dann hier eingetragen.

- Eine Tafel besteht aus Kontur (3 px Tinte), Seitenwand (7 px, Stein 4 px) und
  Fläche mit heller Oberkante. Die Ecken sind um 9–11 px abgeschlagen, je eine
  kleine Kerbe sitzt in Ober- und Unterkante. Darunter liegt ein harter Schatten.
  Die Form kommt aus `--slab-shape`; keine runden Ecken an Tafeln.
- Gedrückt sinkt die Fläche in die Seitenwand. Hover hebt sie um 1 px; Bedienung
  und Information dürfen nicht davon abhängen. Der Fokusring ist 3 px Papier mit
  3 px Abstand und bleibt auf Himmel und Material sichtbar.
- Pro Ansicht höchstens eine goldene Tafel. Amethyst steht nur neben Gold, wenn
  beide Wege gleichrangig sind (Startbildschirm: lokal und online). Alles Weitere
  ist Stein.
- Große Tafeln zeigen links ein Symbol, in der Mitte Haupt- und Unterzeile, rechts
  einen Pfeil in einem dunklen Achteck. Symbole sind einfarbig in der Textfarbe
  der Tafel, gefüllt oder mit 2,5–3 px Strich, ohne eigene Kachel dahinter.
- Runde Formen bleiben den Chips (Pille) vorbehalten. Papierflächen und Eingaben
  haben 12–16 px Radius und eine Tintenkontur.
- Eingaben haben sichtbare Labels. Fehlermeldungen benennen Problem und nächsten
  Schritt; normale Hinweise sehen nicht wie Fehler aus.
- Touch-Ziele mindestens 44 × 44 CSS-Pixel, Stein-Tafeln mindestens 48 px, große
  Tafeln mindestens 66 px hoch. Abstände verhindern versehentliche Nachbaraktionen.

## Illustration

- Landschaft und Requisiten sind Inline-SVG aus Vielecken ohne Kontur. Dunkle
  Konturen tragen nur Tafeln, Chips, Logo und Holzschild.
- Verläufe sind dem Himmel, Metallflächen der Schrift, Wasser und Lichtschein
  vorbehalten. Schatten sind eigene, dunklere Facetten.
- Material der Welt: Stein in warmem Grauviolett, Fels in Rotbraun mit violettem
  Schatten, Gras gelbgrün mit dunkler Kante, Holz honigfarben, Gold für Krone,
  Beschläge und Schatz. Requisiten stammen aus dem Spielabend: Würfel, Schwert,
  Schatztruhe, Fahne, Krone.
- Illustrationen sind Dekoration (`aria-hidden`), enthalten keine Information, die
  nur dort steht, und verdecken weder Text noch Aktion.
- Figuren: nur die [freigegebenen Figuren](docs/approved-character-design.md) und
  vorhandenen Modell- und Portraitzuordnungen verwenden. Pro Figurenwahl eine
  gemeinsame 3D-Vorschau; Listen und Auswahlbilder verwenden statische Portraits.
  Portraits dürfen nicht verzerrt oder durch Flex-Layouts beschnitten werden.

## Layout auf Handy und PC

Zuerst für Touch auf schmalen Handys gestalten. Ab 320 px Breite darf keine
Menüseite horizontal überlaufen. Lange Namen müssen umbrechen oder sinnvoll gekürzt
werden, ohne Aktionen oder Figurenbilder zu verdrängen.

Auf dem Handy Inhalte untereinander anordnen. Ab 700 px Breite im Querformat dürfen
zusammengehörige Bereiche nebeneinander stehen; hochkant bleibt die Handy-Anordnung
in einer mittigen Spalte. Die Kulisse füllt immer den ganzen Bildschirm. Abstände
in wiederkehrenden Größen halten; etwa 8, 16, 24 und 32 px sind Richtwerte.

Feste Startaktionen müssen den Inhalt freilassen: unteren Inhaltsabstand,
Safe Areas und Tastaturbedienung berücksichtigen. Dialoge passen in den sichtbaren
Bereich, können bei Bedarf innen scrollen und besitzen eine erreichbare
Schließen-Aktion. QR-Codes bleiben quadratisch, unverzerrt und mit weißem Rand.

## Bewegung

Bewegung erklärt einen Auftritt oder eine Aktion. Keine dauernden Wackel-, Blink-
oder Schwebeeffekte. Eine Ansicht hat höchstens einen Auftritt und ruht danach;
Aktionen sind von Anfang an bedienbar. Bei `prefers-reduced-motion` entfallen
dekorative Animationen und Übergänge; Bestätigung, Auswahl und Spielergebnis
bleiben gleich. Ohne WebGL bleiben Ersatzdarstellung und Menüaktionen nutzbar;
fehlende Grafik blockiert keinen Zugang.

## Startbildschirm

Umgesetzt in [HomeScreen.tsx](src/screens/HomeScreen.tsx) und
[home.css](src/styles/home.css).

- Aufbau von oben nach unten: Statuschip und Profilchip, die Insel, die goldene
  Tafel „Lokal spielen“, die Amethyst-Tafel „Online spielen“, darunter im freien
  Himmel die Stein-Tafeln „App installieren“ (nur solange nicht installiert) und
  „Updates prüfen“. Angebote zum Fortsetzen erscheinen als Stein-Tafeln unter den
  Spielmodi.
- Die Insel trägt das Steinlogo mit Krone, Fahne, Schwert im Stein, Würfel,
  Schatztruhe, Wasserfall und das Holzschild „Minispiele • Party • Gemeinsam“. Auf
  dem Handy ragt sie leicht über beide Seitenränder; die Tafeln überlappen ihre
  Felsspitzen.
- Auftritt in etwa anderthalb Sekunden: Die Insel steigt auf, das Logo setzt sich,
  Schwert, Würfel und Truhe erscheinen, zuletzt das Schild; die Truhe leuchtet einmal
  auf. Danach ruht die Seite.
- Der Startbildschirm ist genau eine Bildschirmhöhe groß und scrollt nicht. Fehlt
  Höhe, wird zuerst die Insel kleiner; Tafeln behalten ihre Mindestgröße. Die
  Installationshilfe öffnet sich als Papierfeld über der unteren Zeile, der
  Update-Status als Glaszeile darunter.
- Im Querformat ab 700 px steht die Insel links, die Spielmodi rechts.
- Er zeigt keine Figuren und lädt keine 3D-Szene.

## Spielflächen und Minispiele

Die 3D-Bretter von Inselparty und Roll It Up! stellen die Figuren in den
Vordergrund: größere Modelle, mehr Abstand auf gemeinsam belegten Feldern,
schmale Wege und flache Feldsymbole mit Tiefenprüfung. Auf den Karten stehen
keine Feldnummern: Münzgewinn ist blau mit Plus, Münzverlust rot mit Minus,
Ereignisse grün mit Ausrufezeichen und Shops hellblau mit Shopsymbol.
3D, 2D, Legende und Wegvorschau nutzen dieselbe Zuordnung. Die Ansicht startet bei
der aktiven Figur; ein gelber Bodenring kennzeichnet sie. Kameratasten stehen
außerhalb der Szene, „Zur Figur“ und „Ganze Insel/Schale“ setzen die Ansicht
zurück. Ein einzelner Button wechselt zwischen 3D und 2D. Die Spielerleiste steht
am unteren Kartenrand; Set, Trophäenziel und Inventar öffnen sich über halbtransparente
Seitenbuttons. Feldsuche und Legende liegen in einem schließbaren Panel.
Die normale mobile Brettansicht nutzt eine Bildschirmhöhe ohne Seitenscrollen;
längere Auswahlen dürfen innerhalb eines Panels scrollen. Beim Schließen kehrt
der Fokus zum Auslöser zurück. Minispiel-Auswahl und Regeltext stehen nicht mehr
unter dem laufenden Brett. Die bestehende Farbwelt der Spielansicht bleibt erhalten.

Match-Minispiele (`src/matches/`) teilen eine Bühne: oben ein dunkles HUD mit
gelbem Spieltitel, eigener Punktzahl und Tontaste, darunter ein Zwischenstand
in Spielerfarben, darunter die Canvas-Spielfläche bis zum unteren Rand (Bomb Arena
und Tank Trouble: WebGL-Szene in 2.5D, die Canvas bleibt Rückfall; unten bleiben
132 px für die Steuerelemente frei, die eigene Figur trägt einen gelben Marker). Jedes
Spiel hat eine eigene Themenwelt innerhalb der Fläche; Countdown, Rückmeldung,
Ergebnis und Steuerelemente sind gemeinsam. Die Bedienung ist ausschließlich
Touch: große Tippflächen, Stick links, Aktionstasten rechts, mindestens 44 px.
Reduzierte Bewegung entfernt Blitze, Pulsieren und Glättung, nicht die
Spielinformation. Gestaltung und Regeln stehen in [docs/minigames](docs/minigames/konzept.md).

## Umsetzung und Prüfung

Inselwelt-Ansichten bauen auf den Bausteinen aus `inselwelt.css` auf; Regeln, die
nur eine Ansicht betreffen, stehen in deren eigener CSS-Datei. Bis zur Umstellung
gilt für die übrigen Menüs: `.party-menu` mit den `--menu-*`-Variablen in
[partyMenus.css](src/styles/partyMenus.css), das Gastprofil über `.party-dialog`,
QR-Dialoge über `.pair-dialog`. Globale Selektoren und `!important` nicht als
Ersatz für klare Zuständigkeiten einsetzen. Spielregeln, Sitzungen und Transport
bleiben außerhalb der Gestaltung.

Vor dem Abschluss geänderte Ansichten auf Handy- und Desktopbreite visuell prüfen
(Inselparty, Roll It Up! und Minispiele nur auf Handybreite),
mit Touch beziehungsweise Maus und Tastatur bedienen sowie reduzierte Bewegung,
lange Namen, Auswahl- und Fehlerzustände berücksichtigen. Die passenden Prüfungen
gemäß [AGENTS.md](AGENTS.md#passende-prüfungen) ausführen. Für Startseite und Menüs
existieren `home-screen.spec.ts` und `party-menus.spec.ts` unter `tests/browser/`.
Browser-Emulation belegt keine Leistung auf einem echten Handy.

Neue Gestaltungsentscheidungen in diesem Dokument festhalten. Implementierte und
geprüfte Ansichten von bloß geplanten Erweiterungen unterscheiden.
