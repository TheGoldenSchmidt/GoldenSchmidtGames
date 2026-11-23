# Bereitstellung und Spielstände

## Wann ausgeliefert wird

[render.yaml](render.yaml) legt `branch: main` und `autoDeployTrigger: checksPass` fest: Render soll neue Commits erst nach erfolgreichen CI-Checks ausliefern. Anders als `commit` wartet diese Einstellung auf Prüfungen; ohne erkannte Checks startet kein Deployment ([Render-Dokumentation](https://render.com/docs/deploys#integrating-with-ci)).

Die [CI](.github/workflows/ci.yml) läuft daher bei **jedem** PR und Push auf `main`, auch für reine Doku. Schneller Job: Build, Regeln, Screens, PWA, Online, Produktion. Browserprüfungen nur auf ausdrücklichen Wunsch per **Actions → CI → Run workflow**, optional einzelne Specs. Keine automatischen Läufe für andere Branch-Pushes.

Diese Datei beschreibt die versionierte Konfiguration. Ob der bestehende Render-Service den Blueprint bereits synchronisiert hat und tatsächlich `main`/„After CI Checks Pass“ verwendet, muss der Betreiber im Dashboard prüfen. Der bisherige Modus war `commit`.

Deployments starten den Node-Prozess neu, können Wiederverbindungen/Cold Starts verursachen und bei flüchtigem Speicher Partien löschen. Lokale und Handy-gehostete Spielstände liegen auf den Geräten. Nicht während eines Spielabends mergen; [Zusammenarbeitsregeln](AGENTS.md#zusammenarbeit-und-auslieferung).

Installierte Apps übernehmen heruntergeladene Updates erst nach Bestätigung im Startmenü. Socket-/Zustandsänderungen abwärtskompatibel halten oder vor dem nächsten Spielabend alle Geräte aktualisieren. Laufende Spiele werden nicht automatisch neu geladen.

Live-Version: Admins und Entwickler sehen im Startmenü neben „Online“ den PR, der gerade live ist (z. B. „PR #48“). Der Server liest ihn einmal pro Start aus dem Commit-Titel auf `main`. Auf Render kommt der Titel über `RENDER_GIT_COMMIT` und die öffentliche GitHub-API, da der Docker-Build kein `.git` enthält; lokal kommt er aus `git log`. Ohne Antwort zeigt das Menü den kurzen Commit. `/api/health` liefert beides unter `build`. Ein installiertes Gerät mit noch nicht übernommenem Update zeigt also die Serverversion, nicht die eigene.

Eine separate Testumgebung ist noch nicht im Hosting eingerichtet. Einrichtung und Ablauf: [Zwischenstände testen](#zwischenstände-testen-ohne-main).

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

Unity-Spiele (ein gemeinsamer Build in `public/unity/spiele/`, [Unity-Minispiele](UnityGames.md)): Der Node-Server setzt nur für `/unity/` eine gelockerte CSP (`'wasm-unsafe-eval'`, `blob:`, `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`), liefert `.unityweb` mit `Content-Encoding: gzip` (Code als `application/wasm`) und cacht `Build/`-Dateien dauerhaft. Andere Hoster brauchen dieselben Header, sonst starten die Builds nicht. Die Builds werden mit Unity erzeugt und eingecheckt; Docker/Render bauen sie nicht.

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

## Konten, Rechte und Statistiken

Anmeldung mit Nutzername und Passwort, Registrierung ausschließlich mit einmaligem Einladungscode. Das Gastspiel bleibt verfügbar. Anzeigename, gewählte Figur und Spieltöne werden für angemeldete Personen serverseitig gespeichert und bei der nächsten Anmeldung beziehungsweise Rückkehr zur App auf der Startseite geladen.

Ersteinrichtung auf einem **beständigen Speicher** (auf Render Free: Turso einrichten):

1. Einen zufälligen Einladungscode erzeugen, beispielsweise lokal mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
2. Als serverseitige Umgebungsvariable `GSG_ADMIN_INVITE` setzen und den Dienst starten. Mindestens 32 Zeichen; niemals im Repository speichern.
3. In der App **Profil → Ich habe eine Einladung** wählen und damit das eigene Konto anlegen. Dieses erste Konto erhält Adminrechte. Der Code ist höchstens sieben Tage gültig und nur bei leerer Kontodatenbank nutzbar; nach Registrierung alle Bootstrap-Codes ungültig.
4. `GSG_ADMIN_INVITE` anschließend im Hosting entfernen. Im Konto unter **Einladungen & Rechte** Entwickler-/Spielereinladungen erstellen und privat weitergeben. Einladungen sind einmalig und sieben Tage gültig. Bestehende Nutzer zwischen Spieler und Entwickler umstellen; das Betreiberkonto bleibt Admin.

Admins verwalten Einladungen und Rollen. Entwickler und Admins dürfen den Proberaum öffnen; Spieler/Gäste sehen den Zugang nicht. Der Server prüft die aktuelle Rolle beim Öffnen erneut. Dafür ist eine Verbindung erforderlich; eine bereits geöffnete lokale Übungsinsel läuft offline weiter. Die übrigen lokalen Spiele und Handy-Räume bleiben offline nutzbar. Browsercode wird weiterhin als PWA ausgeliefert; die Zugangskontrolle macht dessen Quellcode nicht geheim. Rich’s Universe bleibt allgemein zugänglich.

Passwörter liegen als gesalzene scrypt-Hashes vor; zufällige Sitzungsschlüssel als SHA-256-Hashes. Das Sitzungscookie ist HttpOnly, SameSite=Strict und unter HTTPS Secure; Laufzeit 30 Tage. Anmeldung über HTTP nur auf localhost. Änderungen aus fremden Origins und übermäßige Anmeldeversuche werden abgewiesen. Abmelden entzieht diese Sitzung und trennt zugehörige Serververbindungen; andere angemeldete Geräte behalten ihre Sitzung. Eine Passwortänderung/-wiederherstellung ist derzeit noch nicht enthalten.

Gezählt werden seit Einführung der Funktion **abgeschlossene Online-Partien auf dem Node-Spielserver** für angemeldete Teilnehmende. Pro Spiel werden Partien und Siege angezeigt; keine nachträgliche Zuordnung alter Gastpartien. Gleichstände zählen für alle ausdrücklich ausgewiesenen Gewinner als Sieg. Bei Durak gewinnen die übrigen Teilnehmenden, falls ein Durak feststeht; andernfalls zählt nur die Partie. Abbrüche, lokale Spiele, Handy-Hosting und seedbasierte Bot-/Testpartien zählen nicht. Spielende und Statistik werden gemeinsam gespeichert; die Partiekennung verhindert Doppelzählung bei Wiederholung oder Wiederbeitritt.

Konten, Einladungen, Sitzungen und Ergebnisse liegen neben Räumen in derselben SQLite-/Turso-Datenbank (`gsg_accounts`, `gsg_invitations`, `gsg_sessions`, `gsg_results`). Auch Backups enthalten sensible Kontodaten. Ohne beständigen Speicher können Konten und Statistiken verloren gehen; die Login-Funktion allein ändert die Speichergrenzen des Hosters nicht.

## Zwischenstände testen ohne main

Empfehlung für eure kostenlose Freundesrunde: **ein separater Render-Testservice mit eigener HTTPS-Adresse**. Er verwendet das gleiche Repository und Dockerfile, aber den zu prüfenden Aufgabenbranch, beispielsweise `codex/login-und-rollen`. Der bestehende Live-Service bleibt auf `main`.

1. In Render einen zusätzlichen Webservice im Free-Tarif anlegen; Repository, Aufgabenbranch und vorhandenes Dockerfile wählen. Health Check: `/api/health`. Zunächst manuell deployen; der Testbranch muss vorher auf GitHub gepusht sein.
2. **Eigene Testdatenbank und eigenen Turso-Token** verwenden. Live-Zugangsdaten und Live-Umgebungsgruppen niemals übernehmen. Ohne Turso kann man mit flüchtigen Testkonten/-räumen prüfen. Für wiederverwendbare Testkonten eine getrennte Turso-Datenbank einrichten; eigenes `GSG_ADMIN_INVITE` verwenden.
3. Die neue `https://…onrender.com`-Adresse auf euren Handys öffnen. Alle Teilnehmenden einer Testpartie müssen dieselbe Testadresse verwenden. Konten, Räume und PWA-Daten der Live-Adresse bleiben getrennt.
4. Weitere Commits auf denselben Aufgabenbranch pushen und im Testservice ausliefern. Für einen anderen Zwischenstand den Branch **nur am Testservice** wechseln. Für den Merge nach `main` gelten die [Projektregeln](AGENTS.md#zusammenarbeit-und-auslieferung).

[Render Service Previews](https://render.com/docs/service-previews) können alternativ einzelne PRs mit eigener temporärer URL bereitstellen. Sie übernehmen zunächst auch die Umgebungsvariablen des Basisdienstes. Deshalb erst eine sichere Trennung der Datenbankkonfiguration vorbereiten; nicht einfach Vorschauen am Live-Service aktivieren. Der Raumserver erlaubt nur einen schreibenden Prozess pro Datenbank: Eine Vorschau mit Live-Datenbank könnte den Live-Server verdrängen. Vollständige [Preview Environments](https://render.com/docs/preview-environments) benötigen laut Render einen bezahlten Workspace-Tarif.

Kosten beachten: Free-Webservices teilen sich [750 Laufzeitstunden je Workspace und Monat](https://render.com/docs/free), zusätzlich gelten gemeinsame Build-/Bandbreitengrenzen. Den Testservice nur bei Bedarf betreiben; vor Einrichtung den angezeigten Tarif und Ausgabenlimits prüfen.

Im selben WLAN geht es auch lokal: Aufgabenbranch auschecken, `npm ci`, `npm run build`, `npm start`, dann am Handy `http://<PC-IP>:3001` öffnen. Der PC muss laufen und die Firewall den Port erlauben. Kamera, PWA-Installation, Service Worker und Kontoanmeldung brauchen am Handy HTTPS; für vollständige Handytests deshalb die separate HTTPS-Testadresse verwenden. `npm run preview` allein startet keinen Spiel-/Kontoserver.

## Einrichtung durch den Betreiber

Stand 19. November 2026: GitHub meldet das Repository als **öffentlich**, `main` ungeschützt und automatisches Branch-Löschen aus. Die App ist weiterhin für eine private Freundesrunde gedacht.

Rich (`rreicherter`) hat Schreibzugriff auf das Repository (geprüft am 20. November 2026).

Noch einzurichten/zu bestätigen:

- Branchschutz für `main` einrichten. PR und erfolgreichen CI-Job `test` verlangen, Force-Push und Löschen verbieten. Die Review-Einstellungen müssen Richs eigenständigen Merge gemäß den [Projektregeln](AGENTS.md#zusammenarbeit-und-auslieferung) zulassen.
- Automatisches Löschen gemergter Aufgabenbranches aktivieren. Alte Branches gemeinsam auf offene Arbeit prüfen, erst danach löschen.
- Render-Blueprint synchronisieren; Deploy-Branch `main` und CI-Abwarten im Dashboard bestätigen.

## Prüfgrenzen

`npm run test:restart` (Teil von `test:online`) prüft Neustart/Speicherfehler am echten Server, auch `RENDER=true` ohne Turso. Das beweist keine Haltbarkeit des Render-Free-Dateisystems.

`tests/browser/nearby.spec.ts` enthält Datenkanal-/Wiederherstellungsfälle. Android/iPhone im vorgesehenen Hotspot zusätzlich prüfen: fünf Personen, gleichzeitige Steuerung, QR-Kamera, App-Wechsel, Sperrbildschirm, Host-Neustart und Offline-Start. Browseremulation ersetzt diese Prüfung nicht.
