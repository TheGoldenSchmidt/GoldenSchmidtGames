# Minispiele: Stand und offene Arbeit

Architektur und gültige Regeln: [Konzept](konzept.md). Ausgangsregeln: [Spezifikation](spezifikation.md). Erledigtes steht in der Git-Historie.

## Implementiert

- Match-Framework, Touch-Steuerung, Bots/Übung, Party-/Wettbewerbsanbindung und beide Hostingadapter. Spiele: `MATCH_IDS` in `shared/matches/framework.ts`; Pool und Spielfamilien: `shared/minigameCatalog.ts`; gültige Regeln: [Konzept](konzept.md#gültige-regeln-je-spiel).
- Erste Generation (14 klassische Arenen, Hook Wars, Chaos Run, Wippenwerk) weiter direkt wählbar und abschaltbar.
- Proberaum: lokale Übungsinsel, kein Pool-Eintrag. Unity-Fassungen: [Unity-Minispiele](../../UnityGames.md).
- 3D-Match-Szenen mit Canvas-Rückfall; Figuren: [Skelettfiguren](figuren-rigged.md).

**Implementiert ist keine Abnahme auf echten Handys.**

## Offen

| Thema | Nächster Schritt |
| --- | --- |
| Echte Geräte | Android/iPhone, möglichst älteres Gerät, Node und Handy-Host bis sechs Geräte nach [Gerätetest](geraetetest.md) prüfen. |
| Unity im Raum | Weitere Unity-Spiele nach demselben Muster auf die Darstellung im Raum umstellen; Stand und offene Spiele: [UnityGames.md](../../UnityGames.md#spiele-und-stand). Ansichten in `MINI_LOOKS` ergänzen. |
| Pilot „Host rechnet“ | Floor is Lava mit „Unity“ und „Unity · Host rechnet“ auf echten Handys vergleichen (Spielgefühl, Verzögerung der Mitspieler, Wärme des Host-Handys); danach entscheiden, welcher Weg für weitere Spiele gilt. |
| Unity-Umstellung | Rückmeldungen auf echten Handys einholen, dann die Reihenfolge in [Unity-Minispiele](../../UnityGames.md#spiele-und-stand) weiter abarbeiten. |
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
