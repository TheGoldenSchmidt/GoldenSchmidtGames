# GoldenSchmidtGames

Installierbare Smartphone-PWA für eine Freundesrunde: lokale Tischspiele, Brettspiele und gemeinsame Minispiele. Ziel: Betrieb ohne laufende Kosten.

## Spielen

| Modus | Nutzung |
| --- | --- |
| Qwixx, Durak, Kribbeln | Zusammen an einem Handy oder online auf getrennten Geräten |
| Inselparty, Roll It Up! | Brettspiele auf getrennten Handys; allein mit 1–5 Bots |
| Freies Minispiel | Passendes Minispiel direkt wählen |
| Schlag den GoldenSchmidt | Wettbewerb mit einmaligen verdeckten Einsätzen |
| Proberaum | Lokale Übungsinsel für Entwickler und Admins; Verbindung zum Öffnen erforderlich |
| Unity-Fassungen | Parcours-Probelevel, Floor is Lava, Sumo Smash, Bumper Mayhem, Bomb Arena, Schneeballschlacht, Tower Tumble (+ Survival), Türenlotto, Kreiselkurs, Standhaft und Tank Trouble in einem gemeinsamen Unity-WebGL-Build unter „Frei ausprobieren“; allein/gegen Bots, Internet beim ersten Start ([Unity-Minispiele](UnityGames.md)) |
| Rich’s Universe | Eigener Bereich für lokale Experimente |

Vorher eine Figur wählen. Modi/Spielerzahlen: [Spielekatalog](shared/games.ts), einzelne Minispiele: [Minispielkatalog](shared/minigameCatalog.ts). Binokel ist angekündigt, noch nicht spielbar.

**Lokal spielen** führt zu Tischspielen, Bot-Partien und für freigeschaltete Konten zum Proberaum; **Online spielen** zu Erstellen/Beitreten. Nach vollständigem Laden der PWA funktionieren lokale Spiele und Handy-Räume offline.

Über das Profil anmelden oder ein Einladungskonto anlegen: Anzeigename, Figur und Spieltöne werden geräteübergreifend gespeichert; abgeschlossene Online-Partien und Siege pro Spiel unter **Deine Statistiken** angezeigt. Admins verteilen Einladungen und Entwicklerrechte. [Kontoeinrichtung und Grenzen](DEPLOYMENT.md#konten-rechte-und-statistiken).

## Zwei Hostingarten

- **Über das Internet:** Node-Server, Beitritt per Raumcode.
- **Dieses Handy:** Host spielt mit und berechnet die Partie. Gäste koppeln sich im selben erreichbaren WLAN/Hotspot per QR-Einladung und Antwort; Textcodes sind ebenfalls möglich. Keine externen Verbindungsserver. Host-Handy aktiv halten; kein automatischer Gerätewechsel.

Die App vorher auf jedem Gerät laden. Installation: Android über den Browser, iPhone über Safari → Teilen → Zum Home-Bildschirm. Voraussetzungen, Speicherung und Einrichtung: [Deployment](DEPLOYMENT.md).

**Updates prüfen** und **Neue Version laden** stehen im Startmenü. Laufende Spiele werden nicht automatisch neu geladen.

## Entwicklung starten

Node.js ≥22:

```bash
npm ci
npm run dev
```

Client: `http://localhost:5173`; Server: `http://localhost:3001`.
Produktion: `npm run build`, danach `npm start`.
Zwischenstände gemeinsam auf Handys prüfen, bevor sie nach `main` kommen: [separate Testadresse einrichten](DEPLOYMENT.md#zwischenstände-testen-ohne-main).
Für Browserprüfungen einmal `npx playwright install chromium`; Standardprojekt ist `phone`. Prüfungen und Build-Reihenfolge: [AGENTS.md](AGENTS.md#passende-prüfungen).

## Mitarbeiten

Die [Regeln für Zusammenarbeit und Auslieferung](AGENTS.md#zusammenarbeit-und-auslieferung) legen für Menschen und Agenten fest, welche Prüfungen und Freigaben ein PR braucht. `main` ist für die Live-Auslieferung vorgesehen. Richs Arbeitsablauf steht in [seiner Anleitung](src/richs-universe/README.md#zusammenarbeit-über-git). Claude Code lädt dieselben Regeln über `CLAUDE.md`.

## Dokumentation

- [Designregeln](designregeln.md), [Betrieb und CI-Auslieferung](DEPLOYMENT.md)
- [Spielregeln und Modi](docs/island-party-rules.md), [Brettdarstellung](docs/inselparty-3d.md)
- Unity-Probe: [Unity-Minispiele](UnityGames.md)
- Minispiele: [Regelbasis](docs/minigames/spezifikation.md), [Technik/Abweichungen](docs/minigames/konzept.md), [offene Arbeit](docs/minigames/backlog.md), [Gerätetest](docs/minigames/geraetetest.md)
- Figuren: [Freigabe](docs/approved-character-design.md), [klassische Modelle/Bots](docs/party-characters-and-testing.md), [Skelettfiguren](docs/minigames/figuren-rigged.md)
- Ansichten: [Intros](docs/game-intros.md), [Qwixx](docs/qwixx-cup.md), [Kribbeln](docs/kribbeln-visuals.md), [Grafikwerkzeuge](docs/startscreen-render.md)

Browseremulation belegt keine Leistung oder Sensorfunktion auf echten Handys; Geräteprüfungen bleiben gesondert erforderlich.
