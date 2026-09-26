# Hideout mit der gemeinsamen GehstockMon-Spielerwelt

Diese vollständige Projektausgabe enthält die Website mit allen Spielen, die separate Arena, den Quellcode, alle vorhandenen Spielbilder und die Serverfunktionen. Die bereits gebaute Website liegt in `dist/`.

GehstockMon lädt nach der Hideout-Anmeldung automatisch dieselbe Spielerwelt für alle Spieler dieser Website. Kämpfe, Mons, Eier, Gold und Außenposten werden auf dem Server gespeichert. Jeder Spieler verwendet seinen eigenen Hideout-Zugang. Computergegner bleiben als Gebietsverteidiger vorhanden. Die frühere lokale Kampagne ist nicht mehr spielbar; bestehender Online-Fortschritt bleibt erhalten.

## Wo die Website läuft

Die Website läuft auf einem Android-Handy (Termux) unter
[gehstock.duckdns.org](https://gehstock.duckdns.org), die Spielerwelt liegt im
Redis auf demselben Handy. Wie das eingerichtet ist und wie man es auf einem
anderen Gerät neu aufsetzt: [docs/HANDY-SERVER.md](docs/HANDY-SERVER.md).
Zugangsdaten und Spielstände sind nicht Bestandteil der ZIP.

Eine Änderung kommt von selbst auf die Seite: pushen genügt, das Handy prüft und
spielt sie innerhalb weniger Minuten ein. Von Hand geht es mit

```sh
bash ~/gehstock1/tools/handy-aktualisieren.sh
```

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

Auf dem Handy erledigt das `tools/handy-aktualisieren.sh`. Lokal lohnt es sich, wenn du das Ergebnis vorher ansehen willst.

## Lokal prüfen

```sh
node tools/handy-server.mjs --dev 8792
```

Die Vorschau läuft dann unter `http://localhost:8792/#/spiel/gehstockmon` mit dem echten Servercode und einer leeren Testwelt im Arbeitsspeicher. Die echte Spielerwelt liegt nur auf dem Handy.

```sh
node tools/test.mjs
node tools/gehstockmon-tests.mjs
node tools/gehstockmon-world-tests.mjs
node tools/gehstockmon-adventure-tests.mjs
node tools/gehstockmon-expansion-tests.mjs
node tools/gehstockmon-egg-hours-tests.mjs
node tools/gehstockmon-dungeon-tests.mjs
node tools/gehstockmon-stadt-tests.mjs
node tools/gehstockmon-kampf-tests.mjs
node tools/gehstockmon-ausbau-tests.mjs
node tools/speicher-tests.mjs
node tools/relais-tests.mjs
npm run test:handy
npm test --prefix arena
npm run typecheck --prefix arena
```

Die übrigen Offline-Spiele bleiben verfügbar. GehstockMon selbst erfordert eine Verbindung zum Spielserver.

## GehstockMon: Dungeons und Runen

Auf der Weltkarte liegen sieben Dungeon-Eingänge. Am Eingang erstellt man eine
Gruppe oder tritt einer offenen Gruppe bei. Bis zu vier Spieler wählen je ein
eigenes Mon und bestätigen ihre Bereitschaft. Die Gruppenleitung startet den
gemeinsamen Bosskampf. Der Boss kündigt sein nächstes Ziel an; jede dritte Runde
trifft ein stärkerer Angriff alle. Fehlende Aktionen werden nach 45 Sekunden zu
Deckung, drei verpasste Runden beenden die Teilnahme. Ein erneuter Login stellt
die aktive Expedition wieder her. Lobbys laufen nach fünf Minuten, Kämpfe nach
20 Minuten ab.

Ein Sieg bringt jedem aktiven Teilnehmer zwei oder drei Runen der gewählten
Schwierigkeit. Nur Runen derselben Seltenheit verbessern ein eigenes Mon.
Die fünf Stufen kosten nacheinander 1, 2, 3, 4 und 5 Runen. KP und Angriff steigen
je Stufe um zwei Prozent, auf ganze Werte abgerundet und auf zehn Prozent begrenzt.
Tempo, Fähigkeiten und Seltenheit ändern sich dadurch nicht. Die Verbesserungen
gelten in Dungeons, Arenen, Trainingskämpfen und der gespeicherten Verteidigung.
In der Developer-Testzone bleiben auch Dungeons und Runen vollständig flüchtig.

## Die Developer-Testzone

Admins öffnen sie im Spiel über *Spielerwelt → Developer-Testzone*. Sie läuft im
Arbeitsspeicher des Servers, alle Tester teilen sich dieselbe, und nach fünf
Minuten ohne Zugriff ist sie wieder leer. Die echte Spielerwelt bleibt dabei
unberührt — auch außerhalb der Öffnungszeiten.

Wer sie betritt, bekommt Ausrüstung zum Ausprobieren: **50 000 Gold**, die
Sammlung bis auf sieben Lücken — aus jeder Seltenheit fehlt genau eines — und
**drei Eier**, von denen zwei schon fertig ausgebrütet sind. Die Lücken und die
fertigen Eier haben einen Grund: Mit vollständiger Sammlung bringt ein Ei nur
noch Gold, und eine Stunde Brutzeit überlebt die Testzone nicht. So lassen sich
Brutplatz, Schlüpfen und die Chancenanzeige in derselben Sitzung durchspielen.
Weil jeder Tester Eier trägt, sind dort auch Überfälle möglich.

Was **nicht** in die Testzone geht: Geschenke aus dem Adminmenü. Der Reiter
*🎁 Geben* schreibt immer in die echte Spielerwelt und sagt das auch, solange
die Testzone offen ist.
