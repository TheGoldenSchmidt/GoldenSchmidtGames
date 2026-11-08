# GoldenSchmidtGames über einen Link bereitstellen

Die Produktionsanwendung besteht aus einem gemeinsamen Node-Prozess. Er liefert die gebaute PWA aus und hält gleichzeitig die Socket.IO-Verbindungen für Online-Räume offen.

## Anforderungen an den Hoster

- Node.js 22 oder neuer oder Docker
- öffentliche HTTPS-Adresse
- Unterstützung für WebSockets
- dauerhaft laufender Prozess; kein rein statisches Hosting
- Umgebungsvariable `PORT` wird vom Hoster vorgegeben

## Render Blueprint

Die Datei `render.yaml` beschreibt bereits einen kostenlosen Docker-Web-Service in der Region Frankfurt. In Render genügt deshalb „New → Blueprint“ und die Auswahl dieses Repositorys. Build, Startbefehl und Health-Check werden automatisch übernommen.

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
docker run --rm -p 3000:3000 -e PORT=3000 goldenschmidtgames
```

Nach dem Veröffentlichen wird nur noch die HTTPS-Adresse geteilt. Android bietet die Installation direkt im Browser an. Auf dem iPhone wird die Seite in Safari über „Teilen“ und „Zum Home-Bildschirm“ installiert.

## Aktuelle Servergrenze

Räume werden momentan im Arbeitsspeicher gehalten. Für die private erste Version sollte deshalb genau eine Serverinstanz laufen. Ein Neustart beendet offene Räume. Vor einer Skalierung auf mehrere Instanzen benötigen wir einen gemeinsamen Raum- und Socket-Speicher.
