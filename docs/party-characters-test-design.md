# Figurenwahl und Solo-Test

Die Figurenwahl ist eine kleine Bühne am Hafen: eine große, drehbare 3D-Figur
steht auf einem farbigen Spielersockel. Daneben stehen Name, Bestätigung und
eine kompakte Liste der tatsächlich vorhandenen Figuren. Auf dem Handy folgt
die Liste unter der Bühne. Ein Canvas zeigt jeweils nur eine Vorschau.

Farben aus der Inselwelt: Hafenblau #10485b, Wasser #94def1, Sand #ffe5a1,
Sonnengelb #ffd258, Koralle #e87565 und Gras #65ba61. Die vorhandene runde
Systemschrift bleibt für Namen und Bedienung erhalten. Namen sind größer als
Hilfstexte; Einstellungen stehen linksbündig, die Figur zentral.

```
PC:     [ Figur auf Sockel ] [ Name / Auswahl / Figurenliste ]
Handy:  [ Figur auf Sockel ]
        [ Name / Auswahl ]
        [ Figurenliste ]
```

Die große Figur ist das prägende Element. Keine zusätzliche Kartenlandschaft
oder animierte Dekoration. Drehung antwortet auf Ziehen, ein gewähltes Modell
wird sofort sichtbar. Reduzierte Bewegung verhindert Idle- und Einzugsbewegung.
Alle Spieler behalten dieselbe Spielphysik und ihre Farbmarkierung.

Vorabkritik: Eine Galerie aus zwölf gleichzeitig laufenden Canvas-Vorschauen
wäre auf dem Smartphone teuer und würde vom eigenen Charakter ablenken. Daher
eine gemeinsame Bühne und eine zugängliche Liste mit Namen und Farbpunkten.

Der Solo-Test ist eine ausdrücklich gekennzeichnete Online-Testpartie. Die Bots
verwenden dieselben Aktionen und Steuerungsregeln wie Menschen. Testwerkzeuge
sind nur im Testraum für dessen Host verfügbar. Freie Minispielauswahl,
Neustart mit festem Startwert und Überspringen von Bot-Zügen erleichtern Tests.
Normale Mehrspielerräume erhalten diese Werkzeuge nicht.

Nach der Browseransicht: Die einzelne Bühne bleibt auch bei zwölf Figuren
übersichtlich. Auf dem PC stehen Auswahl und Modell nebeneinander; auf dem
Handy bleiben alle Namen ohne seitliches Scrollen erreichbar. Das Testmenü
schließt nach erfolgreicher Auswahl, damit die Bühne des Minispiels Platz hat.
Es steht unter der festen Spielüberschrift, sodass die Orientierung erhalten
bleibt. Ein farbiger Ring verbindet die gewählte Figur mit der Spielerfarbe.
