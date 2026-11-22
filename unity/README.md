# Unity-Tests

Probe, ob Unity ein besseres Spielerlebnis liefert als die Three.js-/Canvas-Spiele der App. Zwei **getrennte Minispiele** als eigene WebGL-Builds, in der App unter **Lokal spielen → Frei ausprobieren** für alle sichtbar:

| Spiel | Inhalt | Build |
| --- | --- | --- |
| Parcours-Probelevel | 15 Stationen mit allen Hindernisarten der Online-Parcours (`parcoursCourses.ts`): Stufen/Lücke, Türenwand (2 von 5 echt), Schieber, Drehbalken unten/oben/Kreuz, Fahrinseln, Wippen, Förderband mit Walzen, Kletterkante, Geisterpfad, Fallklappen mit Vorwarnung, Windsteg, Wechselgriffe, Glibbergrube, Türgänge (weiter/Sackgasse/Falltür/zu), Ziel. Allein, mit Kontrollpunkten, Zeit, Stürzen und Bestzeit. | `public/unity/parcours/` |
| Floor is Lava | Regeln aus `shared/matches/floorIsLava.ts`: 3 Etagen à 9 × 13 Platten, Bröseln nach 0,8 s, Runenplatten kehren nach 2,5 s zurück, Rand stürzt bei 16 s und 23 s ein, Springen/Hechten/Schubsen mit Abklingzeiten, +1 je früher gefallene Person, +3 für Überlebende, drei Durchgänge und Stechrunde. Du gegen drei Bots (Bot-Logik portiert). | `public/unity/lava/` |

Nicht Teil von Räumen, Zufallspool oder Offline-Cache; keine Online-Partien. Figur: die in der App gewählte freigegebene Figur (`?figur=`), sonst ein Basismensch; Bots nutzen die übrigen Basismenschen.

## Was Unity hier anders macht

- **Echte Physik:** Wippen kippen über ein Gelenk unter dem Gewicht, echte Türen zerspringen in Splitter, Platten fallen wirklich durch Löcher auf die Etage darunter, Schubser stoßen Rigidbodies.
- **Optik:** eine Toon-Shaderfamilie für alles (zwei Lichtstufen, getönte Schatten, Tintenkonturen), Echtzeitschatten, HDR-Bloom, Nebel, Partikel für jede Aktion (Staub, Funken, Splitter, Konfetti, Glut), Kameraschütteln und Hit-Stop.
- **Ton:** alle Geräusche und eine Musikschleife werden zur Laufzeit synthetisiert (keine Audiodateien).
- **Figuren:** die freigegebenen Basismenschen (`public/models/*.glb`, CC0 Quaternius) über glTFast importiert, Unterwäsche in Spielerfarbe über die Kleidungsmaske, Clips aus `anims.glb`.
- **Bedienung:** UI Toolkit-HUD, Touch zuerst: schwebender Stick links, Aktionstasten rechts, Wischen dreht die Kamera (Parcours); mehrere Finger gleichzeitig. Pause mit Neustart und Ton-/Musikschalter.

## Projekt

`unity/GoldenSchmidtUnity`: Unity **6000.6.10f1**, Vorlage Universal 3D (URP), Ziel WebGL, Cinemachine 3.1, Input System, glTFast 6.21, Pipeline 1.0.1 (Agentensteuerung). Kein Unity-Cloud-Link, keine Unity-Dienste.

| Ort | Inhalt |
| --- | --- |
| `Assets/GSG/Scripts/Runtime/Common` | Palette, HUD/Touch, Kamera, Figur, Klänge, Effekte, Szenenlicht |
| `Assets/GSG/Scripts/Runtime/Parcours` | Läufer, Hindernisse, Level-Aufbau (`ParcoursLevel`), Spielablauf |
| `Assets/GSG/Scripts/Runtime/Lava` | Platten, Läufer, Regeln, Bots |
| `Assets/GSG/Scripts/Editor` | `GSGSetup` (Materialien, Figuren, Szenen, WebGL-Einstellungen), `GSGPlaytest` (Mechanik-Prüfung im Play Mode) |
| `Assets/GSG/Shaders` | `GSG/Toon`, `GSG/Outline`, `GSG/Glow`, `GSG/Sky`, `GSG/Particle` |
| `Assets/WebGLTemplates/GSG` | Seite ohne Inline-Skript (CSP), Ladebalken, Pixeldichte ≤ 2 |

Menü **GSG → 1 Alles einrichten** baut Materialien, Figuren-Prefabs, beide Szenen und die WebGL-Einstellungen reproduzierbar neu. Builds: Plattform WebGL, je Szene ein eigener Build nach `public/unity/<id>/` (Gzip mit Entpack-Rückfall, Dateinamen mit Inhalts-Hash).

Mit Unity CLI (Lizenz Unity Personal):

```bash
unity open unity/GoldenSchmidtUnity
```

## Auslieferung

Der Server erlaubt **nur unter `/unity/`** WebAssembly (`'wasm-unsafe-eval'`), `blob:`-Skripte und das Einbetten im eigenen App-Rahmen (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`); die App selbst bleibt unverändert streng. `Build/`-Dateien sind ein Jahr cachebar. Der Service Worker nimmt `unity/**` nicht in den Offline-Cache und leitet Navigationen dorthin nicht auf die App um. Erster Start lädt je Spiel ca. 14 MB (Engine-Code ≈ 8,7 MB ist in beiden Builds identisch), danach liegt es im Browser-Cache.

## Geprüft

- Editor-Play-Mode (`GSGPlaytest`): Laufen 6,4 m/s, Treppe, Sprung über die Lücke, 2 von 5 Türen brechen, unterer Balken trifft Stehende, oberer verfehlt Duckende, Fahrinsel trägt mit, Wippe kippt ca. 14°, Band −3,4 m/s, Kante und alle drei Griffstufen hochziehen, Geisterpfad 1 von 4 trägt, Falltür, Wind ca. 3 m Drift, Glibber setzt zurück, Ziel beendet den Lauf. Floor is Lava: drei Durchgänge mit Wertung und Ergebnisliste, Runenanteil ≈ 35 %.
- Produktionsserver + Chromium (Handy-Emulation, Software-GPU): Build startet unter der App-CSP ohne Verstöße; `npm run test:production` prüft Header, Dateien und PWA-Ausschluss.

## Offen

- **Auf echten Handys** Bildrate, Ladezeit, Akku/Wärme und Touch-Gefühl beurteilen (Software-GPU im Container sagt nichts über Leistung). Danach Schatten, MSAA oder Renderauflösung anpassen.
- Bewertung Unity vs. Web gemeinsam festhalten; erst danach über Online-Mehrspieler (würde eigene Netzwerkschicht oder Anbindung an `roomCore` brauchen) entscheiden.
- Kein Offline-Betrieb und keine Online-Räume für die Unity-Tests.
- Personal-Lizenz zeigt beim Start das „Made with Unity“-Logo.
- Builds erfordern Unity Editor + Lizenz; CI baut sie nicht. Nach Änderungen im Unity-Projekt Builds neu erzeugen und mit einchecken.
