# Roll It Up! – ursprünglicher Entwurf

Entwurf vom 17. November 2026; als **Die Bauschale** integriert. Aktuelle Umsetzung/Prüfgrenzen: [3D-Spielansichten](../../inselparty-3d.md#roll-it-up-die-bauschale).

Separate interaktive Vorschau, kein Spielclient: emaillierte Miniaturlandschaft mit Messingrand, Sammelorten und Hügelbank. Sechs dauerhafte Stationsschilder im Spiel durch Ziel-/Ortsbeschriftung ersetzt; Übersicht nennt alle Stationen.

- `world.ts`/`scene.html`: Welt; `render.mjs`: Renderbilder.
- `hud.html`: interaktive Vorlage.
- `pack.mjs <absoluter HTML-Zielpfad>`: Bilder/Schriften einbetten.
- `check-preview.mjs <absoluter Vorschaupfad>`: verpackte Vorschau prüfen.
- Optional `PLAYWRIGHT_CHROMIUM_PATH`.

Beispielzug: Feld 8, Wurf 4; außen `9 → 10 → 11 → 12`, Abkürzung `30 → 31 → 12 → 13`. Start: Grinder, Weedbud I/II, 18 Münzen. Beide passieren Pape, Abkürzung läuft danach einen Schritt weiter. Keine neue Spielregel.

Historische Prüfung: Touch 390 px/normal und 320 px/reduziert, Wege, Kauf/Überspringen, Sammlung, lange Namen, Fokus, Touch-Ziele/Überlauf. Vorgerenderte Bilder belegen keine Handy-Leistung. Freies Drehen, Zoom und Laufanimationen gehören zur Spielintegration; nur aktuelle Doku weiterpflegen.
