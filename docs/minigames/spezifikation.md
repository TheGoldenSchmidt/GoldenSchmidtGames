# Spezifikation: 12 Multiplayer-Minispiele

Verbindliche Ausgangsbasis des Auftraggebers (November 2026), unverändert
übernommen. Abweichungen, die Bedienbarkeit, Fairness oder Spielspaß
verbessern, stehen mit Begründung in [konzept.md](konzept.md#dokumentierte-abweichungen).
Umsetzungsstand und Reihenfolge: [backlog.md](backlog.md).

## Allgemeines

Entwickle zwölf unterschiedliche mobile Multiplayer-Minispiele. Jeder Spieler
verwendet sein eigenes Smartphone. Alle Spiele sollen einfach zu erlernen,
optisch hochwertig und möglichst innerhalb von 30–120 Sekunden spielbar sein.

Die Spiele verwenden unterschiedliche Mechaniken wie Geschicklichkeit,
Reaktion, Strategie, Physik, Bewegung und direkte Spielerinteraktion.

Die beschriebenen Regeln dienen als verbindliche Ausgangsbasis. Kleine
Anpassungen sind erlaubt, wenn sie Bedienbarkeit, Fairness oder Spielspaß
nachweislich verbessern. Solche Änderungen müssen dokumentiert werden.

Ergänzende Vorgaben aus dem Auftrag:

- Die bisherigen 14 Minispiele gelten als **klassisch** und lassen sich beim
  Erstellen der Partie per Checkbox ausschließen.
- Alle Minispiele, Inselparty und Roll It Up! sind nur noch für Smartphones
  vorgesehen. Implementierungen und Tests für PC-Versionen entfallen.

## 1. Neon Pong – Power Pong

**Spieler:** 1v1 oder 2v2

**Szenario:** Zwei Teams treten in einer futuristischen Neon-Arena
gegeneinander an. Holografische Bälle und elektrische Power-ups machen aus
klassischem Pong einen dynamischen Wettkampf.

**Steuerung:** Spieler bewegen ihren Schläger durch vertikale
Fingerbewegung. Im 2v2-Modus verteidigen zwei Spieler dieselbe Seite mit
leicht überlappenden Bewegungsbereichen.

**Mechanik und Regeln:**

- Der Ball prallt zwischen Schlägern und Arenawänden ab.
- Je nach Auftreffpunkt am Schläger verändert sich der Abprallwinkel.
- Die Geschwindigkeit nimmt bei längeren Ballwechseln bis zu einem Maximum zu.
- Verlässt ein Ball das Spielfeld hinter einem Schläger, erhält das
  gegnerische Team einen Punkt.
- Alle 10–15 Sekunden kann ein Power-up erscheinen, das durch Ballkontakt
  aktiviert wird.
- Power-ups: breiterer Schläger (5 s), drei gleichzeitige Bälle, gekrümmte
  Flugbahn oder kurzzeitiger Slowdown.
- Maximal ein aktiver Power-up-Effekt pro Team.
- Im Mehrballmodus zählt jeder gültige Torball als Punkt.
- Nach jedem regulären Tor erfolgt ein neuer Aufschlag. Bei Mehrball wird
  gewartet, bis alle aktiven Bälle abgehandelt wurden.

**Sieg:** Erstes Team mit 7 Punkten oder höhere Punktzahl nach 90 Sekunden.
Gleichstand: Golden Goal.

**Technik:** Ballphysik, Paddle-Kollisionen, Teamsteuerung,
Power-up-System, synchronisierte Ballposition und Torerkennung.

## 2. Tank Trouble – Panzerchaos

**Spieler:** 2–6, jeder gegen jeden

**Szenario:** Kleine Comic-Panzer kämpfen in einem verwinkelten Labyrinth.
Geschosse prallen von Mauern ab, zerstören Hindernisse und ermöglichen
überraschende Trickschüsse.

**Steuerung:** Virtueller Joystick für Bewegung, rechte Bildschirmhälfte zum
Ausrichten des Geschützes und Schießen.

**Mechanik und Regeln:**

- Top-down-Arena mit festen und zerstörbaren Wänden.
- Jeder Panzer besitzt 3 Trefferpunkte.
- Geschosse können maximal zweimal von festen Wänden reflektiert werden.
- Danach verschwinden sie.
- Maximal zwei gleichzeitig aktive Standardgeschosse pro Panzer.
- Direkte und indirekte Treffer verursachen jeweils einen Schadenspunkt.
- Nach 3 Treffern wird der Panzer zerstört; der verantwortliche Gegner
  erhält einen Abschusspunkt.
- Respawn nach 2 Sekunden mit kurzem Schutz.
- Selbsttreffer sind möglich, geben aber keine Abschusspunkte.
- Zufällige Power-ups: Schnellschuss, Dreifachschuss und temporärer
  Schutzschild.
- Zerstörbare Mauern eröffnen neue Schusswege.

**Sieg:** 7 Abschüsse oder die meisten Abschüsse nach 90 Sekunden.
Gleichstand: weniger eigene Tode, danach Stechen.

**Technik:** Panzerbewegung, Projektilreflexionen, Schaden, Zerstörung,
Respawn und Power-ups.

## 3. Quick Draw – Western Showdown

**Spieler:** 2–6

**Szenario:** Cowboys stehen sich in einer Westernstadt gegenüber. Ein
plötzliches Signal entscheidet über den Startschuss, während falsche Signale
und Ablenkungen die Nerven testen.

**Steuerung:** Ein großer Touchbereich zum Schießen.

**Mechanik und Regeln:**

- Vor jeder Runde erscheint nach zufälligen 2–5 Sekunden das gültige
  Startsignal.
- Vorher können visuelle Täuschungen erscheinen.
- Wer vor dem Startsignal tippt, begeht einen Fehlstart und verliert diese
  Runde beziehungsweise erhält 0 Punkte.
- Die gültigen Reaktionszeiten werden verglichen.
- Im 1v1 gewinnt der schnellere gültige Schuss. Gespielt wird bis zu 3
  Rundensiegen.
- Bei 3–6 Spielern reagieren alle gleichzeitig auf dasselbe Signal.
- Der schnellste gültige Spieler erhält 3 Punkte, der zweite 2, der dritte 1
  Punkt.
- Alle übrigen erhalten 0 Punkte.
- Gruppenmodus über 5 Durchgänge.
- Bei Gleichstand folgt ein Stechdurchgang.

**Sieg:** Drei gewonnene Duellrunden beziehungsweise höchste
Gruppenpunktzahl.

**Technik:** Präziser Zeitabgleich, synchronisierte Startsignale,
Zeitstempelvalidierung, faire Latenzkompensation und Erkennung von
Fehlstarts. Client-Reaktionszeiten dürfen nicht ungeprüft übernommen werden.

## 4. Tower Tumble – Der wackelige Turm

> **Stand Nov. 2026:** Nach Spielrückmeldung als gleichzeitiges Turmrennen mit
> echter Physik neu gebaut; diese Ursprungsfassung gilt nicht mehr. Aktuelle
> Regeln: [Konzept](konzept.md).

**Spieler:** 2–6

**Szenario:** In einem verrückten Bauwettbewerb stapeln Spieler gemeinsam
einen immer instabileren Turm. Jeder möchte höher bauen, ohne den Einsturz
zu verursachen.

**Steuerung:** Baustein mit dem Finger horizontal verschieben und durch
Loslassen fallen lassen.

**Mechanik und Regeln:**

- Gemeinsamer physikalisch simulierter Turm.
- Spieler platzieren abwechselnd Bausteine unterschiedlicher Größe und Form.
- Jeder Spieler erhält insgesamt 3 Platzierungszüge.
- Maximal 5 Sekunden zum Positionieren; danach fällt der Baustein
  automatisch.
- Nach dem Aufprall wird eine kurze physikalische Beruhigungsphase
  abgewartet.
- Stabil platzierter Baustein: +1 Punkt.
- Deutliche neue Rekordhöhe: +1 Bonuspunkt.
- Wesentlicher Einsturz durch die eigene Platzierung: −2 Punkte.
- Nach einem Einsturz wird ein neuer Turm begonnen.
- Die Reihenfolge rotiert zwischen Durchgängen.
- Stabilität und Einsturz müssen anhand eindeutiger physikalischer Kriterien
  bestimmt werden.

**Sieg:** Höchste Gesamtpunktzahl nach 3 Zügen pro Spieler. Gleichstand:
größter eigener erfolgreicher Höhenbeitrag, danach Stechrunde.

**Technik:** Starre-Körper-Physik, Schwerkraft, Kollisionen,
Stabilitätserkennung, Turmhöhe und Zugverwaltung.

## 5. Light Trails – Neon Survival

**Spieler:** 2–6

**Szenario:** Futuristische Gleiter hinterlassen auf einem digitalen
Spielfeld tödliche Lichtspuren. Während sich die Arena verkleinert, müssen
die Spieler immer schwierigere Wege finden.

**Steuerung:** Richtungswechsel per Wischgeste oder zwei Richtungstasten.

**Mechanik und Regeln:**

- Alle Gleiter bewegen sich automatisch mit gleicher Geschwindigkeit auf
  einem Raster.
- Spieler können ausschließlich um 90 Grad abbiegen.
- Sofortige 180-Grad-Wenden sind verboten.
- Jede Bewegung hinterlässt eine dauerhaft blockierende Lichtspur.
- Kollision mit Wand, eigener Spur oder fremder Spur bedeutet Ausscheiden.
- Nach 12 Sekunden beginnt die Arena schrittweise zu schrumpfen.
- Drei Durchgänge werden gespielt.
- Für jeden überlebten Gegner gibt es +1 Punkt.
- Der letzte Überlebende erhält zusätzlich 3 Punkte.
- Gleichzeitige Ausscheidende werden gleich platziert.

**Sieg:** Höchste Gesamtpunktzahl nach 3 Durchgängen.

**Technik:** Deterministische Rasterbewegung, belegte Felder, synchrone
Kollisionen und Arenaverkleinerung.

## 6. Arrow Masters – Bogenschützen-Turnier

**Spieler:** 2–6

**Szenario:** Mittelalterliche Bogenschützen treten auf verschiedenen
Plattformen in einem Turnier gegeneinander an. Wind, Schwerkraft und
Hindernisse machen jeden Treffer zur Herausforderung.

**Steuerung:** Durch Ziehen Schusswinkel und Stärke bestimmen. Schuss
vorbereiten; Auslösung erfolgt am Ende der Zielphase.

**Mechanik und Regeln:**

- Jeder Spieler steht an einer festen Position innerhalb derselben 2D-Arena.
- Pro Runde haben alle Spieler 10 Sekunden Zeit zum Zielen.
- Anschließend werden sämtliche vorbereiteten Pfeile gleichzeitig
  abgeschossen.
- Pfeile folgen einer ballistischen Flugbahn aus Abschussstärke, Winkel,
  Schwerkraft und Wind.
- Alle Spieler besitzen 3 Trefferpunkte.
- Direkter Gegnertreffer: 1 Schaden und +2 Punkte für den Schützen.
- Besiegen eines Gegners: +1 Bonuspunkt.
- Besiegte Spieler erscheinen zur nächsten Runde wieder mit 3
  Trefferpunkten.
- Neutrale Zielscheiben bringen +1 Punkt.
- Windrichtung und Windstärke wechseln zwischen den Runden.
- Hindernisse können Pfeile blockieren.
- Insgesamt 5 Schussrunden.

**Sieg:** Höchste Punktzahl nach 5 Runden. Gleichstand: Präzisions-Stechen
auf eine Zielscheibe.

**Technik:** Ballistik, Windmodell, Schusskraft, Kollisionsprüfung,
synchrone Schüsse und Zielscheiben.

## 7. Sumo Smash – Arena Knockout

**Spieler:** 2–6

**Szenario:** Kleine Comic-Sumo-Kämpfer versuchen, sich gegenseitig aus
einer schwebenden Arena zu befördern. Geschicktes Positionieren und gut
getimte Stoßangriffe entscheiden den Kampf.

**Steuerung:** Joystick für Bewegung und Button für Stoßangriff.

**Mechanik und Regeln:**

- Alle Spieler bewegen sich frei in einer kreisförmigen Top-down-Arena.
- Ein Stoßangriff verursacht einen kurzen Vorwärtsschub.
- Getroffene Gegner erhalten einen Rückstoßimpuls.
- Angriffe besitzen 3 Sekunden Abklingzeit.
- Jeder Spieler startet mit 3 Leben.
- Ein Ring-Out kostet ein Leben.
- Respawn nach 2 Sekunden mit kurzem Schutz.
- Wer einen gegnerischen Ring-Out verursacht, erhält +2 Punkte.
- Bei 0 Leben scheidet der Spieler aus.
- Nach 40 Sekunden schrumpft die Arena.
- Alle Charaktere besitzen identische Grundwerte.

**Sieg:** Letzter Überlebender gewinnt. Nach 75 Sekunden zählen verbleibende
Leben, danach verursachte Ring-Outs. Falls erforderlich, Sudden Death.

**Technik:** Top-down-Bewegung, Kollisionsimpulse, Knockback,
Angriffscooldowns und Ring-Out-Erkennung.

## 8. Hook Wars – Greifhaken-Chaos

**Spieler:** 2–6

**Szenario:** Kleine Roboter schwingen durch einen schwebenden Schrottplatz
und sammeln Energiekerne. Mithilfe ihrer Greifhaken können sie sich schnell
bewegen und Gegnern ihre Beute entreißen.

**Steuerung:** Joystick für Bewegung, Wisch-/Ziehgeste für
Greifhakenrichtung, Loslassen zum Lösen der Verbindung.

**Mechanik und Regeln:**

- Seitlich dargestellte 2D-Arena mit mehreren Ebenen und Plattformen.
- Greifhaken verbinden sich mit markierten Ankerpunkten.
- Spieler können daran schwingen oder sich heranziehen.
- Energiekerne erscheinen regelmäßig an wechselnden Stellen.
- Jeder Spieler darf maximal einen Kern gleichzeitig tragen.
- Ein Kern muss in der eigenen Abgabezone abgegeben werden: +1 Punkt.
- Greifhaken können auch Gegner treffen und kurzzeitig heranziehen.
- Getroffene Gegner können einen transportierten Kern verlieren.
- Erfolgreiche Greifhaken-Treffer gegen Spieler besitzen 4 Sekunden
  Cooldown.
- Wer aus der Arena fällt, respawnt und verliert seinen getragenen Kern.
- Spawnpunkte und Abgabezonen müssen vergleichbar fair erreichbar sein.

**Sieg:** Meiste abgegebene Energiekerne nach 90 Sekunden. Gleichstand:
nächste erfolgreiche Abgabe.

**Technik:** Plattformbewegung, Schwing- und Seilphysik, Ankerpunkte,
Objekttransport, Spielerinteraktionen und Respawns.

## 9. Bomb Arena – Explosive Maze

**Spieler:** 2–6

**Szenario:** In einer chaotischen Bombenfabrik kämpfen kleine
Sprengstoffexperten um die Vorherrschaft. Explosionen zerstören Labyrinthe,
eröffnen neue Wege und lösen gefährliche Kettenreaktionen aus.

**Steuerung:** Joystick für Rasterbewegung und Button zum Bombenlegen.

**Mechanik und Regeln:**

- Top-down-Labyrinth mit festen und zerstörbaren Blöcken.
- Jeder Spieler beginnt mit 2 Leben pro Durchgang.
- Standardbomben detonieren nach 2 Sekunden.
- Explosionen breiten sich kreuzförmig über zunächst 2 Felder pro Richtung
  aus.
- Feste Mauern stoppen Explosionen.
- Zerstörbare Blöcke verschwinden durch die Explosion, blockieren die
  Ausbreitung in dieser Richtung aber zunächst.
- Explosionen können andere Bomben sofort detonieren lassen.
- Anfangs maximal eine aktive Bombe gleichzeitig pro Spieler.
- Explosionskontakt verursacht 1 Schaden; dieselbe Explosion darf nicht
  mehrfach Schaden am selben Spieler verursachen.
- Nach dem ersten Treffer erfolgt ein sicherer Respawn.
- Power-ups: größere Explosionsreichweite, zusätzliche Bombe, höhere
  Geschwindigkeit und Bombenkick.
- Nach 25 Sekunden beginnt die Arena zu schrumpfen.
- Zwei Durchgänge mit maximal 40 Sekunden.

**Punkte:** Gegnerischer Knockout +2, Rundensieg +3. Selbsttreffer und
Umweltschaden geben keine Abschusspunkte.

**Sieg:** Höchste Gesamtpunktzahl nach 2 Durchgängen. Bei Zeitablauf
entscheiden verbleibende Leben über den Rundensieg; bei Gleichstand werden
die Bonuspunkte geteilt. Bei Gesamtgleichstand: Sudden Death.

**Technik:** Grid, Bombentimer, Kettenreaktionen, Zerstörung, Power-ups,
Schaden, sichere Respawns und Arenaverkleinerung.

## 10. Floor is Lava – Einstürzende Plattform

**Spieler:** 2–6

**Szenario:** Eine uralte Tempelanlage schwebt über einem glühenden
Lavasee. Jeder Schritt beschädigt den Boden, während immer mehr Plattformen
unwiederbringlich verschwinden.

**Steuerung:** Joystick für Bewegung und Button für einen kurzen Sprung.

**Mechanik und Regeln:**

- Spielfeld besteht aus quadratischen oder sechseckigen Bodenplatten.
- Sobald ein Spieler eine intakte Platte betritt, beginnt sie instabil zu
  werden.
- Nach 0,8 Sekunden verschwindet die Platte.
- Regenerierbare Platten erscheinen nach 2,5 Sekunden erneut.
- Ein Sprung kann kleine Lücken überwinden.
- Sprung-Cooldown: 3 Sekunden.
- Lavakontakt kostet 1 Leben.
- Jeder Spieler besitzt 2 Leben pro Durchgang.
- Nach 10 Sekunden werden äußere Platten dauerhaft entfernt.
- Drei Durchgänge mit jeweils maximal 20 Sekunden.
- Für jeden überlebten Gegner: +1 Punkt.
- Rundensieg: zusätzliche 3 Punkte.
- Gleichzeitig ausgeschiedene Spieler erhalten denselben Rang.

**Sieg:** Höchste Gesamtpunktzahl nach 3 Runden. Bei Zeitablauf teilen
verbleibende Spieler die beste Platzierung. Bei Gesamtgleichstand folgt
eine Stechrunde.

**Technik:** Tile-State-Machine, Zeitsteuerung, Plattformkollisionen,
Sprungmechanik, Regeneration und globales Schrumpfen.

## 11. Bumper Mayhem – Autoscooter Battle

**Spieler:** 2–6

**Szenario:** In einer verrückten Autoscooter-Arena versuchen die Fahrer,
ihre Konkurrenten durch wuchtige Zusammenstöße aus dem Ring zu schleudern.
Turbos und bewegliche Hindernisse sorgen für Chaos.

**Steuerung:** Joystick für Fahrtrichtung und Turbo-Button.

**Mechanik und Regeln:**

- Top-down-Fahrzeuge mit Beschleunigung, Trägheit und begrenzter
  Höchstgeschwindigkeit.
- Zusammenstöße übertragen abhängig von Geschwindigkeit und
  Kollisionswinkel Impulse.
- Fahrzeuge können Gegner durch Rammstöße über den Arenarand befördern.
- Turbo erhöht kurzzeitig die Geschwindigkeit und damit die Rammwirkung.
- Turbo-Cooldown: 5 Sekunden.
- Jeder Spieler beginnt mit 3 Leben.
- Ring-Out kostet 1 Leben.
- Verursachter gegnerischer Ring-Out bringt +2 Punkte.
- Respawn mit kurzem Schutz.
- Bewegliche Hindernisse können zusätzliche Kollisionen auslösen.
- Nach 45 Sekunden schrumpft die Arena.
- Alle Fahrzeuge besitzen identische Grundwerte.

**Sieg:** Letzter Überlebender oder nach 75 Sekunden die meisten Leben,
anschließend die meisten Ring-Outs. Gleichstand: Sudden Death.

**Technik:** Fahrzeugphysik, Impulskollisionen, Turbo, Knockback,
Ring-Outs, Respawn und Arenaverkleinerung.

## 12. Chaos Run – Hindernisrennen

**Spieler:** 2–6

**Szenario:** Die Spieler nehmen an einer chaotischen Hindernis-Gameshow
teil. Rotierende Hämmer, einstürzende Brücken und bewegliche Plattformen
machen den Weg ins Ziel zum Wettkampf.

**Steuerung:** Figur läuft automatisch. Tippen zum Springen, länger halten
für höhere Sprünge, nach unten wischen zum Ducken/Rutschen.

**Mechanik und Regeln:**

- Seitliches 2D-Auto-Runner-Spiel.
- Alle starten gleichzeitig auf demselben Parcours.
- Figuren besitzen identische Grundgeschwindigkeit.
- Hindernisse: Bodenlücken, rotierende Hämmer, bewegliche Plattformen,
  einstürzende Brücken, bewegliche Wände, niedrige Durchgänge.
- Bei Kollision werden Spieler gebremst, zurückgeschleudert oder fallen
  herunter.
- Bei einem Sturz erfolgt ein Respawn am letzten Checkpoint.
- Checkpoints sind so verteilt, dass ein einzelner Fehler nicht das gesamte
  Rennen entscheidet.
- Einige Hindernisse besitzen vorhersehbare Aktivitätszyklen.
- Die Position anderer Spieler wird in einer Fortschrittsanzeige
  dargestellt.
- In Version 1 keine direkten Spieler-zu-Spieler-Kollisionen.
- Parcours bestehen aus kombinierbaren Hindernismodulen.
- Maximal 90 Sekunden Spielzeit.

**Sieg:** Erster Spieler im Ziel. Bei Zeitablauf gewinnt der höchste
Streckenfortschritt; bei gleichem Fortschritt zählt, wer diesen zuerst
erreicht hat.

**Technik:** Auto-Runner, Jump-/Slide-Mechanik, Hindernisphysik,
Checkpoints, Fortschrittsmessung und synchronisierte Strecken.

## Gemeinsame Designanforderungen

- Jeder Spieler verwendet ein eigenes Smartphone.
- Touchsteuerung muss für mobile Displays optimiert sein.
- Alle Spieler müssen wichtige Ereignisse synchron sehen.
- Klare visuelle Unterscheidung der Spieler durch Farben, Symbole oder
  Figuren.
- Hochwertiger, moderner Arcade-Stil innerhalb der bestehenden
  GoldenSchmidtGames-Designsprache.
- Unterschiedliche Themenwelten, aber gemeinsame UI-Elemente.
- Vor jedem Spiel kurze Anleitung mit Ziel, Steuerung und Siegbedingung.
- Countdown, Timer, Trefferfeedback, Soundeffekte und Siegerehrung.
- Flüssige Animationen und verständliche visuelle Effekte.
- Keine überladenen Bildschirme oder unnötig komplizierten Steuerungen.
- Wiederverwendung gemeinsamer Physik-, Kollisions-, Punkte-, Steuerungs-
  und Netzwerksysteme.
- Spielmechanik und Fairness besitzen Vorrang vor rein dekorativen
  Effekten.
- Die Minispiele liefern Match-Ergebnisse an das bestehende Partyspiel. Die
  übergeordnete Punkteverteilung bleibt Aufgabe des Partyspiels.

**Ziel:** Zwölf eigenständige, unterhaltsame und vollständig integrierte
Multiplayer-Minispiele, die als Grundlage für eine langfristig erweiterbare
Minispielsammlung dienen.

## Auftragsvorgaben zur Umsetzung (Kurzfassung)

- Phasen: 0 Analyse/Plan · 1 Framework mit Testspiel · 2 Quick Draw, Light
  Trails, Neon Pong · 3 Tank Trouble, Bomb Arena, Floor is Lava · 4 Sumo
  Smash, Bumper Mayhem, Chaos Run · 5 Arrow Masters, Tower Tumble, Hook Wars ·
  6 Qualitätssicherung.
- Jedes Spiel vollständig von Lobby bis Ergebnisanzeige, bevor das nächste
  beginnt. Keine Platzhalter als fertig deklarieren.
- Derselbe autoritative Kern für Handy-Host und Node-Server; Clients legen
  keine Treffer, Punkte oder Siege fest.
- Tests: Start, Gameplay, Sieg, Rückkehr; 2/4/6 Spieler; Neon Pong 1v1 und
  2v2; Verzögerung und Abbruch; gleichzeitige Ereignisse; Punkte,
  Gleichstände, Zeitablauf; Neustart und Ressourcenfreigabe; Regressionen.
- Ungetestete Bereiche ausdrücklich benennen.
