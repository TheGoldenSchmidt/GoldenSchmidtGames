# Designregeln für GoldenSchmidtGames

Diese Regeln gelten bei jeder UI-Erweiterung und UI-Bearbeitung. Sie beschreiben
den Inselwelt-Stil, der die gesamte App tragen soll, und den Stand seiner Umsetzung.
Technische Vorgaben und Prüfabläufe stehen in [AGENTS.md](AGENTS.md).

## Freigegebene Inselwelt-Menüs

Die neu gebauten Menüs verwenden lokal gespeicherte Illustrationen und gerenderte Buttonflächen aus `src/assets/expedition/`. Auf dem Startbildschirm trägt ein steinernes Wappen den Titel; darunter stehen die Spielzugänge in Gold und Amethyst. Der Status, die Tonwahl und das Gastprofil liegen über der Illustration. Beim Start fallen Steintafel, GOLDEN, SCHMIDT, GAMES und Krone in dieser Reihenfolge von oben an ihren Platz. Anschließend erscheint „Play like the GoldenSchmidt - Be like the GoldenSchmidt“ allein durch Einblenden. Ein einzelner warmer Reflex zieht nach der Landung über die Krone. Das Motto steht als kursives, von TheGoldenSchmidt signiertes zweizeiliges Zitat zwischen goldenen Anführungszeichen. Sobald es eingeblendet ist, erscheinen die Startmenü-Buttons. Bei reduzierter Bewegung und bei der Rückkehr ins Menü sind sie sofort verfügbar. „Lokal spielen“ und „Raum erstellen“ verwenden dieselbe honigfarbene Citrinfläche mit geschliffenen Kanten. In Untermenüs rahmen eine Landschaft und eine Krone den Titel. Lokale Spielwahl und Online-Raumerstellung verwenden dieselben illustrierten Spielkarten. Beim Erstellen und Beitreten lässt sich die eigene Figur in derselben aufklappbaren Galerie über Porträtkarten auswählen. Die Lobby verwendet dieselben Spiel- und Figurengalerien. Abgesetzt unter „Ich bin bereit“ stehen „Party verlassen“ (heller Stein) und für den Host „Party für alle beenden“ (dunkler Stein, nie Gold). Das Beenden bestätigt der Host auf Papier. Im lokalen Spiel hat jeder Platz ein Namensfeld und eine eigene Porträtgalerie mit 3D-Vorschau. Die geöffnete Figurengalerie der Lobby zeigt die drehbare 3D-Vorschau. Fragezeichen an den Spielkacheln öffnen die Regeln. In den Spieleinstellungen stehen ausschließlich Optionen für die jeweilige Partie. Helles Papier trägt längere Eingaben und Listen.

Die folgenden Beschreibungen der gerenderten Ebenen, alten Button-Sprites, Renderbefehle und Auftrittsreihenfolge dokumentieren den früheren Vergleichsstand. Die freigegebenen Menüs verwenden `HomeScreen.tsx`, `AdventureChoice.tsx`, `home.css` und `menus.css`. Bewegung klingt nach dem Einstieg aus. Ein kurzer mechanischer Klick bestätigt die Betätigung von Menübuttons. Tonwahl, Fokus, reduzierte Bewegung und Offline-Zugriff gehören zur Prüfung.

## Richtung: die Inselwelt

GoldenSchmidtGames spielt auf einer schwebenden Insel: ein Abenteuer-Spielplatz für
die Freundesrunde, bunt, plastisch und sofort bedienbar. Vier Merkmale tragen den Stil:

1. **Welt statt Fläche.** Der Bildschirm ist ein Fenster in eine Landschaft. Hinter
   den Inhalten liegt ein Himmel von Nachtblau zu hellem Blau; Gipfel, Tannen und
   Blattwerk rahmen die Ränder, die Mitte bleibt frei für Inhalt und Bedienung.
2. **Material statt Farbe.** Jedes Bedienelement besteht aus einem Material mit
   fester Rolle: Gold, Amethyst, Stein, Holz, Glas oder Papier (siehe unten).
3. **Beleuchtete Low-Poly-Körper.** Grafik ist echte 3D-Geometrie aus wenigen
   Facetten, gerendert mit warmer Sonne von links vorn, kühlem Himmels- und Kantenlicht,
   weichen Schatten und Umgebungsverdeckung. Oberflächen haben eine leichte Körnung.
   Keine flachen Vektorflächen als Ersatz, keine Fotos, keine Emoji.
4. **Geschnitzte Tiefe.** Aktionen sind Tafeln mit abgeschlagenen Ecken, heller
   Oberkante, sichtbarer Seitenwand und dunkler Kontur. Beim Drücken sinken sie ein.

Blickfang ist pro Ansicht genau ein Motiv der Welt (auf dem Startbildschirm die
Insel mit dem Steinlogo). Alles andere bleibt ruhig; jede Ansicht zeigt ihre
wichtigste nächste Aktion.

### Stand der Umsetzung

| Bereich | Stand |
| --- | --- |
| Startbildschirm | Inselwelt als gerenderte 3D-Szene umgesetzt und geprüft ([Renderpipeline](docs/startscreen-render.md)) |
| Lokales Setup, Online-Menü, Lobby, Wiederverbindung, Gastprofil, QR-Dialog | Inselwelt umgesetzt und auf dem Handy geprüft (`.iw-menu`, `.iw-dialog`, [menus.css](src/styles/menus.css)) |
| Menüs laufender Minispiel-Wettbewerbe (Einsatz, Ergebnis) | Noch im früheren Party-Stil (`.party-menu`, `--menu-*` in [partyMenus.css](src/styles/partyMenus.css)) |
| Spielflächen, Live-HUDs, Minispiele | Eigene Gestaltung; Umstellung geplant, nur auf ausdrücklichen Auftrag |

Wer eine noch nicht umgestellte Ansicht bearbeitet, stellt sie entweder ganz auf die
Inselwelt um oder bleibt in ihrem bisherigen Stil. Beide Stile werden innerhalb
einer Ansicht nicht gemischt, und der Party-Stil erhält keine neuen Bausteine. Eine
Menüänderung darf Farben, Layout oder Interaktion einer Spielfläche nicht nebenbei
verändern. Bei beauftragten Spielansichten gilt zusätzlich der Skill
`game-ui-frontend`. Nach jeder Umstellung die Tabelle oben nachführen.

## Farben und Materialien

Farben der Oberfläche stehen als `--iw-*` in [inselwelt.css](src/styles/inselwelt.css),
Materialfarben der gerenderten Grafik in `scripts/home-render/kit.ts` (Welt) und
`sprites.ts` (Tafeln). Diese Werte verwenden; keine fast identischen Farbreihen anlegen.
Die Tabelle nennt die Ausgangsfarben; Licht und Körnung verändern sie im Bild.

| Material | Fläche oben → unten | Kante / Seitenwand | Text darauf | Rolle |
| --- | --- | --- | --- | --- |
| Gold | `#ffd777` → `#f1aa4c` | `#fff0b4` / `#a95a24` | `#3d2412` | Hauptaktion einer Ansicht |
| Amethyst | `#dcaefc` → `#c18ef2` | `#f6d6ff` / `#55309a` | `#170834` | Gleichrangige zweite Wahl, Online |
| Stein | `#7c7092` → `#605575` | `#c2bbd8` / `#2e2742` | `#fff8ea` | Nebenaktionen, Werkzeuge, Fortsetzen |
| Holz | `#dea468` | Fase heller, Kontur `#4a2a17` | `#43240f` | Schilder: Motto, Abschnittstitel |
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

Die Textfarben erreichen auf den gerenderten Tafeln überall mindestens 4,5:1 (gemessen
auf den Pixeln der Sprites: Gold 4,7–6,3:1, Amethyst 4,5–6,1:1). Nach jedem Neurendern
und bei neuen Kombinationen erneut messen.
Text steht nie direkt auf Himmel oder Landschaft, sondern auf einem Material.

Farben unterstützen Bedeutung, ersetzen sie aber nicht: Auswahl mit Rahmen und
Häkchen, Bereitschaft mit Text, Fehler mit konkreter Meldung kennzeichnen.
Deaktivierte Aktionen sind entsättigt und technisch deaktiviert. Spielfarben wie
Qwixx-Reihen, Würfelfarben und Kartenfarben bleiben semantisch unverändert.

## Schrift und Sprache

- **Lilita One** ist die Schauschrift: Logo, Holzschilder, Bildschirmtitel und
  Hauptzeilen großer Tafeln. **Lexend** ist die Bedienschrift: Unterzeilen, kleine
  Tafeln, Chips, Formulare, Fließtext (400–500 für Text, 600 für Bedienelemente). Beide liegen als
  npm-Pakete im Projekt, werden mit der App ausgeliefert und offline gespeichert.
  Keine weiteren Schriften und keine Schriften von fremden Servern laden.
- Noch nicht umgestellte Ansichten behalten Trebuchet MS, bis sie umgestellt werden.
- Das Logo ist extrudierte 3D-Schrift aus den Umrissen in
  `scripts/home-render/logoPaths.ts`: „Golden“ und „Schmidt“ in Gold, „Games“ in Silber,
  mit Fase, metallischem Glanz und dunkler Kontur. Es erscheint als Bild mit dem
  Alternativtext „GoldenSchmidtGames“.
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
| Tafel | `.iw-slab` mit `.iw-slab__face`, Varianten `--gold`, `--violet`, `--stone` | Jede Aktion. Gold und Amethyst für große Zugänge, Stein kompakt für Nebenaktionen. Gerendertes Sprite als 9-Slice |
| Chip | `.iw-chip`, tippbar als `.iw-chip--light` | Status (dunkles Glas) und Profil (hell mit Tintenrand) |
| Holzschild | `.iw-plank` | Bildschirmtitel und Kartentitel. Gerendertes Brett als 9-Slice, dunkle Lilita-Schrift |
| Pergamentkarte | `.iw-card` mit Titel `.iw-plank.iw-card__title` und `.iw-card__lead` | Listen, Formulare, Einstellungen. Der Titel sitzt als Holzschild auf der Oberkante |
| Glashinweis | `.iw-note` | Kurze Hinweise direkt auf dem Himmel |
| Welt | `IslandWorld` | Gerenderter Himmel mit Vordergrund-Ecken hinter Startbildschirm und Menüs |
| Gerenderte Ebenen | `src/assets/home/*.webp`, Quelle `scripts/home-render/` | Insel mit Logo, Himmel hoch und quer, Vordergrund-Ecken, Tafeln, Holzschild |

- Eine Tafel ist ein gerenderter Steinblock: ebene Fläche mit Farbverlauf und feinen
  Haarrissen, ringsum eine unregelmäßig abgeschlagene Fase (oben hell, unten dunkel),
  darunter ein dunklerer Sockel als sichtbare Dicke, außen eine dunkle Kante und ein
  weicher Schlagschatten. Form und Farbe nur in `sprites.ts` ändern und neu rendern,
  nicht per CSS nachbauen; keine runden Ecken an Tafeln.
- In Inselwelt-Menüs und -Dialogen werden die vorhandenen `.button`-Klassen
  automatisch zu Tafeln: `--primary` Gold, `--secondary` Amethyst, `--ghost` Stein.
  Die Geräte-Kopplung ist eine Nebenaufgabe und nutzt Stein.
- Gedrückt wechselt das Sprite zu einer in die Seitenwand gesunkenen Fläche, der Inhalt
  sinkt mit. Hover hellt leicht auf; Bedienung und Information dürfen nicht davon abhängen. Der Fokusring ist 3 px Papier mit
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
- Touch-Ziele mindestens 44 × 44 CSS-Pixel, Stein-Tafeln mindestens 52 px, große
  Tafeln mindestens 70 px hoch. Abstände verhindern versehentliche Nachbaraktionen.

## Illustration

- Landschaft, Requisiten und Tafeln entstehen als three.js-Szene in
  `scripts/home-render/` und werden mit `npm run render:home` zu WebP-Bildern gerendert
  (Details in der [Renderpipeline](docs/startscreen-render.md)). Die App lädt nur die
  Bilder, keine Live-3D-Szene.
- Licht und Schatten entstehen beim Rendern, nicht durch gemalte Facetten. Dunkle
  Konturen tragen nur Tafeln, Chips, Logo und Holzschild.
- Material der Welt: Stein braungrau mit Moos auf Oberseiten, Fels braun, Gras
  gelbgrün mit dunkler Kante und Erdschicht, Holz honigfarben mit Maserung, Gold
  metallisch für Schrift, Krone, Beschläge und Schatz. Requisiten stammen aus dem
  Spielabend: Würfel, Schwert, Schatztruhe, Fahne, Krone.
- Neue Grafik wird prozedural im Projekt modelliert. Fremde Modelle nur mit geprüfter
  Lizenz und Eintrag in der Renderpipeline-Dokumentation.
- Illustrationen sind Dekoration (`aria-hidden` oder leerer Alternativtext), enthalten
  keine Information, die nur dort steht, und verdecken weder Text noch Aktion.
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

Umgesetzt in [HomeScreen.tsx](src/screens/HomeScreen.tsx),
[home.css](src/styles/home.css) und der [Renderpipeline](docs/startscreen-render.md);
Vorlage ist die [Referenz](docs/design/startscreen-referenz.webp).

- Aufbau von oben nach unten: Statuschip und Profilchip, die Insel, die goldene
  Tafel „Lokal spielen“, die Amethyst-Tafel „Online spielen“, darunter im freien
  Himmel die Stein-Tafeln „App installieren“ (nur solange nicht installiert) und
  „Updates prüfen“. Angebote zum Fortsetzen erscheinen als Stein-Tafeln unter den
  Spielmodi.
- Ebenen von hinten nach vorn: gerenderter Himmel mit Landschaft (eigenes Bild für Hoch-
  und Querformat), Vordergrund-Büsche in den unteren Ecken, die Insel mit Steinlogo, Krone,
  Fahne, Schwert im Stein, Würfel, leuchtender Schatztruhe, Wasserfall und dem Holzschild
  „Play like The GoldenSchmidt – Be like The GoldenSchmidt“ (zweizeilig), darüber die Bedienelemente. Auf dem Handy ragt die
  Insel über beide Seitenränder; die Tafeln überlappen ihre Felsspitzen.
- Auftritt in etwa zwei Sekunden: Zuerst fliegt der Steinrahmen ein, dann erscheint die Insel,
  danach fliegen „Golden“, „Schmidt“ und „Games“ nacheinander ein. Danach ruht die Seite.
  Die Schrift steht vor dem Steinrahmen und wird von ihm nicht verdeckt.
- Der Startbildschirm ist genau eine Bildschirmhöhe groß und scrollt nicht. Fehlt
  Höhe, wird zuerst die Insel kleiner; Tafeln behalten ihre Mindestgröße. Die
  Installationshilfe öffnet sich als Papierfeld über der unteren Zeile, der
  Update-Status als Glaszeile darunter.
- Im Querformat ab 700 px steht die Insel links, die Spielmodi rechts.
- Er zeigt keine Figuren und lädt keine Live-3D-Szene. Bis die Bilder geladen sind,
  steht ein CSS-Himmelsverlauf dahinter.
- `npm run compare:home` stellt den Startbildschirm der Referenz gegenüber.

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
nur eine Ansicht betreffen, stehen in deren eigener CSS-Datei. Menüs vor dem Spiel
tragen `.iw-menu`, setzen `IslandWorld` und `ScreenHeader` ein und gruppieren Inhalte
in Pergamentkarten ([menus.css](src/styles/menus.css)); Dialoge tragen `.iw-dialog`.
Die Menüs laufender Minispiel-Wettbewerbe nutzen bis zu ihrer Umstellung weiter
`.party-menu` mit den `--menu-*`-Variablen in [partyMenus.css](src/styles/partyMenus.css). Globale Selektoren und `!important` nicht als
Ersatz für klare Zuständigkeiten einsetzen. Spielregeln, Sitzungen und Transport
bleiben außerhalb der Gestaltung.

Vor dem Abschluss geänderte Ansichten auf Handybreite visuell prüfen und mit
Touch bedienen (PC-Prüfungen ruhen vorerst) sowie reduzierte Bewegung,
lange Namen, Auswahl- und Fehlerzustände berücksichtigen. Die passenden Prüfungen
gemäß [AGENTS.md](AGENTS.md#passende-prüfungen) ausführen. Für Startseite und Menüs
existieren `home-screen.spec.ts` und `party-menus.spec.ts` unter `tests/browser/`.
Browser-Emulation belegt keine Leistung auf einem echten Handy.

Neue Gestaltungsentscheidungen in diesem Dokument festhalten. Implementierte und
geprüfte Ansichten von bloß geplanten Erweiterungen unterscheiden.

Im Online-Einstieg zuerst Erstellen oder Beitreten wählen. Eine kompakte Figurenliste begleitet beide Wege. QR und Raumcode sind Beitrittsarten. Lokale Bot-Partien stehen neben den spielbaren Titeln im lokalen Menü.
