---
name: documentation-audit
description: Prüfe Entwicklungsdokumentation, Architekturannahmen und Codex-Workflow von GoldenSchmidtGames gegen Code, Tests und CI. Nutze den Skill für ausdrücklich angeforderte oder regelmäßige Dokumentationsaudits und nach größeren Entwicklungsmeilensteinen, etwa Architektur-, Hosting- oder Spielmodulerweiterungen; kein vollständiger Audit bei kleinen Codeänderungen.
---

# Documentation Audit

## Umfang und Schreibfreigabe

- Führe den Audit auf Anforderung oder im Rahmen eines größeren Entwicklungsmeilensteins aus. Richte die Prüftiefe am Auftrag aus; regelmäßige Nutzung benötigt keinen neuen Zeitplan, Hook oder Automatismus.
- Lies die geltenden `AGENTS.md`-Anweisungen und prüfe Branch, Arbeitsstand und vorhandene Änderungen. Bewahre fremde Änderungen. Benenne den geprüften Stand einschließlich uncommitteter Änderungen.
- Ein reiner Prüfauftrag ist lesend. Nur bei Schreibfreigabe im aktuellen Auftrag korrigierst du nachweislich veraltete technische Dokumentation innerhalb des freigegebenen Umfangs. Dateisystem-Schreibrechte allein sind keine inhaltliche Freigabe.
- Änderungen an `AGENTS.md`, Skills, verbindlichen Spielentscheidungen und Qualitätsrichtlinien zunächst als konkrete Vorschläge mit Begründung vorlegen. Erst nach ausdrücklicher Freigabe umsetzen; eine allgemeine Freigabe für Dokumentationskorrekturen reicht dafür nicht. Bereits ausdrücklich genehmigte Änderungen benötigen keine erneute Rückfrage.
- Ändere keine produktive Spiellogik, Tests oder CI-Konfiguration, um Dokumentation passend zu machen. Schwäche niemals Tests, Sicherheitsregeln oder Qualitätsanforderungen ab. Melde Implementierungsfehler als separate Befunde.

## Dokumentation und Architektur abgleichen

1. Starte mit `AGENTS.md`, `README.md`, `DEPLOYMENT.md` und deren für den Auftrag relevanten Verweisen in `docs/`. Suche gezielt mit `rg`; lies zusätzliche Dateien nur bei konkretem Bezug. Prüfe Links, Dateipfade und dokumentierte Einstiegspunkte.
2. Vergleiche relevante Aussagen mit dem aktuellen Code und der Konfiguration. Ausgangspunkte sind `shared/games.ts`, `shared/roomCore.ts`, die Spielmodule in `shared/`, `src/App.tsx`, `server/` und die über ihre Aufrufer ermittelten Handy-Host-/Transportmodule. Behandle diese Pfade als zu prüfende Einstiegspunkte, nicht als unveränderliche Architektur.
3. Prüfe insbesondere gemeinsame Regelfunktionen, Zuständigkeit der Raumautorität, Trennung von Regeln und Transport, Speicherung vor Zugbestätigung, Sitzungsschutz und gerätespezifische Sichten. Gleiche Hosting-, Offline-, PWA- und Speicherbeschreibungen mit ihrer tatsächlichen Implementierung ab.
4. Beachte verbindliche Entscheidungen in `docs/island-party-rules.md` und `docs/approved-character-design.md`, soweit betroffen. Bei Widersprüchen zwischen Soll und Code nicht stillschweigend die Vorgabe an den Code anpassen; Abweichung und Klärungsbedarf melden.
5. Erfasse veraltete Annahmen, Widersprüche zwischen Dokumenten und relevante undokumentierte Änderungen. Nutze bei Bedarf gezielte Git-Diffs oder Historie, ohne aus einer fehlenden Erwähnung allein auf fehlende Implementierung zu schließen.

## Befehle, CI und Skills verifizieren

- Vergleiche dokumentierte Befehle mit `package.json`, den tatsächlich aufgerufenen Skripten, `.github/workflows/` und `playwright.config.ts`. Prüfe Auslöser, Abhängigkeiten, Laufzeitversionen, Build-Reihenfolge und Testprojekte. Konfigurierter CI-Schritt und nachgewiesener erfolgreicher CI-Lauf sind verschiedene Belege.
- Führe relevante lokale Prüfungen gemäß `AGENTS.md` aus, um Funktionsfähigkeit zu bestätigen. Prüfe Befehle vor der Ausführung auf Nebenwirkungen. Nach Clientänderungen muss vor Playwright der Build erfolgen, da die Browserprüfung `dist/` verwendet. Ein Voll-Audit prüft alle dokumentierten lokalen Prüfgruppen, soweit ausführbar; ein Teil-Audit benennt seine Auswahl und ausgelassene Gruppen.
- Trenne „Befehl/Skript existiert“, „Konfiguration geprüft“ und „erfolgreich ausgeführt“. Pro Ausführung Befehl, Ergebnis und relevante Einschränkungen festhalten. Fehlende Abhängigkeiten, Netzwerkzugang, Geräte oder Berechtigungen als „nicht verifiziert“ mit Grund melden, niemals als Erfolg. Keine kostenpflichtigen Dienste, Deployments oder Installationen ohne entsprechende Autorisierung auslösen.
- Prüfe referenzierte Skills anhand ihres tatsächlichen Speicherorts bzw. des verfügbaren Skill-Katalogs: `SKILL.md`, YAML-Frontmatter mit `name` und `description`, unterstützende Verweise und passende Auslöser. Plugin-Skills müssen nicht im Repository liegen. Nutze verfügbare Formatvalidatoren und Erkennungsmechanismen; unterscheide Formatprüfung, Erkennung und praktische Anwendung.
- Browseremulation belegt keine Leistung oder Bewegungssensorik auf echten Handys. Behaupte erfolgreiche CI-Läufe nur mit einem tatsächlich verfügbaren Laufbeleg für den benannten Stand.

## Workflow und Kontext verbessern

- Suche in vorhandenen Testausgaben, CI-Ergebnissen, Git-Historie und Projektdokumentation nach belegten Arbeitsproblemen. Bezeichne einen Fehler nur mit mehreren unabhängigen Belegen als wiederkehrend; fehlende Historie rechtfertigt keine erfundenen Muster.
- Leite aus jedem bestätigten Problem eine konkrete, möglichst kleine Verbesserung ab: Ursache, betroffene Datei, vorgeschlagene Änderung und überprüfbarer Nutzen. Kennzeichne bloße Vermutungen und offene Fragen gesondert.
- Halte `AGENTS.md` auf dauerhafte Projektregeln, Einstiegspunkte und passende Prüfungen konzentriert. Schlage vor, redundante Inhalte zu entfernen und umfangreiche Spezialanweisungen in bestehende Dokumente oder Skills zu verschieben und knapp zu verlinken. Erhalte dabei alle verbindlichen Anforderungen; Kürze allein ist kein Qualitätsnachweis.
- Verwende vorhandene Dokumente. Erzeuge keine neuen Berichtsdateien, Checklisten, Skills oder sonstige Infrastruktur ohne konkreten Bedarf und Auftrag. Prüfe bei freigegebenen Korrekturen den finalen Diff auf Umfang und unbeabsichtigte Änderungen.

## Priorisierter Abschlussbericht

Gib den Bericht auf Deutsch direkt in der Antwort aus:

- **Prüfumfang:** Branch/Commit, relevante lokale Änderungen, geprüfte Bereiche und Auditmodus.
- **Befunde nach Priorität:** hoch bei Sicherheits-, Datenverlust- oder verbindlichen Qualitätsabweichungen; mittel bei falschen Architektur-/Betriebs-/Testangaben; niedrig bei Redundanz und Verständlichkeit. Pro Befund konkrete Dateiverweise mit Zeilen, Beleg, Auswirkung und nächste Maßnahme angeben. Fakten, Annahmen und geplante Funktionen ausdrücklich unterscheiden.
- **Umgesetzte Korrekturen:** Nur tatsächlich vorgenommene, freigegebene Änderungen und deren Verifikation nennen; sonst festhalten, dass nichts geändert wurde.
- **Freigabepflichtige Vorschläge:** Konkrete Änderungen an Agentenregeln, Skills und verbindlichen Richtlinien getrennt aufführen.
- **Validierung und Grenzen:** Ausgeführte Befehle und Ergebnisse, nur statisch geprüfte Aussagen sowie nicht geprüfte Punkte mit Gründen nennen. Keine Befunde erfinden, wenn keine bestätigt wurden.
