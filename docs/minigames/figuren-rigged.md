# Animierte Figuren (Rigged Characters)

Skelettfiguren in der vorhandenen Three.js-Architektur. Register/Freigabe: [Figuren](../approved-character-design.md). Gerätetest offen.

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

Ergebnis in `public/models/` (im PWA-Cache):

| Datei | Inhalt |
| --- | --- |
| `body_m.glb`, `body_f.glb` | gehäutete Körper ohne Texturen, mit Kleidungsbereichen je Eckpunkt (≈ 720 KB je Körper) |
| `hair_*.glb` | sechs Frisuren/Bart am selben Skelett (55–224 KB) |
| `anims.glb` | benötigte Animationen auf einem nackten Skelett (≈ 750 KB): dazu seit Nov. 2026 Klettern (`ClimbUp_1m`, daraus beim Laden auch die Hängepose), Hocken (stehend und gehend) und Fahren (`Driving_Loop` für Bumper Mayhem); das Skelett trägt auch Bolt und Glubschi |
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
- **Stoff/Ketten** (`src/three/garments.ts`): Hoodie/Hose aus zugeschnittenem, geweitetem Körpernetz mit denselben Skelettgewichten; je Körpertyp teilen. Saum an Hüfte, Zubehör auf gemessener Stoffoberfläche. Kette als gebundenes Netz mit Gewichten der Stoffstelle darunter, G/£ gemäß Freigabe. Verdeckte Füße nicht doppelt zeichnen.
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

## Szenen

Sumo: Dohyo/Kamera für alle, Kontakt-, Stoß- und Ring-Out-Animation. Chaos Run: getrennte Spuren/Verfolgerkamera, Hindernisse zeitlich an Regeln koppeln, Brücken je Läufer. Bumper: Fahreranimation. Parcours: Klettern/Hängen/Sprung/Hechten/Ducken. Eigene Figur markieren; reduzierte Bewegung entfernt Dekoration.

## Prüfungen

Playwright `phone`: betroffene Spiele mit Figuren, Bedienung, beiden
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

- Gerätetest: Bildrate mit sechs gehäuteten Figuren, Ladezeit beim ersten Mal, Lesbarkeit der Hindernisse in Chaos Run.
- Die sechs Basis-Menschen tragen nur Unterwäsche in Spielerfarbe; Outfits
  wären mit den Kleidungsbereichen schnell ergänzt.
- Umstellung der übrigen Minispiele auf eigene Skelett-Szenen (Animationen
  über den Adapter laufen dort bereits).
