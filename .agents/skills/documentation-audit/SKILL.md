---
name: documentation-audit
description: Prüfe Projektdokumentation, Architektur und Codex-Workflow gegen Code, Tests und CI bei angeforderten oder regelmäßigen Audits sowie größeren Meilensteinen; kein Voll-Audit für kleine Änderungen.
---

# Documentation Audit

## Umfang und Freigabe

AGENTS.md, Branch/Commit und lokale Änderungen prüfen, fremde Arbeit bewahren. Prüftiefe am Auftrag ausrichten. Prüfaufträge bleiben lesend; Dateisystemrechte sind keine Schreibfreigabe. Keine neuen Automationen, Berichte, Checklisten oder Skills ohne konkreten Bedarf/Auftrag.

Technische Doku nur im freigegebenen Umfang nach belegtem Befund ändern. AGENTS.md, Skills, Spielentscheidungen und Qualitätsrichtlinien brauchen konkrete Vorschläge und ausdrückliche Freigabe; allgemeine Doku-Freigabe genügt nicht. Vorhandene ausdrückliche Genehmigung nicht erneut abfragen. Produktivcode, Tests/CI oder Sicherheitsanforderungen nicht passend zur Doku verändern/abschwächen; Implementierungsfehler separat melden. Ausdrücklich beauftragte Konfigurationsänderungen gesondert prüfen und dokumentieren.

## Abgleich

1. AGENTS.md, README, DEPLOYMENT und relevante Verweise lesen; gezielt mit `rg` suchen. Links, Pfade/Einstiegspunkte prüfen, weitere Quellen nach Bezug.
2. Tatsächliche Architektur/Aufrufer abgleichen: `shared/games.ts`, `shared/roomCore.ts`, Spielmodule, `src/App.tsx`, Server und Handy-Host/Transport. Pfade sind Einstiegshilfen, keine unveränderliche Vorgabe.
3. Gemeinsame Regeln, Raumautorität, Regel-/Transporttrennung, Nachrichtenprüfung, Speicherung vor Bestätigung, Sitzungsschutz und gerätespezifische Sichten prüfen. Hosting, Offline/PWA und Speichergrenzen mit Implementierung vergleichen.
4. Inselparty-Regeln/Figurenfreigabe beachten. Soll-/Code-Widersprüche melden, Vorgaben nicht stillschweigend anpassen.
5. Veraltetes, Widersprüche und relevante undokumentierte Änderungen erfassen; nötigenfalls Git-Diff/Historie. Fehlende Erwähnung beweist keine fehlende Implementierung.

## Befehle und Belege

Befehle mit `package.json`, aufgerufenen Skripten, Workflows/Playwright vergleichen: Auslöser, Abhängigkeiten, Versionen, Build-Reihenfolge, Testprojekte. Zusammenarbeit/Deployment ebenfalls am aktuellen Stand prüfen; Einstellungen im Repository und aktivierte Einstellungen bei GitHub/Render unterscheiden.

Passende lokale Prüfungen nach AGENTS.md ausführen, vorher Nebenwirkungen prüfen. Voll-Audit: alle dokumentierten lokalen Prüfgruppen soweit ausführbar; Teil-Audit: Auswahl/Auslassungen benennen. Nach Client-/shared-Änderungen vor Browserprüfung bauen (`dist/`). Keine kostenpflichtigen Dienste, Deployments oder Installationen ohne Autorisierung.

Je Prüfung Befehl, Ergebnis und Grenzen erfassen. **Existiert**, **statisch geprüft** und **erfolgreich ausgeführt** unterscheiden. Fehlende Abhängigkeiten, Netz, Geräte oder Rechte als nicht verifiziert melden. CI-Erfolg nur mit Laufbeleg zum benannten Stand. Emulation beweist keine reale Handy-Leistung/Sensorfunktion.

Skills am tatsächlichen Ort/Katalog prüfen: SKILL.md, YAML `name`/`description`, Auslöser/Verweise. Plugin-Skills müssen nicht im Repo liegen. Verfügbare Validatoren/Erkennung nutzen; Format, Erkennung und Anwendung unterscheiden.

## Verbesserung und Abschluss

Probleme mit Testausgaben, CI, Historie oder Doku belegen; „wiederkehrend“ braucht mehrere unabhängige Belege. Je Befund Ursache, Datei, kleine Änderung und überprüfbaren Nutzen nennen; Vermutungen/offene Fragen kennzeichnen.

AGENTS.md auf dauerhafte Regeln, Einstiegspunkte und Prüfungen konzentrieren. Spezialwissen in vorhandene Dokumente/Skills verlinken, Dopplungen entfernen; verbindliche Anforderungen erhalten. Nach freigegebenen Änderungen finalen Diff prüfen.

Bericht knapp auf Deutsch direkt in der Antwort:

- Umfang: Modus, Branch/Commit, lokale Änderungen, Bereiche.
- Befunde priorisieren: hoch bei Sicherheit/Datenverlust/verbindlicher Qualität, mittel bei falscher Technik/Betrieb/Tests, niedrig bei Redundanz. Jeweils Datei/Zeile, Beleg, Auswirkung/Maßnahme.
- Nur tatsächliche Korrekturen und Verifikation nennen, sonst „nichts geändert“.
- Noch freigabepflichtige Regel-/Skillvorschläge getrennt aufführen.
- Ausgeführte, statisch geprüfte und nicht verifizierte Punkte samt Gründen nennen; Fakten/Annahmen/Planung unterscheiden.
