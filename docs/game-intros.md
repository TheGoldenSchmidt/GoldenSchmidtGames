# Ein Platz am Spieltisch

Die Spielauswahl führt in eine kurze räumliche Szene: erst die Runde sehen, dann
an den Tisch heranfahren, senkrecht auf die Spielfläche schauen und spielen.
Durak zeigt einen runden Filztisch mit sitzenden Figuren und verdeckten Karten.
Qwixx zeigt sechs Würfel und vierfarbige Blätter, Kribbeln eine Würfelmulde und
sechs Farbwürfel. Bei Inselparty fliegt die Kamera auf eine kleine Insel mit
Hafen, Palmen und Spielfeldern zu.

## Gestaltung

- Filzgrün `#205b50`, dunkles Petrol `#102f32`, Holz `#925c3d`, Messing
  `#d8b575`, Kartenweiß `#fff9e8`, Meeresblau `#219fca`.
- Die bestehende Trebuchet-Schrift bleibt für Namen und Steuerung. Nur der
  Spieltitel verwendet Georgia, wie die bestehenden Durak-Karten.
- Die Szene füllt den Bildschirm. Titel oben links, Überspringen oben rechts,
  kurze Szenenbeschreibung unten. Smartphone und PC erhalten eine ihrer Breite
  angepasste Kameradistanz.

```text
Spielname                         Intro überspringen

             Figuren am runden Tisch
                Kamerafahrt ↓

                   Szenenbeschreibung
```

Die Kamerafahrt ist das zentrale Gestaltungsmittel. Keine weiteren schwebenden
Elemente oder wiederholten Effekte. Die erste Entwurfsidee eines identischen
Kartentischs für jedes Spiel wurde verworfen: Spielmaterial und Inselkulisse
müssen das gewählte Spiel bereits vor der Bedienoberfläche erkennbar machen.

## Verhalten

Das Intro läuft nur beim neuen Spielstart, lokal und online. Wiederbeitritt und
Fortsetzen führen direkt ins Spiel. Die Spieloberfläche bleibt währenddessen
montiert und empfängt Online-Zustände, ist aber weder per Maus noch Tastatur
bedienbar. Spielregeln und Serverzeiten ändern sich nicht. Inselparty behält
ihre laufende Entscheidungszeit; das kurze Intro kann sofort übersprungen werden.

Überspringen und Escape öffnen sofort das Spiel. Reduzierte Bewegung überspringt
das Intro vollständig, auch wenn sie während der Kamerafahrt aktiviert wird.
Ohne WebGL erscheint eine zweidimensionale Ersatzszene. Alle Szenen bestehen aus
lokaler Geometrie; es werden keine externen Assets geladen. Renderer, Texturen,
Animationen und Event-Listener werden beim Ende der Sequenz freigegeben.
