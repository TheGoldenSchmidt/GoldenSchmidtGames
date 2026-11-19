# Bereitstellung und Spielstände

## Wann ausgeliefert wird

[render.yaml](render.yaml) legt `branch: main` und `autoDeployTrigger: checksPass` fest: Render soll neue Commits erst nach erfolgreichen CI-Checks ausliefern. Anders als `commit` wartet diese Einstellung auf Prüfungen; ohne erkannte Checks startet kein Deployment ([Render-Dokumentation](https://render.com/docs/deploys#integrating-with-ci)).

Die [CI](.github/workflows/ci.yml) läuft daher bei **jedem** PR und Push auf `main`, auch für reine Doku. Schneller Job: Build, Regeln, Screens, PWA, Online, Produktion. Browserprüfungen nur auf ausdrücklichen Wunsch per **Actions → CI → Run workflow**, optional einzelne Specs. Keine automatischen Läufe für andere Branch-Pushes.

Diese Datei beschreibt die versionierte Konfiguration. Ob der bestehende Render-Service den Blueprint bereits synchronisiert hat und tatsächlich `main`/„After CI Checks Pass“ verwendet, muss der Betreiber im Dashboard prüfen. Der bisherige Modus war `commit`.

Deployments starten den Node-Prozess neu, können Wiederverbindungen/Cold Starts verursachen und bei flüchtigem Speicher Partien löschen. Lokale und Handy-gehostete Spielstände liegen auf den Geräten. Nicht während eines Spielabends mergen; [Zusammenarbeitsregeln](AGENTS.md#zusammenarbeit-und-auslieferung).

Installierte Apps übernehmen heruntergeladene Updates erst nach Bestätigung im Startmenü. Socket-/Zustandsänderungen abwärtskompatibel halten oder vor dem nächsten Spielabend alle Geräte aktualisieren. Laufende Spiele werden nicht automatisch neu geladen.

Im Repository ist keine separate Testumgebung eingerichtet. Vor Merge lokal bauen und mit `npm start` prüfen; Handys erreichen den Server im selben WLAN über dessen Netzwerkadresse/Port. Kamera, Installation und Service Worker brauchen einen sicheren Kontext (HTTPS; localhost nur auf demselben Gerät).

Rücknahme: voriges Deployment im Render-Dashboard wiederherstellen oder einen `git revert` als PR nach `main` bringen. Kein Force-Push. Bei geändertem Speicherformat zuvor Rückwärtskompatibilität prüfen.

## Handy-Hosting

1. Die aktuelle PWA auf **jedem Gerät** über HTTPS vollständig laden, möglichst installieren. Spielmodule, Worker und QR-Leser werden offline gespeichert.
2. Host: **Dieses Handy → Gerät verbinden**. Gast: **Raum beitreten → QR vom Handy-Host**. Gast scannt Einladung, Host scannt Antwort; mehrteilige Codes vollständig übertragen. Textcodes ersetzen die Kamera.
3. Host-Handy entsperrt in der App lassen. Im Hintergrund pausiert die Simulation. Nach vollständigem Neustart stellt dasselbe Gerät den Tisch wieder her; Gäste koppeln sich bei verlorener Verbindung erneut.

Kein Spielserver, Turso oder externer ICE-Server nötig. WebRTC braucht gegenseitige Erreichbarkeit im WLAN/Hotspot; Geräteisolation kann Verbindungen verhindern. Kamera benötigt ausdrückliche Freigabe. Für haltbare Spielstände keinen privaten Modus verwenden oder Browserdaten löschen. Kein automatischer Host-Gerätewechsel; Speicherfehler unterbrechen vor Bestätigung eines ungespeicherten Zugs.

## Node starten

Node.js ≥22 oder Docker, HTTPS, WebSockets und laufender Prozess erforderlich; `PORT` kommt vom Hoster. App und Socket.IO unter derselben Adresse. `/api/health` meldet HTTP 200 erst nach Speicherinitialisierung.

```bash
npm ci
npm run build
npm start
```

Docker mit dauerhaftem Volume:

```bash
docker build -t goldenschmidtgames .
docker run --rm -p 3000:3000 -e PORT=3000 -v gsg-spielstaende:/app/.gsg-data goldenschmidtgames
```

Statisches Hosting unterstützt lokale Spiele und Handy-Räume; Serverräume brauchen einen erreichbaren Socket.IO-Server.

## Render und optional Turso

Der Blueprint startet einen einzelnen Docker-Service im Free-Tarif ohne Datenbank-Zugangsdaten. Beide Hostingarten funktionieren. Auf [Render Free ist lokaler Speicher flüchtig](https://render.com/docs/free): Neustart, Einschlafen oder Deployment können Node-Partien löschen. Handy-Spielstände sind davon unabhängig.

Für dauerhafte Node-Spielstände optional:

1. Eigene Datenbank im [Turso-Free-Tarif](https://turso.tech/pricing) anlegen, kostenpflichtige Zusatznutzung ausschalten.
2. `TURSO_DATABASE_URL` und Schreib-Token `TURSO_AUTH_TOKEN` gemeinsam in Render setzen, ausschließlich serverseitig. Unvollständige/ungültige Konfiguration stoppt den Start; kein stiller Wechsel auf lokalen Speicher.
3. Deployen; Tabellen/Räume werden vor Verbindungsannahme geladen. Auf zwei Handys einen Zug ausführen, Dienst neu starten und Wiederherstellung prüfen.

Kostenfreiheit gilt innerhalb der aktuellen Freikontingente; Betreiber prüft Tarifgrenzen. Zugänge/Umgebungsvariablen für Render und Turso verwaltet nur der Betreiber.

## Speicherung und Wiederherstellung

- Ohne Turso: `.gsg-data/rooms.db`; eigener Pfad über `GSG_DATABASE_FILE`. Dauerhaftigkeit erfordert einen beständigen Datenträger.
- Datenbank enthält verdeckte Karten, Einsätze und Sitzungsschlüssel: niemals veröffentlichen oder einchecken.
- Bestätigte Züge und vollständigen Raumzustand gemeinsam speichern; gespeicherte Zugnummern erkennen Wiederholungen. Arenen sichern etwa jede Sekunde. Harte Abbrüche können unbestätigte Bewegungen zurücksetzen; Spieluhr pausiert.
- Bei Schreibfehler Verbindungen trennen, letzten gespeicherten Stand laden. Keine Bestätigung vor erfolgreicher Speicherung.
- Nur eine schreibende Instanz; beim Deployment übernimmt die neue das Schreibrecht.
- Bei erhaltenem Speicher: verwaiste Spielräume sieben Tage, leere Lobbys fünf Minuten wiederherstellbar.
- Nach Ende/Abbruch bleibt der Raum erhalten. **Zurück zur Lobby** (`room:lobby`) setzt ihn für alle zurück, Schlüssel bleiben gültig. Getrennte Mitglieder kehren zunächst zum Endbildschirm zurück, neue Gäste erst zur Lobby. Unterbrochene Lobby-Rückkehr wird wiederholt.
- In der Lobby gibt **Party verlassen** (`room:leave`) Platz/Schlüssel frei. Beim Node-Host übernimmt ein Mitspieler; das Host-Handy kann nur für alle beenden.
- **Party für alle beenden** (`room:close`, nur Host in Lobby) löscht den Raum. Seedbasierte Testräume schließen unmittelbar nach Spielende.

## Einrichtung durch den Betreiber

Stand 19. November 2026: GitHub meldet das Repository als **öffentlich**, `main` ungeschützt und automatisches Branch-Löschen aus. Die App ist weiterhin für eine private Freundesrunde gedacht.

Noch einzurichten/zu bestätigen:

- Einladung an `rreicherter` annehmen lassen und Schreibrecht prüfen; erst dann kann der CODEOWNERS-Eintrag Reviews zuweisen.
- `main` schützen: PR und erfolgreichen CI-Job `test` verlangen, Force-Push/Löschen verbieten. Merge-Freigabe bleibt bei TheGoldenSchmidt; CODEOWNERS allein erzwingt sie nicht.
- Automatisches Löschen gemergter Aufgabenbranches aktivieren. Alte Branches gemeinsam auf offene Arbeit prüfen, erst danach löschen.
- Render-Blueprint synchronisieren; Deploy-Branch `main` und CI-Abwarten im Dashboard bestätigen.

## Prüfgrenzen

`npm run test:restart` (Teil von `test:online`) prüft Neustart/Speicherfehler am echten Server, auch `RENDER=true` ohne Turso. Das beweist keine Haltbarkeit des Render-Free-Dateisystems.

`tests/browser/nearby.spec.ts` enthält Datenkanal-/Wiederherstellungsfälle. Android/iPhone im vorgesehenen Hotspot zusätzlich prüfen: fünf Personen, gleichzeitige Steuerung, QR-Kamera, App-Wechsel, Sperrbildschirm, Host-Neustart und Offline-Start. Browseremulation ersetzt diese Prüfung nicht.
