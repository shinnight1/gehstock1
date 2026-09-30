# Gehstock Ops

3D-Ego-Shooter für das Hideout: Team-Deathmatch drei gegen drei auf dem
„Übungsgelände Krähenfeld“. Ein Match endet nach fünf Minuten oder bei 30
Team-Punkten. Gebaut fürs iPad (10. Generation, Safari, quer), spielbar auch
am Rechner mit Maus und Tastatur. Zwei Arten zu spielen:

- **Online**: eine einzige Runde für alle, ohne Lobby und ohne Codes. Wer
  dazukommt, landet im Team mit weniger Menschen; freie Plätze spielen Bots.
  Höchstens drei gegen drei Menschen. Der Handy-Server rechnet das Match
  (siehe „Online-Match“ unten).
- **Bot-Lobby**: du und zwei Bots gegen drei Bots, komplett im Browser, ohne
  eine einzige Serveranfrage - läuft auch, wenn das Internet weg ist.

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
node tools/shooter-tests.mjs          # Simulation, einzeln
node tools/shooter-online-tests.mjs   # Online-Match über echte Verbindungen (localhost)
node tools/test.mjs                   # zusammen mit allen Hideout-Tests
node tools/shooter-lasttest.mjs 6 30  # Last einer vollen Online-Runde messen
```

`tools/test.mjs` bindet beide Testdateien ein - sie laufen damit auch auf dem
Handy vor jedem Update mit (siehe AGENTS.md). `npm run test:handy` prüft
zusätzlich, dass der Handy-Server das Online-Match nur unter `/api/ops` und
nur von der eigenen Seite annimmt.

Im echten Browser (optional, braucht Playwright, gehört nicht zu den Tests,
die ein Update freigeben):

```sh
npm run build
node tools/shooter-browsertest.mjs
```

Prüft Touch mit mehreren Fingern (Laufen, Umsehen und Feuern gleichzeitig,
Visierfeuer und Hüftfeuer, pointercancel, Fokusverlust, alle Knöpfe,
Hochformat), Maus und Tastatur (Pointer Lock, Pause, Escape, Tabelle),
Matchende und Neustart, dass der GPU-Speicher über viele Matches nicht wächst,
dass beim Verlassen alle Listener, der Ton und die Grafik abgebaut werden,
online mit zwei Browsern (Teams, gegenseitig sehen, Schüsse, Verlassen,
selbst neu verbinden nach einem Abriss, Hinweis, wenn der Server wegbleibt)
und offline (Seite aus dem Service Worker, Bot-Lobby ohne
Server).

## Steuerung

| iPad / Touch | Tastatur & Maus |
|---|---|
| linke Hälfte: Daumen aufsetzen und ziehen = laufen | W A S D |
| Stick weit nach oben = sprinten | Shift |
| rechte Hälfte wischen = umsehen | Maus (nach Klick ins Bild) |
| großer Feuerknopf rechts: halten = durchs Visier zielen und schießen (wie in CoD Mobile), die Schüsse gehen sofort auf den Visierpunkt; beim Halten weiter umsehen, loslassen = zurück | linke Maustaste (aus der Hüfte) |
| kleiner Knopf darüber: schießt aus der Hüfte, ohne Visier | |
| zweiter Feuerknopf links (wie der große) | |
| Visier (antippen schaltet, einstellbar auf Halten) | rechte Maustaste (halten) |
| ⟳ nachladen, ▲ springen, ▼ ducken, im Sprint ▼ = rutschen | R, Leertaste, C |
| Punktestand antippen = Tabelle, ‖ = Pause | Tab, Esc oder P |
| im Todesbildschirm Waffe fürs nächste Leben antippen | 1, 2, 3 |

Einstellungen (im Menü und in der Pause): Blick- und Mausempfindlichkeit,
Empfindlichkeit im Visier, dezente Zielhilfe (nur Touch), Visierknopf
umschalten/halten, Feuern mit Visier (aus: ein schlichter Feuerknopf wie
früher), linker Feuerknopf, Knopfgröße, Y-Achse, Qualität,
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
    netz/              Online: Protokoll (Gerät und Server) und Vorhersage auf dem Gerät
    karte/             Kartenbeschreibung (Quader, Deko, Spawns, Wege)
    darstellung/       three.js: Renderer, Welt, Figuren, Waffenmodell, Effekte, Texturen
    eingabe/           Tastatur/Maus, Touch, Zielhilfe, gemeinsamer Eingabezustand
    klang/             synthetisierte Geräusche (Web Audio)
    oberflaeche/       HUD, Menüs, Stylesheet
  server/              Online-Match im Handy-Server (Node, ohne Zusatzpaket)
    online.mjs         die eine Runde: Plätze, Teams, Takt, Rückspulen, Zustände
    websocket.mjs      WebSocket (RFC 6455, nur Serverseite)
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
- Auf Touch-Geräten ist die Pixeldichte zusätzlich gedeckelt (Niedrig 1,0,
  Mittel 1,25, Hoch 1,5) - das iPad hat 2, voll aufgelöst mit
  Kantenglättung wären das über 100 MB Bildspeicher.
- Alle Farbkleckse sind ein Instanz-Mesh (vorher bis zu 56 Zeichenaufrufe
  mehr, je länger das Match lief): im Gefecht 43 bis 51 Aufrufe pro Bild.

**Stabilität auf dem iPad.** Gefundene Risiken und was dagegen getan ist:

- Ton: höchstens 18 Stimmen gleichzeitig (10 für Geräusche anderer Figuren,
  je Geräusch höchstens 3); eigene Klänge und Rückmeldungen verdrängen
  notfalls die älteste Umgebungsstimme; jede Stimme wird nach dem Ende vom
  Audiographen getrennt. Vorher liefen im Gefecht über hundert Audioknoten
  gleichzeitig auf - auf iOS eine bekannte Absturzquelle.
- Bildspeicher: Größenereignisse (Safari meldet beim Ein- und Ausblenden
  seiner Leisten viele) werden gebündelt, neu angelegt wird nur bei
  wirklich geänderter Pixelgröße.
- Treffer-Animationen ohne erzwungenes Layout (Web Animations).
- Ein Fehler in einem Bild beendet das Spiel nicht mehr; erst fünf in drei
  Sekunden gelten als Absturz.
- Diagnose (Einstellungen → Diagnose): Fehler mit Ort und Aufrufstapel,
  zum Kopieren. Ein Herzschlag alle fünf Sekunden erkennt, wenn iOS die
  sichtbare Seite hart beendet hat (meist Speicher); beim nächsten Start
  sinkt dann die Grafikqualität um eine Stufe, mit Hinweis.

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
des Hideouts lädt Seite und Bundle schon beim Öffnen des Hideouts mit
(`EXTRAS` in `sw.js`, rund 180 KB komprimiert). Die Shooter-Seite meldet
denselben Service Worker an - wer den Shooter direkt öffnet, hat ihn danach
ebenfalls offline.

Die Offline-Einzeldatei bleibt unverändert: `build.mjs` lässt
`src/games/shooter.js` dort weg (`NUR_ONLINE_JS`), und der Shooter selbst ist
eine eigene Seite.

## Online-Match

Das bestehende Relais (`/api/room`, Abfragen im Sekundentakt, Zustand in
Redis) ist für einen Shooter ungeeignet und wurde dafür **nicht** schneller
gestellt. Das Online-Match ist ein eigener Weg:

- **WebSocket `/api/ops` im Handy-Server** (`shooter/server/`), ohne neues
  Paket. Caddy reicht WebSockets ohne Änderung durch. `GET /api/ops` sagt dem
  Menü, wie viele gerade spielen - einmal beim Öffnen, kein Dauerabfragen.
  Verbindungen von fremden Seiten (anderer `Origin`) werden abgewiesen.
- **Nichts geht über Redis.** Das Match lebt nur im Arbeitsspeicher. Ohne
  Spieler steht der Takt still; eine leere Runde wird nach zwei Minuten
  weggeworfen.
- **Eine Runde, drei gegen drei.** Wer beitritt, übernimmt den Platz eines
  Bots im Team mit weniger Menschen (bei Gleichstand im zurückliegenden).
  Der siebte Mensch bekommt „Runde voll“. Wer geht, wird wieder zum Bot. Nach
  jeder Runde (5 Minuten oder 30 Punkte) folgen zwölf Sekunden Auswertung,
  dann die nächste; stehen dann zwei Menschen mehr in einem Team, wechselt
  einer die Seite.
- **Der Server entscheidet.** Er rechnet dieselbe `Simulation` wie die
  Bot-Lobby (60 Schritte pro Sekunde). Geräte schicken nur Befehle (30
  Nachrichten pro Sekunde mit je zwei Befehlen), der Server schickt 20-mal
  pro Sekunde den Zustand: alle Figuren, die Meldungen seitdem und - nur für
  den Empfänger - den vollen Zustand seiner Figur.
- **Vorhersage auf dem Gerät.** Befehle eines Menschen rechnet der Server,
  sobald sie ankommen, mit derselben Funktion (`akteurSchritt`), mit der das
  Gerät seine Figur sofort vorhersagt. Befehle werden vor dem Senden gerundet
  und das Gerät rechnet mit genau diesen Werten; Rückstoß und Streuung hängen
  nur an der Nummer des Schusses. Darum laufen Gerät und Server Bit für Bit
  gleich - Korrekturen gibt es nur, wenn der Server wirklich anders
  entscheidet (etwa Tod), und sie klingen dann weich aus.
- **Andere Figuren** werden 100 ms hinter dem Server gezeigt und zwischen zwei
  Zuständen verschoben. Mit jedem Befehl geht mit, welchen Zeitpunkt man
  sieht; der Server rechnet Schüsse dort, wo der Schütze die Gegner gesehen
  hat - höchstens 250 ms zurück, und nur im selben Leben des Ziels.
- **Abgesichert**: Nachrichten höchstens 2 KB; im Schnitt 70 pro Sekunde,
  nach einem Funkloch dürfen bis zu 900 aufgestaute auf einmal kommen.
  Kaputte Nachrichten trennen nur den Absender. Mehr Befehle als Zeit
  vergangen ist verfallen (kein Speedhack, höchstens vier Sekunden Vorrat).
  Namen werden gesäubert und eindeutig gemacht. Ein Fehler beim Rechnen
  eines Befehls wird gemeldet und übersprungen, ein Fehler in der Runde
  setzt nur die Runde neu auf, nie den Server.
- **Abbrüche überstehen.** Reißt die Leitung (Funkloch, WLAN-Wechsel,
  iPad kurz im Hintergrund, Server-Neustart nach einem Update), bleibt man
  im Spiel und das Gerät verbindet selbst neu: nach 0,4, 1, 2, 3 … 10
  Sekunden, zusammen rund 40 Sekunden, erst dann heißt es „Verbindung weg“.
  Kommt 7 Sekunden lang nichts an, gilt die Leitung als tot, auch wenn der
  Browser nichts meldet. Gezählt wird dabei nur, solange die Seite läuft.
  Der Server hält den Platz samt Punkten eine Minute frei (ein Bot spielt
  ihn so lange); das Gerät bekommt dafür beim Beitreten einen Schlüssel.
  Hängt die alte Leitung noch halb offen, weicht sie der neuen. Wer über
  „Online verlassen“ geht, gibt den Platz sofort frei.
- **Jeder Push auf `main` startet den Server neu** (Update auf dem Handy,
  einige Sekunden). Die Runde beginnt dann neu, die Geräte verbinden sich
  selbst wieder und spielen als neue Teilnehmer weiter.
- **Name** kommt aus dem Hideout mit (Anker `#name=` beim Öffnen der Kachel)
  und lässt sich im Menü ändern.

Gemessen mit `node tools/shooter-lasttest.mjs` im Linux-Container (Xeon
2,1 GHz, Node 22): sechs Menschen 4,8 % eines Kerns, ein Mensch mit fünf Bots
5,6 %; ein Schritt im Mittel 0,13 bis 0,29 ms; rund 10 KB/s zu jedem Gerät.
**Auf dem Galaxy A25 ist das noch nicht gemessen** - geschätzt das Zwei- bis
Vierfache, also rund 10 bis 20 % eines Kerns, solange online gespielt wird.
Auf dem Handy messen: `node tools/shooter-lasttest.mjs 6 60` (eigener Server
auf freiem Port, die echte Runde bleibt unberührt).

## Bekannte Grenzen

- 60 fps auf dem iPad 10 sind nicht auf dem Gerät gemessen (keine GPU im
  Container); Touch und Mehrfinger sind im Browser mit Touch-Emulation
  getestet, nicht auf echter Hardware. Die Absturzursachen oben sind aus
  Code und Messungen in Chromium abgeleitet - ob sie die Abstürze auf dem
  iPad erklären, zeigt erst das Gerät (Einstellungen → Diagnose).
- Nur eine Karte, ein Modus, drei Waffen, kein Waffenwechsel im Leben
  (gewählt wird im Menü oder im Todesbildschirm fürs nächste Leben).
- Bots springen nur, um sich zu befreien; auf Kisten klettern sie nicht.
- Offline gibt es den Shooter nur, wenn das Hideout (oder der Shooter) vorher
  einmal online geöffnet wurde (Service Worker).
- Zugangsregeln (Wartung, Kreis, Sperren) greifen wie bei der Arena an der
  Kachel; wer die Adresse `/games/shooter/` direkt aufruft, umgeht sie. Das
  gilt auch online: der Server kennt die Anmeldung des Hideouts nicht (sie
  wird nur im Browser geprüft), der Name im Match ist also nicht
  überprüft.
- Online ist nur mit Test-Clients über localhost und zwei Browsern auf einem
  Rechner getestet - nicht mit mehreren echten Geräten über das Internet.
  Ping, Rückspulen und Vorhersage sind für normale Heim- und Mobilnetze
  ausgelegt (bis etwa 150 ms); darüber trifft man spürbar schlechter.
- Pausieren hält online nichts an: die eigene Figur steht dann einfach.
- Nach einem Update mit geändertem Protokoll (zuletzt Version 2:
  Schlüssel zum Wiederverbinden) bekommen Geräte mit altem Stand „Neue
  Version – bitte neu laden“.
- Neuverbinden, Funklöcher (1,5 s, 4 s, 10 s) und Server-Neustarts sind mit
  drei Browsern hinter einer künstlich verzögerten Leitung (55 ± 35 ms)
  getestet, nicht auf echten iPads im Mobilfunk. Wie iOS offene
  Verbindungen im Hintergrund behandelt, zeigt erst das Gerät.
