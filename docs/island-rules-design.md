# Inselparty: lesbare Wege und gemeinsamer Ablauf

Die Insel bleibt eine räumliche Spielzeugwelt. In beiden Brettspielen führen
größere Figuren die Ansicht. Die Landschaft ist horizontal um 18 Prozent
gespreizt; Felder sind kleiner und flacher, Verbindungen schmal und gedämpft.
Statt Feldnummern liegen Bedeutungssymbole mit Tiefenprüfung auf dem Brett:
Plus auf Blau, Minus auf Rot, Ausrufezeichen auf Grün und Shop auf Hellblau.
Eine umschaltbare Übersicht hilft auf kleinen Bildschirmen. Unter der Karte steht das betrachtete
Feld mit seiner tatsächlichen Wirkung. Keine hektische Entscheidungsfrist.

Palette: Hafenblau #10485b, Wasser #219fca, Papier #fff9e8, Münzblau #326fc7,
Verlustrot #c33d4c, Ereignisgrün #65c783, Shop-Hellblau #a6dff5 und Gold #ffd258.
Die Zuordnung steht für beide Kartenarten und die Legende in `src/lib/partyFieldVisuals.ts`.
Trebuchet MS bleibt für Spielnamen und
Bedienung; Figuren und aktueller Zug führen, Hinweise bleiben zurückhaltend.

Handy: [Karte mit Symbolen] [Spieler am Kartenfuß] [Würfel und Entscheidung]
PC:    [großer Spielweg] [aktueller Zug / Entscheidung / Feldbeschreibung]
Die Minispiele zeigen die eigene Figur, Punkte und verbleibende Stürze.
Bewegung erklärt den tatsächlichen Schritt; der Server löst die Wirkung erst
nach der Ankunft aus. Reduzierte Bewegung überspringt dekorative Bewegung,
ändert aber nicht den Zeitpunkt der Wirkung.

Die frühere Betonung der Felder und Verbindungen verdeckte die Figuren.
Die Brettmodelle sind nun gut doppelt so groß, ohne die Originalmodelle oder
Arenen zu ändern. Auf einem gemeinsamen Feld stehen bis zu sechs Figuren
mit kamerabezogenen Abständen. Namen bleiben im HUD; ein gelber Bodenring
zeigt die aktive Figur. Legende und Feldliste sind zunächst eingeklappt.

Regeln: Auftakt-Minispiel bestimmt die danach feste Reihenfolge. Der Auftakt
vergibt noch keine Münzen. Danach erhält Platz 1/2/3 genau 10/4/2 Münzen,
weitere Plätze 0. Bei Punktgleichheit entscheiden weniger Stürze, dann die
festgelegte Reihenfolge; beim Auftakt wird deren Losreihenfolge verwendet.
Erster Sturz halbiert die aktuellen Punkte (abrunden), zweiter Sturz beendet
den Versuch mit dem bestehenden Punktestand. Beendete Räume sind geschlossen.

Neue eigene Spielvarianten: Lückenwände, Farbatoll, Fotogerangel, Kugelrempler,
Kapitänskommando, Kistenregen, Inselgolf und Teamparcours. Sie verwenden
serverseitige Physik, die bestehenden Figuren und gleichwertige Sensor-/
Sticksteuerung. Teamparcours ist zunächst kooperativ für alle; 2-gegen-2 ist
entsprechend der Aufgabenbeschreibung eine spätere Erweiterung.

Die Kamera startet näher und flacher bei der aktiven Figur. „Zur Figur“ und
„Ganze Insel/Schale“ setzen Blickrichtung und Zoom zurück. Feldsuche zentriert
das ausgewählte Feld; Drehen und Zwei-Finger-Zoom lösen keine Feldauswahl aus.
Kameratasten liegen außerhalb der Szene und bleiben auf schmalen Handys über
der festen Würfelaktion erreichbar. Die 2D-Übersicht
zeigt dieselben 34 Felder und Verbindungen ohne räumliche Überdeckung.
