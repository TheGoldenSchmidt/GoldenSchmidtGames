# Minispiele: Stand und offene Arbeit

Architektur/Abweichungen: [Konzept](konzept.md). Ausgangsregeln: [Spezifikation](spezifikation.md). Bei relevanten Änderungen nachführen; erledigte Phasen und Rückmeldungen bleiben in der Git-Historie.

## Implementiert

Match-Framework, Touch-Steuerung, Bots/Übung, Party-/Wettbewerbsanbindung und beide Hostingadapter. Spiele: `MATCH_IDS` in `shared/matches/framework.ts`; Gruppen/Zufallspool: `shared/minigameCatalog.ts`.

- Ursprüngliche Match-Spiele plus Turmsicht, Hindernis-Parcours und Standhaft; jeder Parcours-Lauf ist ein eigenständiges Minispiel mit eigenem Eintrag in Auswahl und Zufallspool (Nov. 2026).
- Neu (Nov. 2026): Tower Tumble – Survival, Neon Racer (Hochformat, Lenkrad/Pedale), Neon Racer – Kippen (Querformat, Bewegungssteuerung), Schneeballschlacht (3D). Regeln/Entscheidungen im [Konzept](konzept.md#dokumentierte-abweichungen).
- Erste Generation: 14 klassische Arenen, Hook Wars, Chaos Run und Wippenwerk; weiter direkt wählbar.
- Proberaum: lokale Übungsinsel mit neun Stationen, Pause/Reset, Figurenwahl und Animationsvorschau; kein Minispiel-/Pool-Eintrag.
- Unity-Fassungen (Nov. 2026): Parcours-Probelevel, Floor is Lava, Sumo Smash, Bumper Mayhem, Bomb Arena, Schneeballschlacht und Tower Tumble gegen Bots in einem gemeinsamen Unity-WebGL-Build unter „Frei ausprobieren“; kein Pool-/Raumeintrag. Reihenfolge der weiteren Umstellung: [Unity-Minispiele](../../UnityGames.md#reihenfolge-der-umstellung).
- 3D-Match-Szenen mit Canvas-Rückfall. Figurenpipeline: [Skelettfiguren](figuren-rigged.md).

**Implementiert ist keine Abnahme auf echten Handys.**

## Offen

| Thema | Nächster Schritt |
| --- | --- |
| Echte Geräte | Android/iPhone, möglichst älteres Gerät, Node und Handy-Host bis sechs Geräte nach [Gerätetest](geraetetest.md) prüfen. |
| Unity-Umstellung | Rückmeldung zu den ersten fünf Unity-Fassungen auf echten Handys (Bildrate, Ladezeit, Wärme, Steuergefühl) einholen, dann die Liste in [Unity-Minispiele](../../UnityGames.md#reihenfolge-der-umstellung) weiter abarbeiten. |
| Handy-Hosting | `nearby.spec.ts` mit Match-Spielen in WebRTC-fähiger Umgebung prüfen. Frühere Cloud-Grenzen sind kein aktueller Laufbeleg. CI nur auf ausdrücklichen Wunsch. |
| Tower Tumble | Hohe Türme, Pfeilsteuerung und Leistung auf Handy-Host/Render Free messen. Bots nur zum Üben. |
| Kamera/Balance | Klettern, Balkentreffer, Sprung/Hechten, Lava-Etagen/Schubser, kleine Figuren, Light-Trails-Lenkung, Quick-Draw-Fairness und Funklatenz beurteilen. |
| Bots | Insbesondere Hook Wars und Chaos Run einfach; im Kreiselkurs bleibt gelegentlich ein Bot am Rührwerk hängen. Keine hohe Spielstärke zugesichert. |
| Arrow Masters | Ego-Perspektive offen, Spezialpfeile vorhanden. |
| Neon Racer | Kippsteuerung auf Android und iPhone (Vorzeichen, Ruhelage, Querformat-Layout, Freigabe) prüfen; Streckenlänge, Item-Balance und Lenkradgefühl beurteilen. Nur Canvas, keine 3D-Variante. |
| Schneeballschlacht | Zielhilfe (±22°, Antippen ±66° im Kamerabild) und Antippen-Formen auf echten Handys beurteilen; Reichweite, Bot-Stärke und 3D-Leistung mit sechs Figuren prüfen. |
| Parcours-Länge | Verlängerte Fallklappen, Windkanal und Serpentinen-Glibberflut (Dauer, Glibbertempo, Kamera an Ecken) mit Menschen beurteilen; Bots sind kein Maßstab für die Schwierigkeit. |
| Kanten | Zeitfenster fürs Festhalten (320 ms) mit Funklatenz auf echten Handys prüfen. |
| Wind-Ideen | Nicht umgesetzt: Figur lehnt sich gegen den Wind, Windgeräusch je Böe, Böen-Zeitleiste im HUD, flatternde Fahnen an den Stegen. |
| Weitere Läufe | Ideen: Teamstaffel, Rutschbahn, wechselndes Labyrinth, weitere Finals. Nicht implementiert. |

## Prüfungen

Befehle/CI/Build-Reihenfolge: [AGENTS.md](../../AGENTS.md#passende-prüfungen).

Regeltests unter `scripts/`: Determinismus, JSON-Neustart, Gleichstände, Zeitlimits, Teilnahme, 2/4/6 Personen (Neon Pong 2/4). Online: Match-, Modus- und Neustarttests. Smartphone: `match-games.spec.ts`, `practice-world.spec.ts`, `nearby.spec.ts`. Zufallsminispiele mit `toArenaMini`/`participate` aus `party-session.ts` behandeln.

Vergangene „grün“-Angaben ohne Commit/Laufbeleg sind kein aktueller Prüfstand. Ergebnisse mit Datum, Commit, Befehl und Grenzen erfassen; reale Gerätefreigabe gesondert.
