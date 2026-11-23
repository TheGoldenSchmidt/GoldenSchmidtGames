# Unity-Minispiele

Verbindlich für alle Arbeiten an Unity-Minispielen und am Unity-Brett von Roll It Up! (`unity/`, `public/unity/`, `src/unityGames.ts`, `src/unityRollItUp.ts`, `UnityGameScreen`, `UnityRollItUpBoard`, CSP und Header unter `/unity/`). Gilt für Menschen sowie Codex und Claude Code zusätzlich zu [AGENTS.md](AGENTS.md) und den [Designregeln](designregeln.md).

## Zweck und Stand

Probe, ob Unity ein besseres Spielerlebnis liefert als die Three.js-/Canvas-Spiele der App. Jedes Unity-Spiel ist ein **eigenständiges Minispiel mit eigenem WebGL-Build**, in der App unter **Lokal spielen → Frei ausprobieren** für alle sichtbar (`src/unityGames.ts`). Sie laufen lokal auf einem Handy: keine Räume, kein Zufallspool, kein Offline-Cache.

| Spiel | Inhalt | Build |
| --- | --- | --- |
| Parcours-Probelevel (`parcours`) | 15 Stationen mit allen Hindernisarten der Online-Parcours (`parcoursCourses.ts`): Stufen/Lücke, Türenwand (2 von 5 echt), Schieber, Drehbalken unten/oben/Kreuz, Fahrinseln, Wippen, Förderband mit Walzen, Kletterkante, Geisterpfad, Fallklappen mit Vorwarnung, Windsteg, Wechselgriffe, Glibbergrube, Türgänge (weiter/Sackgasse/Falltür/zu), Ziel. Allein, mit Kontrollpunkten, Zeit, Stürzen und Bestzeit. | `public/unity/parcours/` |
| Floor is Lava (`lava`) | Regeln aus `shared/matches/floorIsLava.ts`: 3 Etagen à 9 × 13 Platten, Bröseln nach 0,8 s, Runenplatten kehren nach 2,5 s zurück, Rand stürzt bei 16 s und 23 s ein, Springen/Hechten/Schubsen mit Abklingzeiten, +1 je früher gefallene Person, +3 für Überlebende, drei Durchgänge und Stechrunde. Du gegen drei Bots (Bot-Logik portiert). | `public/unity/lava/` |

Dazu kommt **Roll It Up! (Unity)** (`rollitup`, `public/unity/rollitup/`): die Bauschale als Unity-Brett. Nur für Admin/Entwicklung sichtbar (`canDevelop`) unter **Frei ausprobieren**; startet eine Testpartie mit Bots am lokalen Tisch. Regeln, Bots, Items, Inventar/Menü und die Minispiele zwischen den Runden bleiben unverändert in der App (`shared/party.ts` über die Raumautorität); Unity zeichnet nur Schale, Felder, Stationen, Figuren, Würfel und die Brett-Entscheidungen.

Was Unity hier anders macht: echte Physik (Wippen mit Gelenk, Türsplitter als Rigidbodies, Platten fallen wirklich durch Löcher), eine Toon-Shaderfamilie für das ganze Bild mit Echtzeitschatten, HDR-Bloom, Nebel und Partikeln, Kameraschütteln und Hit-Stop, zur Laufzeit synthetisierte Geräusche und Musik, UI-Toolkit-HUD mit Mehrfinger-Touch.

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
| `Assets/GSG/Scripts/Runtime/Common` | `Palette`, `Hud` (UI Toolkit + Touch), `CameraRig` (Cinemachine), `Figure`, `Sfx` (Synthese), `Fx` (Partikel, Shake, Hit-Stop), `SceneLook`, `AppLink` (URL-Parameter) |
| `Assets/GSG/Scripts/Runtime/Parcours` | `ParcoursRunner`, Hindernisse (je Datei ein MonoBehaviour), `ParcoursLevel` (Aufbau aller Stationen), `ParcoursGame` (Ablauf) |
| `Assets/GSG/Scripts/Runtime/Lava` | `LavaTile`, `LavaRunner`, `LavaGame` (Regeln, Bots, Ablauf) |
| `Assets/GSG/Scripts/Runtime/RollItUp` | `RollModels` (Spiegel von `src/unityRollItUp.ts`), `RollBridge` (Nachrichten), `RollWorld` (Bauschale nach `src/three/rollingTray.ts`), `RollUi` (Kopfzeile, Spielerliste, Entscheidungskarte, Beschriftungen), `RollGame` (Figuren, Würfel, Kamera, Feldinfo per Tipp) |
| `Assets/GSG/Plugins/WebGL` | `GSGBridge.jslib` (`postMessage` zwischen App und Build) |
| `Assets/GSG/Scripts/Editor` | `GSGSetup` (Materialien, Figuren-Prefabs, Szenen, Projekt-/WebGL-Einstellungen), `GSGPlaytest` (Mechanik-Prüfung im Play Mode) |
| `Assets/GSG/Shaders` | `GSG/Toon`, `GSG/Outline`, `GSG/Glow` (Lava/Glibber), `GSG/Sky`, `GSG/Particle` |
| `Assets/GSG/Resources/GSG` | Materialien, Figuren-Prefabs, Schriften, HUD-Stylesheets (`Hud.uss`, `Roll.uss`), Panel-Einstellungen, `RollDemo.json` (vorbereitete Brettzustände für Editor und `?demo=1`) |
| `Assets/WebGLTemplates/GSG` | Startseite ohne Inline-Skript (CSP), Ladebalken, Pixeldichte ≤ 2 |

Menü **GSG → 1 Alles einrichten** (oder `GSGSetup.All()`) baut Materialien, Figuren, alle drei Szenen und die WebGL-Einstellungen reproduzierbar neu. Einzelschritte: Menü GSG 2–8.

Eigene Meshes (Drehkörper, Hügel, Steine) brauchen UV-Koordinaten: `GSG/Toon` zeichnet die Comic-Kante dort, wo die UV 0 oder 1 erreicht – ohne UV wird die ganze Fläche schwarz. `RollWorld` setzt deshalb eine neutrale UV.

## Neues Unity-Minispiel anlegen

1. Laufzeitcode in `Assets/GSG/Scripts/Runtime/<Spiel>/`, gemeinsame Bausteine aus `Common` wiederverwenden (HUD, Kamera, Figur, Klänge, Effekte, Palette). Ein MonoBehaviour pro Datei, Dateiname = Klassenname (sonst kann der Player-Build abstürzen).
2. Szene in `GSGSetup` als eigene Methode bauen (wie `BuildParcoursScene`/`BuildLavaScene`) und in `EditorBuildSettings` aufnehmen.
3. Shell wie bei den bestehenden Spielen: Titel über der laufenden Szene, Pause (Weiter, Neustart, Ton/Musik), Endtafel mit Ergebnis und „Nochmal“.
4. Eintrag in `src/unityGames.ts` (`id` = Ordner unter `public/unity/`). Playwright- und Produktionsprüfung durchlaufen alle Einträge automatisch.
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
3. **Jedes Spiel in einen eigenen Ordner unter `unity/GoldenSchmidtUnity/Builds/<id>/` bauen, danach nach `public/unity/<id>/` kopieren.** Unitys inkrementeller WebGL-Build räumt sonst den Ausgabeordner des vorherigen Builds ab.

   ```bash
   unity command build run --project-path <Pfad> -- --target WebGL --output-path <Pfad>/Builds/parcours --scenes '["Assets/GSG/Scenes/ParcoursProbe.unity"]' --confirm true
   unity command build status --project-path <Pfad>   # bis status completed und buildId passt
   ```

4. Die Builds mit dem Quellstand einchecken. CI und Render bauen sie nicht.
5. Einstellungen (setzt `GSGSetup.Project()`): Gzip mit Entpack-Rückfall, Dateinamen mit Inhalts-Hash, Datencache, keine Ausnahmen, IL2CPP „Optimize Size“, WebGL-Codeoptimierung „Disk Size with LTO“, Managed Stripping „High“, Engine-Code-Stripping, kein Splash-Bildschirm, Qualitätsstufe „Mobile“ mit HDR und Schatten.
6. `RollDemo.json` nach Änderungen an `src/unityRollItUp.ts` neu erzeugen (Felder müssen zu `RollModels.cs` passen); die Brücke selbst prüft `npm run test:rules` (`scripts/unity-roll-it-up-test.ts`).

Auslieferung: Der Server erlaubt **nur unter `/unity/`** WebAssembly (`'wasm-unsafe-eval'`), `blob:`-Skripte und das Einbetten im eigenen App-Rahmen (`frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`); die App selbst bleibt streng. `Build/`-Dateien sind ein Jahr cachebar. `.unityweb`-Dateien gehen mit `Content-Encoding: gzip` (und `application/wasm` für den Code) hinaus: Der Browser entpackt selbst und übersetzt WebAssembly schon während des Downloads. Der Service Worker nimmt `unity/**` nicht in den Offline-Cache und leitet Navigationen nach `/unity/` nicht auf die App um. Andere Hoster brauchen dieselben Header ([Deployment](DEPLOYMENT.md#node-starten)). Erster Start lädt je Spiel ca. 11,5 MB (vorher 13,7 MB). Durch das Stripping je Szene ist der Engine-Code (≈ 7,1 MB) nicht mehr byte-gleich: Jeder Neubau eines Spiels legt dessen Build neu im Repository ab, deshalb nur bei echten Änderungen neu bauen. Startzeit bis spielbereit (Chromium-Emulation, 4× gedrosselte CPU, 30 Mbit/s, 40 ms): Parcours 8,4 s → 6,4–7,1 s, Floor is Lava 7,4 s → 6,2–6,4 s, Bauschale 6 s. Die Bauschale lädt verdeckt schon während des Auftakt-Minispiels.

## Prüfungen

| Schritt | Prüfung |
| --- | --- |
| Unity-Code | `unity recompile` ohne Fehler; Editor-Play-Mode mit `GSGPlaytest.Start("all")` (Parcours) bzw. Durchlauf mit Wertung (Floor is Lava); Aufnahmen hochkant prüfen |
| Build | alle betroffenen Builds erzeugt und nach `public/unity/<id>/` kopiert |
| App | `npm run build`, `npm run test:production` (Header, Content-Encoding, Dateien, PWA-Ausschluss), dann `npm run test:browser -- tests/browser/unity-games.spec.ts` |
| Roll It Up! (Unity) | `npm run test:rules` (Brücke), Editor-Vorschau mit `RollDemo.json` (`DemoAdvance()` schaltet Zustände weiter), dann `npm run test:browser -- tests/browser/unity-roll-it-up.spec.ts` (Einstieg nur mit Entwicklerkonto, Brett lädt, Würfeln per Touch im Build) |
| Touch | Start-Tipp, Stick und Aktionstaste im WebGL-Build per Chromium-Touch (CDP `Input.dispatchTouchEvent`); `?debug=1` protokolliert jeden Finger in der Browser-Konsole |
| Echte Handys | Bildrate, Ladezeit, Wärme und Touch-Gefühl; Browseremulation mit Software-GPU belegt keine Leistung |

Nach Änderungen in `public/` vor Server-/Browserprüfungen `npm run build` ausführen: Der Server liefert `dist/`, nicht `public/`.

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
