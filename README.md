# Spielraum

Eine installierbare Smartphone-PWA für lokale und Online-Spiele. Das aktuelle Grundgerüst enthält:

- lokales Gastprofil mit optionalem Anzeigenamen
- lokales Spiel-Setup
- Online-Räume mit fünfstelligem Raumcode
- Host-Wechsel bei Verbindungsabbruch
- gemeinsame Spieldefinitionen für lokalen und Online-Modus
- Qwixx-, Durak- und Kribbeln-Spielmodule für lokale und Online-Partien
- Offline-Cache als installierbare PWA

Das Qwixx-Modul enthält den gemeinsamen weißen Wurf, die zusätzliche Farbaktion der aktiven Person, vier getrennte Wertungsblätter, Fehlwürfe, Reihenschlüsse, automatische Wertung und die Spielergebnisanzeige.

Durak verwendet 36 Karten für zwei bis sechs Spieler. Enthalten sind Trumpf, Angriff und Verteidigung, Aufnehmen, Nachlegen, Weiterschieben sowie verdeckte Online-Handkarten. Im lokalen Modus schützt eine Übergabeansicht die Hand der jeweils aktiven Person.

Kribbeln ist für zwei bis fünf Personen lokal und online spielbar: sechs Farbwürfel, bis zu drei Würfe mit frei wählbarem Behalten, sechs Farbaufgaben und vier streng ansteigende Kribbelfelder. Bei einer nicht erfüllten Aufgabe kann auf ein freies Kribbelfeld derselben Gruppe ausgewichen werden; danach gibt es drei neue Versuche. Jede abgeschlossene Zeile wird nach Platzierung gewertet, Gleichstände erhalten den niedrigeren Platz. Bei gleichen Endpunkten entscheidet das vierte Kribbelfeld.

Die App verwendet ein eigenes festes digitales Aufgabenblatt und eine dokumentierte zyklische Farbverteilung: Die sechs Farben Rot, Gelb, Grün, Blau, Orange und Violett werden für jeden weiteren Würfel um eine Zahl versetzt. Diese Materialausführung ist nicht als identische Kopie sämtlicher Original-Wertungsblätter oder der Originalwürfel verifiziert.

## Automatische Prüfungen

`.github/workflows/ci.yml` führt unter Node 22 bei Pushes und Pull Requests Installation, TypeScript-/PWA-Build, Regeltests aller drei Spiele, Socket-Integration und Produktionsprüfung aus. Manuelle Starts sind ebenfalls möglich. Die Regeltests umfassen Feldgrenzen, Schlösser und Fehlwürfe bei Qwixx, Kartenvergleiche, Weiterschieben und Schummelmodus bei Durak sowie alle 46.656 Farbkombinationen und Runden-/Wertungslogik bei Kribbeln. Die Socket-Tests verwenden echte UUIDs und prüfen alle drei Spielstarts. Dies ist keine Garantie, dass jeder denkbare Browser- oder Netzwerkfehler abgedeckt ist.

## Entwicklung

```bash
npm install
npm run dev
```

Die App läuft unter `http://localhost:5173`, der Echtzeit-Server unter `http://localhost:3001`.

## Produktion

```bash
npm run build
```

Die Spielregeln und der Echtzeitablauf lassen sich getrennt prüfen:

```bash
npm run test:rules
npm run test:online
npm run test:production
```

Die Schritte für einen öffentlichen HTTPS-Link und einen Docker-fähigen Hoster stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Für den echten Online-Betrieb müssen Client und Socket.IO-Server unter einer öffentlich erreichbaren HTTPS-Adresse bereitgestellt werden. Der lokale Modus bleibt nach dem ersten Laden offline verfügbar.
