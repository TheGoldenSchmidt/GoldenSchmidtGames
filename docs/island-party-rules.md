# Inselparty: aktueller Regelstand

Eine vollständige Partie findet im Mehrspieler-Raum auf den eigenen Geräten
statt, wahlweise mit Node-Server oder [Handy-Host](../README.md#zwei-hostingarten).
Figuren gemäß [Freigabe](approved-character-design.md). Vor der ersten
Brett-Runde spielen alle ein zufälliges Auftakt-Minispiel. Das Ergebnis legt
die feste Zugreihenfolge für sämtliche Runden fest; der Auftakt verteilt noch
keine Münzen. Bei Punktgleichheit entscheiden weniger Stürze und danach die
beim Start ausgeloste Reihenfolge. Auf dem Brett rotieren die Startplätze
zwischen den Runden nicht mehr.

Die Minispiele nach jeder Brett-Runde vergeben genau 10, 4 und 2 Münzen an die
drei ersten Plätze; alle weiteren erhalten 0. Nichtteilnahme bleibt ohne
Belohnung. Klassische Arenen lösen Gleichstände eindeutig auf; Match-Spiele können Plätze teilen (siehe unten). Die Anzeige
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

## Brett und Ankunft

Darstellung: [3D-Spielansichten](inselparty-3d.md). Keine kurze Entscheidungsfrist auf dem Brett; Normaltempo. Minispiele behalten Zeitlimits und gemeinsamen Start.

Würfeln und Wegwahl beginnen eine eigene Bewegungsphase. Der Server gibt jeden
Schritt mit Abfahrts- und Ankunftszeit vor. Erst bei Ankunft wird die Position
bestätigt; Hafenbonus, Trophäenstopp und die Wirkung des Zielfelds folgen danach.
Münz- und Ereignisfelder wirken weiterhin beim Landen, nicht beim Vorbeilaufen.
Die Clients zeigen denselben Weg und Zeitpunkt. Reduzierte Bewegung kann die
Animation verkürzen, zieht die serverseitige Wirkung aber nicht vor.

## Duellfelder

Die vier früheren Aussichtsfelder (8, 18, 27 und 31) sind in der Inselparty
**Duellfelder** (⚔). Wer dort landet, fordert eine andere Person mit eigenen
Münzen heraus und nennt einen Einsatz von 1 bis 10 Münzen, höchstens so viel,
wie beide besitzen; Verzichten ist möglich. Beide zahlen den Einsatz sofort in
den Pott. Danach spielen nur die beiden ein Match-Minispiel aus dem Duell-Pool
(Quick Draw, Sumo Smash, Bumper Mayhem, Neon Pong 1v1, Tank Trouble, Light
Trails; nicht zweimal hintereinander dasselbe). Alle anderen schauen auf ihrem
Handy live zu. Die alleinige Erstplatzierte erhält den ganzen Pott (doppelter
Einsatz); bei Gleichstand oder ohne gewertete Teilnahme bekommen beide ihren
Einsatz zurück. Duelle vergeben keine 10/4/2-Münzen und zählen nicht als
Minispielsieg; das Schutzschild wirkt nicht gegen den eigenen Einsatz. Ohne
eigene Münzen oder ohne möglichen Gegner wirkt das Feld nicht. Läuft die
Online-Frist ab oder pausiert die herausfordernde Person, entfällt das Duell.
Nach dem Ergebnis geht der Zug mit der Zusammenfassung weiter. Bots fordern
die reichste Person mit bis zu 5 Münzen heraus. Roll It Up! behält an diesen
Stellen schlichte Felder. In Testpartien mit Bots setzt das Testwerkzeug
„Duellfeld testen“ die eigene Figur direkt auf Feld 8.

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

## Räume nach Spielende

Normale Räume bleiben nach Spielende/Abbruch erhalten. Mitglieder können zum Ergebnis wiederbeitreten; „Zurück zur Lobby“ setzt denselben Raum für alle zurück. Dort gibt „Party verlassen“ den eigenen Platz frei; der Host kann den Raum für alle löschen. Seedbasierte Testräume schließen unmittelbar nach Ende. Schlüssel, Wiederverbindung und Speicherung: [Deployment](../DEPLOYMENT.md#speicherung-und-wiederherstellung).

## Eigenständige Minispielmodi

**Freies Minispiel** und **Schlag den GoldenSchmidt** verwenden dieselben
Minispiele aus dem [Minispielkatalog](../shared/minigameCatalog.ts), Teilnahme- und
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

Die 14 ersten Arenen sowie Hook Wars, Chaos Run und Wippenwerk bilden die **1st Generation
Minigames** (`FIRST_GEN_MINI_IDS`). Inselparty, Roll It Up! und Schlag den
GoldenSchmidt speichern dafür die Option `classic` (Standard: an). Ohne sie
ziehen die Modi nur neue Match-Minispiele, die zur Zahl der
aktiven Spieler passen. Die Lobby lehnt Einstellungen ab, für die es kein
passendes Spiel gibt oder deren Rundenzahl die Auswahl übersteigt.

Match-Minispiele ermitteln ihre Platzierung selbst, einschließlich eigener
Stechregeln. Bleibt danach ein Gleichstand, teilen sich die Spieler den Platz
und erhalten dieselbe Belohnung: in der Inselparty die Münzen dieses Platzes
(10/4/2), im Wettbewerb nur auf dem ersten Platz jeweils den eigenen Einsatz. Ohne eigene Eingabe gilt
eine Person als nicht teilnehmend. „Aufgeben“ beendet die Teilnahme; später
Aufgebende stehen vor früher Aufgebenden. Bleibt nur eine Person übrig, endet
das Match. Details: [Konzept](minigames/konzept.md).

## Grundregeln der Brettspiele

**Inselparty:** 2–6 Personen, 5–15 Runden (Standard 8), Startkapital 10 Münzen. Trophäe kostet 20; Sieg nach Trophäen, Münzen, Minispielsiegen. Hafenüberquerung gibt 3 Münzen, normale Felder wirken beim Landen. Inventar: drei Items, ein Einsatz vor dem Würfeln. Auftakt/Rundenminispiele wie oben.

**Roll It Up!:** 2–6 Personen, kein Rundenlimit. Bauschale mit sechs Kaufstellen im Abstand von fünf Feldern: Grinder 8 Münzen, Pape/Filter je 3, drei Weedbuds je 5. Jede Figur kauft jede Station einmal für ihr Set; Zug-Items bleiben getrennt mit drei Inventarplätzen. Mit vollem Set führen Hügelwege ab Feld 31/33 zum Jayspot auf Feld 34. Erste Ankunft gewinnt sofort, auch mit restlichen Würfelschritten. Auftakt bestimmt Reihenfolge, gemeinsame Minispiele liefern Münzen.

## Prüfungen

Befehle/CI: [AGENTS.md](../AGENTS.md#passende-prüfungen).

- `scripts/party-duel-test.ts`, `party-finale-test.ts`, Party-/Arena-/Match-Regeltests: Einsätze, Felder, Reihenfolge, Stürze, Gleichstände, Boni und deterministische Wiederholung.
- `test:online`: Partie/Duell, Lobby-Rückkehr, Verlassen/Schließen, Hostrechte und Sitzungsschutz.
- Eigenständige Modi: `scripts/minigame-modes-test.ts`, `minigame-modes-online-test.ts`; Neustart mit verdecktem Einsatz.
- Smartphone: `party-duel.spec.ts`, `party-finale.spec.ts`, `minigame-modes.spec.ts`, Arena-/Wiederbeitrittsfälle und `nearby.spec.ts`. Beide Bewegungseinstellungen; Sensoren simuliert. Gerätefreigabe bleibt gesondert.
