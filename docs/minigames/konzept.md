# Technisches Konzept: Match-Minispiele

Gemeinsame Technik und gültige Regeln aller Match-Minispiele. Ursprüngliche Anforderungen: [Spezifikation](spezifikation.md); was hier steht, geht vor. Offene Arbeit: [Backlog](backlog.md).

## Einbindung

- **Ablauf:** `shared/party.ts` steuert Inselparty, Roll It Up!, Freies Minispiel und Schlag den GoldenSchmidt mit denselben Phasen `mini-bet → mini-intro → mini-play → mini-result/finished`: Anleitung, Bereitschaft, 3-s-Countdown (`mini.startAt`), Zeitlimit (`deadline`), Pause bei Verbindungsabbruch, Wiederbeitritt, Wertung (`partyMiniResults`). Ergebnisse der Brettspiele bestätigen alle aktiven Menschen.
- **Autorität:** `shared/roomCore.ts` läuft unverändert im Node-Server und im Handy-Worker (`src/nearby/host.worker.ts`). Ein 50-ms-Takt ruft `tickParty`; `party:control` wird geprüft und erst nach dem Speichern bestätigt.
- **Module:** Jedes Spiel ist ein `MatchModule` in `shared/matches/` (reine, deterministische Funktionen über serialisierbarem Zustand mit eigenem Zufall). Das Framework (`framework.ts`) übernimmt Registrierung, Spielerzahl/Teams, Eingabeprüfung, festen Schritt, Sicht, Rangliste und Bots. Die 14 klassischen Arenen laufen getrennt in `shared/partyArena.ts`.
- **Eingaben `MatchInput`:** Stick (`x`,`y`), Zielvektor (`ax`,`ay`), gehaltene Tasten (`ha`,`hb`), kumulative Tipp-/Kommandozähler (`ca`,`cb`,`cn` + `n`), `echo`/`held` für die Laufzeitmessung. Werte begrenzt, alte Folgenummern und zurücklaufende Zähler ignoriert; fehlende Eingaben laufen nach 400 ms auf neutral aus.
- **Übertragung:** `party:match` mit 10 oder 20 Hz als eigene Sicht je Gerät (ohne Geheimnisse, Zahlen auf 1/1000 gerundet, Ereignisse 1,5 s). Tipps sofort zuverlässig, Stick alle 100 ms.
- **Darstellung:** Canvas 2D oder nachgeladene Three.js-Szene; Canvas bleibt Rückfall bei fehlendem WebGL, Ladefehler oder Kontextverlust. Interpolation und lokale Vorhersage glätten.
- **Nur Smartphone:** Touch (Stick, Tasten, Tippen, Wischen, Ziehen), keine Tastatur- oder PC-Layouts, keine `desktop`-Tests.
- **Texte:** `meta.instruction` ist der kurze Ziel-Satz im Intro, `meta.controls` erscheint im Countdown, `meta.rules` hinter „Alle Regeln“.

## Auswahl

`shared/minigameCatalog.ts`: Pool je Spielerzahl; `classic` (Standard an) nimmt die erste Generation (14 Arenen, Hook Wars, Chaos Run, Wippenwerk) hinzu. Gezogen wird aus einem Beutel mit einem Eintrag je Spielfamilie (`miniFamily`: Varianten wie Survival/Kippen zählen zur Familie, alle Hindernisläufe sind eine Familie mit zwei Einträgen); dieselbe Familie kommt nie zweimal hintereinander. Wettbewerbe wiederholen kein Spiel. Proberaum ist nie im Pool.

## Bausteine

| Baustein | Ort |
| --- | --- |
| Modulvertrag, Eingaben, Zufall | `shared/matches/types.ts` |
| Framework, Pool, Bots | `shared/matches/framework.ts`, `shared/partyBots.ts` |
| Geometrie, Physik | `shared/matches/geometry.ts`, `physics2d.ts` |
| Bühne (Vollbild, schwebendes HUD, Takt, Interpolation, Countdown, Menü) | `src/matches/MatchStage.tsx` |
| Steuerung (Stick, Taste, Tipp-, Wisch-, Zielfläche, Schieberegler) | `src/matches/controls.tsx` |
| Darstellung | `src/matches/render/*.ts`, 3D in `src/three/*World.ts`, gemeinsame Kamera `src/three/matchScene.ts` |

## Wertung und Fairness

- Das Modul liefert Platzierung, Spielpunkte und geteilte Plätze; eigene Stechregeln (Golden Goal, Stechdurchgang, Sudden Death) spielt es aus. Bleibt danach ein Gleichstand, wird der Platz geteilt: Inselparty gleiche Münzen (10/4/2), Wettbewerb gleicher erster Platz mit eigenem Einsatz.
- Teilnahme heißt: mindestens eine Eingabe. „Aufgeben“ beendet die Teilnahme; später Aufgebende stehen vor früher Aufgebenden. Bleibt eine Person übrig, endet das Match. Wer nach einer Pause passiv bleibt, gilt als ausgeschieden.
- Gleichzeitige Ereignisse werden in fester Reihenfolge symmetrisch aufgelöst (z. B. Kopf an Kopf in Light Trails); Module dürfen den 50-ms-Schritt unterteilen.
- **Quick Draw:** Nur der Server kennt den Signalzeitpunkt und sendet ihn erst bei Erreichen. Die Gerätezeit (Anzeige bis Tipp) gilt nur in `[Serverdauer − Zuschlag, Serverdauer]`, Zuschlag = gemessene Laufzeit (≤300 ms) + Takt; unter 80 ms oder vor dem Signal ist Fehlstart.

## Gültige Regeln je Spiel

Nur Abweichungen von der [Spezifikation](spezifikation.md); Werte stehen als Konstanten im jeweiligen Modul.

| Spiel | Gültiger Stand |
| --- | --- |
| Neon Pong | Hochformat, eigenes Tor unten, Schläger per waagrechtem Ziehen (≤42 Einheiten/s, eigene Anzeige bis 250 ms voraus). Trefferfläche = Ball × 1,2 + 0,04; knapp verpasste Bälle (≤0,7 daneben) bleiben halbe Laufzeit + 50 ms rettbar. Ball 6,5, +0,45 je Treffer, höchstens 15; Kurve höchstens 70°. Power-up alle 10–15 s für das Team des letzten Treffers: breiter Schläger 5 s, Mehrball, Kurve 6 s, Zeitlupe 4 s (nur Bälle Richtung Sammlerteam). Nur 2 oder 4 Spieler. Golden Goal höchstens 30 s, danach geteilter Sieg. |
| Quick Draw | Duell höchstens 9 Runden, Gruppenstechen höchstens 3 Durchgänge, danach Rundenstand bzw. geteilter Platz. |
| Light Trails | Feld 30 × 48, konstante Fahrt, stufenlose Lenkung (Stick = Richtung, ⟲/⟳ halten = voll). Startplätze auf einem inneren Ring, im Uhrzeigersinn, Zuordnung rotiert je Durchgang. Schrumpfen ab 14 s, Durchgang höchstens 45 s; Überlebende teilen ohne Bonus. |
| Tank Trouble | Labyrinth 7 × 11, Ziegel halten 2 Treffer und schlucken die Kugel. Rechts ziehen = zielen, loslassen = schießen, kurz tippen = letzte Richtung. Stechen höchstens 30 s. 2.5D mit gewählter Figur in der Luke; eigener Ziellaser nur bis zur ersten Wand, keine Abprallvorhersage; 132 px Steuerreserve. |
| Tank Trouble in 3rd/1st Person (`tankview`) | Ansicht, kein eigenes Minispiel (nicht im Pool). Tank-Regeln; Sicht = von der Panzermitte ausgeleuchtete Fläche (Strahlen bis 6, enden an der ersten Mauer). Objekte zählen dazu, sobald ein Teil ihres Umrisses darin liegt; wer sie verlässt, hinterlässt 2 s „zuletzt gesehen“. Zuschauer sehen alles, Bots dieselbe Sicht. Kamera oben rechts wischen. |
| Bomb Arena | K.o. = letztes Leben durch fremde Bombe (+2). Kettenreaktion = eine Explosion (höchstens 1 Schaden je Spieler). Spirale ab 25 s (1 Feld je 0,35 s); geteilter Rundenbonus anteilig. Sudden Death nur Punktgleiche: 1 Leben, Schließen ab 8 s, höchstens 30 s. Feste geneigte 3D-Kamera, ganzes Feld sichtbar, 132 px Steuerreserve. |
| Floor is Lava | 3 Etagen à 9 × 13 Platten; über einem Loch fällt man in 0,45 s eine Etage tiefer, nur ein Loch der untersten führt in die Lava. Kein Respawn: Lava = raus für den Durchgang. 0,5 s Startschutz, Rand bricht bei 16 s und 23 s. Sprung 0,55 s (× 1,4), Hechten, Schubser 0,22 s (Abklingzeit 2,5 s; Getroffene rutschen 0,35 s mit 6,5/s; nur dieselbe Etage, nicht im Fall). Überleben +3, je früher gefallene Person +1. Durchgänge bis 30 s, Stechrunde nur Punktgleiche bis 25 s. Kamera folgt der eigenen Etage. |
| Sumo Smash, Bumper Mayhem | Gemeinsamer Kern `ringCore.ts`: Ring-Out gilt für die Person, die in den letzten 3 s am stärksten geschoben hat (+2). Rangfolge Sieger, Ausscheidezeit, Leben, Ring-Outs. Sudden Death nur Gleichauf (1 Leben, kleiner Ring, höchstens 20 s). Neustart aller nur, wenn zwei übrig sind. |
| Sumo Smash | Stoß 0,24 s, Abklingzeit 2,5 s, starke Treffer mit Kontrollverlust; Ring schrumpft 40–75 s. Kampfspielkamera. |
| Bumper Mayhem | Lenkung mit begrenzter Drehrate, Turbo 0,8 s alle 4 s, zwei Pfosten, Schrumpfen ab 45 s. Item-Kisten ab 4 s alle 6–9 s (höchstens 2): Riesenauto 6 s (Körper × 1,45), Ölfleck 8 s, Schockwelle (Radius 2,8). Keine Items im Sudden Death. |
| Chaos Run | Brücken stürzen je Läufer ein, keine Beeinflussung. 8 Module à 24 m mit Checkpoint, jeder der 6 Typen mindestens einmal; Wand 1,7 nur mit gehaltenem Sprung, Balken nur rutschend; Wischen nach unten in der Luft = schnell fallen und rutschen. |
| Arrow Masters | Zielen wie an einer Bogensehne, Vorschau der ersten 0,35 s ohne Wind, Ziel bis zum Abschuss verdeckt. Arena 20 × 14, neun Standplätze je Runde neu, „DU“-Hinweis, Wind bis ±3. Besiegte bis Rundenende raus, Eigentreffer kosten ohne Punkte. Je einmal Dreifach- und schwerer Pfeil. Stechen: kleinster Abstand zur Scheibenmitte. |
| Tower Tumble | Turmrennen: alle gleichzeitig auf eigenem Sockel (5 Zellen), gleiche Steinfolge aus 7er-Beuteln; Sieg nach 2 s über 16 m, sonst nach 120 s Höhe ruhender Steine. Eigene deterministische Physik `physics2d.ts` (Box2D-Lite, 3 Teilschritte je 50 ms, 12 Iterationen, Warmstart im JSON-Zustand, damit ein Neustart exakt fortsetzt). Fallender Stein kinematisch im Halbzellenraster bis zum ersten Kontakt; ⇦/⇨ verschieben (Halten: 240 ms, dann alle 80 ms). Turm schläft nach 0,4 s Ruhe. Verloren unter −6 m oder neben dem Sockel. Sicht: Körper gepackt, fremde Türme auf 1 cm. |
| Tower Tumble – Survival | Keine Ziellinie; 3 verlorene Steine = raus; Fall wird bis 180 s auf × 1,8 schneller. Letzter Baumeister gewinnt, sonst höchster Turm, dann weniger Verluste. |
| Neon Racer | Rundkurs ≈318 Einheiten, 3 Runden, 15 s Nachlauf, höchstens 150 s. Lenkrad (±120° = voll, federt zurück), Gas/Bremse getrennt, Item per Tipp. Kisten in vier Reihen (3 s Rückkehr), Items nach Platz gewichtet: Turbo 1,5 s, Blaster 3 Schüsse, Lenkrakete, Schild 5 s; Treffer 1–1,5 s Schleudern. Fortschritt entlang der Mittellinie. Nur Canvas. |
| Neon Racer – Kippen | Gleiches Rennen quer: Im Hochformat dreht sich das Spiel um 90°. Lenken über den Rollwinkel aus `deviceorientation` (32° = voll, 2,5° Totzone, Ruhelage beim Start oder „Lenkrad ausrichten“); ohne Sensor/HTTPS Pfeiltasten. |
| Schneeballschlacht | Arena 22 × 22, punktsymmetrisch. Höchstens 2 Bälle: „Formen“ antippen, dann formt jeder Stillstand je 1 s einen Ball; Schneehaufen (6 s Rückkehr). Flacher Wurf, Reichweite 12, Mauern/Bäume halten auf. Ziehen zielt (Zielhilfe ±22° mit Vorhalt), Antippen wirft auf den nächsten Gegner im Kamerabild (±66°, gelber Ring). Treffer −10 % Tempo, 0,5 s Schutz, nach 3 Schneemann. Sieg: zuletzt übrig, sonst weniger kassierte, dann mehr ausgeteilte Treffer. |
| Hook Wars | Haken als Strahl (Reichweite 7,5) auf den nächsten Anker in 0,7 Abstand oder einen Gegner davor; Halten zieht mit 5/s, Seil begrenzt (Schwingen). Stick oben = Sprung, Plattformen von unten durchlässig. Abklingzeit 4 s nur nach Gegnertreffer, Fehlschuss 0,35 s. Spiegelbildliche Zonen, Kerne alle 6 s an 5 Punkten (höchstens 3). Gleichstand: höchstens 30 s Verlängerung. |

## 3D-Szenen und Parcours

`MatchClient.world`/`MatchStage` wählen WebGL oder Canvas, `preloadMatchWorld` lädt im Intro. Fehler führen ohne Raumverlust zur Canvas. Kamera: `ChaseCamera` und `cameraRelative`/`chaseStick`/`chaseAim` (`src/matches/client.ts`); Ausrichtung beim Start/Respawn, danach nur per Wischen. Skelettfiguren: [Figurenpipeline](figuren-rigged.md); klassische Figuren werden in Sumo, Bumper, Chaos Run und Parcours durch Basismenschen nach Farbplatz ersetzt.

**Parcours** (`shared/matches/parcours.ts`, Strecken `parcoursCourses.ts`): Laufen, Springen, Hechten, Festhalten und Ducken teilen deterministische Physik; Tür-/Pfadgeheimnisse werden vor Entdeckung nicht übertragen. Wertung nach Ankunft, sonst Fortschritt; Ende, wenn alle im Ziel/raus, 20 s nach der ersten Ankunft oder nach 120 s.

- **Kanten:** Festhalten fängt nur, wenn der Knopf beim Vorbeifallen frisch gedrückt wird (≤320 ms, `PC.grabWindow`); hängend zieht Stick zur Wand oder Springen hoch.
- **Hindernislänge:** Abschnitte über dem Abgrund sind länger als Sprung + Hechten (≈11 m nötig); `parcours-test.ts` misst das mit der Physik.
- **Gewundene Strecken:** `Course.route` (achsparallele Abschnitte); Fortschritt, Kontrollpunkte, Bots (`parcoursFrame.ts`) und Kamera folgen dem Weg.
- **Läufe:** Türenlotto, Kreiselkurs, Glibberflut (Serpentinen-Aufstieg, Glibber 0,2 m/s + 0,003 m/s² ab 3 s), Geisterpfad, Fallklappen, Windkanal (Böen mit 0,8 s Vorwarnung, `windState`), Kletterwand; Wippenwerk gehört zur ersten Generation. **Standhaft:** Sturz = raus, letzter Überlebender bzw. Sturzzeit, höchstens 90 s.
- Eigene Gameshow-Strecken; kein Nachbau fremder Level oder Figuren.

## Proberaum und Unity

`shared/proberaum.ts` + `proberaumCourse.ts`: lokale Übungsinsel mit demselben Parcours-Kern, nicht in `MATCH_IDS`, `COURSE_IDS` oder im Pool; `practice` unterdrückt Rennende und Ausscheiden. Einstieg `PracticeWorldScreen` (nur Entwicklung/Admin).

**Darstellung und Ansicht:** Der Host wählt im Spielmenü vor „Ich bin bereit“ für alle Darstellung (Unity/Web) und Ansicht (Draufsicht, 3rd, 1st Person) des nächsten Minispiels (`shared/minigameLooks.ts`, Aktion `look`; Übungen folgen der Ansicht in der Web-Darstellung). Mit Unity rechnet weiter die Raumautorität, Unity zeichnet nur. Die Einträge im Unity-Untermenü laufen dagegen lokal ohne `roomCore`. Beides: [Unity-Minispiele](../../UnityGames.md).

## Leistung

Pixelratio begrenzen, Geometrien teilen/instanzieren, Partikel begrenzen, `SceneKit`-Qualitätsstufen nutzen; Ziel 60 FPS, mindestens stabile 30. Der Handy-Host klont Zustände je Takt: Tower Tumble mit hohen Türmen und Lava mit mehreren Etagen besonders messen. Erst messen, dann optimieren; Physik/Fairness nie für Dekoration ändern. Reale Abnahme: [Gerätetest](geraetetest.md).
