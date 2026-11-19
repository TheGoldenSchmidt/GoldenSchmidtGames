# Minispiele: Stand und offene Arbeit

Architektur/Abweichungen: [Konzept](konzept.md). Ausgangsregeln: [Spezifikation](spezifikation.md). Bei relevanten Änderungen nachführen; erledigte Phasen und Rückmeldungen bleiben in der Git-Historie.

## Implementiert

Match-Framework, Touch-Steuerung, Bots/Übung, Party-/Wettbewerbsanbindung und beide Hostingadapter. Spiele: `MATCH_IDS` in `shared/matches/framework.ts`; Gruppen/Zufallspool: `shared/minigameCatalog.ts`.

- Ursprüngliche Match-Spiele plus Turmsicht, Hindernis-Parcours und Standhaft; jeder Parcours-Lauf ist ein eigenständiges Minispiel mit eigenem Eintrag in Auswahl und Zufallspool (Nov. 2026).
- Erste Generation: 14 klassische Arenen, Hook Wars, Chaos Run und Wippenwerk; weiter direkt wählbar.
- Proberaum: lokale Übungsinsel mit neun Stationen, Pause/Reset, Figurenwahl und Animationsvorschau; kein Minispiel-/Pool-Eintrag.
- 3D-Match-Szenen mit Canvas-Rückfall. Figurenpipeline: [Skelettfiguren](figuren-rigged.md).

**Implementiert ist keine Abnahme auf echten Handys.**

## Offen

| Thema | Nächster Schritt |
| --- | --- |
| Echte Geräte | Android/iPhone, möglichst älteres Gerät, Node und Handy-Host bis sechs Geräte nach [Gerätetest](geraetetest.md) prüfen. |
| Handy-Hosting | `nearby.spec.ts` mit Match-Spielen in WebRTC-fähiger Umgebung prüfen. Frühere Cloud-Grenzen sind kein aktueller Laufbeleg. CI nur auf ausdrücklichen Wunsch. |
| Tower Tumble | Hohe Türme, Pfeilsteuerung und Leistung auf Handy-Host/Render Free messen. Bots nur zum Üben. |
| Kamera/Balance | Klettern, Balkentreffer, Sprung/Hechten, Lava-Etagen/Schubser, kleine Figuren, Light-Trails-Lenkung, Quick-Draw-Fairness und Funklatenz beurteilen. |
| Bots | Insbesondere Hook Wars, Chaos Run und Windkanal einfach; keine hohe Spielstärke zugesichert. |
| Arrow Masters | Ego-Perspektive offen, Spezialpfeile vorhanden. |
| Weitere Läufe | Ideen: Teamstaffel, Rutschbahn, wechselndes Labyrinth, weitere Finals. Nicht implementiert. |

## Prüfungen

Befehle/CI/Build-Reihenfolge: [AGENTS.md](../../AGENTS.md#passende-prüfungen).

Regeltests unter `scripts/`: Determinismus, JSON-Neustart, Gleichstände, Zeitlimits, Teilnahme, 2/4/6 Personen (Neon Pong 2/4). Online: Match-, Modus- und Neustarttests. Smartphone: `match-games.spec.ts`, `practice-world.spec.ts`, `nearby.spec.ts`. Zufallsminispiele mit `toArenaMini`/`participate` aus `party-session.ts` behandeln.

Vergangene „grün“-Angaben ohne Commit/Laufbeleg sind kein aktueller Prüfstand. Ergebnisse mit Datum, Commit, Befehl und Grenzen erfassen; reale Gerätefreigabe gesondert.
