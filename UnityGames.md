# Unity-Minispiele

Verbindlich für alle Arbeiten an Unity-Minispielen und am Unity-Brett von Roll It Up! (`unity/`, `public/unity/`, `src/unityGames.ts`, `src/unityRollItUp.ts`, `UnityGameScreen`, `UnityRollItUpBoard`, CSP und Header unter `/unity/`). Gilt für Menschen sowie Codex und Claude Code zusätzlich zu [AGENTS.md](AGENTS.md) und den [Designregeln](designregeln.md).

## Zweck

Alle Minispiele außerhalb der ersten Generation (`NEW_MATCH_IDS` in `shared/minigameCatalog.ts`) werden schrittweise als Unity-Fassung umgesetzt: jedes ein **eigenständiges Minispiel** in **einem gemeinsamen WebGL-Build** (`public/unity/spiele/`, `?spiel=<id>` wählt die Szene), in der App als **Testbereich nur für Admin und Entwicklung** unter **Lokal spielen → Unity-Minispiele** (`src/unityGames.ts` ist die Liste der freigeschalteten Spiele). Sie laufen lokal gegen Bots: keine Räume, kein Zufallspool, kein Offline-Cache. Die Web-Fassungen bleiben unverändert. Danach wird ein Spiel nach und nach zur [Darstellung im Raum](#unity-als-darstellung-im-raum) umgestellt.

Unity bringt echte Physik (Wippen mit Gelenk, Türsplitter, durchfallende Platten), eine Toon-Shaderfamilie mit Echtzeitschatten, HDR-Bloom, Nebel und Partikeln, Kameraschütteln und Hit-Stop, synthetisierte Geräusche/Musik und ein UI-Toolkit-HUD mit Mehrfinger-Touch.

## Spiele und Stand

Reihenfolge: zuerst Spiele, die am meisten von 3D/Physik gewinnen; flache Reaktions- und Draufsichtspiele zuletzt. Regeln und Werte stammen aus `shared/`, Abweichungen stehen in der letzten Spalte.

| Spiel (`id`, Szene) | Stand | Besonderheit der Unity-Fassung |
| --- | --- | --- |
| Parcours-Probelevel (`parcours`, `ParcoursProbe`) | umgesetzt | 15 Stationen mit allen Hindernisarten, allein, Kontrollpunkte und Bestzeit. Stand vor getimtem Festhalten, langen Lücken, Serpentinen-Glibberflut und Ventilatoren mit Anlauf. |
| Floor is Lava (`lava`, `FloorIsLava`) | im Raum + Testbereich | Testbereich: Regeln/Bots aus `floorIsLava.ts` mit echter Physik, du gegen drei Bots. Im Raum 3rd Person (Kamera hinter dem eigenen Läufer, zu jedem Durchgang neu ausgerichtet) oder Draufsicht (schräg über der eigenen Etage); Platten folgen der Ziffernfolge des Schnappschusses, Sprung-, Hecht- und Fallbögen den Zeiten des Raums, Hechten geht als Spielbefehl (`command`) an den Raum. |
| Sumo Smash (`sumo`, `SumoSmash`) | im Raum + Testbereich | C#-Port `Ring/RingSim.cs`; Podest über einem See. Im Raum Draufsicht oder 3rd Person (Kamera hinter dem eigenen Sumo, Wischen dreht). Die Rückmeldungsregeln gelten auch in `shared/`: kein Stoß, solange man nach einem Treffer rutscht. |
| Bumper Mayhem (`bumpercars`, `BumperMayhem`) | im Raum + Testbereich | Gleicher Ringkern; Gummi-Elastizität 0,95, jeder Kontakt stößt beide um ≥2,6 m/s auseinander, harte Treffer × 1,3 (≤14), Rammer prallt zurück; kein Turbo im Rutschen – alles auch in `bumperMayhem.ts`. Im Raum Draufsicht oder 3rd Person; Abprall-Effekte entstehen aus Tempo-Sprüngen zwischen Schnappschüssen. |
| Bomb Arena (`bombs`, `BombArena`) | im Raum + Testbereich | C#-Port `Bombs/BombSim.cs`. Im Raum Draufsicht; Kisten, Explosionen und schließende Mauern ergeben sich aus den Änderungen zwischen Schnappschüssen. |
| Schneeballschlacht (`snowball`, `Schneeballschlacht`) | im Raum + Testbereich | C#-Port `Snow/SnowSim.cs`. Menschen werfen nur bis ±11° um Ziel bzw. Blick eingerastet und ohne Vorhalt, Bots mit Zielhilfe und Vorhalt – auch in `snowball.ts` (`MatchPlayer.bot`). Im Raum 3rd Person oder Draufsicht; Zielen per Ziehen fehlt in Unity noch (Tipp-Wurf). |
| Tower Tumble (`tower`, `TowerTumble`) | umgesetzt | Unitys 2D-Physik (Box2D, 60 Hz, 12/6 Iterationen, Reibung 0,9, Schwerkraft 18) statt `physics2d.ts`; Steine setzen 2 cm über dem Kontakt auf, höchstens 4 m/s. |
| Tower Tumble – Survival (`towersurvival`, `TowerSurvival`) | umgesetzt | Wie Tower Tumble mit Survival-Regeln, vorsichtigere Bots. |
| Türenlotto (`tuerenlotto`, `Tuerenlotto`) | im Raum + Testbereich | Strecke aus `Resources/GSG/Courses/tuerenlotto.json`; Bots nach `parcoursBot`. Im Raum 3rd Person: `ParcoursOnline` setzt die Läufer (`RemoteRacer`) aus dem Schnappschuss, Türen und Geheimböden folgen den öffentlichen Zuständen (die Geheimnisse bleiben bei der Raumautorität), Schieber, Inseln und Drehbalken der Raumzeit (`CourseClock`). |
| Kreiselkurs (`kreiselkurs`, `Kreiselkurs`) | im Raum + Testbereich | Gleicher Lauf-Rahmen; Bots scheitern gelegentlich an den Inseln. Im Raum wie Türenlotto; Wippen neigen sich nach dem Raum. |
| Standhaft (`standhaft`, `Standhaft`) | im Raum + Testbereich | 25 Fallklappen von außen nach innen, zwei zeitversetzte Drehbalken; im Testbereich Läufer mit Rigidbody-Kollision, Balken nach App-Kontaktmodell. Im Raum 3rd Person (Kamera hinter dem eigenen Läufer, nach dem Ausscheiden über der Fläche) oder Draufsicht; Klappen und Balken nach der Raumzeit. |
| Tank Trouble (`tanks`, `TankTrouble`) | im Raum + Testbereich | Normales Minispiel mit Unity-Darstellung (siehe unten). Draufsicht; 3rd Person (Kamera hinter dem eigenen Panzer) und 1st Person (aus der Luke) mit den Turmsicht-Regeln: jedes Gerät sieht nur den eigenen Sichtbereich. |
| Geisterpfad, Fallklappen, Windkanal, Kletterwand, Glibberflut | offen | Streckendaten liegen als JSON vor; im `CourseBuilder` fehlen Geisterplatten, Klappen, Wind, Griffe, Glibber und die Bot-Regeln. |
| Arrow Masters; Neon Racer (+ Kippen); Light Trails, Neon Pong, Quick Draw | offen | in dieser Reihenfolge |

## Unity als Darstellung im Raum

Entscheidung „App rechnet, Unity zeigt“: Die Raumautorität rechnet wie bei allen Minispielen mit `shared/`; ein dauerhaft geladener Unity-Rahmen (`UnityMatchHost`, `?spiel=online`) zeichnet die Schnappschüsse (`src/unityMatch.ts`, `src/matches/unityWorld.ts`, Unity `MatchBridge`). Sobald die Unity-Szene steht („playing“), übernimmt **Unitys eigenes HUD**: Stick, Tasten, Zielen, 3-2-1 zum Startsignal des Raums, Spielerleiste, Töne, Effekte und Kurzmeldungen kommen aus Unity; Eingaben gehen als `input`/`press`/`command` geprüft an die Raumautorität. Die App blendet Steuerung, Countdown, Rückmeldungen und eigene Töne aus und behält oben rechts Ton und Menü (Aufgeben); Ergebnis und Vibration bleiben in der App. Bis Unity bereit ist, gilt die App-Steuerung. So laufen Online-Räume, Handy-Hosting, Wiederbeitritt, Inselparty und „Allein mit Bots“ ohne eigene Netzwerkschicht. Der Host wählt in der Intro-Tafel vor „Ich bin bereit“ (und im Spielmenü ☰) **Variante** (Unity/Web) und **Ansicht** (Draufsicht, 3rd, 1st Person) für alle (`shared/minigameLooks.ts`, Aktion `look`); Standard ist Unity, wo es eine Unity-Darstellung gibt. Ansichten sind Einstellungen, keine eigenen Minispiele. Schlägt Unity fehl (kein Internet, kein WebGL, nach 25 s nicht bereit), übernimmt die Web-Darstellung. Umgestellte Spiele bleiben zusätzlich im Testbereich gegen Bots (nur Admin/Entwicklung).

Erste Generation (klassische Arenen, Wippenwerk, Hook Wars, Chaos Run) wird nicht umgestellt.

**Pilot „Unity · Host rechnet“ (Floor is Lava):** dritte Variante neben Unity und Web, nur online. Die Unity-Szene auf dem Handy des Hosts simuliert mit ihrer Physik für alle (`LavaGame.Host.cs`, wie der Testbereich); die eigene Figur des Hosts folgt Unitys HUD sofort, die anderen Handys schicken ihre Eingaben wie immer an den Raum, die Bots des Raums steuert die Szene. Das Relais-Modul `lavahost` (`shared/matches/lavaHost.ts`) gibt nur dem Host die Eingaben aller (`inputs`), der Host meldet 25 Zustände pro Sekunde mit `party:unity` im Format von `unityLavaSnapshot` plus Höhe `h` aus der Physik (`physical`); der Raum reicht Eingaben der Mitspieler (`party:unity-input`, nur an den Host) und geprüfte Zustände (`party:unity-snap`, an alle anderen) sofort weiter, statt auf den 50-ms-Takt zu warten (bei Handy-Hosting über den Echtzeitkanal); `applyPartyUnity` prüft Absender, Läufer, Werte und Ereignisse (`checkedHostSnap`), alle anderen zeichnen wie bei „Unity“. Die Punkte des letzten Zustands werten; die Endmeldung oder das Zeitlimit (+20 s Ladezeit) beendet das Spiel. Fällt Unity beim Host aus (kein WebGL, Ladefehler), rechnet der Raum ab dann mit `floorIsLava.ts` und Unity zeichnet nur; ohne Unity zeichnet ein Mitspieler die Meldungen im Web (`lavaFromHostSnap`). Grenzen: Das Host-Handy muss im Vordergrund bleiben und wird stärker belastet; verlässt der Host den Raum, endet das Spiel mit dem Zeitlimit; ein neu geladener Host setzt Punkte und Durchgang aus dem letzten Zustand fort. In beiden Unity-Varianten läuft die eigene Figur auf jedem Gerät sofort mit dem eigenen Stick und den eigenen Tasten (`LavaGame.Predict.cs`, Werte aus `floorIsLava.ts`) und wird sanft an die Position des Raums bzw. Hosts angeglichen, um die gemessene Verzögerung vorausgerechnet; Schubser und Stürze kommen nur vom Raum. Der Vergleich mit „Unity“ auf echten Handys entscheidet, welcher Weg bleibt.

**Roll It Up! (Unity)** (`rollitup`, Szene `RollItUp`): Bauschale und Grinder (Wahl in der Testlobby) als Unity-Brett, nur für Admin/Entwicklung (`canDevelop`) im selben Untermenü; startet eine Testpartie mit Bots. Die Brücke sendet Brett-ID und Rohrpost-Paare, `RollWorld` baut danach die Szenerie (Grinder: Stahlscheibe, Mahlzähne, Rohrpost-Bögen, Lounge). Regeln, Bots, Items und Minispiele bleiben in der App (`shared/party.ts`); Unity zeichnet Schale, Felder, Stationen, Figuren, Würfel und Brett-Entscheidungen.

## Regeln

- **Regeln und Werte** aus `shared/` übernehmen (Tempo, Abklingzeiten, Wertung, Bot-Logik). Abweichungen in der Tabelle „Spiele und Stand“ festhalten. Die Einträge im Unity-Untermenü rechnen lokal mit ihren C#-Ports und verwenden weder `roomCore` noch Raumautorität. Im Raum zeichnet Unity nur (Ausnahme: Pilot „Unity · Host rechnet“); gewünschte Abweichungen (C#-Ports, Tower-Tumble-Physik, Läufer) müssen dafür erst in `shared/` übernommen werden.
- **Figuren:** nur [freigegebene Figuren](docs/approved-character-design.md) aus `public/models` (Basismenschen, Kleidungsmaske in Spielerfarbe). Keine neuen Modelle ohne Freigabe. Die in der App gewählte Figur kommt über `?figur=`; andere Wahl → Basismensch nach Farbplatz.
- **Oberfläche:** Touch auf getrennten Handys zuerst, keine Tastatur- oder PC-Bedienung. Hochkant zuerst, Touch-Ziele ≥ 44 px. HUD und Menüs in den Inselwelt-Materialien (Gold = Hauptaktion, Stein = Nebenaktion, Glas = Status, Papier = Texttafeln) mit Lilita One und Lexend. Oben rechts bleibt frei für den Zurück-Knopf der App. `?ruhig=1` (reduzierte Bewegung, von der App aus `prefers-reduced-motion` gesetzt) schaltet Kameraschütteln, Hit-Stop, Neigen/Stauchen der Figuren und Plattenwackeln ab und reduziert Partikel, ohne das Spielergebnis zu ändern.
- **Gestaltung und Spielgefühl:** bei Gameplay, Licht, Effekten, Ton und Menüs den Skill `unity:craft-game-floors` laden (Palette aus `Palette.cs` als einzige Farbquelle, keine Standardmaterialien/-skybox). Fehlt er, in der Übergabe nennen.
- **Roll It Up!-Brücke:** Unity rechnet keine Regeln. `src/unityRollItUp.ts` macht aus dem Partiezustand einen flachen Schnappschuss für `JsonUtility` (keine Maps, keine optionalen Felder) und prüft jede Aktion aus Unity, bevor sie an die Raumautorität geht: nur `roll`, `path`, `supply`, `shop`, `gift`, `next` im eigenen Zug und in passender Phase. Items einsetzen, Inventar, Set und Menü öffnen die React-Tafeln (`panel`-Nachricht). Nachrichten laufen per `postMessage` nur zwischen App und eigenem iframe (gleiche Herkunft, Absender geprüft; `Plugins/WebGL/GSGBridge.jslib`). Bewegung folgt den Zeitstempeln des Raums (`departAt`/`arriveAt`, Uhrabgleich über `serverNow`); der Würfel landet immer auf dem Raumergebnis. Der Build bleibt die ganze Partie geladen und wird während der Minispiele nur versteckt (Bildrate 4, Ton aus).
- **Vorher absprechen:** Unity-Pakete (`unity/GoldenSchmidtUnity/Packages/manifest.json`), Unity-Version, die gelockerte CSP unter `/unity/` (`server/index.ts`), Einträge außerhalb des Unity-Untermenüs, neue Nachrichtenarten der Brücke und Änderungen an Raum, Sitzung oder Socket-Nachrichten.
- **Nie einchecken:** `Library/`, `Temp/`, `Logs/`, `Builds/`, `UserSettings/`, `Screenshots/`, `Data/` (siehe `unity/GoldenSchmidtUnity/.gitignore`). Generierte Großdaten nicht duplizieren: Animationen kommen direkt aus `anims.glb` (keine kopierten `.anim`-Dateien).
- **Codesuche:** `public/unity/**/Build/`, `unity/**/*.unity` und `unity/**/*.glb` bei allgemeinen Suchen auslassen und nur gezielt lesen.

## Projekt

`unity/GoldenSchmidtUnity`: Unity **6000.6.10f1**, Vorlage Universal 3D (URP), Ziel WebGL, Cinemachine 3.1, Input System, glTFast 6.21, Pipeline 1.0.1 (Agentensteuerung über die Unity CLI). Kein Unity-Cloud-Link, keine Unity-Dienste.

| Ort | Inhalt |
| --- | --- |
| `Assets/GSG/Scripts/Runtime/Common` | `Palette`, `Hud` (UI Toolkit + Touch, Spielerleiste, Tasten links), `CameraRig` (Cinemachine), `Figure`, `Sfx` (Synthese), `Fx` (Partikel, Shake, Hit-Stop), `SceneLook`, `AppLink` (URL-Parameter), `GameSwitch` (Startszene, `?spiel=`), `MatchGame` + `Seat` (Spielhülle: Titel, Countdown, Pause, Endtafel, Spieler gegen Bots), `Kit` (Toon-Materialien, Grundkörper, erzeugte Meshes mit neutraler UV) |
| `Assets/GSG/Scripts/Runtime/Parcours` (Läufe) | `CourseData` (JSON-Spiegel von `parcoursCourses.ts`) + `CourseBuilder` (Strecke aus den Daten mit den Probelevel-Hindernissen), `RunGame` (Lauf gegen Bots, `IRaceHost`); `ParcoursRunner` lässt sich per `bot` von außen steuern; online `ParcoursOnline` + `RemoteRacer` (Läufe und Standhaft) |
| `Assets/GSG/Resources/GSG/Courses` | Streckendaten aller Läufe als JSON; nach Änderungen an `parcoursCourses.ts` neu erzeugen (`npx tsx scripts/unity-export-courses.ts`; `npm run test:rules` meldet veraltete Dateien) |
| `Assets/GSG/Scripts/Runtime/Ring`, `Bombs`, `Snow`, `Tower` | Regel-Ports (`RingSim`, `BombSim`, `SnowSim`) und Spiele (`RingGame` für Sumo/Bumper, `BombGame`, `SnowGame`, `TowerGame`) |
| `Assets/GSG/Scripts/Runtime/Parcours` | `ParcoursRunner`, Hindernisse (je Datei ein MonoBehaviour), `ParcoursLevel` (Aufbau aller Stationen), `ParcoursGame` (Ablauf) |
| `Assets/GSG/Scripts/Runtime/Lava` | `LavaTile`, `LavaRunner`, `LavaGame` (Regeln, Bots, Ablauf) |
| `Assets/GSG/Scripts/Runtime/RollItUp` | `RollModels` (Spiegel von `src/unityRollItUp.ts`), `RollBridge` (Nachrichten), `RollWorld` (Bauschale nach `src/three/rollingTray.ts`), `RollUi` (Kopfzeile, Spielerliste, Entscheidungskarte, Beschriftungen), `RollGame` (Figuren, Würfel, Kamera, Feldinfo per Tipp) |
| `Assets/GSG/Plugins/WebGL` | `GSGBridge.jslib` (`postMessage` zwischen App und Build) |
| `Assets/GSG/Scripts/Editor` | `GSGSetup` (Materialien, Figuren-Prefabs, Szenen, Projekt-/WebGL-Einstellungen), `GSGPlaytest` (Mechanik-Prüfung im Play Mode) |
| `Assets/GSG/Shaders` | `GSG/Toon`, `GSG/Outline`, `GSG/Glow` (Lava/Glibber), `GSG/Sky`, `GSG/Particle` |
| `Assets/GSG/Resources/GSG` | Materialien, Figuren-Prefabs, Schriften, HUD-Stylesheets (`Hud.uss`, `Roll.uss`), Panel-Einstellungen, `RollDemo.json` und `RollDemoGrinder.json` (vorbereitete Brettzustände für Editor und `?demo=1`, Grinder mit `&brett=grinder` bzw. `RollGame.DemoBoard = "grinder"`) |
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

- Umgebung **„GoldenSchmidtGames (Unity)“** verwenden; sie erlaubt die Unity-Hosts für CLI, Editor, Anmeldung, Lizenz und Pakete.
- Unity CLI: Installskript von `https://unity.com/install.sh` herunterladen, lesen, dann ausführen (landet in `~/.local/bin`). Editor: `unity install 6000.6.10f1 --module webgl --yes` (≈ 5,8 GB, im Hintergrund starten).
- Anmeldung: `unity auth login --insecure-storage` im Hintergrund starten, den ausgegebenen Link an die Person weitergeben. **Der Link gilt nur ca. 10 Minuten**; wer noch kein Konto hat, legt es vorher auf `https://id.unity.com` an und meldet sich dann. Es muss keine Adresse zurückkopiert werden. Danach `unity license activate --personal --accept-eula` – nur nach ausdrücklicher Zustimmung der Person zur Unity-Personal-EULA.
- Editor ohne Bildschirm dauerhaft starten (mit Software-OpenGL für Aufnahmen):

  ```bash
  xvfb-run -a -s "-screen 0 1280x900x24" ~/Unity/Hub/Editor/6000.6.10f1/Editor/Unity -batchmode -projectPath unity/GoldenSchmidtUnity -logFile editor.log
  ```

  Bereitschaft: `unity status --until-ready --project-path <Pfad>`. Steuerung: `unity command script eval`, `unity recompile`, `unity command editor.playmode start|stop`, `unity command capture game_view`. Vor dem Play Mode `unity command editor set_auto_tick`; Handy-Auflösung über `UnityEditor.PlayModeWindow.SetCustomRenderingResolution(540, 1080, "Handy")`. Hintergrundprozesse einer Agenten-Sitzung enden nach höchstens 2 Stunden – dann Editor neu starten.
- Jeder neue Container beginnt ohne CLI, Editor, Anmeldung und Lizenz (Einrichtung ≈ 20 Min. plus Anmeldelink). Unity-Aufgaben und Rückmeldungen deshalb möglichst in einer Sitzung bündeln. .NET 8 für den Tank-Regeltest: `apt-get install -y dotnet-sdk-8.0`.
- Am Ende `unity close <Pfad>` (schreibt Projekteinstellungen sauber) und `unity auth logout` (die Anmeldung liegt sonst unverschlüsselt im Container). Eine Personal-Lizenz lässt sich nicht zurückgeben (`unity license return` meldet das); nur bezahlte Sitze mit `unity license return --yes` freigeben.

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
7. `RollDemo.json` nach Änderungen an `src/unityRollItUp.ts` neu erzeugen (Felder müssen zu `RollModels.cs` passen), `RollDemoGrinder.json` mit `npx tsx scripts/unity-roll-demo-grinder.ts`; die Brücke selbst prüft `npm run test:rules` (`scripts/unity-roll-it-up-test.ts`).

Auslieferung: Der Server erlaubt **nur unter `/unity/`** WebAssembly (`'wasm-unsafe-eval'`), `blob:`-Skripte und das Einbetten im eigenen App-Rahmen (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`); die App selbst bleibt streng. `Build/`-Dateien sind ein Jahr cachebar. `.unityweb`-Dateien gehen mit `Content-Encoding: gzip` (und `application/wasm` für den Code) hinaus: Der Browser entpackt selbst und übersetzt WebAssembly schon während des Downloads. Der Service Worker nimmt `unity/**` nicht in den Offline-Cache und leitet Navigationen nach `/unity/` nicht auf die App um. Andere Hoster brauchen dieselben Header ([Deployment](DEPLOYMENT.md#node-starten)). Der erste Start lädt ca. 12 MB für alle Spiele zusammen (Engine-Code ≈ 7,3 MB, Daten ≈ 4,4 MB; neue Szenen sind klein, weil ihre Welt zur Laufzeit entsteht); weitere Spiele kommen danach aus dem Browser-Cache. Jeder Neubau legt den ganzen Build neu im Repository ab, deshalb Spiele gesammelt bauen und nicht für Kleinigkeiten. Startzeit bis spielbereit (Chromium-Emulation, 4× gedrosselte CPU, 30 Mbit/s, 40 ms): Parcours 8,4 s → 6,4–7,1 s, Floor is Lava 7,4 s → 6,2–6,4 s, Bauschale 6 s. Die Bauschale lädt verdeckt schon während des Auftakt-Minispiels.

## Prüfungen

| Schritt | Prüfung |
| --- | --- |
| Floor is Lava „Host rechnet“ | `npm run test:rules` (`lava-host-test.ts`), `npm run test:online` (`lava-host-online-test.ts`: sofortige Weiterleitung), `npm run build`, `npm run test:browser -- tests/browser/unity-lava-host.spec.ts`. Im Editor Rolle `host` mit `inputs`-Nachrichten; mit `Hud.DebugInput = true` (nach dem Szenenstart) erscheinen die `hostsnap`-Meldungen in der Konsole und lassen sich in eine Szene mit Rolle `view` einspielen. Vorausberechnung: dort einen gleichbleibenden Zustand einspielen und `Hud.Simulate(new Vector2(0f, 1f))` setzen; die eigene Figur läuft sofort los und gleitet nach dem Loslassen (`Simulate(Vector2.zero)`, nicht `null`: dann bleibt der letzte Stick stehen) zur Position des Raums zurück. Der Editor läuft headless mit ~14 Bildern pro Sekunde; der Host meldet dort höchstens einmal pro Bild. |
| Unity-Code | `unity recompile` ohne Fehler; Editor-Play-Mode mit `GSGPlaytest.Start("all")` (Parcours) bzw. Durchlauf mit Wertung (Floor is Lava); Aufnahmen hochkant prüfen |
| Standhaft | Im Editor einen Durchgang spielen. Balkenstarts nach 3 und 20 s, Klappenwarnung und gestaffelte Öffnung ab 12 s, Ausscheiden ohne Wiedereinstieg und Ergebnis prüfen. |
| Tank Trouble (Raum) | `npm run test:rules` (Ansicht, Host-Wahl, Regeln je Ansicht in `tank-view-test.ts`), dann `npm run build` und `npm run test:browser -- tests/browser/unity-match.spec.ts` (Host wählt im Spielmenü, Unity zeichnet, Stick relativ zur Kamera, Schuss). Im Editor echte Schnappschüsse einspielen: mit `tsx` aus `createMatch`/`publicMatch`/`unityTankSnapshot` eine JSON-Zeilen-Datei erzeugen, im Play Mode der Startszene `MatchBridge.Create()` und die Zeilen per Coroutine an `OnMessage` geben. |
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

- **Play Mode ohne Domain-Reload:** statische Felder überleben zwischen Play-Mode-Starts. Zur Laufzeit erzeugte Objekte darin (z. B. Materialien im `Kit`-Cache) sind nach dem Beenden zerstört; Caches prüfen deshalb vor der Rückgabe, ob das Objekt noch lebt (sonst erscheinen Teile magenta).
- **Editor-Skripte** lassen sich im Play Mode nicht als Komponente anhängen; Prüfabläufe als Coroutine auf einem Laufzeitobjekt starten (wie `GSGPlaytest`).
- **Figuren:** Die Clips aus `anims.glb` adressieren Knochen als `Node-0/root/…`; die Prefabs haben deshalb eine `Node-0`-Ebene unter `Armature`. Nach dem Neubau eines Prefabs kann der Editor eine veraltete Kopie halten – `AssetDatabase.ImportAsset(..., ForceUpdate)`.
- **Bewegungseinflüsse** (Wind, Förderband, Plattformen) als Zusatz auf die eigene Geschwindigkeit legen und vor dem nächsten Schritt wieder abziehen, sonst summieren sie sich auf.
- **Gelenkfedern** (`HingeJoint.spring`) im Play Mode nachmessen: Die Wippen brauchen Feder/Dämpfer 6500/900, damit sie unter einer Figur am Rand ≈ 14° kippen statt bis zum Anschlag.
- **Touch:** Ein kurzer Tipp kann zwischen zwei Bildern beginnen und enden – das HUD wertet ihn trotzdem. Ebenen über dem Canvas (`#gsg-loading`) müssen wirklich verschwinden (`[hidden] { display: none }`), sonst kommt keine Berührung an.
- **Frischer Editor (Cloud-Sitzung):** Die WebGL-Codeoptimierung ist eine Benutzereinstellung (nicht eingecheckt) und steht dann auf „Build Times“; der Build wird so ≈ 1 MB größer. Vor dem Bauen `GSGSetup.Project()` ausführen oder nur die Codeoptimierung setzen (`SetWebGLCodeOptimization("DiskSizeLTO")`) und mit `UserBuildSettings.codeOptimization` prüfen.
- **Template:** keine Inline-Skripte (CSP); Build-Dateinamen über `data-`-Attribute an `TemplateData/boot.js` geben.

## Offen

- Auf echten Handys Bildrate, Ladezeit, Akku/Wärme und Touch-Gefühl beurteilen; danach Schatten, MSAA oder Renderauflösung anpassen.
- Weitere Spiele auf die Darstellung im Raum umstellen (je Spiel: Schnappschuss in `UNITY_SNAPSHOTS`, `IOnlineMatch` in der Szene, Ansichten in `MINI_LOOKS`, Fall in `tests/browser/unity-match.spec.ts`). Offen: Tower Tumble (+ Survival; Box2D-Verhalten muss vorher in `physics2d.ts`).
- Parcours-Probelevel: getimtes Festhalten, Lücken länger als Sprung + Hechten, Serpentinen-Glibberflut und Ventilatoren mit Anlauf nachziehen.
- Kein Offline-Betrieb; ohne Internet übernimmt im Raum die Web-Darstellung.
- Roll It Up! (Unity): nur Testpartie mit Bots am lokalen Tisch; Online-Räume, Wiederbeitritt und Handy-Hosting mit Unity-Brett sind nicht geprüft. Kameradrehen per Wischen, Zoomen mit zwei Fingern, Feldinfo per Tipp; die Feldliste/Regeltafel der Web-Bauschale fehlt noch.
