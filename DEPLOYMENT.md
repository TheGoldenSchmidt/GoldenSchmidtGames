# GoldenSchmidtGames über einen Link bereitstellen

Die Anwendung bietet zwei Raumtypen. Der bisherige Node-Prozess liefert die PWA aus und hält die Socket.IO-Verbindungen für Serverräume offen. Beim Handy-Hosting liefert der Webhost nur die App-Dateien; Spielstand und Spielverkehr bleiben bei der Gruppe.

## Handy-Hosting

1. Auf jedem Gerät die aktuelle App über HTTPS vollständig laden und möglichst installieren, solange Internet vorhanden ist. Die PWA speichert auch Worker, QR-Leser und Spielmodule offline.
2. Alle Geräte mit demselben WLAN oder Hotspot verbinden. Der Host wählt beim Erstellen **Dieses Handy** und spielt selbst mit. Für jeden Gast **Gerät verbinden** öffnen; der Gast scannt die Einladung unter **Einem Handy-Host per QR beitreten**, anschließend scannt der Host die Antwort. Mehrteilige Codes vollständig durchblättern. Alternativ können die Textcodes übertragen werden.
3. Das Host-Handy bleibt in der App und entsperrt. Ein Wechsel in den Hintergrund pausiert die Simulation; nach der Rückkehr läuft sie weiter. Bei einem vollständigen App-Neustart stellt dasselbe Gerät den Tisch aus IndexedDB wieder her. Gäste benötigen nach verlorener Direktverbindung eine neue QR-Paarung. Es gibt keinen automatischen Wechsel auf ein anderes Host-Gerät.

Für diese Räume sind keine Turso-Zugangsdaten und kein laufender Spielserver erforderlich. `npm run build` erzeugt zusätzlich eine statisch auslieferbare PWA in `dist/`. Ein vorhandener Node-Webhost darf diese weiterhin ausliefern. Reines statisches Hosting ermöglicht ausschließlich Handy-Räume und lokale Spiele; die Node-Auswahl benötigt weiterhin einen erreichbaren Socket.IO-Server.

Die direkte WebRTC-Verbindung verwendet keine externen ICE-Server. Geräte müssen einander im lokalen Netz erreichen können; Gastnetze mit Geräteisolation und manche Hotspots verhindern das. Die Kamera benötigt HTTPS und ausdrückliche Freigabe. Bei gesperrter Kamera bleibt die Textcode-Eingabe verfügbar. Browserdaten nicht löschen und nicht im privaten Modus spielen, wenn der Tisch erhalten bleiben soll. Ein Gerätespeicherfehler führt zu einer Unterbrechung, bevor ein ungespeicherter Zug bestätigt wird.

`tests/browser/nearby.spec.ts` prüft echte Datenkanäle und Wiederherstellung mit Chromium. Vor praktischer Freigabe zusätzlich mit echten Android-/iPhone-Geräten im vorgesehenen Hotspot prüfen: fünf Personen, gleichzeitige Arena-Steuerung, Kamerapaarung, kurzzeitiger App-Wechsel, gesperrter Bildschirm, vollständiger Host-Neustart und Start ohne Internet. Browseremulation ersetzt diese Prüfung nicht.

## Anforderungen an den Hoster

- Node.js 22 oder neuer oder Docker
- öffentliche HTTPS-Adresse
- Unterstützung für WebSockets
- dauerhaft laufender Prozess; kein rein statisches Hosting
- Umgebungsvariable `PORT` wird vom Hoster vorgegeben

## Render Blueprint

Die [Render-Konfiguration](render.yaml) verwendet einen einzelnen Docker-Web-Service im Free-Tarif und startet **ohne Turso-Zugangsdaten**. Beide Hostingarten sind damit auswählbar. Der Node-Modus speichert dann lokal in `.gsg-data/rooms.db`. Dessen [lokales Dateisystem ist auf Render Free flüchtig](https://render.com/docs/free): Node-Partien können bei einem Neustart, Einschlafen oder Deployment verloren gehen. Der Server weist beim Start darauf hin. Das betrifft nicht die auf dem Host-Handy gespeicherten Partien.

Für das Testen beider Hostingarten sind keine Datenbankeinrichtung und keine Turso-Variablen erforderlich. Eine neue Blueprint-Installation fragt keine Zugangsdaten ab. Für Node-Spielstände, die auch den Verlust des Render-Dateisystems überstehen sollen, kann optional externer Speicher eingerichtet werden:

1. Im [Turso-Free-Tarif](https://turso.tech/pricing) eine eigene Datenbank für die Spielesammlung anlegen. Free auswählen und kostenpflichtige Zusatznutzung ausgeschaltet lassen.
2. Die Datenbankadresse und ein Schreib-Token für **diese** Datenbank im Render-Service unter **Environment** als `TURSO_DATABASE_URL` und `TURSO_AUTH_TOKEN` hinterlegen. Nur der Server benötigt sie. Beide Werte entweder gemeinsam setzen oder gemeinsam entfernen. Bei unvollständiger oder ungültiger Cloud-Konfiguration stoppt der Start; der Server wechselt dann nicht unbemerkt auf einen leeren lokalen Speicher.
3. Den Service deployen. Der Server legt die Tabellen an und lädt die Räume, bevor er Verbindungen annimmt. `/api/health` meldet HTTP 200, wenn der Server spielbereit ist. Für einen Handtest auf zwei Handys einen Zug durchführen, den Dienst neu starten und beide Spielansichten geöffnet lassen.

Die Kombination ist innerhalb der Freikontingente kostenfrei. Cold Starts können die Wiederverbindung verlängern. Bei einem Schreibfehler bestätigt der Server den Zug erst nach einem erfolgreichen Speichervorgang. Er trennt die Verbindungen und lädt den letzten gespeicherten Stand erneut. Für die erste Umstellung einen Zeitpunkt zwischen zwei Partien wählen: Die Vorgängerversion hielt ihre Räume ausschließlich im Arbeitsspeicher.

## Start ohne Docker

```bash
npm ci
npm run build
npm start
```

Der Server liefert App, Manifest, Service Worker und WebSocket-Endpunkt anschließend über dieselbe Adresse aus. `/api/health` kann als Health-Check verwendet werden.

## Start mit Docker

```bash
docker build -t goldenschmidtgames .
docker run --rm -p 3000:3000 -e PORT=3000 -v gsg-spielstaende:/app/.gsg-data goldenschmidtgames
```

Nach dem Veröffentlichen wird nur noch die HTTPS-Adresse geteilt. Android bietet die Installation direkt im Browser an. Auf dem iPhone wird die Seite in Safari über „Teilen“ und „Zum Home-Bildschirm“ installiert.

## Spielstände und Wiederherstellung

Ohne Cloud-Konfiguration verwendet der Server `.gsg-data/rooms.db`, auch auf Render. Über `GSG_DATABASE_FILE` lässt sich eine andere Datei angeben; sie übersteht den Verlust des Host-Dateisystems nur auf einem dauerhaften Datenträger. Die Datenbank enthält auch verdeckte Karten und Sitzungsschlüssel. Sie gehört weder ins Repository noch in öffentlich ausgelieferte Verzeichnisse.

Jeder bestätigte Spielzug wird gemeinsam mit dem vollständigen Raumzustand gespeichert, einschließlich verdeckter Einsätze und Gesamtpunkte bei Schlag den GoldenSchmidt. Wiederholte Zugnachrichten moderner Clients werden über die gespeicherte Zugnummer erkannt. Alle Modi mit 3D-Minispielen sichern zusätzlich während laufender Arenen ungefähr einmal pro Sekunde die Simulation. Bei einem harten Abbruch kann eine noch unbestätigte Bewegung bis zum letzten gespeicherten Stand zurückspringen. Die Spieluhr pausiert während der Unterbrechung. Mehrere Instanzen dürfen nicht gleichzeitig spielen: Beim Deployment übernimmt die neue Instanz das Schreibrecht.

Solange der Speicher erhalten bleibt, ist ein vollständig verwaister Spielraum sieben Tage wiederherstellbar, eine leere Lobby fünf Minuten. Abgeschlossene oder abgebrochene Inselpartys, Roll-It-Up-Partien und eigenständige Minispielmodi werden unmittelbar geschlossen. Die lokalen Neustart- und Speicherfehlertests laufen mit `npm run test:restart` und sind Teil von `npm run test:online`. Der Neustarttest startet den echten Server mit `RENDER=true` ohne Turso, prüft App-Auslieferung sowie Qwixx, Durak, Kribbeln, Inselparty und beide eigenständigen Minispielmodi und behält seine Testdatei über Prozessabbrüche hinweg. Er simuliert keinen dauerhaften Datenträger auf Render Free.
