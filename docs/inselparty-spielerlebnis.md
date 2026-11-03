# Inselparty: Spielerlebnis

Dieser Entwurf beschreibt den früheren 2D-Stand. Die aktuelle, ausschließlich online gespielte 3D-Version ist in [Inselparty in 3D](inselparty-3d.md) dokumentiert.

Die Insel ist die Bühne. Die bisherige Ansicht zeigte Karte, Regeln und Aktionen untereinander; auf dem Handy verschwand der Spielzug unter dem Kartenbereich. Minispiele hatten kaum eigene Identität und Belohnungen waren nur Text.

## Gestaltungsrichtung

- Lagune `#087f9b`, tiefes Wasser `#10485b`, Blattgrün `#318564`, Strand `#fff0bb`, Schatzgold `#ffcc4d`, Koralle `#e66352`.
- Runde, kräftige Überschriften in „Trebuchet MS“, dieselbe Familie für kurze, gut lesbare Anleitungen. Keine externen Schrift- oder Bildabrufe; die PWA bleibt offline vollständig.
- Handy: kompakter Rundenkopf, Spielerleiste, illustrierte Insel, unmittelbar anschließender Zugbereich. PC: große Insel links, Zugbereich rechts. Minispiele übernehmen die Bühne und blenden den Brett-Punktestand aus.
- Links ausgerichtete Entscheidungen; zentrierte Spielaktionen, Countdown und Belohnungen. Große Touchflächen, Symbole zusätzlich zu Spielerfarben.

```text
Brett am Handy              Minispiel
Name / Runde / Menü         Runde / Spieler / Menü
Spieler und Schätze         Spielname / Zeit / Punkte
Insel mit sichtbarem Weg    +----------------------+
und Trophäenstand          | eigene Spielszene     |
Zug / Würfel / Hauptaktion | und direkte Eingabe   |
Inventar bei Bedarf       +----------------------+
                          Treffer / Fortschritt
```

Eine austauschbare Kartenoberfläche wäre für dieses Spiel zu nüchtern. Deshalb entsteht die visuelle Identität aus einer begehbaren Spielzeuginsel: Hafen, Palmen, Brücke, Vulkan und Schatzstand. Um die Insel herum bleiben Bedienelemente ruhig. Animationen erklären Würfeln, Bewegung, Treffer und erhaltene Münzen; sie ändern keine Spielregel. Reduzierte Bewegung zeigt dieselben Zustände unmittelbar.

## Prüfpunkte

- Würfeln ist auf einem üblichen Smartphone ohne Scrollen erreichbar.
- Der Wurf wird sichtbar, danach läuft die Figur; eine Wegwahl setzt die Bewegung fort, ohne den bisherigen Weg zu wiederholen.
- Entscheidungen nennen ihre Folgen, Item-Zielauswahl erscheint nur für das betreffende Item.
- Jedes digitale Minispiel hat eine eigene Szene, Fortschritt, sofortiges Feedback und eine deutlich erkennbare Startphase.
- Ergebnislisten zeigen Platz, Minispielpunkte und tatsächlich erhaltene Münzen einschließlich Gleichständen und Nichtteilnahme.
- Üben ist erneut möglich; Dialoge sind per Tastatur bedienbar. Kein horizontaler Seitenüberlauf auf kleinen Bildschirmen.
