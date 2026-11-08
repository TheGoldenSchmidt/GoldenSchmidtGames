# Inselparty: aktueller Regelstand

Eine vollständige Partie findet ausschließlich online auf den eigenen Geräten
statt. Die 13 freigegebenen alpha_-Figuren bleiben erhalten. Vor der ersten
Brett-Runde spielen alle ein zufälliges Auftakt-Minispiel. Das Ergebnis legt
die feste Zugreihenfolge für sämtliche Runden fest; der Auftakt verteilt noch
keine Münzen. Bei Punktgleichheit entscheiden weniger Stürze und danach die
beim Start ausgeloste Reihenfolge. Auf dem Brett rotieren die Startplätze
zwischen den Runden nicht mehr.

Die Minispiele nach jeder Brett-Runde vergeben genau 10, 4 und 2 Münzen an die
drei ersten Plätze; alle weiteren erhalten 0. Nichtteilnahme bleibt ohne
Belohnung. Auch bei gleicher Punktzahl gibt es eindeutige Plätze. Die Anzeige
und die tatsächliche Gutschrift verwenden dieselbe Wertungsfunktion.

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

Farbig eingefasste, nummerierte Felder, kräftige Verbindungen und eine höhere
Kameraperspektive rücken die Wege in den Vordergrund. Zusätzlich gibt es eine
umschaltbare klare Übersicht und eine Legende. Auf kleinen Displays bleibt der
Würfelknopf am unteren Rand erreichbar. Auf dem Brett gibt es keine kurze
Entscheidungsfrist; die Tempo-Einstellung steuert die Bewegungsgeschwindigkeit.
Die Minispiele behalten ihre jeweiligen Zeitlimits und den gemeinsamen Start.

Würfeln und Wegwahl beginnen eine eigene Bewegungsphase. Der Server gibt jeden
Schritt mit Abfahrts- und Ankunftszeit vor. Erst bei Ankunft wird die Position
bestätigt; Hafenbonus, Trophäenstopp und die Wirkung des Zielfelds folgen danach.
Münz- und Ereignisfelder wirken weiterhin beim Landen, nicht beim Vorbeilaufen.
Die Clients zeigen denselben Weg und Zeitpunkt. Reduzierte Bewegung kann die
Animation verkürzen, zieht die serverseitige Wirkung aber nicht vor.

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

## Tests

`test:rules` prüft zusätzlich alle neuen Mechaniken, Körperkontakte, Stürze,
eindeutige Auszahlungen, den Auftakt, feste Reihenfolge und Wirkungen nach
Ankunft. Deterministische Replays und echte Botsteuerung laufen für 14 Arenen.
`test:online` spielt eine vollständige Partie und prüft geschlossene Räume,
Host-Rechte, Status-Beobachter und ungültige Tokens. Browserfälle decken alle
14 Arenen, Neigung, Touch-/Tastatursteuerung, sechs Modelle, Kartenansichten,
Auftakt und Wiederbeitritt ab. Die gesamte bestehende CI führt diese Befehle aus.

Die Browser-CI verteilt Handy und PC auf jeweils drei Teilläufe. Die voneinander
unabhängigen Arena-Fälle lassen sich einzeln verteilen, damit die erweiterte
Palette die Prüflaufzeit nicht auf einen einzelnen Job konzentriert.
