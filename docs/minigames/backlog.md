# Backlog: Match-Minispiele

Persistenter Arbeitsstand für die zwölf neuen Minispiele. Bei jeder
Sitzung zuerst hier lesen und am Ende aktualisieren. Konzept:
[konzept.md](konzept.md) · Regeln: [spezifikation.md](spezifikation.md).

Statuswerte: **offen** · **in Arbeit** · **fertig** (Lobby bis
Ergebnis, automatisch getestet) · **blockiert**.

## Phasen

| Phase | Inhalt | Status |
| --- | --- | --- |
| 0 | Analyse, Konzept, Spezifikation, Backlog | fertig |
| 1 | Framework, Klassik-Option, Nur-Smartphone-Umstellung, Testspiel | in Arbeit |
| 2 | Quick Draw, Light Trails, Neon Pong | offen |
| 3 | Tank Trouble, Bomb Arena, Floor is Lava | offen |
| 4 | Sumo Smash, Bumper Mayhem, Chaos Run | offen |
| 5 | Arrow Masters, Tower Tumble, Hook Wars | offen |
| 6 | Qualitätssicherung, Leistung, Feinschliff, Dokumentation | offen |

## Spiele

| # | Spiel | Spieler | Priorität | Status | Tests |
| --- | --- | --- | --- | --- | --- |
| 1 | Quick Draw | 2–6 | P1 | offen | – |
| 2 | Light Trails | 2–6 | P1 | offen | – |
| 3 | Neon Pong | 2 oder 4 | P1 | offen | – |
| 4 | Tank Trouble | 2–6 | P2 | offen | – |
| 5 | Bomb Arena | 2–6 | P2 | offen | – |
| 6 | Floor is Lava | 2–6 | P2 | offen | – |
| 7 | Sumo Smash | 2–6 | P3 | offen | – |
| 8 | Bumper Mayhem | 2–6 | P3 | offen | – |
| 9 | Chaos Run | 2–6 | P3 | offen | – |
| 10 | Arrow Masters | 2–6 | P4 | offen | – |
| 11 | Tower Tumble | 2–6 | P4 | offen | – |
| 12 | Hook Wars | 2–6 | P4 | offen | – |

## Abhängigkeiten

- Alle Spiele hängen von Phase 1 ab (Modulvertrag, Party-Anbindung, Bühne,
  Steuerelemente).
- Sumo Smash und Bumper Mayhem teilen Ring-Out- und Impulslogik.
- Tank Trouble und Bomb Arena teilen Labyrinth- und Rasterhelfer.
- Tower Tumble benötigt einen deterministischen Starrkörperlöser.
- Hook Wars benötigt Plattform- und Seilphysik.

## Offene Probleme

- Leistung (60 FPS) und Touch-Gefühl auf echten Handys sind nicht geprüft.
- Handy-Hosting mit sechs Spielern und Echtzeitspielen ist nicht auf echten
  Geräten geprüft.

## Nächste Schritte

1. Phase 1 abschließen und in diesem Dokument festhalten.
2. Quick Draw vollständig umsetzen.
