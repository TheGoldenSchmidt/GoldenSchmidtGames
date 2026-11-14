# Plan: Floor is Lava – 2.5D und Schubsen

Stand: Nov. 2026 · Status: **umgesetzt** inkl. drei Etagen, bis auf den Gerätetest (siehe „Umsetzungsstand“).

## Warum dieses Spiel als nächstes

| Kandidat | Eignung |
| --- | --- |
| **Floor is Lava** | Ausdrücklicher Wunsch nach einer 3D-Fassung „wie Fall Guys“. Raster aus Platten über Lava passt direkt zum 2.5D-Gerüst; zerbröselnde, versinkende und zurückkehrende Platten, glühende Lava und springende Figuren gewinnen am meisten durch Tiefe. Bisher kaum Interaktion zwischen den Spielern – Schubsen schließt diese Lücke. |
| Sumo Smash | Gut geeignet (Ring, Figuren), Rückstoß wurde gerade überarbeitet; als nächster Kandidat vorgemerkt. |
| Bumper Mayhem | Fahrzeuge statt Figuren, ähnlicher Ring wie Sumo; nach Sumo. |
| Chaos Run | Seitenansicht und Auto-Runner; 2.5D bringt weniger, mehr Aufwand bei der Kamera. |

## Umfang

### Regeln (Erweiterung, `shared/matches/floorIsLava.ts`)

- **Schubser:** Zweiter Knopf. 0,22 s Vorwärtsstoß in Blickrichtung (Stick,
  sonst letzte Laufrichtung), Abklingzeit 2,5 s. Wer während des Stoßes
  getroffen wird, rutscht 0,35 s ohne Kontrolle mit 6,5 Einheiten/s davon –
  auf bröselnde Platten oder in die Lava. Springende weichen aus (nur gleiche
  Höhe trifft), Schutzzeit nach Respawn schützt auch vor Stößen.
- **Wertung:** Ein Sturz in die Lava bis 1,5 s nach einem Stoß wird der
  stoßenden Person als „Schubser-Sturz“ angezeigt (Ereignis), Punkte bleiben
  unverändert (Platzierung nach Überleben).
- Bots schubsen, wenn ein Gegner nah und vor ihnen steht.
- Regeltest: Stoß, Abklingzeit, Rutschen, Sprung weicht aus, Schutzzeit,
  Determinismus und JSON-Neustart bleiben grün.

### Darstellung (`src/three/lavaWorld.ts`)

- Feste, geneigte Kamera wie bei Bomb Arena/Tank Trouble (gemeinsame Bausteine
  in `matchScene.ts`), freie Fläche unten für Stick und Knöpfe.
- Lava als leuchtende, langsam wogende Fläche mit Glutpartikeln (ohne bei
  reduzierter Bewegung); Tempelplatten mit Rune für zurückkehrende Platten.
- Bröckeln: Platte zittert, färbt sich glühend, kippt dann ab und versinkt;
  zurückkehrende Platten steigen aus der Lava. Einstürzender Rand sichtbar.
- Figuren mit Sprungbogen und Schatten, Lebenspunkte, gelber Marker der
  eigenen Figur; Stoß mit `attack`, Lava-Treffer mit `hit`, Ausscheiden mit
  `death` und Versinken.
- Canvas-Fassung bleibt Rückfall und zeigt den Schubser ebenfalls.

### Steuerung und HUD

- Stick links, rechts zwei Knöpfe übereinander: „Springen“ und „Schubsen“,
  beide mit Abklingring.

### Gestaltung

Nach der Umsetzung Überarbeitung mit dem Skill `frontend-design:frontend-design`
(Themenwelt, Lesbarkeit, Bewegung), Sichtprüfung auf 360 × 640 und 430 × 932.

## Tests

- `npm run test:rules` (erweiterter `floor-is-lava-test`).
- Playwright `phone`: 3D-Feld mit Figuren, Laufen, Springen, Schubsen,
  beide Bewegungseinstellungen, sechs Figuren, Rückfall ohne WebGL.
- Gerätetest auf echten Handys bleibt offen.

## Umsetzungsstand

| Teil | Stand |
| --- | --- |
| Schubser (Regeln, Bots) | umgesetzt; Regeltest deckt Stoß, Abklingzeit, Rutschen ohne Kontrolle, Gutschrift im Ereignis, Ausweichen im Sprung und Schutzzeit ab |
| 2.5D-Szene `src/three/lavaWorld.ts` | umgesetzt: fließende, glühende Lava mit Glut, Tempelplatten mit gemeißeltem Rand, Erhitzen und Zittern beim Bröckeln, Kippen und Versinken, aufsteigende Runenplatten, Geisterumriss zurückkehrender Platten, 1,5-s-Warnung vor dem Randeinsturz, Figuren mit Sprungbogen, Schatten, Schlingern nach Stößen und Versinken beim Ausscheiden |
| Steuerung | Stick links, rechts „Schubsen“ (⇉) über „Springen“ (⤒), beide mit Abklingring |
| Gestaltung mit `frontend-design` | Themenwelt „Vulkantempel bei Nacht“ (Basalt `#2a0f0a`, Sandstein, Glut `#ff6a1f`, Schmelzgold `#ffd166`, Runentürkis `#57e4cb`); Blickfang ist allein die Lava, alles andere ruhig. Nach Sichtprüfung: hellere Platten und schwächeres Glühlicht für Kontrast, feinere Runen, Emoji-Symbol ersetzt, Banner im Glutton, kürzere Statuszeile |
| Leistung | sechs Figuren: 180 Zeichenaufrufe, ≈ 237 000 Dreiecke (Chromium-Emulation) |
| Tests | Playwright `phone`: Figuren, Laufen, Springen, Schubsen in beiden Bewegungseinstellungen, sechs Figuren, Rückfall ohne WebGL |
| Etagen (Nov. 2026) | umgesetzt: drei Etagen, Durchfallen ohne Lebensverlust, Lava nur unter der untersten Etage, Kamera gleitet mit der eigenen Etage, Etagen darüber ausgeblendet, tiefere abgedunkelt, Bröckelkrümel beim Durchfallen; Canvas-Rückfall zeigt die eigene Etage, darunter liegende Platten durch Löcher und ein Etagenschild; Statuszeile nennt die Etage. Regeltest: Durchfallen, Kette bis in die Lava, Respawn, getrennte Kontakte, Randeinsturz auf allen Etagen; Playwright `phone`: Durchfallen in beiden Bewegungseinstellungen, sechs Figuren 184 Zeichenaufrufe |
| Offen | Gerätetest (FPS, Lesbarkeit der Runen, Gefühl des Schubsers, ob Figuren auf tieferen Etagen genug zu sehen sind, Balance der Durchgänge bis 30 s); Blinken während der Schutzzeit blendet Figuren kurz ganz aus – auf echten Geräten beurteilen |
