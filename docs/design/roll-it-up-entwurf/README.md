# Roll It Up! – Entwurf „Schaleninsel“

Entwurf vom 17. November 2026. **Richtung freigegeben und als „Die Bauschale“ in das Spiel integriert.**

Diese Dateien bewahren die ursprüngliche interaktive Vorschau. Die aktuelle
Umsetzung und Prüfgrenzen stehen in [3D-Spielansichten](../../inselparty-3d.md#roll-it-up-die-bauschale).

## Richtung

Eine begehbare Miniaturlandschaft in einer emaillierten Schale. Der Messingrand
bewahrt die Identität des Spiels; plastische Sammelorte, terrassierter Hügel und
die Bank geben der Welt erkennbare Bezugspunkte. Warmes Sonnenlicht, kühles
Fülllicht, matte Naturmaterialien und wenige glänzende Beschläge verbinden sie
mit den neuen Inselwelt-Menüs.

Die erste Idee mit sechs dauerhaften Stationsschildern wurde verworfen: Auf dem
Handy konkurrieren diese mit Figuren und Wegwahl. Im Spiel werden nur der
ausgewählte Ort und das Ziel beschriftet; die Übersicht zeigt alle Stationen.

Farben: Inselwelt-Tinte `#221b4f`, Papier `#fff8ea`, Gold `#ffd777`,
Himmel `#7f9be8`, Gras `#6fbf35`; die vorhandene Emaillefarbe `#23685e`
bleibt ein Material der Schale. Feldfarben und Symbole behalten ihre Bedeutung.
Lilita One für kurze Aktionstitel, Lexend für Informationen und Bedienung.

## Aufbau auf dem Smartphone

```text
┌────────────────────────────────┐
│ Roll It Up!       Runde   Menü │
│ Dein Set 3/6        18 Münzen  │
│ Pape fehlt · 3 Münzen         │
│                                │
│         Bank / Jayspot         │
│                                │
│       Welt, Weg, Figuren        │
│                                │
│                  Übersicht      │
│ Du bist dran · nächste Aufgabe │
│           Hauptaktion          │
│ Anna       Ben       Clara     │
└────────────────────────────────┘
```

Text und Handlungen links ausrichten; Feldsymbole und kurze Tasten zentrieren.
Die Kartendarstellung erhält den größten Anteil der Bildschirmhöhe. Die
Aktionsfläche wächst nur während einer Entscheidung. Sammlung, Spielstand,
Inventar, Regeln und Verlauf sind aufrufbare Flächen. Ein wichtiges nächstes Ziel
steht im HUD; ein Vorschlag lässt sich wechseln und entscheidet keinen Zug.

## Informationsführung

- Vor dem Würfeln: eigene Münzen, Setfortschritt, fehlendes Utensil und Preis.
- Bei einer Gabelung: beide erlaubten Wege mit Station, Entfernung und
  vorhersehbarer Landung. Auswahl hebt den Weg hervor, ein eigener Knopf bestätigt.
- Beim Kauf: Preis, verbleibende Münzen und Setfortschritt vor der Bestätigung.
- Nach dem Kauf: kurze Bestätigung, aktualisierter Fortschritt; kein zusätzlicher
  Bestätigungsdialog. Ein verbleibender Weg wird anschließend fortgesetzt.
- Ohne Geld: konkrete Differenz; bereits besessene Utensilien als gesammelt.
- Jayspot: Voraussetzung „Alle 6 Utensilien“; beide Zugänge bleiben nach den
  bestehenden Regeln gesperrt. Bei vollem Set wird der Weg zum Ziel hervorgehoben.
- Fremder Zug: klarer Spielername; eigene Sammlung und Kartenansicht bleiben
  erreichbar. Netzwerkstatus darf eine scheinbar erfolgreiche Aktion nie ersetzen.

Der klickbare Entwurf verwendet einen festen Beispielzug ab Feld 8 mit einer 4:
Außenweg `9 → 10 → 11 → 12` (Pape), Abkürzung `30 → 31 → 12 → 13`.
Startinventar: Grinder und Weedbud I/II, 18 Münzen. Beide Wege passieren Pape;
nach dem Kauf setzt die Abkürzung noch einen Schritt fort. Keine neue Spielregel.

## Umsetzung nach Richtungsfreigabe

1. Roll-it-up-Welt und Kamera im vorhandenen imperativen Three.js-System.
2. Eigenes Roll-it-up-HUD; gemeinsame Inselparty-Oberflächen nur bewusst ändern.
3. Informationsmodell aus `shared/partyBoard.ts` und dem autoritativen Zustand;
   keine kopierten Regeln in Transport, Kamera oder HUD.
4. 2D-Rückfall mit derselben Topologie, Symbolik, Auswahl und Information.
5. Touch, kurze Displays, lange Namen, alle Spielerzahlen, reduzierte Bewegung,
   fehlendes Geld, Wiederverbindung und Spielende prüfen. Animationen verändern
   kein Ergebnis; Kameraeingaben unter Dialogen sperren.

Für die endgültige Laufzeit: Geometrien/Materialien teilen, wiederholte Requisiten
instanzieren, Texturen und Schatten budgetieren, dynamische Auflösung nutzen.
Die statischen Entwurfsrenderings belegen **keine** Leistung auf einem echten Handy.

## Referenzen

- [Xbox: Objective clarity](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/109): Ziele, Voraussetzungen und Fortschritt jederzeit nachvollziehbar.
- [NN/g: Progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): Entscheidungsrelevantes direkt, seltene Details auf Abruf.
- Verbindliche Projektbasis: `designregeln.md`, `shared/partyBoard.ts`,
  `shared/party.ts`, `src/three/rollingTray.ts`, `src/components/PartyBoard.tsx`.

## Dateien

`world.ts` und `scene.html` erzeugen ausschließlich Entwurfsbilder mit Three.js.
`render.mjs` rendert sie lokal; `hud.html` ist die interaktive Entwurfsvorlage.
`pack.mjs <absoluter HTML-Zielpfad>` bettet Bilder und vorhandene Schriften ein.
`check-preview.mjs <absoluter Vorschaupfad>` prüft die mit dem Visualize-Renderer
verpackte Vorschau. `PLAYWRIGHT_CHROMIUM_PATH` kann den vorhandenen Browser wählen.
Diese Dateien sind nicht in den Spielclient eingebunden. Die Welt ist in der
klickbaren Vorschau vorgerendert; Drehen, freier Zoom und Laufanimationen sind
Teil der separaten Spielintegration.

## Prüfstand des ursprünglichen Entwurfs

- Ziel: Weltgestaltung und Informationsführung zur Abstimmung zeigen.
- Branch: `codex/roll-it-up-design-entwurf`; Basis-Commit `483da1a`.
  Die Entwurfsdateien sind lokal und noch nicht committet.
- Bestehender Spielclient: `npm run build`, `npm run test:screens` und
  `tests/browser/roll-it-up.spec.ts` im Projekt `phone` bestanden.
- Entwurf: Touch-Durchläufe mit 390 px (normale Bewegung) und 320 px
  (reduzierte Bewegung) bestanden. Beide Wege, Kauf und Überspringen,
  Münzbestand, Geschenk, Sammlung, Fokus-Rückkehr, lange Namen,
  Touch-Zielgrößen und Überlauf geprüft. Weltansicht, Kartenübersicht,
  Wegwahl und Kauf zusätzlich auf Screenshots angesehen.
- Die Übersicht blendet die Zugentscheidung aus, bis „Zur Figur“ gewählt wird;
  alle sechs Stationen und der Jayspot bleiben sichtbar. Die Auswahl ändert
  weder den Beispielzug noch den Spielstand.
- Die anschließende Spielintegration ist auf `codex/roll-it-up-bauschale` umgesetzt.
  Die Vorschau bleibt vom Live-Spiel getrennt; echte Handy-Leistung ist weiter offen.
- Bestehende fremde Dateien unter `.codex-attachments/` wurden nicht verändert.
