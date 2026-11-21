# Gerätetest

Reale Leistung, Touch, Kamera und Funklatenz prüfen. Chromium-Emulation ersetzt das nicht; bisher kein Geräteprotokoll eingetragen.

## Ablauf

Android und iPhone, möglichst älteres Gerät; sechs für Volllast. Je relevanter Fall Node- und Handy-Host. App pro Gerät mit `?messung` öffnen, `?messung=0` schaltet aus; Einstellung bleibt lokal gespeichert.

| Wert | Orientierung |
| --- | --- |
| FPS | ≥50 |
| 95. Perzentil Bildzeit | ≤25 ms |
| Bilder >50 ms in 5 s | 0–2 |
| Zustandsabstand / längste Pause | Soll 50/100 ms je Modul; bei 20 Hz möglichst ≤70 ms, Pause ≤200 ms |
| Rundlauf | ≤150 ms |

„Werte kopieren“ übernimmt Werte/Gerät. Kamera-Regler sind lokale Diagnosewerte; der alte Nachdreh-Regler belegt keine aktive automatische Kameradrehung.

## Schwerpunkte

| Bereich | Prüfen |
| --- | --- |
| Tower Tumble | Hohe Türme, Handy-Host mit sechs Personen, Pfeil-Tipp-/Haltegeschwindigkeit |
| Lava | Etagen, Wischkamera/Übersicht, Schubser/Hechten, Randsturz ohne Respawn, Startschutz, Rundenlänge |
| Turmsicht | Orientierung, Lesbarkeit hell/dunkel und „zuletzt gesehen“, kamerarelatives Zielen, gleichzeitiges Lenken/Kamerawischen oben rechts |
| Neon Pong | Schräge/schnelle Bälle treffbar, kein Flackern; knapp verpasste Bälle noch rettbar, weit verfehlte gehen durch |
| Bumper Mayhem | Item-Kisten erkennbar, Ölfleck/Schockwelle verständlich, Riesenauto-Größe |
| Neon Racer | Lenkrad und Pedale mit zwei Daumen, Item-Knopf, Lesbarkeit bei voller Fahrt; Kippen: gedrehtes Querformat in der installierten App, Safe Areas, Freigabe (iOS), Lenkrichtung, „Lenkrad ausrichten“, Pfeil-Rückfall |
| Vollbild | HUD lesbar und nicht über wichtigen Spielteilen, Menü „⋯“ (Aufgeben/Übung), Notch/Home-Leiste, Verbindungshinweis |
| Tower Survival / Schneeballschlacht | Survival-Tempo gegen Ende; Schneeball: Startkamera Richtung Mitte, Zielring, Antippen-Wurf, Antippen-Formen, 3D-Leistung mit sechs Figuren |
| Fallklappen / Windkanal / Glibberflut | Dauer und Schwierigkeit der verlängerten Läufe, Glibber gegen Ende |
| Parcours | Laufzeiten, Aktionen, Balkentreffer, Klettern/Wippen/Flut, Klappenwarnung/Wind/Standhaft |
| Übrige | FPS/Ruckler, kleine Figuren, Quick-Draw-Fairness, Light-Trails-Lenkung |
| Alle 3D-Szenen | Laden, Erwärmung über mehrere Runden, beide Bewegungseinstellungen |

## Protokoll

| Datum/Commit | Gerät/Browser | Hosting/Spielerzahl | Spiel | FPS/p95/Ruckler | Netz/Rundlauf | Kamera | Beobachtung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

## Werte anpassen

Kamera: `ChaseCamera` in `src/three/lavaWorld.ts`, `tankWorld.ts`, `parcoursWorld.ts`, `snowWorld.ts`; tatsächliche Drehlogik prüfen. Glibber: `glibberflut()` in `shared/matches/parcoursCourses.ts` (`goo.rate`, `goo.accel`); Wippen/Aktionen: Strecken und `PC` in `parcours.ts`. Tower-Pfeile: `REPEAT_DELAY`/`REPEAT_EVERY` in `src/matches/games/towerTumble.tsx`.

Regel-/Balancewerte gelten auf allen Geräten gleich. Erst messen, dann Code ändern; anschließend `npm run test:rules` und betroffene UI-Prüfungen.
