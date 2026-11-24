# Figurenadapter und Bot-Test

Entscheidungen: [Freigabe](approved-character-design.md); Skelettfiguren: [Pipeline](minigames/figuren-rigged.md).

## Bot-Test

**Lokal spielen → Allein mit Bots** startet Brett-/Minispielmodi mit 1–5 Bots auf diesem Handy, nach vollständigem Laden offline. Figur/Rundenzahl wählen, **Ich bin bereit**; Bots nutzen dieselben Aktionen/Eingaben wie Menschen. Auf dem Brett sparen sie auf Trophäen, nutzen Kompass und Münzangel und wählen Wege zum Trophäenstand bzw. zur nächsten fehlenden Station. Andere Personen können nicht beitreten; Wiederaufnahme über **Handy-Tisch fortsetzen**.

Brett-Testwerkzeuge: Minispielwahl, Wiederholung desselben Arenaaufbaus, Bot-Züge überspringen, Neustart mit gleichem Startwert. Eigenständige gewertete Minispielmodi bieten keine Werkzeuge zum Überspringen. Normale Mehrspielerräume erhalten keine Testwerkzeuge. Startwert bestimmt Zufallsfolgen, nicht die Wirkung unterschiedlicher Eingaben.

Auswahl im Gastprofil speichern, in Lobby änderbar; Wechsel setzt Bereitschaft zurück. Bots erhalten zufällige freigegebene Figuren unabhängig vom Spielseed. Wahl über Start, Minispielwechsel, Übung/Wiederbeitritt erhalten; Physik gleich.

## Klassische Modelle

Aus dem Projekt PC_Fighters (`packages/engine/src/data/figures/`) unverändert kopiert; Herkunfts-Hashes in `src/figures/data/approved-sources.json`. Register: `shared/characters.ts`. Kein Laufzeitzugriff auf PC_Fighters, GLB-Exporter oder importierte Kartenspielregeln. Neue Modelle nur mit Freigabe.

`CardFigure.ts`/`AnimationPlayer.ts` stammen aus `packages/client/src/figures/`, Typen lokal angepasst. `src/figures/resolve.ts` verbindet Basis/Varianten: Palette, Teile/Nachkommen, Anschlüsse, Animationen (Profil vor Basis vor Variante); fehlende Clips erben Standards.

Adapter normalisieren Höhe, ergänzen Laufen/Schlag, erhalten eigene Clips; Physik/Position in äußerer Gruppe. `buildOptimizedFigure` bündelt statische Flächen innerhalb beweglicher Gelenke, behält Transform-Anker und getrennte Material-/Transparenzeigenschaften. Ressourcen szeneneigen; Schließen darf keine andere Szene beschädigen. Reduzierte Bewegung auch nach Erzeugung beachten, Übergänge/Clip-Enden weich zurückblenden.

Modelle getrennt nachladen, Portraits für Listen/Punktestände, gemeinsamer 3D-Adapter für Intros/Bretter/Arenen. PWA speichert Modelle/Portraits offline.

## Prüfung

- `test:rules`: Herkunfts-Hashes, klassische Hierarchien/Varianten, Gelenkmatrizen/animierte Grenzen vor und nach Bündelung, Bots mit regulären Eingaben.
- `test:online`: Boträume, ungültige Eingaben, Wahl/Bewegung, Neustart/Wiederbeitritt, gesperrte Testwerkzeuge.
- Smartphone: Pflichtauswahl, Vorschau/Wechsel/Rotation, Bilder in Tischspielen, Solo-Partie, sechs Figuren, Messwerte/Offline-Cache.
- CI/Befehle: [AGENTS.md](../AGENTS.md#passende-prüfungen). Draw Calls belegen keine reale Handy-Bildrate.
