# Animierte Figuren (Rigged Characters)

Stand: Nov. 2026 · Status: **umgesetzt**: zehn wählbare Figuren, eigene Szenen in
Sumo Smash und Chaos Run, Adapter für alle übrigen 3D-Szenen. Gerätetest offen. Alternative zu Unity (Aufwandsschätzung im Chat, Nov. 2026):
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
npm run build && node scripts/assets/render-rigged-portraits.mjs   # Vorschaubilder public/characters/rig_*.png
```

Ergebnis in `public/models/` (im PWA-Cache, zusammen ≈ 2,8 MB):

| Datei | Inhalt |
| --- | --- |
| `body_m.glb`, `body_f.glb` | gehäutete Körper ohne Texturen, mit Kleidungsbereichen je Eckpunkt (≈ 720 KB je Körper) |
| `hair_*.glb` | sechs Frisuren/Bart am selben Skelett (55–224 KB) |
| `anims.glb` | 21 Animationen auf einem nackten Skelett (≈ 750 KB): dazu seit Nov. 2026 Klettern (`ClimbUp_1m`, daraus beim Laden auch die Hängepose), Hocken (stehend und gehend) und Fahren (`Driving_Loop` für Bumper Mayhem); das Skelett trägt auch Bolt und Glubschi |
| `tex/body_<m|f>_<light|dark>.jpg` | Haut/Kleidung 512 px |
| `tex/outfit_<m|f>.png` | Maske der Kleidung (grau, ungesättigt) |
| `tex/hair_1.jpg`, `hair_2.jpg`, `eye.jpg` | Haar (graustufig) und Augen |

Optimierung: nur benötigte Clips; Finger-, Blatt- und Skalierungsspuren
entfernt; Schlüsselbilder auf ≈ 20/s ausgedünnt; doppelte Eckpunkte
zusammengefasst; Normal- und Rauheitskarten weggelassen (bei dieser
Kameradistanz ohne sichtbaren Gewinn). Getrennte Dateien halten die
Knochennamen eindeutig.

## Laufzeit (`src/three/riggedFigure.ts`)

- `loadCharacterKit()` lädt alles einmal; `riggedFigure(kit, gewählt, platz, farbe, höhe)`
  baut die gewählte Figur (`RIGGED_SPECS`) oder – bei klassischer Wahl – einen
  der sechs Menschen nach Farbplatz.
- **Menschen:** Körper, Hautton, Frisur und Haarfarbe (das Haar ist graustufig
  und wird wie in den Quell-Engines eingefärbt). Ohne Outfit nimmt die Unterwäsche
  die Spielerfarbe an (Maskentextur).
- **Outfits ohne neue Texturen:** Der Build schreibt je Eckpunkt Kleidungsbereiche
  aus den Knochengewichten (`_ga`: Shirt, Ärmel, Shorts, Hosenbeine; `_gb`: Schuhe,
  Handschuhe). Der Shader färbt sie ein (fest oder Spielerfarbe), kann sie weiten
  und den Hautschatten ausblenden.
- **Stoffschicht (`src/three/garments.ts`, MC Goldie und Lil Schmidt):** Hoodie und weite Hose
  entstehen aus dem Körpernetz selbst. Die bedeckten Dreiecke werden an geraden
  Kanten (Saum, Bündchen, Kragenring) abgeschnitten, auf eine weite, gerade
  Silhouette nach außen geschoben (Rumpf als Ellipse, Ärmel und Hosenbeine als
  Röhren um die Knochenachse), geglättet und mit den Körpergewichten an dasselbe
  Skelett gebunden. Der Hoodie-Saum hängt in der Mitte an der Hüfte und schwingt
  nicht mit einem Bein aus. Bauchtasche, Rippbündchen und Hosenstreifen zeichnet
  der Shader aus der Ruheposition. Kapuzenrolle und Kapuze liegen auf der
  gemessenen Stoffoberfläche (`clothSurface`). Die Geometrie wird je Körpertyp
  einmal berechnet (~40 ms) und geteilt. Füße unter modellierten Sneakern
  zeichnet der Körper nicht.
- **Goldketten (`chain` in der Figurenbeschreibung):** zwei Stränge
  ineinandergreifender Glieder (jedes zweite um 90° gedreht) hängen in einem
  weichen U auf der Stoffoberfläche und enden seitlich an einem Ring, der einen
  großen Buchstaben trägt (MC Goldie: schwere Glieder und „G“, Lil Schmidt: feine
  Glieder und „£“; Umrisse in `letterShapes`, extrudiert mit Fase). Die ganze
  Kette ist ein Netz mit Skelettbindung: Jedes Glied übernimmt die Gewichte der
  Stoffstelle darunter, so biegt sich der Strang mit der Brust, statt an
  Knochengrenzen zu knicken.
- **Starres Zubehör** ist je ein eigenes Teil, im Ruhezustand platziert und an
  einen Knochen gehängt: Cap, Beanie, Sonnenbrille, Sneaker, Stern-Emblem,
  Heldenmaske.
- **Comic-Look:** gestufte Schattierung (`MeshToonMaterial`), dunkle Kontur als
  umgestülpte Hülle, Knochen-Skalierung für großen Kopf, Hände und Füße (die
  Animationen enthalten keine Skalierung, sie bleibt erhalten).
- **Eigene Entwürfe (Bolt, Glubschi):** Grundformen auf dem nackten Skelett.
  Kürzere Beine und Arme entstehen durch skalierte Ruheabstände der Knochen; die
  Hüfthöhe der Animationen wird im selben Verhältnis skaliert.
- **Zeichenaufwand:** starre Teile mit gleichem Material am selben Knochen werden
  zu einem Netz zusammengefasst (gemischte Sechsergruppe in der klassischen Arena:
  257 statt 393 Zeichenaufrufe).
- `AnimationMixer` mit weichen Übergängen: Dauerzustände (stehen, joggen,
  sprinten, schieben, Luft, rutschen, tanzen, klettern, hängen, hocken, fahren) und Einmal-Aktionen (Dash,
  Treffer, Schlag, Absprung, Landung, Rutschbeginn, Jubel, Niederlage). Einmal-Aktionen
  lassen sich schneller und ab einem Versatz abspielen und vorzeitig beenden (`stopShot`,
  z. B. bei der Landung: `Jump_Start` dauert 1,33 s, ein Sprung nur ≈ 0,7 s).
  Körperanimationen laufen auch bei reduzierter Bewegung, weil sie Aktionen
  erklären; Wackeln, Funken und Wippen entfallen dort.
- Größe aus der Stehpose (ohne Antennen, Hörner, Kontur); Figuren blicken
  entlang +Z (über die Zehenknochen geprüft).
- **Alle übrigen 3D-Szenen** (Insel, Intros, klassische Arenen, Bomb Arena, Tank
  Trouble, Floor is Lava, Vorschau-Bühne) erhalten animierte Figuren über einen
  Adapter in `src/figures/character.ts` hinter derselben Schnittstelle wie die
  klassischen Figuren; `loadFigure`/`preloadFigures` laden dafür das Kit.

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

## Gewählte klassische Figuren in Skelett-Szenen

Sumo Smash, Bumper Mayhem, Chaos Run und der Hindernis-Parcours brauchen
Körperaktionen (Schieben, Klettern, Hechten, Fahren), die es nur als
Skelettanimationen gibt. Die 13 klassischen Figuren (`alpha_*`) sind starre
Einzelteil-Modelle ohne Skelett mit wenigen eigenen Clips (Angriff, Treffer,
Niederlage, Sprung) und berechneter Beinbewegung. Wer eine klassische Figur
gewählt hat, erscheint dort deshalb als einer der sechs Basis-Menschen in der
Spielerfarbe. Die übrigen 3D-Szenen zeigen klassische Figuren über den Adapter.

## Offen

- Gerätetest: Bildrate mit sechs gehäuteten Figuren, Ladezeit (≈ 2,4 MB beim
  ersten Mal), Lesbarkeit der Hindernisse in Chaos Run.
- Die sechs Basis-Menschen tragen nur Unterwäsche in Spielerfarbe; Outfits
  wären mit den Kleidungsbereichen schnell ergänzt.
- Umstellung der übrigen Minispiele auf eigene Skelett-Szenen (Animationen
  über den Adapter laufen dort bereits).
