# Kribbeln: Aufgabe und Wurf verstehen

Die aktuelle Aufgabe ist der Blickfang: kleine Würfelsymbole zeigen, welche
Farben oder Farbgruppen gesucht sind. Eine Rückmeldung zählt erst nach dem
Landen mit. Texte und Buchstaben ergänzen Farben. Kribbelfelder zeigen die
bisher höchste Summe und das nächste Ziel.

## Gestaltungsplan

- Petrol `#153f49` für die Würfelkiste, Filz `#226776`, Papier `#fff9e8`,
  Gold `#ffd166`, Grün `#318463`, Leder `#87533d` für den Becher.
- Bestehende Trebuchet für Regeln und Bedienung, kräftige tabellarische Zahlen
  für Mengen und Summen. Keine neue Schrift oder externe Assets.
- Handy: Aufgabe, Zielbild, Würfelkiste, Auswertung, Aktionen untereinander.
  Texte linksbündig, Würfelbilder und Mengenvergleiche zentriert.

Symbole erklären die Bedingung. Frei wählbare Farben sind ausdrücklich als solche
gekennzeichnet. Die sechs Aufgaben erhalten unterschiedliche Mengenbilder;
die vorhandene Würfelkiste bleibt das gemeinsame visuelle Bindeglied.

## Würfel und Wurf

Eine gemeinsame Seitentabelle beschreibt die sechs physischen Würfel. Jeder
enthält die Zahlen 1–6 und jede Farbe genau einmal. Über alle 36 Seiten kommt
jede Kombination aus Zahl und Farbe genau einmal vor. Diese Tabelle steuert
Wurfergebnis und sichtbare Würfelseiten. Die bisherige zyklische Verteilung
bleibt erhalten; es wird keine Übereinstimmung mit Originalmaterial behauptet.

Die sechs Würfel werden einmal angelegt und behalten ihre festen Farbseiten
auch beim Einsammeln, Schütteln und Fliegen. Links auf dem Filz steht ein
Lederbecher, rechts liegen die sechs Plätze. Becherinhalt und fliegende Würfel sind dieselben sechs Objekte. Der Becher kippt nach rechts; die Würfel verlassen seine Öffnung
zeitversetzt und rollen zu ihren Plätzen. Behaltene Würfel bleiben liegen.

Den Becher mit Finger oder Maus hin und her bewegen; ein zügiger Swipe nach
unten wirft die Würfel aus. Der normale Würfeln-Knopf sammelt und wirft ebenfalls.
Optional wird die Handybewegung über einen eigenen Knopf freigegeben: mehrmals
schütteln, kurz zur Ruhe kommen lassen, dann kippen. Ein einzelner Stoß wirft
nicht. Fehlende, verweigerte oder ausbleibende Sensordaten lassen Swipe und
Würfeln-Knopf verfügbar. Sensoren und Gesten wirken nur während des eigenen
Zugs mit verbleibenden Würfen und mindestens einem freien Würfel.

Beschriftungen, Aufgabenzähler und Summe erscheinen nach dem Landen; die
Farbseiten sind durchgehend sichtbar. Ein bereits abgeschlossener Wurf wird
beim Beitritt nicht erneut animiert. Reduzierte Bewegung entfernt Einsammeln,
Schütteln und Flug, das Ergebnis erscheint unmittelbar. Sensoren, Timer und
Pointer-Capture werden beim Verlassen aufgeräumt. Wertung und Aufgaben bleiben
erhalten. Die Tests simulieren Handybewegungen; echte Geräte sind zusätzlich
praktisch zu prüfen.
