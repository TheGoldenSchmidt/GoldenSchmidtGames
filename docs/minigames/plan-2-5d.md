# Plan: Bomb Arena in 2.5D

Stand: Nov. 2026 · Status: **geplant**, noch nichts umgesetzt.
Ziel: Bomb Arena bekommt eine echte 3D-Darstellung mit schräg geneigter Kamera
und den freigegebenen Figuren. Regeln, Wertung und Netzwerk bleiben unverändert.

## Entscheidung: Bomb Arena statt Tank Trouble

| Kriterium | Bomb Arena | Tank Trouble |
| --- | --- | --- |
| Passt zu 2.5D | Raster aus Würfeln (Mauern, Kisten) – klassische Schrägansicht, Höhe hilft beim Lesen | Dünne Wände (0,09) und kleine Kugeln (0,09) werden in Schrägansicht schwerer lesbar; Wände verdecken Abpraller |
| Freigegebene Figuren | Spielfiguren laufen selbst über das Feld; Lauf-, Treffer-, Angriffs- und Niederlage-Animation vorhanden | Panzer statt Figuren; Figur nur als Dekoration im Turm |
| Spielgefühl | Explosionen, Kettenreaktionen, zerberstende Kisten, einstürzende Arena profitieren stark von Tiefe, Licht und Wackeln | Gewinn vor allem optisch; Zielen mit Abprallern wird durch Perspektive eher schwieriger |
| Bewegung | Feldweise mit Interpolation – Darstellung leicht, Latenz unkritisch | Freie Bewegung und schnelle Geschosse – mehr Vorhersage nötig |
| Risiko | Gering: Regeln und Sicht bleiben, nur neue Darstellung | Mittel: Lesbarkeit der Abpraller muss neu erarbeitet werden |

Tank Trouble bleibt in 2D und kann später das gemeinsame 2.5D-Gerüst übernehmen.

## Grundsatz

- `shared/matches/bombArena.ts` bleibt die einzige Regelquelle. Keine Änderung an
  Zustand, Sicht oder Eingaben – Regeltests, Raumkern und Handy-Host sind nicht
  betroffen.
- Neu ist nur die Darstellung im Client. Der vorhandene Canvas-Renderer bleibt
  als **Rückfall** erhalten (WebGL fehlt, Kontextverlust, zu langsames Gerät).
- Beide Bewegungseinstellungen führen zum selben Spielergebnis; reduzierte
  Bewegung schaltet Wackeln, Wippen und Partikel ab, nicht Informationen.

## Schritte

### 1. Gerüst für 3D-Match-Spiele (`src/matches/`)

- `MatchClient` erhält optional `world(host, read, onError) → { dispose }`.
  `read()` liefert dasselbe `MatchFrame` wie heute (prev/cur, alpha, viewer,
  simTime, reduced, names) plus die Figurenkennung je Spieler aus
  `game.players[].characterId`.
- `MatchStage`: Hat das Spiel `world` und klappt WebGL, wird statt der Canvas
  ein WebGL-Host eingesetzt (dynamischer Import wie bei `PartyArena`, Ladehinweis,
  Figuren per `preloadFigures` vorladen). HUD, Rangliste, Countdown,
  Steuerelemente und Töne bleiben unverändert darüber.
- Rückfall: Fehler oder Kontextverlust → zurück zur Canvas, ohne den Raum zu
  verlassen; die Wahl gilt für das laufende Match.

### 2. Szene `src/three/bombWorld.ts`

- **Kamera:** perspektivisch mit kleinem Bildwinkel (~30°), etwa 55–60° geneigt,
  feste Lage über der Feldmitte, sodass alle 11 × 15 Felder im Hochformat
  sichtbar sind (Fairness: jeder sieht alles). Keine Verfolgung der eigenen Figur.
- **Feld:** Boden als Schachbrett, feste Mauern und Kisten als `InstancedMesh`
  (Zeichenaufrufe niedrig halten); Kisten mit Holzleisten.
  - Kisten bersten: kurzes Zerfallen mit wenigen Splittern, ausgelöst durch die
    Änderung im Zellstring.
  - Schließende Arena: Blöcke fallen sichtbar von oben (Zelltyp 3).
- **Figuren:** `figureCharacter` mit der gewählten Figur, auf ~0,8 Feld skaliert,
  farbiger Ring wie in den 3D-Arenen.
  - Bewegung und Blickrichtung kommen aus der vorhandenen Feld-Interpolation
    (`cx/tx/progress`, `dir`).
  - Bombe legen: Animation `attack`; Leben verloren: `hit` mit Blinken während
    der Unverwundbarkeit; ausgeschieden: `death`.
- **Bomben:** Kugel mit Lunte, Pulsieren nach Restzündzeit (aus `at` und Zeit
  berechnet), Funke; gekickte Bomben rollen sichtbar.
- **Flammen:** Kreuz aus leuchtenden Quadern mit additivem Material,
  verblassend bis `until`; kurzer Lichtblitz und leichtes Kamerawackeln
  (nur ohne reduzierte Bewegung).
- **Items:** schwebende Symbole (Reichweite, Bombe, Tempo, Kick) mit Farbe aus
  dem bisherigen 2D-Spiel, Wippen nur ohne reduzierte Bewegung.
- **Stil:** Farben und Schrift nach [Designregeln](../../designregeln.md) für
  Spielansichten; vorher `designregeln.md` und den Skill `game-ui-frontend`
  lesen (fehlt `frontend-design` in der Sitzung, in der Übergabe nennen).

### 3. Leistung

- Ziel: 60 FPS auf Mittelklasse-Handys, mindestens stabile 30 FPS mit sechs
  Figuren.
- Pixelverhältnis höchstens 1,5, eine Schattenquelle (1024²), Instanzen für
  alle Feldblöcke, Partikel begrenzt (z. B. 64 gleichzeitig).
- `SceneKit` drosselt Qualität bereits bei langsamen Bildern (nur Grafik, nie
  Physik oder Regeln).
- Messwerte wie bei den 3D-Arenen als Datenattribute ausgeben
  (`data-draw-calls`, `data-triangles`, `data-frames`), damit Tests sie prüfen.

### 4. Tests

- Regeln: keine Änderung; `npm run test:rules` muss unverändert grün bleiben.
- `npm run test:screens`: Bomb Arena rendert weiterhin ohne Fehler
  (Server-Rendering nutzt die Canvas-Variante).
- Playwright `phone` (`match-games.spec.ts`):
  1. 3D-Host erscheint, Figuren der gewählten Charaktere sind geladen.
  2. Stick bewegt die eigene Figur, Bombe legen erzeugt eine Bombe, Explosion
     zerstört eine Kiste.
  3. Zeichenaufrufe unter einer Grenze mit sechs Spielern (Bot-Testraum).
  4. Reduzierte Bewegung: gleicher Spielverlauf, kein Wackeln.
  5. Rückfall: WebGL deaktiviert → Canvas-Darstellung, Spiel bis zum Ergebnis.
- Screenshots mit 2, 4 und 6 Spielern zur Sichtprüfung.
- Echtes Handy (Android und iOS): FPS, Lesbarkeit der hinteren Reihen,
  Erwärmung über drei Durchgänge. **Ohne Gerätetest gilt der Schritt nicht als
  fertig.**

### 5. Abnahme

- Lobby bis Ergebnis spielbar in Übung, Bot-Testraum, Wettbewerb und
  Inselparty; Ergebnis identisch zur 2D-Fassung bei gleicher Eingabefolge.
- Alle Felder aus Sicht jedes Geräts lesbar; eigene Figur sofort erkennbar.
- Rückfall auf 2D funktioniert.
- Backlog, Konzept (Abweichungen, Leistungstabelle) und README nachgeführt.

## Aufwand und Reihenfolge

| Schritt | Umfang |
| --- | --- |
| 1 Gerüst in `MatchStage` | klein |
| 2 Szene mit Feld, Figuren, Bomben, Flammen | groß (Hauptteil) |
| 2 Effekte (Kistenbersten, einstürzende Arena, Wackeln) | mittel |
| 3 Leistung und Messwerte | klein bis mittel |
| 4 Tests und Screenshots | mittel |

Insgesamt etwa der Aufwand von zwei bis drei der bisherigen 2D-Minispiele.
Das Gerüst aus Schritt 1 und die Szenenbausteine sind für Tank Trouble und
weitere 2.5D-Fassungen wiederverwendbar.

## Risiken

- **Lesbarkeit:** Hohe Mauern können Figuren in der Reihe dahinter verdecken.
  Gegenmaßnahme: Mauern niedrig halten (~0,7 Feld) oder Mauern vor Figuren
  halbtransparent zeichnen.
- **Leistung auf älteren Handys:** sechs Figuren plus Partikel. Gegenmaßnahme:
  Qualitätsstufen und der 2D-Rückfall.
- **Ladezeit:** Figuren und Szene werden erst beim Matchstart geladen;
  vorladen, sobald das Minispiel feststeht (Intro-Phase).
