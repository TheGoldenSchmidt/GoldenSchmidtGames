# Gerätetest: Ablauf und Protokoll

Stand: Nov. 2026. Ziel: Leistung, Bedienung und Kameras der Minispiele auf
echten Handys prüfen und danach die Werte nachstellen. Automatische Tests
laufen nur in einer Chromium-Emulation; sie ersetzen diesen Test nicht.

## Vorbereitung

- Mindestens zwei Handys (je ein Android und ein iPhone), wenn möglich ein
  älteres Modell dabei. Sechs Geräte für die Volllast.
- Testmodus pro Gerät einschalten: die App einmal mit `?messung` am Ende der
  Adresse öffnen (z. B. `https://…/?messung`). Ausschalten mit `?messung=0`.
  Der Testmodus bleibt auf dem Gerät gespeichert und zeigt in jedem
  Minispiel oben links ein Messfeld.
- Zwei Durchgänge: einmal mit Node-Server (Online-Raum), einmal mit
  Handy-Host (das Host-Handy rechnet alles selbst).

## Messfeld

| Anzeige | Bedeutung | Gut |
| --- | --- | --- |
| FPS | Bilder pro Sekunde auf diesem Gerät | ≥ 50 |
| 95 % | 95 % der Bilder brauchen höchstens so lange | ≤ 25 ms |
| Ruckler | Bilder über 50 ms in den letzten 5 s | 0–2 |
| Netz | Abstand der Spielstände vom Server/Host (Soll 50 ms, Tank Trouble und Arrow Masters 100 ms), dazu die längste Pause | Abstand ≤ 70 ms, Pause ≤ 200 ms |
| Rundlauf | geschätzte Laufzeit hin und zurück | ≤ 150 ms |

„Werte kopieren“ legt alle Werte samt Gerät in die Zwischenablage; einfach
in den Gruppenchat oder in die Tabelle unten einfügen.

### Kamera-Regler (Spiele mit Verfolgerkamera)

Floor is Lava, Tank Trouble – Turmsicht und alle Hindernis-Läufe zeigen drei
Regler: **Abstand**, **Höhe** und **Nachdrehen** (wie schnell die Kamera
hinter die Laufrichtung schwenkt), jeweils als Faktor (1,00 = heutiger
Standard). Jede Person stellt ein, was sich am besten anfühlt, und kopiert
die Werte. Aus den Rückmeldungen werden neue Standardwerte.

## Prüfliste je Spiel

| Spiel | Worauf achten |
| --- | --- |
| Tower Tumble | Ruckelt es noch? Pfeile: halbe Zelle je Tipp, Halten wiederholt – zu schnell, zu langsam? Handy-Host mit sechs Türmen: FPS des Host-Handys |
| Floor is Lava | Verfolgerkamera: sieht man genug vom Feld? Wischen zum Drehen verständlich? Etagen: sieht man Figuren auf tieferen Etagen? Durchgänge bis 30 s zu lang? |
| Tank Trouble – Turmsicht | Orientierung im Labyrinth, Zielen relativ zur Kamera, Wischen oben links |
| Türenlotto, Kreiselkurs, Wippenwerk, Glibberflut, Geisterpfad | Laufzeit pro Lauf (Ziel: 30–60 s), Sprünge und Hechten treffsicher? Festhalten an Kanten klar? Glibberflut zu schnell/zu langsam? Wippen zu schmal/zu breit? |
| Fallklappen, Windkanal, Kletterwand, Standhaft (Finale) | Warnlicht der Klappen rechtzeitig? Wind spürbar, aber fair? Griffe der Kletterwand erreichbar? Finale zu lang? |
| Alle anderen | Kurzer Blick auf FPS und Ruckler |

## Protokoll

| Datum | Gerät | Hosting | Spiel | FPS / 95 % / Ruckler | Netz / Rundlauf | Kamera (Abstand/Höhe/Nachdrehen) | Beobachtung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

## Wo die Werte stehen

| Wert | Datei |
| --- | --- |
| Kamera-Grundwerte (Abstand, Höhe, Vorausblick) | `new ChaseCamera(…)` in `src/three/lavaWorld.ts`, `tankWorld.ts`, `parcoursWorld.ts` |
| Nachdrehen | letzter Wert von `chaseCam.update(…)` in denselben Dateien |
| Glibber-Tempo | `goo` in `glibberflut()` in `shared/matches/parcoursCourses.ts` |
| Wippen (Breite, Neigung) | `wippenwerk()` und `tilt*` in `PC` (`shared/matches/parcours.ts`) |
| Laufgeschwindigkeit, Sprung, Hechten | `PC` in `shared/matches/parcours.ts` |
| Tower-Tumble-Pfeile | `REPEAT_DELAY`, `REPEAT_EVERY` in `src/matches/games/towerTumble.tsx` |

Regel- und Balancewerte gelten für alle Geräte gleich; sie werden nach dem
Test im Code geändert und mit `npm run test:rules` geprüft.
