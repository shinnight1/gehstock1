# GehstockMon-Rom-Event „ROMA È FINITA“

Ein Admin-Abuse-Event: 1 Minute Countdown und 12 Minuten Rom für alle in derselben
GehstockMon-Welt. Starten und abbrechen kann es nur der aktuelle CEO.

## Starten (echte Seite)

1. Einmalig auf dem Handy die Event-PIN setzen und den Server neu starten:
   ```sh
   node ~/gehstock1/tools/rom-pin.mjs
   bash ~/gehstock1/tools/handy-aktualisieren.sh
   ```
   Die PIN liegt nur als Hash in `~/.config/gehstock1/rom.env`. Wechselt der CEO,
   eine neue PIN setzen.
2. Als CEO im Admin-Menü den Reiter **🇮🇹 Rom-Event** öffnen, **Rom-Event starten**,
   PIN eingeben. Der Reiter zeigt, warum ein Start gerade nicht geht (Insel zu,
   zu kurz vor Schluss, Event dieser Woche schon gelaufen, keine PIN).
3. Abbrechen geht jederzeit im selben Reiter. Bereits Verdientes wird ausgezahlt;
   im Countdown abgebrochen zählt es nicht als Event der Woche.

Grenzen: ein echtes Event pro Woche, nur bei geöffneter Insel und mit mindestens
15 Minuten bis zum Schließen. Ein manuell geöffnetes oder geschlossenes Insel-Tor
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
| Tourist | 10 Lire | 200 Gold, ein Rom-Ei (fertig ausgebrütet, mindestens Legendär) |
| Gladiator | 40 Lire | +300 Gold, 3 Episch-Runen |
| Held von Rom | 75 Lire | +250 Gold, Titel „Held von Rom“ |
| Mamma-Mia-Leiste voll | – | +150 Gold für alle ab Tourist, +20 % gegen den Boss |
| Mozzarellus besiegt | Gladiator + 5 Schläge | Centurio Mozzarino (Legendär, nur aus dem Event) |
| Mozzarellus besiegt | 1 Schlag | Titel „Mozzarella-Bezwinger“ |

Abgerechnet wird genau einmal, drei Sekunden nach dem Ende, im selben
Schreibvorgang wie die Welt (`world.rom.abgerechnet`).
