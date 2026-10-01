# GehstockMon-Rom-Event „ROMA È FINITA“

Ein Admin-Abuse-Event: 1 Minute Countdown und 13 Minuten Rom für alle in derselben
GehstockMon-Welt. Starten und abbrechen kann es nur der aktuelle CEO.

## Ablauf

| Phase | Dauer | Was passiert |
|---|---|---|
| Countdown | 1 min | Kulisse wächst aus dem Boden, Kakerlaken tanzen schon |
| Rom verliert den Verstand | 2 min | Pizzen mit Beinen schnappen |
| Die Pizza-Rebellion | 2,5 min | Pizzen und Legionäre am Triumphwagen |
| Die Sombrero-Invasion | 2,5 min | Tanzfolgen nachtippen, Polonaise auf der Piazza |
| Imperatore Mozzarellus | 3,5 min | Boss; nach dem Sieg Käseregen: 2 Gold je Sekunde |
| Espresso-Overdrive | 1 min | Musik extrem schnell (×2,2), Espresso/Tomaten/Pizza fangen |
| Der Trevi-Brunnen explodiert | 1,5 min | Münze werfen, Münzen fangen, 6 normale Eier fangen |

Das ganze Event über: Sternschnuppen (das Foto) zum Antippen und tanzende
Kakerlaken an allen Tanzplätzen der Insel (`ROM.TANZPLAETZE`). Musik und Effekte
lassen sich während des Events nicht abschalten – die Musik läuft auch bei
ausgeschaltetem Hideout-Ton. Nur das Flackern wird ruhiger, wenn das Gerät
„Bewegung reduzieren“ verlangt. Solange Rom läuft, ist die Projektleiste
ausgeblendet und die Rom-Anzeige steht an ihrer Stelle ganz oben.

## Starten (echte Seite)

1. Als CEO im Admin-Menü den Reiter **🇮🇹 Rom-Event** öffnen und **Rom-Event starten**
   drücken. Eine PIN braucht es nicht (so gewünscht am 01.10.2026). Der Reiter
   zeigt, warum ein Start gerade nicht geht (Insel zu, zu kurz vor Schluss, Event
   dieser Woche schon gelaufen).
2. Optional lässt sich auf dem Handy in Termux eine Event-PIN setzen:
   ```sh
   node ~/gehstock1/tools/rom-pin.mjs
   ```
   Ab dann verlangt der Start sie. Die PIN liegt nur als Hash in
   `~/.config/gehstock1/rom.env`; der laufende Server liest die Datei alle
   15 Sekunden nach, ein Neustart ist nicht nötig. Ohne PIN kann jeder starten, der
   den CEO-Code kennt - und die Zugangscodes sind im Moment für jeden lesbar.
3. Abbrechen geht jederzeit im selben Reiter. Bereits Verdientes wird ausgezahlt;
   im Countdown abgebrochen zählt es nicht als Event der Woche.

Grenzen: ein echtes Event pro Woche, nur bei geöffneter Insel und mit mindestens
16 Minuten bis zum Schließen. Ein manuell geöffnetes oder geschlossenes Insel-Tor
gilt auch für das Event.

## Testen

- **Entwicklungsserver** (`npm run build`, dann `npm run dev`): Insel immer offen,
  keine PIN, keine Wochengrenze, Zeitraffer ×3 oder ×6 wählbar. In der leeren
  Testwelt gibt es noch keinen CEO – im Admin-Menü unter **Konto** steht dafür
  „🛠 Entwicklung: CEO werden“ (nur auf localhost, nur solange niemand CEO ist).
- **Vorschau auf der echten Seite**: im Rom-Reiter „Vorschau in der Testzone“ – läuft
  in der Developer-Testzone im Zeitraffer, ohne echte Belohnungen und ohne die
  echte Welt zu berühren.
- Automatisch: `tools/gehstockmon-rom-tests.mjs` (Server, Rechte, Abrechnung),
  `tools/gehstockmon-rom-szene-tests.mjs` (3D-Kulisse mit dem echten Three-Build),
  `tools/gehstockmon-rom-ui-tests.mjs` (Bedienung). Alle laufen in der
  Update-Schranke mit. Optional mit Playwright: `tools/gehstockmon-rom-browsertest.mjs`.

## Wo was steht

| Datei | Inhalt |
|---|---|
| `src/games/gehstockmon/2-rom.js` | Zeitplan, Wege, Lire, Stufen, Boss-Formel, Centurio Mozzarino |
| `netlify/functions/lib/gehstockmon-rom.mjs` | CEO-Prüfung, PIN, Aktionen, Abrechnung, Rom-Ei |
| `src/games/gehstockmon/2-rom-szene.js` | Kulisse und Figuren in 3D |
| `src/games/gehstockmon/2-rom-ui.js` | Anzeige, Knöpfe, Tanz, Musik, Abschluss |
| `src/core/rom-steuerung.js` | Admin-Reiter |

Musik und Sternschnuppen-Bild stehen zentral in `R.ROM_ASSETS` (2-rom-ui.js):
`src/assets/gm-rom-musik.mp3` und `src/assets/gm-rom-stern.webp` einfach
austauschen. Fehlt die Musik, spielt eine eingebaute Tarantella.

## Belohnungen

| Stufe | ab | Belohnung |
|---|---|---|
| Tourist | 10 Lire | 300 Gold, ein Rom-Ei (fertig ausgebrütet, mindestens Legendär) |
| Gladiator | 40 Lire | +500 Gold, 5 Episch-Runen |
| Held von Rom | 75 Lire | +600 Gold, 2 Mythisch-Runen, Titel „Held von Rom“ |
| Legende von Rom | 110 Lire | +800 Gold, Schimmerperle (schon vorhanden: 1000 Gold), Titel „Legende von Rom“ |
| Mamma-Mia-Leiste voll | – | +300 Gold für alle ab Tourist, +20 % gegen den Boss |
| Mozzarellus besiegt | Gladiator + 5 Schläge | Centurio Mozzarino (Legendär, nur aus dem Event) |
| Mozzarellus besiegt | 1 Schlag | 250 Siegesgold, Titel „Mozzarella-Bezwinger“ |
| Käseregen | dabei sein | 2 Gold je echter Sekunde bis zum Ende der Boss-Phase (auch ohne Stufe) |
| Trevi-Eier | antippen | bis zu 6 normale Eier (auch ohne Stufe; Tasche voll: Warteschlange, dann 350 Gold) |

Abgerechnet wird genau einmal, drei Sekunden nach dem Ende, im selben
Schreibvorgang wie die Welt (`world.rom.abgerechnet`).
