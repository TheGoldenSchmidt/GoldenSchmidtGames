# Kribbeln: Aufgabe und Wurf verstehen

Die aktuelle Aufgabe ist der Blickfang: kleine Würfelsymbole zeigen, welche
Farben oder Farbgruppen gesucht sind. Eine Rückmeldung zählt erst nach dem
Landen mit. Texte und Buchstaben ergänzen Farben. Kribbelfelder zeigen die
bisher höchste Summe und das nächste Ziel.

## Gestaltungsplan

- Petrol `#153f49` für die Würfelkiste, Filz `#226776`, Papier `#fff9e8`,
  Gold `#ffd166`, Grün `#318463`, neutraler Würfel `#d4e1df`.
- Bestehende Trebuchet für Regeln und Bedienung, kräftige tabellarische Zahlen
  für Mengen und Summen. Keine neue Schrift oder externe Assets.
- Handy: Aufgabe, Zielbild, Würfelkiste, Auswertung, Aktionen untereinander.
  PC: Aufgabenblatt links, Würfelkiste und Aktionen rechts; Punktestand darüber.
  Texte linksbündig, Würfelbilder und Mengenvergleiche zentriert.

```text
Handy                         PC
Spieler                       Spieler
Aufgabe + Zielbild             Aufgabe + Zielbild | Würfelkiste
Würfelkiste                   Versuche           | Summe + Aktionen
Summe + Aktionen              Wertungsblatt
```

Ein Entwurf mit rein dekorativen bunten Würfeln wurde verworfen: Die Symbole
müssen die Bedingung erklären. Frei wählbare Farben sind ausdrücklich als solche
gekennzeichnet. Die sechs Aufgaben erhalten unterschiedliche Mengenbilder;
die vorhandene Würfelkiste bleibt das gemeinsame visuelle Bindeglied.

## Würfel und Wurf

Eine gemeinsame Seitentabelle beschreibt die sechs physischen Würfel. Jeder
enthält die Zahlen 1–6 und jede Farbe genau einmal. Über alle 36 Seiten kommt
jede Kombination aus Zahl und Farbe genau einmal vor. Diese Tabelle steuert
Wurfergebnis und sichtbare Würfelseiten. Die bisherige zyklische Verteilung
bleibt erhalten; es wird keine Übereinstimmung mit Originalmaterial behauptet.

Fallende Würfel sind neutral. Ihre Farbseiten, Beschriftungen, Aufgabenzähler
und die Summe erscheinen erst am Ende des Wurfs. Behaltene Würfel bleiben
sichtbar liegen, auch auf den Geräten anderer Online-Spieler. Ein bereits
abgeschlossener Wurf wird beim Beitritt nicht erneut animiert. Reduzierte
Bewegung zeigt das Ergebnis unmittelbar. Wertung und Aufgaben ändern sich nicht.
