# Designregeln für GoldenSchmidtGames

Diese Regeln gelten bei jeder UI-Erweiterung und UI-Bearbeitung. Sie beschreiben
den umgesetzten Party-Stil und den Gestaltungsrahmen für weitere Änderungen.
Technische Vorgaben und Prüfabläufe stehen in [AGENTS.md](AGENTS.md).

## Richtung und Geltungsbereich

GoldenSchmidtGames ist ein Spieleabend mit Freunden: bunt, frech, einladend.
Kräftige Schrift, klare Konturen und fühlbare Spielbuttons tragen den Stil.
Der Schriftzug oder die Figurenbühne bilden den Blickfang; die Bedienung bleibt
ruhig und eindeutig. Jede Ansicht soll ihre wichtigste nächste Aktion zeigen.

Der Party-Stil ist im Startbildschirm, lokalen Setup, Online-Menü, in der Lobby,
im Gastprofil und im QR-Dialog umgesetzt. Bestehende Spielflächen und Live-HUDs
behalten ihre eigene Gestaltung. Eine Menüänderung darf deren Farben, Layout
oder Interaktion nicht nebenbei verändern. Bei ausdrücklich beauftragten
Spielansichten gilt zusätzlich der Skill `game-ui-frontend`.

## Farbwelt

| Farbe | Wert | Rolle |
| --- | --- | --- |
| Violett | `#6544e8` | Kopfbereiche und sekundäre Aktionen |
| Gelb | `#ffe44e` | Hauptaktionen und bestätigte Auswahl |
| Pink | `#ff86c8` | Spielerische Akzente; Online-Einstieg auf der Startseite |
| Türkis | `#57e4cb` | Figurenbühnen und Bereitschaft |
| Dunkles Violett | `#24133f` | Text, Konturen und harte Schatten |
| Papier | `#fff9ed` | Formulare und ruhige Inhaltsflächen |
| Helles Lila | `#efe9ff` | Menü-Hintergrund |
| Gedämpftes Violett | `#635374` | Ergänzende Texte auf hellen Flächen |

Vorhandene CSS-Variablen verwenden: `--home-*` in
[home.css](src/styles/home.css), `--menu-*` in
[partyMenus.css](src/styles/partyMenus.css). Keine zusätzlichen, fast identischen
Farbreihen für neue Menüs anlegen. Text steht dunkel auf Gelb, Pink, Türkis oder
Papier und hell auf Violett. Kontrast bei neuen Kombinationen prüfen.

Farben unterstützen Bedeutung, ersetzen sie aber nicht: Auswahl mit Rahmen und
Häkchen, Bereitschaft mit Text, Fehler mit konkreter Meldung kennzeichnen.
Deaktivierte Aktionen sind sichtbar unterscheidbar und technisch deaktiviert.
Spielfarben wie Qwixx-Reihen, Würfelfarben und Kartenfarben bleiben semantisch
unverändert. Fehler verwenden die vorhandene rote Fehlerdarstellung.

## Schrift und Sprache

- Trebuchet MS mit den vorhandenen System-Fallbacks verwenden. Keine zusätzlichen
  Webfonts oder Schriftfamilien nur für einzelne Menüs einführen.
- Logo und Menü-Titel dürfen fett, kursiv, eng gesetzt und mit dunkler Kontur
  gestaltet sein. Fließtext, Formulare und Hinweise bleiben ungedreht und gut lesbar.
- Pro Ansicht eine klare Titelhierarchie aufbauen. Kleine Hinweise nicht wie
  Überschriften behandeln; lange Texte nicht in dekorative Großbuchstaben setzen.
- Kurz und direkt auf Deutsch schreiben. Aktionsnamen beschreiben die Handlung,
  etwa „Raum beitreten“. Dieselbe Aktion behält durch den Ablauf denselben Namen.
- Sichtbare Beschriftungen, zugängliche Namen und bestätigte Auswahl müssen
  übereinstimmen. Der Markenname bleibt `GoldenSchmidtGames`; `GSG` ist die Kurzform.

## Flächen, Bedienelemente und Zustände

- Konturen sind überwiegend 2 px stark. Buttons erhalten einen dunklen, harten
  Schatten von etwa 3–5 px; beim Drücken sinken sie kurz in diesen Schatten ein.
- Radien richten sich nach der Rolle: etwa 11–14 px für Eingaben und Buttons,
  15–23 px für Gruppen und größere Auswahlflächen. Vorhandene Klassen wiederverwenden.
- Gelbe Hauptaktionen führen, violette Nebenaktionen ergänzen. Eine Ansicht nicht
  mit mehreren gleich stark hervorgehobenen Handlungsgruppen überladen.
- Auswahl, Fokus, Hover, gedrückt, deaktiviert und Fehler bewusst gestalten.
  Fokus muss auch auf violetten Flächen sichtbar bleiben. Hover ist Zusatzfeedback;
  Bedienung und Informationen dürfen nicht davon abhängen.
- Eingaben haben sichtbare Labels. Fehlermeldungen benennen Problem und nächsten
  Schritt. Normale Hinweise dürfen nicht wie Fehlermeldungen aussehen.
- Touch-Ziele auf mindestens 44 × 44 CSS-Pixel auslegen, Hauptbuttons mindestens
  50 px hoch. Abstände verhindern versehentliche Nachbaraktionen.
- Kleine Schrägstellungen gehören zu Logo und Spielsymbolen, nicht zu Formularen,
  Spielerlisten oder dichten Auswahlrastern. Punktmuster und Sterne sparsam einsetzen.

## Layout auf Handy und PC

Zuerst für Touch auf schmalen Handys gestalten. Ab 320 px Breite darf die
Menüseite nicht horizontal überlaufen. Lange Namen müssen umbrechen oder sinnvoll
gekürzt werden, ohne Aktionen oder Figurenbilder zu verdrängen.

Auf dem Handy Inhalte untereinander anordnen. Auf dem PC dürfen zusammengehörige
Bereiche nebeneinander stehen, etwa Spiele links und Spieler rechts im lokalen
Setup. Bestehende Breakpoints und Maximalbreiten als Ausgangspunkt nutzen.
Abstände in wiederkehrenden Größen halten; etwa 8, 16, 24 und 32 px sind Richtwerte.

Feste Startaktionen müssen den Inhalt freilassen: unteren Inhaltsabstand,
Safe Areas und Tastaturbedienung berücksichtigen. Dialoge passen in den sichtbaren
Bereich, können bei Bedarf innen scrollen und besitzen eine erreichbare
Schließen-Aktion. QR-Codes bleiben quadratisch, unverzerrt und mit weißem Rand.

## Figuren und Bewegung

Nur die [freigegebenen Figuren](docs/approved-character-design.md) und vorhandenen
Modell- und Portraitzuordnungen verwenden. Pro Figurenwahl eine gemeinsame
3D-Vorschau einsetzen; Listen und Auswahlbilder verwenden statische Portraits.
Portraits dürfen nicht verzerrt oder durch Flex-Layouts beschnitten werden.

Bewegung erklärt einen Auftritt oder eine Aktion. Keine dauernden Wackel-, Blink-
oder Schwebeeffekte über die gesamte Oberfläche verteilen. Der Startbildschirm
hat eine kurze Begrüßung und wird danach ruhig; Spielzugänge sind sofort bedienbar.
Bei `prefers-reduced-motion` entfallen dekorative Animationen und Übergänge.
Bestätigung, Auswahl und Spielergebnis bleiben gleich. Ohne WebGL bleiben
Ersatzdarstellung und Menüaktionen nutzbar; fehlende Grafik blockiert keinen Zugang.

## Umsetzung und Prüfung

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
in Spielerfarben, darunter die Canvas-Spielfläche bis zum unteren Rand (Bomb Arena:
WebGL-Szene in 2.5D, die Canvas bleibt Rückfall; der untere Streifen bleibt den
Steuerelementen). Jedes
Spiel hat eine eigene Themenwelt innerhalb der Fläche; Countdown, Rückmeldung,
Ergebnis und Steuerelemente sind gemeinsam. Die Bedienung ist ausschließlich
Touch: große Tippflächen, Stick links, Aktionstasten rechts, mindestens 44 px.
Reduzierte Bewegung entfernt Blitze, Pulsieren und Glättung, nicht die
Spielinformation. Gestaltung und Regeln stehen in [docs/minigames](docs/minigames/konzept.md).

Menüs über `.party-menu`, das Gastprofil über `.party-dialog` und QR-Dialoge über
`.pair-dialog` gestalten. Neue Menüregeln in `partyMenus.css` einordnen und die
vorhandenen Komponenten für Header, Buttons, Figurenwahl und Eingaben nutzen.
Globale Selektoren und `!important` nicht als Ersatz für klare Zuständigkeiten
einsetzen. Spielregeln, Sitzungen und Transport bleiben außerhalb der Gestaltung.

Vor dem Abschluss geänderte Ansichten auf Handy- und Desktopbreite visuell prüfen
(Inselparty, Roll It Up! und Minispiele nur auf Handybreite),
mit Touch beziehungsweise Maus und Tastatur bedienen sowie reduzierte Bewegung,
lange Namen, Auswahl- und Fehlerzustände berücksichtigen. Die passenden Prüfungen
gemäß [AGENTS.md](AGENTS.md#passende-prüfungen) ausführen. Für Startseite und Menüs
existieren `home-screen.spec.ts` und `party-menus.spec.ts` unter `tests/browser/`.
Browser-Emulation belegt keine Leistung auf einem echten Handy.

Neue Gestaltungsentscheidungen in diesem Dokument festhalten. Implementierte und
geprüfte Ansichten von bloß geplanten Erweiterungen unterscheiden.
