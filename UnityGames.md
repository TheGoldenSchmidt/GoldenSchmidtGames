# Unity-Minispiele

Verbindlich für alle Arbeiten an Unity-Minispielen und am Unity-Brett von Roll It Up! (`unity/`, `public/unity/`, `src/unityGames.ts`, `src/unityRollItUp.ts`, `UnityGameScreen`, `UnityRollItUpBoard`, CSP und Header unter `/unity/`). Gilt für Menschen sowie Codex und Claude Code zusätzlich zu [AGENTS.md](AGENTS.md) und den [Designregeln](designregeln.md).

## Zweck und Stand

Alle Minispiele, die nicht zur ersten Generation gehören (`NEW_MATCH_IDS` in `shared/minigameCatalog.ts`), werden schrittweise als Unity-Fassung umgesetzt. Jedes Unity-Spiel ist ein **eigenständiges Minispiel** in **einem gemeinsamen WebGL-Build** (`public/unity/spiele/`, `?spiel=<id>` wählt die Szene), in der App vorerst nur unter **Lokal spielen → Frei ausprobieren** für alle sichtbar (`src/unityGames.ts`). Sie laufen lokal auf einem Handy gegen Bots: keine Räume, kein Zufallspool, kein Offline-Cache. Die Web-Fassungen bleiben unverändert im Spiel.

| Spiel | Inhalt | Build |
| --- | --- | --- |
| Parcours-Probelevel (`parcours`) | 15 Stationen mit allen Hindernisarten der Online-Parcours (`parcoursCourses.ts`): Stufen/Lücke, Türenwand (2 von 5 echt), Schieber, Drehbalken unten/oben/Kreuz, Fahrinseln, Wippen, Förderband mit Walzen, Kletterkante, Geisterpfad, Fallklappen mit Vorwarnung, Windsteg, Wechselgriffe, Glibbergrube, Türgänge (weiter/Sackgasse/Falltür/zu), Ziel. Allein, mit Kontrollpunkten, Zeit, Stürzen und Bestzeit. | Szene `ParcoursProbe` |
| Floor is Lava (`lava`) | Regeln aus `shared/matches/floorIsLava.ts`: 3 Etagen à 9 × 13 Platten, Bröseln nach 0,8 s, Runenplatten kehren nach 2,5 s zurück, Rand stürzt bei 16 s und 23 s ein, Springen/Hechten/Schubsen mit Abklingzeiten, +1 je früher gefallene Person, +3 für Überlebende, drei Durchgänge und Stechrunde. Du gegen drei Bots (Bot-Logik portiert). | Szene `FloorIsLava` |
| Sumo Smash (`sumo`) | Regeln aus `ringCore.ts` + `sumoSmash.ts` in 50-ms-Schritten (C#-Port `Ring/RingSim.cs`): Stoß mit Rückstoß, 3 Leben, Ring-Out +2, Ring schrumpft ab 40 s, Entscheid nach 75 s, Sudden Death. Podest über einem See mit Torii; Stürze ins Wasser. | Szene `SumoSmash` |
| Bumper Mayhem (`bumpercars`) | Gleicher Ringkern + `bumperMayhem.ts`: Lenken/Turbo, Schleudern, Item-Kisten (Riesenauto, Ölfleck, Schockwelle), drehende Pfosten, Fläche schrumpft ab 45 s. Neonfläche mit Riesenrad. | Szene `BumperMayhem` |
| Bomb Arena (`bombs`) | Port von `bombArena.ts` (`Bombs/BombSim.cs`): 11 × 15 Felder, 2-s-Zünder, Kreuzflammen mit Ketten, Kisten mit Extras (Reichweite, Bombe, Tempo, Kick), Spirale ab 25 s, 2 Leben, K.o. +2, Durchgangssieg +3, zwei Durchgänge, Sudden Death. | Szene `BombArena` |
| Schneeballschlacht (`snowball`) | Port von `snowball.ts` (`Snow/SnowSim.cs`): Formen/Schneehaufen, höchstens zwei Bälle, Wurf rastet auf den nächsten Gegner im Bild ein (Vorhalt), −10 % Tempo je Treffer, Schneemann nach drei. Verfolgerkamera, Wischen dreht. Zielen per Ziehen gibt es noch nicht, nur den Tipp-Wurf. | Szene `Schneeballschlacht` |
| Tower Tumble (`tower`) | Turmrennen aus `towerTumble.ts` (Steinfolge, Steuerung, Ziellinie 16, 2 s halten, 120 s, Bot-Planer); die Physik ist **Unitys 2D-Physik (Box2D)** statt `physics2d.ts` (Reibung 0,9, Schwerkraft 18), die Steine werden als 3D-Würfel gezeichnet. | Szene `TowerTumble` |
| Tower Tumble – Survival (`towersurvival`) | Gleiche Szene-Logik mit `survival`: keine Ziellinie, drei verlorene Steine = raus, Fallen bis × 1,8 schneller in 180 s, vorsichtigere Bots. | Szene `TowerSurvival` |
| Türenlotto (`tuerenlotto`) | Parcours-Lauf aus den App-Streckendaten (`Resources/GSG/Courses/tuerenlotto.json`, erzeugt aus `parcoursCourses.ts`): Türreihen, Gassen mit Sackgasse/Falltür, Schieber, Graben, Drehbalken. Läufer und Hindernisse des Probelevels; eigener Kontrollpunkt je Läufer, Zielreihenfolge, Zielschluss 20 s nach dem Ersten, Zeitlimit 120 s. Bots nach `parcoursBot` (gemeinsames Wissen über probierte Türen/Gassen, springen/ducken an Balken, springen über Lücken, warten auf Inseln und Schieber). | Szene `Tuerenlotto` |
| Kreiselkurs (`kreiselkurs`) | Gleicher Lauf-Rahmen: Drehbalken unten/oben/Kreuz, fahrende Inseln, zwei Wippen, Rührwerk. Bots scheitern gelegentlich an den Inseln (wie in der App). | Szene `Kreiselkurs` |
| Standhaft (`standhaft`) | Ausscheidungsfinale aus `standhaft.json`. 25 Fallklappen öffnen sich von außen nach innen, zwei Drehbalken starten zeitversetzt. Spieler und drei Bots weichen über die Plattform aus. Letzte Überlebende gewinnen, nach 90 s auch gemeinsam. Unitys Parcours-Läufer verwendet Rigidbody-Kollisionen, die Balken folgen dem App-Kontaktmodell. | Szene `Standhaft` im Projekt. Editor-Prüfung und WebGL-Build offen. |
| Tank Trouble (`tanks`) | C#-Port von `tankTrouble.ts` in 50-ms-Schritten. 7 × 11 Zellen, Abpraller, zerstörbare Ziegel, Extras, Respawn mit Schild und drei Bots mit Labyrinth-Pfadsuche. Übersicht auf das ganze Feld, links fahren, rechts ziehen und zum Schießen loslassen. Der Ziellaser reicht bis zur ersten Mauer. Sieben Abschüsse oder Zeitwertung mit höchstens 30 s Stechen. | Szene `TankTrouble` im Projekt, C#-Regelkern geprüft. Editor-Prüfung und WebGL-Build offen. |

Dazu kommt **Roll It Up! (Unity)** (`rollitup`, Szene `RollItUp`): die Bauschale als Unity-Brett. Nur für Admin/Entwicklung sichtbar (`canDevelop`) unter **Frei ausprobieren**; startet eine Testpartie mit Bots am lokalen Tisch. Regeln, Bots, Items, Inventar/Menü und die Minispiele zwischen den Runden bleiben unverändert in der App (`shared/party.ts` über die Raumautorität); Unity zeichnet nur Schale, Felder, Stationen, Figuren, Würfel und die Brett-Entscheidungen.

Was Unity hier anders macht: echte Physik (Wippen mit Gelenk, Türsplitter als Rigidbodies, Platten fallen wirklich durch Löcher), eine Toon-Shaderfamilie für das ganze Bild mit Echtzeitschatten, HDR-Bloom, Nebel und Partikeln, Kameraschütteln und Hit-Stop, zur Laufzeit synthetisierte Geräusche und Musik, UI-Toolkit-HUD mit Mehrfinger-Touch.

### Reihenfolge der Umstellung

Begründung: zuerst Spiele, die am meisten von 3D/Physik gewinnen und eine gemeinsame Basis legen; flache Reaktions- und Draufsichtspiele zuletzt. Nach den ersten fünf gab es eine Rückmeldungsrunde.

| # | Spiel | Stand |
| --- | --- | --- |
| 1 | Sumo Smash | umgesetzt (Nov. 2026) |
| 2 | Bumper Mayhem | umgesetzt (Nov. 2026) |
| 3 | Bomb Arena | umgesetzt (Nov. 2026) |
| 4 | Schneeballschlacht | umgesetzt (Nov. 2026) |
| 5 | Tower Tumble | umgesetzt (Nov. 2026) |
| 6 | Tower Tumble – Survival | umgesetzt (Nov. 2026) |
| 7 | Türenlotto | umgesetzt (Nov. 2026) |
| 8 | Kreiselkurs | umgesetzt (Nov. 2026) |
| 9–13 | Parcours-Läufe Geisterpfad, Fallklappen, Windkanal, Kletterwand, Glibberflut | offen; Streckendaten liegen schon als JSON vor, es fehlen Geisterplatten-, Klappen-, Wind-, Griff- und Glibber-Aufbau im `CourseBuilder` sowie die zugehörigen Bot-Regeln |
| 14 | Standhaft | Unity-Szene im Projekt, WebGL-Build offen |
| 15 | Arrow Masters | offen |
| 16–17 | Neon Racer, Neon Racer – Kippen | offen |
| 18–19 | Tank Trouble, Turmsicht | Unity-Szene für Tank Trouble im Projekt, WebGL-Build offen. Turmsicht offen. |
| 20–22 | Light Trails, Neon Pong, Quick Draw | offen |

Floor is Lava ist bereits umgesetzt; Wippenwerk, Hook Wars, Chaos Run und die klassischen Arenen gehören zur ersten Generation und werden nicht umgestellt.

### Abweichungen nach Rückmeldung (Nov. 2026)

Nur in den Unity-Fassungen; die Web-Fassungen bleiben unverändert, bis über eine Übernahme entschieden ist.

| Spiel | Rückmeldung | Änderung |
| --- | --- | --- |
| Tower Tumble | Steine springen umher und fallen herunter | Unity-2D-Physik (Box2D, 60 Hz, 12/6 Iterationen) statt PhysX; Steine setzen 2 cm über dem Kontakt auf statt minimal überlappend, Aufsetztempo höchstens 4 m/s. Die Darstellung bleibt 3D. |
| Sumo Smash | Nach einem Treffer rettet man sich mit einem Stoß | Kein Stoß, solange man nach einem Treffer rutscht (`CanAct`; gilt auch für den Turbo in Bumper Mayhem) |
| Bumper Mayhem | Langweilig, jede Kollision soll abprallen | Gummi-Elastizität 0,95 statt 0,5; jeder Kontakt stößt beide Autos um mindestens 2,6 m/s auseinander (0,6 × Annäherung); harte Treffer stärker (1,3 × statt 0,9 ×, höchstens 14), der Rammer prallt zurück; Wackeln, Funken und Ton je nach Stärke |
| Schneeballschlacht | Man trifft zu einfach | Der eigene Wurf rastet nur noch bis ±11° um die Blickrichtung ein (vorher ±66°) und hält laufende Gegner nicht mehr vor; Bots unverändert |

## Regeln

- **Regeln und Werte** aus `shared/` übernehmen (Tempo, Abklingzeiten, Wertung, Bot-Logik). Abweichungen hier unter „Offen“ oder im [Minispiel-Konzept](docs/minigames/konzept.md#unity-tests) festhalten. Unity-Spiele verwenden weder `roomCore` noch Raumautorität; online spielbar werden sie erst nach eigener Abstimmung.
- **Figuren:** nur [freigegebene Figuren](docs/approved-character-design.md) aus `public/models` (Basismenschen, Kleidungsmaske in Spielerfarbe). Keine neuen Modelle ohne Freigabe. Die in der App gewählte Figur kommt über `?figur=`; andere Wahl → Basismensch nach Farbplatz.
- **Oberfläche:** Touch auf getrennten Handys zuerst, keine Tastatur- oder PC-Bedienung. Hochkant zuerst, Touch-Ziele ≥ 44 px. HUD und Menüs in den Inselwelt-Materialien (Gold = Hauptaktion, Stein = Nebenaktion, Glas = Status, Papier = Texttafeln) mit Lilita One und Lexend. Oben rechts bleibt frei für den Zurück-Knopf der App. `?ruhig=1` (reduzierte Bewegung, von der App aus `prefers-reduced-motion` gesetzt) schaltet Kameraschütteln, Hit-Stop, Neigen/Stauchen der Figuren und Plattenwackeln ab und reduziert Partikel, ohne das Spielergebnis zu ändern.
- **Gestaltung und Spielgefühl:** bei Gameplay, Licht, Effekten, Ton und Menüs den Skill `craft-game-floors` laden (Palette aus `Palette.cs` als einzige Farbquelle, keine Standardmaterialien/-skybox). Fehlt er, in der Übergabe nennen.
- **Roll It Up!-Brücke:** Unity rechnet keine Regeln. `src/unityRollItUp.ts` macht aus dem Partiezustand einen flachen Schnappschuss für `JsonUtility` (keine Maps, keine optionalen Felder) und prüft jede Aktion aus Unity, bevor sie an die Raumautorität geht: nur `roll`, `path`, `supply`, `shop`, `gift`, `next` im eigenen Zug und in passender Phase. Items einsetzen, Inventar, Set und Menü öffnen die React-Tafeln (`panel`-Nachricht). Nachrichten laufen per `postMessage` nur zwischen App und eigenem iframe (gleiche Herkunft, Absender geprüft; `Plugins/WebGL/GSGBridge.jslib`). Bewegung folgt den Zeitstempeln des Raums (`departAt`/`arriveAt`, Uhrabgleich über `serverNow`); der Würfel landet immer auf dem Raumergebnis. Der Build bleibt die ganze Partie geladen und wird während der Minispiele nur versteckt (Bildrate 4, Ton aus).
- **Vorher absprechen:** Unity-Pakete (`unity/GoldenSchmidtUnity/Packages/manifest.json`), Unity-Version, die gelockerte CSP unter `/unity/` (`server/index.ts`), Einträge außerhalb von „Frei ausprobieren“ sowie Online-/Raumanbindung.
- **Nie einchecken:** `Library/`, `Temp/`, `Logs/`, `Builds/`, `UserSettings/`, `Screenshots/`, `Data/` (siehe `unity/GoldenSchmidtUnity/.gitignore`). Generierte Großdaten nicht duplizieren: Animationen kommen direkt aus `anims.glb` (keine kopierten `.anim`-Dateien).
- **Codesuche:** `public/unity/**/Build/`, `unity/**/*.unity` und `unity/**/*.glb` bei allgemeinen Suchen auslassen und nur gezielt lesen.

## Projekt

`unity/GoldenSchmidtUnity`: Unity **6000.6.10f1**, Vorlage Universal 3D (URP), Ziel WebGL, Cinemachine 3.1, Input System, glTFast 6.21, Pipeline 1.0.1 (Agentensteuerung über die Unity CLI). Kein Unity-Cloud-Link, keine Unity-Dienste.

| Ort | Inhalt |
| --- | --- |
| `Assets/GSG/Scripts/Runtime/Common` | `Palette`, `Hud` (UI Toolkit + Touch, Spielerleiste, Tasten links), `CameraRig` (Cinemachine), `Figure`, `Sfx` (Synthese), `Fx` (Partikel, Shake, Hit-Stop), `SceneLook`, `AppLink` (URL-Parameter), `GameSwitch` (Startszene, `?spiel=`), `MatchGame` + `Seat` (Spielhülle: Titel, Countdown, Pause, Endtafel, Spieler gegen Bots), `Kit` (Toon-Materialien, Grundkörper, erzeugte Meshes mit neutraler UV) |
| `Assets/GSG/Scripts/Runtime/Parcours` (Läufe) | `CourseData` (JSON-Spiegel von `parcoursCourses.ts`) + `CourseBuilder` (Strecke aus den Daten mit den Probelevel-Hindernissen), `RunGame` (Lauf gegen Bots, `IRaceHost`); `ParcoursRunner` lässt sich per `bot` von außen steuern |
| `Assets/GSG/Resources/GSG/Courses` | Streckendaten aller Läufe als JSON; nach Änderungen an `parcoursCourses.ts` neu erzeugen (`npx tsx scripts/unity-export-courses.ts`; `npm run test:rules` meldet veraltete Dateien) |
| `Assets/GSG/Scripts/Runtime/Ring`, `Bombs`, `Snow`, `Tower` | Regel-Ports (`RingSim`, `BombSim`, `SnowSim`) und Spiele (`RingGame` für Sumo/Bumper, `BombGame`, `SnowGame`, `TowerGame`) |
| `Assets/GSG/Scripts/Runtime/Parcours` | `ParcoursRunner`, Hindernisse (je Datei ein MonoBehaviour), `ParcoursLevel` (Aufbau aller Stationen), `ParcoursGame` (Ablauf) |
| `Assets/GSG/Scripts/Runtime/Lava` | `LavaTile`, `LavaRunner`, `LavaGame` (Regeln, Bots, Ablauf) |
| `Assets/GSG/Scripts/Runtime/RollItUp` | `RollModels` (Spiegel von `src/unityRollItUp.ts`), `RollBridge` (Nachrichten), `RollWorld` (Bauschale nach `src/three/rollingTray.ts`), `RollUi` (Kopfzeile, Spielerliste, Entscheidungskarte, Beschriftungen), `RollGame` (Figuren, Würfel, Kamera, Feldinfo per Tipp) |
| `Assets/GSG/Plugins/WebGL` | `GSGBridge.jslib` (`postMessage` zwischen App und Build) |
| `Assets/GSG/Scripts/Editor` | `GSGSetup` (Materialien, Figuren-Prefabs, Szenen, Projekt-/WebGL-Einstellungen), `GSGPlaytest` (Mechanik-Prüfung im Play Mode) |
| `Assets/GSG/Shaders` | `GSG/Toon`, `GSG/Outline`, `GSG/Glow` (Lava/Glibber), `GSG/Sky`, `GSG/Particle` |
| `Assets/GSG/Resources/GSG` | Materialien, Figuren-Prefabs, Schriften, HUD-Stylesheets (`Hud.uss`, `Roll.uss`), Panel-Einstellungen, `RollDemo.json` (vorbereitete Brettzustände für Editor und `?demo=1`) |
| `Assets/WebGLTemplates/GSG` | Startseite ohne Inline-Skript (CSP), Ladebalken, Pixeldichte ≤ 2 |

Menü **GSG → 1 Alles einrichten** (oder `GSGSetup.All()`) baut Materialien, Figuren, alle Szenen und die WebGL-Einstellungen reproduzierbar neu. Einzelschritte: Menü GSG 2–10 (9 = Startszene, 10 = Szenen der Match-Spiele aus `MatchScenes`).

Eigene Meshes (Drehkörper, Hügel, Steine) brauchen UV-Koordinaten: `GSG/Toon` zeichnet die Comic-Kante dort, wo die UV 0 oder 1 erreicht – ohne UV wird die ganze Fläche schwarz. `RollWorld` setzt deshalb eine neutrale UV.

## Neues Unity-Minispiel anlegen

1. Regeln aus `shared/matches/<spiel>.ts` als C#-Port übernehmen (gleiche Konstanten, Zeit in ms, 50-ms-Schritte, Bots), nur wo Unity klar gewinnt eigene Physik (z. B. Tower Tumble). Laufzeitcode in `Assets/GSG/Scripts/Runtime/<Spiel>/`. Ein MonoBehaviour pro Datei, Dateiname = Klassenname (sonst kann der Player-Build abstürzen).
2. Das Spiel erbt von `MatchGame` (Titel, Countdown, Pause, Endtafel, `Seat.Roster`) und baut seine Welt mit `Kit`.
3. Szene in `GSGSetup.MatchScenes` und `BuildMatchScenes` eintragen; `Project()` nimmt sie in die Build-Einstellungen. Eintrag in `GameSwitch.Scenes` (`id` → Szenenname).
4. Eintrag in `src/unityGames.ts`. `npm run test:rules` prüft Szene, GUID und aktive Build-Einstellung. Einträge mit `pendingBuild` werden erst zusammen mit dem aktualisierten WebGL-Build freigeschaltet, danach startet die Browserprüfung auch diese Einträge.
5. Build erzeugen (unten), [Prüfungen](#prüfungen) ausführen, diese Datei und betroffene Doku nachführen.

## Arbeitsumgebung (Cloud-Sitzung)

- Umgebung **„GoldenSchmidtGames (Unity)“** verwenden. Sie erlaubt die Unity-Hosts: `unity.com`, `public-cdn.cloud.unity3d.com`, `download.unity3d.com`, `beta.unity3d.com`, `services.api.unity.com`, `api.unity.com`, `login.unity.com`, `id.unity.com`, `core.cloud.unity3d.com`, `license.unity3d.com`, `activation.unity3d.com`, `packages.unity.com`, `download.packages.unity.com`, `cdn.packages.unity.com`, `live-platform-api.prd.ld.unity3d.com`, `public-stevedore.unity3d.com`, `services.unity.com`, `cloud.unity.com`, `accounts.unity3d.com`.
- Unity CLI: Installskript von `https://unity.com/install.sh` herunterladen, lesen, dann ausführen (landet in `~/.local/bin`). Editor: `unity install 6000.6.10f1 --module webgl --yes` (≈ 5,8 GB, im Hintergrund starten).
- Anmeldung: `unity auth login --insecure-storage` im Hintergrund starten, den ausgegebenen Link an die Person weitergeben. **Der Link gilt nur ca. 10 Minuten**; wer noch kein Konto hat, legt es vorher auf `https://id.unity.com` an und meldet sich dann. Es muss keine Adresse zurückkopiert werden. Danach `unity license activate --personal --accept-eula` – nur nach ausdrücklicher Zustimmung der Person zur Unity-Personal-EULA.
- Editor ohne Bildschirm dauerhaft starten (mit Software-OpenGL für Aufnahmen):

  ```bash
  xvfb-run -a -s "-screen 0 1280x900x24" ~/Unity/Hub/Editor/6000.6.10f1/Editor/Unity -batchmode -projectPath unity/GoldenSchmidtUnity -logFile editor.log
  ```

  Bereitschaft: `unity status --until-ready --project-path <Pfad>`. Steuerung: `unity command script eval`, `unity recompile`, `unity command editor.playmode start|stop`, `unity command capture game_view`. Vor dem Play Mode `unity command editor set_auto_tick`; Handy-Auflösung über `UnityEditor.PlayModeWindow.SetCustomRenderingResolution(540, 1080, "Handy")`. Hintergrundprozesse einer Agenten-Sitzung enden nach höchstens 2 Stunden – dann Editor neu starten.
- Am Ende `unity close <Pfad>` (schreibt Projekteinstellungen sauber). Die Personal-Lizenz belegt einen Aktivierungsplatz; bei Bedarf `unity license return`.

## Bauen und ausliefern

1. Plattform einmal auf WebGL umstellen: `unity command build.target switch -- --target WebGL --confirm true`.
2. Vor jedem Build warten, bis der Editor bereit ist (kein Kompilieren, keine Domain-Reload) – sonst „Error building Player because scripts are compiling“ oder „No Pipeline instance found“.
3. **Ein gemeinsamer Build mit allen Szenen der Build-Einstellungen, Startszene zuerst**, nach `unity/GoldenSchmidtUnity/Builds/spiele/`, danach nach `public/unity/spiele/` kopieren (vorher den alten Ordner löschen).

   ```bash
   unity command build run --project-path <Pfad> -- --target WebGL --output-path <Pfad>/Builds/spiele --scenes '["Assets/GSG/Scenes/Start.unity", "…alle weiteren aus EditorBuildSettings…"]' --confirm true
   unity command build status --project-path <Pfad>   # bis "status: completed" und die buildId passt
   ```

4. Die Builds mit dem Quellstand einchecken. CI und Render bauen sie nicht.
5. Einstellungen (setzt `GSGSetup.Project()`): Gzip mit Entpack-Rückfall, Dateinamen mit Inhalts-Hash, Datencache, keine Ausnahmen, IL2CPP „Optimize Size“, WebGL-Codeoptimierung „Disk Size with LTO“, Managed Stripping „High“, Engine-Code-Stripping, kein Splash-Bildschirm, Qualitätsstufe „Mobile“ mit HDR und Schatten.
6. Streckendaten nach Änderungen an `shared/matches/parcoursCourses.ts` neu exportieren: `npx tsx scripts/unity-export-courses.ts` (flaches JSON nach `Resources/GSG/Courses/<id>.json`; nicht gesetzte Indizes = −1). `npm run test:rules` schlägt fehl, solange die Dateien veraltet sind.
7. `RollDemo.json` nach Änderungen an `src/unityRollItUp.ts` neu erzeugen (Felder müssen zu `RollModels.cs` passen); die Brücke selbst prüft `npm run test:rules` (`scripts/unity-roll-it-up-test.ts`).

Auslieferung: Der Server erlaubt **nur unter `/unity/`** WebAssembly (`'wasm-unsafe-eval'`), `blob:`-Skripte und das Einbetten im eigenen App-Rahmen (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`); die App selbst bleibt streng. `Build/`-Dateien sind ein Jahr cachebar. `.unityweb`-Dateien gehen mit `Content-Encoding: gzip` (und `application/wasm` für den Code) hinaus: Der Browser entpackt selbst und übersetzt WebAssembly schon während des Downloads. Der Service Worker nimmt `unity/**` nicht in den Offline-Cache und leitet Navigationen nach `/unity/` nicht auf die App um. Andere Hoster brauchen dieselben Header ([Deployment](DEPLOYMENT.md#node-starten)). Der erste Start lädt ca. 12 MB für alle Spiele zusammen (Engine-Code ≈ 7,2 MB, Daten ≈ 4,4 MB; neue Szenen sind klein, weil ihre Welt zur Laufzeit entsteht); weitere Spiele kommen danach aus dem Browser-Cache. Jeder Neubau legt den ganzen Build neu im Repository ab, deshalb Spiele gesammelt bauen und nicht für Kleinigkeiten. Startzeit bis spielbereit (Chromium-Emulation, 4× gedrosselte CPU, 30 Mbit/s, 40 ms): Parcours 8,4 s → 6,4–7,1 s, Floor is Lava 7,4 s → 6,2–6,4 s, Bauschale 6 s. Die Bauschale lädt verdeckt schon während des Auftakt-Minispiels.

## Prüfungen

| Schritt | Prüfung |
| --- | --- |
| Unity-Code | `unity recompile` ohne Fehler; Editor-Play-Mode mit `GSGPlaytest.Start("all")` (Parcours) bzw. Durchlauf mit Wertung (Floor is Lava); Aufnahmen hochkant prüfen |
| Standhaft | Im Editor einen Durchgang spielen. Balkenstarts nach 3 und 20 s, Klappenwarnung und gestaffelte Öffnung ab 12 s, Ausscheiden ohne Wiedereinstieg und Ergebnis prüfen. |
| Tank Trouble | C#-Regelkern separat mit .NET 8 prüfen (Befehle unten). Im Editor und im neuen Build gleichzeitig fahren und zielen, kurz tippen, einen Schuss abprallen lassen sowie Respawn und Ergebnis prüfen. |
| Build | gemeinsamer Build erzeugt und nach `public/unity/spiele/` kopiert |
| App | `npm run build`, `npm run test:production` (Header, Content-Encoding, Dateien, PWA-Ausschluss), dann `npm run test:browser -- tests/browser/unity-games.spec.ts` |
| Roll It Up! (Unity) | `npm run test:rules` (Brücke), Editor-Vorschau mit `RollDemo.json` (`DemoAdvance()` schaltet Zustände weiter), dann `npm run test:browser -- tests/browser/unity-roll-it-up.spec.ts` (Einstieg nur mit Entwicklerkonto, Brett lädt, Würfeln per Touch im Build) |
| Touch | Start-Tipp, Stick und Aktionstaste im WebGL-Build per Chromium-Touch (CDP `Input.dispatchTouchEvent`); `?debug=1` protokolliert jeden Finger in der Browser-Konsole |
| Echte Handys | Bildrate, Ladezeit, Wärme und Touch-Gefühl; Browseremulation mit Software-GPU belegt keine Leistung |

Nach Änderungen in `public/` vor Server-/Browserprüfungen `npm run build` ausführen: Der Server liefert `dist/`, nicht `public/`.

C#-Regeltest für Tank Trouble ohne Editor, im Repository-Stamm ausführen.

```sh
dotnet build scripts/unity-tank-sim-test --artifacts-path .artifacts/unity-tank-sim-test
dotnet .artifacts/unity-tank-sim-test/bin/TankSim.Tests/debug/TankSim.Tests.dll
```

## Stolpersteine

- **Play Mode ohne Domain-Reload:** statische Felder überleben zwischen Play-Mode-Starts.
- **Editor-Skripte** lassen sich im Play Mode nicht als Komponente anhängen; Prüfabläufe als Coroutine auf einem Laufzeitobjekt starten (wie `GSGPlaytest`).
- **Figuren:** Die Clips aus `anims.glb` adressieren Knochen als `Node-0/root/…`; die Prefabs haben deshalb eine `Node-0`-Ebene unter `Armature`. Nach dem Neubau eines Prefabs kann der Editor eine veraltete Kopie halten – `AssetDatabase.ImportAsset(..., ForceUpdate)`.
- **Bewegungseinflüsse** (Wind, Förderband, Plattformen) als Zusatz auf die eigene Geschwindigkeit legen und vor dem nächsten Schritt wieder abziehen, sonst summieren sie sich auf.
- **Gelenkfedern** (`HingeJoint.spring`) im Play Mode nachmessen: Die Wippen brauchen Feder/Dämpfer 6500/900, damit sie unter einer Figur am Rand ≈ 14° kippen statt bis zum Anschlag.
- **Touch:** Ein kurzer Tipp kann zwischen zwei Bildern beginnen und enden – das HUD wertet ihn trotzdem. Ebenen über dem Canvas (`#gsg-loading`) müssen wirklich verschwinden (`[hidden] { display: none }`), sonst kommt keine Berührung an.
- **Template:** keine Inline-Skripte (CSP); Build-Dateinamen über `data-`-Attribute an `TemplateData/boot.js` geben.

## Offen

- Auf echten Handys Bildrate, Ladezeit, Akku/Wärme und Touch-Gefühl beurteilen; danach Schatten, MSAA oder Renderauflösung anpassen.
- Bewertung Unity vs. Web gemeinsam festhalten; erst danach über Online-Mehrspieler entscheiden (eigene Netzwerkschicht oder Anbindung an `roomCore`).
- Parcours-Stand vor #40: getimtes Festhalten, Lücken länger als Sprung + Hechten, Serpentinen-Glibberflut und Ventilatoren mit Anlauf sind noch nicht nachgezogen.
- Kein Offline-Betrieb, keine Online-Räume. Seit Unity 6 ist der Splash-Bildschirm auch mit Unity Personal abschaltbar und aus.
- Roll It Up! (Unity): nur Testpartie mit Bots am lokalen Tisch; Online-Räume, Wiederbeitritt und Handy-Hosting mit Unity-Brett sind nicht geprüft. Kameradrehen per Wischen, Zoomen mit zwei Fingern, Feldinfo per Tipp; die Feldliste/Regeltafel der Web-Bauschale fehlt noch.
