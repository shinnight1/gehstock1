# Hideout mit der gemeinsamen GehstockMon-Spielerwelt

Diese vollständige Projektausgabe enthält die Website mit allen Spielen, die separate Arena, den Quellcode, alle vorhandenen Spielbilder und die Serverfunktionen. Die bereits gebaute Website liegt in `dist/`.

GehstockMon lädt nach der Hideout-Anmeldung automatisch dieselbe Spielerwelt für alle Spieler dieser Website. Kämpfe, Mons, Eier, Gold und Außenposten werden auf dem Server gespeichert. Jeder Spieler verwendet seinen eigenen Hideout-Zugang. Computergegner bleiben als Gebietsverteidiger vorhanden. Die frühere lokale Kampagne ist nicht mehr spielbar; bestehender Online-Fortschritt bleibt erhalten.

## Auf der bestehenden Website veröffentlichen

Die Seite liegt auf Vercel unter [gehstock1.vercel.app](https://gehstock1.vercel.app).

1. Die ZIP vollständig in einen Ordner entpacken.
2. Ein Terminal in diesem Ordner öffnen. Node.js 22.12 oder neuer muss installiert sein.
3. Einmalig anmelden und den Ordner mit dem bestehenden Projekt verbinden:

```sh
npm install -g vercel
vercel login
vercel link
```

4. Veröffentlichen:

```sh
vercel --prod
```

Bei `link` das bestehende Projekt `gehstock1` auswählen, damit dessen gespeicherte Spielerwelt weiterverwendet wird. Ein neues Vercel-Projekt hat eine eigene, leere Datenbank und damit eine eigene, neue Welt. Zugangsdaten und lokale Testspielstände sind nicht Bestandteil der ZIP.

Vercel baut selbst — der lokale Bauschritt entfällt. Was gebaut und ausgeliefert wird, steht in `vercel.json`; die beiden Serverfunktionen liegen unter `api/` und verweisen auf `netlify/functions/`. Die Website nur über `index.html` als Datei zu öffnen startet keinen Spielserver.

Geht etwas schief, holt `vercel rollback` die vorherige Veröffentlichung sofort zurück.

Die Spielstände liegen in einer Redis-Datenbank (Upstash), die im Vercel-Projekt unter **Storage** hängt. `netlify/functions/lib/speicher.mjs` entscheidet anhand der Umgebung, ob Redis oder die alten Netlify-Blobs benutzt werden; derselbe Code läuft dadurch auf beiden Plattformen.

Die alte Adresse `gehstock.netlify.app` bleibt vorerst als Rückweg stehen, hat aber ihre eigene, getrennte Spielerwelt. Dorthin wird nicht mehr veröffentlicht.

## Ein Übergabepaket bauen

```sh
npm run paket
```

Erzeugt `Hideout-Komplett-Online.zip` aus dem Stand, der auf GitHub liegt,
nicht aus dem eigenen Arbeitsverzeichnis. Zu zweit ist das der Unterschied,
der zählt: halbfertige Änderungen kommen nicht mit ins Paket. Gebaut wird in
einem temporären zweiten Arbeitsbaum, das eigene Arbeitsverzeichnis bleibt
unberührt.

Weichen die Lock-Dateien vom GitHub-Stand ab, bricht der Befehl ab, statt
neuen Quellcode gegen alte Abhängigkeiten zu bauen. Dann erst `git pull`,
`npm ci` und `npm ci --prefix arena`.

## Nach Änderungen erneut bauen

```sh
npm ci
npm ci --prefix arena
node tools/deploy-bauen.mjs
```

Für die Veröffentlichung ist das nicht nötig — Vercel führt denselben Build selbst aus, `vercel.json` trägt ihn. Der lokale Bau lohnt sich, wenn du das Ergebnis vorher ansehen willst.

## Lokal prüfen

```sh
node tools/serve.mjs 8792
```

Die Vorschau läuft dann unter `http://localhost:8792/#/spiel/gehstockmon` mit einem lokalen Testserver. Die produktive Spielerwelt liegt in der Datenbank des Vercel-Projekts. Weitere Geräte teilen nur dann dieselbe Welt, wenn sie dieselbe veröffentlichte Website benutzen.

```sh
node tools/test.mjs
node tools/gehstockmon-tests.mjs
node tools/gehstockmon-world-tests.mjs
```

Die übrigen Offline-Spiele bleiben verfügbar. GehstockMon selbst erfordert eine Verbindung zum Spielserver.
