# Eigene Figuren und Solo-Test

## Im Spiel

Unter **Online spielen → Inselparty alleine testen** lässt sich ein Testraum
mit einer Person und ein bis fünf Bots anlegen. In der Lobby die Figur und die
Rundenzahl wählen und **Ich bin bereit** drücken. Die Bots melden sich selbst
bereit, würfeln, verwenden Items und steuern ihre Figuren in den Minispielen.

Oben in der Partie öffnet **Testpartie mit Bots** die Werkzeuge:

- Ein bestimmtes Minispiel mit allen Bots starten.
- Das aktuelle Minispiel wiederholen.
- Beim Wiederholen bleibt auch der Arenaaufbau gleich.
- Die verbleibenden Bot-Züge bis zum eigenen Zug oder Minispiel überspringen.
- Die komplette Partie mit demselben Startwert neu beginnen.

Der Startwert bestimmt Würfelreihenfolge und Arenaaufbau. Eingaben, Kollisionen
und Zeitablauf beeinflussen das Ergebnis weiterhin. Ein Testraum ist privat
für seine erstellende Person und deren Bots; andere Personen können ihm nicht
beitreten. Die Partie läuft auf dem normalen Online-Server. Nach einem
Verbindungsabbruch kann dieselbe Sitzung wieder beitreten. Ein Serverneustart
verwirft wie bisher die im Arbeitsspeicher gehaltenen Räume.

In normalen Inselparty-Räumen wählt jede Person ihre eigene Figur vor dem
Start. Ein Figurenwechsel setzt ihre Bereitschaft zurück. Die Auswahl bleibt
bei Spielbeginn, Minispielwechsel und Wiederbeitritt erhalten. Figuren haben
identische Spielphysik; der farbige Ring zeigt weiterhin die Spielerfarbe.

## Übernommene Modelle

Die JSON-Dateien wurden aus `C:/Users/PCUser/PC_Fighters` kopiert. Dieses
Projekt benötigt zur Laufzeit keinen Zugriff auf dieses Verzeichnis und keinen
GLB-Exporter. Es werden keine Kartenspielregeln aus PC_Fighters importiert.

| Auswahl | Quelldatei |
| --- | --- |
| Rick | `tools/figuren-viewer/standalone-figures/rick_sanchez_3.json` |
| Morty | `tools/figuren-viewer/standalone-figures/morty_smith.json` |
| Cartman | `tools/figuren-viewer/standalone-figures/eric_cartman_3.json` |
| Stan, Kyle, Kenny, Butters | gleichnamige Dateien im Standalone-Verzeichnis |
| Korvo | `tools/figuren-viewer/standalone-figures/korvo_3.json` |
| Terry, Pupa | `terry_solar_opposites.json`, `pupa.json` im Standalone-Verzeichnis |
| Ritter, Rekrut | `packages/engine/src/data/figures/ritter.json`, `rekrut.json` |

`CardFigure.ts` und `AnimationPlayer.ts` stammen aus
`packages/client/src/figures/`. Die Typimporte wurden auf die lokalen
Figurenverträge umgestellt. Der Player kann reduzierte Bewegung auch nach dem
Erstellen beachten. Geometrien werden pro Szene erzeugt und mit der Szene
freigegeben; der ursprüngliche globale Geometriecache wird hier nicht benutzt.

`src/figures/resolve.ts` führt Varianten mit Grundgerüsten zusammen:
Palette überschreiben, Bauteile samt Nachkommen entfernen, Bauteile verändern
und hinzufügen, `@`-Anschlüsse auflösen, Profil/Basis/Variantenanimationen in
dieser Priorität zusammenführen. Fehlende Klips erben die Standardanimationen.
Alle ausgewählten Figuren werden auf dieselbe sichtbare Höhe normalisiert.
Eigene Animationen bleiben erhalten; der Adapter ergänzt Laufbewegungen und
einen sichtbaren Schlag. Spielposition und Physik gehören zur äußeren Gruppe.

Weitere Figuren hinzufügen: JSON-Datei nach `src/figures/data/figures/` kopieren,
benötigte Basis und Profile mitnehmen, in `src/figures/catalog.ts` eintragen und
in `shared/characters.ts` einen Namen und eine Farbe ergänzen. Letztere Liste
ist auch die serverseitige Erlaubnisliste. Der Figuren-Regeltest prüft dann die
neue Figur automatisch.

## Prüfungen und CI

`npm run test:rules` enthält Modell-, Hierarchie-, Varianten-, Animations- und
Botprüfungen. Dabei werden alle sechs Arenen und eine komplette fünfründige
Partie simuliert. Die Bots nutzen ausschließlich dieselben Aktionen und
Steuereingaben wie menschliche Spieler.

`npm run test:online` prüft zusätzlich Testraumerstellung, ungültige Eingaben,
fünf Bots, Figurenwahl, echte Bewegung über Socket.IO, Neustart, Wiederbeitritt
und die Sperre der Testwerkzeuge in normalen Räumen.

`npm run test:browser` prüft den Solo-Ablauf inklusive echter WebGL-Vorschau,
mehrfacher Figurenwechsel, Figurenrotation und gemeinsamen Minispiels auf
Handy- und PC-Größe. Diese Befehle laufen bereits im GitHub-CI-Workflow; die
neuen Prüfungen sind darin enthalten. Die Modell-Daten werden mit dem
nachgeladenen 3D-Modul gebündelt und im PWA-Cache mitgespeichert.
