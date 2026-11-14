# Startscreen-Grafik: 3D-Szene und Renderpipeline

Der Startbildschirm zeigt gerenderte Bilder einer bearbeitbaren three.js-Szene. Darüber
liegt die normale React-Oberfläche mit allen Bedienelementen. Gestalterische Vorgabe ist
die [Referenz](design/startscreen-referenz.webp); Gestaltungsregeln stehen in den
[Designregeln](../designregeln.md).

## Architektur

| Schicht | Inhalt | Technik |
| --- | --- | --- |
| 3D-Renderszene | Himmel, Wolken, Berge, Tannen, schwebende Insel, Steinschild mit Logo, Krone, Fahne, Schwert, Würfel, Schatztruhe, Wasserfall, Holzschild, Vordergrund-Büsche, Button-Materialien | three.js-Szenen in `scripts/home-render/`, gerendert zu WebP-Dateien in `src/assets/home/` |
| UI-Ebene | Online-Status, Gastprofil, „Lokal spielen“, „Online spielen“, Fortsetzen, „App installieren“, „Updates prüfen“, Installationshilfe | React und CSS in `HomeScreen.tsx`, `home.css`, `inselwelt.css` |

Zur Laufzeit lädt die App nur statische Bilder: keine WebGL-Szene, kein zusätzlicher Code.
Die Szene bleibt Quelltext und lässt sich jederzeit ändern und neu rendern.

**Warum three.js statt Unity:** Die App ist eine React/Vite-PWA. three.js ist bereits im Projekt
(Inselparty, Minispiele), Unity nicht. Eine Unity-Szene wäre eine zweite Engine mit eigener
Toolchain gewesen, die in der Entwicklungsumgebung nicht verfügbar war und sich deshalb weder
ausführen noch prüfen ließ. Die three.js-Szene erfüllt dieselbe Rolle als Renderquelle und läuft
mit den vorhandenen Werkzeugen (Node, Vite, Playwright-Chromium).

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `scripts/home-render/kit.ts` | Zufall mit Startwert, Facetten-Geometrie, Palette, Material `surface()` mit prozeduraler Oberflächenstruktur |
| `scripts/home-render/hero.ts` | Insel, Steinschild, extrudierte Logo-Schrift, Krone, Fahne, Schwert, Würfel, Truhe, Holzschild, Wasserfall |
| `scripts/home-render/backdrop.ts` | Himmel, Wolken, Berge und Tannen für Hoch- und Querformat; Vordergrund-Ecken |
| `scripts/home-render/sprites.ts` | Tafeln (Gold, Violett, Stein, je normal und gedrückt) und Pfeil-Fassungen; Slice-Maße in `SLAB_SPRITES` |
| `scripts/home-render/layers.ts` | Alle Ebenen mit Größe, Kamera, Licht, Durchgängen und Farbkorrektur |
| `scripts/home-render/render.ts`, `index.html` | Browserseite: Rendern, Nachbearbeitung, WebP-Export; Live-Vorschau |
| `scripts/home-render/bake.ts` | Startet Vite und Chromium, rendert Ebenen, schreibt `src/assets/home/<id>.webp` |
| `scripts/home-render/compare.ts` | Stellt Startbildschirm und Referenz gegenüber |
| `scripts/home-render/logoPaths.ts` | Umrisse von „GOLDEN“, „SCHMIDT“, „GAMES“ und des Mottos aus Lilita One |
| `src/assets/home/*.webp`, `hero-layers.json` | Gerenderte Ebenen (eingecheckt, zusammen etwa 400 KB) und die Lage der zugeschnittenen Insel-Ebenen |
| `docs/design/startscreen-referenz.webp` | Gestaltungsvorlage |

## Ebenen

| Ebene | Größe | Verwendung |
| --- | --- | --- |
| `hero-plaque`, `hero-island`, `hero-golden`, `hero-schmidt`, `hero-games` | Bildfeld 1000 × 1195, transparent, auf den Inhalt zugeschnitten | Steinrahmen (mit Krone, Ranken, Fahne), Insel mit Requisiten, die drei Wörter des Logos. `hero-layers.json` hält die Lage jedes Ausschnitts im Bildfeld fest; die Seite legt sie deckungsgleich übereinander. Zusammen bilden sie das Bild in der Überschrift `h1` (zugänglicher Name „GoldenSchmidtGames“) |
| `backdrop-portrait`, `backdrop-landscape` | 900 × 1950, 1920 × 1080 | Himmel und Landschaft; `<picture>` wählt nach Seitenverhältnis, `object-fit: cover` |
| `corner-left`, `corner-right` | 520 × 600, transparent | Büsche und Fels unten links und rechts |
| `slab-gold`, `slab-violet`, `slab-stone` und `-pressed` | 720 × 172, 360 × 104 | 9-Slice-Hintergrund der Tafeln, gedrückt mit eingesunkener Fläche |
| `socket-gold`, `socket-violet` | 96 × 96 | Achteck hinter dem Pfeil |

## Szenenaufbau

- **Steinschild:** dunkle Platte, Ring aus abgefasten Steinblöcken, Nieten an den Ecken,
  Ranken mit runden Blättern, darunter hängende Felsen. Die Schrift steht vor dem Steinring und ist echte
  extrudierte Geometrie mit Fase, nach oben gewölbt, mit Farbverlauf und metallischem Glanz
  (Gold für „GOLDEN“ und „SCHMIDT“, Silber für „GAMES“) und dunkler Rückwand als Kontur.
- **Insel:** Ringe aus Grasfläche mit Sandweg, Grasrand, Erdschicht und Fels; hängende Felskegel,
  Grasvorsprünge, Kiesel und Grasbüschel. Requisiten: Schwert im Stein, Würfel (abgerundet,
  Augen auf drei Seiten), offene Truhe mit leuchtendem Münzhaufen, Edelsteinen und Funkeln,
  Fahne mit Kronenwappen, gebogenes Holzschild mit eingeschnittenem Motto, Wasserfall.
- **Hintergrund:** Die Komposition steht in `PORTRAIT` und `LANDSCAPE` als Bildschirmanteile
  mit Tiefe; jedes Element wird über die Kamera an diese Stelle projiziert. So lässt es sich
  direkt an der Referenz ausrichten. Nebel blendet ferne Berge in den Dunst.
- **Ebenen der Insel:** Alle fünf Teile rendern mit derselben Kamera. Im Insel-Layer bleibt der Rahmen als
  Halteobjekt in der Szene: Er wirft Schatten und stanzt aus, was hinter ihm liegt, bleibt aber selbst
  durchsichtig. So ergeben die Ebenen übereinander wieder das Gesamtbild.
- **Kamera:** fest. Die Inselkamera hält ein festes horizontales Sichtfeld, Tafeln werden
  orthografisch und frontal gerendert.

## Materialien und Licht

- `surface()` erweitert `MeshStandardMaterial` um eine Körnung aus 3D-Rauschen. Sie verändert
  Albedo und Normale (wie eine Bump-Map, ohne Textur). Gestreckte Körnung ergibt Holzmaserung.
- Facetten erhalten pro Dreieck leicht abweichende Töne aus der Palette in `kit.ts`; Moos sitzt
  auf nach oben gerichteten Steinflächen.
- Metalle (`userData.reflective`) spiegeln eine warme Studio-Umgebung; andere Materialien sehen
  sie nicht, damit die Verschattung erhalten bleibt.
- Licht pro Durchgang: warme Sonne von links vorn als kleine Scheibe (weiche Schatten),
  eine Richtung der Himmelskuppel mit Schatten (über alle Durchgänge gemittelt ergibt das
  Umgebungsverdeckung), kühles Kantenlicht von hinten rechts, schwaches Licht von unten.
  Die Truhe hat ein eigenes Punktlicht.
- Nachbearbeitung: Bloom über fünf Unschärfestufen, Tonemapping Khronos PBR Neutral,
  Sättigung, Kontrast, kühle Schatten und warme Lichter, beim Hintergrund eine Vignette.
  Werte in `layers.ts` (`Grade`, `Lighting`).

## Erzeugen und prüfen

```bash
npm run render:home
```

Rendert alle Ebenen (etwa drei Minuten mit Software-Rendering) und überschreibt die Dateien in
`src/assets/home/`. Die Szenen nutzen feste Startwerte; unveränderte Quellen ergeben dieselben
Bilder. Einzelne Ebenen: `npm run render:home -- hero slab-gold`. Schnelle Vorschau mit einem
Viertel der Durchgänge in einen anderen Ordner: `npm run render:home -- --draft --out=/tmp/vorschau`.
Passt der Browser nicht zur Playwright-Version, `PLAYWRIGHT_CHROMIUM_PATH` setzen.

```bash
npm run compare:home
```

Schreibt `test-results/startscreen-vergleich.png`: Referenz, Startbildschirm in Referenzgröße
(502 × 1022) und eine Überblendung.

Live-Vorschau zum Bearbeiten: `npx vite` starten und
`http://localhost:5173/scripts/home-render/index.html?layer=hero&live=1` öffnen. Sie zeigt die
Szene in Echtzeit mit vereinfachtem Licht; maßgeblich ist der gerenderte Stand.

Nach Änderungen an Tafel-Sprites die Slice-Maße in `SLAB_SPRITES` (`sprites.ts`) und
`--slab-slice`, `--slab-edge`, `--slab-face-*` (`inselwelt.css`) gemeinsam anpassen.

## Anbindung an die App

- `HomeScreen.tsx` bindet die Bilder über Vite-Importe ein (Dateinamen mit Hash). Navigation,
  Profil, Installation, Updates und Fortsetzen sind unverändert dieselben Funktionen.
- Tafeln zeichnen ihr Sprite als `border-image` in `::before`; der Inhalt behält eigene Abstände.
  Gedrückt wechselt das Sprite und der Inhalt sinkt mit, deaktiviert wird es entsättigt.
- Der Service Worker speichert die WebP-Dateien vorab (`globPatterns` in `vite.config.ts`);
  Sprites unter 4 KB bettet Vite direkt ins CSS ein.
- Bis die Bilder geladen sind, zeigt der Startbildschirm einen passenden CSS-Himmelsverlauf.
- Auftritt (nur ohne reduzierte Bewegung): Der Steinrahmen fliegt von oben ein, die Insel blendet ein, sobald er
  fast gelandet ist, dann fliegen „Golden“ von links, „Schmidt“ von rechts und „Games“ von unten ein. Nach etwa
  zwei Sekunden ruht die Seite.

## Lizenzen

Alle Modelle, Materialien und Bilder entstehen prozedural im Projekt; es sind keine fremden
3D-Modelle oder Texturen eingebunden. Schriften: Lilita One und Lexend, beide SIL Open Font
License 1.1, über die npm-Pakete `@fontsource/lilita-one` und `@fontsource-variable/lexend`.
Die Referenzgrafik stammt vom Projektinhaber.

## Prüfstand und offene Punkte

Geprüft (Software-Rendering in Chromium, Browser-Emulation): Startbildschirm-Tests auf Handy
und Desktop, Hochformate von 320 × 550 bis 768 × 1024, Querformat 844 × 390 und 1280 × 800,
gedrückte, fokussierte und deaktivierte Tafeln, Kontrast der Tafelschrift auf den gerenderten
Pixeln (mindestens 4,5:1), Build, PWA- und Produktionsprüfung.

Nicht geprüft: Darstellung und Ladezeit auf einem echten Handy.

Bekannte Abweichungen zur Referenz:

- Die Referenz ist gemalt. Die Szene hat Low-Poly-Körper mit Licht und leichter Körnung,
  aber keine gemalten Details wie Risse, Moospolster oder Pinselstruktur.
- Schild und Schrift sind gerade ausgerichtet; in der Referenz sind sie leicht perspektivisch
  gekippt und die Schrift stärker geschwungen.
- Der Truhendeckel steht weit offen nach hinten; die Referenz zeigt ihn halb geöffnet von außen.
- Die Ecken haben große Büsche ohne einzelne Blätter.

Mögliche nächste Schritte: Büsche und Ranken aus Einzelblättern, gekippte Schildebene,
Deckel als Außenansicht modellieren, die Menüs (lokales Setup, Online, Lobby) mit denselben
Tafel-Sprites und Hintergründen umstellen.
