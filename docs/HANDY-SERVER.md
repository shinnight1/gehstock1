# Hideout auf einem Android-Handy

Termux mit Node.js 22 oder neuer, npm und Git wird benoetigt. Die komplette
Website einschliesslich Arena wird auf dem Handy gebaut. Der Server verwendet
dieselben Produktionsfunktionen wie Netlify und dieselbe Upstash-Spielerwelt.
`tools/serve.mjs` bleibt eine separate lokale Entwicklungsvorschau.

Im geklonten Projekt:

```sh
git pull --ff-only
bash tools/handy-einrichten.sh https://DEINE-DATENBANK.upstash.io
```

Die URL muss der Production-Wert von `UPSTASH_REDIS_REST_URL` im aktuellen
Netlify-Projekt sein (bei aelteren Projekten `KV_REST_API_URL`). Den passenden
Production-Token waehrend der Abfrage einfuegen und Enter druecken; er wird nicht
angezeigt. Niemals den Token in den Startbefehl schreiben.

Der Ablauf prueft ausschliesslich lesend, ob bereits Profile und Spieler in
dieser Datenbank liegen. Er erstellt keine leere Ersatzwelt. Erst danach ersetzt
er die lokale Zugangdatei mit Modus 600 unter
`~/.config/gehstock1/server.env`. Das Repository enthaelt keine Zugangsdaten.
Alte Shell-Variablen werden beim Start durch diesen Zugang ersetzt.

Anschliessend werden Pakete und Website gebaut und mit dem vorhandenen
Redis-Sicherungsskript die Daten unter `~/.config/gehstock1/sicherungen/`
gesichert. Fehler beim Zugang, Build oder Backup brechen die Einrichtung ab.
Die Sicherung laeuft bei aktiver Website lesend; sie ist kein atomarer
Datenbanksnapshot. Es werden keine Backups zurueckgespielt und keine Spielstaende
migriert oder ueberschrieben. Die Verbindung bleibt an derselben Datenbank.

Danach auf dem Handy `http://localhost:8080` oeffnen. Bereits die Nutzung dieses
Servers greift auf die echte Spielerwelt zu. Die Dateien werden nur aus `dist/`
ausgeliefert. Zugangdatei, Sicherungen und Quellcode sind nicht Webinhalte.

Beenden mit CTRL+C. Erneut starten:

```sh
bash ~/start-gehstock1
```

Dieser Schritt richtet noch keinen oeffentlichen Zugang, HTTPS oder Autostart
nach einem Handy-Neustart ein. Der Node-Server bindet nur an 127.0.0.1. Fuer die
spaetere Auslieferung kann Caddy an `127.0.0.1:8080` weiterleiten. Android kann
Termux trotz Wake-Lock beenden; Akku-Einstellungen und Termux:Boot werden
gesondert eingerichtet. Upstash bleibt der Speicheranbieter mit seinen Limits.

Pruefung ohne echte Zugangsdaten oder Schreibzugriff auf die Spielerwelt:

```sh
node --test tools/handy-tests.mjs
bash -n tools/handy-einrichten.sh
```
