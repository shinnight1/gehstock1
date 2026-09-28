# Gehstock Ops

3D-Ego-Shooter für das Hideout: Team-Deathmatch, du und zwei verbündete Bots
gegen drei gegnerische Bots, auf dem „Übungsgelände Krähenfeld“. Ein Match
endet nach fünf Minuten oder bei 30 Team-Punkten. Läuft komplett im Browser,
ohne Serveranfragen während des Spiels. Gebaut fürs iPad (10. Generation,
Safari, quer), spielbar auch am Rechner mit Maus und Tastatur.

Ausgeliefert wird das Spiel als eigene Seite unter `/games/shooter/`. Die
Kachel im Hub steht in `src/games/shooter.js`; Code und Grafik lädt der
Browser erst, wenn jemand die Kachel öffnet.

## Starten

```sh
npm run build        # baut Hideout und Shooter (dist/, dist/games/shooter/)
npm run dev          # http://localhost:8787/games/shooter/
```

Nur den Shooter neu bauen (etwa während man an ihm arbeitet):

```sh
node shooter/bauen.mjs
```

Tests der Simulation (ohne Browser, deterministisch, rund zwei Sekunden):

```sh
node tools/shooter-tests.mjs   # einzeln
node tools/test.mjs            # zusammen mit allen Hideout-Tests
```

`tools/test.mjs` bindet die Shooter-Tests ein - sie laufen damit auch auf dem
Handy vor jedem Update mit (siehe AGENTS.md).

## Steuerung

| iPad / Touch | Tastatur & Maus |
|---|---|
| linke Hälfte: Daumen aufsetzen und ziehen = laufen | W A S D |
| Stick weit nach oben = sprinten | Shift |
| rechte Hälfte wischen = umsehen | Maus (nach Klick ins Bild) |
| Feuerknopf rechts (beim Halten weiter umsehen), zweiter Feuerknopf links | linke Maustaste |
| Visier (antippen schaltet, einstellbar auf Halten) | rechte Maustaste (halten) |
| ⟳ nachladen, ▲ springen, ▼ ducken, im Sprint ▼ = rutschen | R, Leertaste, C |
| Punktestand antippen = Tabelle, ‖ = Pause | Tab, Esc oder P |
| im Todesbildschirm Waffe fürs nächste Leben antippen | 1, 2, 3 |

Einstellungen (im Menü und in der Pause): Blick- und Mausempfindlichkeit,
Empfindlichkeit im Visier, dezente Zielhilfe (nur Touch), Visierknopf
umschalten/halten, linker Feuerknopf, Knopfgröße, Y-Achse, Qualität,
dynamische Auflösung, Sichtfeld, Bildrate anzeigen, Lautstärke. Gespeichert
wird unter eigenen Schlüsseln (`gehstock-ops:…`) - die Spielstände der
Hideout-Seite fasst der Shooter nicht an.

## Aufbau

```
shooter/
  bauen.mjs            esbuild-Lauf, schreibt nach <dist>/games/shooter/
  index.html           Seite mit Ladebildschirm und Ladewächter
  src/
    konfig.js          ALLE Spielwerte: Bewegung, Leben, Match, Waffen, Bot-Stufen, Qualität
    main.js, app.js    Einstieg und Ablauf (Menü, Spiel, Pause, Auswertung, Aufräumen)
    einstellungen.js   Einstellungen und Statistik (localStorage)
    sim/               Simulation - kein DOM, kein three.js, läuft auch in Node
      befehl.js        Befehl je Figur und Schritt (Blick, Laufen, Tasten)
      simulation.js    Match, Spawns, Schüsse, Schaden, Meldungen
      bewegung.js      Laufen, Sprinten, Springen, Ducken, Rutschen, Stufen
      welt.js          Kollisionswelt aus Quadern, Strahltest
      waffen.js        Magazin, Nachladen, Feuerrate, Streuung, Rückstoß
      treffer.js       Trefferzonen (Kopf, Rumpf, Beine), Schadensabfall
      navigation.js    Navigationsraster (0,5 m), A*, Pfadglättung
      bots.js          Bot-KI
      mathe.js         Winkel, Kegelstreuung, geseedeter Zufall
    karte/             Kartenbeschreibung (Quader, Deko, Spawns, Wege)
    darstellung/       three.js: Renderer, Welt, Figuren, Waffenmodell, Effekte, Texturen
    eingabe/           Tastatur/Maus, Touch, Zielhilfe, gemeinsamer Eingabezustand
    klang/             synthetisierte Geräusche (Web Audio)
    oberflaeche/       HUD, Menüs, Stylesheet
```

**Trennung von Eingabe, Simulation und Darstellung.** Die Eingabe füllt pro
Simulationsschritt einen `Befehl` (Blickwinkel, Laufrichtung, Tasten als
Bitmaske). Bots erzeugen denselben Befehl aus ihrer KI. Die Simulation rechnet
in festen Schritten von 1/60 s - Bewegung und Feuerrate hängen dadurch nicht
von der Bildrate ab - und meldet, was passiert ist (`schuss`, `treffer`,
`abschuss`, `schritt` …). Darstellung, Ton und HUD lesen nur Zustand und
Meldungen; zwischen zwei Schritten wird weich interpoliert, der eigene Blick
kommt ohne Verzögerung direkt aus der Eingabe.

**Kollision.** Die Welt besteht für die Simulation nur aus achsenparallelen
Quadern (rund 140). Bewegt wird Achse für Achse mit einem Millimeter Abstand
zu Hindernissen; kleine Kanten bis 0,45 m steigt man hinauf, Treppab bleibt
man am Boden. Schüsse sind Strahlen gegen dieselben Quader und gegen drei
Trefferzonen je Figur - was die Welt zuerst trifft, hält die Kugel auf.
Eigenbeschuss gibt es nicht; Kugeln gehen durch Verbündete hindurch.

**Bots.** Wahrnehmung zehnmal pro Sekunde (Sichtfeld, Sichtweite, echte
Sichtlinie auf Kopf oder Brust), Reaktionszeit und Zielfehler, der sich
abbaut, begrenzte Drehgeschwindigkeit, Salven mit Pausen, Nachladen, Hören
von Schüssen, Reaktion auf Treffer von hinten. Bewegung über das
Navigationsraster, das beim Laden aus den Quadern entsteht (Treppen und
Podest ergeben sich von selbst). Drei Stufen: Rekrut, Soldat, Veteran - alle
Werte in `konfig.js` unter `BOT_STUFEN`.

**Karte.** `karte/kraehenfeld.js`, beschrieben mit den Helfern aus
`karte/bauer.js`. Drei Wege (A Containerhof mit Nordgang als Flanke, B
Appellplatz mit erhöhtem Leitstand, C Werkhalle), verbunden über zwei Lücken
in der Trennmauer, zwei Hallentüren und den Vorplatz. Die Basen sind durch
Hesco-Wände gegen Sichtlinien geschützt, gespawnt wird dort, wo gerade kein
Gegner hinsieht, mit 2,5 s Schutz, der beim eigenen Schuss endet.

**Grafik.** Alle Texturen werden beim Start auf Canvas gemalt, alle
Geräusche per Web Audio synthetisiert - es gibt keine Bild- oder Tondateien,
keine Lizenzfragen und keine Laufzeitabhängigkeit von fremden Servern. Die
Welt ist je Material zu einer Geometrie verschmolzen, jede Figur besteht aus
rund acht Zeichenaufrufen. Im Spiel sind es insgesamt etwa 50 bis 100.

## Leistung

- Qualitätsstufen Niedrig / Mittel / Hoch: Pixeldichte 1,0 / 1,35 / 2,0
  (höchstens die des Geräts), Sonnenschatten aus / 1024 / 2048, Kanten-
  glättung nur auf Hoch. Auf Touch-Geräten ist Mittel voreingestellt.
- Dynamische Auflösung: liegt die mittlere Bildzeit über 19,5 ms, sinkt die
  Auflösung in Stufen bis auf 60 %; bleibt es fünf Sekunden flüssig, steigt
  sie wieder.
- Der Sonnenschatten wird nur einmal berechnet (die Welt steht still),
  Figuren haben weiche Fußschatten aus einem einzigen Instanz-Mesh.
- Pro Bild entstehen keine neuen Objekte: Meldungen, Effekte, Vektoren und
  Pfadspeicher kommen aus festen Vorräten.
- „Bildrate anzeigen“ in den Einstellungen zeigt fps, Bildzeit, aktuelle
  Pixeldichte und Zeichenaufrufe.

Gemessen (Linux-Container, Node 22): ein Simulationsschritt mit sechs
Figuren kostet rund 60 bis 70 µs, ein Strahltest wenige µs, eine Pfadsuche
quer über die Karte unter 2 ms. **Die 60 fps auf dem iPad sind ein Messziel,
kein belegter Wert** - im Container gibt es keine GPU. Auf dem Gerät messen:
Einstellungen → „Bildrate anzeigen“, ein Match auf Mittel spielen, bei Bedarf
Qualität oder Pixeldichte in `konfig.js` (`QUALITAET`) anpassen.

## Auslieferung

`build.mjs` ruft `shooterBauen()` auf und legt die Seite nach
`<dist>/games/shooter/` - auch für `HIDEOUT_DIST`, also beim Bauen auf dem
Handy neben der laufenden Seite. Neue Pakete braucht der Shooter nicht: er
nutzt `three` und `esbuild` aus der `package.json` des Hideouts. Die
Dateinamen tragen einen Prüfwert, `tools/handy-server.mjs` liefert
`games/shooter/bundle/` darum mit langer Cache-Dauer aus; der Service Worker
des Hideouts legt die Dateien beim ersten Öffnen ab.

Die Offline-Einzeldatei bleibt unverändert: `build.mjs` lässt
`src/games/shooter.js` dort weg (`NUR_ONLINE_JS`), und der Shooter selbst ist
eine eigene Seite. Offline ohne vorherigen Besuch gibt es den Shooter nicht.

## Mehrspieler: was dafür nötig wäre

Das bestehende Relais (`/api/room`, Abfragen im Sekundentakt, Zustand in
Redis) ist für einen Shooter ungeeignet und wird dafür **nicht** schneller
gestellt. Ein Mehrspieler-Modus bräuchte:

1. **Eigenen WebSocket-Endpunkt auf dem Handy-Server**, etwa `/api/ops`.
   `tools/handy-server.mjs` müsste dafür `upgrade`-Anfragen annehmen (Node
   kann das ohne Zusatzpaket, bequemer ist `ws`). Caddy reicht WebSockets
   ohne Änderung durch. Nichts davon geht über Redis: Matches leben nur im
   Arbeitsspeicher, gespeichert wird höchstens das Ergebnis am Ende.
2. **Server-autoritative Simulation.** Der Server rechnet dieselbe
   `Simulation` (sie kennt weder DOM noch three.js) mit 30 oder 60 Schritten
   pro Sekunde. Clients schicken nur `Befehl`e mit Folgenummer (rund 20 Byte,
   30-mal pro Sekunde); Treffer, Schaden und Punkte entscheidet allein der
   Server. Bots können Plätze füllen, die niemand belegt.
3. **Zustandsbilder (Snapshots)** 20-mal pro Sekunde: Position, Blick,
   Leben, Waffe, Tasten je Figur, dazu die Meldungen seit dem letzten Bild.
   Geschätzt 150 bis 250 Byte je Bild, also rund 4 KB/s je Client und
   25 KB/s für sechs Spieler - für das Handy im Heimnetz unkritisch (Schätzung,
   nicht gemessen).
4. **Vorhersage und Abgleich beim eigenen Spieler**: der Client simuliert
   seine Befehle sofort mit, merkt sie sich und spielt nach jedem
   Server-Bild die noch unbestätigten nach. Die Bewegung ist dafür bereits
   deterministisch (fester Schritt, geseedeter Zufall für die Streuung).
5. **Interpolation der anderen Figuren** mit rund 100 ms Puffer zwischen zwei
   Server-Bildern - die Darstellung interpoliert heute schon zwischen zwei
   Schritten, nur die Quelle würde der Puffer.
6. **Trefferprüfung mit Rückspulen (Lag Compensation)**: der Server hält die
   Trefferzonen der letzten rund 250 ms vor und prüft einen Schuss gegen die
   Lage, die der Schütze gesehen hat (Laufzeit plus Interpolationspuffer,
   gedeckelt). Sonst trifft man auf dem iPad im WLAN nie, was man sieht.
7. **Lastmessung auf dem Handy** vor dem Einschalten, analog zu
   `tools/handy-lasttest.mjs`: simulierte Clients, CPU je Match, Speicher,
   Latenz. Grobe Schätzung: ein Match mit sechs Figuren braucht auf dem
   Galaxy A25 wenige Prozent eines Kerns - das muss gemessen werden, bevor
   mehr als ein Match gleichzeitig laufen darf.
8. Oberfläche: Lobby, Beitreten per Code, Anzeige der Latenz, Umgang mit
   Verbindungsabbrüchen. Online-Schaltflächen gibt es erst, wenn das alles
   funktioniert.

## Bekannte Grenzen

- 60 fps auf dem iPad 10 sind nicht auf dem Gerät gemessen (keine GPU im
  Container); Touch und Mehrfinger sind im Browser mit Touch-Emulation
  getestet, nicht auf echter Hardware.
- Nur eine Karte, ein Modus, drei Waffen, kein Waffenwechsel im Leben
  (gewählt wird im Menü oder im Todesbildschirm fürs nächste Leben).
- Bots springen nur, um sich zu befreien; auf Kisten klettern sie nicht.
- Offline gibt es den Shooter nur, wenn er vorher einmal online geöffnet
  wurde (Service Worker des Hideouts).
- Zugangsregeln (Wartung, Kreis, Sperren) greifen wie bei der Arena an der
  Kachel; wer die Adresse `/games/shooter/` direkt aufruft, umgeht sie.
