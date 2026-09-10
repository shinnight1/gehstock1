# Hideout mit der gemeinsamen GehstockMon-Spielerwelt

Diese vollständige Projektausgabe enthält die Website mit allen Spielen, die separate Arena, den Quellcode, alle vorhandenen Spielbilder und die Netlify-Serverfunktionen. Die bereits gebaute Website liegt in `dist/`.

GehstockMon lädt nach der Hideout-Anmeldung automatisch dieselbe Spielerwelt für alle Spieler dieser Website. Kämpfe, Mons, Eier, Gold und Außenposten werden auf dem Server gespeichert. Jeder Spieler verwendet seinen eigenen Hideout-Zugang. Computergegner bleiben als Gebietsverteidiger vorhanden. Die frühere lokale Kampagne ist nicht mehr spielbar; bestehender Online-Fortschritt bleibt erhalten.

## Auf der bestehenden Netlify-Website veröffentlichen

1. Die ZIP vollständig in einen Ordner entpacken.
2. Ein Terminal in diesem Ordner öffnen. Node.js 22.12 oder neuer muss installiert sein.
3. Die benötigten Pakete installieren und mit dem bestehenden Netlify-Projekt verbinden:

```sh
npm ci
npx netlify-cli login
npx netlify-cli link
```

4. Die mitgelieferte fertige Website **einschließlich Serverfunktionen** veröffentlichen:

```sh
npx netlify-cli deploy --prod --no-build --dir=dist --functions=netlify/functions
```

Bei `link` das bisherige Hideout-Projekt auswählen, damit dessen gespeicherte Online-Spielerwelt weiterverwendet wird. Ein neues Netlify-Projekt hat eine eigene, neue Welt. Zugangsdaten und lokale Testspielstände sind nicht Bestandteil der ZIP.

Die ZIP ist ein vollständiges Projektpaket. Netlify Drop veröffentlicht nur statische Dateien; für die gemeinsame Spielerwelt ist die Veröffentlichung der Funktionen notwendig. Die Website nur über `index.html` als Datei zu öffnen startet keinen Spielserver.

Die Befehle und Optionen entsprechen der [Netlify-CLI-Dokumentation](https://cli.netlify.com/commands/deploy/).

## Nach Änderungen erneut bauen

```sh
npm ci
npm ci --prefix arena
node tools/deploy-bauen.mjs
```

Bei Git-basierten Netlify-Deployments verwendet `netlify.toml` bereits den vollständigen Build für Hideout und Arena. Publish-Verzeichnis: `dist`; Functions-Verzeichnis: `netlify/functions`.

## Lokal prüfen

```sh
node tools/serve.mjs 8792
```

Die Vorschau läuft dann unter `http://localhost:8792/#/spiel/gehstockmon` mit einem lokalen Testserver. Die produktive Spielerwelt liegt weiterhin auf Netlify. Weitere Geräte teilen nur dann dieselbe Welt, wenn sie dieselbe veröffentlichte Website benutzen.

```sh
node tools/test.mjs
node tools/gehstockmon-tests.mjs
node tools/gehstockmon-world-tests.mjs
```

Die übrigen Offline-Spiele bleiben verfügbar. GehstockMon selbst erfordert eine Verbindung zum Spielserver.
