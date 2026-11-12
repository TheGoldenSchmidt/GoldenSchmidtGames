# Freigegebene Charaktere

Nur die 13 ausdrücklich ausgewählten alpha_-Figuren sind spielbar. The Coon
wurde zweimal genannt und wird einmal angeboten. Die Originaldateien aus
PC_Fighters bleiben unverändert; eigene Kopien enthalten Herkunfts-Hashes.

Vor Raum, Beitritt oder Solo-Test wird eine Figur gewählt. Eine große Bühne
zeigt die Wahl, darunter stehen 13 Bildschaltflächen. Ohne Wahl bleiben
Raumaktionen gesperrt. In der Lobby kann die Figur vor dem Start gewechselt
werden. Lokale Spieler bekommen dieselbe Auswahl im Setup.

Menüs, Figurenwahl und Lobby folgen dem Party-Stil aus den
[Designregeln](../designregeln.md). Die Spielansichten behalten Hafenblau
#10485b, Wasser #94def1, Sand #ffe5a1, Sonne #ffd258, Koralle #e87565
und Papier #fffdf8. Trebuchet MS bleibt die Spielschrift.
Figurenname und bestätigte Auswahl führen; Hinweise sind kurz und linksbündig.

PC: [ große 3D-Bühne ] [ Figurennamen und Bildauswahl ]
Handy: [ Bühne ] [ Bildauswahl in drei Spalten ] [ Raumaktionen ]

Vorabkritik: Farbpunkte machen Serienfiguren schwer erkennbar. Daher echte
Vorschaubilder und ein einziges aktives 3D-Modell. Listen und Punktestände
verwenden dieselben Bilder, statt zusätzliche WebGL-Kontexte zu öffnen.
Alle Spiele und Intros erhalten dieselbe Zuordnung. Ausnahme (Prototyp, Nov. 2026):
Sumo Smash zeigt eingefärbte, animierte Mannequins (Quaternius, CC0), siehe
[Prototyp](minigames/prototyp-sumo-rigged.md). Bewegung respektiert
die Systemeinstellung und verändert keine Regeln.

Für sechs Spieler werden Details innerhalb derselben beweglichen Gruppe
zusammengeführt. Arme, Beine und Animationsziele behalten ihre Hierarchie.
Qualitätsanpassung verändert ausschließlich Grafik, niemals Physik.

Visuelle Prüfung: Die Portraits machen alle 13 Modelle auf Handybreite
unterscheidbar; Auswahlrahmen und Häkchen bestätigen denselben Namen wie die
3D-Bühne. In der Lobby wäre die erneut offene Galerie zu lang. Deshalb zeigt
sie zunächst nur die eigene Figur mit „Spielfigur ändern“; die Bereitschaft
bleibt schnell erreichbar. Spielerlisten benötigen keinen eigenen Canvas.
Die Sechs-Spieler-Ansicht wurde mit unterschiedlichen Modellen als Screenshot
geprüft. Automatisierte Browserprüfungen ergänzen die Sichtkontrolle.
