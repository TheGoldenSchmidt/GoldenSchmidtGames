# Eigene Figuren und Solo-Test

## Im Spiel

Unter **Online spielen → Inselparty alleine testen** lässt sich ein Testraum
mit einer Person und ein bis fünf Bots anlegen. Vorher die eigene Figur wählen;
in der Lobby die Rundenzahl wählen und **Ich bin bereit** drücken. Die Bots melden sich selbst
bereit, würfeln, verwenden Items und steuern ihre Figuren in den Minispielen.

Oben in der Partie öffnet **Testpartie mit Bots** die Werkzeuge:

- Ein bestimmtes Minispiel mit allen Bots starten.
- Das aktuelle Minispiel mit demselben Arenaaufbau wiederholen.
- Die verbleibenden Bot-Züge bis zum eigenen Zug oder Minispiel überspringen.
- Die komplette Partie mit demselben Startwert neu beginnen.

Der Startwert bestimmt Würfelreihenfolge und Arenaaufbau. Eingaben, Kollisionen
und Zeitablauf beeinflussen das Ergebnis weiterhin. Ein Testraum ist privat
für seine erstellende Person und deren Bots; andere Personen können ihm nicht
beitreten. Die Partie läuft auf dem normalen Online-Server. Nach einem
Verbindungsabbruch kann dieselbe Sitzung wieder beitreten. Ein Serverneustart
verwirft wie bisher die im Arbeitsspeicher gehaltenen Räume.

In allen Spielen wählt jede Person ihre Figur vor dem Erstellen oder Beitreten.
Die Auswahl wird im Gastprofil gespeichert und ist in der Lobby änderbar.
Bots bekommen unabhängig vom Spiel-Startwert zufällige freigegebene Figuren.
 Ein Figurenwechsel setzt ihre Bereitschaft zurück. Die Auswahl bleibt
bei Spielbeginn, Minispielwechsel und Wiederbeitritt erhalten. Figuren haben
identische Spielphysik; der farbige Ring zeigt weiterhin die Spielerfarbe.

## Übernommene Modelle

Die JSON-Dateien wurden aus `C:/Users/PCUser/PC_Fighters` kopiert. Dieses
Projekt benötigt zur Laufzeit keinen Zugriff auf dieses Verzeichnis und keinen
GLB-Exporter. Es werden keine Kartenspielregeln aus PC_Fighters importiert.

Alle Modelle stammen ausschließlich aus `packages/engine/src/data/figures/`.
The Coon wird trotz doppelter Nennung einmal angeboten.

| Auswahl | Datei |
| --- | --- |
| Prime Rick | `alpha_rick_prime.json` |
| Morty Smith | `alpha_morty_smith.json` |
| Summer Smith | `alpha_summer_smith.json` |
| Jerry Smith | `alpha_jerry_smith.json` |
| Mr Nimbus | `alpha_mr_nimbus.json` |
| Scary Terry | `alpha_scary_terry.json` |
| Mr Poopybutthole | `alpha_mr_poopybutthole.json` |
| Captain Diabetes | `alpha_captain_diabetes.json` |
| Doctor Timothy | `alpha_doctor_timothy.json` |
| The Coon | `alpha_the_coon.json` |
| Eric Cartman | `alpha_eric_cartman.json` |
| Pupa | `alpha_pupa.json` |
| Korvo | `alpha_korvo.json` |

Die Herkunfts-Hashes stehen in `src/figures/data/approved-sources.json`.
Andere Modelle werden weder angeboten noch mit dem Client ausgeliefert.

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

`buildOptimizedFigure` verbindet statische Oberflächen innerhalb beweglicher
Gelenke. Alle benannten Bauteile bleiben als Transform-Anker erhalten. Neue
Animationstracks erzeugen automatisch eigene Oberflächengruppen für ihr Ziel.
Materialeigenschaften, Farben und durchsichtige Flächen bleiben getrennt.
Die Ressourcen gehören zur einzelnen Szene; keine fremde Szene verliert beim
Schließen ihre Geometrien. Lauf- und Schlaggewichte werden weich eingeblendet,
beim Anhalten ausgeblendet. Doctor Timothys Räder drehen sich beim Fahren.

Für die sechs gemischt getesteten Modelle sinken die Oberflächengruppen von
607 auf 67, ohne Schatten- und Umgebungspässe mitzuzählen. Einzelmodelle sind
z. B. Scary Terry 295 → 7 und Prime Rick 69 → 15. Langsame Darstellung reduziert
Pixelauflösung und Echtzeitschatten; die Spielphysik bleibt unverändert.
Das ist kein gemessener FPS-Nachweis auf einem physischen Smartphone.

Die 13 Modelle werden getrennt nachgeladen. Vorschaubilder repräsentieren die
Spieler in Lobby, aktiven Spielanzeigen und Ergebnissen von Qwixx, Durak und
Kribbeln; die Partyinsel und alle Spiel-Intros verwenden die gleichen 3D-Modelle.
Auch Übungsrunden behalten die gewählte Figur. Neue Modelle werden erst nach
einer weiteren ausdrücklichen Freigabe in die Erlaubnisliste aufgenommen.

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
neuen Prüfungen sind darin enthalten. Jedes Modell wird als separates Modul nachgeladen. Modelle und Portraits
liegen im PWA-Cache, sodass die Auswahl auch offline nutzbar bleibt.

Die Browserprüfungen laufen für Handy und PC in jeweils zwei parallelen
Teilläufen nach den Regel- und Serverprüfungen. Beide Projekte werden vollständig ausgeführt;
ein fehlgeschlagenes Projekt bricht das andere nicht ab. Fortschritte stehen
einzeln im Protokoll. Screenshots und Fehler-Traces bleiben sieben Tage als
`browser-phone-1`, `browser-phone-2`, `browser-desktop-1` und
`browser-desktop-2` abrufbar.

Die Figurenprüfungen vergleichen die Originaldateien mit ihren Herkunfts-Hashes
und prüfen alle 13 Hierarchien. Für jeden Animationsclip werden Gelenkmatrizen
und exakte animierte Begrenzungen vor und nach dem Zusammenfassen verglichen.
Nicht neutrale Clip-Enden blenden weich zurück. Ein Browserfall rendert sechs
verschiedene Figuren auf der gemeinsamen Insel und in der Arena, steuert alle
sechs Server-Spieler und protokolliert Draw Calls und Dreiecke. Weitere Fälle
prüfen die Pflichtauswahl und die Spielerbilder in jedem Würfel-/Kartenspiel.
