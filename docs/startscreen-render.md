# Startgrafik und Renderwerkzeuge

## Aktueller Startbildschirm

`HomeScreen.tsx` verwendet Illustrationen aus `src/assets/expedition/`; `home.css` steuert den Auftritt, Menüs nutzen `AdventureChoice.tsx`/`menus.css`. Gestaltung: [Designregeln](../designregeln.md).

`npm run generate:icons` erzeugt mit Playwright-Chromium aus Wappen/Krone/Initialen vier PNG-Icons in `public/`; Ergebnisse einchecken.

## Frühere 3D-Renderpipeline

`scripts/home-render/` bleibt als bearbeitbare Quelle für `src/assets/home/` erhalten; sie erzeugt nicht die aktuelle Expedition-Illustration. Three.js verwendet die vorhandene Toolchain, keine zweite Engine.

| Quelle | Aufgabe |
| --- | --- |
| `kit.ts`, `hero.ts`, `backdrop.ts` | Palette, Materialien, Insel/Landschaft |
| `sprites.ts` | Tafeln, Holzbrett, Slice-Maße |
| `layers.ts` | Ebenen, Kamera, Licht/Nachbearbeitung |
| `render.ts`, `index.html`, `bake.ts` | Browserdarstellung/WebP-Export |
| `logoPaths.ts` | Logo-/Motto-Umrisse |
| `compare.ts` | Vergleich mit historischer Referenz |

```bash
npm run render:home
npm run render:home -- hero slab-gold
npm run render:home -- --draft --out=/tmp/vorschau
npm run compare:home
```

Rendern überschreibt gewählte Dateien in `src/assets/home/`; feste Startwerte halten Szenen reproduzierbar. Vergleich: `test-results/startscreen-vergleich.png`. Live-Vorschau: `npx vite`, dann `http://localhost:5173/scripts/home-render/index.html?layer=hero&live=1`. Fertiger Render ist maßgeblich. Bei Browserabweichung `PLAYWRIGHT_CHROMIUM_PATH`; Renderfehler müssen abbrechen.

Alte Tafel-Sprites: `SLAB_SPRITES`, `--slab-slice`, `--slab-edge`, `--slab-face-*` und Raumcode-Feld gemeinsam anpassen; Holz: `PLANK_SPRITE`/`.iw-plank`. Nutzung vorher prüfen, aktuelle Menüs überschreiben Teile der früheren Gestaltung.

Alte Pipeline: eigene prozedurale Geometrie/Materialien. Lilita One/Lexend: SIL OFL 1.1 über Fontsource. [Referenz](design/startscreen-referenz.webp) vom Projektinhaber. WebP/Schriften im PWA-Cache.

Nach Grafikänderung Smartphone, Kontrast ≥4,5:1, Fokus/gedrückt/deaktiviert, reduzierte Bewegung, Build/PWA/Produktion gemäß AGENTS.md prüfen. Historische Desktop-Messungen sind kein aktueller Prüfauftrag; reale Ladezeit/Leistung bleibt zu messen.
