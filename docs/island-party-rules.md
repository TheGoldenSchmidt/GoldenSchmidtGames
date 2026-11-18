# Inselparty: aktueller Regelstand

Eine vollständige Partie findet im Mehrspieler-Raum auf den eigenen Geräten
statt, wahlweise mit Node-Server oder [Handy-Host](../README.md#zwei-hostingarten).
Die 13 freigegebenen alpha_-Figuren bleiben erhalten. Vor der ersten
Brett-Runde spielen alle ein zufälliges Auftakt-Minispiel. Das Ergebnis legt
die feste Zugreihenfolge für sämtliche Runden fest; der Auftakt verteilt noch
keine Münzen. Bei Punktgleichheit entscheiden weniger Stürze und danach die
beim Start ausgeloste Reihenfolge. Auf dem Brett rotieren die Startplätze
zwischen den Runden nicht mehr.

Die Minispiele nach jeder Brett-Runde vergeben genau 10, 4 und 2 Münzen an die
drei ersten Plätze; alle weiteren erhalten 0. Nichtteilnahme bleibt ohne
Belohnung. Auch bei gleicher Punktzahl gibt es eindeutige Plätze. Die Anzeige
und die tatsächliche Gutschrift verwenden dieselbe Wertungsfunktion.

In Roll It Up! bleibt jedes Minispiel-Ergebnis einschließlich Auftakt stehen,
bis alle aktiven menschlichen Teilnehmer es selbst bestätigt haben. Es gibt
keinen automatischen Ablauf. Bots und pausierende Teilnehmer blockieren nicht;
Bestätigungen bleiben beim Wiederbeitritt erhalten.

Der erste Sturz halbiert die bis dahin erzielten Minispielpunkte (abrunden).
Danach kann die Figur weitere Punkte sammeln. Der zweite Sturz beendet ihren
Versuch; der zu diesem Zeitpunkt bestehende Punktestand bleibt stehen. Die
Figur steuert nicht mehr mit und die Ansicht folgt den verbliebenen Figuren.
Bei Lückenwänden und Kapitänskommando zählt der jeweilige Fehlversuch ebenfalls
als verlorenes Leben. Einzelne Wellen- und Kistentreffer schubsen bzw. betäuben
weiterhin; ein tatsächlicher Sturz löst die allgemeine Sturzregel aus.

Alle Bewegungs-Arenen verwenden dieselbe deterministische Körperkollision.
Aktive Figuren können sich gegenseitig blockieren und in passenden Spielen
anschubsen. Die Darstellungsgröße ist an den Körperradius angepasst, auch für
breite Modelle. Ausgeschiedene und zurückkehrende Figuren blockieren nicht.

## Neue Minispiele

| Vorbild | Eigene Variante | Vollständige Mechanik |
| --- | --- | --- |
| Booksquirm | Lückenwände | Sichere Öffnungen wechseln pro fallender Wand; 10 Punkte pro sicherer Wand. |
| Hexagon Heat | Farbatoll | Angesagte Farbplattform erreichen; andere Plattformen sinken, Schubsen ist möglich. |
| Slaparazzi | Fotogerangel | Wechselnder Fotoplatz; beim Auslösen erhalten die drei nächsten Figuren 10/4/2 Minispielpunkte. |
| Bumper Balls | Kugelrempler | Physische Kugelkontakte, Abdrängen, Überlebenspunkte und Punkte für verursachte Stürze. |
| Shy Guy Says | Kapitänskommando | Echte Kommandos befolgen; bei Täuschungen zählt das letzte gültige Zeichen. |
| Sandwiched | Kistenregen | Angekündigte fallende Kisten, feste Stapel, Sprünge auf Oberflächen und Höhenpunkte. |
| Tilt-a-Golf | Inselgolf | Neigung oder Stick, Öffnungen in Hindernissen, Flaggen, Zielloch und Zeitbonus. |
| Dungeon Duos | Teamparcours | Gemeinsam zwei Plattenpaare gleichzeitig besetzen, Tore öffnen und Hürden bewältigen. |

Der Teamparcours ist zunächst kooperativ für 2–6 Personen. Das ausdrücklich
als später bezeichnete 2-gegen-2 bleibt eine nachfolgende Erweiterung. In der
Einzelübung lassen sich die beiden Platten nacheinander auslösen. Bots spielen
alle 14 Arenen über dieselben Eingaben wie Menschen. Alle neuen Spiele sind
in normaler Rotation, im Solo-Testraum und als kurze Übung verfügbar.

## Lesbares Brett und Ankunft

Inselparty und Roll It Up! zeigen größere Figuren auf weiter auseinanderliegenden
Feldern. Schmale Verbindungen und flach aufliegende Symbole lassen die Figuren
frei. Die Kamera startet bei der aktiven Figur; Tasten wechseln zur ganzen Karte
oder zurück zur Figur. Die Welt füllt den Bildschirm; Spielerstände und Aktionen
liegen als Overlays darin. Feldinfos erscheinen beim Antippen als Pop-up, ohne den
Kameraausschnitt zu verändern. Zusätzlich gibt es eine umschaltbare klare Übersicht
und eine aufklappbare Legende mit Feld- und Figurensuche. Auf kleinen Displays bleibt der
Würfelknopf am unteren Rand erreichbar. Auf dem Brett gibt es keine kurze
Entscheidungsfrist. Die Figuren bewegen sich mit Normaltempo.
Die Minispiele behalten ihre jeweiligen Zeitlimits und den gemeinsamen Start.

Würfeln und Wegwahl beginnen eine eigene Bewegungsphase. Der Server gibt jeden
Schritt mit Abfahrts- und Ankunftszeit vor. Erst bei Ankunft wird die Position
bestätigt; Hafenbonus, Trophäenstopp und die Wirkung des Zielfelds folgen danach.
Münz- und Ereignisfelder wirken weiterhin beim Landen, nicht beim Vorbeilaufen.
Die Clients zeigen denselben Weg und Zeitpunkt. Reduzierte Bewegung kann die
Animation verkürzen, zieht die serverseitige Wirkung aber nicht vor.

## Trophäenstand, letzte Runden und Bonus-Trophäen

Der Trophäenstand beginnt an Shop 6. Nach jedem Kauf zieht er zufällig zu einem
der beiden anderen Shops (6, 15, 24); er bleibt nie am selben Shop. Den Zufall
zieht die Raumautorität aus dem Zufallsstand der Partie, die Chronik nennt das
neue Feld. Ohne Kauf bleibt er stehen.

Die letzten drei Runden sind Schlussrunden (bei 5 Runden also die Runden 3 bis
5). Plus- und Minusfelder wirken dort doppelt (+6 bzw. bis zu −6 Münzen); der
Hafenbonus bleibt bei 3 Münzen, Ereignisse bleiben unverändert. Zu Beginn der
ersten Schlussrunde erhalten alle Letztplatzierten (gleiche Trophäen, Münzen und
Minispielsiege wie der letzte Platz) ein zufälliges Item. Ist ihr Inventar voll,
bekommen sie stattdessen dessen Preis in Münzen. Bis zum ersten Wurf dieser Runde
zeigen alle Geräte die Ansage; danach markiert „Schlussrunde“ die Rundenanzeige.
Roll It Up! und die eigenständigen Minispielmodi haben keine Schlussrunden.

Nach dem letzten Minispiel vergibt die Siegerehrung drei Bonus-Trophäen, bevor
der Sieg feststeht. Jede zählt wie eine gekaufte Trophäe:

| Bonus-Trophäe | Bedingung |
| --- | --- |
| Minispiel-Ass | meiste Minispielsiege (ohne Auftakt) |
| Weltenbummler | meiste gelaufene Felder (Reisekompass zählt nicht) |
| Pechvogel | meiste verlorene Münzen durch Minusfelder, Reparatur und Münzangel |

Bei Gleichstand erhalten alle Gleichplatzierten die Bonus-Trophäe; bei einem
Höchstwert von 0 wird sie nicht vergeben. Die Bonus-Trophäen erscheinen
nacheinander, danach die Sieger. Bei reduzierter Bewegung steht alles sofort da;
das Ergebnis ist in beiden Fällen gleich. Der Satz unter dem Siegernamen spricht
nur die Sieger mit „Du“ an.

## Geschlossene Räume

Nach dem letzten gewerteten Minispiel endet die Partie automatisch. Der letzte
Minispielstand bleibt in der Siegerehrung nachlesbar. Der Host kann jederzeit
über „Partie → Partie für alle beenden“ abbrechen. In beiden Fällen werden Raum,
Sitzungstokens, Botsteuerung und Mitgliedschaften sofort entfernt. Verbundene
Spieler sehen weiterhin ihre Abschlussanzeige, können aber nicht erneut beitreten.

Das Startmenü fragt die gespeicherte Sitzung zunächst beim Server ab. Nur eine
tatsächlich gültige, aktive Sitzung bietet „Online-Inselparty wieder beitreten“.
Die Statusabfrage tritt dem Raum nicht bei und hebt keine Verbindungspause auf.
Geschlossene Räume melden dies auch an angemeldete Status-Beobachter; der Knopf
und der lokale Sitzungsverweis verschwinden dann sofort. Ohne Serververbindung
wird kein ungeprüfter Wiederbeitritt angeboten.

## Eigenständige Minispielmodi

**Freies Minispiel** und **Schlag den GoldenSchmidt** verwenden dieselben
Minispiele (14 klassische Arenen und 12 Match-Spiele), Teilnahme- und
Gleichstandsregeln wie die Inselparty. Beide
Modi laufen für 2–6 Personen auf getrennten Geräten mit Node-Server oder
Handy-Host. Brett, Auftakt zur Zugreihenfolge und Münzausschüttung entfallen.
In klassischen Arenen entscheiden bei gleichen Minispielpunkten weniger Stürze
und danach die einmal zu Beginn ausgeloste Reihenfolge; Match-Spiele teilen
Plätze nach ihren eigenen Stechregeln (siehe unten).

Im freien Modus bestimmt der Host das Minispiel in der Lobby. Nach einer
gewerteten Runde endet die Partie mit dem Minispielergebnis. Ohne Teilnahme
gibt es keinen Minispielsieger. Üben ist vor dem gemeinsamen Start möglich.

Im Wettbewerb spielen alle gegeneinander. Der Host wählt X zwischen 1 und der
Zahl der zur Spielerzahl passenden Minispiele (Standard: 5). Die Raumautorität zieht X unterschiedliche Minispiele; künftige
Spiele bleiben verborgen. Vor jeder Runde wird die Aufgabe angezeigt. Jede
Person legt dann verdeckt einen eigenen Einsatz von 1 bis X fest. Jede Zahl
darf pro Person genau einmal verwendet werden, unabhängig vom Rundenergebnis.
Ein bestätigter Einsatz ist unveränderlich. Es gibt keine automatische Auswahl
nach Zeitablauf. Erst wenn alle aktiven Personen gesetzt haben, erscheinen die
Einsätze und die gemeinsame Bereitschaftsanzeige.

Die erstplatzierte teilnehmende Person erhält ihren eigenen Einsatz als
Wettbewerbspunkte, alle anderen erhalten 0 Punkte. Nichtteilnahme bleibt ohne
Punkte. Nach X Runden gewinnt die höchste Gesamtpunktzahl; bei gleichem
Gesamtstand wird der Sieg geteilt. Nach einer Zwischenwertung startet nur der
Host die nächste Runde. Die Abschlussansicht enthält Gesamtstand und sämtliche
Rundeneinsätze. Bestätigte Einsätze, verbrauchte Werte und Gesamtpunkte werden
im vollständigen Raumzustand gespeichert; andere Geräte erhalten vor der
Aufdeckung nur die Information, wer bereits gesetzt hat. Die bestehenden
Pausen-, Wiederbeitritts- und Raumschließungsregeln gelten auch hier.

## Match-Minispiele und 1st Generation Minigames

Die 14 ersten Arenen und das Match-Spiel Hook Wars bilden die **1st Generation
Minigames** (`FIRST_GEN_MINI_IDS`). Inselparty, Roll It Up! und Schlag den
GoldenSchmidt speichern dafür die Option `classic` (Standard: an). Ohne sie
ziehen die Modi nur neue Match-Minispiele, die zur Zahl der
aktiven Spieler passen. Die Lobby lehnt Einstellungen ab, für die es kein
passendes Spiel gibt oder deren Rundenzahl die Auswahl übersteigt.

Match-Minispiele ermitteln ihre Platzierung selbst, einschließlich eigener
Stechregeln. Bleibt danach ein Gleichstand, teilen sich die Spieler den Platz
und erhalten dieselbe Belohnung: in der Inselparty die Münzen dieses Platzes
(10/4/2), im Wettbewerb jeweils den eigenen Einsatz. Ohne eigene Eingabe gilt
eine Person als nicht teilnehmend. „Aufgeben“ beendet die Teilnahme; später
Aufgebende stehen vor früher Aufgebenden. Bleibt nur eine Person übrig, endet
das Match. Details: [Konzept](minigames/konzept.md).

## Tests

`test:rules` prüft in `scripts/party-finale-test.ts` den wechselnden
Trophäenstand, die Schlussrunden mit Rückenwind und die Bonus-Trophäen samt
Gleichständen. `tests/browser/party-finale.spec.ts` spielt eine Partie mit zwei
Geräten bis zur Siegerehrung, in beiden Bewegungseinstellungen.
`test:rules` prüft zusätzlich alle neuen Mechaniken, Körperkontakte, Stürze,
eindeutige Auszahlungen, den Auftakt, feste Reihenfolge und Wirkungen nach
Ankunft. Deterministische Replays und echte Botsteuerung laufen für 14 Arenen
und alle 12 Match-Spiele (je ein eigener Regeltest in `scripts/`).
`test:online` spielt eine vollständige Partie und prüft die Rückkehr in die Lobby nach Spielende,
Verlassen und Beenden der wartenden Lobby,
Host-Rechte, Status-Beobachter und ungültige Tokens. Browserfälle decken alle
14 Arenen, Neigung, Touch-/Tastatursteuerung, sechs Modelle, Kartenansichten,
Auftakt und Wiederbeitritt ab. Die CI führt `test:rules` und `test:online`
automatisch aus; die Browserfälle (Projekt `phone`) laufen nur in der von Hand
gestarteten ausführlichen Prüfung, siehe [README](../README.md#automatische-prüfungen).

Die eigenständigen Modi haben zusätzliche Regel- und Socketfälle in
`scripts/minigame-modes-test.ts` und `scripts/minigame-modes-online-test.ts`.
Sie sind in `test:rules` beziehungsweise `test:online` eingebunden. Der
Neustarttest prüft einen gespeicherten, weiterhin verdeckten Einsatz.
`tests/browser/minigame-modes.spec.ts` prüft Lobby, Eingabe, Wiederbeitritt und
Abschluss in beiden Bewegungseinstellungen; `nearby.spec.ts` enthält beide
Modi mit direktem Datenkanal und erneuter Paarung. Dies ersetzt keine Prüfung
auf echten Handys.
