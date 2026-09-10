# Herr Gehstocks Hideout

**Aktuelle Ausgabe: GehstockMon ist ausschließlich online spielbar.** Beim Start wird direkt die gemeinsame Spielerwelt geladen. Die vollständige ZIP enthält Quellcode, Bilder, die gebaute Website einschließlich Arena und die Serverfunktionen. Die Anleitung für diese Ausgabe steht in [ONLINE-START.md](ONLINE-START.md). Ein reiner Drag-and-drop-Upload der statischen Website reicht für GehstockMon nicht aus.

Eine Spielesammlung für das iPad: 25 Spiele, drei ausgebaute Tycoons und
ein mitgeliefertes Fremdspiel.
Läuft als Webseite über Netlify. Viele Spiele funktionieren auch ohne Internet
auf dem **Home-Bildschirm** oder in der mitgelieferten HTML-Einzeldatei.
GehstockMon und Online-Mehrspieler benötigen den gemeinsamen Spielserver.

---

## Auf einen Blick

| | |
|---|---|
| Spiele | 29 (20 Basisspiele, 5 mit Online-Modus, 3 Tycoons, 1 eigene Seite) |
| Technik | reines JavaScript, kein Framework, keine Abhängigkeit im Spiel |
| Offline | Home-Bildschirm (iPad) oder eine einzelne HTML-Datei (Mac/PC/Android) |
| Online | Raum-Codes über eine Netlify-Funktion (nur für 5 Spiele) |
| Verbindung | eine je Gerät, trägt Spiel · Chat · Verwaltung · alles andere |
| Intern | Gruppenchat mit Bildern und Abstimmungen, Admin-Raum mit Protokoll, Bildschirme, Tarnung, Nachrichtendienst, Besprechungen |
| Werkzeug | Entwicklerkonsole mit Selbsttest und Laufzeitmessung (#/dev) |
| Zielgerät | iPad 10. Generation, Hoch- und Querformat |

---

## Veröffentlichen mit Netlify

### Weg 1: Ordner hochladen (am schnellsten)

1. `node build.mjs` ausführen — das erzeugt den Ordner `dist/`.
2. Auf [app.netlify.com/drop](https://app.netlify.com/drop) den Ordner **`dist`**
   ins Fenster ziehen.

Fertig. Die Seite ist sofort online.

> **Achtung — der Online-Mehrspieler läuft so nicht.** Beim Drag-and-drop wird
> nur `dist/` hochgeladen; `netlify/functions/room.mjs` bleibt zurück. Ein
> Raum-Code lässt sich dann nicht erstellen, weil `/api/room` keine Funktion
> findet und stattdessen eine HTML-Seite ausliefert. Das Hideout erkennt das
> und sagt es. Auch GehstockMon benötigt seine Funktion unter
> `netlify/functions/gehstockmon.mjs` und ist bei rein statischem Upload nicht spielbar.
>
> Für den Mehrspieler braucht es **Weg 2** — oder einmal die Netlify-CLI aus
> dem Projektordner heraus:
>
> ```bash
> npx netlify deploy --prod
> ```

### Weg 2: Mit Git verbinden (empfohlen)

1. Das Projekt in ein Git-Repository legen und zu GitHub schieben.
2. In Netlify **Add new site → Import an existing project** wählen und das
   Repository verbinden.
3. Netlify liest `netlify.toml` und weiß dann schon alles:

   | Einstellung | Wert |
   |---|---|
   | Build command | `npm ci --prefix arena && node tools/deploy-bauen.mjs` |
   | Publish directory | `dist` |
   | Functions directory | `netlify/functions` |

4. **Deploy site** drücken.

Nach dem ersten Deploy einmal in den Site-Einstellungen prüfen, dass
**Blobs** aktiviert ist (Netlify macht das normalerweise von selbst) — darüber
laufen die Online-Räume.

---

## Was wo liegt

```
build.mjs              Bündelt alles: dist/ für Netlify + Offline-Einzeldatei
netlify.toml           Build-Einstellungen und Kopfzeilen
netlify/functions/     room.mjs — das Relais: Räume, Chat, Verwaltung, alles
src/
  index.html           Gerüst (eine einzige Seite)
  styles/              Aussehen
  core/                Kern: Schleife, Eingabe, Zeichnen, Speicher, Router
                       relais.js     die eine Verbindung je Gerät
                       net.js        Spielräume darauf
                       verwaltung.js Profile, Sperren, Banne, BND-Freigaben
                       chat.js       Bretter: Text, Bilder, Abstimmungen
                       adminraum.js  Chat, Protokoll, Anträge, Bildschirme
                       protokoll.js  was passiert ist — nur anhängen
                       bnd.js        Lagezentrale, Anträge, Befragungen
                       spiegel.js    Bildschirme senden und ansehen
                       tarnung.js    der Deckel, der nach Schule aussieht
                       wache.js      setzt Sperren und Befehle durch
                       verhoer.js    Fehlversuche an der Tür, Verhöre
                       meeting.js    Besprechungen, Route, Stundenplan
                       flix.js       Gehstockflix: Vorspann, Regal, Abspieler
                       dev.js        Entwicklerkonsole
                       invariants.js Spielregeln als Prüfbedingungen
  data/                Wortlisten für Wörtle, Videoregal für Gehstockflix
  games/               25 Spiele plus die Kachel für Krisenstab
  tycoon/port/         Hafen-Tycoon
  tycoon/spy/          Geheimagenten-Tycoon
  tycoon/biz/          Wirtschafts-Tycoon
  extern/              fertige Fremdspiele, werden als eigene Seite kopiert
tools/
  serve.mjs            Entwicklungsserver mit nachgebautem Online-Relais
  test.mjs             Regel-Engines ohne Browser prüfen
  nojs.mjs             erzeugt den Dateien-Modus (Spiele ohne JavaScript)
dist/                  Ergebnis des Builds (nicht ins Git nötig)
```

---

## Befehle

```bash
node build.mjs
```
Baut alles neu. Prüft dabei die Syntax des gesamten Bundles und bricht ab,
wenn in der Offline-Datei irgendein externer Verweis auftaucht.

```bash
node tools/serve.mjs
```
Startet [http://localhost:8787](http://localhost:8787) mit einem nachgebauten
Online-Relais — so lässt sich der Mehrspieler auch ohne Netlify testen.

```bash
node tools/test.mjs
```
Prüft die Regel-Engines ohne Browser: Schach-Perft, Doppelkopf über 200 Runden,
Sudoku-Eindeutigkeit, Kartenerhalt bei Eins, alle drei Tycoons, Speichern/Laden.

**Selbsttest im Browser:** `…/index.html?selftest=1` startet jedes Spiel
unsichtbar, füttert es mit Eingaben, rechnet es durch und meldet Ausnahmen,
NaN im Zustand und Aufräumfehler. Funktioniert auch in der Offline-Datei.

Mit `&steps=20000` läuft derselbe Test deutlich länger — seltene Zustände (eine
volle Reihe, ein leergefressenes Labyrinth, die zwanzigste Welle) zeigen sich
erst nach einigen tausend Schritten.

**Invarianten** (`src/core/invariants.js`): Abstürze und NaN sind nur die halbe
Miete. Deshalb steht dort je Spiel, was im Zustand *immer* gelten muss — die
Schlange liegt nirgends dreifach, das Schiebepuzzle enthält jede Kachel genau
einmal, der Punktezähler im Labyrinth passt zur Zahl der Punkte auf dem Brett,
eine volle Tetris-Reihe bleibt nicht liegen, Solitär hat immer 52 Karten. Der
Selbsttest prüft das in acht Etappen je Spiel, nicht nur am Ende — ein Fehler,
der sich zwei Züge später von selbst wieder auflöst, fiele sonst nicht auf.

---

## Offline spielen

Es gibt zwei Wege, und welcher taugt, hängt vom Gerät ab. Für beide wird
**keine zusätzliche App** gebraucht.

### Auf dem iPad: Zum Home-Bildschirm

1. Die Seite einmal **in Safari** öffnen, solange Internet da ist.
2. Unten auf **Teilen** tippen — das Rechteck mit dem Pfeil nach oben.
3. **Zum Home-Bildschirm** wählen, oben rechts mit **Hinzufügen** bestätigen.
4. Ab jetzt über das neue Symbol starten.

Das läuft im Flugmodus, startet ohne Safari-Leiste und — der wichtige Punkt —
**speichert Bestwerte und Tycoon-Stände dauerhaft**. Möglich macht das der
Service-Worker aus dem Online-Build.

### Als Einzeldatei

Auf der Webseite oben rechts auf **Offline spielen** → **Datei herunterladen**.
Sie enthält alle 28 eingebauten Spiele, lädt nichts nach und braucht kein Netz.
(Krisenstab liegt als eigene Seite daneben und ist deshalb nicht enthalten.)

Auf **Mac, PC und Android** einfach im Browser öffnen (Doppelklick oder
Rechtsklick → *Öffnen mit*) — läuft sofort.

Auf dem **iPad** genügt ein Tipp in der Dateien-App: es erscheint der
**Dateien-Modus** mit 15 Spielen (siehe unten). Für alle 28 Spiele die Datei
stattdessen **gedrückt halten → „Öffnen mit" → HTML-Viewer**; eine solche App
gibt es kostenlos im App Store (nach *HTML Viewer* suchen).

---

## Der Dateien-Modus — Spiele ganz ohne JavaScript

Die Vorschau der iPadOS-Dateien-App rendert HTML und CSS und nimmt Tipps
entgegen, führt aber **kein JavaScript** aus. Das ist in iPadOS so festgelegt
und lässt sich aus der Datei heraus nicht ändern — auch mit keiner anderen
Programmiersprache, denn Browser führen ausschließlich JavaScript aus.

Deshalb steckt in der Offline-Datei ein zweiter, vollständig skriptfreier Teil.
Er erscheint automatisch, wenn keine Skripte laufen, und wird beim normalen
Start wieder aus dem Dokument entfernt.

| Spiel | Umfang |
|---|---|
| Hideout-Tycoon | 20 Ausbauten über 5 Stufen, Freischaltketten, vier Kennzahlen |
| Herr Gehstocks Keller | verzweigtes Abenteuer, 13 Szenen |
| Minensucher | 8×8, 10×10, 12×12 · Flaggen-Modus, Zähler |
| Nonogramm | 5×5, 8×8, 10×10 · logisch lösbar erzeugt |
| Sudoku | 4×4 und 6×6 · eindeutige Lösung, Zahlen-Stift |
| Memory | 12 Paare, Paartreffer werden erkannt |
| Labyrinth | 8×8 und 12×12 · echtes Laufen, kein Springen |
| Drei gewinnt | zu zweit, mit Siegerkennung |
| Quiz | 10 Fragen mit Auswertung |

Wie das geht — alles reines CSS:

- **Zustand** liegt in `<input type="checkbox|radio">`, **Eingabe** in `<label for>`
- **Logik** sind Geschwisterselektoren: `#a:checked ~ #b:checked ~ .ziel`.
  So entstehen Siegprüfungen (alle sicheren Felder aufgedeckt), Paartreffer und
  die Regel „ein falsches Feld nimmt den Sieg wieder weg" (`!important` schlägt
  die lange Positivkette)
- **Werkzeugwechsel** (Aufdecken/Flagge, Zahlen-Stift) läuft über gestapelte
  Labels, von denen jeweils nur eines `pointer-events` bekommt
- **Zähler** sind CSS-Counter, **Neustart** ist `<button type="reset">`
- Der **Tycoon** kommt ohne Rechnerei aus: CSS kann Geld nicht vergleichen,
  aber zählen und verzweigen. Die Wirtschaft steckt deshalb in der Struktur —
  was gebaut werden darf, hängt an dem, was schon steht. Besucher, Einnahmen,
  investierte Summe und Fortschritt laufen über vier Counter; die Anzeige steht
  im Dokument *hinter* dem Laden (ein Counter kennt nur, was vor ihm liegt) und
  wird per `order:-1` nach oben geholt
- Alle Rätsel werden in `tools/nojs.mjs` beim Bauen erzeugt — mitsamt
  Logik-Solver fürs Nonogramm und Eindeutigkeitsprüfung fürs Sudoku — und
  landen als fertiges CSS in der Datei. Zur Laufzeit wird nichts gerechnet.
- Ein Schutzwall (`#sg-nojs *{…}`) verhindert, dass das App-Stylesheet aus
  derselben Datei in den Dateien-Modus hineinregiert

**Zu den Spielständen:** unter `file://` erlaubt WebKit oft kein dauerhaftes
Speichern. Merkt das Hideout das, warnt es beim Start und in beiden Tycoons.
Über **Einstellungen → Spielstand-Code** lässt sich der ganze Fortschritt als
Text sichern und auf jedem Gerät wieder einspielen.

**Autosave in den Tycoons:** alle 20 Sekunden nach der Uhr (also auch bei
Pause), zusätzlich beim Verlassen und sobald iPadOS die Seite in den
Hintergrund schiebt (`visibilitychange`/`pagehide`) — das ist auf dem iPad der
letzte Moment, in dem noch geschrieben werden kann.

---

## Online mit Freunden

Fünf Spiele haben einen Online-Modus: **Vier gewinnt, Doppelkopf, Schach,
Dame und Eins.**

Im Spiel über *Modus wechseln* → **Online mit Raum-Code**. Eine Person erstellt
einen Raum und gibt den sechsstelligen Code weiter, die anderen treten damit bei.

So funktioniert es technisch: Netlify hostet nur statische Dateien, es gibt also
keinen dauerhaften Spielserver. Alle Online-Spiele hier sind rundenbasiert,
deshalb genügt ein winziges Relais. Der Server kennt **keine Spielregeln** — er
speichert nur die Liste der Züge und einen Zufallskern. Jeder Client spielt
dieselbe Liste durch dieselbe Regel-Engine und prüft jeden eingehenden Zug noch
einmal selbst. Das läuft über gewöhnliches HTTPS und funktioniert deshalb auch
in Schul-WLANs, in denen andere Verfahren blockiert sind.

### Eine Verbindung je Gerät

Früher hielt jedes iPad **drei** Anfragen gleichzeitig offen: eine fürs Spiel,
eine für den Chat, eine für die Verwaltung. Netlify lässt aber nur wenige
Funktionen parallel laufen — ab drei Leuten standen die Anfragen Schlange und
ein Zug brauchte Sekunden. Dazu kam ein Fehler, der noch schwerer wog: die
Warteschleife des Spiels **schrieb** den Raum zurück, um Anwesenheit zu merken.
Lief parallel ein Zug, überschrieb sie ihn. Der Zug war weg, und der Client
wartete auf eine Version, die nie kam.

Beides ist behoben. Es gibt jetzt genau **eine** offene Verbindung je Gerät
(`src/core/relais.js`), und sie trägt alles: Spielraum, Chatbretter,
Verwaltung, Anwesenheit, Bildschirme, Befehle. Gewartet wird über die Operation
`sync`; **Warten schreibt nichts mehr**.

| | |
|---|---|
| Warteschleife liest | ein einziges kleines Dokument (`welt`) — je Kanal nur eine Zahl |
| Große Dokumente | erst, wenn sich eine dieser Zahlen ändert |
| Schreibvorgänge | lesen · ändern · schreiben · **zurücklesen**; stimmt die eigene Marke nicht, von vorn — so geht kein Zug mehr verloren |
| Gemessene Zustellung | 3–40 ms lokal; über Netlify kommt die Laufzeit zum Blob-Speicher dazu |

Nebeneffekt: ein Drittel der Anfragen bedeutet auch ein Drittel des
Netlify-Kontingents. Beim kostenlosen Plan zählt vor allem die Laufzeit der
Funktionen — eine Dauerverbindung je Gerät statt drei verdreifacht die Zeit,
die ihr spielen könnt, bevor irgendetwas an eine Grenze stößt.

Ohne Netz bleiben für dieselben Spiele **Computergegner** und der **Modus zu
zweit am selben iPad**.

**Wenn das Erstellen eines Raum-Codes fehlschlägt:** Dann antwortet `/api/room`
mit einer HTML-Seite statt mit Daten — die Netlify-Funktion ist nicht
erreichbar. Zwei Ursachen kommen praktisch immer in Frage: `dist/` wurde per
Drag-and-drop hochgeladen (siehe oben), oder die Seite läuft lokal auf einem
gewöhnlichen Statik-Server. Zum lokalen Testen deshalb `node tools/serve.mjs`
benutzen — der bildet das Relais nach.

---

## Die Spiele

**Rätsel** — 2048 · Sudoku · Minensucher · Schiebepuzzle · Nonogramm · Rohre verbinden

**Arcade** — Tetris · Snake · Blockbrecher · Space Invaders · Asteroids · Labyrinth-Fresser

**Schnell & locker** — Flatterflug · Springer · Hüpf-Straße · Turmstapler · Bubble Shooter

**Karten & Brett** — Solitär · Memory · Wörtle · Vier gewinnt* · Doppelkopf* · Schach* · Dame* · Eins*

**Tycoon** — Hafen-Tycoon · Geheimagenten-Tycoon · Wirtschafts-Tycoon

**Geschichte** — Krisenstab 03:12†

<small>* mit Online-Modus &nbsp;·&nbsp; † eigene Seite, nicht in der Offline-Datei</small>

---

## Warum es so gebaut ist

Die Offline-Vorgabe bestimmt die ganze Bauweise. WebKit blockiert unter
`file://` Modul-Imports und Web-Worker und verweigert oft den Zugriff auf
`localStorage`. Deshalb:

- **kein Framework, keine ES-Module** — alles wird zu einem klassischen
  `<script>` gebündelt, online wie offline aus derselben Quelle
- **keine Bilder, keine Schriftdateien, keine Tondateien** — jede Grafik wird im
  Browser gezeichnet, jeder Ton aus Oszillatoren erzeugt
- **keine Web-Worker** — Schach-Suche und Rätselgeneratoren laufen in
  Zeitscheiben, damit die Oberfläche nie einfriert
- **Speicher mit Rückfallebene** — `localStorage` → `sessionStorage` →
  Arbeitsspeicher, plus Spielstand-Code zum Sichern

Für das iPad kommt dazu: fester Simulationstakt getrennt von der Bildrate,
Pixeldichte auf 2 gedeckelt, statische Ebenen einmal vorgerendert, keine
Allokationen in den Hot-Loops, `touch-action: none` und eigene Gestenerkennung
gegen Scroll-Wippen und Doppeltipp-Zoom.

---

## Mitgelieferte Fremdspiele

Alles unter `src/extern/` wird beim Bauen nach `dist/` kopiert und bekommt
dabei Zeichensatz, Bildschirmbreite und einen Rückweg ins Hideout ergänzt —
sonst bleibt die Datei unangetastet.

**Krisenstab 03:12** liegt dort. Das Spiel bringt React, JSX über Babel und
Tailwind von CDNs mit; die Offline-Einzeldatei duldet aber keinen einzigen
externen Verweis. Es läuft deshalb als eigene Seite, erscheint im Hub mit dem
Abzeichen *Eigene Seite* und wird in der Offline-Datei ausgeblendet
(`SG.list()` filtert Einträge mit `external`, sobald `SG.offline` gilt).

---

## Zugangscodes

Vor dem Hub steht eine Codeeingabe. Jeder Code ist eine Person: der Spielstand
hängt am Code, mehrere Leute können sich dasselbe iPad teilen, ohne sich die
Tycoons zu überschreiben.

| | |
|---|---|
| Aufbau | vier Ziffern, eingegeben auf einem Tastenfeld |
| Rollen | 🛡 Admin · 🔑 Innerer Kreis · 🎮 Spieler — ergibt sich aus dem Code |
| Erster Admin-Code | steht bei jedem `node build.mjs` in der Ausgabe |
| Speicher | `hgh:u:<CODE>:…` je Person, `hgh:…` gemeinsam |
| Vorrat | rund 100 gültige Codes von 10 000 (steht in der Bauausgabe) |
| Falscher Code | zehn Sekunden lang verdreht sich der Gehstock, gezeichnet |

Gültig ist ein Code, wenn sein Streuwert durch `RASTER` teilbar ist; daraus
ergibt sich auch die Rolle. Es gibt also keine Liste, die verteilt werden
müsste — jedes Gerät rechnet dieselbe Antwort aus, ohne neuen Build und ohne
Server.

> **Was das nicht ist.** Die Seite ist statisch; die Prüfung läuft im Browser
> des Besuchers. Wer den Quelltext liest, findet das Geheimnis in
> `src/core/auth.js` und kann sich eigene Codes ausrechnen. Bei vier Ziffern
> ist außerdem einer von 97 gültig — geraten braucht es im Schnitt rund fünfzig
> Versuche, bei je zehn Sekunden Sperre also gut zehn Minuten. Das ist eine Tür
> mit Schlüssel, kein Tresor. Ein einzelner Code lässt sich auch nicht
> nachträglich sperren — dafür bräuchte es einen Server. Um *alle* alten Codes
> ungültig zu machen: `GEHEIM` in `src/core/auth.js` ändern und neu bauen.

---

## Bilder

Alles in `src/assets/` (png, jpg, webp, gif) wird beim Bauen als Daten-URI
eingebettet und liegt danach unter `SG.assets.<name ohne endung>`. Damit bleibt
auch die Offline-Datei ohne externen Verweis. Es zählt gegen das Budget von
2048 kB — pro Bild unter 150 kB bleiben.

---

## Innerer Kreis — Gruppenchat

Wer die Rolle 🔑 *Innerer Kreis* oder 🛡 *Admin* hat, sieht oben rechts den
Kreis-Knopf und darüber einen Gruppenchat unter `#/kreis`.

Der Chat läuft über dieselbe Verbindung wie der Mehrspieler. Ein **Brett** ist
eine Liste von Nachrichten auf dem Relais; was darin steht, ist dem Server egal.
Deshalb reicht dieselbe Ansicht (`src/core/chat.js`) für alles: den Kreis, den
Admin-Raum, das Protokoll, die Anträge und eine BND-Befragung.

| Operation | Wirkung |
|---|---|
| `chat:post` | hängt eine Nachricht an ein Brett an |
| `chat:vote` | Stimme in einer Abstimmung, je Code eine |
| `chat:del` | Nachricht löschen (nur Admins) |
| `chat:patch` | einzelne Felder ändern — Antrag erledigt, Abstimmung geschlossen |
| `bild:put` / `bild:get` | Bilder, getrennt von der Nachricht |

Gespeichert werden die letzten 250 Nachrichten je Brett, jede mit Name, Rolle
und Zeitstempel. Es gibt keinen Ablauf wie bei den Spielräumen.

### Bilder

Der Knopf 🖼 links unten öffnet die Fotoauswahl. Das Bild wird **im Browser**
verkleinert, bevor irgendetwas hochgeht: einmal auf 1280 px (das Vollbild) und
einmal auf 240 px (die Vorschau in der Liste). Aus einem 1400 × 900-Foto werden
so rund 23 kB und 3 kB.

Beide liegen **einzeln** im Speicher, nicht in der Nachricht — sonst müsste die
Warteschleife bei jeder neuen Zeile das ganze Brett samt aller Bilder
übertragen. In der Liste erscheint die Vorschau, das große Bild erst beim
Antippen.

### Abstimmungen

Der Knopf 📊 öffnet den Baukasten: Frage, zwei bis acht Antworten, wahlweise
Mehrfachauswahl. Die Abstimmung erscheint als Karte im Chat, jeder tippt seine
Antwort an, die Balken wachsen bei allen sofort mit. Gezählt wird **je Code**,
nicht je Gerät — zweimal abstimmen geht also nicht. Wer die Abstimmung gestartet
hat, und jeder Admin, kann sie schließen; danach bleiben die Zahlen stehen.

### Löschen

Ein Admin hält eine Nachricht **gedrückt** (oder Rechtsklick am Rechner) und
bekommt *Löschen*. Verschwunden ist sie danach nicht ganz: an ihrer Stelle steht
„Nachricht von … wurde von … gelöscht". Eine Nachricht, die spurlos verschwindet,
sieht aus wie ein Fehler — und im Protokoll soll ja stehen, was weg ist. Genau
dort landet sie auch, mitsamt ihrem Text.

> **Zwei Grenzen.** Der Chat braucht das Relais: in der Offline-Datei gibt es
> ihn nicht, und auf einer Netlify-Seite ohne Funktion auch nicht — dort steht
> dann ein Hinweis statt des Chats. Und: der Server kennt keine Rollen. Er
> prüft nur, dass die Anfrage ankommt. Die Tür davor ist der Zugangscode; wer
> die Adresse des Relais kennt, könnte am Hideout vorbei schreiben.

---

## Adminverwaltung — auf allen Geräten dasselbe

Sperren, Wartung, Kreis-Spiele, Profile und die Ansage lagen früher nur im
Speicher des Geräts, auf dem sie gesetzt wurden. Eine Sperre wirkte damit genau
dort — und sonst nirgends. Jetzt liegt alles in **einem** Dokument auf dem
Relais (`src/core/verwaltung.js`):

| Operation | Wirkung |
|---|---|
| `verw:read` | liest das Dokument; mit `warten: true` hält sie offen, bis sich etwas ändert |
| `verw:write` | ersetzt das Dokument und zählt die Version hoch |

Jedes Gerät liest beim Start einmal und lauscht danach im Hintergrund. Setzt ein
Admin eine Sperre, ist sie auf den anderen Geräten in unter einer Sekunde da —
**ohne Neuladen**. Die Kachel wird durchgestrichen, der direkte Aufruf über die
Adresse ebenso abgewiesen.

Zwei Feinheiten, die in der Praxis wehtaten:

- Ein **leeres Relais** darf einen vorhandenen lokalen Stand nicht wegwischen.
  Trifft `verw:read` auf Version 0, während lokal schon Profile oder Sperren
  liegen, wird der lokale Stand hochgeladen statt gelöscht.
- Ändert ein Admin mehreres kurz hintereinander, kann eine schon **offene
  Abfrage** den eigenen Schreibvorgang überholen und einen älteren Stand
  zurückspielen. Solange eigene Änderungen unterwegs sind, gilt deshalb der
  lokale Stand.

Ohne Relais (Offline-Datei, Netlify ohne Funktion) fällt alles auf den
Gerätespeicher zurück — dann gilt eben wieder nur lokal, was lokal gesetzt
wurde.

### Ansagen

Ein Admin schreibt im Admin-Menü unter *Ansage* einen Text (info · warnung ·
angeheftet). Das Banner fährt **von oben herein** — im Hub genauso wie mitten im
Spiel — und nennt Rolle und Namen des Absenders. **Nach oben wischen** (oder
antippen) lässt es verschwinden; gemerkt wird das pro Gerät, sodass es nicht
wiederkommt. Eine **angeheftete** Ansage kehrt auf dem nächsten Bildschirm
zurück, bis der Admin sie entfernt.

---

## Der Admin-Raum

Unter `#/adminraum` — der 🛡-Knopf oben rechts im Hub führt hin. Vier Reiter:

| Reiter | Was drinsteht |
|---|---|
| 💬 **Raum** | eigener Chat, in dem nur Admins lesen und schreiben |
| 📜 **Protokoll** | was passiert ist, mit Filter und Suche |
| 📨 **Anträge** | was der Nachrichtendienst beantragt hat, mit *Annehmen* und *Ablehnen* |
| 👁 **Bildschirme** | wer gerade was im Hideout macht |

### Protokoll

Ein eigenes Brett (`protokoll`), auf das nur angehängt wird — Einträge lassen
sich nicht ändern und nicht löschen. Ein Protokoll, das man frisieren kann, ist
keines. (Die letzten 400 bleiben; was darüber hinausgeht, fällt heraus. Das ist
eine Speichergrenze, kein Bearbeiten.)

Festgehalten wird unter anderem: gelöschte Nachrichten samt Text, Sperren und
ihre Aufhebung, angelegte und gelöschte Profile, vergebene BND-Freigaben,
Ansagen, gestellte und entschiedene Anträge, jede geöffnete Bildschirmtafel,
jede Anmeldung an der Lagezentrale — auch die **fehlgeschlagenen** — und jedes
Auslösen der Tarnung samt Grund.

Jeder Eintrag nennt Zeit, Person, Rolle und, wo es passt, wen es betrifft.
Filterknöpfe für die häufigen Fälle, dazu ein Suchfeld.

### Bildschirme

Eine Kachel je angemeldetem Gerät, etwa alle 1,2 Sekunden aufgefrischt.
Antippen zeigt sie groß.

> **Was das ist — und was nicht.** Eine Webseite kann den Bildschirm des Geräts
> nicht abfilmen; dafür gäbe es nur `getDisplayMedia`, und das fragt sichtbar um
> Erlaubnis (auf dem iPad gibt es das ohnehin nicht). Übertragen wird deshalb
> genau das, was **das Hideout selbst zeichnet**: das Spielfeld und der Name des
> Bildschirms. Andere Apps, Safari, Nachrichten — davon sieht hier niemand
> etwas. Sag deinen Leuten trotzdem, dass es das gibt.

Gesendet wird **nur, solange jemand hinsieht**. Die Anmeldung des Zuschauers
verfällt nach einer Minute von selbst; danach hört das Gerät von allein wieder
auf, Bilder hochzuladen. Ein unverändertes Bild wird gar nicht erst geschickt —
im Hub tut sich minutenlang nichts.

---

## Tarnung

Ein Deckel, der sofort über allem liegt und nach Schule aussieht. Er wird beim
Start **einmal** gebaut und danach nur ein- und ausgeblendet — deshalb ist er
wirklich sofort da und nicht erst, wenn der Browser noch etwas gerendert hat.
Kein Übergang, keine Animation: ein Deckel, der einfährt, ist verräterischer als
gar keiner. Laufende Spiele halten an, der Ton geht aus, und der Titel des Tabs
wechselt mit.

**Hin:**

| | |
|---|---|
| **Drei Finger** irgendwo auf den Schirm | der zuverlässige Weg |
| Ecke **oben links** gedrückt halten | knapp eine halbe Sekunde |
| `Esc`, `^` oder `#` | am Rechner mit Tastatur |
| Seite wird weggeschaltet | schützt die Vorschau im App-Umschalter |
| Ein Admin löst sie für alle aus | *Admin → Sitzung → Tarnung für alle* |

**Zurück:** dreimal in die **untere rechte Ecke** tippen, oder `Esc`.
Absichtlich nichts Sichtbares — ein Knopf "zurück zum Spiel" auf dem Tarnbild
wäre das Gegenteil von Tarnung.

### Deine eigene Datei

Voreingestellt ist **deine eigene Datei** — zum Beispiel eine Seite aus
GoodNotes. Sie liegt hier:

```
src/assets/tarnung.jpg
```

Danach einmal `node build.mjs`, fertig. Das Bild wird wie alle Bilder als
Daten-URI eingebettet, es lädt also nichts nach und funktioniert im Flugmodus
genauso. Es wird **randlos** über den ganzen Schirm gezogen — ein Bild mit
weißen Balken links und rechts sieht aus wie eine Bildvorschau, nicht wie die
geöffnete Datei.

| | |
|---|---|
| Format | jpg, png oder webp |
| Größe | unter 150 kB je Bild (es zählt gegen das 2048-kB-Budget der Offline-Datei) |
| Zuschnitt | hochkant im Seitenverhältnis des iPads, sonst wird seitlich beschnitten |
| Mehrere | `tarnung2.jpg` bis `tarnung5.jpg` — dann wird **jedes Mal eine davon** gezeigt. Ein Deckel, der immer dasselbe zeigt, fällt beim zweiten Mal auf. |

Solange dort nichts liegt, springt der Deckel auf **Dokument** um: eine
geöffnete Datei mit Werkzeugleiste, Dateiname und Seitenzahl
(*Erdkunde_Referat_Klimazonen.pdf · 3 von 7*), samt passendem Tab-Titel. Dazu
gibt es noch *Suchergebnisse* und *Notizen*; umschaltbar unter
*Einstellungen → Tarnung*.

### Wie schnell das geht

| | |
|---|---|
| Vom Auslöser bis der Deckel liegt | **2 ms** — er ist vorgebaut und wird nur eingeblendet, die Bilder sind vorab dekodiert |
| Erkennung von Spiegelung | alle **250 ms** wird nachgesehen |

Nachgesehen wird auf vier Dinge: die AirPlay-Meldung von WebKit, die
Bildschirmmaße, die Pixeldichte und die Farbtiefe. Pixeldichte und Farbtiefe
lösen sofort aus — die ändern sich nicht beim Drehen und nicht beim Verschieben
eines Fensters. Bei den Maßen ist der Auslöser bewusst träger: erst ab einem
Sprung über ein Achtel, und er muss beim nächsten Blick noch da sein. Sonst
ginge der Deckel schon zu, wenn am Rechner jemand das Fenster größer zieht.

> **Ehrlich gesagt.** Es gibt im Browser **keine** zuverlässige Art zu erkennen,
> dass der Bildschirm gerade gespiegelt oder über Classroom mitgelesen wird.
> Beides passiert im Betriebssystem, ohne dass die Seite davon etwas erfährt.
> Die vier Hinweise oben greifen oft, aber nicht immer. **Verlass dich auf die
> Drei-Finger-Geste** — die ist sofort und geht immer.

---

## Bundesnachrichtendienst

Eine zusätzliche Freigabe **neben** der Rolle, vergeben im Admin-Menü unter
*Leute → Profil → BND-Freigabe*. Kein vierter Rollenbuchstabe, und das hat einen
handfesten Grund: die Rolle steckt im Streuwert des Codes. Gäbe es vier statt
drei, bekäme jeder schon vergebene Code eine andere Rolle — alle Codes wären auf
einen Schlag falsch.

Wer die Freigabe hat, sieht im Hub einen breiten eigenen Knopf. Dahinter:

### Die Schleuse

Vorspann auf Canvas — Raster, Ring, Wappen, der Schriftzug Buchstabe für
Buchstabe, etwas Bildstörung. Antippen überspringt ihn. Danach die zweite
Bestätigung:

1. **Dienstschlüssel**, sechs Ziffern. Er wird aus dem eigenen Code gerechnet,
   muss also nirgends gespeichert und nicht verteilt werden — der Admin sieht ihn
   im Profil und gibt ihn weiter.
2. **Hand auflegen** und 1,6 Sekunden halten. Kein zweites Geheimnis, nur eine
   bewusste Handlung — man soll hier nicht aus Versehen hineinrutschen.

Die Freigabe gilt für **eine Sitzung**. Nach dem Neuladen wieder von vorn.
Ein Fehlversuch landet im Protokoll.

### Die Lagezentrale

| Reiter | Was drinsteht |
|---|---|
| 📋 **Lagebild** | alle Personen mit Ampel, dazu drei Zahlen: erfasst · unauffällig · auffällig |
| ⚠ **Vorgänge** | nur das, was rot ist — das ist auch die Zahl am Knopf im Hub |
| 📨 **Anträge** | eigene Anträge und was daraus geworden ist |
| 🎙 **Befragungen** | ein eigener Raum je Person |
| 📜 **Protokoll** | dasselbe wie im Admin-Raum, gefiltert auf das Fach |

**Codes stehen nirgends.** Statt `0141` zeigt der Dienst `EA-BY` — eine Kennung,
die sich aus dem Code errechnet. Damit lässt sich über jemanden sprechen, ohne
dass sein Zugang auf dem Schirm steht, wenn einer über die Schulter guckt.

### Wie ein zweites Gerät auffällt

Jedes Gerät bekommt beim ersten Start eine Zufallskennung — nichts
Persönliches, kein Fingerabdruck. Beim Anmelden wird sie zum Code notiert:
Gerätetyp, erste und letzte Sichtung. Taucht derselbe Code auf einem **zweiten**
Gerät auf, wird die Ampel rot, der Eintrag ist in der Akte als *Zweitgerät*
markiert, und am Knopf im Hub erscheint eine Zahl. Das ist der übliche Hinweis
darauf, dass ein Code weitergegeben wurde.

### Antrag → Sperre → Befragung

Aus der Akte heraus: **Antrag stellen** (Sperrung · Verwarnung · Beobachtung)
mit Begründung. Der Antrag landet im Admin-Raum unter *Anträge*, mit einer Zahl
am Reiter.

Drückt ein Admin dort auf **✔ Annehmen**, ist der Zugang **sofort** gesperrt —
auch bei jemandem, der gerade spielt: `src/core/wache.js` hört auf die
Verwaltung und wirft ihn innerhalb einer Sekunde auf den Sperrbildschirm, mit
Grund und Namen des Sperrenden. Und die Tür lässt ihn nicht mehr herein.

**Aufheben** geht jederzeit: *Admin → Sperren* (oder im Profil der Person). Auch
das steht im Protokoll.

Direkt nach dem Antrag fragt der Dienst, ob eine **Befragung** eingeleitet
werden soll. Wenn ja, bekommt die Person sofort eine Vorladung auf den Schirm
und landet im Befragungsraum — einem Chat, den beide Seiten sehen. Der Knopf
*Fragen* oben rechts hält einen Fragenkatalog bereit.

---

## Was der Zugangscode jetzt bedeutet

Zwei Dinge haben sich gegenüber der ersten Fassung geändert:

**Der Code wird bei jedem Seitenaufruf neu verlangt.** Vorher lag die Sitzung im
Gerätespeicher: wer einmal drin war, blieb drin — und wer das iPad kurz aus der
Hand gab, gab damit auch seinen Zugang weiter. Jetzt verlangt jedes Neuladen,
jeder neue Tab, jeder Neustart den Code wieder. Innerhalb der Seite — von Kachel
zu Kachel, in ein Spiel und zurück — passiert nichts, denn dabei lädt die Seite
ja nicht neu.

**Ein einzelner Code lässt sich sperren.** Das ging vorher nicht; dafür brauchte
es einen Server, und den gibt es mit dem Relais jetzt. Die Sperrliste liegt in
der Verwaltung und wird **vor** der Codeeingabe geholt — deshalb weist die Tür
einen gesperrten Code auch dann ab, wenn er an sich gültig ist.

Wer sich anmeldet, steht danach auch in der Profilliste, selbst wenn ihn nie ein
Admin angelegt hat. Sonst kennt die Verwaltung nur die von Hand eingetragenen
Leute — und das Lagebild wäre ausgerechnet dort leer, wo es zählt.

> **Was das weiterhin nicht ist.** Die Prüfung des Codes läuft im Browser des
> Besuchers; wer den Quelltext liest, kann sie umgehen. Auch das Relais kennt
> keine Rollen — es prüft nur, dass eine Anfrage von jemandem mit *gültigem*
> Code kommt. Wer Admin oder BND ist, steht in der Verwaltung, und die liegt
> offen. Das hier ist eine Tür mit Schlüssel unter Freunden, kein Tresor.

---

## Die Tür sammelt mit

Ein falscher Code ist die aufschlussreichste Spur, die es gibt: wer probiert
durch, von welchem Gerät, wie oft, und wem hat dieses Gerät vorher gehört.
Genau das wird festgehalten — in `src/core/verhoer.js`, im Brett
`fehlversuche`.

Was zu einem Fehlversuch gespeichert wird:

| | |
|---|---|
| Die probierte Zahl | sie ist ja gerade **kein** gültiger Code |
| Gerätekennung | die Zufallszahl aus dem Speicher, keine Kennung des Geräts selbst |
| Geräteart | iPad · iPhone · Android · Mac · Windows |
| Bildschirm- und Fenstermaße, Pixeldichte | |
| Sprache und Zeitzone | |
| Berührpunkte, Rechenkerne | grobe Bauart |
| Vom Home-Bildschirm gestartet? | |
| Wer sich zuletzt auf diesem Gerät angemeldet hat | steht nur lokal und geht erst mit einer Meldung mit |

Nichts davon identifiziert eine Person. Zusammen reicht es, um „Anna probiert
auf ihrem eigenen iPad herum" von „jemand Fremdes sitzt an Annas iPad" zu
unterscheiden — und genau darum geht es.

### Nach drei Fehlversuchen

```
falscher Code            →  Meldung, 10 s Bild, Hinweis „noch 2 Versuche"
drei in zwanzig Minuten  →  Fall im Brett 'verhoere', die Tür geht in den
                            Verhörbildschirm und lässt sich nicht mehr benutzen
```

Auf dem gesperrten Gerät steht dann:

> **Sie werden kurz verhört.**
> Bitte gedulden Sie sich einen Moment.

Nach zweieinhalb Sekunden rutscht der Text nach oben und darunter geht ein
Chatraum auf. Der Befragte kann schreiben — mehr nicht.

### Beim Dienst

Sobald ein Fall aufgeht, erscheint bei **jedem BND-Mitarbeiter** ein eigenes
Fenster unten rechts — überall in der App, auch mitten im Spiel. Es nennt die
Zahl der Fehlversuche, die Geräteart, die Kennung und wer sich zuletzt auf
diesem Gerät angemeldet hat. Ein Knopf: **Fall öffnen**.

Dahinter liegt der Verhörraum. Oben zwei Werkzeuge — ein **Fragenkatalog** zum
Antippen und die **Geräteakte** mit allem oben Aufgezählten. Unten, direkt über
der Eingabe, die Entscheidung:

| | |
|---|---|
| ✅ **Freigeben** | Die Tür geht sofort wieder auf, der Betreffende kann seinen Code eingeben. |
| ⛔ **Ablehnen** | Mit Begründung. Sperren darf der Dienst **nicht** — es geht ein Antrag an die Administration. Bis dort entschieden ist, bleibt die Tür zu, und der Befragte sieht das auch so. |

Nimmt ein Admin den Antrag an, ist das **Gerät** gesperrt (nicht ein Code — den
hat der Betreffende ja gerade nicht). Es kommt danach gar nicht mehr an die
Codeeingabe. Lehnt der Admin ab, wird das Gerät automatisch wieder freigegeben.
Aufheben geht jederzeit unter *Admin → Sperren*, wo Zugänge und Geräte
getrennt stehen.

Im BND gibt es dafür den Reiter **🚪 Tür**: offene Verhöre oben, darunter die
erledigten und alle Geräte, die je einen falschen Code eingegeben haben — mit
der Liste der probierten Zahlen.

---

## Entwicklerkonsole

Den Selbsttest gab es schon, aber nur über `?selftest=1`, und er schrieb sein
Ergebnis in die Browserkonsole. Auf einem iPad kommt man da nicht heran.

Unter **#/dev** (Admin → Sitzung → Entwicklerkonsole) läuft derselbe Test mit
einer Anzeige, und daneben steht alles, was man beim Fehlersuchen wissen will:

| Reiter | Was drinsteht |
|---|---|
| 🧪 **Selbsttest** | 600 / 2000 / 8000 / 20000 Schritte je Spiel, Fortschrittsbalken, Ergebnis je Spiel mit Zeit |
| 📡 **Verbindung** | Relais erreichbar, Gerätekennung, Aufenthalt, ob gerade jemand zusieht — dazu **zehn Laufzeitmessungen** als Balken, und welche Bretter das Gerät beobachtet |
| ⚠ **Ausnahmen** | alles, was seit dem Laden schiefgegangen ist, mit Stapel |
| 💾 **Speicher** | Ablage, Belegung, jeder Schlüssel im Benutzerraum |

Die Laufzeitmessung ist nach der Sache mit der Verzögerung dazugekommen: sie
zeigt die halbe Strecke. Bis eine Nachricht bei den anderen ankommt, dauert es
ungefähr genauso lang noch einmal.

---

## Gehstockflix

Ein kleines Videoregal für die Pause: Vorspann, Kacheln, Abspieler.

Der Vorspann ist der bekannte Buchstabenaufbau, nur mit einem **G**: ein
Lichtblitz, dann fächern sich zweiundvierzig senkrechte Streifen auf, fahren
zusammen und lassen dabei die Form des Buchstabens stehen. Danach der
Schriftzug.

Wie die Form entsteht, ohne eine einzige Bilddatei: der Buchstabe wird einmal
in eine unsichtbare zweite Leinwand gezeichnet und dient danach als Maske. Die
Streifen werden mit `destination-in` durch diese Maske gezeichnet — deshalb
sehen sie am Ende exakt wie das G aus. Antippen überspringt, und pro Sitzung
läuft er nur einmal.

Dahinter liegt das Regal. Ganz oben ein Top-Titel mit großem Bild, darunter
eine Reihe je Kategorie. Eine Kachel antippen öffnet die Infokarte, der
**▶** darauf spielt sofort ab — der Abspieler legt sich über den ganzen
Bildschirm und geht mit *‹ Zurück* oder Esc wieder zu.

Die Videos liegen bei YouTube; gespeichert ist in `src/data/videos.js` nur
die Kennung je Video. Vorschaubild und Abspieladresse rechnet `flix.js`
sich daraus zusammen — ein neues Video eintragen heißt also: eine Zeile in
die passende Reihe schreiben, sonst nichts.

> **Gehstockflix braucht die Website.** Aus der Offline-Einzeldatei heraus
> läuft die Seite unter `file://` und hat damit keinen Ursprung, den YouTube
> gelten lässt — eingebettet bliebe der Abspieler schwarz. Er sagt das dann
> auch und bietet den Weg zu YouTube an. Auf dem iPad heißt das: die Seite
> über Netlify aufrufen und auf den Home-Bildschirm legen, nicht die
> Offline-Datei aus der Dateien-App öffnen.

---

## Besprechungen

Ein Admin macht eine auf (*Admin → Sitzung → Besprechung eröffnen*), gibt ihr
einen Titel und tippt an, wer eingeladen ist. Die Eingeladenen bekommen sofort
einen Hinweis auf den Schirm und oben in der Leiste einen Knopf **📋 Meeting**
mit einer Zahl.

Am Tisch gibt es vier Reiter:

### 🪑 Tisch

Ein runder Tisch, außen ein Stuhl je Eingeladenem. Wer gerade online ist, sitzt
grün umrandet da, mit dem Ort darunter (*Startseite*, *Tetris*, *Innerer
Kreis*…); wer nicht da ist, bleibt grau. In der Mitte der Titel und „3 von 5
da". Darunter eine **Notiz für alle**.

### 🗺 Route

Ein schematischer Schulplan mit elf Orten — Haupteingang, Pausenhof, Mensa,
Kiosk, Sporthalle, Bibliothek, Aula, C-Trakt, Naturwissenschaften,
Fahrradständer, Hinterausgang. Antippen setzt einen Punkt, nochmal antippen
nimmt ihn wieder weg. Der Weg wird als nummerierte gestrichelte Linie
gezeichnet, darunter steht die Reihenfolge und **wie weit und wie lange** das
ungefähr ist.

Alle sehen dieselbe Route, in unter einer Sekunde. Ein Punkt wird beim
Loslassen verschickt, nicht bei jeder Bewegung — die Verwaltung wird als Ganzes
geschrieben, und das dauernd zu tun wäre Unfug.

### 🕘 Stundenplan

Fünf Tage, neun Stunden, einer für alle. Antippen ändert eine Stunde (Fach und
Raum), die **laufende Stunde** ist hervorgehoben, die großen Pausen nach der 2.
und der 4. sind eingezeichnet.

### 💬 Chat

Wie überall — mit Bildern und Abstimmungen.

Ein Admin beendet die Besprechung oben rechts; dann verschwindet sie bei allen
aus der Leiste.
