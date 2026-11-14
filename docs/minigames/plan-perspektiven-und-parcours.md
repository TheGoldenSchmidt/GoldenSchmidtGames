# Plan: eigene Kameraperspektiven und Hindernis-Parcours

Stand: Nov. 2026 · Status: **umgesetzt** bis auf Gerätetests und Feinabstimmung (siehe „Umsetzungsstand“).

Wunsch aus der Spielrunde: Manche Minispiele sollen nicht mehr alles zeigen,
sondern aus Sicht der eigenen Figur gespielt werden (Ego- oder
Verfolgerperspektive). Dazu eine Alternative zu Chaos Run: ein Hindernislauf,
den man selbst durchläuft (kein automatischer Lauf), mit Laufen/Lenken,
Springen, Hechten, Festhalten und Ducken; mehrere Läufe mit eigenen Namen.

Gestaltungsgrundsatz: Mechaniken aus dem Genre der Gameshow-Hindernisläufe
(drehende Balken, Scheintüren, Wippen, Förderbänder, steigende Flut,
unsichtbare Pfade) mit **eigenen** Namen, Figuren und Gestaltung. Kein Nachbau
von Leveln, Figuren oder Optik eines bestimmten Spiels.

## Reihenfolge

| Schritt | Inhalt | Status |
| --- | --- | --- |
| A1 | Gemeinsame Verfolgerkamera und kamerarelative Steuerung | fertig |
| A2 | Floor is Lava in der Verfolgerperspektive (Übersicht per Knopf) | fertig (Gerätetest offen) |
| A3 | Tank Trouble – Turmsicht: eigene Version mit Sichtlinie | fertig (Gerätetest offen) |
| B1 | Parcours-Kern: 3D-Bewegung, Aktionen, Hindernisse, Kontrollpunkte, Wertung, Bots | fertig |
| B2 | Parcours-Darstellung: 3D-Strecke, animierte Figuren, Verfolgerkamera, Steuerung | fertig (Gerätetest offen) |
| B3 | Erste Läufe | fertig: alle fünf Läufe der Tabelle unten |
| B4 | Weitere Läufe | offen (Ideen in „Nächste Läufe“) |

## A1 – Verfolgerkamera (gemeinsam)

- `src/three/matchScene.ts`: `ChaseCamera` – folgt Position und Blickrichtung
  der eigenen Figur zeitbasiert gedämpft (gleich auf 60/120 Hz), mit
  reduzierter Bewegung ohne Nachziehen.
- `src/matches/client.ts`: kamerarelative Umrechnung des Sticks (oben =
  von der Kamera weg). Die 3D-Szene legt die aktuelle Kamerarichtung in
  `local` ab; die Steuerung rechnet damit beim Bewegen um, die Szene führt den
  gehaltenen Stick bei Kameradrehung nach.
- Regeln bleiben unverändert: Geräte senden weiterhin Richtungen im Spielfeld.

## A2 – Floor is Lava aus der Verfolgerperspektive

- Kamera hinter und über der eigenen Figur, dreht langsam in Laufrichtung;
  Etagenwechsel wie bisher. Ausgeschiedene und Zuschauer sehen die Übersicht.
- Kleiner Knopf „Kamera“ wechselt pro Gerät zwischen Verfolger und Übersicht
  (gespeichert nur auf dem Gerät); Standard ist der Verfolger.
- Canvas-Rückfall bleibt Draufsicht.
- Tests: Playwright `phone` mit Kamerawechsel und kamerarelativer Bewegung.

## A3 – Tank Trouble – Turmsicht

- Neues Match-Modul `tankview` mit denselben Regeln wie Tank Trouble; nur die
  öffentliche Sicht ist eingeschränkt: Gegner und Kugeln sieht man nur bei
  freier Sichtlinie (keine Mauer dazwischen) und bis 6 Feldeinheiten. Das
  filtert die Raumautorität – verdeckte Gegner erreichen das Gerät nie.
- Bots sehen ebenfalls nur ihre Sicht und patrouillieren, solange niemand zu
  sehen ist.
- 3D: hohe Mauern, Nebel, Kamera schräg hinter und über dem eigenen Panzer
  (über die Mauern in den eigenen Gang); Stick und Zielfläche kamerarelativ,
  auch während die Kamera nachdreht. Canvas-Rückfall zeigt das Labyrinth mit
  sichtbaren Gegnern.
- Tests: Regeltest für Sichtlinie und Filter, Playwright `phone`.

## B1 – Parcours-Kern (`shared/matches/parcours/`)

- Figur als stehender Zylinder (Radius 0,35, Höhe 1,6, geduckt 0,9), x seitlich,
  y oben, z in Laufrichtung; fester 50-ms-Schritt mit Teilschritten.
- Aktionen: Stick (Laufen/Lenken), Springen (Tipp), Hechten (Tipp: Sprung nach
  vorn, danach kurz liegen), Festhalten (halten: an Kanten hängen und
  hochziehen, andere festhalten und bremsen), Ducken (halten: niedriger,
  langsamer, unter hohen Balken durch).
- Bausteine: feste und bewegte Plattformen, Förderbänder, drehende Balken
  (niedrig = springen, hoch = ducken), Schieber, Scheintüren (welche brechen,
  bleibt geheim, bis sie getroffen werden), Wippen, steigende Flut,
  unsichtbare Pfade (geheim). Kontrollpunkte: wer fällt, startet am letzten.
- Wertung: Zielreihenfolge; ohne Ziel zählt der Fortschritt. Ende, wenn alle im
  Ziel sind, 20 s nach der ersten Zielankunft oder nach dem Zeitlimit.
- Geheimnisse (Scheintüren, unsichtbare Pfade) bleiben in der Sicht verborgen.

## B2 – Darstellung und Steuerung

- 3D-Strecke im Gameshow-Look mit eigenen Farben, animierte Figuren
  (`riggedFigure`), Verfolgerkamera aus A1, Kontrollpunktfahnen, Ziel.
- Steuerung: Stick links; rechts vier Knöpfe: Springen, Hechten, Festhalten
  (halten), Ducken (halten).
- Canvas-Rückfall als Seitenansicht des eigenen Fortschritts.

## B3/B4 – Läufe

Jeder Lauf ist ein eigenes Minispiel im Pool (eigener Name, eigene Hindernisse):

| Lauf | Kernmechanik |
| --- | --- |
| Türenlotto | Reihen aus Türen, nur manche brechen auf; dazwischen Schieber |
| Kreiselkurs | drehende Balken am Boden (springen) und auf Kopfhöhe (ducken), Drehscheiben |
| Wippenwerk | Wippen, die sich unter Gewicht neigen, rollende Walzen, Kanten zum Festhalten |
| Glibberflut | Aufstieg über Rampen und Förderbänder, von unten steigt Glibber |
| Geisterpfad | Feld aus Platten, nur ein unsichtbarer Pfad trägt; einmal betreten, bleibt er sichtbar |

### Nächste Läufe (Ideen)

Fallklappen-Feld mit Warnlicht, Windkanal mit Ventilatoren, Kletterwand mit
wechselnden Griffen, Staffel im Team, Endlos-Runde „Letzte Person steht“.

## Tests und Grenzen

- Regeltests je Schritt (`npm run test:rules`), Playwright `phone` je Spiel in
  beiden Bewegungseinstellungen.
- Verfolgerkamera, Lesbarkeit und Gefühl der Aktionen müssen auf echten Handys
  geprüft werden; das kann diese Umgebung nicht.

## Umsetzungsstand

| Schritt | Stand |
| --- | --- |
| – | Plan erstellt |
| A1 | `ChaseCamera` in `matchScene.ts`; `cameraRelative`, `chaseStick`, `chaseAim`, `followCamera` in `client.ts`. Die Szene legt `camYaw` in `local` ab und führt gehaltenen Stick und gehaltenes Zielen bei Kameradrehung nach (der nächste 100-ms-Paket überträgt es). `MatchControlsProps.world` sagt der Steuerung, ob die 3D-Szene läuft |
| A2 | Verfolger standardmäßig (Kamera 3,8 hinter, 4,3 über der Figur, dreht mit 1,3/s in Laufrichtung, im Stand nicht); Knopf „Übersicht“ oben rechts (`aria-pressed`, nur auf dem Gerät gespeichert); eigener Markierungskegel in der Verfolgeransicht aus. Playwright `phone`: Standard Verfolger, Stick oben = Kamerarichtung, Umschalten hin und zurück, beide Bewegungseinstellungen |
| B1 | `shared/matches/parcours.ts` (Kern, Bots) und `parcoursCourses.ts` (Strecken). Je Lauf ein eigenes Match-Modul über `parcoursModule(id)`. Feste Geometrie je Lauf; geheim (aus dem Zufall der Partie, nie in einer Sicht): echte Türen, tragende Platten. 3 Teilschritte je 50 ms, gepufferte Sprung-/Hechtwünsche (160 ms), Nachsprung 120 ms, Stufen bis 0,32 m, Festhalten an Kanten (Oberkante 0,9–2,15 m über den Füßen, bis 4 s) und an anderen (von vorn, bis 2 s, Seil 1,1 m, Gehaltene laufen mit 45 %). Ende: alle im Ziel/raus, 20 s nach der ersten Ankunft oder nach 120 s. Wertung: Ankunft, sonst Fortschritt. Regeltest `parcours-test` (alle Aktionen, Hindernisse, Geheimnisse, Ziel, Bots in allen Läufen mit 2/4/6, JSON-Neustart, Determinismus); Rechenzeit ≈ 11 ms je Spielsekunde bei sechs Bots (Node) |
| B2 | `src/three/parcoursWorld.ts`: Studio-Look (Nachtblau, Gelb, Pink, Violett, Türkis), statische Kästen instanziert je Art, bewegte Teile aus denselben Zeitfunktionen, Türen platzen auf, bekannte Platten grün, Wippen kippen, Bänder laufen, Glibber steigt; niedrige Balken pink, hohe gelb. Animierte Figuren (`riggedFigure`), Verfolgerkamera aus A1. Steuerung: Stick links, rechts 2×2 Hechten/Springen/Ducken/Festhalten. Canvas-Rückfall als Draufsicht. Playwright `phone`: Laufen, Springen, Hechten, Ducken, Festhalten in beiden Bewegungseinstellungen, alle fünf Läufe mit sechs Figuren (91–173 Zeichenaufrufe), 2D-Rückfall |
| B3 | Türenlotto, Kreiselkurs, Wippenwerk, Glibberflut, Geisterpfad im Pool und in der Übung; Bots brauchen 9–31 s, echte Spielzeit und Balance offen |
| A3 | Modul `tankview` (`shared/matches/tankView.ts`): Regeln von Tank Trouble, `view` entfernt Panzer, Wracks und fremde Kugeln ohne freie Sichtlinie oder weiter als 6; Zuschauer sehen alles; Bots fahren ohne Sicht Streife (`driveTowards`). 3D mit Mauern 1,15 hoch, Nebel 5,5–11, Kamera 2,6 hinter und 3,6 über dem Panzer. Regeltest `tank-view-test`, Playwright `phone` (Kamera, Stick und Zielen relativ zur Kamera, Schuss, nur sichtbare Gegner im Snapshot) |
