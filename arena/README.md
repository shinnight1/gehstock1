# Arena

Browserbasiertes Echtzeit-Arena-Kartenspiel: Lane-Pusher mit Deck und
Elixir, gebaut für iPad-Safari im Querformat. Läuft eigenständig unter
`/games/arena/` und lässt sich zusätzlich als Modul in eine bestehende
Seite einhängen.

Das Projekt liegt bewusst neben der Hideout-Seite und nicht darin: es
bringt eine eigene Toolchain (Vite, TypeScript, Vitest) mit, während
das Hideout mit esbuild und Vanilla-JS gebaut wird. `arena/` hat eigene
`node_modules` und rührt weder `src/`, `build.mjs` noch die
`package.json` der Hauptseite an.

## Loslegen

```bash
cd arena
npm install
```

### Client starten (Entwicklung)

```bash
npm run dev
```

Vite läuft mit `--host`, hört also auf allen Netzwerkschnittstellen.

### Vom iPad aus testen

```bash
npm run ip
```

Gibt die LAN-Adressen dieses Rechners aus, zum Beispiel
`http://192.168.178.42:5173/`. Diese Adresse im iPad-Safari öffnen —
iPad und Rechner müssen im selben WLAN sein.

Von Hand geht es unter Windows auch so:

```bash
ipconfig
```

Die Zeile *IPv4-Adresse* des aktiven WLAN-Adapters ist die gesuchte.
Meldet Safari „Server nicht gefunden", blockiert fast immer die
Windows-Firewall den Port — beim ersten Start von Node muss der Zugriff
für *private Netzwerke* erlaubt werden.

### Server starten

```bash
npm run dev:server
```

Der Server wird zu einer einzigen Datei gebündelt (`packages/server/bau/`)
und mit `node` gestartet. Gebündelt wird, weil `@arena/sim` und
`@arena/netz` mit `main` auf ihre TypeScript-Quellen zeigen — richtig für
Vite und Vitest, aber nichts, was Node direkt lesen kann.

```bash
npm run build --workspace @arena/server   # einmal bauen
npm run start --workspace @arena/server   # starten
```

Konfiguration über Umgebungsvariablen:

| Variable | Vorgabe | Bedeutung |
| --- | --- | --- |
| `ARENA_PORT` | `8081` | Port für HTTP **und** WebSocket |
| `ARENA_HOST` | `0.0.0.0` | Bindeadresse; `0.0.0.0` macht ihn im LAN erreichbar |

`GET /status` antwortet mit JSON und sagt, ob der Prozess lebt und wie
viele Räume offen sind. Für Healthchecks gedacht.

### Tests und Typen

```bash
npm test
npm run typecheck
```

### Produktionsbuild

```bash
npm run build
```

Ergebnis liegt in `packages/client/dist/` und ist vollständig relativ
verlinkt: der Ordner funktioniert unter `/`, unter `/games/arena/` und in
einem `iframe` gleichermaßen.

## Online gegen Freunde

Kein Zufallsgegner, keine Warteschlange. A macht einen Raum auf und
bekommt einen sechsstelligen Code, B tippt ihn ein, beide auf *Bereit*,
los.

**Der Server ist autoritativ, verschickt aber keinen Zustand.** Er
rechnet dieselbe Partie mit wie beide Clients, prüft jeden Zug mit
derselben Funktion (`pruefeZug`) und verteilt nur die freigegebenen
Befehle — ein Kartenzug sind ein paar Dutzend Byte, ein Zustandsbild
mehrere Kilobyte, zwanzigmal pro Sekunde. Möglich ist das, weil die
Simulation deterministisch ist: gleicher Aufbau plus gleiche
Befehlsfolge ergibt Tick für Tick dasselbe Ergebnis.

Damit ein Auseinanderlaufen nicht unbemerkt bleibt, schickt der Server
einmal pro Sekunde eine Prüfsumme seines Zustands mit. Passt sie beim
Client nicht, holt der einen Schnappschuss und setzt neu auf — der
Serverzustand gewinnt immer, nie umgekehrt. Die Begründung im Detail
steht in `packages/netz/src/protokoll.ts`.

Ein Zug wirkt vier Ticks (200 ms) nach dem Absenden, damit beide Seiten
ihn im selben Tick ausführen können. Solange er unterwegs ist, steht ein
gestrichelter Ring an der Stelle, an der die Einheit erscheinen wird.

**Was abgefangen ist**

| Fall | Verhalten |
| --- | --- |
| Verbindung reißt ab | Client verbindet neu und holt sich seinen Platz per Token zurück |
| Seite wird neu geladen | *Zurück in die Partie* im Freundesduell-Menü, 30 s lang |
| Länger als 30 s weg | Partie gilt als verloren, Gegenseite bekommt den Sieg |
| Gegner geht vor dem Anpfiff | Platz wird wieder frei, Raum bleibt offen |
| Zweimal derselbe Platz | Die ältere Leitung fliegt raus |
| Raum unbenutzt | Verfällt nach 15 Minuten |
| Server startet neu | Räume sind weg, Clients zeigen „Diesen Code gibt es nicht (mehr)" |
| Manipulierter Zug | Wird verworfen und protokolliert, erreicht die Gegenseite nie |

Freundesduelle zählen **nicht** auf die Trophäen — sonst wäre der
kürzeste Weg nach oben ein zweites Gerät. Den Roll für das gespielte
Match gibt es trotzdem.

### Serveradresse

Der Client rät sie nie. Drei Quellen, in dieser Reihenfolge:

1. `mount(element, { serverUrl })` — die Hub-Seite weiß, wo der Server steht
2. `?server=` in der Adresse — für den Test vom iPad, ohne neu zu bauen
3. zuletzt eingetippt (localStorage)

`http://` wird zu `ws://`, `https://` zu `wss://`. Fehlt das Schema, wird
`ws://` angenommen.

Im LAN reicht `ws://`. **Im Netz ist `wss://` Pflicht** — ein `ws://`
von einer `https://`-Seite aus blockiert jeder Browser.

### Deployment

TLS macht der Server nicht selbst; davor gehört ein Proxy, der HTTPS und
WSS abwickelt. Jeder Hoster bringt das mit, und eigene Zertifikate wären
eine zweite Baustelle mit eigenen Fehlern.

```bash
npm ci
npm run build --workspace @arena/server
ARENA_PORT=8081 node packages/server/bau/index.js
```

Der Prozess hält den Zustand nur im Arbeitsspeicher — ein Neustart
beendet alle laufenden Partien. Für ein Spiel dieser Größe ist das in
Ordnung; eine Datenbank wäre Aufwand für einen Fall, der selten eintritt
und dessen Folgen eine Minute dauern.

Beispiel für einen Caddy-Proxy vor dem Server:

```
arena.example.de {
  reverse_proxy localhost:8081
}
```

Der Client bekommt dann `wss://arena.example.de` als Serveradresse.

## Debug-Ansicht

`?debug=1` an die Adresse hängen. Dann erscheint oben links ein Feld mit
Bildrate, Pixeldichte und Canvasgröße:

```
http://192.168.178.42:5173/?debug=1
```

Fällt die Bildrate über drei Sekunden unter 50, senkt der Client die
Pixeldichte selbstständig — das Debug-Feld schreibt dann `(gesenkt)`
dahinter.

## Grafiken nachreichen

`packages/client/public/assets/`

| Datei | Wofür |
| --- | --- |
| `king.png` | König-Turm beider Seiten. Freigestelltes PNG mit Alpha, hochkant. Die gegnerische Seite wird automatisch rot getönt. |
| `cards/<id>.png` | Optionale Grafik pro Karte. `<id>` ist die Karten-id aus `packages/sim/src/data/cards.ts`. |

Fehlt eine Datei, zeichnet das Spiel eine Ersatzform aus
Canvas-Primitiven. Es bricht nichts, es sieht nur schlichter aus.
Nachlegen genügt, Neustart des Dev-Servers nicht nötig.

## Aufbau

```
arena/
  packages/
    sim/       Simulation. Kein DOM, kein Canvas, kein Math.random,
               keine Wall-Clock. Läuft im Browser wie in Node.
    meta/      Profil, Sammlung, Rolls, Trophäen. Kennt die Sim,
               aber nicht den Bildschirm.
    netz/      Das Protokoll. Hängt nur an der Sim und an keinem
               Laufzeit-Umfeld, damit es auf beiden Seiten liegen kann.
    client/    Rendering, Bedienung, Menüs. Vite + Canvas 2D.
    server/    Autoritativer Spielserver.
  tools/
    ip.mjs     Zeigt die LAN-Adressen für den iPad-Test.
    icons.mjs  Erzeugt die App-Icons. Schreibt PNG von Hand, damit
               das Projekt kein Bildwerkzeug braucht.
    turnier.ts Misst die Balance: Bot gegen Bot, Siegquote je Karte.
    bilder-wandeln.mjs
               Rechnet die Vorlagen aus bildquellen/ in auslieferbare
               WebP-Dateien um, im Browser mangels Bildwerkzeug.
```

Warum die Simulation streng getrennt liegt, steht in
`packages/sim/src/fixed.ts`: Client und Server müssen Bit für Bit
dasselbe rechnen, sonst laufen zwei Geräte auseinander.

## Einbetten

Als eigene Seite: den Inhalt von `packages/client/dist/` nach
`/games/arena/` legen und per `iframe` einbinden.

Direkt als Modul:

```js
import { mount, unmount } from '/games/arena/bundle/index.js';

mount(element, {
  serverUrl: 'wss://beispiel.tld/arena',
  onExit: () => history.back(),
});
```

`mount` legt einen eigenen Container in `element` an und setzt daran
höchstens `position: relative` — keine globalen CSS-Regeln, kein Zugriff
auf `document.body`. Im `iframe` meldet das Spiel zusätzlich per
`postMessage`:

```js
window.addEventListener('message', (e) => {
  if (e.data?.quelle === 'arena' && e.data.typ === 'arena:exit') schliessen();
});
```

## Stand

Meilenstein 1 bis 10. Spielbar gegen den Bot und gegen einen Freund über
das Netz, ablegbar auf dem Homescreen.

**Simulation** (`packages/sim`)
- Fester Takt von 20 Ticks, Festkomma-Mathematik, deterministischer RNG
- Alle 16 Karten mit Konter-Matrix, dazu eine nicht sammelbare
  Spawner-Einheit
- Einheiten, Gebäude, Zauber, Geschosse mit Vorhalten
- Wegfindung über die Brücken, weiche Kollision, Zielsuche mit Aggro
- Elixir mit doppeltem und dreifachem Tempo, Hand und Kartenzyklus
- Match-Ablauf mit Countdown, Verlängerung und Siegbedingungen
- Prüfsumme und Schnappschuss für den Onlinemodus

**Meta** (`packages/meta`)
- Profil im localStorage, Trophäen, Arenen, Match-Historie
- Rolls mit Raten, getrennten Pity-Zählern und Anfängerschutz
- Splitter, Kartenlevel, Deckprüfung

**Darstellung** (`packages/client`)
- Perspektivische Kamera, alles mit Höhe und Bodenschatten
- Rasen mit Mähmuster, Laufwegen und Grasnarbe, fließendes Wasser
- Türme mit Mauerwerk, Zinnen, Wimpeln, Risszuständen
- Einheiten mit Fußring in der Parteifarbe, Lebensbalken, Deploy-Ring,
  Trefferblitz; Flieger schweben über ihrem Schatten
- Partikel bei Tod und Turmfall, Erschütterung, Ton aus WebAudio
- Türme sacken beim Fallen zusammen und hinterlassen Schutt
- Getroffene Figuren zucken zurück
- HUD mit Kartenbildern, Vorschau auf die nächste Karte, Uhr,
  Turmstand, Elixirleiste — schrumpft mit, wenn die Höhe nicht reicht
- Karten spielen per Ziehen oder zweimal Tippen, mit Zonenanzeige
- Roll-Animation in vier Phasen, überspringbar

**Netz** (`packages/netz`, `packages/server`)
- Räume mit sechsstelligem Code, autoritativer Server
- Command-Relay statt Zustandsstrom, Prüfsumme gegen Abweichung
- Reconnect mit Token, 30-Sekunden-Fenster, Raumverfall

**153 Tests**, darunter Determinismus über drei parallel gerechnete
Zustände, Rollverteilung über 800 000 Ziehungen, Pity-Garantien,
Konter-Matrix und die Zugprüfung des Servers.

**Homescreen und Einbetten**
- `manifest.webmanifest` mit Icons aus `tools/icons.mjs`, Querformat,
  Vollbild ohne Safari-Leisten
- Bewusst **ohne** Service Worker: das Spiel braucht keinen Cache, und
  ein veralteter Worker wäre ein Fehler, den man schwer wieder loswird
- Im iframe geprüft: `arena:bereit` beim Laden, `arena:exit` beim
  Zurück-Knopf, kein Zugriff auf `document.body` der Elternseite

**Was fehlt**
- Kein Tutorial: das Spiel erklärt seine Regeln nirgends.
- Kein Rematch im selben Raum — nach jeder Online-Partie muss ein
  neuer Code her.
- Der Client ist kaum getestet: 40 Quelldateien, 3 Testdateien.

## Leistung: gemessen, nicht geraten

Der Auftrag nennt stabile 60 FPS bei 40 Einheiten. Gemessen mit
`?debug=1` bei 2360×1640 Pixeln — dieselbe Füllrate wie ein iPad bei
`devicePixelRatio` 2:

| Einheiten | FPS |
| --- | --- |
| 10 | 132 |
| 43 | 131 |
| 89 | 131 |
| 142 | 130 |

Der Renderer ist damit auf dem Testrechner weit vom Limit entfernt,
und ein Turm-Sprite-Cache wäre eine Optimierung ohne nachweisbares
Problem. **Das sagt nichts über das iPad** — dessen GPU ist eine
andere. Fällt der Schnitt dort drei Sekunden unter 50 FPS, senkt
`debug/leistung.ts` die Auflösung automatisch um eine Stufe; in der
Debug-Anzeige sinkt dann der Wert bei `dichte`.

## Balancing: gemessen

Bis Meilenstein 10 war die Balance eine Vermutung. Die einzelnen
Konter sind je durch einen Test abgesichert, aber ob ein ganzes Deck
gegen ein anderes fair steht, wusste niemand.

```bash
npm run turnier                       # Siegquote je Karte, 400 Partien
npm run turnier -- karten 2000        # genauer
npm run turnier -- karten 2000 300    # mit schwachem Bot
npm run turnier -- duell guenstig teuer
npm run turnier -- alle               # jedes benannte Deck gegen jedes
npm run turnier -- spiegel            # bevorzugt das Spiel eine Seite?
```

Gespielt wird Bot gegen Bot, beide mit demselben Profil — sonst misst
der Vergleich den Spieler und nicht die Karten. Eine volle Partie
braucht ohne Zeichnen rund 20 ms, zweitausend also gut vierzig
Sekunden.

**Zu jeder Quote gehört ihr Vertrauensband.** Ohne das verleitet die
Zahl zum Fehlschluss: 54 Prozent aus hundert Partien sind kein
Ungleichgewicht, sondern Rauschen. Das Werkzeug schreibt deshalb hinter
jede Zeile, ob der Abstand zu fünfzig überhaupt etwas bedeutet.

### Zwei Verzerrungen, die herausgerechnet sind

**Die Seite.** Spieler 0 greift von unten an, Spieler 1 von oben.
**Die Zugreihenfolge.** Handelt Bot 0 vor Bot 1, darf Bot 1 auf dessen
Zug bereits antworten.

Beides hebt sich auf, weil jedes Deck die Hälfte seiner Partien auf
jeder Seite spielt — und zwar mit demselben Startwert, sodass exakt
dasselbe Match einmal aus jeder Sitzordnung gerechnet wird. Der
Spiegelmodus prüft mit unabhängigen Startwerten nach, ob das Spiel
selbst eine Seite bevorzugt. Tut es nicht: alle vier Beispieldecks
liegen zwischen 49 und 52 Prozent.

### Was die Zahlen nicht sagen

Der Bot ist kein Mensch. Er hält kein Elixir für den nächsten Zyklus
zurück, baut keinen Doppelpush auf und blufft nicht. Ein Deck, das auf
solche Züge ausgelegt ist, sieht schlechter aus, als es ist.

Die Gegenprobe dafür ist der Trophäenwert: verschiebt sich die
Rangfolge zwischen einem schwachen und einem starken Bot, misst man den
Bot. Bleibt sie stehen, sind es die Karten.

### Drei Dinge, die die erste Messung ergeben hat

**Werte bewegen sich in Stufen, nicht stufenlos.** Ein Seitenturm macht
90 Schaden je Schuss. Eine Ratte mit 110 wie mit 80 HP überlebt auf
Stufe 3 den ersten Schuss und lebt damit doppelt so lange — gemessen
sind beide Werte praktisch gleich stark, erst unter 78,6 kippt es.
Ebenso bei den Speerwerferinnen: 100 Schaden gegen 200 HP heißt zwei
Schuss, 95 hieße drei. Balancieren heißt hier, die Schwelle zu finden,
nicht Prozente zu drehen.

**Kartenlevel verschieben diese Schwellen.** Dieselbe Ratte hat auf
Stufe 5 wieder 94 HP und überlebt den Turmschuss erneut. Eine Stufe ist
also kein gleichmäßiges Plus, sondern kann eine Karte qualitativ
ändern. Gemessen wird auf Stufe 3; für Stufe 5 gilt das Ergebnis nicht
unbesehen.

**Die Werte sind gekoppelt.** Als die Rattenschar schwächer wurde,
stieg die Quote der Speerwerferinnen von 60 auf 62, ohne dass sich an
ihnen etwas geändert hätte. Man kann Karten nicht einzeln festnageln —
nach jeder Änderung muss neu gemessen werden.

### Stand nach der ersten Runde

Drei Werte geändert, jeder mit der Messung begründet und im Katalog
kommentiert: Speerwerferinnen von 3 auf 4 Elixir und Reichweite 5000 →
4200, Rattenschar 110 → 72 HP.

| | vorher | nachher |
| --- | --- | --- |
| stärkste Karte | Speerwerferinnen 63,3 % | Hundemeute 56,3 % |
| schwächste Karte | Frostschleier 43,1 % | Frostschleier 41,8 % |
| Spanne | 20,2 Punkte | 14,5 Punkte |

Der einzelne Ausreißer ist weg; oben steht jetzt ein Feld um 55 statt
einer Karte bei 63. Die **mittlere** Abweichung hat sich dagegen kaum
bewegt (3,5 → 3,3 Punkte) — die Spreizung ist enger, aber nicht eng.

Offen und bewusst nicht angefasst: **Frostschleier** bei 42 Prozent.
Ein reiner Verlangsamungszauber ist das, was ein Bot am schlechtesten
spielt — hier traue ich der Zahl am wenigsten und würde erst nach
echten Partien drehen.

### Wie die Optik gebaut ist

Der Untergrund wird zweimal gebacken (Rasen unten, Bauwerke oben) und
danach nur noch kopiert. Dazwischen läuft das animierte Wasser. Kein
`shadowBlur`, kein `filter`, kein `backdrop-filter` — alles davon
kostet auf iOS-Safari pro Aufruf, und zwar deutlich. Schatten kommen
aus einem vorgerenderten Sprite, das nur skaliert kopiert wird.

Alle Formen mit Volumen entstehen aus drei Bausteinen in
`render/perspektive.ts`: Bodenfläche, Bodenellipse, Quader. Wer etwas
Neues in die Arena stellt, nimmt diese drei — dann stimmt die
Perspektive automatisch.
