# Qwixx mit Würfelbecher

Der Lederbecher verwendet dieselben Gesten wie Kribbeln: hin und her schütteln,
nach unten wischen, optional Handybewegung freigeben und nach dem Schütteln
kippen. Der Würfeln-Knopf bleibt direkt am Tisch verfügbar. Die gemeinsame
Bechersteuerung verwaltet Pointer-Capture, Freigabe, Vorbereitung und Flug.

## Gestaltung

- Die bestehende Qwixx-Palette bleibt: Nachtblau `#17213e`, Rot `#e75a59`,
  Gelb `#f1c84b`, Grün `#39a879`, Blau `#4b7fd1`, Kartenweiß `#fffdf8`.
  Der Lederbecher setzt mit `#87533d` einen zum Material passenden Akzent.
- Die vorhandene Trebuchet-Schrift bleibt für Namen, Werte und Steuerung.
- Becher links, sechs Würfelplätze rechts; zwei weiße und vier einfarbige
  Würfel. Summe und Würfeln-Knopf darunter, dann das bestehende Wertungsblatt.
  Am Handy stehen die Reihen untereinander; die breite PC-Ansicht stellt Tisch
  und Wertungsblatt nebeneinander. Text linksbündig, Würfel zentriert.

```text
Handy                      PC
Aktive Person              Aktive Person
Becher | Würfelplätze      Becher | Würfelplätze  Wertungsblatt
Summe, Würfeln             Summe, Würfeln         Entscheidungen
Wertungsblatt
Entscheidungen
```

Die erste Idee, die bunten Kribbeln-Würfel direkt wiederzuverwenden, wurde
verworfen: In Qwixx hat jeder Würfel eine feste Farbe auf allen sechs Seiten.
Auch Behalten ist hier keine Aktion. Gemeinsame Gesten und Flugbahnen werden
wiederverwendet, das Spielmaterial und die Auswahl bleiben Qwixx-spezifisch.

## Ablauf

Alle sechs Würfel werden einmal angelegt. Farbwürfel geschlossener Reihen werden
als entfernt gekennzeichnet und fliegen beim nächsten Wurf nicht mit. Während
Vorbereitung, Online-Anfrage und Flug sind Auswahlen gesperrt. Nach dem Landen
erscheinen weiße Summe und erlaubte Aktionen. Andere Online-Spieler sehen denselben
Wurf. Ein bereits geworfener Zustand wird beim Beitritt sofort angezeigt.

Nur die aktive Person kann werfen. Schütteln, Sensorfreigabe oder ein abgebrochener
Swipe verändern den Spielstand nicht. Reduzierte Bewegung zeigt das Ergebnis ohne
Flug. Ein abgelehnter oder ausbleibender Sensor bleibt durch Swipe und Knopf
ersetzbar. Die Qwixx-Regeln und die Auswertung bleiben erhalten.
