# Ein Platz am Spieltisch

Die Spielauswahl führt in eine kurze räumliche Szene: erst die Runde sehen, dann
an den Tisch heranfahren, senkrecht auf die Spielfläche schauen und spielen.
Durak zeigt einen runden Filztisch mit sitzenden Figuren und verdeckten Karten.
Qwixx zeigt sechs Würfel und vierfarbige Blätter, Kribbeln eine Würfelmulde und
sechs Farbwürfel. Bei Inselparty fliegt die Kamera auf eine kleine Insel mit
Hafen, Palmen und Spielfeldern zu.

Freies Minispiel und Schlag den GoldenSchmidt öffnen unmittelbar die
Minispielanleitung beziehungsweise die Einsatzauswahl. Nach der Bereitschaft
beginnt die Arena mit ihrem gemeinsamen Drei-Sekunden-Countdown.

## Gestaltung

- Filzgrün `#205b50`, dunkles Petrol `#102f32`, Holz `#925c3d`, Messing
  `#d8b575`, Kartenweiß `#fff9e8`, Meeresblau `#219fca`.
- Die bestehende Trebuchet-Schrift bleibt für Namen und Steuerung. Nur der
  Spieltitel verwendet Georgia, wie die bestehenden Durak-Karten.
- Die Szene füllt den Bildschirm. Titel oben links, Überspringen oben rechts,
  kurze Szenenbeschreibung unten. Kameradistanz an Smartphone-Ausrichtung anpassen.

Kamerafahrt als einziger Blickfang; Material/Kulisse machen das gewählte Spiel erkennbar.

## Verhalten

Das Intro läuft nur beim neuen Spielstart, lokal und online. Wiederbeitritt und
Fortsetzen führen direkt ins Spiel. Die Spieloberfläche bleibt währenddessen
montiert und empfängt Online-Zustände, ist währenddessen aber nicht bedienbar.
Spielregeln und Serverzeiten ändern sich nicht. Das Intro kann sofort übersprungen werden.

Überspringen und Escape öffnen sofort das Spiel. Reduzierte Bewegung überspringt
das Intro vollständig, auch wenn sie während der Kamerafahrt aktiviert wird.
Ohne WebGL erscheint eine zweidimensionale Ersatzszene. Alle Szenen bestehen aus
lokaler Geometrie; es werden keine externen Assets geladen. Renderer, Texturen,
Animationen und Event-Listener werden beim Ende der Sequenz freigegeben.
