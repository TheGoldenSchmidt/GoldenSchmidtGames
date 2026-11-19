# Technisches Konzept: Match-Minispiele

Gemeinsame Technik aller Match-Minispiele; ursprüngliche Regeln: [Spezifikation](spezifikation.md).
Den Arbeitsstand führt der [Backlog](backlog.md).

## Einbindung

- **Ablauf:** `shared/party.ts` steuert Inselparty, Roll It Up!, Freies
  Minispiel und Schlag den GoldenSchmidt mit denselben Phasen
  `mini-bet → mini-intro → mini-play → mini-result/finished`. Anleitung,
  Bereitschaft, 3-Sekunden-Countdown (`mini.startAt`), Zeitlimit
  (`deadline`), Pause bei Verbindungsabbruch, Wiederbeitritt und Wertung
  (`partyMiniResults`) sind dort zentral gelöst.
- **Autorität:** `shared/roomCore.ts` läuft unverändert im Node-Server und im
  Handy-Worker (`src/nearby/host.worker.ts`). Ein 50-ms-Takt ruft
  `tickParty`; Steuerungen kommen über `party:control`, werden in einer
  geordneten Transaktion geprüft und erst nach dem Speichern bestätigt.
- **Klassische Arenen:** `shared/partyArena.ts` simuliert die 14 bestehenden
  3D-Minispiele deterministisch mit festem 50-ms-Schritt. Eingaben sind auf
  Stick, Springen und Schlagen beschränkt; Rendering mit Three.js.
- **Wiederverwendbar:** Phasen, Countdown, Ergebnisansichten,
  Wettbewerbs-Einsätze, Bot-Treiber, Sitzungs- und Pausenlogik, Übungsdialog,
  Socket-Transport mit Folgenummern und Ratenbegrenzung.

## Architekturentscheidungen

1. **Eigenes Modulsystem statt Erweiterung von `partyArena.ts`.**
   Jedes neue Spiel ist ein `MatchModule` in `shared/matches/`. Das
   Framework (`shared/matches/framework.ts`) übernimmt Registrierung,
   Spielerzahl und Teams, Eingabeprüfung, festen Simulationsschritt,
   öffentliche Sicht, Ranglisten und Bot-Anbindung. Die klassischen Arenen
   laufen parallel weiter.
2. **Einbindung in den bestehenden Party-Ablauf.** `PartyMini` erhält neben
   `arena` ein Feld `match`. Anleitung, Countdown, Pausen, Einsätze,
   Ergebnisse und Rückkehr zur Lobby bleiben dieselben. Die Partylogik
   verteilt Münzen beziehungsweise Wettbewerbspunkte; das Modul liefert nur
   Platzierungen und Spielpunkte.
3. **Ein autoritativer Kern.** Module sind reine, deterministische
   Funktionen über einem serialisierbaren Zustand mit eigenem
   Zufallsgenerator. Node-Server, Handy-Worker, Übung und Tests rufen
   dieselben Funktionen auf. Clients senden nur geprüfte Eingaben.
4. **Eingabeformat `MatchInput`.** Stick (`x`,`y`), Zielvektor (`ax`,`ay`),
   gehaltene Tasten (`ha`,`hb`), **Tippzähler** (`ca`,`cb`) und ein
   Kommandozähler mit Wert (`cn`,`n`). Zähler sind kumulativ: Geht ein
   Paket verloren, trägt das nächste die Tipps nach. Dazu `echo`/`held` für
   die serverseitige Laufzeitmessung. Alle Werte werden begrenzt geprüft;
   zurücklaufende Zähler und alte Folgenummern werden ignoriert.
5. **Übertragung.** Zustände gehen über das Ereignis `party:match` mit
   10 oder 20 Hz (je Modul) an jedes Gerät, jeweils als eigene Sicht
   (`view`), z. B. ohne verdeckte Signalzeiten. Discrete Aktionen sendet der
   Client sofort zuverlässig, Stickwerte periodisch alle 100 ms.
6. **Darstellung:** Canvas 2D oder nachgeladenes Three.js-Modul, je Spiel. Match-Spiele behalten Canvas als Rückfall bei fehlendem WebGL, Ladefehler oder Kontextverlust. Interpolation und lokale Vorhersage glätten die Darstellung.
7. **Nur Smartphone.** Steuerung ausschließlich per Touch (Stick, Tasten,
   Tippen, Wischen, Ziehen). Keine Tastaturbelegung, keine PC-Layouts, keine
   Tests im Playwright-Projekt `desktop` für Inselparty, Roll It Up! und
   Minispiele.
8. **1st Generation Minigames abschaltbar.** Die 14 ersten Arenen und
   Hook Wars, Chaos Run und Wippenwerk bilden die erste Generation. Inselparty, Roll It Up! und Schlag den
   GoldenSchmidt erhalten die Option `classic` (Standard: an). Ist sie aus,
   ziehen die Modi nur aus den neuen Spielen, die zur Spielerzahl passen.

## Gemeinsame Bausteine

| Baustein | Ort | Aufgabe |
| --- | --- | --- |
| Modulvertrag, Eingaben, Zufall | `shared/matches/types.ts` | `MatchModule`, `MatchInput`, `MatchState`, Zufallszahlen |
| Framework | `shared/matches/framework.ts` | Registrierung, Spielerzahl/Teams, Eingabeprüfung, Schritt, Sicht, Rangliste, Pool |
| Geometrie | `shared/matches/geometry.ts` | Begrenzung, Kreis-/Rechteckkollision, Reflexion |
| Party-Anbindung | `shared/party.ts` | Start, Steuerung, Takt, Ende, Wertung, Pausen |
| Raumtakt | `shared/roomCore.ts` | Echtzeit-Takt und `party:match` für beide Hostingarten |
| Bots | `shared/partyBots.ts` | ruft `module.bot` mit der öffentlichen Sicht |
| Bühne | `src/matches/MatchStage.tsx` | Canvas, Takt, Interpolation, HUD, Countdown, Eingabeversand |
| Steuerung | `src/matches/controls.tsx` | Stick, Aktionstaste, Tippfläche, Wischfläche, Schieberegler, Zielfläche |
| Darstellung | `src/matches/render/*.ts` | eine Zeichenfunktion je Spiel |

## Wertung und Gleichstände

Das Modul liefert eine Rangliste mit Spielpunkten und geteilten Plätzen.
`partyMiniResults` übernimmt sie für alle Spieler, die mindestens eine
Eingabe gesendet haben. Gleich platzierte Spieler erhalten in der Inselparty
dieselbe Münzzahl ihres Platzes; im Wettbewerb erhalten nur gemeinsam
Erstplatzierte ihren jeweiligen Einsatz, andere Plätze 0. Die
spielinternen Stechregeln (Golden Goal, Stechdurchgang, Sudden Death) werden
im Modul ausgespielt; bleibt danach ein Gleichstand, wird der Platz geteilt.

## Latenz und Fairness

- **Feste Schritte:** 50 ms je Schritt, Module dürfen intern unterteilen
  (z. B. Ballphysik). Gleichzeitige Ereignisse werden in fester
  Reihenfolge und symmetrisch aufgelöst (z. B. Kopf-an-Kopf in Light Trails).
- **Quick Draw:** Der Server kennt allein den Signalzeitpunkt. Er
  verschickt ihn erst, wenn er erreicht ist. Das Gerät misst die Zeit von der
  Anzeige bis zum Tippen. Der Server akzeptiert diesen Wert nur innerhalb von
  `[Serverdauer − Laufzeitzuschlag, Serverdauer]`. Der Zuschlag ergibt sich aus
  der gemessenen Laufzeit (höchstens 300 ms) plus der Taktbreite. Ein Tipp vor
  dem Signal laut Server oder Gerät ist ein Fehlstart. Unter 80 ms gilt er als
  vorweggenommen.
- **Doppelte Nachrichten:** Folgenummern und kumulative Zähler machen
  Wiederholungen wirkungslos.
- **Abbruch:** Fehlende Eingaben laufen nach 400 ms auf neutral aus. Bei
  Verbindungsverlust pausiert die Party wie bisher; ein danach passiver
  Spieler gilt im Modul als ausgeschieden.

## Dokumentierte Abweichungen

| Spiel | Abweichung | Grund |
| --- | --- | --- |
| Alle | Steuerung nur per Touch | Auftrag: nur Smartphones |
| Neon Pong | Hochformat, eigenes Tor unten, Schläger per waagrechtem Ziehen; Schläger folgt dem Finger mit bis zu 42 Feldeinheiten/s (ganze Breite in gut 0,2 s), die eigene Anzeige läuft bis 250 ms voraus | Handy im Hochformat; der Daumen deckt die Breite natürlich ab. Jedes Gerät sieht das eigene Team unten. Spielrückmeldung: 16/s wirkte zu träge. |
| Neon Pong | Nur 2 oder 4 Spieler zulässig | 1v1/2v2 laut Spezifikation; bei 3, 5 oder 6 Spielern steht es nicht im Zufallspool |
| Neon Pong | Golden Goal höchstens 30 s, danach geteilter Sieg | Partys dürfen nicht endlos laufen |
| Quick Draw | Duell höchstens 9 Runden; danach entscheidet der Rundenstand | Wiederholte Doppel-Fehlstarts dürfen nicht endlos laufen |
| Quick Draw | Gruppen-Stechen bis zu 3 Durchgänge, danach geteilter Platz | Wie oben |
| Quick Draw | Reaktion unter 80 ms gilt als Fehlstart | Menschlich nicht erreichbar, verhindert Vorwegnahme |
| Light Trails | Durchgang höchstens 45 s; Überlebende teilen bei Zeitablauf den Platz ohne Bonus | Begrenzte Spieldauer |
| Light Trails | Freies Feld 30 × 48, konstante Fahrt, stufenlose Lenkung; Schrumpfen ab 14 s | Aktuelle Mechanik in `lightTrails.ts` |
| Light Trails | Startplätze gleichmäßig auf einem inneren Ring, alle im Uhrzeigersinn; Zuordnung rotiert je Durchgang | Faire, symmetrische Ausgangslage |
| Light Trails | Stick zeigt die Richtung; ⟲/⟳ halten lenkt voll | Touch-Steuerung |
| Neon Pong | Ball startet mit 6,5, je Treffer +0,45, höchstens 15 Feldeinheiten/s; Power-up alle 10–15 s, aktiviert durch das Team des letzten Treffers | Konkrete Werte der Spezifikation |
| Neon Pong | Wirkungen: breiter Schläger 5 s, Mehrball bis alle Zusatzbälle weg sind, Kurvenbälle 6 s, Zeitlupe 4 s nur für Bälle Richtung des sammelnden Teams | „Kurzzeitiger Slowdown“ soll dem sammelnden Team helfen |
| Alle | „Aufgeben“ ersetzt in Match-Spielen „Versuch beenden“ | Gemeinsame Spiele lassen sich nicht einzeln beenden |
| Tank Trouble | Labyrinth 7 × 11 Zellen; Ziegelmauern halten 2 Treffer und verschlucken die Kugel; Stechen höchstens 30 s, danach geteilter Platz | Neue Schusswege entstehen sichtbar, Spiel bleibt begrenzt |
| Tank Trouble | Zielen per Ziehen auf der rechten Hälfte, Schuss beim Loslassen; kurzes Tippen schießt in die letzte Richtung | Präzises Zielen und schneller Schuss mit einem Daumen |
| Bomb Arena | „Gegnerischer Knockout“ = letztes Leben durch eine fremde Bombe (+2 für deren Besitzer) | Mit 2 Leben ist der K.o. das Ausscheiden |
| Bomb Arena | Kettenreaktionen bilden eine Explosion: höchstens ein Schaden je Spieler | „Dieselbe Explosion“ einheitlich auslegen |
| Bomb Arena | Arena schließt sich ab 25 s spiralförmig (ein Feld je 0,35 s); geteilter Rundenbonus anteilig (z. B. 1,5) | Konkrete Werte; Teilen laut Spezifikation |
| Bomb Arena | Sudden Death nur für die Punktgleichen: 1 Leben, Arena schließt ab 8 s, höchstens 30 s | Kurzer, eindeutiger Entscheid |
| Sumo Smash, Chaos Run | Gewählte Skelettfiguren; klassische Auswahl über Basismenschen nach Farbplatz. Sumo mit Kampfspiel-Kamera, Chaos Run mit Verfolgerkamera und eigener Spur; Canvas-Rückfall | Bestehende Web-Technik; [Figurenpipeline](figuren-rigged.md) |
| Tank Trouble | **2.5D-Darstellung** (Nov. 2026): WebGL-Szene mit gewählter Figur in der Panzerluke; roter Ziellaser nur beim eigenen Zielen bis zur ersten Wand (keine Abprallvorhersage); Canvas als Rückfall; Regeln unverändert | Lesbarkeit der Abpraller bleibt Aufgabe der Spieler; der Laser zeigt nur die eigene Richtung |
| Bomb Arena | WebGL-Szene mit fester geneigter Kamera, gewählten Figuren und Canvas-Rückfall; Regeln/Sicht/Eingaben unverändert | Räumliche Lesbarkeit; [3D-Darstellung](#3d-darstellung-und-parcours) |
| Floor is Lava | Quadratische Platten 9 × 13; Rand bricht bei 16 s und 23 s ein (bis Nov. 2026 bei 10 s und 15 s); Sprung 0,55 s mit 1,4-facher Geschwindigkeit (überwindet ein Feld) | Konkrete Werte für Handys |
| Floor is Lava | **Drei Etagen** (Nov. 2026): Plattenzustände je Etage, alle starten oben. Wer über einem Loch steht, fällt in 0,45 s eine Etage tiefer (in der Luft, kein Lebensverlust, Platte darunter beginnt beim Landen zu bröckeln); nur ein Loch der untersten Etage führt in die Lava. Schubser und Wegdrücken nur auf derselben Etage, nicht während des Falls. Randeinsturz auf allen Etagen. Respawn auf der untersten Etage mit intakter Innenplatte. Durchgänge bis 30 s, Stechrunde bis 25 s | Spielwunsch „über mehrere Etagen“; Wertung (Überleben) unverändert. Die Spezifikation (eine Ebene, 20 s) gilt insoweit nicht mehr |
| Floor is Lava | Randsturz führt direkt in Lava; sichtbarer Fall, nach 1 s Respawn auf sicherer Platte, 1,5 s Schutz; währenddessen bröckelt die eigene Platte nicht. Hechten ergänzt Sprung/Schubser; Überlebende bei Zeitablauf teilen +3 | Lesbarer, sicherer Wiedereinstieg |
| Floor is Lava | Stechrunde bei Gesamtgleichstand: nur die Punktgleichen, 1 Leben | Spezifikation verlangt Stechrunde |
| Floor is Lava | **Schubser** (Nov. 2026, Erweiterung): 0,22 s Stoß in Blickrichtung, Abklingzeit 2,5 s; Getroffene rutschen 0,35 s ohne Kontrolle mit 6,5/s; Springende und Geschützte werden nicht getroffen; Lava-Sturz bis 1,5 s nach einem Stoß nennt die stoßende Person im Ereignis, Punkte bleiben bei der Überlebenswertung | Spielrückmeldung „wie Fall Guys“: Interaktion zwischen den Spielern; Wertung bewusst unverändert |
| Floor is Lava | **2.5D-Darstellung** (Nov. 2026): Tempelplatten auf drei Etagen über glühender Lava (Kamera folgt der eigenen Etage, Etagen darüber ausgeblendet, tiefere Etagen abgedunkelt), Platten erhitzen sich beim Bröckeln, kippen und versinken, Runenplatten steigen wieder auf; äußerer Ring glüht 1,5 s vor dem Einsturz; Figuren mit Sprungbogen und Schatten; Canvas als Rückfall | Plan in [3D-Darstellung](#3d-darstellung-und-parcours) |
| Sumo Smash / Bumper Mayhem | Gemeinsamer Kern `ringCore.ts`; Ring-Out wird der Person gutgeschrieben, die in den letzten 3 s am stärksten geschoben hat | „Verursacher“ eindeutig und für beide Spiele gleich |
| Sumo Smash / Bumper Mayhem | Spielpunkte = 2 × Ring-Outs; Rangfolge: Sieger, Ausscheidezeitpunkt, Leben, Ring-Outs | Punkte laut Spezifikation, Platzierung nach Überleben |
| Sumo Smash / Bumper Mayhem | Sudden Death nur für die nach 75 s Gleichauf-Liegenden, 1 Leben, kleiner Ring, höchstens 20 s, danach geteilter Platz | Begrenzte Dauer |
| Sumo Smash | Stoß 0,24 s, Abklingzeit 2,5 s; starke Treffer mit Kontrollverlust, elastischer Körperkontakt; Ring schrumpft ab 40 s bis 75 s. Gemeinsamer Neustart nur, wenn zwei übrig sind, sonst kehrt allein die gestürzte Figur zurück | Stoßwirkung und Mehrspielerablauf; Werte in `SUMO` |
| Bumper Mayhem | Stickrichtung mit begrenzter Drehrate; Turbo 0,8 s alle 4 s, zwei Pfosten, Schrumpfen ab 45 s. Weiche Gummistöße, Bremsen ohne Gas und weiches Abbauen von Übertempo; gemeinsamer Neustart nach Ring-Out | Lesbare, kontrollierbare Fahrzeugbewegung; Werte in `BUMPER` |
| Chaos Run | Brücken stürzen je Läufer ein (0,6 s nach dem Betreten); keine gegenseitige Beeinflussung | Version 1 ohne Spielerinteraktion, faire Bedingungen |
| Chaos Run | Strecke aus 8 Modulen à 24 m, jeder der 6 Typen mindestens einmal; Checkpoint an jedem Modulbeginn; Wand 1,7 hoch (nur mit gehaltenem Sprung), Balken nur rutschend passierbar | „Halten für höhere Sprünge“ bekommt eine Aufgabe |
| Chaos Run | Wischen nach unten in der Luft lässt schnell fallen und startet das Rutschen | Tippen und Wischen auf einer Fläche ohne Verzögerung |
| Arrow Masters | Zielen wie an einer Bogensehne (entgegen der Schussrichtung ziehen); Vorschau nur der ersten 0,35 s ohne Wind; Zielen bleibt bis zum Abschuss für andere verdeckt | Bedienbar mit einem Finger, Wind bleibt Herausforderung, kein Abschauen |
| Arrow Masters | Arena 20 × 14 mit neun Standplätzen, jede Runde zufällig (deterministisch) neu verteilt, Hinweis „DU“ zu Beginn des Zielens; Mittelpfeiler und zwei Simsen; zwei Zielscheiben je Runde an neuen Stellen; Wind bis ±3 | Konkrete Werte |
| Arrow Masters | Besiegte stehen bis zur nächsten Runde nicht mehr als Ziel bereit; Eigentreffer kosten Trefferpunkte, bringen aber keine Punkte | Spezifikation sagt nichts zu Eigentreffern |
| Arrow Masters | Stechen: nur die Punktgleichen, eine Scheibe ohne Wind; der kleinste Abstand der Flugbahn zur Mitte gewinnt | „Präzisions-Stechen“ messbar umsetzen |
| Arrow Masters | Je einmal pro Partie Dreifachpfeil und schwerer Pfeil (windunabhängig, 2 Schaden), Wahl bis Abschuss verdeckt | Zusätzliche Schussentscheidungen; Ego-Perspektive bleibt offen |
| Tower Tumble | **Neubau nach Spielrückmeldung (Nov. 2026): Turmrennen statt reihum an einem gemeinsamen Turm.** Alle bauen gleichzeitig auf eigenem Sockel (5 Zellen breit), dieselbe Steinfolge aus 7er-Beuteln von Vier-Zellen-Steinen; erster Turm, der 2 s über 16 m steht, gewinnt; nach 120 s entscheidet die Höhe ruhender Steine, gleiche Höhe teilt den Platz | Rückmeldung „Mechanik und Physik nicht schön“; Genre wie Stapel-Rennspiele, eigene Gestaltung und kein Nachbau eines bestimmten Spiels. Die Spezifikation (reihum, Punkte je Stein) gilt für dieses Spiel nicht mehr |
| Tower Tumble | **Eigene deterministische Starrkörperphysik** (`physics2d.ts`, nach Box2D-Lite): Quader mit Clipping-Kontakten, sequentielle Impulse mit Warmstart, Reibung 0,9, 3 Teilschritte je 50 ms, 12 Iterationen. Alle Zwischenwerte (auch Warmstart-Impulse) liegen als JSON im Zustand | Der Raumkern klont den Zustand je Takt; eine externe Physikbibliothek müsste ihre Welt jedes Mal neu aufbauen. So setzt ein Neustart die Physik exakt fort (Regeltest) |
| Tower Tumble | Kollisionsboxen zusammenfassen, flache Warmstart-Zahlenliste, Solver ohne Objektanlagen, `publicGame` ohne Physikkopie; Zellen vorzeichnen | Physik-/Sichtaufwand senken, echte Geräteleistung bleibt zu messen |
| Tower Tumble | **Pfeilsteuerung** (Nov. 2026) statt Schiebeleiste: ⇦/⇨ verschieben das Ziel des fallenden Steins um eine halbe Zelle (Befehl `n` mit Wert −1/+1), Halten wiederholt nach 240 ms alle 80 ms; Drehen behält das Ziel. Bots tippen wie Menschen einen Schritt je Takt | Spielwunsch; Tipps statt Fingerposition sind genauer und senden weniger Pakete |
| Tower Tumble | Fallender Stein ist kinematisch (Halbzellenraster, Vierteldrehung mit seitlichem Ausweichen, 2,2 bzw. 12 Zellen/s); beim ersten Kontakt wird er zum Körper. Ein ruhender Turm schläft nach 0,4 s und wird beim nächsten Aufsetzen geweckt. Steine unter −6 m oder neben dem Sockel gelten als verloren | Steuerbarkeit wie in Fallblockspielen, danach echte Physik; Schlafen verhindert Kriechen hoher Türme und spart Rechenzeit |
| Tower Tumble | Sicht: Körper gepackt `[id, Form, Drehung, x, y, Winkel]`, fremde Türme auf 1 cm gerundet, ohne Geschwindigkeiten und Warmstart; Steinfolge nur bis zum nächsten Stein | Datenmenge bei sechs Türmen |
| Hook Wars | Haken als Strahl ohne Flugzeit (Reichweite 7,5); trifft den nächsten Anker in 0,7 Abstand zur Linie oder einen Gegner davor | Robust bei Netzlatenz, eindeutig entscheidbar |
| Hook Wars | Gehaltener Haken zieht mit 5 Einheiten/s heran, die Seillänge begrenzt den Abstand (Schwingen); Loslassen behält den Schwung | „Schwingen oder heranziehen“ in einer Geste |
| Hook Wars | Stick nach oben = Sprung von einer Plattform; Plattformen sind von unten durchlässig | Ohne Sprung wären untere Ebenen Sackgassen |
| Hook Wars | 4 s Abklingzeit nur nach Treffern auf Gegner; ein Fehlschuss sperrt 0,35 s | Spezifikation nennt die Abklingzeit für erfolgreiche Treffer |
| Hook Wars | Zonen und Anker spiegelbildlich (links/rechts); Paare auf gleicher Höhe; Kerne erscheinen alle 6 s an 5 mittigen Punkten, höchstens 3 | „Vergleichbar fair erreichbar“; Paare sind gleich, Höhenunterschiede zwischen Paaren bleiben |
| Hook Wars | Gleichstand nach 90 s: höchstens 30 s Verlängerung, die nächste Abgabe einer gleichauf liegenden Person gewinnt, sonst geteilter Platz | Begrenzte Dauer |
| Alle | Öffentliche Sicht enthält fremde Spieler nur mit Kennung, Farbe, Team und Anwesenheit, Ereignisse der letzten 1,5 s und auf 1/1000 gerundete Kommazahlen | Datenmenge begrenzen |

Weitere Abweichungen werden beim jeweiligen Spiel ergänzt.

## Leistungsgrenzen

Frühere Node-/Chromium-Messungen sind historische Vergleichswerte, keine Gerätefreigabe. Der Handy-Host klont Zustände und erzeugt gerätespezifische Sichten; Tower Tumble mit hohen Türmen sowie Lava mit mehreren Etagen besonders auf Rechenzeit und Datenmenge prüfen. Erst messen, dann optimieren; Physik/Fairness nicht für Dekoration verändern. Offene Arbeit und Gerätetests im [Backlog](backlog.md).

## Lokaler Proberaum

`shared/matches/proberaumCourse.ts` beschreibt die zusammenhängende Übungsinsel; `course("proberaum")` verwendet denselben Parcours-Kern. Die Kennung steht ausdrücklich nicht in `MATCH_IDS`, `COURSE_IDS` oder im Zufallspool. `shared/proberaum.ts` steuert ausschließlich die lokale Übung mit geprüften Eingaben und 50-ms-Schritten. Der `practice`-Schalter unterdrückt Rennende und Ausscheiden durch Glibber; Rückkehrpunkte dürfen zusätzlich eine x-Koordinate haben. Normale Parcours behalten ihre bisherigen Regeln.

`PracticeWorldScreen` ist ein eigener, verzögert geladener Einstieg aus der lokalen Spielauswahl. Er nutzt die bestehenden Touch-Steuerelemente, `parcoursWorld` und dessen 2D-Ersatzdarstellung. Geöffnete Werkzeuge, Pause und Animationsvorschau halten die Simulation an; beim App-Wechsel werden Eingaben neutralisiert. Die Vorschau nutzt die tatsächlichen Animationsclips der Parcoursfiguren und verändert keine Physik. Es werden keine Räume angelegt und keine Online-Spielstände geändert.

## 3D-Darstellung und Parcours

`MatchClient.world`/`MatchStage` wählen WebGL oder Canvas; `preloadMatchWorld` lädt im Intro. Gemeinsame Kameras/Größen/Effekte: `src/three/matchScene.ts`. Fehler/Kontextverlust führt ohne Raumverlust zur Canvas. HUD, Countdown, Eingaben und Ergebnis bleiben gemeinsam; reduzierte Bewegung entfernt nur Dekoration.

| Szene | Dauerhafte Entscheidung |
| --- | --- |
| `bombWorld.ts` | Ganzes Feld sichtbar, feste geneigte Kamera, instanzierte Blöcke/Flammen, gewählte Figuren; Steuerbereich freihalten. |
| `tankWorld.ts` | Wandgeometrie entspricht Regeln; eigener Ziellaser nur bis erster Wand, keine Abprallvorhersage; 132 px Steuerreserve. |
| `lavaWorld.ts` | Vulkantempel auf drei Etagen; Kamera folgt eigener Etage, höhere ausgeblendet, tiefere abgedunkelt; Bröckeln/Rückkehr/Randwarnung lesbar. |
| `tankView.ts` | Tank-Regeln wiederverwenden; Autorität filtert Panzer, Wracks und fremde Kugeln nach Sichtlinie und Distanz ≤6. Zuschauer sehen alles, Bots dieselbe eingeschränkte Sicht wie Spieler. |
| `parcoursWorld.ts` | Eigene Gameshow-Strecken; Geometrie und Hinderniszeit passen zur Physik. Kein Nachbau fremder Level/Figuren; Canvas als Draufsicht. |
| Sumo, Bumper Mayhem, Chaos Run | Skelettfiguren und szenenspezifische Kameras; [Figurenpipeline](figuren-rigged.md). |

Kamera: `ChaseCamera`, `cameraRelative`/`chaseStick`/`chaseAim` in `src/matches/client.ts`. Blickrichtung lokal, Steuerung in Weltkoordinaten; gehaltene Eingaben bei Kameradrehung nachführen. Ausrichtung beim Start/Respawn, danach Drehung per Wischen statt automatischer Laufrichtungsverfolgung. Turmsicht: oben rechts wischen. Standhaft: drehbare Arena-Übersicht.

Parcours-Kern: `shared/matches/parcours.ts`, Strecken: `parcoursCourses.ts`. Laufen, Springen, Hechten, Festhalten und Ducken teilen deterministische Physik. Tür-/Pfadgeheimnisse vor Entdeckung nicht übertragen. Wertung nach Ankunft, sonst Fortschritt; Ende, wenn alle im Ziel/raus, 20 s nach erster Ankunft oder nach 120 s. Standhaft: Sturz = ausgeschieden, letzter Überlebender bzw. Sturzzeit, höchstens 90 s. Zuschauer wechseln verfolgte Person.

Läufe: Türenlotto, Kreiselkurs, Glibberflut, Geisterpfad, Fallklappen, Windkanal, Kletterwand; Wippenwerk erste Generation. Auswahl/Zufallsgewichtung: `shared/minigameCatalog.ts`; Proberaum ausdrücklich ausgeschlossen.

Grafikbudget: Pixelratio begrenzen, Geometrien teilen/instanzieren, Partikel begrenzen, `SceneKit`-Qualitätsstufen nutzen. Ziel 60 FPS, mindestens stabile 30; reale Abnahme ausstehend. Smartphone-Browser mit 2/4/6 Personen, beiden Bewegungseinstellungen, Steuerung/Ergebnis und WebGL-Rückfall. Android/iPhone zusätzlich: hintere Reihen, kleine Fahrerfiguren, Runen/Etagen, Schutzblinken, Schubsergefühl, Erwärmung/Ladezeit. [Gerätetest](geraetetest.md).
