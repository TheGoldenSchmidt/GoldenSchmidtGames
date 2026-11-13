# Animierte Figuren (Rigged Characters)

Stand: Nov. 2026 · Status: **umgesetzt** in Sumo Smash und Chaos Run,
Gerätetest offen. Alternative zu Unity (Aufwandsschätzung im Chat, Nov. 2026):
echte Figuren mit Skelett und Animationen in der bestehenden Web-Technik.

## Quellen (alle CC0, Quaternius)

Die Originale liegen in `src/3DModels/` (≈ 257 MB, nur Quelle, wird nicht
ausgeliefert und nicht gebündelt):

| Paket | genutzt |
| --- | --- |
| Universal Base Characters [Standard] | Superhero Male/Female (Körper, Augen, Brauen), Frisuren *Rigged to Head Bone* |
| Universal Animation Library [Standard] (UAL 1) | Stehen, Joggen, Sprinten, Schieben, Sprung (Start/Schleife/Landung), Treffer, Tanz, Rolle |
| Universal Animation Library 2 [Standard] | Dash, Rückstoß, Rutschen, Jubel |

Alle teilen dasselbe 65-Knochen-Skelett; jede Animation passt auf jede Figur.

## Erzeugen

```bash
python3 scripts/assets/build-character-textures.py
node scripts/assets/build-characters.mjs
```

Ergebnis in `public/models/` (im PWA-Cache, zusammen ≈ 2,4 MB):

| Datei | Inhalt |
| --- | --- |
| `body_m.glb`, `body_f.glb` | gehäutete Körper ohne Texturen (≈ 550 KB je Körper) |
| `hair_*.glb` | sechs Frisuren/Bart am selben Skelett (55–224 KB) |
| `anims.glb` | 15 Animationen auf einem nackten Skelett (≈ 530 KB) |
| `tex/body_<m|f>_<light|dark>.jpg` | Haut/Kleidung 512 px |
| `tex/outfit_<m|f>.png` | Maske der Kleidung (grau, ungesättigt) |
| `tex/hair_1.jpg`, `hair_2.jpg`, `eye.jpg` | Haar (graustufig) und Augen |

Optimierung: nur benötigte Clips; Finger-, Blatt- und Skalierungsspuren
entfernt; Schlüsselbilder auf ≈ 20/s ausgedünnt; doppelte Eckpunkte
zusammengefasst; Normal- und Rauheitskarten weggelassen (bei dieser
Kameradistanz ohne sichtbaren Gewinn). Getrennte Dateien halten die
Knochennamen eindeutig.

## Laufzeit (`src/three/riggedFigure.ts`)

- `loadCharacterKit()` lädt alles einmal; `riggedFigure(kit, slot, farbe, höhe)`
  klont Skelett und Materialien je Spieler.
- **Sechs Looks** je Farbslot (Körper, Hautton, Frisur, Haarfarbe; das Haar
  ist graustufig und wird wie in den Quell-Engines eingefärbt).
- **Spielerfarbe** auf Hose/Oberteil: Shader-Erweiterung mischt die Farbe
  über die Kleidungsmaske, Falten und Schatten bleiben.
- Frisuren werden über die Knochennamen an das Körperskelett gebunden.
- `AnimationMixer` mit weichen Übergängen: Dauerzustände (stehen, joggen,
  sprinten, schieben, Luft, rutschen, tanzen) und Einmal-Aktionen (Dash,
  Treffer, Absprung, Landung, Rutschbeginn, Jubel). Körperanimationen laufen
  auch bei reduzierter Bewegung, weil sie Aktionen erklären; Wackeln,
  Funken und Wippen entfallen dort.
- Größe aus den gehäuteten Eckpunkten; Figuren blicken entlang +Z
  (über die Zehenknochen geprüft).

## Sumo Smash

Schwebender Dohyo, schrumpfender Seilring, Kampfspiel-Kamera (rahmt alle
Kämpfer im Ring, zoomt bei wenigen heran). Joggen, **Schieben** bei Kontakt in
Laufrichtung, Dash beim Stoß, Rückstoß bei harten Treffern, Fallen beim
Ring-Out, Landung beim Wiedereinstieg, Tanz des Siegers. Ring in Spielerfarbe
unter jeder Figur, eigene Figur gelb mit Pfeil. Sechs Kämpfer: 120
Zeichenaufrufe, ≈ 224 000 Dreiecke (Chromium-Emulation).

## Chaos Run

Gameshow-Parcours mit **Verfolgerkamera** schräg hinter der eigenen Figur;
jede Person hat eine eigene Spur (die Regeln simulieren Läufer unabhängig,
Brücken stürzen je Läufer ein). Hindernisse über alle Spuren: Lücken,
schwingender Rammbalken (der „Hammer“, tief im Zeitfenster der Regeln),
hochfahrende Wände, Balken zum Drunterrutschen, Hebeplattformen. Figuren
sprinten, springen (Absprung, Luft, Landung), rutschen, werden
zurückgeworfen, stürzen und tanzen im Ziel. Mehr Spuren → Kamera etwas höher
und weiter zurück. Sechs Läufer: 112 Zeichenaufrufe, ≈ 207 000 Dreiecke.

## Prüfungen

Playwright `phone`: beide Spiele mit Figuren, Bedienung, beiden
Bewegungseinstellungen, sechs Spielern und Rückfall ohne WebGL;
Produktionsprüfung: Figurendateien im PWA-Cache und ausgeliefert.

## Offen

- Gerätetest: Bildrate mit sechs gehäuteten Figuren, Ladezeit (≈ 2,4 MB beim
  ersten Mal), Lesbarkeit der Hindernisse in Chaos Run.
- Die übrigen 2.5D-Spiele (Bomb Arena, Tank Trouble, Floor is Lava) nutzen
  weiter die 13 freigegebenen Figuren; Umstellung nur nach Entscheidung.
