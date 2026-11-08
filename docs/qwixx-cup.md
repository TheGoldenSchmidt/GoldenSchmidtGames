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
- Die obere Bildschirmhälfte bleibt eine runde, von oben sichtbare 3D-Arena.
  Becher, sechs frei landende Würfel und die Figuren am Tisch bilden eine
  zusammenhängende Szene. Die aktive Figur rückt beim Befüllen und Werfen zum
  Tisch vor. Darunter liegt das Wertungsblatt wie eine helle Papierkarte.

```text
Handy und PC
Kopfzeile
┌──────── dauerhafte Tisch-Arena ────────┐
│ Figuren · Becher · freie Würfel        │
└────────────────────────────────────────┘
┌──────────── Wertungsblatt ─────────────┐
│ vier Reihen · Fehlwürfe · Punkte       │
└────────────────────────────────────────┘
```

In Qwixx hat jeder Würfel eine feste Farbe auf allen sechs Seiten. Gemeinsame
Bechergesten werden wiederverwendet, Landepunkte und die angedeutete Kollision
sind arena-spezifisch. Würfel lassen sich nach dem Landen anheben: In der
weißen Phase wird das weiße Paar genommen, in der Farbphase ein weißer und ein
farbiger Würfel. Diese Auswahl filtert nur die gültigen Kartenfelder; sie führt
keinen zusätzlichen Wurf und keine neue Behalten-Regel ein.

## Ablauf

Alle sechs Würfel werden einmal angelegt. Farbwürfel geschlossener Reihen werden
als entfernt gekennzeichnet und fliegen beim nächsten Wurf nicht mit. Während
Vorbereitung, Online-Anfrage und Flug sind Auswahlen gesperrt. Nach dem Landen
erscheinen weiße Summe und erlaubte Aktionen. Andere Online-Spieler sehen denselben
Wurf. Ein bereits geworfener Zustand wird beim Beitritt sofort angezeigt.

Die 3D-Arena bleibt über alle Phasen und Runden gemountet. Figuren, Tisch und
WebGL-Kontext werden bei einer Eintragung nicht neu erzeugt. Ohne WebGL bleibt
eine stilisierte Draufsicht sichtbar.

Nur die aktive Person kann werfen. Schütteln, Sensorfreigabe oder ein abgebrochener
Swipe verändern den Spielstand nicht. Reduzierte Bewegung zeigt das Ergebnis ohne
Flug. Ein abgelehnter oder ausbleibender Sensor bleibt durch Swipe und Knopf
ersetzbar. Die Qwixx-Regeln und die Auswertung bleiben erhalten.
